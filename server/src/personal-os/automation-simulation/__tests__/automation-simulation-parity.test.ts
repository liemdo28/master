/**
 * Phase 6F §39 — parity tests. The simulator does not reimplement governance; it
 * calls the exact same pure/impure canonical evaluators the live system uses
 * (ActionPolicyEngine.evaluate, RiskEvaluator.assess, KillSwitchService.state,
 * BudgetManager.state, evaluateDelegationEligibility, the real authority manifest).
 * These tests prove that empirically: for equivalent input, a LIVE proposal path
 * (through a real ControlledActionService, with full payload normalization) and the
 * SIMULATED path (through AutomationSimulationService) agree on every
 * governance-relevant field. Target >= 99.5%; any known, intentional divergence
 * (e.g. exact payloadHash bytes, since the simulator never normalizes the raw
 * payload the way ControlledActionService.propose() does) is called out below
 * rather than silently excluded.
 */
import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ControlledActionService } from '../../actions/service';
import { payloadHash, riskForAction } from '../../actions/policy';
import type { ActionProposal, ActionType } from '../../actions/types';
import { evaluateDelegationEligibility, type EligibilityContext } from '../../delegation/eligibility';
import type { DelegatedAuthority } from '../../delegation/types';
import { generateAuthorityManifest } from '../../../authority-control-plane/scanner';
import { resolveAuthorityRepoRoot } from '../../../authority-control-plane/source-provenance';
import { AutomationSimulationService } from '../service';

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mi-6f-parity-'));
}

const EXECUTE_SURFACE_ID = 'http:POST:/api/actions/:id/execute';

let total = 0;
let matches = 0;
const mismatches: string[] = [];

function check(label: string, live: unknown, simulated: unknown) {
  total += 1;
  const same = JSON.stringify(live) === JSON.stringify(simulated);
  if (same) {
    matches += 1;
  } else {
    mismatches.push(`${label}: live=${JSON.stringify(live)} simulated=${JSON.stringify(simulated)}`);
  }
}

const PAYLOAD_FOR: Record<string, Record<string, unknown>> = {
  GMAIL_CREATE_DRAFT: { to: ['user@mi.local'], subject: 's', body: 'b', reason: 'r' },
  CALENDAR_EVENT_PROPOSAL: { title: 'x', start: '2026-08-13T10:00:00Z', end: '2026-08-13T10:30:00Z', timezone: 'UTC' },
  CALENDAR_CREATE_EVENT: { title: 'x', start: '2026-08-13T10:00:00Z', end: '2026-08-13T10:30:00Z', timezone: 'UTC', attendees: [] },
};

