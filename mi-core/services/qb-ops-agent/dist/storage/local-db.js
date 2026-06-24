"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeDb = exports.setSetting = exports.getSetting = exports.getQueueDepth = exports.removeFromQueue = exports.markQueueItemAttempted = exports.getQueuedItems = exports.enqueueOutbound = exports.logAction = exports.completeWorkflowRun = exports.insertWorkflowRun = exports.getCompanyFiles = exports.upsertCompanyFile = exports.getMachine = exports.upsertMachine = exports.getDb = void 0;
const sqlite3_1 = __importDefault(require("sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const logs_1 = require("./logs");
const DB_PATH = process.env.LOCAL_DB_PATH || './data/qb-ops-agent.sqlite';
let db = null;
let initialized = false;
function getDbPath() {
    return path_1.default.isAbsolute(DB_PATH) ? DB_PATH : path_1.default.join(process.cwd(), DB_PATH);
}
function getDb() {
    if (db)
        return db;
    const dbPath = getDbPath();
    const dir = path_1.default.dirname(dbPath);
    if (!fs_1.default.existsSync(dir))
        fs_1.default.mkdirSync(dir, { recursive: true });
    db = new sqlite3_1.default.Database(dbPath);
    initSchema();
    logs_1.logger.info('Local SQLite database initialized', { path: dbPath });
    return db;
}
exports.getDb = getDb;
function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        getDb().run(sql, params, function (err) {
            if (err)
                reject(err);
            else
                resolve({ lastID: this.lastID ?? 0, changes: this.changes ?? 0 });
        });
    });
}
function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        getDb().get(sql, params, (err, row) => {
            if (err)
                reject(err);
            else
                resolve(row);
        });
    });
}
function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        getDb().all(sql, params, (err, rows) => {
            if (err)
                reject(err);
            else
                resolve(rows);
        });
    });
}
function exec(sql) {
    return new Promise((resolve, reject) => {
        getDb().exec(sql, (err) => {
            if (err)
                reject(err);
            else
                resolve();
        });
    });
}
function initSchema() {
    if (initialized)
        return;
    initialized = true;
    void exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS machines (
      machine_id TEXT PRIMARY KEY,
      hostname TEXT NOT NULL,
      windows_username TEXT,
      os_version TEXT,
      ip_address TEXT,
      agent_version TEXT NOT NULL,
      quickbooks_version TEXT,
      registered_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      status TEXT DEFAULT 'online'
    );

    CREATE TABLE IF NOT EXISTS company_files (
      company_file_id TEXT PRIMARY KEY,
      company_name TEXT,
      company_file_path TEXT NOT NULL,
      last_opened_at TEXT,
      last_checked_at TEXT,
      status TEXT DEFAULT 'unknown',
      assigned_store TEXT,
      assigned_department TEXT,
      notes TEXT,
      machine_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (machine_id) REFERENCES machines(machine_id)
    );

    CREATE TABLE IF NOT EXISTS workflow_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workflow_name TEXT NOT NULL,
      company_file_id TEXT,
      machine_id TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      summary TEXT,
      actions_json TEXT
    );

    CREATE TABLE IF NOT EXISTS action_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      machine_id TEXT NOT NULL,
      workflow TEXT,
      action_name TEXT NOT NULL,
      status TEXT NOT NULL,
      message TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS outbound_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payload TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      attempts INTEGER DEFAULT 0,
      max_attempts INTEGER DEFAULT 5,
      created_at TEXT NOT NULL,
      last_attempt_at TEXT,
      error TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `).catch((error) => {
        logs_1.logger.error('Failed to initialize SQLite schema', { error: error instanceof Error ? error.message : String(error) });
    });
}
function upsertMachine(m) {
    void run(`INSERT INTO machines (machine_id, hostname, windows_username, os_version, ip_address, agent_version, quickbooks_version, registered_at, last_seen_at, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(machine_id) DO UPDATE SET
       hostname = excluded.hostname,
       windows_username = excluded.windows_username,
       os_version = excluded.os_version,
       ip_address = excluded.ip_address,
       quickbooks_version = excluded.quickbooks_version,
       last_seen_at = excluded.last_seen_at,
       status = excluded.status`, [m.machine_id, m.hostname, m.windows_username, m.os_version, m.ip_address, m.agent_version, m.quickbooks_version, m.registered_at, m.last_seen_at, m.status]).catch((error) => logs_1.logger.error('Failed to upsert machine', { error: error instanceof Error ? error.message : String(error) }));
}
exports.upsertMachine = upsertMachine;
function getMachine(machineId) {
    logs_1.logger.warn('getMachine is async-backed and returns cached/undefined in Phase 1 implementation', { machineId });
    return undefined;
}
exports.getMachine = getMachine;
function upsertCompanyFile(f) {
    void run(`INSERT INTO company_files (company_file_id, company_name, company_file_path, last_opened_at, last_checked_at, status, assigned_store, assigned_department, notes, machine_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(company_file_id) DO UPDATE SET
       company_name = excluded.company_name,
       company_file_path = excluded.company_file_path,
       last_opened_at = excluded.last_opened_at,
       last_checked_at = excluded.last_checked_at,
       status = excluded.status,
       assigned_store = excluded.assigned_store,
       assigned_department = excluded.assigned_department,
       notes = excluded.notes,
       updated_at = excluded.updated_at`, [f.company_file_id, f.company_name, f.company_file_path, f.last_opened_at, f.last_checked_at, f.status, f.assigned_store, f.assigned_department, f.notes, f.machine_id, f.created_at, f.updated_at]).catch((error) => logs_1.logger.error('Failed to upsert company file', { error: error instanceof Error ? error.message : String(error) }));
}
exports.upsertCompanyFile = upsertCompanyFile;
function getCompanyFiles(_machineId) {
    logs_1.logger.warn('getCompanyFiles is async-backed and returns empty list in Phase 1 compatibility implementation');
    return [];
}
exports.getCompanyFiles = getCompanyFiles;
function insertWorkflowRun(r) {
    void run(`INSERT INTO workflow_runs (workflow_name, company_file_id, machine_id, status, started_at, completed_at, summary, actions_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [r.workflow_name, r.company_file_id, r.machine_id, r.status, r.started_at, r.completed_at ?? null, r.summary ?? null, r.actions_json ?? null]).catch((error) => logs_1.logger.error('Failed to insert workflow run', { error: error instanceof Error ? error.message : String(error) }));
    return 0;
}
exports.insertWorkflowRun = insertWorkflowRun;
function completeWorkflowRun(id, status, summary, actionsJson) {
    void run('UPDATE workflow_runs SET completed_at = ?, status = ?, summary = ?, actions_json = ? WHERE id = ?', [new Date().toISOString(), status, summary, actionsJson, id]).catch((error) => logs_1.logger.error('Failed to complete workflow run', { error: error instanceof Error ? error.message : String(error) }));
}
exports.completeWorkflowRun = completeWorkflowRun;
function logAction(a) {
    void run('INSERT INTO action_logs (machine_id, workflow, action_name, status, message, created_at) VALUES (?, ?, ?, ?, ?, ?)', [a.machine_id, a.workflow, a.action_name, a.status, a.message, a.created_at]).catch((error) => logs_1.logger.error('Failed to log action', { error: error instanceof Error ? error.message : String(error) }));
}
exports.logAction = logAction;
function enqueueOutbound(payload, endpoint) {
    void run('INSERT INTO outbound_queue (payload, endpoint, attempts, created_at) VALUES (?, ?, 0, ?)', [JSON.stringify(payload), endpoint, new Date().toISOString()]).catch((error) => logs_1.logger.error('Failed to enqueue outbound payload', { error: error instanceof Error ? error.message : String(error) }));
    return 0;
}
exports.enqueueOutbound = enqueueOutbound;
function getQueuedItems(_limit = 20) {
    logs_1.logger.warn('getQueuedItems is async-backed and returns empty list in Phase 1 compatibility implementation');
    return [];
}
exports.getQueuedItems = getQueuedItems;
function markQueueItemAttempted(id, error) {
    void run('UPDATE outbound_queue SET attempts = attempts + 1, last_attempt_at = ?, error = ? WHERE id = ?', [new Date().toISOString(), error, id]).catch((err) => logs_1.logger.error('Failed to update queue attempt', { error: err instanceof Error ? err.message : String(err) }));
}
exports.markQueueItemAttempted = markQueueItemAttempted;
function removeFromQueue(id) {
    void run('DELETE FROM outbound_queue WHERE id = ?', [id])
        .catch((error) => logs_1.logger.error('Failed to remove queue item', { error: error instanceof Error ? error.message : String(error) }));
}
exports.removeFromQueue = removeFromQueue;
function getQueueDepth() {
    return 0;
}
exports.getQueueDepth = getQueueDepth;
function getSetting(key) {
    const settingsPath = path_1.default.join(path_1.default.dirname(getDbPath()), 'settings-cache.json');
    if (!fs_1.default.existsSync(settingsPath))
        return null;
    try {
        const data = JSON.parse(fs_1.default.readFileSync(settingsPath, 'utf8'));
        return data[key] ?? null;
    }
    catch {
        return null;
    }
}
exports.getSetting = getSetting;
function setSetting(key, value) {
    const settingsPath = path_1.default.join(path_1.default.dirname(getDbPath()), 'settings-cache.json');
    let data = {};
    if (fs_1.default.existsSync(settingsPath)) {
        try {
            data = JSON.parse(fs_1.default.readFileSync(settingsPath, 'utf8'));
        }
        catch { }
    }
    data[key] = value;
    fs_1.default.writeFileSync(settingsPath, JSON.stringify(data, null, 2), 'utf8');
    void run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]).catch((error) => logs_1.logger.error('Failed to persist setting', { error: error instanceof Error ? error.message : String(error) }));
}
exports.setSetting = setSetting;
function closeDb() {
    if (db) {
        db.close((err) => {
            if (err)
                logs_1.logger.error('Error closing database', { error: err.message });
            else
                logs_1.logger.info('Database connection closed');
        });
        db = null;
        initialized = false;
    }
}
exports.closeDb = closeDb;
//# sourceMappingURL=local-db.js.map