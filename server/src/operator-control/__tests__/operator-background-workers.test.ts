/**
 * Phase 9B — permanent regression coverage for the background-worker
 * observability surface. Proves it is purely read-only (no mutation route
 * exists, no code path here can restart/kill/act on anything), and that it
 * accurately reflects the real state established in Phase 9A: intentional-
 * stop exclusion, restart eligibility, live kill-switch state, durable
 * restart evidence, manifest classification, and the exact 4-surface
 * behavioral-hardening-debt list (not more, not fewer, not self-healing-
 * monitor itself).
 */
import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-9b-operator-bg-'));
const personalOsRoot = path.join(tmpRoot, 'personal-os');
process.env.MI_PERSONAL_OS_DIR = personalOsRoot;
process.env.MI_DATA_DIR = tmpRoot;

import { OperatorControlService } from '../service';
import { createOperatorControlRouter } from '../router';
import { ControlledActionStore } from '../../personal-os/actions/store';
import { GovernanceStore } from '../../personal-os/actions/governance/store';
import { KillSwitchService } from '../../personal-os/actions/governance/kill-switch';
import { getOpsDb, closeOpsDb } from '../../operations/ops-db';

let passed = 0;

async function run(): Promise<void> {
  // ── 1. The route table exposes GET only for this capability — no mutation route exists ──
  const router = createOperatorControlRouter({ personalOsRoot, taskRuntimeRoot: path.join(tmpRoot, 'task-runtime') });
  // Express Router stores registered layers on router.stack; find the background-workers route.
  const layer = (router as any).stack.find((l: any) => l.route && l.route.path === '/operator/background-workers');
  assert.ok(layer, 'route must be registered');
  const methods = Object.keys(layer.route.methods);
  assert.deepStrictEqual(methods, ['get'], `background-workers route must be GET-only, found: ${methods.join(',')}`);
  passed++;

  // ── 2. Service-level view: correct shape, no kill switch active initially ──
  const service = new OperatorControlService({ personalOsRoot, taskRuntimeRoot: path.join(tmpRoot, 'task-runtime') });
  const view1 = service.backgroundWorkers();
  assert.strictEqual(view1.globalKillSwitchActive, false, 'no kill switch enabled yet');
  assert.strictEqual(view1.services.length, 10, 'must report all 10 monitored services');
  passed++;

  // ── 3. Intentional-stop status correctly surfaced for the 2 known overlapping services ──
  const whatsapp = view1.services.find(s => s.pm2Name === 'mi-whatsapp-gateway');
  const ceoObserver = view1.services.find(s => s.pm2Name === 'mi-ceo-observer');
  const core = view1.services.find(s => s.pm2Name === 'mi-core');
  assert.ok(whatsapp?.intentionallyStopped, 'mi-whatsapp-gateway must show as intentionally stopped');
  assert.ok(ceoObserver?.intentionallyStopped, 'mi-ceo-observer must show as intentionally stopped');
  assert.strictEqual(core?.intentionallyStopped, false, 'mi-core must not show as intentionally stopped');
  passed++;

  // ── 4. Restart eligibility surfaced per pm2-type service, null for non-pm2 types ──
  assert.strictEqual(whatsapp?.restartEligibility, 'intentionally_stopped');
  assert.strictEqual(core?.restartEligibility, 'eligible', 'mi-core with 0 restarts and no kill switch must show eligible');
  const httpSvc = view1.services.find(s => s.type === 'http');
  assert.strictEqual(httpSvc?.restartEligibility, null, 'non-pm2 service types must report null restart eligibility, not a fabricated value');
  passed++;

  // ── 5. Enabling a real GLOBAL kill switch flips globalKillSwitchActive and restart eligibility ──
  const store = new ControlledActionStore(personalOsRoot);
  const ks = new KillSwitchService(new GovernanceStore(store.handle));
  ks.enable({ scope: 'GLOBAL', reason: 'phase 9b test', activatedBy: 'test' });
  store.close();
  const view2 = service.backgroundWorkers();
  assert.strictEqual(view2.globalKillSwitchActive, true, 'kill switch state must be live, not cached at construction time');
  const coreAfter = view2.services.find(s => s.pm2Name === 'mi-core');
  assert.strictEqual(coreAfter?.restartEligibility, 'kill_switch_blocked', 'restart eligibility must reflect the live kill switch');
  passed++;

  // Disable it again for cleanliness / to prove the reverse direction too.
  const store2 = new ControlledActionStore(personalOsRoot);
  const ks2 = new KillSwitchService(new GovernanceStore(store2.handle));
  for (const sw of ks2.state({ projectId: null, actionType: 'internal:self-healing-monitor:restart' }).switches) ks2.unlock(sw.id);
  store2.close();
  const view3 = service.backgroundWorkers();
  assert.strictEqual(view3.globalKillSwitchActive, false);
  passed++;

  // ── 6. Worker classification surfaces exactly the 8 known background surfaces, with the
  //        exact 4-surface behavioral-hardening-debt list — not self-healing-monitor itself ──
  assert.strictEqual(view1.workerClassifications.length, 8, 'must surface all 8 BACKGROUND_WORKER manifest entries');
  const debt = new Set(view1.behavioralHardeningDebtSurfaces);
  const expectedDebt = new Set([
    'background:self-healing-scheduler',
    'background:jarvis-proactive-monitor',
    'background:daily-briefing-scheduler',
    'background:qb-online-watcher',
  ]);
  assert.deepStrictEqual(debt, expectedDebt, `behavioral-hardening-debt list must be exactly the 4 known surfaces, found: ${[...debt].join(', ')}`);
  assert.ok(!debt.has('background:self-healing-monitor'), 'self-healing-monitor received real behavioral enforcement in Phase 9A — must never appear in the debt list');
  const selfHealMonitorClass = view1.workerClassifications.find(w => w.id === 'background:self-healing-monitor');
  assert.strictEqual(selfHealMonitorClass?.approvalRequired, false);
  assert.notStrictEqual(selfHealMonitorClass?.quarantineHandler, 'legacyAuthorityAdapter.quarantine');
  passed++;

  // ── 7. Recent restart evidence surfaces real rows from the durable log, most-recent-first ──
  getOpsDb().prepare(
    `INSERT INTO self_heal_restart_log (service_id, pm2_name, decision, outcome, restart_attempt_number, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run('mi-core', 'mi-core', 'eligible', 'command_issued', 1, 'phase 9b fixture row', new Date().toISOString());
  const view4 = service.backgroundWorkers();
  assert.ok(view4.recentRestartEvidence.length >= 1, 'must surface at least the fixture row just inserted');
  assert.strictEqual(view4.recentRestartEvidence[0].serviceId, 'mi-core');
  assert.strictEqual(view4.recentRestartEvidence[0].detail, 'phase 9b fixture row');
  passed++;

  // ── 8. This view is provably read-only: OperatorControlService exposes no method that
  //        mutates PM2 state, kills a process, or writes to self_heal_restart_log. ──
  const serviceSource = fs.readFileSync(path.resolve(__dirname, '..', 'service.ts'), 'utf8');
  assert.ok(!/execAsync|execSync|process\.kill|taskkill/.test(serviceSource), 'operator-control/service.ts must never shell out or kill a process');
  assert.ok(!/self_heal_restart_log.*INSERT|INSERT.*self_heal_restart_log/is.test(serviceSource), 'operator-control/service.ts must never write to the restart evidence log — read-only consumer only');
  passed++;

  service.close();
  closeOpsDb();
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
  console.log(`[operator-background-workers] PASS — ${passed} invariants verified`);
}

run().catch(err => {
  closeOpsDb();
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
  console.error(err);
  process.exit(1);
});
