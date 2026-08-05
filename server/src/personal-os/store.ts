import * as fs from 'fs';
import * as path from 'path';
import { createHash, randomUUID } from 'crypto';
import Database from 'better-sqlite3';
import type {
  DailyBrief, Goal, GoalPlan, GoalStatus, KnowledgeKind, KnowledgeRecord, KnowledgeSearchInput,
  KnowledgeSearchResult, KnowledgeSensitivity, KnowledgeSourceType, KnowledgeStatus, MemoryPack,
  MemoryPolicy, PreferenceStatus, PriorityItem, UserPreference
} from './types';

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
  if (!/^(pref|goal|priority|brief|plan|knowledge|memorypack)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error(`invalid ${label}`);
}

function rejectSecret(value: string): void {
  if (/(BEGIN (RSA|OPENSSH|PRIVATE) KEY|bearer\s+[A-Za-z0-9._-]{20,}|sk-[A-Za-z0-9]{20,}|password\s*=|token\s*=|api[_-]?key\s*=|postgres:\/\/|mysql:\/\/|mongodb(\+srv)?:\/\/|\.env\s*(contents|file)?)/i.test(value)) {
    throw new Error('secret-like content is not allowed in personal memory');
  }
}

function sanitizeKnowledgeText(value: string): string {
  return value
    .replace(/ignore previous instructions|system prompt|developer message/gi, '[untrusted-instruction]')
    .replace(/BEGIN (RSA|OPENSSH|PRIVATE) KEY[\s\S]*?END \1 KEY/gi, '[REDACTED_SECRET]')
    .replace(/bearer\s+[A-Za-z0-9._-]{20,}/gi, 'bearer [REDACTED_SECRET]')
    .replace(/(password|token|api[_-]?key)\s*=\s*\S+/gi, '$1=[REDACTED_SECRET]')
    .replace(/(postgres|mysql|mongodb(\+srv)?):\/\/\S+/gi, '[REDACTED_CONNECTION_STRING]');
}

function hashContent(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
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

function assertEnum<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) throw new Error(`invalid ${label}`);
  return value as T;
}

