import * as path from 'path';
import * as fs from 'fs';
import type { ContextPack } from '../project-registry/types';
import type { CandidateFile, CandidateSelection } from './types';

const MAX_CANDIDATES = 24;
const MAX_BYTES_PER_FILE = 256 * 1024;
const FORBIDDEN = [/^node_modules\//, /^dist\//, /^build\//, /^\.git\//, /\.env$/];

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
      let score = 0;
      let filenameHit = false;
      for (const hint of hints) {
        if (base.includes(hint)) {
          score += 3;
          filenameHit = true;
        } else if (dir.includes(hint)) {
          score += 1;
        }
      }

      const testGuess = guessRelatedTests(normalized);
      return {
        path: normalized,
        reason: filenameHit
          ? 'filename matches request hints'
          : score > 0
            ? 'module path matches request hints'
            : 'included by active context pack',
        relatedTests: testGuess,
        confidence: Math.min(0.95, 0.4 + score * 0.06 + (testGuess.length ? 0.05 : 0)),
      };
    })
    .sort((a, b) => b.confidence - a.confidence || a.path.localeCompare(b.path))
    .slice(0, MAX_CANDIDATES);

  return { candidates, excluded, hardLimit: MAX_CANDIDATES, maxBytesPerFile: MAX_BYTES_PER_FILE, source: 'context-pack' };
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
