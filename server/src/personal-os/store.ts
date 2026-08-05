import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import Database from 'better-sqlite3';
import type { DailyBrief, Goal, GoalPlan, GoalStatus, PreferenceStatus, PriorityItem, UserPreference } from './types';

function dataDir(): string {
  return process.env.MI_PERSONAL_OS_DIR
    ? path.resolve(process.env.MI_PERSONAL_OS_DIR)
    : path.resolve(process.cwd(), '.local-agent-global', 'personal-os');
}

function now(): string {
  return new Date().toISOString();
}

function readJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function assertId(id: string, label = 'id'): void {
  if (!/^(pref|goal|priority|brief|plan)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error(`invalid ${label}`);
}

function rejectSecret(value: string): void {
  if (/(BEGIN (RSA|OPENSSH|PRIVATE) KEY|bearer\s+[A-Za-z0-9._-]{20,}|sk-[A-Za-z0-9]{20,}|password\s*=|token\s*=|api[_-]?key\s*=|postgres:\/\/|mysql:\/\/|mongodb(\+srv)?:\/\/|\.env\s*(contents|file)?)/i.test(value)) {
    throw new Error('secret-like content is not allowed in personal memory');
  }
}

function assertText(value: string, label: string, max: number): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required`);
  if (value.length > max) throw new Error(`${label} is too long`);
  rejectSecret(value);
  return value.trim();
}

function assertArray(values: unknown, label: string, maxItems: number, maxText: number): string[] {
  if (values == null) return [];
  if (!Array.isArray(values)) throw new Error(`${label} must be an array`);
  if (values.length > maxItems) throw new Error(`${label} has too many items`);
  return values.map((value, index) => assertText(String(value), `${label}[${index}]`, maxText));
}

export function assertPlainPayload(input: unknown): void {
  if (!input || typeof input !== 'object') return;
  const stack = [input as Record<string, unknown>];
  while (stack.length) {
    const current = stack.pop()!;
    for (const key of Object.keys(current)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        throw new Error('prototype pollution keys are not allowed');
      }
      const value = current[key];
      if (value && typeof value === 'object') stack.push(value as Record<string, unknown>);
    }
  }
}

export class PersonalOsStore {
  private db: Database.Database;

  constructor(readonly root = dataDir()) {
    fs.mkdirSync(root, { recursive: true });
    this.db = new Database(path.join(root, 'personal-os.db'));
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        appliedAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS preferences (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        confidence REAL NOT NULL,
        source TEXT NOT NULL,
        scope TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        lastConfirmedAt TEXT,
        status TEXT NOT NULL,
        provenance TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_preferences_active_key
        ON preferences(category, key, scope)
        WHERE status = 'ACTIVE';

      CREATE TABLE IF NOT EXISTS goals (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        priority INTEGER NOT NULL,
        status TEXT NOT NULL,
        targetDate TEXT,
        completedAt TEXT,
        projectIds TEXT NOT NULL,
        parentGoalId TEXT,
        successCriteria TEXT NOT NULL,
        constraints TEXT NOT NULL,
        approvalPolicy TEXT NOT NULL,
        planJson TEXT,
        planVersion INTEGER NOT NULL DEFAULT 0,
        childTaskIds TEXT NOT NULL DEFAULT '[]',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);
      CREATE INDEX IF NOT EXISTS idx_goals_parent ON goals(parentGoalId);

      CREATE TABLE IF NOT EXISTS goal_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        goalId TEXT NOT NULL,
        type TEXT NOT NULL,
        detail TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (goalId) REFERENCES goals(id)
      );
      CREATE INDEX IF NOT EXISTS idx_goal_events_goal ON goal_events(goalId);

      CREATE TABLE IF NOT EXISTS priority_items (
        id TEXT PRIMARY KEY,
        goalId TEXT NOT NULL,
        taskId TEXT,
        reason TEXT NOT NULL,
        urgency INTEGER NOT NULL,
        importance INTEGER NOT NULL,
        dueAt TEXT,
        status TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (goalId) REFERENCES goals(id)
      );
      CREATE INDEX IF NOT EXISTS idx_priority_goal ON priority_items(goalId);
      CREATE INDEX IF NOT EXISTS idx_priority_status ON priority_items(status);

      CREATE TABLE IF NOT EXISTS daily_briefs (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        generatedAt TEXT NOT NULL,
        payloadJson TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_briefs_date ON daily_briefs(date);

      CREATE TABLE IF NOT EXISTS plan_operations (
        id TEXT PRIMARY KEY,
        goalId TEXT NOT NULL,
        status TEXT NOT NULL,
        childTaskIds TEXT NOT NULL DEFAULT '[]',
        error TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (goalId) REFERENCES goals(id)
      );
      CREATE INDEX IF NOT EXISTS idx_plan_operations_goal ON plan_operations(goalId);
    `);
    this.ensureColumn('goals', 'completedAt', `TEXT`);
    this.ensureColumn('goals', 'planVersion', `INTEGER NOT NULL DEFAULT 0`);
    this.db.prepare(`INSERT OR IGNORE INTO schema_migrations (version, appliedAt) VALUES (1, ?)`).run(now());
  }

  close(): void {
    this.db.close();
  }

  runInTransaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  createPreference(input: {
    category: string; key: string; value: string; confidence?: number;
    source?: UserPreference['source']; scope?: string; provenance?: string;
  }): UserPreference {
    assertPlainPayload(input);
    const source = input.source ?? 'USER_STATED';
    if (!['USER_STATED', 'MODEL_INFERRED', 'SYSTEM'].includes(source)) throw new Error('invalid preference source');
    const status: PreferenceStatus = source === 'MODEL_INFERRED' ? 'NEEDS_CONFIRMATION' : 'ACTIVE';
    const category = assertText(input.category, 'category', 80);
    const key = assertText(input.key, 'key', 120);
    const value = assertText(input.value, 'value', 2000);
    const scope = assertText(input.scope || 'global', 'scope', 120);
    const provenance = assertText(input.provenance || 'user request', 'provenance', 1000);
    const existing = this.db.prepare(`SELECT * FROM preferences WHERE category = ? AND key = ? AND scope = ? AND status = 'ACTIVE'`)
      .get(category, key, scope) as UserPreference | undefined;
    if (existing && source === 'MODEL_INFERRED') {
      throw new Error('inferred preference cannot override an active explicit preference');
    }
    if (existing && source !== 'MODEL_INFERRED') {
      this.updatePreference(existing.id, { status: 'SUPERSEDED', provenance: `superseded by a newer explicit preference` });
    }
    const record: UserPreference = {
      id: `pref-${randomUUID()}`,
      category,
      key,
      value,
      confidence: Math.max(0, Math.min(1, input.confidence ?? (source === 'MODEL_INFERRED' ? 0.45 : 1))),
      source,
      scope,
      createdAt: now(),
      updatedAt: now(),
      lastConfirmedAt: source === 'MODEL_INFERRED' ? null : now(),
      status,
      provenance,
    };
    this.db.prepare(`
      INSERT INTO preferences (id, category, key, value, confidence, source, scope, createdAt, updatedAt, lastConfirmedAt, status, provenance)
      VALUES (@id, @category, @key, @value, @confidence, @source, @scope, @createdAt, @updatedAt, @lastConfirmedAt, @status, @provenance)
    `).run(record);
    return record;
  }

  listPreferences(includeDeleted = false): UserPreference[] {
    const sql = includeDeleted
      ? `SELECT * FROM preferences ORDER BY updatedAt DESC`
      : `SELECT * FROM preferences WHERE status != 'DELETED' ORDER BY updatedAt DESC`;
    return this.db.prepare(sql).all() as UserPreference[];
  }

  updatePreference(id: string, patch: Partial<Pick<UserPreference, 'value' | 'confidence' | 'status' | 'provenance'>>): UserPreference {
    assertPlainPayload(patch);
    assertId(id, 'preference id');
    const current = this.getPreference(id);
    if (!current) throw new Error('preference not found');
    if (patch.status && !['ACTIVE', 'NEEDS_CONFIRMATION', 'SUPERSEDED', 'DELETED'].includes(patch.status)) throw new Error('invalid preference status');
    if (patch.value) rejectSecret(patch.value);
    const updated = {
      ...current,
      value: patch.value ?? current.value,
      confidence: patch.confidence ?? current.confidence,
      status: patch.status ?? current.status,
      provenance: patch.provenance ?? current.provenance,
      updatedAt: now(),
      lastConfirmedAt: patch.status === 'ACTIVE' ? now() : current.lastConfirmedAt,
    };
    this.db.prepare(`
      UPDATE preferences SET value=@value, confidence=@confidence, status=@status, provenance=@provenance,
        updatedAt=@updatedAt, lastConfirmedAt=@lastConfirmedAt WHERE id=@id
    `).run(updated);
    return updated;
  }

  deletePreference(id: string): UserPreference {
    return this.updatePreference(id, { status: 'DELETED' });
  }

  getPreference(id: string): UserPreference | null {
    assertId(id, 'preference id');
    return (this.db.prepare(`SELECT * FROM preferences WHERE id = ?`).get(id) as UserPreference | undefined) ?? null;
  }

  createGoal(input: {
    title: string; description?: string; category?: string; priority?: number; targetDate?: string | null;
    projectIds?: string[]; parentGoalId?: string | null; successCriteria?: string[]; constraints?: string[];
    approvalPolicy?: Goal['approvalPolicy'];
  }): Goal {
    assertPlainPayload(input);
    const title = assertText(input.title, 'title', 240);
    const description = assertText(input.description || input.title, 'description', 2000);
    const category = assertText(input.category || 'personal-os', 'category', 80);
    const projectIds = assertArray(input.projectIds, 'projectIds', 5, 120);
    const successCriteria = assertArray(input.successCriteria, 'successCriteria', 10, 300);
    const constraints = assertArray(input.constraints, 'constraints', 10, 300);
    if (input.targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.targetDate)) throw new Error('targetDate must be YYYY-MM-DD');
    if (input.approvalPolicy && !['approval-required', 'manual-only'].includes(input.approvalPolicy)) throw new Error('invalid approvalPolicy');
    const record: Goal = {
      id: `goal-${randomUUID()}`,
      title,
      description,
      category,
      priority: Math.max(1, Math.min(5, input.priority ?? 3)),
      status: 'DRAFT',
      targetDate: input.targetDate ?? null,
      completedAt: null,
      projectIds,
      parentGoalId: input.parentGoalId ?? null,
      successCriteria,
      constraints,
      approvalPolicy: input.approvalPolicy ?? 'approval-required',
      createdAt: now(),
      updatedAt: now(),
    };
    this.runInTransaction(() => {
      this.db.prepare(`
        INSERT INTO goals (id,title,description,category,priority,status,targetDate,completedAt,projectIds,parentGoalId,successCriteria,constraints,approvalPolicy,createdAt,updatedAt)
        VALUES (@id,@title,@description,@category,@priority,@status,@targetDate,@completedAt,@projectIds,@parentGoalId,@successCriteria,@constraints,@approvalPolicy,@createdAt,@updatedAt)
      `).run(serializeGoal(record));
      this.appendGoalEvent(record.id, 'goal.created', { title: record.title, projectIds: record.projectIds });
    });
    return record;
  }

  listGoals(): Goal[] {
    return (this.db.prepare(`SELECT * FROM goals ORDER BY updatedAt DESC`).all() as any[]).map(parseGoal);
  }

  getGoal(id: string): Goal | null {
    assertId(id, 'goal id');
    const row = this.db.prepare(`SELECT * FROM goals WHERE id = ?`).get(id) as any;
    return row ? parseGoal(row) : null;
  }

  updateGoalStatus(id: string, status: GoalStatus): Goal {
    if (!['DRAFT', 'ACTIVE', 'PAUSED', 'BLOCKED', 'COMPLETED', 'CANCELLED'].includes(status)) throw new Error('invalid goal status');
    const goal = this.getGoal(id);
    if (!goal) throw new Error('goal not found');
    const allowed: Record<GoalStatus, GoalStatus[]> = {
      DRAFT: ['ACTIVE', 'CANCELLED'],
      ACTIVE: ['PAUSED', 'BLOCKED', 'COMPLETED', 'CANCELLED'],
      PAUSED: ['ACTIVE', 'CANCELLED'],
      BLOCKED: ['ACTIVE', 'CANCELLED'],
      COMPLETED: [],
      CANCELLED: [],
    };
    if (!allowed[goal.status].includes(status)) throw new Error(`invalid goal transition ${goal.status} -> ${status}`);
    const previous = goal.status;
    goal.status = status;
    goal.updatedAt = now();
    goal.completedAt = ['COMPLETED', 'CANCELLED'].includes(status) ? goal.updatedAt : goal.completedAt;
    this.runInTransaction(() => {
      this.db.prepare(`UPDATE goals SET status = ?, completedAt = ?, updatedAt = ? WHERE id = ?`).run(goal.status, goal.completedAt, goal.updatedAt, id);
      this.appendGoalEvent(goal.id, 'goal.status_changed', { from: previous, to: status });
    });
    return goal;
  }

  saveGoalPlan(goalId: string, plan: GoalPlan, childTaskIds: string[]): void {
    assertId(goalId, 'goal id');
    this.runInTransaction(() => {
      this.db.prepare(`UPDATE goals SET planJson = ?, planVersion = ?, childTaskIds = ?, updatedAt = ? WHERE id = ?`)
        .run(JSON.stringify(plan), plan.version, JSON.stringify(childTaskIds), now(), goalId);
      this.appendGoalEvent(goalId, 'goal.plan_saved', { planId: plan.planId, version: plan.version, childTaskIds });
    });
  }

  getGoalPlan(goalId: string): { plan: GoalPlan | null; childTaskIds: string[] } {
    assertId(goalId, 'goal id');
    const row = this.db.prepare(`SELECT planJson, childTaskIds FROM goals WHERE id = ?`).get(goalId) as { planJson: string | null; childTaskIds: string } | undefined;
    if (!row) throw new Error('goal not found');
    return { plan: readJson<GoalPlan | null>(row.planJson, null), childTaskIds: readJson<string[]>(row.childTaskIds, []) };
  }

  createPriority(input: Omit<PriorityItem, 'id' | 'createdAt' | 'updatedAt'>): PriorityItem {
    const item: PriorityItem = { id: `priority-${randomUUID()}`, createdAt: now(), updatedAt: now(), ...input };
    this.db.prepare(`
      INSERT INTO priority_items (id, goalId, taskId, reason, urgency, importance, dueAt, status, createdAt, updatedAt)
      VALUES (@id, @goalId, @taskId, @reason, @urgency, @importance, @dueAt, @status, @createdAt, @updatedAt)
    `).run(item);
    return item;
  }

  listPriorities(goalId?: string): PriorityItem[] {
    if (goalId) return this.db.prepare(`SELECT * FROM priority_items WHERE goalId = ? ORDER BY importance DESC, urgency DESC`).all(goalId) as PriorityItem[];
    return this.db.prepare(`SELECT * FROM priority_items ORDER BY updatedAt DESC`).all() as PriorityItem[];
  }

  saveDailyBrief(brief: DailyBrief): DailyBrief {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(brief.date)) throw new Error('invalid brief date');
    this.db.prepare(`INSERT INTO daily_briefs (id, date, generatedAt, payloadJson) VALUES (?, ?, ?, ?)`)
      .run(brief.id, brief.date, brief.generatedAt, JSON.stringify(brief));
    return brief;
  }

  getDailyBrief(id: string): DailyBrief | null {
    assertId(id, 'brief id');
    const row = this.db.prepare(`SELECT payloadJson FROM daily_briefs WHERE id = ?`).get(id) as { payloadJson: string } | undefined;
    return row ? JSON.parse(row.payloadJson) as DailyBrief : null;
  }

  latestDailyBrief(date?: string): DailyBrief | null {
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('invalid brief date');
    const row = date
      ? this.db.prepare(`SELECT payloadJson FROM daily_briefs WHERE date = ? ORDER BY generatedAt DESC LIMIT 1`).get(date) as { payloadJson: string } | undefined
      : this.db.prepare(`SELECT payloadJson FROM daily_briefs ORDER BY generatedAt DESC LIMIT 1`).get() as { payloadJson: string } | undefined;
    return row ? JSON.parse(row.payloadJson) as DailyBrief : null;
  }

  existingPlan(goalId: string): { plan: GoalPlan | null; childTaskIds: string[] } {
    return this.getGoalPlan(goalId);
  }

  startPlanOperation(goalId: string): string {
    const id = `plan-${randomUUID()}`;
    const ts = now();
    this.db.prepare(`INSERT INTO plan_operations (id, goalId, status, childTaskIds, createdAt, updatedAt) VALUES (?, ?, 'STAGING', '[]', ?, ?)`)
      .run(id, goalId, ts, ts);
    return id;
  }

  updatePlanOperation(id: string, status: 'STAGING' | 'COMPLETED' | 'FAILED', childTaskIds: string[], error: string | null = null): void {
    assertId(id, 'plan operation id');
    this.db.prepare(`UPDATE plan_operations SET status = ?, childTaskIds = ?, error = ?, updatedAt = ? WHERE id = ?`)
      .run(status, JSON.stringify(childTaskIds), error, now(), id);
  }

  appendGoalEvent(goalId: string, type: string, detail: unknown): void {
    this.db.prepare(`INSERT INTO goal_events (goalId, type, detail, createdAt) VALUES (?, ?, ?, ?)`)
      .run(goalId, type, JSON.stringify(detail ?? {}), now());
  }

  listGoalEvents(goalId: string): Array<{ id: number; goalId: string; type: string; detail: string; createdAt: string }> {
    return this.db.prepare(`SELECT * FROM goal_events WHERE goalId = ? ORDER BY id ASC`).all(goalId) as Array<{ id: number; goalId: string; type: string; detail: string; createdAt: string }>;
  }

  integrity(): { integrityCheck: string; foreignKeyViolations: unknown[]; schemaVersion: number } {
    const integrity = this.db.prepare(`PRAGMA integrity_check`).get() as Record<string, string>;
    const foreignKeyViolations = this.db.prepare(`PRAGMA foreign_key_check`).all();
    const row = this.db.prepare(`SELECT MAX(version) AS version FROM schema_migrations`).get() as { version: number | null };
    return { integrityCheck: Object.values(integrity)[0], foreignKeyViolations, schemaVersion: row.version ?? 0 };
  }

  private ensureColumn(table: string, column: string, definition: string): void {
    const columns = this.db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!columns.some(item => item.name === column)) {
      this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }
}

function serializeGoal(goal: Goal): Record<string, unknown> {
  return { ...goal, projectIds: JSON.stringify(goal.projectIds), successCriteria: JSON.stringify(goal.successCriteria), constraints: JSON.stringify(goal.constraints) };
}

function parseGoal(row: any): Goal {
  return {
    ...row,
    projectIds: readJson<string[]>(row.projectIds, []),
    successCriteria: readJson<string[]>(row.successCriteria, []),
    constraints: readJson<string[]>(row.constraints, []),
  } as Goal;
}
