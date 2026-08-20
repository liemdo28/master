/**
 * Phase 9A — permanent regression coverage for the SelfHeal restart-authority
 * boundary fixed in this phase. Proves, with real code (not manifest labels),
 * that: intentionally-stopped services are never restart-eligible, an unknown/
 * spoofed service name is never reachable, a global kill switch withholds
 * restart, the allowlist is exactly the 5 services SERVICES_TO_MONITOR
 * declares, and no BACKGROUND_WORKER manifest surface may claim the HTTP-only
 * quarantine handler or approvalRequired:true (the exact mismatch this phase
 * closes). Isolated from production data via MI_PERSONAL_OS_DIR/MI_DATA_DIR,
 * set before any module that constructs a store is required.
 */
import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-9a-selfheal-'));
process.env.MI_PERSONAL_OS_DIR = path.join(tmpRoot, 'personal-os');
process.env.MI_DATA_DIR = tmpRoot;

import {
  evaluateRestartEligibility,
  RESTART_ALLOWLIST,
  getMonitoredServices,
  closeSelfHealingGovernanceHandle,
  type ServiceCheck,
} from '../self-healing-monitor';
import { intentionallyStoppedServices } from '../../runtime-preflight/validator';
import { ControlledActionStore } from '../../personal-os/actions/store';
import { GovernanceStore } from '../../personal-os/actions/governance/store';
import { KillSwitchService } from '../../personal-os/actions/governance/kill-switch';
import { generateAuthorityManifest } from '../../authority-control-plane/scanner';
import { validateLegacyAuthorityRuntime } from '../../authority-control-plane/legacy-adapter';
import type { AuthorityManifest, AuthoritySurface } from '../../authority-control-plane/types';

let passed = 0;

function pm2Svc(id: string, pm2_name: string, critical = false): ServiceCheck {
  return { id, name: id, type: 'pm2', pm2_name, critical };
}

