/**
 * Phase 9A — deterministic evaluation of the SelfHeal restart-authority boundary.
 * Sweeps every service/restart-count/kill-switch combination the real monitor can
 * ever encounter, plus adversarial unknown/spoofed targets and legacy-background
 * bypass attempts, and checks the hard targets the phase directive requires:
 *   unexpectedRestart=0, disabledServiceRestart=0, arbitraryTargetReachability=0,
 *   manifestRuntimeMismatch=0, shellEscalation=0, authorityExpansion=0
 * Never invokes real PM2 — evaluateRestartEligibility is a pure decision function;
 * this harness proves its behavior across the full input space, not the `pm2
 * restart` command itself (that remains covered by the existing phase8d-boot-cli
 * style dependency-injected tests).
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-9a-selfheal-eval-'));
process.env.MI_PERSONAL_OS_DIR = path.join(tmpRoot, 'personal-os');
process.env.MI_DATA_DIR = tmpRoot;

import {
  evaluateRestartEligibility,
  RESTART_ALLOWLIST,
  getMonitoredServices,
  closeSelfHealingGovernanceHandle,
  type ServiceCheck,
  type RestartDecision,
} from './self-healing-monitor';
import { intentionallyStoppedServices } from '../runtime-preflight/validator';
import { ControlledActionStore } from '../personal-os/actions/store';
import { GovernanceStore } from '../personal-os/actions/governance/store';
import { KillSwitchService } from '../personal-os/actions/governance/kill-switch';
import { generateAuthorityManifest } from '../authority-control-plane/scanner';
import { validateLegacyAuthorityRuntime } from '../authority-control-plane/legacy-adapter';
import type { AuthorityManifest, AuthoritySurface } from '../authority-control-plane/types';

interface Case {
  label: string;
  svc: ServiceCheck;
  restartCount: number;
  killSwitchActive: boolean;
}

const MAX_AUTO_RESTART = 2;
const monitored = getMonitoredServices();
const stopped = new Set(intentionallyStoppedServices());
const allowlisted = [...RESTART_ALLOWLIST];

function pm2(id: string, pm2_name: string, critical = false): ServiceCheck {
  return { id, name: id, type: 'pm2', pm2_name, critical };
}

function setKillSwitch(active: boolean): void {
  const store = new ControlledActionStore(path.join(tmpRoot, 'personal-os'));
  const ks = new KillSwitchService(new GovernanceStore(store.handle));
  for (const sw of ks.state({ projectId: null, actionType: 'internal:self-healing-monitor:restart' }).switches) ks.unlock(sw.id);
  if (active) ks.enable({ scope: 'GLOBAL', reason: 'phase 9a evaluation', activatedBy: 'evaluation-harness' });
  store.close();
  closeSelfHealingGovernanceHandle();
}

const cases: Case[] = [];

// 1. Every real monitored service (all types) x restart counts 0-9 x kill-switch on/off.
for (const svc of monitored) {
  for (let count = 0; count <= 9; count++) {
    for (const killSwitchActive of [false, true]) {
      cases.push({ label: `real:${svc.id}:count${count}:ks${killSwitchActive}`, svc, restartCount: count, killSwitchActive });
    }
  }
}

// 2. Restart-storm sweep on mi-core: 0..20, kill switch off — decision must transition
//    deterministically from eligible (0-1) to restart_limit_reached (2+), nothing else.
for (let count = 0; count <= 20; count++) {
  cases.push({ label: `storm:mi-core:count${count}`, svc: pm2('mi-core', 'mi-core', true), restartCount: count, killSwitchActive: false });
}

// 3. Unknown/spoofed service names — must never be allowlisted, at any count/kill-switch state.
const spoofedNames = [
  'not-a-real-service', 'mi-core2', 'mi-core-backup', 'MI-CORE', 'mi_core', ' mi-core', 'mi-core ',
  'mi-whatsapp-gateway2', 'mi-accounting-old', 'mi-ceo-observer-test', 'qb-ops-agent-staging',
  'admin', 'root', 'pm2-logrotate', 'mi-ai-service', 'mi-node-agent', '../mi-core', 'mi-core; rm -rf /',
  'mi-core`whoami`', 'mi-core$(whoami)', '', 'null', 'undefined', '0', 'true', 'false',
  'mi-whatsapp-gatewaymi-ceo-observer', 'mi', 'core', 'mi-core\n', 'MI_CORE',
];
for (const name of spoofedNames) {
  for (let count = 0; count <= 9; count++) {
    for (const killSwitchActive of [false, true]) {
      cases.push({ label: `spoof:${JSON.stringify(name)}:count${count}:ks${killSwitchActive}`, svc: pm2('spoofed', name, true), restartCount: count, killSwitchActive });
    }
  }
}

// 4. Concurrent-attempt determinism: same (svc, count) evaluated 100 times back-to-back —
//    a pure decision function must never vary its answer call to call.
const concurrencyProbe = pm2('mi-accounting', 'mi-accounting');
const concurrentResults: RestartDecision[] = [];
for (let i = 0; i < 100; i++) concurrentResults.push(evaluateRestartEligibility(concurrencyProbe, 0));

async function run(): Promise<void> {
  let unexpectedRestart = 0;
  let disabledServiceRestart = 0;
  let arbitraryTargetReachability = 0;
  let killSwitchBoundaryViolations = 0;
  let failures = 0;

  for (const c of cases) {
    setKillSwitch(c.killSwitchActive);
    const decision = evaluateRestartEligibility(c.svc, c.restartCount);

    const isRealAllowlisted = allowlisted.includes(c.svc.pm2_name ?? '');
    const isIntentionallyStopped = c.svc.pm2_name ? stopped.has(c.svc.pm2_name) : false;

    // Hard target: disabledServiceRestart=0 — an intentionally-stopped service must
    // NEVER receive 'eligible', at any restart count or kill-switch state.
    if (isIntentionallyStopped && decision === 'eligible') { disabledServiceRestart++; failures++; }

    // Hard target: arbitraryTargetReachability=0 — a non-allowlisted target must NEVER
    // receive 'eligible'.
    if (!isRealAllowlisted && decision === 'eligible') { arbitraryTargetReachability++; failures++; }

    // Hard target: unexpectedRestart=0 — 'eligible' only when count < MAX, allowlisted,
    // not stopped, and kill switch inactive. Any other combination reporting 'eligible'
    // is an unexpected-restart-authorization bug.
    const shouldBeEligible = isRealAllowlisted && !isIntentionallyStopped && c.restartCount < MAX_AUTO_RESTART && !c.killSwitchActive && c.svc.type === 'pm2';
    if (decision === 'eligible' && !shouldBeEligible) { unexpectedRestart++; failures++; }
    if (shouldBeEligible && decision !== 'eligible') { unexpectedRestart++; failures++; }

    // Kill-switch boundary: when active, an otherwise-eligible target must report
    // kill_switch_blocked, never eligible.
    if (c.killSwitchActive && isRealAllowlisted && !isIntentionallyStopped && c.restartCount < MAX_AUTO_RESTART && c.svc.type === 'pm2' && decision !== 'kill_switch_blocked') {
      killSwitchBoundaryViolations++; failures++;
    }
  }
  setKillSwitch(false);

  // Concurrency determinism check
  const distinctConcurrentResults = new Set(concurrentResults);
  const concurrencyViolations = distinctConcurrentResults.size === 1 ? 0 : 1;
  if (concurrencyViolations) failures++;

  // Legacy background bypass attempts — construct adversarial AuthoritySurface objects
  // and confirm the validator rejects every one of them.
  const manifest: AuthorityManifest = generateAuthorityManifest(path.resolve(__dirname, '..', '..', '..'));
  let manifestRuntimeMismatch = 0;
  const liveViolators = manifest.surfaces.filter((s: AuthoritySurface) =>
    s.kind === 'BACKGROUND_WORKER' && (s.approvalRequired === true || s.quarantineHandler === 'legacyAuthorityAdapter.quarantine')
  );
  manifestRuntimeMismatch += liveViolators.length;

  const bypassAttempts = [
    { approvalRequired: true, quarantineHandler: null as string | null },
    { approvalRequired: false, quarantineHandler: 'legacyAuthorityAdapter.quarantine' },
    { approvalRequired: true, quarantineHandler: 'legacyAuthorityAdapter.quarantine' },
    // Same false claim, but disguised behind a critical/irreversible effect class —
    // must still be caught by the background-claim check specifically.
    { approvalRequired: true, quarantineHandler: 'legacyAuthorityAdapter.quarantine', effectClass: 'EXTERNAL_IRREVERSIBLE' as const },
  ];
  let bypassCaught = 0;
  for (const attempt of bypassAttempts) {
    const adversarial: AuthorityManifest = {
      ...manifest,
      surfaces: [
        ...manifest.surfaces,
        {
          id: 'background:adversarial-bypass-attempt', kind: 'BACKGROUND_WORKER', sourcePath: 'x', runtimeMount: 'x', method: 'BACKGROUND',
          capability: 'x', effectClass: attempt.effectClass ?? 'SERVICE_CONTROL', authorityClass: 'LEGACY_QUARANTINED', canonicalOwner: 'x', projectScoped: false,
          externalSystem: null, governanceRequired: true, delegationEligible: false, authenticationRequired: 'INTERNAL_ONLY', status: 'QUARANTINED',
          legacyReason: 'x', migrationTarget: null, phase6bDisposition: 'QUARANTINE_ONLY', adapterTarget: null,
          canonicalReplacement: null, lastAuthorityEvidence: null, evidence: [],
          approvalRequired: attempt.approvalRequired, quarantineHandler: attempt.quarantineHandler,
        },
      ],
    };
    try {
      validateLegacyAuthorityRuntime(adversarial);
      // did not throw — a real bypass got through
    } catch (err) {
      if (err instanceof Error && err.message.includes('LEGACY_AUTHORITY_BACKGROUND_FALSE_ENFORCEMENT_CLAIM')) bypassCaught++;
    }
  }
  const legacyBackgroundBypassAttempts = bypassAttempts.filter(a => a.approvalRequired || a.quarantineHandler === 'legacyAuthorityAdapter.quarantine').length;
  if (bypassCaught !== legacyBackgroundBypassAttempts) { manifestRuntimeMismatch += (legacyBackgroundBypassAttempts - bypassCaught); failures++; }

  // Shell escalation / authority expansion — structural source checks.
  const monitorSource = fs.readFileSync(path.resolve(__dirname, 'self-healing-monitor.ts'), 'utf8');
  const shellEscalation = /shell:\s*true/.test(monitorSource) ? 1 : 0;
  const actionTypesSource = fs.readFileSync(path.resolve(__dirname, '..', 'personal-os', 'actions', 'types.ts'), 'utf8');
  const actionTypeBlock = /export type ActionType =\s*([\s\S]*?);/.exec(actionTypesSource);
  const actionTypeCount = actionTypeBlock ? [...actionTypeBlock[1].matchAll(/'([A-Z_]+)'/g)].length : -1;
  const authorityExpansion = actionTypeCount === 7 ? 0 : 1;
  if (shellEscalation) failures++;
  if (authorityExpansion) failures++;

  const totalCases = cases.length + concurrentResults.length + bypassAttempts.length;

  const summary = {
    totalCases,
    failures,
    unexpectedRestart,
    disabledServiceRestart,
    arbitraryTargetReachability,
    manifestRuntimeMismatch,
    shellEscalation,
    authorityExpansion,
    killSwitchBoundaryViolations,
    concurrencyViolations,
    deterministic: distinctConcurrentResults.size === 1,
  };

  console.log('[self-healing-restart-evaluation]', JSON.stringify(summary, null, 2));

  fs.rmSync(tmpRoot, { recursive: true, force: true });

  if (failures > 0 || totalCases < 500) {
    console.error(`[self-healing-restart-evaluation] FAIL — ${failures} failures, ${totalCases} cases (need >= 500)`);
    process.exit(1);
  }
  console.log(`[self-healing-restart-evaluation] PASS — ${totalCases} cases, 0 failures, all hard targets met`);
}

run().catch(err => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  console.error(err);
  process.exit(1);
});
