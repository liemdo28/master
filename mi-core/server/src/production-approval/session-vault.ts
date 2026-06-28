/**
 * session-vault.ts — Phase 2D+ Session Vault.
 *
 * Production actions (e.g. updating a DoorDash menu, posting to GBP) need
 * credentials. The vault stores them ENCRYPTED AT REST (AES-256-GCM) and hands
 * back only opaque *handles*. Plaintext is never persisted and never returned
 * by listings — it is decrypted in-memory only when an authorized, MFA-gated
 * action explicitly redeems a handle.
 *
 * Key management: a 32-byte key is derived (scrypt) from MI_VAULT_KEY (or an
 * explicit opts.secret). A random per-vault salt is persisted so the same
 * secret reproduces the same key across restarts. If no secret is configured a
 * deterministic dev key is derived and `usingDevKey` is flagged so callers can
 * warn — secrets are still encrypted, just with a non-secret key in dev.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync, createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { resolveApprovalDataDir } from './durable-store';

export interface VaultRecordMeta {
  handle: string;
  label: string;
  targetKey: string;
  createdAt: string;
  lastUsedAt: string | null;
  useCount: number;
  revoked: boolean;
  fingerprint: string; // sha256(plaintext) prefix — lets callers verify identity without exposing the secret
}

interface VaultRecord extends VaultRecordMeta {
  iv: string;
  authTag: string;
  ciphertext: string;
}

interface VaultFile {
  salt: string;
  records: VaultRecord[];
}

const DEV_SECRET = 'mi-core-dev-vault-secret-not-for-production';

export class SessionVault {
  private path: string;
  private key: Buffer;
  readonly usingDevKey: boolean;
  private file: VaultFile;

  constructor(opts: { dataDir?: string; secret?: string } = {}) {
    const dataDir = resolveApprovalDataDir(opts.dataDir);
    this.path = join(dataDir, 'session-vault.json');
    this.file = this.loadOrInit(dataDir);

    const secret = opts.secret || process.env.MI_VAULT_KEY || '';
    this.usingDevKey = !secret;
    this.key = scryptSync(secret || DEV_SECRET, Buffer.from(this.file.salt, 'hex'), 32);
  }

  private loadOrInit(dataDir: string): VaultFile {
    try {
      if (existsSync(this.path)) {
        const parsed = JSON.parse(readFileSync(this.path, 'utf8')) as VaultFile;
        if (parsed && parsed.salt && Array.isArray(parsed.records)) return parsed;
      }
    } catch {
      /* fall through to init */
    }
    const fresh: VaultFile = { salt: randomBytes(16).toString('hex'), records: [] };
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(this.path, JSON.stringify(fresh, null, 2));
    return fresh;
  }

  private persist(): void {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify(this.file, null, 2));
  }

  private encrypt(plaintext: string): { iv: string; authTag: string; ciphertext: string } {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return { iv: iv.toString('hex'), authTag: cipher.getAuthTag().toString('hex'), ciphertext: ciphertext.toString('hex') };
  }

  private decrypt(rec: VaultRecord): string {
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(rec.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(rec.authTag, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(rec.ciphertext, 'hex')), decipher.final()]).toString('utf8');
  }

  /** Store a credential. Returns an opaque handle; the secret is never persisted in plaintext. */
  put(params: { label: string; targetKey: string; secret: string }): VaultRecordMeta {
    const handle = `VH-${randomBytes(6).toString('hex')}`;
    const { iv, authTag, ciphertext } = this.encrypt(params.secret);
    const rec: VaultRecord = {
      handle,
      label: params.label,
      targetKey: params.targetKey,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      useCount: 0,
      revoked: false,
      fingerprint: createHash('sha256').update(params.secret).digest('hex').slice(0, 12),
      iv,
      authTag,
      ciphertext,
    };
    this.file.records.push(rec);
    this.persist();
    return this.toMeta(rec);
  }

  /** Redeem a handle for the plaintext secret (decrypted in-memory). Audited by the caller. */
  redeem(handle: string, scopeTargetKey?: string): { ok: boolean; secret?: string; reason?: string } {
    const rec = this.file.records.find((r) => r.handle === handle);
    if (!rec) return { ok: false, reason: 'Unknown handle' };
    if (rec.revoked) return { ok: false, reason: 'Handle revoked' };
    if (scopeTargetKey && rec.targetKey !== scopeTargetKey) {
      return { ok: false, reason: `Handle is scoped to ${rec.targetKey}, not ${scopeTargetKey}` };
    }
    const secret = this.decrypt(rec);
    rec.useCount += 1;
    rec.lastUsedAt = new Date().toISOString();
    this.persist();
    return { ok: true, secret };
  }

  revoke(handle: string): boolean {
    const rec = this.file.records.find((r) => r.handle === handle);
    if (!rec) return false;
    rec.revoked = true;
    this.persist();
    return true;
  }

  /** Metadata only — never exposes ciphertext, iv, or plaintext. */
  list(): VaultRecordMeta[] {
    return this.file.records.map((r) => this.toMeta(r));
  }

  private toMeta(r: VaultRecord): VaultRecordMeta {
    return {
      handle: r.handle,
      label: r.label,
      targetKey: r.targetKey,
      createdAt: r.createdAt,
      lastUsedAt: r.lastUsedAt,
      useCount: r.useCount,
      revoked: r.revoked,
      fingerprint: r.fingerprint,
    };
  }
}
