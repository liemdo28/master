import { randomUUID } from 'crypto';
import Database from 'better-sqlite3';
import { canonicalJson, payloadHash } from '../policy';
import type {
  ActionBudget,
  GovernanceAnomaly,
  GovernanceEvent,
  KillSwitch,
  PolicyDecision,
  PolicyRule,
  PolicySet,
  ProjectActionPolicy,
} from './types';

const readJson = <T>(value: string, fallback: T): T => {
  try { return JSON.parse(value) as T; } catch { return fallback; }
};

export class GovernanceStore {
  constructor(readonly db: Database.Database) {}

  activePolicySet(): PolicySet | null {
    const set = this.db.prepare(`SELECT * FROM policy_sets WHERE status = 'ACTIVE' LIMIT 1`).get() as any;
    if (!set) return null;
    const rules = (this.db.prepare(`SELECT * FROM policy_rules WHERE policySetId = ? ORDER BY priority DESC, id ASC`).all(set.id) as any[]).map(parseRule);
    return { ...set, rules } as PolicySet;
  }

  listPolicySets(): PolicySet[] {
    return (this.db.prepare(`SELECT * FROM policy_sets ORDER BY createdAt DESC`).all() as any[]).map(row => ({
      ...row,
      rules: (this.db.prepare(`SELECT * FROM policy_rules WHERE policySetId = ? ORDER BY priority DESC, id ASC`).all(row.id) as any[]).map(parseRule),
    }) as PolicySet);
  }

  createDraftPolicySet(rules: PolicyRule[], actor = 'api-user'): PolicySet {
    const createdAt = new Date().toISOString();
    const version = `draft-${createdAt.replace(/[^0-9]/g, '')}-${randomUUID().slice(0, 8)}`;
    const contentHash = payloadHash({ version, rules: rules.map(stableRuleContent) });
    const set: PolicySet = {
      id: `policy-set-${randomUUID()}`,
      version,
      contentHash,
      status: 'DRAFT',
      createdAt,
      activatedAt: null,
      supersedesId: this.activePolicySet()?.id ?? null,
      rules: rules.map(rule => ({ ...rule, id: `${rule.id}@${version}`, updatedAt: createdAt, createdAt: rule.createdAt || createdAt })),
    };
    this.db.prepare(`
      INSERT INTO policy_sets (id, version, contentHash, status, createdAt, activatedAt, supersedesId)
      VALUES (@id, @version, @contentHash, @status, @createdAt, @activatedAt, @supersedesId)
    `).run(set);
    const insert = this.db.prepare(`
      INSERT INTO policy_rules (
        id, policySetId, name, description, enabled, priority, scope, actionTypesJson, projectsJson,
        riskClassesJson, conditionsJson, effect, approvalLevel, maxExecutions, timeWindow,
        validFrom, validUntil, source, createdAt, updatedAt, version
      ) VALUES (
        @id, @policySetId, @name, @description, @enabled, @priority, @scope, @actionTypesJson, @projectsJson,
        @riskClassesJson, @conditionsJson, @effect, @approvalLevel, @maxExecutions, @timeWindow,
        @validFrom, @validUntil, @source, @createdAt, @updatedAt, @version
      )
    `);
    for (const rule of set.rules) insert.run(serializeRule(set.id, { ...rule, source: rule.source || actor }));
    return set;
  }

  activatePolicySet(id: string): PolicySet {
    const draft = this.listPolicySets().find(item => item.id === id || item.version === id);
    if (!draft) throw new Error('policy not found');
    if (draft.status !== 'DRAFT') throw new Error('only DRAFT policy sets may be activated');
    const active = this.activePolicySet();
    const activatedAt = new Date().toISOString();
    if (active) this.db.prepare(`UPDATE policy_sets SET status = 'SUPERSEDED' WHERE id = ?`).run(active.id);
    this.db.prepare(`UPDATE policy_sets SET status = 'ACTIVE', activatedAt = ? WHERE id = ?`).run(activatedAt, draft.id);
    return this.listPolicySets().find(item => item.id === draft.id)!;
  }

