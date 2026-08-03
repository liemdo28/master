// SQLite-backed durable store for the task runtime.
// Mirrors the storage approach already used by task-intelligence/ (better-sqlite3, WAL)
// instead of introducing a new persistence technology — see docs/architecture/COMPONENT_DECISIONS.md.

import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';
import type { TaskRecord, TaskEvent, TaskStatus } from './types';

function resolveDataDir(): string {
  return process.env.MI_TASK_RUNTIME_DIR
    ? path.resolve(process.env.MI_TASK_RUNTIME_DIR)
    : path.resolve(process.cwd(), '.local-agent-global', 'task-runtime');
}

export class TaskStore {
  private db: Database.Database;
  readonly dataDir: string;
  readonly evidenceDir: string;

  constructor(dataDir: string = resolveDataDir()) {
    this.dataDir = dataDir;
    this.evidenceDir = path.join(dataDir, 'evidence');
    fs.mkdirSync(this.dataDir, { recursive: true });
    fs.mkdirSync(this.evidenceDir, { recursive: true });

    this.db = new Database(path.join(this.dataDir, 'tasks.db'));
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        parentTaskId TEXT,
        userRequest TEXT NOT NULL,
        normalizedIntent TEXT,
        taskKind TEXT NOT NULL DEFAULT 'general',
        projectId TEXT,
        mapVersion TEXT,
        contextPackId TEXT,
        repository TEXT,
        workingDirectory TEXT,
        branch TEXT,
        status TEXT NOT NULL,
        riskLevel TEXT NOT NULL,
        approvalState TEXT NOT NULL,
        executionEngine TEXT,
        selectedModel TEXT,
        plan TEXT,
        currentStep INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        completedAt TEXT,
        resultSummary TEXT
      );

