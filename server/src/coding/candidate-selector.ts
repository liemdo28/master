import * as path from 'path';
import type { ContextPack } from '../project-registry/types';
import type { CandidateFile, CandidateSelection } from './types';

const MAX_CANDIDATES = 24;
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

  return { candidates, excluded, hardLimit: MAX_CANDIDATES, source: 'context-pack' };
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