  rollbackPolicySet(id: string): PolicySet {
    const target = this.listPolicySets().find(item => item.id === id || item.version === id);
    if (!target) throw new Error('policy not found');
    const active = this.activePolicySet();
    if (active) this.db.prepare(`UPDATE policy_sets SET status = 'ROLLED_BACK' WHERE id = ?`).run(active.id);
    this.db.prepare(`UPDATE policy_sets SET status = 'ACTIVE', activatedAt = ? WHERE id = ?`).run(new Date().toISOString(), target.id);
    return this.listPolicySets().find(item => item.id === target.id)!;
  }

  savePolicyDecision(decision: PolicyDecision): PolicyDecision {
    const existing = this.db.prepare(`
      SELECT * FROM policy_decisions WHERE proposalId = ? AND inputHash = ? AND policyVersion = ?
    `).get(decision.proposalId, decision.inputHash, decision.policyVersion) as any;
    if (existing) return parseDecision(existing);
    this.db.prepare(`
      INSERT INTO policy_decisions (
        id, proposalId, actionType, projectId, riskClass, decision, requiredApprovalLevel,
        reasonsJson, matchedPoliciesJson, deniedPoliciesJson, budgetStateJson, killSwitchStateJson,
        contextualConstraintsJson, evaluatedAt, policyVersion, inputHash, decisionHash, evidenceReferencesJson
      ) VALUES (
        @id, @proposalId, @actionType, @projectId, @riskClass, @decision, @requiredApprovalLevel,
        @reasonsJson, @matchedPoliciesJson, @deniedPoliciesJson, @budgetStateJson, @killSwitchStateJson,
        @contextualConstraintsJson, @evaluatedAt, @policyVersion, @inputHash, @decisionHash, @evidenceReferencesJson
      )
    `).run(serializeDecision(decision));
    return decision;
  }

  latestDecision(proposalId: string): PolicyDecision | null {
    const row = this.db.prepare(`SELECT * FROM policy_decisions WHERE proposalId = ? ORDER BY evaluatedAt DESC LIMIT 1`).get(proposalId) as any;
    return row ? parseDecision(row) : null;
  }

  listDecisions(limit = 100): PolicyDecision[] {
    return (this.db.prepare(`SELECT * FROM policy_decisions ORDER BY evaluatedAt DESC LIMIT ?`).all(limit) as any[]).map(parseDecision);
  }

  listBudgets(): ActionBudget[] {
    return (this.db.prepare(`SELECT * FROM action_budgets ORDER BY actionType, projectId, id`).all() as any[]).map(parseBudget);
  }

  findBudget(actionType: string, projectId: string | null): ActionBudget | null {
    const row = this.db.prepare(`
      SELECT * FROM action_budgets
      WHERE enabled = 1 AND actionType = ? AND (projectId IS NULL OR projectId = ?)
      ORDER BY projectId DESC, id ASC LIMIT 1
    `).get(actionType, projectId) as any;
    return row ? parseBudget(row) : null;
  }

  updateBudgetUsage(budget: ActionBudget): void {
    this.db.prepare(`UPDATE action_budgets SET currentUsageJson = ?, resetsAt = ? WHERE id = ?`)
      .run(canonicalJson(budget.currentUsage), budget.resetsAt, budget.id);
  }

  listKillSwitches(includeDisabled = true): KillSwitch[] {
    const rows = includeDisabled
      ? this.db.prepare(`SELECT * FROM kill_switches ORDER BY activatedAt DESC`).all()
      : this.db.prepare(`SELECT * FROM kill_switches WHERE enabled = 1 ORDER BY activatedAt DESC`).all();
    return (rows as any[]).map(parseKillSwitch);
  }

  saveKillSwitch(input: Omit<KillSwitch, 'id' | 'activatedAt'> & { id?: string; activatedAt?: string }): KillSwitch {
    const item: KillSwitch = {
      ...input,
      id: input.id ?? `kill-${randomUUID()}`,
      activatedAt: input.activatedAt ?? new Date().toISOString(),
    };
    this.db.prepare(`
      INSERT INTO kill_switches (id, scope, projectId, actionType, enabled, reason, activatedBy, activatedAt, expiresAt, evidenceReferencesJson)
      VALUES (@id, @scope, @projectId, @actionType, @enabled, @reason, @activatedBy, @activatedAt, @expiresAt, @evidenceReferencesJson)
      ON CONFLICT(id) DO UPDATE SET enabled = excluded.enabled, reason = excluded.reason, expiresAt = excluded.expiresAt
    `).run({ ...item, enabled: item.enabled ? 1 : 0, evidenceReferencesJson: canonicalJson(item.evidenceReferences) });
    return item;
  }

