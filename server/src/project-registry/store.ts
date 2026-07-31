import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { resolveRegistryDataDir } from './paths';
import type { ContextPack, ProjectMap, ProjectMapRecord, ProjectRecord, ResumeContext } from './types';

type ProjectRow = Omit<ProjectRecord,
  'runtimeHints' | 'packageManagers' | 'frameworks' | 'testCommands' | 'buildCommands' | 'runtimeProcesses' | 'importantPaths'
> & {
  runtimeHints: string;
  packageManagers: string;
  frameworks: string;
  testCommands: string;
  buildCommands: string;
  runtimeProcesses: string;
  importantPaths: string;
};

export class ProjectRegistryStore {
  private db: Database.Database;
  readonly dataDir: string;

  constructor(dataDir: string = resolveRegistryDataDir()) {
    this.dataDir = dataDir;
    fs.mkdirSync(this.dataDir, { recursive: true });
    this.db = new Database(path.join(this.dataDir, 'projects.db'));
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.migrate();
  }

  upsertProject(project: ProjectRecord): ProjectRecord {
    this.db.prepare(`
      INSERT INTO projects (
        id, displayName, canonicalRoot, gitRoot, repositoryUrl, defaultBranch, owner,
        businessPurpose, runtimeHints, packageManagers, frameworks, testCommands,
        buildCommands, deploymentNotes, runtimeProcesses, importantPaths, status,
        mapStatus, mapVersion, mapGeneratedAt, mapSourceSha, lastVerifiedAt, createdAt, updatedAt
      ) VALUES (
        @id, @displayName, @canonicalRoot, @gitRoot, @repositoryUrl, @defaultBranch, @owner,
        @businessPurpose, @runtimeHints, @packageManagers, @frameworks, @testCommands,
        @buildCommands, @deploymentNotes, @runtimeProcesses, @importantPaths, @status,
        @mapStatus, @mapVersion, @mapGeneratedAt, @mapSourceSha, @lastVerifiedAt, @createdAt, @updatedAt
      )
      ON CONFLICT(id) DO UPDATE SET
        displayName = excluded.displayName,
        canonicalRoot = excluded.canonicalRoot,
        gitRoot = excluded.gitRoot,
        repositoryUrl = excluded.repositoryUrl,
        defaultBranch = excluded.defaultBranch,
        owner = excluded.owner,
        businessPurpose = excluded.businessPurpose,
        runtimeHints = excluded.runtimeHints,
        packageManagers = excluded.packageManagers,
        frameworks = excluded.frameworks,
        testCommands = excluded.testCommands,
        buildCommands = excluded.buildCommands,
        deploymentNotes = excluded.deploymentNotes,
        runtimeProcesses = excluded.runtimeProcesses,
        importantPaths = excluded.importantPaths,
        status = excluded.status,
        lastVerifiedAt = excluded.lastVerifiedAt,
        updatedAt = excluded.updatedAt
    `).run(projectToRow(project));
    return this.getProject(project.id) as ProjectRecord;
  }

  getProject(id: string): ProjectRecord | null {
    const row = this.db.prepare(`SELECT * FROM projects WHERE id = ?`).get(id) as ProjectRow | undefined;
    return row ? rowToProject(row) : null;
  }

  listProjects(): ProjectRecord[] {
    const rows = this.db.prepare(`SELECT * FROM projects ORDER BY displayName ASC`).all() as ProjectRow[];
    return rows.map(rowToProject);
  }

  getProjectByCanonicalRoot(canonicalRoot: string): ProjectRecord | null {
    const row = this.db.prepare(`SELECT * FROM projects WHERE canonicalRoot = ?`).get(canonicalRoot) as ProjectRow | undefined;
    return row ? rowToProject(row) : null;
  }

  markVerified(id: string, status: ProjectRecord['status'], verifiedAt: string): void {
    this.db.prepare(`UPDATE projects SET status = ?, lastVerifiedAt = ?, updatedAt = ? WHERE id = ?`)
      .run(status, verifiedAt, verifiedAt, id);
  }

