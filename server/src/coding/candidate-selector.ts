import * as path from 'path';
import * as fs from 'fs';
import type { ContextPack } from '../project-registry/types';
import type { CandidateFile, CandidateSelection } from './types';

const MAX_CANDIDATES = 24;
const MAX_BYTES_PER_FILE = 256 * 1024;
const FORBIDDEN = [/^node_modules\//, /^dist\//, /^build\//, /^\.git\//, /\.env$/];

/**
 * Only prune unmatched candidates once the set is large enough for noise to be
 * the bigger risk. On a small repository every file is plausibly relevant and
 * dropping one starves the engine of the file it actually needs.
 */
const PRUNE_ABOVE = 8;

/**
 * Hard cap on the *initial* candidate set.
 *
 * MAX_CANDIDATES bounds what the context pack may ever offer; this bounds what
 * the engine starts with. On Mi Core the pack legitimately matches ~20 files
 * across a dozen modules, and handing all of them to an 8B model reliably
 * derailed it — in one pilot run it invented a path and a task about
 * factorials. Progressive expansion (llm/context-bridge) remains available for
 * anything genuinely needed beyond the top slice, with a recorded justification.
 */
const INITIAL_TOP_K = Number(process.env.MI_CODING_INITIAL_CANDIDATES) > 0
  ? Number(process.env.MI_CODING_INITIAL_CANDIDATES)
  : 8;

/** Test files are the specification; they are never pruned for lack of a hint. */
function isTestPath(relative: string): boolean {
  return /(^|\/)(tests?|spec|specs|__tests__|t)\//.test(relative) || /[._-](test|spec)\.[cm]?[jt]sx?$/.test(relative);
}

/**
 * Word-level match tolerant of morphological variants. `normalisation` in a
 * request must match `stage_normalise.js`; exact substring matching does not,
 * and that miss is enough to exclude the one file a task needs.
 */
function matchesHint(word: string, hint: string): boolean {
  if (word === hint) return true;
  if (word.length >= 4 && hint.includes(word)) return true;
  if (hint.length >= 4 && word.includes(hint)) return true;
  const shared = Math.min(word.length, hint.length);
  return shared >= 5 && word.slice(0, 5) === hint.slice(0, 5);
}

function words(value: string): string[] {
  return value.split(/[^a-z0-9]+/i).filter(part => part.length > 1);
}

export function selectCandidateFiles(pack: ContextPack, userRequest: string): CandidateSelection {
  const hints = tokenize(userRequest);
  const excluded: string[] = [];
  const candidates = pack.includedPaths
    .filter(file => {
      const normalized = file.replace(/\\/g, '/');
      if (FORBIDDEN.some(pattern => pattern.test(normalized))) {
        excluded.push(file);
        return false;
      }
      return true;
    })
    .map((file): CandidateFile => {
      const normalized = file.replace(/\\/g, '/');
      const lower = normalized.toLowerCase();
      const base = path.posix.basename(lower);
      const dir = path.posix.dirname(lower);

      // A hint matching the filename is a far stronger signal than one matching
      // a directory, because every file in a module shares its directory name.
      // Scoring them equally made whole modules tie on confidence and fall back
      // to alphabetical order, which on a large repository buried the relevant
      // file underneath unrelated siblings.
      const baseWords = words(base);
      const dirWords = words(dir);
      let score = 0;
      let filenameHit = false;
      for (const hint of hints) {
        if (baseWords.some(word => matchesHint(word, hint))) {
          score += 3;
          filenameHit = true;
        } else if (dirWords.some(word => matchesHint(word, hint))) {
          score += 1;
        }
      }

      const testGuess = guessRelatedTests(normalized);
      const isTest = isTestPath(normalized);
      return {
        path: normalized,
        reason: filenameHit
          ? 'filename matches request hints'
          : score > 0
            ? 'module path matches request hints'
            : isTest
              ? 'test file for the requested behaviour'
              : 'included by active context pack',
        relatedTests: testGuess,
        confidence: Math.min(0.95, 0.4 + score * 0.06 + (testGuess.length ? 0.05 : 0) + (isTest ? 0.03 : 0)),
      };
    })
    .sort((a, b) => b.confidence - a.confidence || a.path.localeCompare(b.path));

  // On a repository the size of Mi Core, padding to the cap buries the request
  // under a wall of unrelated modules and a local 8B model starts describing
  // whatever it was shown instead of what was asked. Pruning only helps there:
  // below the threshold every file is plausibly relevant, and dropping one
  // starves the engine of the file the task actually needs.
  const keepAll = candidates.length <= PRUNE_ABOVE;
  const pruned = keepAll ? candidates : candidates.filter(candidate => !candidate.reason.startsWith('included by'));
  const chosen = pruned.slice(0, Math.min(INITIAL_TOP_K, MAX_CANDIDATES));

  for (const candidate of candidates) {
    if (chosen.includes(candidate)) continue;
    const reason = pruned.includes(candidate) ? 'outside the initial top-k' : 'no request-hint match';
    excluded.push(`${candidate.path}: ${reason}`);
  }

  return { candidates: chosen, excluded, hardLimit: MAX_CANDIDATES, maxBytesPerFile: MAX_BYTES_PER_FILE, source: 'context-pack' };
}

export function enforceCandidateFileLimits(worktreePath: string, selection: CandidateSelection): CandidateSelection {
  const root = fs.realpathSync.native(worktreePath);
  const excluded = [...selection.excluded];
  const candidates = selection.candidates.filter(candidate => {
    const absolute = path.resolve(root, candidate.path);
    if (!isInside(absolute, root) || path.isAbsolute(candidate.path)) {
      excluded.push(`${candidate.path}: outside worktree`);
      return false;
    }
    if (!fs.existsSync(absolute)) {
      excluded.push(`${candidate.path}: missing`);
      return false;
    }
    const real = fs.realpathSync.native(absolute);
    if (!isInside(real, root)) {
      excluded.push(`${candidate.path}: symlink escape`);
      return false;
    }
    const stat = fs.statSync(real);
    if (!stat.isFile()) {
      excluded.push(`${candidate.path}: not a file`);
      return false;
    }
    if (stat.size > selection.maxBytesPerFile) {
      excluded.push(`${candidate.path}: exceeds byte limit`);
      return false;
    }
    return true;
  });
  return { ...selection, candidates, excluded };
}

export function assertPlanWithinCandidates(filesToChange: string[], selection: CandidateSelection): void {
  const allowed = new Set(selection.candidates.map(candidate => candidate.path.replace(/\\/g, '/')));
  const outside = filesToChange.map(file => file.replace(/\\/g, '/')).filter(file => !allowed.has(file));
  if (outside.length) {
    throw new Error(`engine plan includes files outside context candidates: ${outside.join(', ')}`);
  }
}

function guessRelatedTests(file: string): string[] {
  const parsed = path.posix.parse(file);
  const testPath = path.posix.join(parsed.dir, '__tests__', `${parsed.name}.test${parsed.ext}`);
  const sibling = path.posix.join(parsed.dir, `${parsed.name}.test${parsed.ext}`);
  return [testPath, sibling];
}

function tokenize(value: string): string[] {
  return [...new Set(value.toLowerCase().split(/[^a-z0-9_-]+/).filter(v => v.length > 2))];
}

function isInside(target: string, root: string): boolean {
  const rel = path.relative(root, target);
  return rel === '' || (!!rel && !rel.startsWith('..') && !path.isAbsolute(rel));
}
