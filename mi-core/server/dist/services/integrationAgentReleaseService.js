"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReleasesDir = getReleasesDir;
exports.listVersions = listVersions;
exports.getManifest = getManifest;
exports.getLatestManifest = getLatestManifest;
exports.publishRelease = publishRelease;
exports.recordUpdateEvent = recordUpdateEvent;
exports.getUpdateEvents = getUpdateEvents;
exports.getMachineVersions = getMachineVersions;
exports.setMachineCurrentVersion = setMachineCurrentVersion;
/**
 * integrationAgentReleaseService.ts
 * Manages integration-system release manifests and update events.
 * Stores manifests in data/releases/integration-system/<version>/manifest.json
 * Stores update events in SQLite (qb-agent.db reused, new table).
 */
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const DATA_DIR = process.env.MASTER_ROOT
    ? path_1.default.join(process.env.MASTER_ROOT, 'mi-core', 'data')
    : path_1.default.join(process.cwd(), '..', 'data');
const RELEASES_DIR = path_1.default.join(DATA_DIR, 'releases', 'integration-system');
const DB_PATH = path_1.default.join(DATA_DIR, 'qb-agent.db');
// ── Database ──────────────────────────────────────────────────────────────────
let _db = null;
function getDb() {
    if (!_db) {
        fs_1.default.mkdirSync(path_1.default.dirname(DB_PATH), { recursive: true });
        _db = new better_sqlite3_1.default(DB_PATH);
        _db.exec(`
      CREATE TABLE IF NOT EXISTS ia_update_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        machine_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        version TEXT NOT NULL DEFAULT '',
        error TEXT NOT NULL DEFAULT '',
        timestamp TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS ia_machine_versions (
        machine_id TEXT PRIMARY KEY,
        current_version TEXT NOT NULL DEFAULT '',
        latest_known_version TEXT NOT NULL DEFAULT '',
        update_status TEXT NOT NULL DEFAULT '',
        last_check TEXT NOT NULL DEFAULT '',
        last_update_result TEXT NOT NULL DEFAULT '',
        update_error TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    }
    return _db;
}
// ── Release file management ───────────────────────────────────────────────────
function getReleasesDir() {
    return RELEASES_DIR;
}
function listVersions() {
    if (!fs_1.default.existsSync(RELEASES_DIR))
        return [];
    return fs_1.default.readdirSync(RELEASES_DIR)
        .filter(d => fs_1.default.statSync(path_1.default.join(RELEASES_DIR, d)).isDirectory())
        .sort()
        .reverse();
}
function getManifest(version) {
    const manifestPath = path_1.default.join(RELEASES_DIR, version, 'manifest.json');
    if (!fs_1.default.existsSync(manifestPath))
        return null;
    try {
        return JSON.parse(fs_1.default.readFileSync(manifestPath, 'utf8'));
    }
    catch {
        return null;
    }
}
function getLatestManifest() {
    const versions = listVersions();
    if (versions.length === 0)
        return null;
    return getManifest(versions[0]);
}
function publishRelease(manifest) {
    const versionDir = path_1.default.join(RELEASES_DIR, manifest.version);
    fs_1.default.mkdirSync(versionDir, { recursive: true });
    const manifestPath = path_1.default.join(versionDir, 'manifest.json');
    fs_1.default.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    return { ok: true, path: manifestPath };
}
// ── Update events ─────────────────────────────────────────────────────────────
function recordUpdateEvent(event) {
    const db = getDb();
    const ts = event.timestamp || new Date().toISOString();
    db.prepare(`
    INSERT INTO ia_update_events (machine_id, event_type, version, error, timestamp)
    VALUES (?, ?, ?, ?, ?)
  `).run(event.machine_id, event.event_type, event.version || '', event.error || '', ts);
    // Update machine version tracking
    const status = _eventToStatus(event.event_type);
    const existing = db.prepare('SELECT machine_id FROM ia_machine_versions WHERE machine_id = ?').get(event.machine_id);
    if (existing) {
        db.prepare(`
      UPDATE ia_machine_versions SET
        update_status = ?,
        last_check = CASE WHEN ? = 'UPDATE_CHECKED' THEN ? ELSE last_check END,
        last_update_result = CASE WHEN ? IN ('UPDATE_COMPLETED','UPDATE_FAILED','UPDATE_ROLLBACK_COMPLETED') THEN ? ELSE last_update_result END,
        update_error = ?,
        latest_known_version = CASE WHEN ? != '' AND ? NOT IN ('', current_version) THEN ? ELSE latest_known_version END,
        updated_at = datetime('now')
      WHERE machine_id = ?
    `).run(status, event.event_type, ts, event.event_type, event.event_type, event.error || '', event.version, event.version, event.version, event.machine_id);
    }
    else {
        db.prepare(`
      INSERT INTO ia_machine_versions (machine_id, update_status, last_check, update_error, latest_known_version)
      VALUES (?, ?, ?, ?, ?)
    `).run(event.machine_id, status, ts, event.error || '', event.version || '');
    }
}
function _eventToStatus(eventType) {
    const map = {
        UPDATE_CHECKED: 'CHECKED',
        UPDATE_AVAILABLE: 'AVAILABLE',
        UPDATE_DOWNLOADED: 'DOWNLOADED',
        UPDATE_INSTALL_STARTED: 'INSTALLING',
        UPDATE_COMPLETED: 'UP_TO_DATE',
        UPDATE_FAILED: 'FAILED',
        UPDATE_ROLLBACK_STARTED: 'ROLLING_BACK',
        UPDATE_ROLLBACK_COMPLETED: 'ROLLED_BACK',
    };
    return map[eventType] || 'UNKNOWN';
}
function getUpdateEvents(machine_id, limit = 50) {
    const db = getDb();
    if (machine_id) {
        return db.prepare('SELECT * FROM ia_update_events WHERE machine_id = ? ORDER BY id DESC LIMIT ?').all(machine_id, limit);
    }
    return db.prepare('SELECT * FROM ia_update_events ORDER BY id DESC LIMIT ?').all(limit);
}
function getMachineVersions() {
    return getDb().prepare('SELECT * FROM ia_machine_versions ORDER BY updated_at DESC').all();
}
function setMachineCurrentVersion(machine_id, version) {
    const db = getDb();
    const existing = db.prepare('SELECT machine_id FROM ia_machine_versions WHERE machine_id = ?').get(machine_id);
    if (existing) {
        db.prepare('UPDATE ia_machine_versions SET current_version = ?, updated_at = datetime(\'now\') WHERE machine_id = ?')
            .run(version, machine_id);
    }
    else {
        db.prepare('INSERT INTO ia_machine_versions (machine_id, current_version) VALUES (?, ?)')
            .run(machine_id, version);
    }
}