  disableKillSwitch(id: string): KillSwitch {
    this.db.prepare(`UPDATE kill_switches SET enabled = 0 WHERE id = ?`).run(id);
    const row = this.db.prepare(`SELECT * FROM kill_switches WHERE id = ?`).get(id) as any;
    if (!row) throw new Error('kill switch not found');
    return parseKillSwitch(row);
  }

  projectPolicy(projectId: string | null): ProjectActionPolicy | null {
    if (!projectId) return null;
    const row = this.db.prepare(`SELECT * FROM project_action_policies WHERE projectId = ? AND active = 1`).get(projectId) as any;
    return row ? parseProjectPolicy(row) : null;
  }

  upsertProjectPolicy(policy: ProjectActionPolicy): ProjectActionPolicy {
    this.db.prepare(`
      INSERT INTO project_action_policies (
        projectId, allowedActionTypesJson, deniedActionTypesJson, maxRiskClass, budgetsJson,
        targetRestrictionsJson, active, updatedAt
      ) VALUES (
        @projectId, @allowedActionTypesJson, @deniedActionTypesJson, @maxRiskClass, @budgetsJson,
        @targetRestrictionsJson, @active, @updatedAt
      )
      ON CONFLICT(projectId) DO UPDATE SET
        allowedActionTypesJson = excluded.allowedActionTypesJson,
        deniedActionTypesJson = excluded.deniedActionTypesJson,
        maxRiskClass = excluded.maxRiskClass,
        budgetsJson = excluded.budgetsJson,
        targetRestrictionsJson = excluded.targetRestrictionsJson,
        active = excluded.active,
        updatedAt = excluded.updatedAt
    `).run({
      ...policy,
      allowedActionTypesJson: canonicalJson(policy.allowedActionTypes),
      deniedActionTypesJson: canonicalJson(policy.deniedActionTypes),
      budgetsJson: canonicalJson(policy.budgets),
      targetRestrictionsJson: canonicalJson(policy.targetRestrictions),
      active: policy.active ? 1 : 0,
    });
    return policy;
  }

  recordEvent(event: GovernanceEvent): GovernanceEvent {
    this.db.prepare(`
      INSERT INTO governance_events (id, eventType, policyVersion, inputHash, decisionHash, actor, proposalId, reasonsJson, metadataJson, createdAt)
      VALUES (@id, @eventType, @policyVersion, @inputHash, @decisionHash, @actor, @proposalId, @reasonsJson, @metadataJson, @createdAt)
    `).run({ ...event, reasonsJson: canonicalJson(event.reasons), metadataJson: canonicalJson(event.metadata) });
    return event;
  }

  listEvents(limit = 100): GovernanceEvent[] {
    return (this.db.prepare(`SELECT * FROM governance_events ORDER BY createdAt DESC LIMIT ?`).all(limit) as any[]).map(parseEvent);
  }

  saveAnomaly(anomaly: GovernanceAnomaly): GovernanceAnomaly {
    this.db.prepare(`
      INSERT OR IGNORE INTO governance_anomalies (id, type, severity, proposalId, projectId, description, evidenceJson, detectedAt, status)
      VALUES (@id, @type, @severity, @proposalId, @projectId, @description, @evidenceJson, @detectedAt, @status)
    `).run({ ...anomaly, evidenceJson: canonicalJson(anomaly.evidence) });
    return anomaly;
  }

  listAnomalies(limit = 100): GovernanceAnomaly[] {
    return (this.db.prepare(`SELECT * FROM governance_anomalies ORDER BY detectedAt DESC LIMIT ?`).all(limit) as any[]).map(parseAnomaly);
  }
}

