import Database from 'better-sqlite3';
import { currentSchemaVersion } from '../../operating/store';
import { canonicalJson, payloadHash } from '../policy';
import type { ActionBudget, PolicyRule, PolicySet } from './types';
import { PHASE5G_POLICY_VERSION, PHASE5G_SCHEMA_VERSION } from './types';

const now = (): string => new Date().toISOString();

export function applyPhase5gMigration(db: Database.Database): { from: number; to: number; applied: boolean } {
  const before = currentSchemaVersion(db);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS policy_sets (
        id TEXT PRIMARY KEY,
        version TEXT NOT NULL UNIQUE,
        contentHash TEXT NOT NULL,
        status TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        activatedAt TEXT,
        supersedesId TEXT
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_policy_sets_active ON policy_sets(status) WHERE status = 'ACTIVE';

      CREATE TABLE IF NOT EXISTS policy_rules (
        id TEXT PRIMARY KEY,
        policySetId TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        priority INTEGER NOT NULL,
        scope TEXT NOT NULL,
        actionTypesJson TEXT NOT NULL,
        projectsJson TEXT NOT NULL,
        riskClassesJson TEXT NOT NULL,
        conditionsJson TEXT NOT NULL,
        effect TEXT NOT NULL,
        approvalLevel TEXT NOT NULL,
        maxExecutions INTEGER,
        timeWindow TEXT,
        validFrom TEXT,
        validUntil TEXT,
        source TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        version INTEGER NOT NULL,
        FOREIGN KEY (policySetId) REFERENCES policy_sets(id)
      );
      CREATE INDEX IF NOT EXISTS idx_policy_rules_policy ON policy_rules(policySetId);
      CREATE INDEX IF NOT EXISTS idx_policy_rules_priority ON policy_rules(priority);

      CREATE TABLE IF NOT EXISTS policy_decisions (
        id TEXT PRIMARY KEY,
        proposalId TEXT NOT NULL,
        actionType TEXT NOT NULL,
        projectId TEXT,
        riskClass TEXT NOT NULL,
        decision TEXT NOT NULL,
        requiredApprovalLevel TEXT NOT NULL,
        reasonsJson TEXT NOT NULL,
        matchedPoliciesJson TEXT NOT NULL,
        deniedPoliciesJson TEXT NOT NULL,
        budgetStateJson TEXT NOT NULL,
        killSwitchStateJson TEXT NOT NULL,
        contextualConstraintsJson TEXT NOT NULL,
        evaluatedAt TEXT NOT NULL,
        policyVersion TEXT NOT NULL,
        inputHash TEXT NOT NULL,
        decisionHash TEXT NOT NULL,
        evidenceReferencesJson TEXT NOT NULL,
        UNIQUE(proposalId, inputHash, policyVersion)
      );
      CREATE INDEX IF NOT EXISTS idx_policy_decisions_proposal ON policy_decisions(proposalId);

      CREATE TABLE IF NOT EXISTS action_budgets (
        id TEXT PRIMARY KEY,
        scope TEXT NOT NULL,
        projectId TEXT,
        actionType TEXT,
        period TEXT NOT NULL,
        maxProposals INTEGER NOT NULL,
        maxApprovals INTEGER NOT NULL,
        maxExecutions INTEGER NOT NULL,
        maxExternalTargets INTEGER NOT NULL,
        currentUsageJson TEXT NOT NULL,
        resetsAt TEXT NOT NULL,
        enabled INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_action_budgets_lookup ON action_budgets(actionType, projectId, enabled);

      CREATE TABLE IF NOT EXISTS kill_switches (
        id TEXT PRIMARY KEY,
        scope TEXT NOT NULL,
        projectId TEXT,
        actionType TEXT,
        enabled INTEGER NOT NULL,
        reason TEXT NOT NULL,
        activatedBy TEXT NOT NULL,
        activatedAt TEXT NOT NULL,
        expiresAt TEXT,
        evidenceReferencesJson TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_kill_switches_enabled ON kill_switches(enabled, scope, projectId, actionType);

      CREATE TABLE IF NOT EXISTS governance_anomalies (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        severity TEXT NOT NULL,
        proposalId TEXT,
        projectId TEXT,
        description TEXT NOT NULL,
        evidenceJson TEXT NOT NULL,
        detectedAt TEXT NOT NULL,
        status TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_governance_anomalies_status ON governance_anomalies(status, severity);

      CREATE TABLE IF NOT EXISTS governance_events (
        id TEXT PRIMARY KEY,
        eventType TEXT NOT NULL,
        policyVersion TEXT,
        inputHash TEXT,
        decisionHash TEXT,
        actor TEXT NOT NULL,
        proposalId TEXT,
        reasonsJson TEXT NOT NULL,
        metadataJson TEXT NOT NULL,
        createdAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_governance_events_proposal ON governance_events(proposalId);
      CREATE INDEX IF NOT EXISTS idx_governance_events_type ON governance_events(eventType);

      CREATE TABLE IF NOT EXISTS project_action_policies (
        projectId TEXT PRIMARY KEY,
        allowedActionTypesJson TEXT NOT NULL,
        deniedActionTypesJson TEXT NOT NULL,
        maxRiskClass TEXT NOT NULL,
        budgetsJson TEXT NOT NULL,
        targetRestrictionsJson TEXT NOT NULL,
        active INTEGER NOT NULL,
        updatedAt TEXT NOT NULL
      );
    `);
    seedDefaultPolicySet(db);
    seedDefaultBudgets(db);
    db.prepare(`INSERT OR IGNORE INTO schema_migrations (version, appliedAt) VALUES (?, ?)`).run(PHASE5G_SCHEMA_VERSION, now());
  })();
  return { from: before, to: currentSchemaVersion(db), applied: before < PHASE5G_SCHEMA_VERSION };
}

export function defaultRules(createdAt = now()): PolicyRule[] {
  return [
    rule('global-forbid-disallowed-capabilities', 1000, 'GLOBAL', [], [], [], 'DENY', 'NONE', {
      actionTypes: ['GMAIL_SEND_DRAFT'],
      forbiddenKeywords: ['financial', 'legal', 'credential', 'merge', 'deploy'],
    }, createdAt),
    rule('gmail-draft-standard-approval', 400, 'ACTION_TYPE', ['GMAIL_CREATE_DRAFT'], [], ['R2'], 'REQUIRE_APPROVAL', 'STANDARD', {}, createdAt),
    rule('calendar-proposal-standard-approval', 350, 'ACTION_TYPE', ['CALENDAR_EVENT_PROPOSAL'], [], ['R1'], 'REQUIRE_APPROVAL', 'STANDARD', {}, createdAt),
    rule('calendar-create-strong-approval', 500, 'ACTION_TYPE', ['CALENDAR_CREATE_EVENT'], [], ['R3'], 'REQUIRE_STRONG_APPROVAL', 'STRONG', {}, createdAt),
    rule('local-safe-standard-approval', 250, 'ACTION_TYPE', ['LOCAL_TASK_DRAFT', 'LOCAL_STATE_UPDATE', 'CODING_TASK_APPROVAL'], [], ['R1'], 'REQUIRE_APPROVAL', 'STANDARD', {}, createdAt),
    rule('r4-deny', 900, 'GLOBAL', [], [], ['R4'], 'DENY', 'NONE', {}, createdAt),
  ];
}

export function defaultPolicySet(createdAt = now()): PolicySet {
  const rules = defaultRules(createdAt);
  const contentHash = payloadHash({ version: PHASE5G_POLICY_VERSION, rules: rules.map(stableRuleContent) });
  return {
    id: 'policy-set-phase5g-default-v1',
    version: PHASE5G_POLICY_VERSION,
    contentHash,
    status: 'ACTIVE',
    createdAt,
    activatedAt: createdAt,
    supersedesId: null,
    rules,
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

function seedDefaultPolicySet(db: Database.Database): void {
  const active = db.prepare(`SELECT id FROM policy_sets WHERE status = 'ACTIVE' LIMIT 1`).get();
  if (active) return;
  const set = defaultPolicySet();
  db.prepare(`
    INSERT INTO policy_sets (id, version, contentHash, status, createdAt, activatedAt, supersedesId)
    VALUES (@id, @version, @contentHash, @status, @createdAt, @activatedAt, @supersedesId)
  `).run(set);
  const insert = db.prepare(`
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
  for (const item of set.rules) {
    insert.run(serializeRule(set.id, item));
  }
}

function seedDefaultBudgets(db: Database.Database): void {
  const count = db.prepare(`SELECT COUNT(*) AS c FROM action_budgets`).get() as { c: number };
  if (count.c > 0) return;
  for (const budget of defaultBudgets()) {
    db.prepare(`
      INSERT INTO action_budgets (
        id, scope, projectId, actionType, period, maxProposals, maxApprovals, maxExecutions,
        maxExternalTargets, currentUsageJson, resetsAt, enabled
      ) VALUES (
        @id, @scope, @projectId, @actionType, @period, @maxProposals, @maxApprovals, @maxExecutions,
        @maxExternalTargets, @currentUsageJson, @resetsAt, @enabled
      )
    `).run({ ...budget, currentUsageJson: JSON.stringify(budget.currentUsage), enabled: budget.enabled ? 1 : 0 });
  }
}

export function defaultBudgets(): ActionBudget[] {
  const resetsAt = new Date(Date.now() + 60 * 60_000).toISOString();
  const usage = { proposals: 0, approvals: 0, executions: 0, externalTargets: 0 };
  return [
    { id: 'budget-gmail-draft-hour', scope: 'ACTION_TYPE', projectId: null, actionType: 'GMAIL_CREATE_DRAFT', period: 'HOUR', maxProposals: 20, maxApprovals: 12, maxExecutions: 8, maxExternalTargets: 40, currentUsage: usage, resetsAt, enabled: true },
    { id: 'budget-calendar-create-hour', scope: 'ACTION_TYPE', projectId: null, actionType: 'CALENDAR_CREATE_EVENT', period: 'HOUR', maxProposals: 8, maxApprovals: 4, maxExecutions: 2, maxExternalTargets: 20, currentUsage: usage, resetsAt, enabled: true },
    { id: 'budget-calendar-proposal-hour', scope: 'ACTION_TYPE', projectId: null, actionType: 'CALENDAR_EVENT_PROPOSAL', period: 'HOUR', maxProposals: 20, maxApprovals: 20, maxExecutions: 20, maxExternalTargets: 40, currentUsage: usage, resetsAt, enabled: true },
  ];
}

function rule(
  id: string,
  priority: number,
  scope: PolicyRule['scope'],
  actionTypes: PolicyRule['actionTypes'],
  projects: string[],
  riskClasses: PolicyRule['riskClasses'],
  effect: PolicyRule['effect'],
  approvalLevel: PolicyRule['approvalLevel'],
  conditions: Record<string, unknown>,
  createdAt: string,
): PolicyRule {
  return {
    id,
    name: id.replace(/-/g, ' '),
    description: `Default Phase 5G rule: ${id}`,
    enabled: true,
    priority,
    scope,
    actionTypes,
    projects,
    riskClasses,
    conditions,
    effect,
    approvalLevel,
    maxExecutions: null,
    timeWindow: null,
    validFrom: null,
    validUntil: null,
    source: 'phase5g-default',
    createdAt,
    updatedAt: createdAt,
    version: 1,
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
