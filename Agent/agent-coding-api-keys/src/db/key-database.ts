/**
 * Antigravity Gateway — API Key Database
 *
 * Uses Node.js built-in SQLite (node:sqlite, available in Node ≥ 22.5).
 * No external dependencies.
 *
 * Key values are encrypted at rest using AES-256-GCM.
 * Encryption key is derived from ENCRYPTION_KEY env var (or a stable default).
 *
 * Tables:
 *   provider_api_keys   — key records
 *   admin_activity_logs — audit trail
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — node:sqlite is experimental; types not yet in @types/node
import { DatabaseSync } from 'node:sqlite';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// ── Encryption ───────────────────────────────────────────────────────────────

const ENCRYPTION_KEY = process.env['ENCRYPTION_KEY'] ?? 'antigravity-default-dev-key-change-in-prod';
// Derive a stable 32-byte key from the passphrase
const AES_KEY = scryptSync(ENCRYPTION_KEY, 'ag-salt-v1', 32);
const ALGO = 'aes-256-gcm' as const;

function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, AES_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format: iv(12):authTag(16):ciphertext — all hex
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
}

function decrypt(stored: string): string {
  const [ivHex, tagHex, cipherHex] = stored.split(':');
  if (!ivHex || !tagHex || !cipherHex) throw new Error('Invalid encrypted value format');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(tagHex, 'hex');
  const encrypted = Buffer.from(cipherHex, 'hex');
  const decipher = createDecipheriv(ALGO, AES_KEY, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final('utf8');
}

// ── Types ────────────────────────────────────────────────────────────────────

export type KeyStatus = 'healthy' | 'rate_limited' | 'quota_exhausted' | 'auth_failed' | 'provider_down' | 'timeout' | 'disabled' | 'expired' | 'pending';

export interface ProviderKeyRow {
  id: number;
  provider_name: string;
  key_name: string;
  api_key_encrypted: string;
  enabled: number;          // 0 | 1
  weight: number;
  priority: number;
  status: KeyStatus;
  quota_limit: number | null;
  quota_used: number;
  quota_remaining: number | null;
  last_success_at: number | null;
  last_failure_at: number | null;
  last_error: string | null;
  expires_at: number | null;
  created_by: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

export interface ProviderKeyPublic extends Omit<ProviderKeyRow, 'api_key_encrypted'> {
  masked_key: string;
}

export interface CreateKeyInput {
  provider_name: string;
  key_name: string;
  api_key: string;
  enabled?: boolean;
  weight?: number;
  priority?: number;
  quota_limit?: number | null;
  expires_at?: number | null;
  created_by?: string;
}

export interface UpdateKeyInput {
  key_name?: string;
  api_key?: string;
  enabled?: boolean;
  weight?: number;
  priority?: number;
  quota_limit?: number | null;
  expires_at?: number | null;
}

export interface ActivityLogRow {
  id: number;
  key_id: number | null;
  provider_name: string | null;
  action: string;
  detail: string | null;
  performed_by: string;
  performed_at: number;
}

// ── Schema ───────────────────────────────────────────────────────────────────

const SCHEMA = `
CREATE TABLE IF NOT EXISTS provider_api_keys (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_name     TEXT    NOT NULL,
  key_name          TEXT    NOT NULL,
  api_key_encrypted TEXT    NOT NULL,
  enabled           INTEGER NOT NULL DEFAULT 1,
  weight            INTEGER NOT NULL DEFAULT 1,
  priority          INTEGER NOT NULL DEFAULT 10,
  status            TEXT    NOT NULL DEFAULT 'pending',
  quota_limit       INTEGER,
  quota_used        INTEGER NOT NULL DEFAULT 0,
  quota_remaining   INTEGER,
  last_success_at   INTEGER,
  last_failure_at   INTEGER,
  last_error        TEXT,
  expires_at        INTEGER,
  created_by        TEXT    NOT NULL DEFAULT 'system',
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  deleted_at        INTEGER
);

CREATE INDEX IF NOT EXISTS idx_pak_provider ON provider_api_keys(provider_name);
CREATE INDEX IF NOT EXISTS idx_pak_enabled  ON provider_api_keys(enabled);
CREATE INDEX IF NOT EXISTS idx_pak_status   ON provider_api_keys(status);

CREATE TABLE IF NOT EXISTS admin_activity_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  key_id        INTEGER,
  provider_name TEXT,
  action        TEXT NOT NULL,
  detail        TEXT,
  performed_by  TEXT NOT NULL DEFAULT 'system',
  performed_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_aal_key      ON admin_activity_logs(key_id);
CREATE INDEX IF NOT EXISTS idx_aal_provider ON admin_activity_logs(provider_name);
`;

// ── Database class ───────────────────────────────────────────────────────────

export class KeyDatabase {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly db: any;

  constructor(dbPath?: string) {
    const dir = join(process.cwd(), 'data');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const path = dbPath ?? join(dir, 'provider-keys.db');
    this.db = new (DatabaseSync as unknown as new (p: string) => unknown)(path) as {
      exec(sql: string): void;
      prepare(sql: string): {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        run(...args: unknown[]): { lastInsertRowid: number; changes: number };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        all(...args: unknown[]): unknown[];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        get(...args: unknown[]): unknown;
      };
    };
    this.db.exec(SCHEMA);
    console.log('[key-db] SQLite database ready:', path);
  }

  // ── CRUD: Keys ────────────────────────────────────────────────────────────

  createKey(input: CreateKeyInput, performedBy = 'system'): ProviderKeyPublic {
    const now = Date.now();
    const encrypted = encrypt(input.api_key);
    const stmt = this.db.prepare(`
      INSERT INTO provider_api_keys
        (provider_name, key_name, api_key_encrypted, enabled, weight, priority,
         status, quota_limit, quota_remaining, expires_at, created_by, created_at, updated_at)
      VALUES (?,?,?,?,?,?, 'pending',?,?,?,?,?,?)
    `);
    const result = stmt.run(
      input.provider_name, input.key_name, encrypted,
      input.enabled !== false ? 1 : 0,
      input.weight ?? 1, input.priority ?? 10,
      input.quota_limit ?? null,
      input.quota_limit ?? null,
      input.expires_at ?? null,
      input.created_by ?? performedBy,
      now, now,
    );
    const id = result.lastInsertRowid as number;
    this.audit(id, input.provider_name, 'key_created', `Key "${input.key_name}" created`, performedBy);
    return this.getPublic(id)!;
  }

  updateKey(id: number, input: UpdateKeyInput, performedBy = 'system'): ProviderKeyPublic | null {
    const row = this.getRaw(id);
    if (!row) return null;

    const now = Date.now();
    const fields: string[] = ['updated_at = ?'];
    const values: unknown[] = [now];

    if (input.key_name !== undefined)  { fields.push('key_name = ?');          values.push(input.key_name); }
    if (input.api_key !== undefined)   { fields.push('api_key_encrypted = ?');  values.push(encrypt(input.api_key)); }
    if (input.enabled !== undefined)   { fields.push('enabled = ?');            values.push(input.enabled ? 1 : 0); }
    if (input.weight !== undefined)    { fields.push('weight = ?');             values.push(input.weight); }
    if (input.priority !== undefined)  { fields.push('priority = ?');           values.push(input.priority); }
    if (input.quota_limit !== undefined) {
      fields.push('quota_limit = ?', 'quota_remaining = ?');
      values.push(input.quota_limit, input.quota_limit);
    }
    if (input.expires_at !== undefined) { fields.push('expires_at = ?'); values.push(input.expires_at); }

    values.push(id);
    this.db.prepare(`UPDATE provider_api_keys SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    this.audit(id, row.provider_name as string, 'key_updated', JSON.stringify(Object.keys(input)), performedBy);
    return this.getPublic(id);
  }

  enableKey(id: number, performedBy = 'system'): void {
    this.db.prepare(`UPDATE provider_api_keys SET enabled = 1, status = 'healthy', updated_at = ? WHERE id = ?`).run(Date.now(), id);
    const row = this.getRaw(id);
    this.audit(id, row?.provider_name as string, 'key_enabled', null, performedBy);
  }

  disableKey(id: number, performedBy = 'system'): void {
    this.db.prepare(`UPDATE provider_api_keys SET enabled = 0, status = 'disabled', updated_at = ? WHERE id = ?`).run(Date.now(), id);
    const row = this.getRaw(id);
    this.audit(id, row?.provider_name as string, 'key_disabled', null, performedBy);
  }

  softDelete(id: number, performedBy = 'system'): void {
    const now = Date.now();
    this.db.prepare(`UPDATE provider_api_keys SET deleted_at = ?, enabled = 0, status = 'disabled', updated_at = ? WHERE id = ?`).run(now, now, id);
    const row = this.getRaw(id);
    this.audit(id, row?.provider_name as string, 'key_deleted', 'soft delete', performedBy);
  }

  // ── Runtime status updates (called by router) ─────────────────────────────

  recordSuccess(id: number): void {
    this.db.prepare(`
      UPDATE provider_api_keys
      SET last_success_at = ?, status = 'healthy', quota_used = quota_used + 1,
          quota_remaining = CASE WHEN quota_limit IS NOT NULL THEN MAX(0, quota_remaining - 1) ELSE NULL END,
          updated_at = ?
      WHERE id = ?
    `).run(Date.now(), Date.now(), id);
  }

  recordFailure(id: number, errorType: string, message: string): void {
    this.db.prepare(`
      UPDATE provider_api_keys
      SET last_failure_at = ?, last_error = ?, status = ?, updated_at = ?
      WHERE id = ?
    `).run(Date.now(), message.slice(0, 300), errorType, Date.now(), id);
  }

  /** Mark all keys with expires_at < now as expired. Called periodically. */
  expireStaleKeys(): number {
    const result = this.db.prepare(`
      UPDATE provider_api_keys
      SET status = 'expired', enabled = 0, updated_at = ?
      WHERE expires_at IS NOT NULL AND expires_at < ? AND deleted_at IS NULL AND status != 'expired'
    `).run(Date.now(), Date.now());
    return result.changes as number;
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  /** All active (non-deleted) keys for a provider, ordered by priority then weight. */
  getActiveKeysForProvider(providerName: string): Array<ProviderKeyRow & { decrypted_key: string }> {
    const rows = this.db.prepare(`
      SELECT * FROM provider_api_keys
      WHERE provider_name = ? AND deleted_at IS NULL
      ORDER BY priority ASC, weight DESC, id ASC
    `).all(providerName) as ProviderKeyRow[];

    return rows.map((r) => ({
      ...r,
      decrypted_key: this.safeDecrypt(r.api_key_encrypted, r.id),
    }));
  }

  /** All enabled + non-expired keys for a provider (used by router). */
  getUsableKeys(providerName: string): Array<{ id: number; keyId: string; value: string; priority: number; weight: number }> {
    const now = Date.now();
    const rows = this.db.prepare(`
      SELECT id, key_name, api_key_encrypted, priority, weight
      FROM provider_api_keys
      WHERE provider_name = ? AND enabled = 1 AND deleted_at IS NULL
        AND (
          status NOT IN ('auth_failed','disabled','expired')
          OR (
            status = 'auth_failed'
            AND last_error IS NOT NULL
            AND (
              lower(last_error) LIKE '%all available accounts exhausted%'
              OR lower(last_error) LIKE '%no available accounts%'
              OR lower(last_error) LIKE '%server_error%'
            )
          )
        )
        AND (expires_at IS NULL OR expires_at > ?)
      ORDER BY priority ASC, weight DESC, id ASC
    `).all(providerName, now) as Array<{ id: number; key_name: string; api_key_encrypted: string; priority: number; weight: number }>;

    return rows.map((r) => ({
      id: r.id,
      keyId: `db-${r.id}`,
      value: this.safeDecrypt(r.api_key_encrypted, r.id),
      priority: r.priority,
      weight: r.weight,
    }));
  }

  getAll(includeDeleted = false): ProviderKeyPublic[] {
    const sql = includeDeleted
      ? `SELECT * FROM provider_api_keys ORDER BY provider_name, priority ASC`
      : `SELECT * FROM provider_api_keys WHERE deleted_at IS NULL ORDER BY provider_name, priority ASC`;
    return (this.db.prepare(sql).all() as ProviderKeyRow[]).map((r) => this.toPublic(r));
  }

  getById(id: number): ProviderKeyPublic | null {
    return this.getPublic(id);
  }

  getProviderSummary(): Array<{ provider_name: string; total: number; healthy: number; disabled: number; expired: number }> {
    return this.db.prepare(`
      SELECT
        provider_name,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'healthy' AND enabled = 1 THEN 1 ELSE 0 END) as healthy,
        SUM(CASE WHEN status = 'disabled' OR enabled = 0 THEN 1 ELSE 0 END) as disabled,
        SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired
      FROM provider_api_keys
      WHERE deleted_at IS NULL
      GROUP BY provider_name
      ORDER BY provider_name
    `).all() as Array<{ provider_name: string; total: number; healthy: number; disabled: number; expired: number }>;
  }

  // ── Audit ─────────────────────────────────────────────────────────────────

  getAuditLog(limit = 100): ActivityLogRow[] {
    return this.db.prepare(`
      SELECT * FROM admin_activity_logs ORDER BY performed_at DESC LIMIT ?
    `).all(limit) as ActivityLogRow[];
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private getRaw(id: number): ProviderKeyRow | null {
    return (this.db.prepare('SELECT * FROM provider_api_keys WHERE id = ?').get(id) as ProviderKeyRow | undefined) ?? null;
  }

  private getPublic(id: number): ProviderKeyPublic | null {
    const row = this.getRaw(id);
    return row ? this.toPublic(row) : null;
  }

  private toPublic(row: ProviderKeyRow): ProviderKeyPublic {
    const { api_key_encrypted, ...rest } = row;
    return { ...rest, masked_key: this.maskEncrypted(api_key_encrypted) };
  }

  private maskEncrypted(encrypted: string): string {
    try {
      const plain = decrypt(encrypted);
      if (plain.length <= 8) return '***';
      return `${plain.slice(0, 6)}...${plain.slice(-4)}`;
    } catch {
      return '***';
    }
  }

  private safeDecrypt(encrypted: string, id: number): string {
    try {
      return decrypt(encrypted);
    } catch (err) {
      console.error(`[key-db] Failed to decrypt key id=${id}:`, err instanceof Error ? err.message : err);
      return '';
    }
  }

  private audit(keyId: number | null, providerName: string | null, action: string, detail: string | null, performedBy: string): void {
    this.db.prepare(`
      INSERT INTO admin_activity_logs (key_id, provider_name, action, detail, performed_by, performed_at)
      VALUES (?,?,?,?,?,?)
    `).run(keyId, providerName, action, detail, performedBy, Date.now());
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const keyDb = new KeyDatabase();
