"use strict";
/**
 * Mi Approval Gate — Level 1/2/3 action queue.
 * Level 1: auto-allowed (read, scan, report)
 * Level 2: requires single approval (write, create, assign)
 * Level 3: requires double approval (delete, deploy, push, financial)
 *
 * Persistence: SQLite via ops.db — survives PM2 restart and system reboot.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.gateEvents = void 0;
exports.isAutoAllowed = isAutoAllowed;
exports.enqueue = enqueue;
exports.approve = approve;
exports.reject = reject;
exports.markExecuted = markExecuted;
exports.getPending = getPending;
exports.getAll = getAll;
exports.getById = getById;
const uuid_1 = require("uuid");
const events_1 = require("events");
const ops_db_1 = require("../operations/ops-db");
exports.gateEvents = new events_1.EventEmitter();
// ── Schema bootstrap ──────────────────────────────────────────────────────────
function ensureSchema() {
    const db = (0, ops_db_1.getOpsDb)();
    db.exec(`
    CREATE TABLE IF NOT EXISTS approval_queue (
      id            TEXT PRIMARY KEY,
      created_at    TEXT NOT NULL,
      risk_level    INTEGER NOT NULL,
      category      TEXT NOT NULL,
      description   TEXT NOT NULL,
      target        TEXT NOT NULL,
      before_state  TEXT,
      after_state   TEXT,
      rollback_plan TEXT,
      status        TEXT NOT NULL DEFAULT 'pending',
      confirmations INTEGER NOT NULL DEFAULT 0,
      resolved_at   TEXT,
      resolved_by   TEXT,
      result        TEXT
    );
  `);
}
// Initialize schema on module load
try {
    ensureSchema();
}
catch { /* ops-db not yet ready — will retry on first use */ }
// ── Serialization helpers ─────────────────────────────────────────────────────
function rowToAction(row) {
    return {
        id: row.id,
        created_at: row.created_at,
        risk_level: row.risk_level,
        category: row.category,
        description: row.description,
        target: row.target,
        before_state: row.before_state,
        after_state: row.after_state,
        rollback_plan: row.rollback_plan,
        status: row.status,
        confirmations: row.confirmations,
        resolved_at: row.resolved_at,
        resolved_by: row.resolved_by,
        result: row.result,
    };
}
// ── Level 1 categories — auto-allowed, no queue needed ───────────────────────
const LEVEL1_CATEGORIES = new Set([
    'read_file', 'search_file', 'scan_project', 'map_source',
    'query_knowledge', 'pull_dashboard', 'pull_website',
    'generate_report', 'generate_draft', 'generate_patch_proposal', 'run_qa',
    'list_processes', 'check_port', 'read_log',
]);
function isAutoAllowed(category) {
    return LEVEL1_CATEGORIES.has(category);
}
// ── CRUD ──────────────────────────────────────────────────────────────────────
function enqueue(params) {
    ensureSchema();
    const action = {
        id: (0, uuid_1.v4)(),
        created_at: new Date().toISOString(),
        status: 'pending',
        confirmations: 0,
        ...params,
    };
    const db = (0, ops_db_1.getOpsDb)();
    db.prepare(`
    INSERT INTO approval_queue
      (id, created_at, risk_level, category, description, target,
       before_state, after_state, rollback_plan, status, confirmations)
    VALUES
      (@id, @created_at, @risk_level, @category, @description, @target,
       @before_state, @after_state, @rollback_plan, @status, @confirmations)
  `).run(action);
    exports.gateEvents.emit('new_action', action);
    return action;
}
function approve(id, approver = 'owner') {
    ensureSchema();
    const db = (0, ops_db_1.getOpsDb)();
    const row = db.prepare('SELECT * FROM approval_queue WHERE id = ?').get(id);
    if (!row || row.status !== 'pending')
        return null;
    const action = rowToAction(row);
    action.confirmations += 1;
    if (action.risk_level === 3 && action.confirmations < 2) {
        db.prepare('UPDATE approval_queue SET confirmations = ? WHERE id = ?').run(action.confirmations, id);
        exports.gateEvents.emit('partial_approval', action);
        return action;
    }
    action.status = 'approved';
    action.resolved_at = new Date().toISOString();
    action.resolved_by = approver;
    db.prepare(`
    UPDATE approval_queue
    SET status = 'approved', confirmations = ?, resolved_at = ?, resolved_by = ?
    WHERE id = ?
  `).run(action.confirmations, action.resolved_at, approver, id);
    exports.gateEvents.emit('approved', action);
    return action;
}
function reject(id, approver = 'owner') {
    ensureSchema();
    const db = (0, ops_db_1.getOpsDb)();
    const row = db.prepare('SELECT * FROM approval_queue WHERE id = ?').get(id);
    if (!row || row.status !== 'pending')
        return null;
    const resolved_at = new Date().toISOString();
    db.prepare(`
    UPDATE approval_queue
    SET status = 'rejected', resolved_at = ?, resolved_by = ?
    WHERE id = ?
  `).run(resolved_at, approver, id);
    const action = rowToAction({ ...row, status: 'rejected', resolved_at, resolved_by: approver });
    exports.gateEvents.emit('rejected', action);
    return action;
}
function markExecuted(id, result) {
    ensureSchema();
    const db = (0, ops_db_1.getOpsDb)();
    db.prepare(`UPDATE approval_queue SET status = 'executed', result = ? WHERE id = ?`).run(result ?? null, id);
}
function getPending() {
    ensureSchema();
    const db = (0, ops_db_1.getOpsDb)();
    return db.prepare("SELECT * FROM approval_queue WHERE status = 'pending' ORDER BY created_at ASC").all()
        .map(rowToAction);
}
function getAll() {
    ensureSchema();
    const db = (0, ops_db_1.getOpsDb)();
    return db.prepare('SELECT * FROM approval_queue ORDER BY created_at DESC').all()
        .map(rowToAction);
}
function getById(id) {
    ensureSchema();
    const db = (0, ops_db_1.getOpsDb)();
    const row = db.prepare('SELECT * FROM approval_queue WHERE id = ?').get(id);
    return row ? rowToAction(row) : undefined;
}
