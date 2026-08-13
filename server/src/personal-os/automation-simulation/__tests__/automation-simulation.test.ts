/**
 * Phase 6F §37 — core simulation behavior.
 */
import assert from 'assert';
import { AutomationSimulationService } from '../service';
import type { SimulationInput } from '../types';

async function run() {
  const sim = new AutomationSimulationService();

  // --- simple local step -------------------------------------------------------
  {
    const r = await sim.run({ kind: 'SINGLE_PROPOSAL', projectId: 'proj-a', steps: [{ key: 'a', type: 'READ_ONLY', description: 'read something' }] });
    assert.strictEqual(r.overallOutcome, 'WOULD_EXECUTE');
    assert.strictEqual(r.steps[0].result, 'WOULD_EXECUTE');
    assert.strictEqual(r.sideEffectCount, 0, 'a READ_ONLY step is never counted as a side effect');
  }

  // --- Controlled Action, provider SUCCESS --------------------------------------
  {
    const r = await sim.run({
      kind: 'SINGLE_PROPOSAL', projectId: 'proj-a',
      steps: [{ key: 'a', type: 'CONTROLLED_ACTION', description: 'draft', actionType: 'CALENDAR_EVENT_PROPOSAL',
        actionPayload: { title: 'x', start: '2026-08-13T10:00:00Z', end: '2026-08-13T10:30:00Z', timezone: 'UTC' }, providerScenario: 'SUCCESS' }],
    });
    const step = r.steps[0];
    assert.ok(step.expectedProviderEffect?.simulatedObjectId?.startsWith('sim-calendar-event-'), 'simulated id carries the sim- prefix');
    assert.notStrictEqual(step.result, 'INVALID');
  }

  // --- approval-required (R2 GMAIL_CREATE_DRAFT under default policy) -----------
  {
    const r = await sim.run({
      kind: 'SINGLE_PROPOSAL', projectId: 'proj-a',
      steps: [{ key: 'a', type: 'CONTROLLED_ACTION', description: 'gmail draft', actionType: 'GMAIL_CREATE_DRAFT',
        actionPayload: { to: ['user@mi.local'], subject: 's', body: 'b', reason: 'r' } }],
    });
    assert.strictEqual(r.steps[0].result, 'WOULD_REQUIRE_APPROVAL');
    assert.strictEqual(r.approvalCount, 1);
    assert.strictEqual(r.overallOutcome, 'WOULD_REQUIRE_APPROVAL');
  }

  // --- kill switch what-if --------------------------------------------------------
  {
    const r = await sim.run({
      kind: 'POLICY_WHAT_IF', projectId: 'proj-a',
      steps: [{ key: 'a', type: 'CONTROLLED_ACTION', description: 'blocked calendar create', actionType: 'CALENDAR_CREATE_EVENT',
        actionPayload: { title: 'x', start: '2026-08-13T10:00:00Z', end: '2026-08-13T10:30:00Z', timezone: 'UTC', attendees: [] },
        killSwitchOverrides: [{ scope: 'GLOBAL', reason: 'what-if' }] }],
    });
    assert.strictEqual(r.steps[0].result, 'WOULD_BLOCK');
    assert.strictEqual(r.steps[0].policyDecision, 'BLOCK_KILL_SWITCH');
    assert.ok(r.steps[0].killSwitchDecision?.blocked);
  }

  // --- budget what-if: exhausted budget blocks -----------------------------------
  {
    const r = await sim.run({
      kind: 'POLICY_WHAT_IF', projectId: 'proj-a',
      steps: [{ key: 'a', type: 'CONTROLLED_ACTION', description: 'budget exhausted', actionType: 'CALENDAR_EVENT_PROPOSAL',
        actionPayload: { title: 'x', start: '2026-08-13T10:00:00Z', end: '2026-08-13T10:30:00Z', timezone: 'UTC' },
        budgetOverrides: [{ actionType: 'CALENDAR_EVENT_PROPOSAL', projectId: null, maxExecutions: 1, usedExecutions: 1, maxExternalTargets: 10, usedExternalTargets: 0 }] }],
    });
    assert.strictEqual(r.steps[0].result, 'WOULD_BLOCK');
    assert.strictEqual(r.steps[0].policyDecision, 'BLOCK_BUDGET');
  }

  // --- delegation what-if: expired delegation denies ------------------------------
  {
    const r = await sim.run({
      kind: 'DELEGATED_CANDIDATE', projectId: 'proj-a',
      steps: [{ key: 'a', type: 'CONTROLLED_ACTION', description: 'delegated draft', actionType: 'GMAIL_CREATE_DRAFT',
        actionPayload: { to: ['user@mi.local'], subject: 's', body: 'b', reason: 'r' },
        delegationOverride: { scenario: 'EXPIRED' } }],
    });
    assert.strictEqual(r.steps[0].delegationDecision?.eligible, false);
    assert.ok(r.steps[0].delegationDecision?.reasons.some(x => x.includes('outside the delegation operating window')));
  }

  // --- delegation what-if: valid delegation is eligible ---------------------------
  {
    const r = await sim.run({
      kind: 'DELEGATED_CANDIDATE', projectId: 'proj-a',
      steps: [{ key: 'a', type: 'CONTROLLED_ACTION', description: 'delegated draft', actionType: 'GMAIL_CREATE_DRAFT',
        actionPayload: { to: ['user@mi.local'], subject: 's', body: 'b', reason: 'r' },
        delegationOverride: { scenario: 'VALID' } }],
    });
    assert.strictEqual(r.steps[0].delegationDecision?.eligible, true);
  }

  // --- provider TIMEOUT / AMBIGUOUS_RESULT ----------------------------------------
  // CALENDAR_EVENT_PROPOSAL requires STANDARD approval under the real default policy
  // (calendar-proposal-standard-approval), so the primary `result` is
  // WOULD_REQUIRE_APPROVAL here — that is the faithful, parity-preserving answer, not
  // a bug. The hypothetical provider outcome is still reported in
  // `expectedProviderEffect` (§16), which is what these cases actually verify.
  {
    const rTimeout = await sim.run({
      kind: 'SINGLE_PROPOSAL', projectId: 'proj-a',
      steps: [{ key: 'a', type: 'CONTROLLED_ACTION', description: 'x', actionType: 'CALENDAR_EVENT_PROPOSAL',
        actionPayload: { title: 'x', start: '2026-08-13T10:00:00Z', end: '2026-08-13T10:30:00Z', timezone: 'UTC' }, providerScenario: 'TIMEOUT' }],
    });
    assert.strictEqual(rTimeout.steps[0].result, 'WOULD_REQUIRE_APPROVAL');
    assert.ok(rTimeout.steps[0].expectedProviderEffect?.reconciliationRequired, 'a TIMEOUT scenario is flagged as needing reconciliation');

    // A delegated candidate with a valid delegation auto-proceeds without a human
    // approval gate — this is the case where the provider outcome DOES become the
    // primary result.
    const rTimeoutDelegated = await sim.run({
      kind: 'DELEGATED_CANDIDATE', projectId: 'proj-a',
      steps: [{ key: 'a', type: 'CONTROLLED_ACTION', description: 'x', actionType: 'CALENDAR_EVENT_PROPOSAL',
        actionPayload: { title: 'x', start: '2026-08-13T10:00:00Z', end: '2026-08-13T10:30:00Z', timezone: 'UTC' },
        providerScenario: 'TIMEOUT', delegationOverride: { scenario: 'VALID' } }],
    });
    assert.strictEqual(rTimeoutDelegated.steps[0].result, 'UNCERTAIN', 'an eligible delegation auto-proceeds, so the provider outcome becomes the primary result');

    const rAmbig = await sim.run({
      kind: 'DELEGATED_CANDIDATE', projectId: 'proj-a',
      steps: [{ key: 'a', type: 'CONTROLLED_ACTION', description: 'x', actionType: 'CALENDAR_EVENT_PROPOSAL',
        actionPayload: { title: 'x', start: '2026-08-13T10:00:00Z', end: '2026-08-13T10:30:00Z', timezone: 'UTC' },
        providerScenario: 'AMBIGUOUS_RESULT', delegationOverride: { scenario: 'VALID' } }],
    });
    assert.strictEqual(rAmbig.steps[0].result, 'UNCERTAIN', 'ambiguous provider result is never collapsed into a simple FAILED');
    assert.ok(rAmbig.steps[0].expectedProviderEffect?.reconciliationRequired);
  }

  // --- plan DAG: two independent steps + one dependent step ----------------------
  {
    const input: SimulationInput = {
      kind: 'PROPOSED_PLAN', projectId: 'proj-a',
      steps: [
        { key: 'read', type: 'READ_ONLY', description: 'gather context' },
        { key: 'draft', type: 'CONTROLLED_ACTION', description: 'draft after read', dependsOnKeys: ['read'], actionType: 'CALENDAR_EVENT_PROPOSAL',
          actionPayload: { title: 'x', start: '2026-08-13T10:00:00Z', end: '2026-08-13T10:30:00Z', timezone: 'UTC' }, providerScenario: 'SUCCESS' },
      ],
    };
    const r = await sim.run(input);
    assert.strictEqual(r.steps.length, 2);
    assert.strictEqual(r.steps.find(s => s.stepId === 'read')!.result, 'WOULD_EXECUTE');
    assert.strictEqual(r.steps.find(s => s.stepId === 'draft')!.result, 'WOULD_REQUIRE_APPROVAL', 'CALENDAR_EVENT_PROPOSAL requires STANDARD approval under the real default policy');
    assert.ok(r.steps.find(s => s.stepId === 'draft')!.expectedProviderEffect?.simulatedObjectId, 'the hypothetical provider outcome is still reported alongside the approval requirement');
  }

  // --- failure propagation: a failed dependency permanently blocks the dependent --
  // Both steps use a valid delegation so they auto-proceed (no approval gate),
  // isolating this test to the DAG failure-propagation behavior specifically.
  {
    const r = await sim.run({
      kind: 'PROPOSED_PLAN', projectId: 'proj-a',
      steps: [
        { key: 'fails', type: 'CONTROLLED_ACTION', description: 'x', actionType: 'CALENDAR_EVENT_PROPOSAL',
          actionPayload: { title: 'x', start: '2026-08-13T10:00:00Z', end: '2026-08-13T10:30:00Z', timezone: 'UTC' },
          providerScenario: 'VALIDATION_ERROR', delegationOverride: { scenario: 'VALID' } },
        { key: 'depends', type: 'CONTROLLED_ACTION', description: 'y', dependsOnKeys: ['fails'], actionType: 'CALENDAR_EVENT_PROPOSAL',
          actionPayload: { title: 'y', start: '2026-08-13T11:00:00Z', end: '2026-08-13T11:30:00Z', timezone: 'UTC' },
          delegationOverride: { scenario: 'VALID' } },
      ],
    });
    assert.strictEqual(r.steps.find(s => s.stepId === 'fails')!.result, 'WOULD_FAIL');
    assert.strictEqual(r.steps.find(s => s.stepId === 'depends')!.result, 'WOULD_BLOCK');
  }

  // --- forbidden capability -------------------------------------------------------
  {
    const r = await sim.run({
      kind: 'SINGLE_PROPOSAL', projectId: 'proj-a',
      steps: [{ key: 'a', type: 'CONTROLLED_ACTION', description: 'forbidden', actionType: 'GMAIL_SEND_DRAFT', forbiddenCandidate: true }],
    });
    assert.strictEqual(r.steps[0].result, 'WOULD_BLOCK');
    assert.ok(r.steps[0].reason.includes('FORBIDDEN_CAPABILITY'));
    assert.strictEqual(r.steps[0].authoritySurface, null, 'a forbidden candidate never gets an authority surface assigned');
  }

  // --- legacy quarantine ------------------------------------------------------------
  {
    const r = await sim.run({
      kind: 'SINGLE_PROPOSAL', projectId: 'proj-a',
      steps: [{ key: 'a', type: 'CONTROLLED_ACTION', description: 'legacy', actionType: 'GMAIL_CREATE_DRAFT', legacyQuarantinedSurfaceId: 'http:POST:/api/browser/write' }],
    });
    assert.strictEqual(r.steps[0].result, 'WOULD_BLOCK');
    assert.ok(r.steps[0].reason.includes('LEGACY_QUARANTINED'));
  }

  // --- invalid DAG: unknown dependency / cycle -------------------------------------
  {
    const rUnknown = await sim.run({ kind: 'PROPOSED_PLAN', projectId: 'proj-a', steps: [{ key: 'a', type: 'READ_ONLY', description: 'x', dependsOnKeys: ['ghost'] }] });
    assert.strictEqual(rUnknown.overallOutcome, 'INVALID');

    const rCycle = await sim.run({
      kind: 'PROPOSED_PLAN', projectId: 'proj-a',
      steps: [{ key: 'a', type: 'READ_ONLY', description: 'x', dependsOnKeys: ['b'] }, { key: 'b', type: 'READ_ONLY', description: 'y', dependsOnKeys: ['a'] }],
    });
    assert.strictEqual(rCycle.overallOutcome, 'INVALID');
  }

  // --- reversibility metadata never invented ---------------------------------------
  {
    const r = await sim.run({
      kind: 'SINGLE_PROPOSAL', projectId: 'proj-a',
      steps: [{ key: 'a', type: 'CONTROLLED_ACTION', description: 'x', actionType: 'GMAIL_CREATE_DRAFT', actionPayload: { to: ['user@mi.local'], subject: 's', body: 'b', reason: 'r' } }],
    });
    assert.strictEqual(r.steps[0].reversibility, 'REVERSIBLE', 'GMAIL_CREATE_DRAFT is reversible, matching the real compensation record');
  }

  console.log('[automation-simulation] PASS');
}

run().catch(err => { console.error('[automation-simulation] FAIL:', err); process.exit(1); });