function parseRule(row: any): PolicyRule {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    enabled: Boolean(row.enabled),
    priority: row.priority,
    scope: row.scope,
    actionTypes: readJson(row.actionTypesJson, []),
    projects: readJson(row.projectsJson, []),
    riskClasses: readJson(row.riskClassesJson, []),
    conditions: readJson(row.conditionsJson, {}),
    effect: row.effect,
    approvalLevel: row.approvalLevel,
    maxExecutions: row.maxExecutions,
    timeWindow: row.timeWindow,
    validFrom: row.validFrom,
    validUntil: row.validUntil,
    source: row.source,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    version: row.version,
  };
}

function serializeRule(policySetId: string, item: PolicyRule): Record<string, unknown> {
  return {
    ...item,
    policySetId,
    enabled: item.enabled ? 1 : 0,
    actionTypesJson: canonicalJson(item.actionTypes),
    projectsJson: canonicalJson(item.projects),
    riskClassesJson: canonicalJson(item.riskClasses),
    conditionsJson: canonicalJson(item.conditions),
  };
}

function stableRuleContent(item: PolicyRule): Record<string, unknown> {
  return {
    id: item.id,
    enabled: item.enabled,
    priority: item.priority,
    scope: item.scope,
    actionTypes: item.actionTypes,
    projects: item.projects,
    riskClasses: item.riskClasses,
    conditions: item.conditions,
    effect: item.effect,
    approvalLevel: item.approvalLevel,
    maxExecutions: item.maxExecutions,
    timeWindow: item.timeWindow,
    validFrom: item.validFrom,
    validUntil: item.validUntil,
    source: item.source,
    version: item.version,
  };
}

function serializeDecision(item: PolicyDecision): Record<string, unknown> {
  return {
    ...item,
    reasonsJson: canonicalJson(item.reasons),
    matchedPoliciesJson: canonicalJson(item.matchedPolicies),
    deniedPoliciesJson: canonicalJson(item.deniedPolicies),
    budgetStateJson: canonicalJson(item.budgetState),
    killSwitchStateJson: canonicalJson(item.killSwitchState),
    contextualConstraintsJson: canonicalJson(item.contextualConstraints),
    evidenceReferencesJson: canonicalJson(item.evidenceReferences),
  };
}

function parseDecision(row: any): PolicyDecision {
  return {
    ...row,
    reasons: readJson(row.reasonsJson, []),
    matchedPolicies: readJson(row.matchedPoliciesJson, []),
    deniedPolicies: readJson(row.deniedPoliciesJson, []),
    budgetState: readJson(row.budgetStateJson, {}),
    killSwitchState: readJson(row.killSwitchStateJson, {}),
    contextualConstraints: readJson(row.contextualConstraintsJson, {}),
    evidenceReferences: readJson(row.evidenceReferencesJson, []),
  } as PolicyDecision;
}

function parseBudget(row: any): ActionBudget {
  return { ...row, enabled: Boolean(row.enabled), currentUsage: readJson(row.currentUsageJson, { proposals: 0, approvals: 0, executions: 0, externalTargets: 0 }) } as ActionBudget;
}

function parseKillSwitch(row: any): KillSwitch {
  return { ...row, enabled: Boolean(row.enabled), evidenceReferences: readJson(row.evidenceReferencesJson, []) } as KillSwitch;
}

function parseProjectPolicy(row: any): ProjectActionPolicy {
  return {
    projectId: row.projectId,
    allowedActionTypes: readJson(row.allowedActionTypesJson, []),
    deniedActionTypes: readJson(row.deniedActionTypesJson, []),
    maxRiskClass: row.maxRiskClass,
    budgets: readJson(row.budgetsJson, {}),
    targetRestrictions: readJson(row.targetRestrictionsJson, {}),
    active: Boolean(row.active),
    updatedAt: row.updatedAt,
  };
}

function parseEvent(row: any): GovernanceEvent {
  return { ...row, reasons: readJson(row.reasonsJson, []), metadata: readJson(row.metadataJson, {}) } as GovernanceEvent;
}

function parseAnomaly(row: any): GovernanceAnomaly {
  return { ...row, evidence: readJson(row.evidenceJson, {}) } as GovernanceAnomaly;
}
