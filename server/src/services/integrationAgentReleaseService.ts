/**
 * integrationAgentReleaseService.ts
 * Manages integration-system release manifests and update events.
 * Stores manifests in data/releases/integration-system/<version>/manifest.json
 * Stores update events in SQLite (qb-agent.db reused, new table).
 */
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const DATA_DIR = process.env.MASTER_ROOT
  ? path.join(process.env.MASTER_ROOT, 'mi-core', 'data')
  : path.join(process.cwd(), '..', 'data');

const RELEASES_DIR = path.join(DATA_DIR, 'releases', 'integration-system');
const DB_PATH = path.join(DATA_DIR, 'qb-agent.db');

// ── Database ──────────────────────────────────────────────────────────────────

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    _db = new Database(DB_PATH);
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

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReleaseManifest {
  app: string;
  channel: string;
  version: string;
  build: string;
  published_at: string;
  min_supported_version: string;
  download_url: string;
  sha256: string;
  size_bytes: number;
  release_notes: string[];
  requires_restart: boolean;
  rollback_supported: boolean;
}

export interface UpdateEvent {
  machine_id: string;
  event_type: string;
  version: string;
  error?: string;
  timestamp: string;
}

// ── Release file management ───────────────────────────────────────────────────

export function getReleasesDir(): string {
  return RELEASES_DIR;
}

export function listVersions(): string[] {
  if (!fs.existsSync(RELEASES_DIR)) return [];
  return fs.readdirSync(RELEASES_DIR)
    .filter(d => fs.statSync(path.join(RELEASES_DIR, d)).isDirectory())
    .sort()
    .reverse();
}

export function getManifest(version: string): ReleaseManifest | null {
  const manifestPath = path.join(RELEASES_DIR, version, 'manifest.json');
  if (!fs.existsSync(manifestPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as ReleaseManifest;
  } catch {
    return null;
  }
}

export function getLatestManifest(): ReleaseManifest | null {
  const versions = listVersions();
  if (versions.length === 0) return null;
  return getManifest(versions[0]);
}

export function publishRelease(manifest: ReleaseManifest): { ok: boolean; path: string } {
  const versionDir = path.join(RELEASES_DIR, manifest.version);
  fs.mkdirSync(versionDir, { recursive: true });
  const manifestPath = path.join(versionDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  return { ok: true, path: manifestPath };
}

// ── Update events ─────────────────────────────────────────────────────────────

export function recordUpdateEvent(event: UpdateEvent): void {
  const db = getDb();
  const ts = event.timestamp || new Date().toISOString();

  db.prepare(`
    INSERT INTO ia_update_events (machine_id, event_type, version, error, timestamp)
    VALUES (?, ?, ?, ?, ?)
  `).run(event.machine_id, event.event_type, event.version || '', event.error || '', ts);

  // Update machine version tracking
  const status = _eventToStatus(event.event_type);
  const existing = db.prepare(
    'SELECT machine_id FROM ia_machine_versions WHERE machine_id = ?'
  ).get(event.machine_id);

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
    `).run(
      status,
      event.event_type, ts,
      event.event_type, event.event_type,
      event.error || '',
      event.version, event.version, event.version,
      event.machine_id,
    );
  } else {
    db.prepare(`
      INSERT INTO ia_machine_versions (machine_id, update_status, last_check, update_error, latest_known_version)
      VALUES (?, ?, ?, ?, ?)
    `).run(event.machine_id, status, ts, event.error || '', event.version || '');
  }
}

function _eventToStatus(eventType: string): string {
  const map: Record<string, string> = {
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

export function getUpdateEvents(machine_id?: string, limit = 50): UpdateEvent[] {
  const db = getDb();
  if (machine_id) {
    return db.prepare(
      'SELECT * FROM ia_update_events WHERE machine_id = ? ORDER BY id DESC LIMIT ?'
    ).all(machine_id, limit) as UpdateEvent[];
  }
  return db.prepare(
    'SELECT * FROM ia_update_events ORDER BY id DESC LIMIT ?'
  ).all(limit) as UpdateEvent[];
}

export function getMachineVersions(): unknown[] {
  return getDb().prepare('SELECT * FROM ia_machine_versions ORDER BY updated_at DESC').all();
}

export function setMachineCurrentVersion(machine_id: string, version: string): void {
  const db = getDb();
  const existing = db.prepare('SELECT machine_id FROM ia_machine_versions WHERE machine_id = ?').get(machine_id);
  if (existing) {
    db.prepare('UPDATE ia_machine_versions SET current_version = ?, updated_at = datetime(\'now\') WHERE machine_id = ?')
      .run(version, machine_id);
  } else {
    db.prepare('INSERT INTO ia_machine_versions (machine_id, current_version) VALUES (?, ?)')
      .run(machine_id, version);
  }
}
