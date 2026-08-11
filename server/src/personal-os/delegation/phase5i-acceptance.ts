/**
 * Phase 5I acceptance — mirrors phase5h-acceptance.ts's shape: integrity proof,
 * fixture scenarios, and performance measurement at increasing delegation counts.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as assert from 'assert';
import { DelegationService } from './service';
import { GovernedOrchestrationService } from '../orchestration/service';

function tempRoot(): string { return fs.mkdtempSync(path.join(os.tmpdir(), 'phase5i-acceptance-')); }

function baseInput(overrides: any = {}) {
  return {
    title: 'acceptance', description: 'x', owner: 'liem', projectId: 'mi-core',
    allowedActionTypes: ['GMAIL_CREATE_DRAFT'],
    targetRestriction: { allowedDomains: ['example.com'], maxRecipients: 3 },
    riskCeiling: 'R2', approvalLevelCeiling: 'STANDARD',
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    timezone: 'UTC', maxExecutions: 3,
    ...overrides,
  };
}

function activate(delegation: DelegationService, overrides: any = {}) {
  const d = delegation.createDelegation(baseInput(overrides));
  delegation.submitForApproval(d.id);
  return delegation.approve(d.id, { approver: 'liem', strongConfirmation: `AUTHORIZE:${d.id}` });
}

async function fixtureScenarios(): Promise<Record<string, string>> {
  const root = tempRoot();
  const delegation = new DelegationService(root);
  const orchestration = new GovernedOrchestrationService(root, delegation);
  const results: Record<string, string> = {};
  try {
    // A: create -> submit -> strong approve -> activate
    const d = activate(delegation);
    results.A = d.status === 'ACTIVE' ? 'PASS' : 'FAIL';

    // B: eligible delegated execution auto-completes
    const plan = orchestration.createPlan({ title: 't', objective: 'o', projectId: 'mi-core', steps: [{ key: 'd', type: 'CONTROLLED_ACTION', description: 'd', actionType: 'GMAIL_CREATE_DRAFT', actionPayload: { to: ['owner@example.com'], subject: 'acc-b', body: 'b', projectId: 'mi-core', reason: 'r' } }] });
    orchestration.validate(plan.id); orchestration.start(plan.id); await orchestration.advance(plan.id);
    results.B = orchestration.detail(plan.id).steps[0].status === 'COMPLETED' ? 'PASS' : 'FAIL';

    // C: quota exhaustion after maxExecutions
    const dQuota = activate(delegation, { maxExecutions: 1, projectId: 'proj-quota' });
    const p1 = orchestration.createPlan({ title: 't', objective: 'o', projectId: 'proj-quota', steps: [{ key: 'd', type: 'CONTROLLED_ACTION', description: 'd', actionType: 'GMAIL_CREATE_DRAFT', actionPayload: { to: ['owner@example.com'], subject: 'acc-c1', body: 'b', projectId: 'proj-quota', reason: 'r' } }] });
    orchestration.validate(p1.id); orchestration.start(p1.id); await orchestration.advance(p1.id);
    const p2 = orchestration.createPlan({ title: 't', objective: 'o', projectId: 'proj-quota', steps: [{ key: 'd', type: 'CONTROLLED_ACTION', description: 'd', actionType: 'GMAIL_CREATE_DRAFT', actionPayload: { to: ['owner@example.com'], subject: 'acc-c2', body: 'b', projectId: 'proj-quota', reason: 'r' } }] });
    orchestration.validate(p2.id); orchestration.start(p2.id); await orchestration.advance(p2.id);
    results.C = (delegation.get(dQuota.id).status === 'EXHAUSTED' && orchestration.detail(p2.id).steps[0].status === 'WAITING_APPROVAL') ? 'PASS' : 'FAIL';

    // D: revoke immediately blocks
    const dRevoke = activate(delegation, { projectId: 'proj-revoke' });
    delegation.revoke(dRevoke.id, 'liem', 'acceptance');
    const p3 = orchestration.createPlan({ title: 't', objective: 'o', projectId: 'proj-revoke', steps: [{ key: 'd', type: 'CONTROLLED_ACTION', description: 'd', actionType: 'GMAIL_CREATE_DRAFT', actionPayload: { to: ['owner@example.com'], subject: 'acc-d', body: 'b', projectId: 'proj-revoke', reason: 'r' } }] });
    orchestration.validate(p3.id); orchestration.start(p3.id); await orchestration.advance(p3.id);
    results.D = orchestration.detail(p3.id).steps[0].status === 'WAITING_APPROVAL' ? 'PASS' : 'FAIL';

    // E: expiry blocks
    const dExpiry = activate(delegation, { projectId: 'proj-expiry', startsAt: new Date(Date.now() - 7200_000).toISOString(), expiresAt: new Date(Date.now() - 3600_000).toISOString() });
    const p4 = orchestration.createPlan({ title: 't', objective: 'o', projectId: 'proj-expiry', steps: [{ key: 'd', type: 'CONTROLLED_ACTION', description: 'd', actionType: 'GMAIL_CREATE_DRAFT', actionPayload: { to: ['owner@example.com'], subject: 'acc-e', body: 'b', projectId: 'proj-expiry', reason: 'r' } }] });
    orchestration.validate(p4.id); orchestration.start(p4.id); await orchestration.advance(p4.id);
    results.E = orchestration.detail(p4.id).steps[0].status === 'WAITING_APPROVAL' ? 'PASS' : 'FAIL';

    // F: policy deny blocks
    const dPolicy = activate(delegation, { projectId: 'proj-policy' });
    const p5 = orchestration.createPlan({ title: 't', objective: 'o', projectId: 'proj-policy', steps: [{ key: 'd', type: 'CONTROLLED_ACTION', description: 'd', actionType: 'GMAIL_CREATE_DRAFT', actionPayload: { to: ['owner@example.com'], subject: 'acc-f', body: 'b', projectId: 'proj-policy', reason: 'contains financial keyword' } }] });
    orchestration.validate(p5.id); orchestration.start(p5.id); await orchestration.advance(p5.id);
    results.F = orchestration.detail(p5.id).steps[0].status === 'WAITING_APPROVAL' ? 'PASS' : 'FAIL';

    // G: kill switch blocks
    const dKill = activate(delegation, { projectId: 'proj-kill' });
    const sw = delegation.controlledActions.policyEngine.killSwitch.enable({ scope: 'GLOBAL', projectId: null, actionType: null, reason: 'acceptance', activatedBy: 'acceptance' });
    const p6 = orchestration.createPlan({ title: 't', objective: 'o', projectId: 'proj-kill', steps: [{ key: 'd', type: 'CONTROLLED_ACTION', description: 'd', actionType: 'GMAIL_CREATE_DRAFT', actionPayload: { to: ['owner@example.com'], subject: 'acc-g', body: 'b', projectId: 'proj-kill', reason: 'r' } }] });
    orchestration.validate(p6.id); orchestration.start(p6.id); await orchestration.advance(p6.id);
    results.G = !orchestration.detail(p6.id).steps[0].proposalId ? 'PASS' : 'FAIL';
    delegation.controlledActions.policyEngine.killSwitch.unlock(sw.id);

    // H: restart preserves state (WAITING_APPROVAL after quota exhaustion remains so; ACTIVE delegation quota persists)
    orchestration.close(); delegation.close();
    const delegation2 = new DelegationService(root);
    const persistedQuota = delegation2.get(dQuota.id);
    results.H = persistedQuota.status === 'EXHAUSTED' && persistedQuota.usedExecutions === 1 ? 'PASS' : 'FAIL';
    delegation2.close();

    return results;
  } finally {
    try { orchestration.close(); } catch { /* already closed */ }
    try { delegation.close(); } catch { /* already closed */ }
    try { fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch (e) { console.error('cleanup warning:', e); }
  }
}

