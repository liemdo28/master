/**
 * Materialises a fixture into a disposable git repository.
 *
 * Each run gets its own directory and its own initial commit so the engine sees
 * a real repo with a real base SHA, and so a diff can be taken afterwards.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import type { Fixture } from './fixtures';

export interface MaterializedFixture {
  fixture: Fixture;
  root: string;
  baseCommit: string;
  cleanup: () => void;
}

function gitSync(cwd: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    windowsHide: true,
    encoding: 'utf8',
    timeout: 60_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

export function materializeFixture(fixture: Fixture, parentDir?: string): MaterializedFixture {
  const base = parentDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'mi-phase4-fx-'));
  const root = path.join(base, fixture.id);
  fs.mkdirSync(root, { recursive: true });

  for (const file of fixture.files) {
    const target = path.join(root, file.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, file.content);
  }
  fs.writeFileSync(path.join(root, '.gitignore'), 'node_modules/\ndist/\n');

  gitSync(root, ['init', '--initial-branch=main']);
  gitSync(root, ['config', 'user.name', 'Mi Phase4 Fixture']);
  gitSync(root, ['config', 'user.email', 'phase4-fixture@example.invalid']);
  gitSync(root, ['config', 'commit.gpgsign', 'false']);
  gitSync(root, ['add', '--', '.']);
  gitSync(root, ['commit', '-m', `fixture: ${fixture.id}`]);
  const baseCommit = gitSync(root, ['rev-parse', 'HEAD']);

  return {
    fixture,
    root,
    baseCommit,
    cleanup: () => {
      try {
        fs.rmSync(base, { recursive: true, force: true, maxRetries: 3 });
      } catch {
        // Temp dirs are reclaimed by the OS; a locked handle is not worth failing on.
      }
    },
  };
}
