"use strict";
// ============================================================
// Agent OS - Control Plane - Database Service
// ============================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.executionDb = exports.projectDb = exports.artifactDb = exports.taskLogDb = exports.taskDb = exports.workerDb = exports.getDatabase = exports.initDatabase = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const DB_PATH = path.join(process.cwd(), 'data', 'agent-os.db');
let db;
function initDatabase() {
    // Ensure data directory exists
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    db = new better_sqlite3_1.default(DB_PATH);
    db.pragma('journal_mode = WAL');
    // Initialize schema
    const schema = `
    -- Workers table
    CREATE TABLE IF NOT EXISTS workers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      hostname TEXT NOT NULL,
      tailscale_ip TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'offline',
      token TEXT NOT NULL,
      registered_at TEXT NOT NULL,
      last_heartbeat TEXT,
      system_info TEXT,
      current_task_id TEXT
    );

    -- Tasks table
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      priority TEXT NOT NULL DEFAULT 'medium',
      project TEXT NOT NULL,
      created_by TEXT NOT NULL DEFAULT 'ceo',
      worker_id TEXT,
      payload TEXT DEFAULT '{}',
      created_at TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT,
      error TEXT,
      result_payload TEXT DEFAULT NULL
    );

    -- Task logs table
    CREATE TABLE IF NOT EXISTS task_logs (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      level TEXT NOT NULL DEFAULT 'info',
      message TEXT NOT NULL,
      data TEXT,
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    );

    -- Task artifacts table
    CREATE TABLE IF NOT EXISTS task_artifacts (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      size INTEGER NOT NULL DEFAULT 0,
      mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
      created_at TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    );

    -- Projects table
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      languages TEXT DEFAULT '[]',
      frameworks TEXT DEFAULT '[]',
      has_git INTEGER NOT NULL DEFAULT 0,
      has_docker INTEGER NOT NULL DEFAULT 0,
      has_node_modules INTEGER NOT NULL DEFAULT 0,
      package_manager TEXT,
      last_modified TEXT,
      discovered_at TEXT NOT NULL
    );

    -- Heartbeats table
    CREATE TABLE IF NOT EXISTS heartbeats (
      id TEXT PRIMARY KEY,
      worker_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      status TEXT NOT NULL,
      system_info TEXT,
      current_task_id TEXT
    );

    -- Executions table (audit trail)
    CREATE TABLE IF NOT EXISTS executions (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      worker_id TEXT NOT NULL,
      command TEXT NOT NULL,
      exit_code INTEGER,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      stdout TEXT,
      stderr TEXT
    );

    -- Settings table
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Chat messages (CEO ↔ Agent conversation history)
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL DEFAULT 'default',
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      task_id TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_messages(session_id);

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_worker ON tasks(worker_id);
    CREATE INDEX IF NOT EXISTS idx_task_logs_task ON task_logs(task_id);
    CREATE INDEX IF NOT EXISTS idx_heartbeats_worker ON heartbeats(worker_id);
    CREATE INDEX IF NOT EXISTS idx_executions_task ON executions(task_id);
  `;
    db.exec(schema);
    // Migrate: add result_payload column if it doesn't exist yet (for existing DBs)
    const taskColumns = db.prepare("PRAGMA table_info(tasks)").all();
    if (!taskColumns.some(c => c.name === 'result_payload')) {
        db.exec('ALTER TABLE tasks ADD COLUMN result_payload TEXT DEFAULT NULL');
        console.log('[DB] Migrated tasks table: added result_payload column');
    }
    console.log('[DB] Database initialized at:', DB_PATH);
    return db;
}
exports.initDatabase = initDatabase;
function getDatabase() {
    if (!db) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return db;
}
exports.getDatabase = getDatabase;
// Worker operations
exports.workerDb = {
    insert(worker) {
        const stmt = getDatabase().prepare(`
      INSERT INTO workers (id, name, hostname, tailscale_ip, status, token, registered_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(worker.id, worker.name, worker.hostname, worker.tailscaleIp, worker.status, worker.token, worker.registeredAt);
    },
    updateHeartbeat(id, status, systemInfo, currentTaskId) {
        const stmt = getDatabase().prepare(`
      UPDATE workers 
      SET last_heartbeat = ?, status = ?, system_info = ?, current_task_id = ?
      WHERE id = ?
    `);
        stmt.run(new Date().toISOString(), status, systemInfo, currentTaskId || null, id);
    },
    updateStatus(id, status, currentTaskId) {
        const stmt = getDatabase().prepare(`
      UPDATE workers SET status = ?, current_task_id = ? WHERE id = ?
    `);
        stmt.run(status, currentTaskId || null, id);
    },
    findById(id) {
        const stmt = getDatabase().prepare('SELECT * FROM workers WHERE id = ?');
        return stmt.get(id);
    },
    findByToken(token) {
        const stmt = getDatabase().prepare('SELECT * FROM workers WHERE token = ?');
        return stmt.get(token);
    },
    findAll() {
        const stmt = getDatabase().prepare('SELECT * FROM workers ORDER BY registered_at DESC');
        return stmt.all();
    },
    delete(id) {
        const stmt = getDatabase().prepare('DELETE FROM workers WHERE id = ?');
        stmt.run(id);
    },
};
// Task operations
exports.taskDb = {
    insert(task) {
        const stmt = getDatabase().prepare(`
      INSERT INTO tasks (id, type, status, priority, project, created_by, payload, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(task.id, task.type, task.status, task.priority, task.project, task.createdBy, task.payload || '{}', task.createdAt);
    },
    update(id, updates) {
        const fields = Object.keys(updates).map(k => `${camelToSnake(k)} = ?`).join(', ');
        const values = Object.values(updates);
        const stmt = getDatabase().prepare(`UPDATE tasks SET ${fields} WHERE id = ?`);
        stmt.run(...values, id);
    },
    findById(id) {
        const stmt = getDatabase().prepare('SELECT * FROM tasks WHERE id = ?');
        return stmt.get(id);
    },
    findAll(status) {
        if (status) {
            const stmt = getDatabase().prepare('SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC');
            return stmt.all(status);
        }
        const stmt = getDatabase().prepare('SELECT * FROM tasks ORDER BY created_at DESC');
        return stmt.all();
    },
    findPending() {
        const stmt = getDatabase().prepare("SELECT * FROM tasks WHERE status = 'pending' ORDER BY priority DESC, created_at ASC");
        return stmt.all();
    },
    assignToWorker(taskId, workerId) {
        const stmt = getDatabase().prepare(`
      UPDATE tasks SET worker_id = ?, status = 'running', started_at = ? WHERE id = ?
    `);
        stmt.run(workerId, new Date().toISOString(), taskId);
    },
    updateStatus(id, status, error) {
        const updates = { status };
        if (error) {
            updates.error = error;
        }
        else if (status === 'completed') {
            updates.error = null;
        }
        if (status === 'completed' || status === 'failed' || status === 'cancelled') {
            updates.completed_at = new Date().toISOString();
        }
        exports.taskDb.update(id, updates);
    },
    setResultPayload(id, payload) {
        const stmt = getDatabase().prepare('UPDATE tasks SET result_payload = ? WHERE id = ?');
        stmt.run(JSON.stringify(payload), id);
    },
};
// Task log operations
exports.taskLogDb = {
    insert(log) {
        const stmt = getDatabase().prepare(`
      INSERT INTO task_logs (id, task_id, timestamp, level, message, data)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
        stmt.run(log.id, log.taskId, log.timestamp, log.level, log.message, log.data || null);
    },
    findByTaskId(taskId) {
        const stmt = getDatabase().prepare('SELECT * FROM task_logs WHERE task_id = ? ORDER BY timestamp ASC');
        return stmt.all(taskId);
    },
};
// Task artifact operations
exports.artifactDb = {
    insert(artifact) {
        const stmt = getDatabase().prepare(`
      INSERT INTO task_artifacts (id, task_id, name, path, size, mime_type, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(artifact.id, artifact.taskId, artifact.name, artifact.path, artifact.size, artifact.mimeType, artifact.createdAt);
    },
    findByTaskId(taskId) {
        const stmt = getDatabase().prepare('SELECT * FROM task_artifacts WHERE task_id = ?');
        return stmt.all(taskId);
    },
};
// Project operations
exports.projectDb = {
    upsert(project) {
        const stmt = getDatabase().prepare(`
      INSERT INTO projects (id, name, path, languages, frameworks, has_git, has_docker, has_node_modules, package_manager, last_modified, discovered_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(path) DO UPDATE SET
        name = excluded.name,
        languages = excluded.languages,
        frameworks = excluded.frameworks,
        has_git = excluded.has_git,
        has_docker = excluded.has_docker,
        has_node_modules = excluded.has_node_modules,
        package_manager = excluded.package_manager,
        last_modified = excluded.last_modified
    `);
        stmt.run(project.id, project.name, project.path, project.languages, project.frameworks, project.hasGit ? 1 : 0, project.hasDocker ? 1 : 0, project.hasNodeModules ? 1 : 0, project.packageManager || null, project.lastModified || null, project.discoveredAt);
    },
    findAll() {
        const stmt = getDatabase().prepare('SELECT * FROM projects ORDER BY discovered_at DESC');
        return stmt.all();
    },
    findById(id) {
        const stmt = getDatabase().prepare('SELECT * FROM projects WHERE id = ?');
        return stmt.get(id);
    },
};
// Execution audit operations
exports.executionDb = {
    insert(execution) {
        const stmt = getDatabase().prepare(`
      INSERT INTO executions (id, task_id, worker_id, command, started_at)
      VALUES (?, ?, ?, ?, ?)
    `);
        stmt.run(execution.id, execution.taskId, execution.workerId, execution.command, execution.startedAt);
    },
    update(id, updates) {
        const fields = Object.keys(updates).map(k => `${camelToSnake(k)} = ?`).join(', ');
        const values = Object.values(updates);
        const stmt = getDatabase().prepare(`UPDATE executions SET ${fields} WHERE id = ?`);
        stmt.run(...values, id);
    },
    findByTaskId(taskId) {
        const stmt = getDatabase().prepare('SELECT * FROM executions WHERE task_id = ?');
        return stmt.all(taskId);
    },
};
// Helper function
function camelToSnake(str) {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}
//# sourceMappingURL=database.js.map