async function checkPolicyAndRiskParity(sim: AutomationSimulationService) {
  const actionTypes: ActionType[] = ['GMAIL_CREATE_DRAFT', 'CALENDAR_EVENT_PROPOSAL', 'CALENDAR_CREATE_EVENT'];
  for (const actionType of actionTypes) {
    const liveRoot = tmp();
    const live = new ControlledActionService(liveRoot);
    try {
      // LIVE: goes through the real propose() normalization pipeline, then the same
      // ActionPolicyEngine.evaluate() the simulator calls.
      const liveProposal = live.propose({
        actionType, projectId: 'proj-parity', reason: 'parity check',
        normalizedPayload: PAYLOAD_FOR[actionType],
      } as any);
      const liveDecision = live.policyEngine.store.latestDecision(liveProposal.id);
      assert.ok(liveDecision, `live decision must exist for ${actionType}`);

      // SIMULATED: same actionType/projectId/payload, through AutomationSimulationService.
      const simRun = await sim.run({
        kind: 'SINGLE_PROPOSAL', projectId: 'proj-parity',
        steps: [{ key: 'a', type: 'CONTROLLED_ACTION', description: actionType, actionType, actionPayload: PAYLOAD_FOR[actionType] }],
      });
      const simStep = simRun.steps[0];

      check(`riskClass[${actionType}]`, riskForAction(actionType), simStep.riskClass);
      check(`riskClass[${actionType}] matches live proposal`, liveProposal.riskClass, simStep.riskClass);
      check(`policyDecision[${actionType}]`, liveDecision!.decision, simStep.policyDecision);
      check(`approvalRequirement[${actionType}]`, liveDecision!.requiredApprovalLevel, simStep.approvalRequirement);

      // Known, intentional divergence (documented, not a bug): the simulator hashes
      // the raw actionPayload directly (fake-providers/service never call
      // ControlledActionService.normalizePayload), while the live path hashes the
      // normalized payload. Under the default policy set neither payloadHash nor
      // raw payload content affects the decision (no rule uses forbiddenKeywords),
      // so this never causes a governance-relevant divergence — verified above.
      const rawHash = payloadHash(PAYLOAD_FOR[actionType]);
      if (rawHash !== liveProposal.payloadHash) {
        console.log(`[automation-simulation-parity] known divergence (non-governance): payloadHash for ${actionType} differs between raw simulator input and normalized live proposal — expected, does not affect policyDecision/approvalRequirement/riskClass.`);
      }
    } finally {
      live.close();
      fs.rmSync(liveRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  }
}

async function checkKillSwitchParity(sim: AutomationSimulationService) {
  const liveRoot = tmp();
  const live = new ControlledActionService(liveRoot);
  try {
    live.policyEngine.killSwitch.enable({ scope: 'GLOBAL', reason: 'parity-test', activatedBy: 'parity-test' });
    const liveState = live.policyEngine.killSwitch.state({ projectId: 'proj-parity', actionType: 'CALENDAR_EVENT_PROPOSAL' });

    const simRun = await sim.run({
      kind: 'POLICY_WHAT_IF', projectId: 'proj-parity',
      steps: [{ key: 'a', type: 'CONTROLLED_ACTION', description: 'kill-switch parity', actionType: 'CALENDAR_EVENT_PROPOSAL',
        actionPayload: PAYLOAD_FOR.CALENDAR_EVENT_PROPOSAL, killSwitchOverrides: [{ scope: 'GLOBAL', reason: 'parity-test' }] }],
    });
    const simStep = simRun.steps[0];

    check('killSwitch.blocked', liveState.blocked, simStep.killSwitchDecision?.blocked);
    check('killSwitch → policyDecision BLOCK_KILL_SWITCH', 'BLOCK_KILL_SWITCH', simStep.policyDecision);
    check('killSwitch → result WOULD_BLOCK', 'WOULD_BLOCK', simStep.result);
  } finally {
    live.close();
    fs.rmSync(liveRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
}

async function checkBudgetParity(sim: AutomationSimulationService) {
  const liveRoot = tmp();
  const live = new ControlledActionService(liveRoot);
  try {
    const actionType: ActionType = 'CALENDAR_EVENT_PROPOSAL';
    const db = live.policyEngine.store.db;
    const existing = live.policyEngine.store.findBudget(actionType, null);
    assert.ok(existing, 'default-seeded budget must exist for CALENDAR_EVENT_PROPOSAL (phase5g-default-v1)');
    const resetsAt = new Date(Date.now() + 3_600_000).toISOString();
    db.prepare(`UPDATE action_budgets SET maxExecutions = ?, currentUsageJson = ?, resetsAt = ? WHERE id = ?`)
      .run(1, JSON.stringify({ proposals: 0, approvals: 0, executions: 1, externalTargets: 0 }), resetsAt, existing!.id);

    const liveProposal = live.propose({ actionType, projectId: 'proj-parity', reason: 'budget parity', normalizedPayload: PAYLOAD_FOR[actionType] } as any);
    const liveBudgetState = live.policyEngine.budgetManager.state(liveProposal);

    const simRun = await sim.run({
      kind: 'POLICY_WHAT_IF', projectId: 'proj-parity',
      steps: [{ key: 'a', type: 'CONTROLLED_ACTION', description: 'budget parity', actionType, actionPayload: PAYLOAD_FOR[actionType],
        budgetOverrides: [{ actionType, projectId: null, maxExecutions: 1, usedExecutions: 1, maxExternalTargets: 10, usedExternalTargets: 0 }] }],
    });
    const simStep = simRun.steps[0];

    check('budget.blocked', liveBudgetState.blocked, simStep.budgetDecision?.blocked);
    check('budget.remainingExecutions', liveBudgetState.remainingExecutions, simStep.budgetDecision?.remainingExecutions);
    check('budget → policyDecision BLOCK_BUDGET', 'BLOCK_BUDGET', simStep.policyDecision);
  } finally {
    live.close();
    fs.rmSync(liveRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
}

async function checkDelegationParity(sim: AutomationSimulationService) {
  const scenarios: Array<{ scenario: 'VALID' | 'EXPIRED' | 'WRONG_PROJECT' | 'RISK_ABOVE_CEILING' | 'QUOTA_EXHAUSTED'; expectedEligible: boolean }> = [
    { scenario: 'VALID', expectedEligible: true },
    { scenario: 'EXPIRED', expectedEligible: false },
    { scenario: 'WRONG_PROJECT', expectedEligible: false },
    { scenario: 'RISK_ABOVE_CEILING', expectedEligible: false },
    { scenario: 'QUOTA_EXHAUSTED', expectedEligible: false },
  ];

  const actionType: ActionType = 'GMAIL_CREATE_DRAFT';
  const nowDate = new Date();
  const proposal: ActionProposal = {
    id: 'parity-proposal', actionType, riskClass: riskForAction(actionType),
    title: '[PARITY]', description: 'parity', reason: 'parity',
    sourceGoalId: null, sourceTaskId: null, sourceBriefId: null, sourcePlanId: null,
    projectId: 'proj-parity', targetSystem: 'gmail', requestedOperation: actionType,
    normalizedPayload: PAYLOAD_FOR[actionType], payloadHash: payloadHash(PAYLOAD_FOR[actionType]),
    preview: 'preview', sideEffects: [], rollbackPlan: 'N/A', requiredApprovals: 1,
    status: 'WAITING_APPROVAL', evidenceReferences: [], idempotencyKey: payloadHash({ actionType }),
    safeFailure: true, createdAt: nowDate.toISOString(), expiresAt: new Date(nowDate.getTime() + 3_600_000).toISOString(),
    approvedAt: null, executedAt: null, rejectedAt: null, failureCode: null,
  };

  for (const { scenario, expectedEligible } of scenarios) {
    const base: DelegatedAuthority = {
      id: 'parity-delegation', delegationVersion: 1, previousVersionId: null,
      title: 'Parity delegation', description: 'parity', owner: 'parity-test',
      projectId: 'proj-parity', status: 'ACTIVE',
      allowedActionTypes: [actionType], deniedActionTypes: [],
      targetRestriction: { allowedDomains: ['mi.local'] },
      riskCeiling: 'R3', approvalLevelCeiling: 'STRONG',
      startsAt: new Date(nowDate.getTime() - 3_600_000).toISOString(), expiresAt: new Date(nowDate.getTime() + 3_600_000).toISOString(), timezone: 'UTC',
      maxExecutions: 10, usedExecutions: 0, maxTargets: null, usedTargets: 0, actionBudgets: [],
      sourceGoalId: null, sourcePlanId: null, policyVersion: null, policyHash: null,
      delegationPayloadHash: payloadHash({ parity: true }),
      createdAt: nowDate.toISOString(), approvedAt: nowDate.toISOString(), activatedAt: nowDate.toISOString(),
      revokedAt: null, exhaustedAt: null, expiredAt: null, pausedReason: null, evidenceReferences: [],
    };
    const delegation: DelegatedAuthority =
      scenario === 'EXPIRED' ? { ...base, expiresAt: new Date(nowDate.getTime() - 3_600_000).toISOString() } :
      scenario === 'WRONG_PROJECT' ? { ...base, projectId: 'proj-other' } :
      scenario === 'RISK_ABOVE_CEILING' ? { ...base, riskCeiling: 'R0' } :
      scenario === 'QUOTA_EXHAUSTED' ? { ...base, usedExecutions: base.maxExecutions } :
      base;

    const ctx: EligibilityContext = {
      now: nowDate, killSwitchBlocked: false, killSwitchReason: null,
      policyDecisionResult: 'REQUIRE_APPROVAL', policyVersion: null, policyHash: null,
      budgetBlocked: false, budgetReason: null, providerHealthy: true,
      anomalyDetected: false, anomalyReason: null, orchestrationDependenciesValid: true,
      alreadyExecuted: false, targetsRequested: 1, recipientDomains: ['mi.local'], recipientCount: 1,
      attendeeCount: null, durationMinutes: null, hasRecurrence: false, hasBcc: false,
    };
    const directResult = evaluateDelegationEligibility(delegation, proposal, ctx);
    check(`delegation[${scenario}].eligible matches directive-expected direction`, expectedEligible, directResult.eligible);

    const simRun = await sim.run({
      kind: 'DELEGATED_CANDIDATE', projectId: 'proj-parity',
      steps: [{ key: 'a', type: 'CONTROLLED_ACTION', description: `delegation parity ${scenario}`, actionType,
        actionPayload: PAYLOAD_FOR[actionType], delegationOverride: { scenario } }],
    });
    const simEligible = simRun.steps[0].delegationDecision?.eligible;
    check(`delegation[${scenario}].eligible: direct pure-function call vs simulator`, directResult.eligible, simEligible);
  }
}

async function checkAuthorityParity(sim: AutomationSimulationService) {
  const repoRoot = resolveAuthorityRepoRoot(path.resolve(__dirname, '../../../..'));
  const manifest = generateAuthorityManifest(repoRoot);
  const liveSurface = manifest.surfaces.find(s => s.id === EXECUTE_SURFACE_ID);
  assert.ok(liveSurface, 'EXECUTE_SURFACE_ID must exist in the real authority manifest');

  const simRun = await sim.run({
    kind: 'SINGLE_PROPOSAL', projectId: 'proj-parity',
    steps: [{ key: 'a', type: 'CONTROLLED_ACTION', description: 'authority parity', actionType: 'CALENDAR_EVENT_PROPOSAL', actionPayload: PAYLOAD_FOR.CALENDAR_EVENT_PROPOSAL }],
  });
  const simStep = simRun.steps[0];

  check('authoritySurface.id', liveSurface!.id, simStep.authoritySurface);
  check('authoritySurface.canonicalOwner', liveSurface!.canonicalOwner, simStep.canonicalOwner);
}

async function run() {
  const sim = new AutomationSimulationService();
  await checkPolicyAndRiskParity(sim);
  await checkKillSwitchParity(sim);
  await checkBudgetParity(sim);
  await checkDelegationParity(sim);
  await checkAuthorityParity(sim);

  const score = matches / total;
  console.log(`[automation-simulation-parity] ${matches}/${total} checks matched (${(score * 100).toFixed(2)}%)`);
  if (mismatches.length) {
    console.log('[automation-simulation-parity] mismatches:');
    for (const m of mismatches) console.log(`  - ${m}`);
  }
  assert.ok(score >= 0.995, `parity score ${(score * 100).toFixed(2)}% is below the §39 target of 99.5%`);
  assert.strictEqual(mismatches.length, 0, 'Phase 6F §39 prefers 100% parity for deterministic fixtures — any mismatch above must be explained, not just tolerated');

  console.log('[automation-simulation-parity] PASS');
}

run().catch(err => { console.error('[automation-simulation-parity] FAIL:', err); process.exit(1); });
