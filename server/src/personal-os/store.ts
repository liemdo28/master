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
  if (!/^[a-z]+-[0-9a-f-]{36}$/i.test(id)) throw new Error(`invalid ${label}`);
}

function rejectSecret(value: string): void {
  if (/(BEGIN (RSA|OPENSSH|PRIVATE) KEY|sk-[A-Za-z0-9]{20,}|password\s*=|token\s*=|api[_-]?key\s*=)/i.test(value)) {
    throw new Error('secret-like content is not allowed in personal memory');
  }
}

export class PersonalOsStore {
  private db: Database.Database;

  constructor(readonly root = dataDir()) {
    fs.mkdirSync(root, { recursive: true });
    this.db = new Database(path.join(root, 'personal-os.db'));
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
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
        projectIds TEXT NOT NULL,
        parentGoalId TEXT,
        successCriteria TEXT NOT NULL,
        constraints TEXT NOT NULL,
        approvalPolicy TEXT NOT NULL,
        planJson TEXT,
        childTaskIds TEXT NOT NULL DEFAULT '[]',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

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
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS daily_briefs (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        generatedAt TEXT NOT NULL,
        payloadJson TEXT NOT NULL
      );
    `);
  }

  close(): void {
    this.db.close();
  }

  createPreference(input: {
    category: string; key: string; value: string; confidence?: number;
    source?: UserPreference['source']; scope?: string; provenance?: string;
  }): UserPreference {
    const source = input.source ?? 'USER_STATED';
    const status: PreferenceStatus = source === 'MODEL_INFERRED' ? 'NEEDS_CONFIRMATION' : 'ACTIVE';
    for (const value of [input.category, input.key, input.value, input.provenance ?? '']) rejectSecret(String(value));
    const record: UserPreference = {
      id: `pref-${randomUUID()}`,
      category: input.category.trim(),
      key: input.key.trim(),
      value: input.value.trim(),
      confidence: Math.max(0, Math.min(1, input.confidence ?? (source === 'MODEL_INFERRED' ? 0.45 : 1))),
      source,
      scope: input.scope?.trim() || 'global',
      createdAt: now(),
      updatedAt: now(),
      lastConfirmedAt: source === 'MODEL_INFERRED' ? null : now(),
      status,
      provenance: input.provenance?.trim() || 'user request',
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
    assertId(id, 'preference id');
    const current = this.getPreference(id);
    if (!current) throw new Error('preference not found');
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
    rejectSecret(input.title);
    const record: Goal = {
      id: `goal-${randomUUID()}`,
      title: input.title.trim(),
      description: input.description?.trim() || input.title.trim(),
      category: input.category?.trim() || 'personal-os',
      priority: Math.max(1, Math.min(5, input.priority ?? 3)),
      status: 'DRAFT',
      targetDate: input.targetDate ?? null,
      projectIds: input.projectIds ?? [],
      parentGoalId: input.parentGoalId ?? null,
      successCriteria: input.successCriteria ?? [],
      constraints: input.constraints ?? [],
      approvalPolicy: input.approvalPolicy ?? 'approval-required',
      createdAt: now(),
      updatedAt: now(),
    };
    this.db.prepare(`
      INSERT INTO goals (id,title,description,category,priority,status,targetDate,projectIds,parentGoalId,successCriteria,constraints,approvalPolicy,createdAt,updatedAt)
      VALUES (@id,@title,@description,@category,@priority,@status,@targetDate,@projectIds,@parentGoalId,@successCriteria,@constraints,@approvalPolicy,@createdAt,@updatedAt)
    `).run(serializeGoal(record));
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
    goal.status = status;
    goal.updatedAt = now();
    this.db.prepare(`UPDATE goals SET status = ?, updatedAt = ? WHERE id = ?`).run(goal.status, goal.updatedAt, id);
    return goal;
  }

  saveGoalPlan(goalId: string, plan: GoalPlan, childTaskIds: string[]): void {
    assertId(goalId, 'goal id');
    this.db.prepare(`UPDATE goals SET planJson = ?, childTaskIds = ?, updatedAt = ? WHERE id = ?`)
      .run(JSON.stringify(plan), JSON.stringify(childTaskIds), now(), goalId);
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
    const row = date
      ? this.db.prepare(`SELECT payloadJson FROM daily_briefs WHERE date = ? ORDER BY generatedAt DESC LIMIT 1`).get(date) as { payloadJson: string } | undefined
      : this.db.prepare(`SELECT payloadJson FROM daily_briefs ORDER BY generatedAt DESC LIMIT 1`).get() as { payloadJson: string } | undefined;
    return row ? JSON.parse(row.payloadJson) as DailyBrief : null;
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