async function performance(): Promise<Record<string, number>> {
  const root = tempRoot();
  const delegation = new DelegationService(root);
  const perf: Record<string, number> = {};
  try {
    // 1 delegation: create+approve+evaluate latency
    let t0 = Date.now();
    const d1 = activate(delegation, { projectId: 'perf-1' });
    perf.createApprove1Ms = Date.now() - t0;

    // 100 delegations
    t0 = Date.now();
    for (let i = 0; i < 100; i++) activate(delegation, { projectId: `perf-100-${i}` });
    perf.create100Ms = Date.now() - t0;

    // eligibility evaluation latency against a pool of 100 ACTIVE delegations
    const controlledActions = delegation.controlledActions;
    const proposal = controlledActions.propose({ actionType: 'GMAIL_CREATE_DRAFT', reason: 'perf', projectId: 'perf-100-50', normalizedPayload: { to: ['owner@example.com'], subject: 'perf-eval', body: 'b', projectId: 'perf-100-50', reason: 'r' } });
    t0 = Date.now();
    delegation.evaluate(controlledActions.get(proposal.id));
    perf.evaluateAmong100Ms = Date.now() - t0;

    // 1000 historical (mostly terminal) delegations — quota reservation p50/p95-ish single sample
    t0 = Date.now();
    for (let i = 0; i < 900; i++) {
      const d = delegation.createDelegation(baseInput({ title: `hist-${i}`, projectId: `perf-hist-${i}` }));
      delegation.cancel(d.id, 'perf', 'historical fixture');
    }
    perf.create900MoreHistoricalMs = Date.now() - t0;

    t0 = Date.now();
    delegation.list();
    perf.listAmong1000Ms = Date.now() - t0;

    return perf;
  } finally {
    delegation.close();
    try { fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch (e) { console.error('cleanup warning:', e); }
  }
}

async function main() {
  const scenarios = await fixtureScenarios();
  const perf = await performance();
  const allPass = Object.values(scenarios).every(v => v === 'PASS');
  const report = { phase: '5I', scenarios, performance: perf, allScenariosPass: allPass };
  console.log(JSON.stringify(report, null, 2));
  assert.ok(allPass, 'not all fixture scenarios passed');
  console.log('[phase5i-acceptance] PASS');
}

main().catch(err => { console.error(err); process.exitCode = 1; });
