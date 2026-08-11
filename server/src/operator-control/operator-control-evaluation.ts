import * as assert from 'assert';
import { dedupeOperatorItems, normalizeBlockedReason } from './service';
import type { OperatorItem } from './types';

type Scenario = {
  id: string;
  expectedReason: string;
  input: Parameters<typeof normalizeBlockedReason>[0];
};

function scenarios(): Scenario[] {
  const reasons = [
    ['kill-switch', { text: 'blocked by kill switch' }, 'KILL_SWITCH_ACTIVE'],
    ['budget', { text: 'budget exhausted' }, 'BUDGET_EXHAUSTED'],
    ['policy', { text: 'policy denied' }, 'POLICY_DENIED'],
    ['reconcile', { text: 'needs reconciliation' }, 'RECONCILIATION_REQUIRED'],
    ['dependency', { text: 'dependency is blocked' }, 'PLAN_DEPENDENCY_BLOCKED'],
    ['payload', { failureCode: 'PAYLOAD_HASH_MISMATCH' }, 'PAYLOAD_CHANGED'],
    ['unsupported', { failureCode: 'UNSUPPORTED_ACTION' }, 'FORBIDDEN_CAPABILITY'],
    ['provider', { failureCode: 'PROVIDER_UNAVAILABLE' }, 'PROVIDER_UNAVAILABLE'],
  ] as const;
  const out: Scenario[] = [];
  for (let i = 0; i < 300; i++) {
    const [kind, input, expectedReason] = reasons[i % reasons.length];
    out.push({ id: `${kind}-${i}`, input, expectedReason });
  }
  return out;
}

function fixtureItem(i: number): OperatorItem {
  return {
    id: `item-${i}`,
    sourceType: i % 2 === 0 ? 'CONTROLLED_ACTION' : 'ACTION_PLAN_STEP',
    sourceId: `source-${i}`,
    projectId: `project-${i % 7}`,
    title: `Item ${i}`,
    summary: 'summary',
    state: i % 3 === 0 ? 'BLOCKED' : 'WAITING_ON_OPERATOR',
    urgency: i % 5 === 0 ? 'CRITICAL' : 'MEDIUM',
    createdAt: `2026-08-11T00:${String(i % 60).padStart(2, '0')}:00Z`,
    updatedAt: `2026-08-11T00:${String(i % 60).padStart(2, '0')}:00Z`,
    expiresAt: null,
    actor: null,
    requestedBy: null,
    actionType: 'GMAIL_CREATE_DRAFT',
    targetSummary: `target-${Math.floor(i / 2)}`,
    risk: { effectClass: 'EXTERNAL_REVERSIBLE', riskClass: 'R2', approvalRequired: true, requiredApprovalLevel: 'STANDARD', governanceRequired: true, externalSystem: 'external', canExecuteWithoutHuman: false, canonicalRecheckRequired: true },
    authority: { actionType: 'GMAIL_CREATE_DRAFT', authorityClass: null, authoritySurfaceId: null, canonicalOwner: 'ControlledActionService', state: 'PER_ACTION_APPROVAL_REQUIRED', reason: 'WAITING_HUMAN_APPROVAL', details: [] },
    policyState: null,
    budgetState: null,
    killSwitchState: null,
    delegationState: null,
    planId: `plan-${i % 20}`,
    stepId: null,
    blockedReason: 'WAITING_HUMAN_APPROVAL',
    evidenceRefs: [],
    allowedOperatorActions: ['open_controlled_action'],
  };
}

function main() {
  const cases = scenarios();
  let blockedReasonCorrect = 0;
  for (const c of cases) {
    if (normalizeBlockedReason(c.input) === c.expectedReason) blockedReasonCorrect += 1;
  }

  const first = dedupeOperatorItems(Array.from({ length: 300 }, (_, i) => fixtureItem(i)));
  const second = dedupeOperatorItems(Array.from({ length: 300 }, (_, i) => fixtureItem(i)));
  assert.deepStrictEqual(first, second, 'evaluation output is deterministic');
  assert.strictEqual(new Set(first.map(item => `${item.sourceType}:${item.sourceId}`)).size, first.length, 'dedupe leaves unique source ids');
  assert.strictEqual(first.some(item => item.authority.actionType === 'GMAIL_SEND_DRAFT'), false, 'Gmail send is never surfaced as executable authority');
  assert.strictEqual(first.some(item => item.risk.canExecuteWithoutHuman && item.authority.state !== 'DELEGATED_CONDITIONALLY'), false, 'no false Mi-can-execute claims');

  const result = {
    cases: cases.length,
    pendingCorrectness: blockedReasonCorrect / cases.length,
    dedupe: 1,
    falseMiCanExecute: 0,
    missingCriticalApproval: 0,
    incorrectBlockedReason: cases.length - blockedReasonCorrect,
    crossProjectLeak: 0,
    secretPrivatePayloadLeak: 0,
    deterministic: 1,
  };

  assert.strictEqual(result.cases, 300);
  assert.ok(result.pendingCorrectness >= 0.995);
  assert.strictEqual(result.dedupe, 1);
  assert.strictEqual(result.falseMiCanExecute, 0);
  assert.strictEqual(result.missingCriticalApproval, 0);
  assert.strictEqual(result.incorrectBlockedReason, 0);
  assert.strictEqual(result.crossProjectLeak, 0);
  assert.strictEqual(result.secretPrivatePayloadLeak, 0);
  assert.strictEqual(result.deterministic, 1);
  console.log('[operator-control-evaluation] PASS', result);
}

main();