  insertProjectMap(map: ProjectMap): ProjectMap {
    this.db.transaction(() => {
      this.db.prepare(`
        INSERT INTO project_maps (
          projectId, mapVersion, sourceSha, status, summary, modulesJson,
          routesJson, commandsJson, risksJson, generatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        map.projectId,
        map.mapVersion,
        map.sourceSha,
        map.status,
        map.summary,
        JSON.stringify(map.modules),
        JSON.stringify(map.routes),
        JSON.stringify(map.commands),
        JSON.stringify(map.risks),
        map.generatedAt
      );
      if (map.status !== 'FAILED') {
        this.db.prepare(`
          UPDATE projects
          SET mapStatus = ?, mapVersion = ?, mapGeneratedAt = ?, mapSourceSha = ?, updatedAt = ?
          WHERE id = ?
        `).run(map.status, map.mapVersion, map.generatedAt, map.sourceSha, map.generatedAt, map.projectId);
      }
    })();
    return map;
  }

  latestProjectMap(projectId: string): ProjectMap | null {
    const row = this.db.prepare(`
      SELECT * FROM project_maps
      WHERE projectId = ? AND status != 'FAILED'
      ORDER BY id DESC
      LIMIT 1
    `).get(projectId) as ProjectMapRecord | undefined;
    return row ? rowToMap(row) : null;
  }

  getProjectMap(projectId: string, mapVersion: string): ProjectMap | null {
    const row = this.db.prepare(`
      SELECT * FROM project_maps WHERE projectId = ? AND mapVersion = ?
    `).get(projectId, mapVersion) as ProjectMapRecord | undefined;
    return row ? rowToMap(row) : null;
  }

  saveResumeContext(input: Omit<ResumeContext, 'id' | 'updatedAt'>): ResumeContext {
    const updatedAt = new Date().toISOString();
    const existing = input.taskId
      ? this.db.prepare(`SELECT * FROM resume_contexts WHERE projectId = ? AND taskId = ?`).get(input.projectId, input.taskId) as ResumeContext | undefined
      : undefined;
    const context: ResumeContext = {
      ...input,
      id: existing?.id ?? `resume-${randomUUID()}`,
      updatedAt,
    };
    this.db.prepare(`
      INSERT INTO resume_contexts (id, projectId, taskId, summary, openItemsJson, lastKnownStatus, updatedAt)
      VALUES (@id, @projectId, @taskId, @summary, @openItemsJson, @lastKnownStatus, @updatedAt)
      ON CONFLICT(id) DO UPDATE SET
        summary = excluded.summary,
        openItemsJson = excluded.openItemsJson,
        lastKnownStatus = excluded.lastKnownStatus,
        updatedAt = excluded.updatedAt
    `).run({ ...context, openItemsJson: JSON.stringify(context.openItems) });
    return context;
  }

  getResumeContext(id: string): ResumeContext | null {
    const row = this.db.prepare(`SELECT * FROM resume_contexts WHERE id = ?`).get(id) as ResumeContextRow | undefined;
    return row ? rowToResume(row) : null;
  }

  latestResumeContext(projectId: string): ResumeContext | null {
    const row = this.db.prepare(`
      SELECT * FROM resume_contexts WHERE projectId = ? ORDER BY updatedAt DESC LIMIT 1
    `).get(projectId) as ResumeContextRow | undefined;
    return row ? rowToResume(row) : null;
  }

  saveContextPack(pack: ContextPack): ContextPack {
    this.db.prepare(`
      INSERT INTO context_packs (
        id, projectId, mapVersion, sourceSha, mapStatus, policy, summary, moduleSummariesJson,
        includedPathsJson, excludedPathsJson, relevanceHintsJson, resumeContextId, createdAt
      ) VALUES (@id, @projectId, @mapVersion, @sourceSha, @mapStatus, @policy, @summary, @moduleSummariesJson,
        @includedPathsJson, @excludedPathsJson, @relevanceHintsJson, @resumeContextId, @createdAt)
    `).run({
      ...pack,
      moduleSummariesJson: JSON.stringify(pack.moduleSummaries),
      includedPathsJson: JSON.stringify(pack.includedPaths),
      excludedPathsJson: JSON.stringify(pack.excludedPaths),
      relevanceHintsJson: JSON.stringify(pack.relevanceHints),
    });
    return pack;
  }

  getContextPack(id: string): ContextPack | null {
    const row = this.db.prepare(`SELECT * FROM context_packs WHERE id = ?`).get(id) as ContextPackRow | undefined;
    return row ? rowToContextPack(row) : null;
  }

  close(): void {
    this.db.close();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        appliedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        displayName TEXT NOT NULL,
        canonicalRoot TEXT NOT NULL,
        gitRoot TEXT,
        repositoryUrl TEXT,
        defaultBranch TEXT,
        owner TEXT,
        businessPurpose TEXT,
        runtimeHints TEXT NOT NULL,
        packageManagers TEXT NOT NULL,
        frameworks TEXT NOT NULL,
        testCommands TEXT NOT NULL,
        buildCommands TEXT NOT NULL,
        deploymentNotes TEXT,
        runtimeProcesses TEXT NOT NULL,
        importantPaths TEXT NOT NULL,
        status TEXT NOT NULL,
        mapStatus TEXT NOT NULL,
        mapVersion TEXT,
        mapGeneratedAt TEXT,
        mapSourceSha TEXT,
        lastVerifiedAt TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS project_maps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        projectId TEXT NOT NULL,
        mapVersion TEXT NOT NULL,
        sourceSha TEXT,
        status TEXT NOT NULL,
        summary TEXT NOT NULL,
        modulesJson TEXT NOT NULL,
        routesJson TEXT NOT NULL,
        commandsJson TEXT NOT NULL,
        risksJson TEXT NOT NULL,
        generatedAt TEXT NOT NULL,
        UNIQUE(projectId, mapVersion),
        FOREIGN KEY (projectId) REFERENCES projects(id)
      );

      CREATE TABLE IF NOT EXISTS resume_contexts (
        id TEXT PRIMARY KEY,
        projectId TEXT NOT NULL,
        taskId TEXT,
        summary TEXT NOT NULL,
        openItemsJson TEXT NOT NULL,
        lastKnownStatus TEXT,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (projectId) REFERENCES projects(id)
      );

      CREATE TABLE IF NOT EXISTS context_packs (
        id TEXT PRIMARY KEY,
        projectId TEXT NOT NULL,
        mapVersion TEXT,
        sourceSha TEXT,
        mapStatus TEXT NOT NULL DEFAULT 'NOT_GENERATED',
        policy TEXT NOT NULL,
        summary TEXT NOT NULL,
        moduleSummariesJson TEXT NOT NULL DEFAULT '[]',
        includedPathsJson TEXT NOT NULL,
        excludedPathsJson TEXT NOT NULL DEFAULT '[]',
        relevanceHintsJson TEXT NOT NULL,
        resumeContextId TEXT,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (projectId) REFERENCES projects(id)
      );

      INSERT OR IGNORE INTO schema_migrations (id, appliedAt)
      VALUES ('001_project_registry', datetime('now'));
    `);
    this.db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_canonicalRoot ON projects(canonicalRoot);`);
    this.ensureColumn('context_packs', 'sourceSha', 'TEXT');
    this.ensureColumn('context_packs', 'mapStatus', `TEXT NOT NULL DEFAULT 'NOT_GENERATED'`);
    this.ensureColumn('context_packs', 'moduleSummariesJson', `TEXT NOT NULL DEFAULT '[]'`);
    this.ensureColumn('context_packs', 'excludedPathsJson', `TEXT NOT NULL DEFAULT '[]'`);
  }

  private ensureColumn(table: string, column: string, definition: string): void {
    const columns = this.db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!columns.some(c => c.name === column)) {
      this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }
}

interface ResumeContextRow {
  id: string;
  projectId: string;
  taskId: string | null;
  summary: string;
  openItemsJson: string;
  lastKnownStatus: string | null;
  updatedAt: string;
}

interface ContextPackRow {
  id: string;
  projectId: string;
  mapVersion: string | null;
  sourceSha: string | null;
  mapStatus: ContextPack['mapStatus'];
  policy: ContextPack['policy'];
  summary: string;
  moduleSummariesJson: string;
  includedPathsJson: string;
  excludedPathsJson: string;
  relevanceHintsJson: string;
  resumeContextId: string | null;
  createdAt: string;
}

function projectToRow(project: ProjectRecord): ProjectRow {
  return {
    ...project,
    runtimeHints: JSON.stringify(project.runtimeHints),
    packageManagers: JSON.stringify(project.packageManagers),
    frameworks: JSON.stringify(project.frameworks),
    testCommands: JSON.stringify(project.testCommands),
    buildCommands: JSON.stringify(project.buildCommands),
    runtimeProcesses: JSON.stringify(project.runtimeProcesses),
    importantPaths: JSON.stringify(project.importantPaths),
  };
}

function rowToProject(row: ProjectRow): ProjectRecord {
  return {
    ...row,
    runtimeHints: parseJson(row.runtimeHints, []),
    packageManagers: parseJson(row.packageManagers, []),
    frameworks: parseJson(row.frameworks, []),
    testCommands: parseJson(row.testCommands, []),
    buildCommands: parseJson(row.buildCommands, []),
    runtimeProcesses: parseJson(row.runtimeProcesses, []),
    importantPaths: parseJson(row.importantPaths, {}),
  };
}

function rowToMap(row: ProjectMapRecord): ProjectMap {
  return {
    projectId: row.projectId,
    mapVersion: row.mapVersion,
    sourceSha: row.sourceSha,
    status: row.status,
    summary: row.summary,
    modules: parseJson(row.modulesJson, []),
    routes: parseJson(row.routesJson, []),
    commands: parseJson(row.commandsJson, []),
    risks: parseJson(row.risksJson, []),
    generatedAt: row.generatedAt,
  };
}

function rowToResume(row: ResumeContextRow): ResumeContext {
  return {
    id: row.id,
    projectId: row.projectId,
    taskId: row.taskId,
    summary: row.summary,
    openItems: parseJson(row.openItemsJson, []),
    lastKnownStatus: row.lastKnownStatus,
    updatedAt: row.updatedAt,
  };
}

function rowToContextPack(row: ContextPackRow): ContextPack {
  return {
    id: row.id,
    projectId: row.projectId,
    mapVersion: row.mapVersion,
    sourceSha: row.sourceSha,
    mapStatus: row.mapStatus,
    policy: row.policy,
    summary: row.summary,
    moduleSummaries: parseJson(row.moduleSummariesJson, []),
    includedPaths: parseJson(row.includedPathsJson, []),
    excludedPaths: parseJson(row.excludedPathsJson, []),
    relevanceHints: parseJson(row.relevanceHintsJson, []),
    resumeContextId: row.resumeContextId,
    createdAt: row.createdAt,
  };
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
