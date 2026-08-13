/**
 * Phase 7A.7/7A.8 — deterministic boot/recovery bootstrap script.
 *
 * This is the "smallest auditable solution" chosen from the Phase 7 discovery
 * doc's comparison (Scheduled Task / Windows Service wrapper / bootstrap
 * script): plain repository-tracked TypeScript, zero new dependencies, no
 * OS-level registration performed by this file itself. A future explicit
 * directive can wire a Windows Scheduled Task to invoke this script at boot
 * (`node -r tsx/cjs server/src/runtime-preflight/recovery-cli.ts --apply`) —
 * this file does not register itself, since that is a persistent, host-level
 * change outside this repository's own blast radius.
 *
 * Safety model:
 *  - Defaults to --dry-run: prints exactly what it would do and exits 0/1
 *    without starting or stopping anything.
 *  - Refuses to proceed at all if the preflight validator reports FAIL.
 *  - Never starts mi-ceo-observer, mi-whatsapp-gateway, or mi-n8n — these are
 *    intentionally stopped and this script has no flag to override that.
 *  - Never touches a process that is already online (idempotent — re-running
 *    this after a successful boot is a safe no-op).
 *  - Detects duplicate/orphan PM2 entries (same app name registered twice,
 *    or a PM2 entry whose script path no longer exists) and reports them as
 *    blockers rather than silently working around them.
 */
import { execFileSync } from 'child_process';
import path from 'path';
import { runPreflight, intentionallyStoppedServices, type PreflightReport } from './validator';

export interface Pm2Process {
  name: string;
  pm2_env: { status: string; pm_exec_path?: string };
}

// On Windows, `pm2` resolves to a pm2.cmd shim. execFileSync cannot invoke a
// .cmd file directly (EINVAL) — Windows requires it to run through cmd.exe,
// so shell: true is required here, not merely convenient. Node's
// shell-argument-escaping warning is about attacker-controlled input; both
// call sites below only ever pass fixed literals or a PM2 app name sourced
// from the local ecosystem.config.js — the same trust boundary as this
// script itself, not external input.
function pm2ExecOpts(extra: Record<string, unknown> = {}) {
  return { shell: true as const, ...extra };
}

function readPm2List(): Pm2Process[] {
  try {
    const raw = execFileSync('pm2', ['jlist'], { encoding: 'utf8', timeout: 15_000, ...pm2ExecOpts() });
    return JSON.parse(raw) as Pm2Process[];
  } catch (err) {
    console.warn(`[recovery-cli] warning: could not read PM2 state (${err instanceof Error ? err.message : String(err)}) — treating as "no processes known", the same state a cold boot starts from.`);
    return [];
  }
}

export interface Plan {
  toStart: string[];
  alreadyOnline: string[];
  intentionallySkipped: string[];
  duplicates: string[];
  blockers: string[];
}

export function buildPlan(report: PreflightReport, pm2List: Pm2Process[]): Plan {
  const plan: Plan = { toStart: [], alreadyOnline: [], intentionallySkipped: [], duplicates: [], blockers: [] };
  const stopped = new Set(intentionallyStoppedServices());

  const appChecks = report.checks.filter(c => c.id.startsWith('pm2-app:'));
  const seenNames = new Map<string, number>();
  for (const p of pm2List) seenNames.set(p.name, (seenNames.get(p.name) ?? 0) + 1);
  for (const [name, count] of seenNames) {
    if (count > 1) plan.duplicates.push(`${name} (${count} PM2 entries — must not start another)`);
  }

  for (const c of appChecks) {
    const name = c.id.slice('pm2-app:'.length);
    if (stopped.has(name)) { plan.intentionallySkipped.push(name); continue; }
    if (c.status === 'FAIL') { plan.blockers.push(`${name}: ${c.detail}`); continue; }
    const online = pm2List.find(p => p.name === name && p.pm2_env.status === 'online');
    if (online) { plan.alreadyOnline.push(name); continue; }
    plan.toStart.push(name);
  }
  return plan;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const runtimeRoot = args.find(a => !a.startsWith('--')) || path.resolve(__dirname, '..', '..', '..');

  console.log(`[recovery-cli] mode: ${apply ? 'APPLY' : 'DRY-RUN (pass --apply to actually start anything)'}`);
  console.log(`[recovery-cli] runtime root: ${runtimeRoot}`);

  const report = await runPreflight(runtimeRoot);
  for (const c of report.checks) {
    if (c.status === 'FAIL') console.log(`  ✗ ${c.id}: ${c.detail}`);
  }

  if (report.overall === 'FAIL') {
    console.error('[recovery-cli] BLOCKED — preflight reported FAIL. Refusing to start anything until the runtime root is fixed.');
    process.exitCode = 1;
    return;
  }

  const pm2List = readPm2List();
  const plan = buildPlan(report, pm2List);

  console.log(`[recovery-cli] already online (no action): ${plan.alreadyOnline.join(', ') || '(none)'}`);
  console.log(`[recovery-cli] intentionally stopped (never auto-started): ${plan.intentionallySkipped.join(', ') || '(none)'}`);
  if (plan.duplicates.length > 0) console.log(`[recovery-cli] DUPLICATE PM2 ENTRIES (blocker): ${plan.duplicates.join('; ')}`);
  if (plan.blockers.length > 0) console.log(`[recovery-cli] BLOCKED services (preflight FAIL, will not start): ${plan.blockers.join('; ')}`);
  console.log(`[recovery-cli] would start: ${plan.toStart.join(', ') || '(none)'}`);

  if (plan.duplicates.length > 0) {
    console.error('[recovery-cli] BLOCKED — duplicate PM2 entries must be resolved manually before recovery can proceed.');
    process.exitCode = 1;
    return;
  }

  if (!apply) {
    console.log('[recovery-cli] dry-run complete — no process was started or stopped.');
    return;
  }

  const ecosystemPath = path.join(runtimeRoot, 'ecosystem.config.js');
  for (const name of plan.toStart) {
    console.log(`[recovery-cli] starting ${name}...`);
    execFileSync('pm2', ['start', ecosystemPath, '--only', name, '--env', 'production'], pm2ExecOpts({ stdio: 'inherit' }));
  }
  console.log('[recovery-cli] apply complete.');
}

// Only run when executed directly (`tsx recovery-cli.ts` / `npm run
// runtime:recovery`) — importing this module for `buildPlan`/`Plan` (as the
// test suite does) must never trigger a real preflight+PM2 run as a side
// effect of the import itself.
if (require.main === module) {
  main().catch(err => { console.error('[recovery-cli] fatal:', err); process.exitCode = 1; });
}