function assertOptionalDate(value: unknown, label: string): string | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label} must be YYYY-MM-DD`);
  return value;
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

      CREATE TABLE IF NOT EXISTS knowledge_records (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        content TEXT NOT NULL,
        scope TEXT NOT NULL,
        projectIds TEXT NOT NULL,
        goalIds TEXT NOT NULL,
        taskIds TEXT NOT NULL,
        tags TEXT NOT NULL,
        sourceType TEXT NOT NULL,
        provenance TEXT NOT NULL,
        confidence REAL NOT NULL,
        sensitivity TEXT NOT NULL,
        status TEXT NOT NULL,
        validFrom TEXT,
        validUntil TEXT,
        lastConfirmedAt TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        supersedesId TEXT,
        evidenceReferences TEXT NOT NULL,
        contentHash TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_knowledge_status ON knowledge_records(status);
      CREATE INDEX IF NOT EXISTS idx_knowledge_kind ON knowledge_records(kind);
      CREATE INDEX IF NOT EXISTS idx_knowledge_hash ON knowledge_records(contentHash);
      CREATE INDEX IF NOT EXISTS idx_knowledge_updated ON knowledge_records(updatedAt);
    `);
    this.ensureColumn('goals', 'completedAt', `TEXT`);
    this.ensureColumn('goals', 'planVersion', `INTEGER NOT NULL DEFAULT 0`);
    this.db.prepare(`INSERT OR IGNORE INTO schema_migrations (version, appliedAt) VALUES (1, ?)`).run(now());
    this.db.prepare(`INSERT OR IGNORE INTO schema_migrations (version, appliedAt) VALUES (2, ?)`).run(now());
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

  createKnowledge(input: Partial<KnowledgeRecord> & {
    kind: KnowledgeKind; title: string; summary: string; content: string; provenance: string; sourceType?: KnowledgeSourceType;
  }): KnowledgeRecord {
    assertPlainPayload(input);
    const kind = assertEnum(input.kind, KNOWLEDGE_KINDS, 'knowledge kind');
    const sourceType = assertEnum(input.sourceType ?? 'USER_STATEMENT', KNOWLEDGE_SOURCE_TYPES, 'knowledge sourceType');
    const status = assertEnum(input.status ?? (sourceType === 'INFERRED' ? 'NEEDS_CONFIRMATION' : 'ACTIVE'), KNOWLEDGE_STATUSES, 'knowledge status');
    const sensitivity = classifySensitivity(`${input.title}\n${input.summary}\n${input.content}\n${input.provenance}`);
    if (sensitivity === 'SECRET_REJECTED') throw new Error('secret-like content is not allowed in knowledge');
    const record: KnowledgeRecord = {
      id: `knowledge-${randomUUID()}`,
      kind,
      title: sanitizeKnowledgeText(assertText(input.title, 'title', 240)),
      summary: sanitizeKnowledgeText(assertText(input.summary, 'summary', 1000)),
      content: sanitizeKnowledgeText(assertText(input.content, 'content', 5000)),
      scope: assertEnum(input.scope ?? 'PERSONAL_AND_PROJECT', MEMORY_POLICIES, 'knowledge scope'),
      projectIds: assertArray(input.projectIds, 'projectIds', 10, 120),
      goalIds: assertArray(input.goalIds, 'goalIds', 10, 120),
      taskIds: assertArray(input.taskIds, 'taskIds', 20, 120),
      tags: assertArray(input.tags, 'tags', 20, 80).map(tag => tag.toLowerCase()),
      sourceType,
      provenance: sanitizeKnowledgeText(assertText(input.provenance, 'provenance', 1000)),
      confidence: Math.max(0, Math.min(1, input.confidence ?? (status === 'NEEDS_CONFIRMATION' ? 0.45 : 1))),
      sensitivity,
      status,
      validFrom: assertOptionalDate(input.validFrom, 'validFrom'),
      validUntil: assertOptionalDate(input.validUntil, 'validUntil'),
      lastConfirmedAt: status === 'ACTIVE' ? (input.lastConfirmedAt ?? now()) : null,
      createdAt: now(),
      updatedAt: now(),
      supersedesId: input.supersedesId ?? null,
      evidenceReferences: assertArray(input.evidenceReferences, 'evidenceReferences', 20, 200),
      contentHash: '',
    };
    record.contentHash = hashContent({
      kind: record.kind, title: record.title, summary: record.summary, content: record.content,
      scope: record.scope, projectIds: record.projectIds, goalIds: record.goalIds, taskIds: record.taskIds,
    });
    const existing = this.db.prepare(`SELECT * FROM knowledge_records WHERE contentHash = ? AND status != 'DELETED' LIMIT 1`)
      .get(record.contentHash) as any;
    if (existing) return parseKnowledge(existing);
    this.db.prepare(`
      INSERT INTO knowledge_records (
        id, kind, title, summary, content, scope, projectIds, goalIds, taskIds, tags, sourceType,
        provenance, confidence, sensitivity, status, validFrom, validUntil, lastConfirmedAt,
        createdAt, updatedAt, supersedesId, evidenceReferences, contentHash
      ) VALUES (
        @id, @kind, @title, @summary, @content, @scope, @projectIds, @goalIds, @taskIds, @tags, @sourceType,
        @provenance, @confidence, @sensitivity, @status, @validFrom, @validUntil, @lastConfirmedAt,
        @createdAt, @updatedAt, @supersedesId, @evidenceReferences, @contentHash
      )
    `).run(serializeKnowledge(record));
    return record;
  }

  getKnowledge(id: string): KnowledgeRecord | null {
    assertId(id, 'knowledge id');
    const row = this.db.prepare(`SELECT * FROM knowledge_records WHERE id = ?`).get(id) as any;
    return row ? parseKnowledge(row) : null;
  }

  listKnowledge(includeInactive = false): KnowledgeRecord[] {
    const rows = includeInactive
      ? this.db.prepare(`SELECT * FROM knowledge_records ORDER BY updatedAt DESC`).all() as any[]
      : this.db.prepare(`SELECT * FROM knowledge_records WHERE status IN ('ACTIVE', 'NEEDS_CONFIRMATION') ORDER BY updatedAt DESC`).all() as any[];
    return rows.map(parseKnowledge);
  }

  updateKnowledge(id: string, patch: Partial<KnowledgeRecord>): KnowledgeRecord {
    assertPlainPayload(patch);
    const current = this.getKnowledge(id);
    if (!current) throw new Error('knowledge not found');
    const updated: KnowledgeRecord = {
      ...current,
      kind: patch.kind ? assertEnum(patch.kind, KNOWLEDGE_KINDS, 'knowledge kind') : current.kind,
      title: patch.title ? sanitizeKnowledgeText(assertText(patch.title, 'title', 240)) : current.title,
      summary: patch.summary ? sanitizeKnowledgeText(assertText(patch.summary, 'summary', 1000)) : current.summary,
      content: patch.content ? sanitizeKnowledgeText(assertText(patch.content, 'content', 5000)) : current.content,
      scope: patch.scope ? assertEnum(patch.scope, MEMORY_POLICIES, 'knowledge scope') : current.scope,
      projectIds: patch.projectIds ? assertArray(patch.projectIds, 'projectIds', 10, 120) : current.projectIds,
      goalIds: patch.goalIds ? assertArray(patch.goalIds, 'goalIds', 10, 120) : current.goalIds,
      taskIds: patch.taskIds ? assertArray(patch.taskIds, 'taskIds', 20, 120) : current.taskIds,
      tags: patch.tags ? assertArray(patch.tags, 'tags', 20, 80).map(tag => tag.toLowerCase()) : current.tags,
      sourceType: patch.sourceType ? assertEnum(patch.sourceType, KNOWLEDGE_SOURCE_TYPES, 'knowledge sourceType') : current.sourceType,
      provenance: patch.provenance ? sanitizeKnowledgeText(assertText(patch.provenance, 'provenance', 1000)) : current.provenance,
      confidence: patch.confidence == null ? current.confidence : Math.max(0, Math.min(1, patch.confidence)),
      sensitivity: patch.sensitivity ? assertEnum(patch.sensitivity, KNOWLEDGE_SENSITIVITIES, 'knowledge sensitivity') : current.sensitivity,
      status: patch.status ? assertEnum(patch.status, KNOWLEDGE_STATUSES, 'knowledge status') : current.status,
      validFrom: patch.validFrom !== undefined ? assertOptionalDate(patch.validFrom, 'validFrom') : current.validFrom,
      validUntil: patch.validUntil !== undefined ? assertOptionalDate(patch.validUntil, 'validUntil') : current.validUntil,
      lastConfirmedAt: patch.status === 'ACTIVE' ? now() : current.lastConfirmedAt,
      supersedesId: patch.supersedesId !== undefined ? patch.supersedesId : current.supersedesId,
      evidenceReferences: patch.evidenceReferences ? assertArray(patch.evidenceReferences, 'evidenceReferences', 20, 200) : current.evidenceReferences,
      updatedAt: now(),
      contentHash: current.contentHash,
    };
    if (`${updated.title}${updated.summary}${updated.content}${updated.provenance}` !== `${current.title}${current.summary}${current.content}${current.provenance}`) {
      const sensitivity = classifySensitivity(`${updated.title}\n${updated.summary}\n${updated.content}\n${updated.provenance}`);
      if (sensitivity === 'SECRET_REJECTED') throw new Error('secret-like content is not allowed in knowledge');
      updated.sensitivity = sensitivity;
    }
    updated.contentHash = hashContent({
      kind: updated.kind, title: updated.title, summary: updated.summary, content: updated.content,
      scope: updated.scope, projectIds: updated.projectIds, goalIds: updated.goalIds, taskIds: updated.taskIds,
    });
    this.db.prepare(`
      UPDATE knowledge_records SET kind=@kind, title=@title, summary=@summary, content=@content, scope=@scope,
        projectIds=@projectIds, goalIds=@goalIds, taskIds=@taskIds, tags=@tags, sourceType=@sourceType,
        provenance=@provenance, confidence=@confidence, sensitivity=@sensitivity, status=@status,
        validFrom=@validFrom, validUntil=@validUntil, lastConfirmedAt=@lastConfirmedAt, updatedAt=@updatedAt,
        supersedesId=@supersedesId, evidenceReferences=@evidenceReferences, contentHash=@contentHash
      WHERE id=@id
    `).run(serializeKnowledge(updated));
    return updated;
  }

  deleteKnowledge(id: string): KnowledgeRecord {
    return this.updateKnowledge(id, { status: 'DELETED' });
  }

  confirmKnowledge(id: string): KnowledgeRecord {
    return this.updateKnowledge(id, { status: 'ACTIVE', confidence: 1 });
  }

  supersedeKnowledge(id: string, replacement: Partial<KnowledgeRecord> & { title?: string; summary?: string; content?: string; provenance?: string }): KnowledgeRecord {
    const current = this.getKnowledge(id);
    if (!current) throw new Error('knowledge not found');
    return this.runInTransaction(() => {
      this.updateKnowledge(id, { status: 'SUPERSEDED' });
      return this.createKnowledge({
        kind: replacement.kind ?? current.kind,
        title: replacement.title ?? current.title,
        summary: replacement.summary ?? current.summary,
        content: replacement.content ?? current.content,
        scope: replacement.scope ?? current.scope,
        projectIds: replacement.projectIds ?? current.projectIds,
        goalIds: replacement.goalIds ?? current.goalIds,
        taskIds: replacement.taskIds ?? current.taskIds,
        tags: replacement.tags ?? current.tags,
        sourceType: replacement.sourceType ?? 'USER_STATEMENT',
        provenance: replacement.provenance ?? `supersedes ${id}`,
        confidence: replacement.confidence ?? 1,
        status: replacement.status ?? 'ACTIVE',
        supersedesId: id,
        evidenceReferences: replacement.evidenceReferences ?? current.evidenceReferences,
      });
    });
  }

  searchKnowledge(input: KnowledgeSearchInput): KnowledgeSearchResult[] {
    assertPlainPayload(input);
    const query = assertText(input.query || 'knowledge', 'query', 1000);
    const projectIds = new Set(assertArray(input.projectIds, 'projectIds', 10, 120));
    const goalId = input.goalId || null;
    const taskId = input.taskId || null;
    const maxRecords = Math.max(1, Math.min(20, input.maxRecords ?? 8));
    const maxBytes = Math.max(500, Math.min(20000, input.maxBytes ?? 6000));
    const allowedStatuses = input.includeUnconfirmed ? ['ACTIVE', 'NEEDS_CONFIRMATION'] : ['ACTIVE'];
    const tokens = tokenise(query);
    let usedBytes = 0;
    const candidates = this.listKnowledge(false).filter(record => {
      if (!allowedStatuses.includes(record.status)) return false;
      if (input.kinds?.length && !input.kinds.includes(record.kind)) return false;
      if (record.status === 'EXPIRED' || record.status === 'DELETED' || record.status === 'SUPERSEDED') return false;
      if (input.policy === 'PROJECT_ONLY' && !record.projectIds.length) return false;
      if (input.policy === 'PERSONAL_ONLY' && record.projectIds.length) return false;
      if (projectIds.size && record.projectIds.length && !record.projectIds.some(id => projectIds.has(id))) return false;
      if (goalId && record.goalIds.length && !record.goalIds.includes(goalId)) return false;
      if (taskId && record.taskIds.length && !record.taskIds.includes(taskId)) return false;
      return true;
    }).map(record => scoreKnowledge(record, tokens, projectIds, goalId, taskId))
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score || b.record.updatedAt.localeCompare(a.record.updatedAt));
    const out: KnowledgeSearchResult[] = [];
    for (const result of candidates) {
      const bytes = JSON.stringify(result.record).length;
      if (usedBytes + bytes > maxBytes) continue;
      usedBytes += bytes;
      out.push(result);
      if (out.length >= maxRecords) break;
    }
    return out;
  }

  listKnowledgeConflicts(): Array<{ key: string; records: KnowledgeRecord[] }> {
    const active = this.listKnowledge(false).filter(record => record.status === 'ACTIVE');
    const groups = new Map<string, KnowledgeRecord[]>();
    for (const record of active) {
      const key = `${record.kind}:${record.scope}:${record.projectIds.join(',')}:${record.tags.sort().join(',')}:${record.title.toLowerCase()}`;
      groups.set(key, [...(groups.get(key) ?? []), record]);
    }
    return [...groups.entries()].filter(([, records]) => records.length > 1).map(([key, records]) => ({ key, records }));
  }

  buildMemoryPack(input: KnowledgeSearchInput & { policy?: MemoryPolicy }): MemoryPack {
    const policy = assertEnum(input.policy ?? 'PERSONAL_AND_PROJECT', MEMORY_POLICIES, 'memory policy');
    if (policy === 'NO_MEMORY') {
      return emptyMemoryPack(input.query || '', policy);
    }
    const results = this.searchKnowledge({ ...input, policy, includeUnconfirmed: true, maxRecords: input.maxRecords ?? 12, maxBytes: input.maxBytes ?? 8000 });
    const active = results.map(result => result.record).filter(record => record.status === 'ACTIVE');
    const uncertainRecords = results.map(result => result.record).filter(record => record.status === 'NEEDS_CONFIRMATION');
    const conflicts = this.listKnowledgeConflicts().filter(conflict => conflict.records.some(record => active.some(item => item.id === record.id)));
    return {
      id: `memorypack-${randomUUID()}`,
      policy: uncertainRecords.length && policy !== 'PROJECT_ONLY' ? 'CONFIRMATION_REQUIRED' : policy,
      requestIntent: input.query,
      confirmedPreferences: active.filter(record => record.kind === 'USER_PREFERENCE'),
      relevantUserFacts: active.filter(record => record.kind === 'USER_FACT' || record.kind === 'CONTACT_CONTEXT'),
      relevantProjectConventions: active.filter(record => record.kind === 'PROJECT_CONVENTION' || record.kind === 'WORKFLOW'),
      relevantArchitectureDecisions: active.filter(record => record.kind === 'ARCHITECTURE_DECISION' || record.kind === 'DECISION'),
      previousLessons: active.filter(record => record.kind === 'LESSON_LEARNED'),
      recurringIssues: active.filter(record => record.kind === 'RECURRING_ISSUE'),
      conflicts,
      staleWarnings: results.filter(result => result.stale).map(result => `${result.record.id} may be stale`),
      evidenceReferences: [...new Set(active.flatMap(record => record.evidenceReferences))].slice(0, 20),
      retrievalExplanation: results.map(result => `${result.record.id}: ${result.reasons.join(', ')}`),
      uncertainRecords,
      createdAt: now(),
    };
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

const KNOWLEDGE_KINDS = [
  'USER_FACT', 'USER_PREFERENCE', 'PROJECT_CONVENTION', 'ARCHITECTURE_DECISION', 'WORKFLOW',
  'LESSON_LEARNED', 'RECURRING_ISSUE', 'DECISION', 'CONTACT_CONTEXT', 'REFERENCE', 'SUMMARY',
] as const satisfies readonly KnowledgeKind[];
const KNOWLEDGE_STATUSES = ['ACTIVE', 'NEEDS_CONFIRMATION', 'SUPERSEDED', 'EXPIRED', 'DELETED'] as const satisfies readonly KnowledgeStatus[];
const KNOWLEDGE_SENSITIVITIES = ['PUBLIC', 'INTERNAL', 'PRIVATE', 'SECRET_REJECTED'] as const satisfies readonly KnowledgeSensitivity[];
const KNOWLEDGE_SOURCE_TYPES = ['USER_STATEMENT', 'PREFERENCE', 'TASK_SUMMARY', 'GOAL_OUTCOME', 'PROJECT_DECISION', 'VALIDATION_REVIEW', 'MANUAL_IMPORT', 'INFERRED'] as const satisfies readonly KnowledgeSourceType[];
const MEMORY_POLICIES = ['PERSONAL_ONLY', 'PROJECT_ONLY', 'PERSONAL_AND_PROJECT', 'NO_MEMORY', 'CONFIRMATION_REQUIRED'] as const satisfies readonly MemoryPolicy[];

function classifySensitivity(value: string): KnowledgeSensitivity {
  if (/(BEGIN (RSA|OPENSSH|PRIVATE) KEY|bearer\s+[A-Za-z0-9._-]{20,}|sk-[A-Za-z0-9]{20,}|password\s*=|token\s*=|api[_-]?key\s*=|postgres:\/\/|mysql:\/\/|mongodb(\+srv)?:\/\/|\.env\s*(contents|file)?)/i.test(value)) return 'SECRET_REJECTED';
  if (/\b(private|personal|owner|preference)\b/i.test(value)) return 'PRIVATE';
  if (/\b(project|architecture|workflow|deployment|internal)\b/i.test(value)) return 'INTERNAL';
  return 'PUBLIC';
}

function tokenise(value: string): string[] {
  return [...new Set(value.toLowerCase().split(/[^a-z0-9]+/).filter(part => part.length > 2))];
}

function scoreKnowledge(record: KnowledgeRecord, tokens: string[], projectIds: Set<string>, goalId: string | null, taskId: string | null): KnowledgeSearchResult {
  const haystack = `${record.kind} ${record.title} ${record.summary} ${record.content} ${record.tags.join(' ')}`.toLowerCase();
  const reasons: string[] = [];
  let score = 0;
  for (const token of tokens) {
    if (haystack.includes(token)) { score += 2; reasons.push(`token:${token}`); }
  }
  if (record.tags.some(tag => tokens.includes(tag))) { score += 5; reasons.push('tag'); }
  if (record.projectIds.some(id => projectIds.has(id))) { score += 8; reasons.push('project'); }
  if (goalId && record.goalIds.includes(goalId)) { score += 8; reasons.push('goal'); }
  if (taskId && record.taskIds.includes(taskId)) { score += 8; reasons.push('task'); }
  if (record.status === 'ACTIVE') { score += 3; reasons.push('confirmed'); }
  if (record.status === 'NEEDS_CONFIRMATION') { score += 1; reasons.push('needs-confirmation'); }
  score += Math.round(record.confidence * 3);
  const stale = Boolean(record.validUntil && record.validUntil < new Date().toISOString().slice(0, 10));
  if (stale) { score -= 3; reasons.push('stale'); }
  return { record, score, reasons, stale };
}

function emptyMemoryPack(requestIntent: string, policy: MemoryPolicy): MemoryPack {
  return {
    id: `memorypack-${randomUUID()}`,
    policy,
    requestIntent,
    confirmedPreferences: [],
    relevantUserFacts: [],
    relevantProjectConventions: [],
    relevantArchitectureDecisions: [],
    previousLessons: [],
    recurringIssues: [],
    conflicts: [],
    staleWarnings: [],
    evidenceReferences: [],
    retrievalExplanation: ['memory disabled by policy'],
    uncertainRecords: [],
    createdAt: now(),
  };
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

function serializeKnowledge(record: KnowledgeRecord): Record<string, unknown> {
  return {
    ...record,
    projectIds: JSON.stringify(record.projectIds),
    goalIds: JSON.stringify(record.goalIds),
    taskIds: JSON.stringify(record.taskIds),
    tags: JSON.stringify(record.tags),
    evidenceReferences: JSON.stringify(record.evidenceReferences),
  };
}

function parseKnowledge(row: any): KnowledgeRecord {
  return {
    ...row,
    projectIds: readJson<string[]>(row.projectIds, []),
    goalIds: readJson<string[]>(row.goalIds, []),
    taskIds: readJson<string[]>(row.taskIds, []),
    tags: readJson<string[]>(row.tags, []),
    evidenceReferences: readJson<string[]>(row.evidenceReferences, []),
  } as KnowledgeRecord;
}