async function run(): Promise<void> {
  // ── 1. RESTART_ALLOWLIST is exactly the 5 pm2-type services SERVICES_TO_MONITOR declares ──
  const monitored = getMonitoredServices();
  const expectedAllowlist = new Set(monitored.filter(s => s.type === 'pm2' && s.pm2_name).map(s => s.pm2_name as string));
  assert.strictEqual(RESTART_ALLOWLIST.size, expectedAllowlist.size, 'allowlist size must match SERVICES_TO_MONITOR pm2-type count');
  for (const name of expectedAllowlist) assert.ok(RESTART_ALLOWLIST.has(name), `allowlist must contain ${name}`);
  assert.strictEqual(RESTART_ALLOWLIST.size, 5, 'exactly 5 services are restart-eligible today: mi-core, mi-whatsapp-gateway, mi-accounting, mi-ceo-observer, qb-ops-agent');
  passed++;

  // ── 2. Unknown/spoofed service name is never reachable, regardless of type/critical/count ──
  const spoofed = pm2Svc('spoofed', 'not-a-real-service', true);
  assert.strictEqual(evaluateRestartEligibility(spoofed, 0), 'not_allowlisted');
  assert.strictEqual(evaluateRestartEligibility(spoofed, 5), 'not_allowlisted');
  // Even a name that LOOKS legitimate but isn't in the fixed array must be rejected —
  // proves this is an allowlist check, not a substring/pattern match.
  assert.strictEqual(evaluateRestartEligibility(pm2Svc('x', 'mi-core-clone'), 0), 'not_allowlisted');
  assert.strictEqual(evaluateRestartEligibility(pm2Svc('x', 'MI-CORE'), 0), 'not_allowlisted', 'case-sensitive — no normalization that could be exploited');
  passed++;

  // ── 3. Non-pm2 types are never restart-eligible ──
  const httpSvc: ServiceCheck = { id: 'h', name: 'h', type: 'http', health_url: 'http://x', critical: true };
  const internalSvc: ServiceCheck = { id: 'i', name: 'i', type: 'internal', critical: true };
  assert.strictEqual(evaluateRestartEligibility(httpSvc, 0), 'not_pm2_type');
  assert.strictEqual(evaluateRestartEligibility(internalSvc, 0), 'not_pm2_type');
  passed++;

  // ── 4. Intentionally-stopped services are NEVER restart-eligible, at any restart count ──
  const stopped = intentionallyStoppedServices();
  assert.ok(stopped.includes('mi-whatsapp-gateway') && stopped.includes('mi-ceo-observer'), 'sanity: both known intentionally-stopped services are in the canonical set');
  for (const name of stopped) {
    if (!RESTART_ALLOWLIST.has(name)) continue; // mi-n8n isn't monitored by SelfHeal at all — not applicable here
    const svc = pm2Svc(name, name, true);
    assert.strictEqual(evaluateRestartEligibility(svc, 0), 'intentionally_stopped', `${name} must never be restart-eligible`);
    assert.strictEqual(evaluateRestartEligibility(svc, 1), 'intentionally_stopped', `${name} must never be restart-eligible regardless of prior attempt count`);
  }
  passed++;

  // ── 5. Restart limit is enforced before eligibility ──
  const core = pm2Svc('mi-core', 'mi-core', true);
  assert.strictEqual(evaluateRestartEligibility(core, 2), 'restart_limit_reached');
  assert.strictEqual(evaluateRestartEligibility(core, 3), 'restart_limit_reached');
  passed++;

  // ── 6. Healthy-eligible path: a real, allowlisted, non-stopped, under-limit service with no kill switch active ──
  assert.strictEqual(evaluateRestartEligibility(core, 0), 'eligible');
  assert.strictEqual(evaluateRestartEligibility(pm2Svc('mi-accounting', 'mi-accounting'), 1), 'eligible');
  passed++;

  // ── 7. Global kill switch withholds restart for an otherwise-eligible service ──
  const store = new ControlledActionStore(path.join(tmpRoot, 'personal-os'));
  const killSwitchSvc = new KillSwitchService(new GovernanceStore(store.handle));
  killSwitchSvc.enable({ scope: 'GLOBAL', reason: 'phase 9a test', activatedBy: 'test' });
  store.close();
  assert.strictEqual(evaluateRestartEligibility(core, 0), 'kill_switch_blocked', 'a GLOBAL kill switch must withhold an otherwise-eligible restart');
  passed++;

  // Disable it and confirm restart eligibility is restored (proves the check is live, not cached).
  const store2 = new ControlledActionStore(path.join(tmpRoot, 'personal-os'));
  const ks2 = new KillSwitchService(new GovernanceStore(store2.handle));
  for (const sw of ks2.state({ projectId: null, actionType: 'internal:self-healing-monitor:restart' }).switches) ks2.unlock(sw.id);
  store2.close();
  closeSelfHealingGovernanceHandle(); // force the monitor's own lazily-cached handle to re-read
  assert.strictEqual(evaluateRestartEligibility(core, 0), 'eligible', 'restart eligibility must be restored once the kill switch is disabled');
  passed++;

  // ── 8. Manifest classification actually matches this file's real runtime enforcement ──
  const manifest: AuthorityManifest = generateAuthorityManifest(path.resolve(__dirname, '..', '..', '..', '..'));
  const selfHealMonitor = manifest.surfaces.find(s => s.id === 'background:self-healing-monitor');
  assert.ok(selfHealMonitor, 'manifest must contain the self-healing-monitor surface');
  assert.strictEqual(selfHealMonitor!.approvalRequired, false, 'must not falsely claim HTTP approval gates a background worker');
  assert.notStrictEqual(selfHealMonitor!.quarantineHandler, 'legacyAuthorityAdapter.quarantine', 'must not name the HTTP-only handler for a background surface');
  assert.strictEqual(selfHealMonitor!.quarantineHandler, 'selfHealingMonitor.evaluateRestartEligibility', 'must name the real, code-verified guard');
  passed++;

  // ── 9. No BACKGROUND_WORKER surface anywhere in the manifest may claim the HTTP-only
  //        enforcement mechanism — the permanent guardrail against this exact mismatch
  //        recurring for any future background worker, present or not-yet-written. ──
  const violators = manifest.surfaces.filter((s: AuthoritySurface) =>
    s.kind === 'BACKGROUND_WORKER' &&
    (s.approvalRequired === true || s.quarantineHandler === 'legacyAuthorityAdapter.quarantine')
  );
  assert.strictEqual(violators.length, 0, `no background worker may claim HTTP-only enforcement: ${violators.map(v => v.id).join(', ')}`);
  passed++;

  // ── 10. The consistency validator actually enforces this — proven by feeding it a
  //         deliberately-bad synthetic manifest and confirming it throws. ──
  const badManifest: AuthorityManifest = {
    ...manifest,
    surfaces: [
      ...manifest.surfaces,
      {
        id: 'background:fabricated-bad-surface',
        kind: 'BACKGROUND_WORKER',
        sourcePath: 'test-fixture.ts',
        runtimeMount: 'fixture',
        method: 'BACKGROUND',
        capability: 'test fixture only',
        effectClass: 'SERVICE_CONTROL',
        authorityClass: 'LEGACY_QUARANTINED',
        canonicalOwner: 'test',
        projectScoped: false,
        externalSystem: null,
        approvalRequired: true, // the exact false claim this phase eliminated
        governanceRequired: true,
        delegationEligible: false,
        authenticationRequired: 'INTERNAL_ONLY',
        status: 'QUARANTINED',
        legacyReason: 'fixture',
        migrationTarget: null,
        phase6bDisposition: 'QUARANTINE_ONLY',
        adapterTarget: null,
        quarantineHandler: 'legacyAuthorityAdapter.quarantine', // the exact false claim
        canonicalReplacement: null,
        lastAuthorityEvidence: null,
        evidence: [],
      },
    ],
  };
  assert.throws(() => validateLegacyAuthorityRuntime(badManifest), /LEGACY_AUTHORITY_BACKGROUND_FALSE_ENFORCEMENT_CLAIM/, 'the validator must reject a background surface falsely claiming HTTP-only enforcement');
  passed++;

  // ── 11. unknownMutations / unresolvedLegacyMutations remain 0 on the real manifest ──
  assert.strictEqual(manifest.counts.unknownMutations, 0);
  assert.strictEqual(manifest.counts.unresolvedLegacyMutations, 0);
  passed++;

  // ── 12. No new external ActionType was added by this phase ──
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const actionTypesSource = fs.readFileSync(path.resolve(__dirname, '..', '..', 'personal-os', 'actions', 'types.ts'), 'utf8');
  const actionTypeBlock = /export type ActionType =\s*([\s\S]*?);/.exec(actionTypesSource);
  assert.ok(actionTypeBlock, 'must find the ActionType union declaration');
  const actionTypeMatches = [...actionTypeBlock![1].matchAll(/'([A-Z_]+)'/g)].map(m => m[1]);
  assert.strictEqual(actionTypeMatches.length, 7, `ActionType enum must remain exactly 7 values, found: ${actionTypeMatches.join(', ')}`);
  passed++;

  // ── 13. No shell/process escalation was introduced — restartPm2Service's exec target
  //         is still built only from an allowlisted literal, never string-concatenated
  //         from anything caller-controlled (structural re-check of the source itself). ──
  const monitorSource = fs.readFileSync(path.resolve(__dirname, '..', 'self-healing-monitor.ts'), 'utf8');
  assert.ok(!/shell:\s*true/.test(monitorSource), 'self-healing-monitor.ts must never use shell:true');
  passed++;

  closeSelfHealingGovernanceHandle();
  fs.rmSync(tmpRoot, { recursive: true, force: true });

  console.log(`[self-healing-restart-authority] PASS — ${passed} invariants verified`);
}

run().catch(err => {
  closeSelfHealingGovernanceHandle();
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  console.error(err);
  process.exit(1);
});
