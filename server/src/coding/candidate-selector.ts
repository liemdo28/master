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
      const haystack = normalized.toLowerCase();
      const score = hints.reduce((acc, hint) => acc + (haystack.includes(hint) ? 1 : 0), 0);
      const testGuess = guessRelatedTests(normalized);
      return {
        path: normalized,
        reason: score > 0 ? 'matched request hints from context pack' : 'included by active context pack',
        relatedTests: testGuess,
        confidence: Math.min(0.95, 0.45 + score * 0.12 + (testGuess.length ? 0.1 : 0)),
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
