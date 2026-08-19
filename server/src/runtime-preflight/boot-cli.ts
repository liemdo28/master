/**
 * Phase 8D — formalizes the working `pm2 resurrect` boot-recovery path by
 * wrapping it in an explicit, git-tracked, logged script instead of an
 * invisible VBScript calling a bare `pm2 resurrect` directly (the
 * `pm2-windows-startup` package's own `pm2_resurrect.cmd`, not part of this
 * repo).
 *
 * Adds "the optional preflight check" the Phase 8 roadmap calls for by
 * running the existing Phase 7A `recovery-cli.ts` in its default, already
 * safe dry-run mode first — this performs the full preflight validation,
 * duplicate-PM2-entry detection, and intentionally-stopped-service check,
 * and logs a clear plan, but (dry-run, unchanged) never starts or stops
 * anything itself.
 *
 * Critically, this is advisory-only: `pm2 resurrect` always runs afterward
 * regardless of what the dry-run preflight reported, exactly matching the
 * roadmap's own design requirement ("runs before pm2 resurrect, not instead
 * of it"). `pm2 resurrect`'s own behavior — restoring every process exactly
 * as `dump.pm2` recorded it — is completely unchanged; this only adds
 * visibility into the runtime's health at the moment of boot, on top of the
 * exact same real recovery this machine already performs today.
 */
import { execFileSync } from 'child_process';
import path from 'path';
import { runPreflight } from './validator';
import { buildPlan, type Pm2Process } from './recovery-cli';

function pm2ExecOpts(extra: Record<string, unknown> = {}) {
  // See recovery-cli.ts's own comment: pm2 resolves to a .cmd shim on
  // Windows, which execFileSync cannot invoke without going through cmd.exe.
  return { shell: true as const, ...extra };
}

function defaultReadPm2List(): Pm2Process[] {
  try {
    const raw = execFileSync('pm2', ['jlist'], { encoding: 'utf8', timeout: 15_000, ...pm2ExecOpts() });
    return JSON.parse(raw) as Pm2Process[];
  } catch (err) {
    console.warn(`[boot-cli] warning: could not read PM2 state before resurrect (${err instanceof Error ? err.message : String(err)})`);
    return [];
  }
}

function defaultResurrect(): void {
  execFileSync('pm2', ['resurrect'], pm2ExecOpts({ stdio: 'inherit' }));
}

export interface BootDependencies {
  readPm2List: () => Pm2Process[];
  resurrect: () => void;
}

export const defaultBootDependencies: BootDependencies = {
  readPm2List: defaultReadPm2List,
  resurrect: defaultResurrect,
};

export interface BootResult {
  preflightOverall: string;
  resurrectCalled: boolean;
}

/** Dependency-injected so tests can prove the "always resurrect, even on
 *  preflight FAIL" invariant without ever invoking real PM2. Production use
 *  (the CLI entrypoint below) always passes `defaultBootDependencies`. */
export async function runBootPreflightAndResurrect(runtimeRoot: string, deps: BootDependencies = defaultBootDependencies): Promise<BootResult> {
  console.log(`[boot-cli] runtime root: ${runtimeRoot}`);
  console.log('[boot-cli] running preflight (advisory only — will not block pm2 resurrect)...');

  const report = await runPreflight(runtimeRoot);
  for (const c of report.checks) {
    const marker = c.status === 'PASS' ? '✓' : c.status === 'WARN' ? '⚠' : c.status === 'SKIP' ? '·' : '✗';
    console.log(`  ${marker} ${c.id}: ${c.detail}`);
  }
  console.log(`[boot-cli] preflight overall: ${report.overall}`);

  const plan = buildPlan(report, deps.readPm2List());
  console.log(`[boot-cli] pre-resurrect plan snapshot — already online: ${plan.alreadyOnline.join(', ') || '(none)'}; intentionally stopped: ${plan.intentionallySkipped.join(', ') || '(none)'}${plan.duplicates.length ? `; DUPLICATE PM2 ENTRIES: ${plan.duplicates.join('; ')}` : ''}${plan.blockers.length ? `; preflight blockers: ${plan.blockers.join('; ')}` : ''}`);

  if (report.overall === 'FAIL') {
    console.error('[boot-cli] preflight FAILED — logged above for operator visibility. Proceeding to pm2 resurrect anyway, per design (advisory only, never blocks the actual recovery mechanism).');
  }

  console.log('[boot-cli] calling pm2 resurrect...');
  deps.resurrect();
  console.log('[boot-cli] pm2 resurrect complete.');

  return { preflightOverall: report.overall, resurrectCalled: true };
}

async function main(): Promise<void> {
  const runtimeRoot = process.argv[2] || path.resolve(__dirname, '..', '..', '..');
  await runBootPreflightAndResurrect(runtimeRoot);
}

if (require.main === module) {
  main().catch(err => { console.error('[boot-cli] fatal:', err); process.exitCode = 1; });
}
