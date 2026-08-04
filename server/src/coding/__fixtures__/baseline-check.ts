/**
 * Confirms each fixture starts in the state the suite assumes: the seeded
 * defects must actually fail, and the refactor fixture must actually be green.
 * If this drifts, benchmark results become meaningless.
 */

import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { FIXTURES } from './fixtures';
import { materializeFixture } from './materialize';
import { resolveNpmInvocation } from '../validation-runner';

/** Signals that the fixture's own harness failed to start, rather than a test failing. */
const HARNESS_ERRORS: RegExp[] = [
  /Cannot find module/,
  /MODULE_NOT_FOUND/,
  /Missing script/,
  /npm ERR! Missing/,
  /command not found/,
  /is not recognized as an internal or external command/,
  /spawn error:/,
];

const EXPECTED_BASELINE: Record<string, 'FAIL' | 'PASS'> = {
  'task-a-bug-fix': 'FAIL',
  'task-b-multi-file-feature': 'FAIL',
  'task-c-type-repair': 'FAIL',
  'task-d-refactor': 'PASS',
  'task-e-unfamiliar-repo': 'FAIL',
};

function runCommand(cwd: string, command: string): { exitCode: number; output: string } {
  const parts = command.split(' ').filter(Boolean);
  let bin = parts[0];
  let args = parts.slice(1);
  if (bin === 'npm') {
    const npm = resolveNpmInvocation();
    if (!npm.configured) return { exitCode: 1, output: 'npm could not be resolved' };
    bin = npm.command;
    args = [...npm.args, ...args];
  }
  try {
    const out = execFileSync(bin, args, {
      cwd,
      encoding: 'utf8',
      timeout: 180_000,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { exitCode: 0, output: out };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string; message?: string };
    return {
      exitCode: e.status ?? 1,
      output: `${e.stdout ?? ''}${e.stderr ?? ''}${e.status === undefined ? `\nspawn error: ${e.message ?? ''}` : ''}`,
    };
  }
}

/** Task C needs a TypeScript compiler; borrow the server's own install. */
function linkTypescript(root: string): void {
  const serverModules = path.resolve(__dirname, '..', '..', '..', 'node_modules');
  if (!fs.existsSync(path.join(serverModules, 'typescript'))) return;
  const target = path.join(root, 'node_modules');
  fs.mkdirSync(target, { recursive: true });
  for (const name of ['typescript', '.bin']) {
    const from = path.join(serverModules, name);
    const to = path.join(target, name);
    if (fs.existsSync(from) && !fs.existsSync(to)) {
      try {
        fs.symlinkSync(from, to, 'junction');
      } catch {
        fs.cpSync(from, to, { recursive: true });
      }
    }
  }
}

async function main(): Promise<void> {
  let failures = 0;
  for (const fixture of FIXTURES) {
    const materialized = materializeFixture(fixture);
    try {
      if (fixture.id === 'task-c-type-repair') linkTypescript(materialized.root);
      let worst = 0;
      let combined = '';
      for (const command of fixture.validationCommands) {
        const result = runCommand(materialized.root, command);
        worst = Math.max(worst, result.exitCode);
        combined += result.output;
      }
      const actual = worst === 0 ? 'PASS' : 'FAIL';
      const expected = EXPECTED_BASELINE[fixture.id];

      // A fixture that "fails" because its own test harness cannot start is
      // useless: it fails identically no matter what the engine does, so every
      // model scores zero on it for a reason that has nothing to do with the
      // task. This caught `node --test spec` resolving as a module path rather
      // than a directory, which made two fixtures permanently unpassable.
      const harnessBroken = HARNESS_ERRORS.find(pattern => pattern.test(combined));
      const ranRealTests = /(^|\n)\s*(ℹ\s*pass|# pass)\s+\d+/.test(combined) || /error TS\d+/.test(combined);

      const ok = actual === expected && !harnessBroken && ranRealTests;
      if (!ok) failures += 1;
      console.log(
        `${ok ? 'OK  ' : 'BAD '} ${fixture.id.padEnd(28)} baseline=${actual} expected=${expected}` +
          `${harnessBroken ? ` HARNESS-ERROR(${harnessBroken.source})` : ''}${ranRealTests ? '' : ' NO-TESTS-RAN'}`
      );
      if (!ok) console.log(combined.split('\n').slice(0, 25).join('\n'));
    } finally {
      materialized.cleanup();
    }
  }
  if (failures) {
    console.error(`\n${failures} fixture(s) did not match the expected baseline.`);
    process.exit(1);
  }
  console.log('\nAll fixtures match their expected baseline.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
