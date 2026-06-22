/**
 * doordash-package-service.ts
 * Manages versioned MI intelligence packages for the DoorDash Agent runtime.
 * Packages are stored in data/doordash-agent/packages/<version>/package.json
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import Database from 'better-sqlite3';

const DATA_DIR = process.env.MASTER_ROOT
  ? path.join(process.env.MASTER_ROOT, 'mi-core', 'data')
  : path.join(process.cwd(), '..', 'data');

const PACKAGES_DIR = path.join(DATA_DIR, 'doordash-agent', 'packages');
const DB_PATH      = path.join(DATA_DIR, 'qb-agent.db');

// ── Database ──────────────────────────────────────────────────────────────────

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    _db = new Database(DB_PATH);
    _db.exec(`
      CREATE TABLE IF NOT EXISTS dd_machine_syncs (
        machine_id   TEXT    NOT NULL,
        event_type   TEXT    NOT NULL,
        mi_version   TEXT    NOT NULL DEFAULT '',
        error        TEXT    NOT NULL DEFAULT '',
        hostname     TEXT    NOT NULL DEFAULT '',
        platform     TEXT    NOT NULL DEFAULT '',
        timestamp    TEXT    NOT NULL,
        created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS dd_machine_state (
        machine_id        TEXT PRIMARY KEY,
        current_version   TEXT NOT NULL DEFAULT '',
        last_sync_at      TEXT NOT NULL DEFAULT '',
        last_sync_status  TEXT NOT NULL DEFAULT '',
        last_error        TEXT NOT NULL DEFAULT '',
        hostname          TEXT NOT NULL DEFAULT '',
        platform          TEXT NOT NULL DEFAULT '',
        updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  }
  return _db;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MIPackageManifest {
  mi_version: string;
  policy_version: string;
  playbook_version: string;
  prompt_version: string;
  agent_id: string;
  published_at: string;
  published_by: string;
  change_notes: string;
  checksum: string;
  guardrails: Record<string, unknown>;
  campaign_playbooks: Record<string, unknown>;
  menu_playbooks: Record<string, unknown>;
  photo_standards: Record<string, unknown>;
  store_config: Record<string, unknown>;
  approval_policies: Record<string, unknown>;
  execution_policies: Record<string, unknown>;
  prompts: Record<string, string>;
  learning_history: unknown[];
}

export interface MachineSyncEvent {
  machine_id: string;
  event_type: 'SYNC_CHECK' | 'SYNC_APPLIED' | 'SYNC_FAILED' | 'SYNC_ROLLBACK' | 'SYNC_UP_TO_DATE';
  mi_version?: string;
  error?: string;
  hostname?: string;
  platform?: string;
  timestamp: string;
}

// ── Package file management ───────────────────────────────────────────────────

export function listVersions(): string[] {
  if (!fs.existsSync(PACKAGES_DIR)) return [];
  return fs.readdirSync(PACKAGES_DIR)
    .filter(d => fs.statSync(path.join(PACKAGES_DIR, d)).isDirectory())
    .sort((a, b) => {
      // semver sort descending
      const pa = a.split('.').map(Number);
      const pb = b.split('.').map(Number);
      for (let i = 0; i < 3; i++) {
        if ((pb[i] ?? 0) !== (pa[i] ?? 0)) return (pb[i] ?? 0) - (pa[i] ?? 0);
      }
      return 0;
    });
}

export function getPackage(version: string): MIPackageManifest | null {
  const pkgPath = path.join(PACKAGES_DIR, version, 'package.json');
  if (!fs.existsSync(pkgPath)) return null;
  try {
    const raw = fs.readFileSync(pkgPath, 'utf8');
    const pkg = JSON.parse(raw) as MIPackageManifest;
    // Compute real checksum for packages that have placeholder
    if (pkg.checksum === '__COMPUTED_ON_PUBLISH__') {
      pkg.checksum = computeChecksum(raw.replace('"__COMPUTED_ON_PUBLISH__"', '"—"'));
    }
    return pkg;
  } catch {
    return null;
  }
}

export function getLatestPackage(): MIPackageManifest | null {
  const versions = listVersions();
  if (versions.length === 0) return null;
  return getPackage(versions[0]);
}

export function publishPackage(pkg: any): { ok: boolean; version: string; checksum: string } {
  // Compute checksum with checksum field zeroed out (consistent with agent verification)
  const forHash = { ...pkg, checksum: '' };
  const checksum = computeChecksum(JSON.stringify(forHash, null, 2));
  const full = { ...pkg, checksum };
  const versionDir = path.join(PACKAGES_DIR, pkg.mi_version);
  fs.mkdirSync(versionDir, { recursive: true });
  fs.writeFileSync(path.join(versionDir, 'package.json'), JSON.stringify(full, null, 2), 'utf8');
  return { ok: true, version: pkg.mi_version, checksum };
}

function computeChecksum(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

// ── Machine sync tracking ─────────────────────────────────────────────────────

export function recordMachineSyncEvent(event: MachineSyncEvent): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO dd_machine_syncs (machine_id, event_type, mi_version, error, hostname, platform, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    event.machine_id, event.event_type,
    event.mi_version ?? '',
    event.error ?? '',
    event.hostname ?? '',
    event.platform ?? '',
    event.timestamp,
  );

  const status = event.event_type === 'SYNC_APPLIED' ? 'ok'
    : event.event_type === 'SYNC_FAILED' ? 'error'
    : event.event_type === 'SYNC_ROLLBACK' ? 'rollback'
    : 'ok';

  const existing = db.prepare('SELECT machine_id FROM dd_machine_state WHERE machine_id = ?').get(event.machine_id);
  if (existing) {
    db.prepare(`
      UPDATE dd_machine_state SET
        current_version  = CASE WHEN ? = 'SYNC_APPLIED' THEN ? ELSE current_version END,
        last_sync_at     = ?,
        last_sync_status = ?,
        last_error       = ?,
        hostname         = CASE WHEN ? != '' THEN ? ELSE hostname END,
        platform         = CASE WHEN ? != '' THEN ? ELSE platform END,
        updated_at       = datetime('now')
      WHERE machine_id = ?
    `).run(
      event.event_type, event.mi_version ?? '',
      event.timestamp,
      status,
      event.error ?? '',
      event.hostname ?? '', event.hostname ?? '',
      event.platform ?? '', event.platform ?? '',
      event.machine_id,
    );
  } else {
    db.prepare(`
      INSERT INTO dd_machine_state (machine_id, current_version, last_sync_at, last_sync_status, last_error, hostname, platform)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      event.machine_id,
      event.event_type === 'SYNC_APPLIED' ? (event.mi_version ?? '') : '',
      event.timestamp,
      status,
      event.error ?? '',
      event.hostname ?? '',
      event.platform ?? '',
    );
  }
}

export function getMachineStates(): unknown[] {
  return getDb().prepare('SELECT * FROM dd_machine_state ORDER BY updated_at DESC').all();
}

export function getMachineSyncHistory(machine_id?: string, limit = 50): unknown[] {
  const db = getDb();
  if (machine_id) {
    return db.prepare(
      'SELECT * FROM dd_machine_syncs WHERE machine_id = ? ORDER BY rowid DESC LIMIT ?'
    ).all(machine_id, limit);
  }
  return db.prepare('SELECT * FROM dd_machine_syncs ORDER BY rowid DESC LIMIT ?').all(limit);
}