      CREATE TABLE IF NOT EXISTS task_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        taskId TEXT NOT NULL,
        type TEXT NOT NULL,
        detail TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (taskId) REFERENCES tasks(id)
      );

      CREATE INDEX IF NOT EXISTS idx_task_events_taskId ON task_events(taskId);
    `);
    this.ensureColumn('tasks', 'taskKind', `TEXT NOT NULL DEFAULT 'general'`);
    this.ensureColumn('tasks', 'mapVersion', `TEXT`);
    this.ensureColumn('tasks', 'contextPackId', `TEXT`);
    for (const column of [
      'baseBranch', 'baseCommit', 'taskBranch', 'worktreePath', 'codingEngine', 'modelRoles',
      'candidateFiles', 'filesRead', 'filesChanged', 'validationPlan', 'validationResults',
      'reviewStatus', 'commitPolicy', 'commitSha', 'rollbackState',
    ]) {
      this.ensureColumn('tasks', column, `TEXT`);
    }
    this.ensureColumn('tasks', 'retryCount', `INTEGER NOT NULL DEFAULT 0`);
    this.ensureColumn('tasks', 'maxRetries', `INTEGER NOT NULL DEFAULT 3`);
  }

  runInTransaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  insertTask(task: TaskRecord): void {
    this.db
      .prepare(
        `INSERT INTO tasks (
          id, parentTaskId, userRequest, normalizedIntent, taskKind, projectId, mapVersion, contextPackId, repository,
          workingDirectory, branch, baseBranch, baseCommit, taskBranch, worktreePath, codingEngine, modelRoles,
          candidateFiles, filesRead, filesChanged, validationPlan, validationResults, retryCount, maxRetries,
          reviewStatus, commitPolicy, commitSha, rollbackState, status, riskLevel, approvalState, executionEngine,
          selectedModel, plan, currentStep, createdAt, updatedAt, completedAt, resultSummary
        ) VALUES (@id, @parentTaskId, @userRequest, @normalizedIntent, @taskKind, @projectId, @mapVersion, @contextPackId, @repository,
          @workingDirectory, @branch, @baseBranch, @baseCommit, @taskBranch, @worktreePath, @codingEngine, @modelRoles,
          @candidateFiles, @filesRead, @filesChanged, @validationPlan, @validationResults, @retryCount, @maxRetries,
          @reviewStatus, @commitPolicy, @commitSha, @rollbackState, @status, @riskLevel, @approvalState, @executionEngine,
          @selectedModel, @plan, @currentStep, @createdAt, @updatedAt, @completedAt, @resultSummary)`
      )
      .run(task);
  }

  updateTask(task: TaskRecord): void {
    this.db
      .prepare(
        `UPDATE tasks SET
          status = @status, approvalState = @approvalState, executionEngine = @executionEngine,
          selectedModel = @selectedModel, plan = @plan, currentStep = @currentStep,
          updatedAt = @updatedAt, completedAt = @completedAt, resultSummary = @resultSummary,
          normalizedIntent = @normalizedIntent,
          baseBranch = @baseBranch, baseCommit = @baseCommit, taskBranch = @taskBranch, worktreePath = @worktreePath,
          codingEngine = @codingEngine, modelRoles = @modelRoles, candidateFiles = @candidateFiles,
          filesRead = @filesRead, filesChanged = @filesChanged, validationPlan = @validationPlan,
          validationResults = @validationResults, retryCount = @retryCount, maxRetries = @maxRetries,
          reviewStatus = @reviewStatus, commitPolicy = @commitPolicy, commitSha = @commitSha,
          rollbackState = @rollbackState
        WHERE id = @id`
      )
      .run(task);
  }

  getTask(id: string): TaskRecord | null {
    const row = this.db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(id) as TaskRecord | undefined;
    return row ?? null;
  }

  listTasks(status?: TaskStatus): TaskRecord[] {
    if (status) {
      return this.db.prepare(`SELECT * FROM tasks WHERE status = ? ORDER BY createdAt DESC`).all(status) as TaskRecord[];
    }
    return this.db.prepare(`SELECT * FROM tasks ORDER BY createdAt DESC`).all() as TaskRecord[];
  }

  appendEvent(taskId: string, type: string, detail: unknown): TaskEvent {
    const createdAt = new Date().toISOString();
    const detailJson = JSON.stringify(detail ?? {});
    const info = this.db
      .prepare(`INSERT INTO task_events (taskId, type, detail, createdAt) VALUES (?, ?, ?, ?)`)
      .run(taskId, type, detailJson, createdAt);
    return { id: Number(info.lastInsertRowid), taskId, type, detail: detailJson, createdAt };
  }

  updateCodingFields(taskId: string, patch: Partial<TaskRecord>): TaskRecord {
    const allowed = new Set<keyof TaskRecord>([
      'baseBranch', 'baseCommit', 'taskBranch', 'worktreePath', 'codingEngine', 'modelRoles',
      'candidateFiles', 'filesRead', 'filesChanged', 'validationPlan', 'validationResults',
      'retryCount', 'maxRetries', 'reviewStatus', 'commitPolicy', 'commitSha', 'rollbackState',
      'executionEngine', 'selectedModel', 'plan', 'currentStep', 'resultSummary',
    ]);
    const keys = Object.keys(patch).filter((key): key is keyof TaskRecord => allowed.has(key as keyof TaskRecord));
    if (!keys.length) return this.getTask(taskId) as TaskRecord;
    const now = new Date().toISOString();
    const assignments = [...keys.map(key => `${key} = @${key}`), 'updatedAt = @updatedAt'].join(', ');
    this.db.prepare(`UPDATE tasks SET ${assignments} WHERE id = @id`).run({ ...patch, id: taskId, updatedAt: now });
    return this.getTask(taskId) as TaskRecord;
  }

  writeEvidence(taskId: string, evidenceId: string, payload: unknown): { relativePath: string; absolutePath: string } {
    if (!/^task-[0-9a-f-]{36}$/i.test(taskId)) throw new Error('invalid task id');
    if (!/^coding-[a-z0-9-]+$/i.test(evidenceId)) throw new Error('invalid coding evidence id');
    const relativePath = path.join(taskId, `${evidenceId}.json`);
    const absolutePath = path.resolve(this.evidenceDir, relativePath);
    const evidenceRoot = path.resolve(this.evidenceDir);
    const rel = path.relative(evidenceRoot, absolutePath);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('invalid evidence path');
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, JSON.stringify(payload, null, 2));
    return { relativePath: relativePath.replace(/\\/g, '/'), absolutePath };
  }

  listEvents(taskId: string): TaskEvent[] {
    return this.db
      .prepare(`SELECT * FROM task_events WHERE taskId = ? ORDER BY id ASC`)
      .all(taskId) as TaskEvent[];
  }

  taskEvidenceDir(taskId: string): string {
    const dir = path.join(this.evidenceDir, taskId);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  evidencePathFor(taskId: string, evidenceId: string): { relativePath: string; absolutePath: string } {
    if (!/^task-[0-9a-f-]{36}$/i.test(taskId)) throw new Error('invalid task id');
    if (!/^step-\d+-command$/.test(evidenceId)) throw new Error('invalid evidence id');
    const relativePath = path.join(taskId, `${evidenceId}.json`);
    const absolutePath = path.resolve(this.evidenceDir, relativePath);
    const evidenceRoot = path.resolve(this.evidenceDir);
    const rel = path.relative(evidenceRoot, absolutePath);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new Error('invalid evidence path');
    }
    return { relativePath: relativePath.replace(/\\/g, '/'), absolutePath };
  }

  close(): void {
    this.db.close();
  }

  private ensureColumn(table: string, column: string, definition: string): void {
    const columns = this.db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!columns.some(c => c.name === column)) {
      this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }
}
