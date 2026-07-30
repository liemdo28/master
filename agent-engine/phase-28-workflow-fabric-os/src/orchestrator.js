/**
 * Phase 28 — N8N / Workflow Fabric 2.0. OSS: n8n (TCP 5678). Fallback: in-engine registry.
 * Modules: WorkflowRegistry · WorkflowOwnerEngine · WorkflowDedupeEngine · WorkflowReplayEngine
 *          · WorkflowEvidenceEngine · WorkflowApprovalGate · WorkflowHealthScorecard
 */
import { JsonStore, makeId } from '../../phase-12-self-improving-intelligence/src/store.js';

export class WorkflowRegistry {
  constructor(opts) { this.store = new JsonStore('wf-registry', opts); }
  register(w) { return this.store.insert({ id: makeId('WFR'), timestamp: Date.now(), workflowId: w.workflowId, name: w.name, owner: w.owner, division: w.division, status: 'registered', executions: 0 }); }
  byId(workflowId) { return this.store.find((r) => r.workflowId === workflowId); }
  all() { return this.store.all(); }
  recordRun(workflowId) { const r = this.byId(workflowId); if (r) { r.executions++; r.lastRun = Date.now(); this.store.update(r.id, { executions: r.executions, lastRun: r.lastRun }); } return r; }
}

export class WorkflowOwnerEngine {
  constructor(opts) { this.store = new JsonStore('wf-owners', opts); }
  assign(wfId, owner) { return this.store.insert({ id: makeId('WFO'), timestamp: Date.now(), workflowId: wfId, owner, status: 'assigned' }); }
}

export class WorkflowDedupeEngine {
  constructor(opts) { this.store = new JsonStore('wf-dedup', opts); }
  /** Same workflow+trigger within dedupe window: skip duplicate, preserve one canonical. */
  check(wfId, trigger) {
    const existing = this.store.find((r) => r.workflowId === wfId && r.trigger === trigger && r.status === 'active');
    if (existing) { this.store.update(existing.id, { status: 'superseded', supersededAt: Date.now() }); return { duplicate: true, canonicalId: existing.id, action: 'skip' }; }
    const rec = this.store.insert({ id: makeId('DEDUP'), timestamp: Date.now(), workflowId: wfId, trigger, status: 'active' });
    return { duplicate: false, canonicalId: rec.id, action: 'run' };
  }
  all() { return this.store.all(); }
}

export class WorkflowReplayEngine {
  constructor(opts) { this.store = new JsonStore('wf-replay', opts); }
  request(wfId, reason) { return this.store.insert({ id: makeId('REPLAY'), timestamp: Date.now(), workflowId: wfId, reason, status: 'pending_approval' }); }
  approve(replayId) { const r = this.store.find((x) => x.id === replayId); if (r) this.store.update(r.id, { status: 'approved' }); return r; }
  all() { return this.store.all(); }
}

export class WorkflowEvidenceEngine {
  constructor(opts) { this.store = new JsonStore('wf-evidence', opts); }
  record(exec) { return this.store.insert({ id: makeId('EVID'), timestamp: Date.now(), workflowId: exec.workflowId, executionId: exec.executionId, outcome: exec.outcome, durationMs: exec.durationMs, approved: exec.approved }); }
  all() { return this.store.all(); }
}

export class WorkflowApprovalGate {
  constructor(opts) { this.store = new JsonStore('wf-approvals', opts); }
  request(execId, reason) { return this.store.insert({ id: makeId('WFAP'), timestamp: Date.now(), executionId: execId, status: 'pending_approval', reason }); }
  approve(execId) { const r = this.store.find((x) => x.executionId === execId); if (r) this.store.update(r.id, { status: 'approved' }); return r; }
  pending() { return this.store.filter((r) => r.status === 'pending_approval'); }
  all() { return this.store.all(); }
}

export class WorkflowHealthScorecard {
  dashboard(registry, dedup, evidence) {
    const total = (registry || []).length;
    const active = (dedup || []).filter((d) => d.status === 'active').length;
    return { totalWorkflows: total, activeDedupeKeys: active, totalExecutions: (evidence || []).length, status: active > 10 ? 'BUSY' : 'NORMAL' };
  }
}

export class WorkflowFabric2OS {
  constructor(opts = {}) {
    this.registry = new WorkflowRegistry(opts);
    this.owners = new WorkflowOwnerEngine(opts);
    this.dedup = new WorkflowDedupeEngine(opts);
    this.replay = new WorkflowReplayEngine(opts);
    this.evidence = new WorkflowEvidenceEngine(opts);
    this.approvals = new WorkflowApprovalGate(opts);
    this.health = new WorkflowHealthScorecard();
  }

  /** Scenario: same workflow triggered twice -> dedup -> one execution preserved -> evidence stored. */
  handleTrigger({ workflowId, name, owner, division, trigger, outcome, durationMs, approved, evidenceRef }) {
    const existing = this.registry.byId(workflowId);
    if (!existing) this.registry.register({ workflowId, name, owner, division, trigger });
    const dedup = this.dedup.check(workflowId, trigger);
    if (dedup.duplicate) return { dedupResult: dedup, execution: null, evidence: null };
    this.registry.recordRun(workflowId);
    const executionId = makeId('EXEC');
    const approval = approved ? null : this.approvals.request(executionId, 'approval required before execution');
    const ev = this.evidence.record({ workflowId, executionId, outcome, durationMs, approved: !!approved });
    return { dedupResult: dedup, execution: { executionId, workflowId, approved: !!approved }, evidence: ev, approval };
  }

  dashboard() { return this.health.dashboard(this.registry.all(), this.dedup.all(), this.evidence.all()); }
}

export default WorkflowFabric2OS;