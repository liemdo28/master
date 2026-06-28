/**
 * mfa-handoff.ts — Phase 2D+ MFA Handoff gate.
 *
 * Before a production approval token is minted, the human approver must satisfy
 * a multi-factor challenge. A challenge is:
 *   - bound to a specific requestId + approverId (a code for one request can
 *     never authorize another),
 *   - single-use (consumed on first correct verify),
 *   - short-lived (default 120s),
 *   - never stored in plaintext (only a salted SHA-256 hash of the code is kept).
 *
 * In production the code is delivered out-of-band (SMS/authenticator). Here the
 * generated code is returned to the caller ONCE at issue time so an automated
 * runtime proof can complete the handshake; it is never recoverable afterwards.
 */
import { randomBytes, createHash, timingSafeEqual } from 'crypto';
import { DurableStore, resolveApprovalDataDir } from './durable-store';

export interface MfaChallenge {
  id: string;
  requestId: string;
  approverId: string;
  codeHash: string;
  salt: string;
  issuedAt: string;
  expiresAt: string;
  consumed: boolean;
  attempts: number;
}

export type MfaVerifyStatus = 'VERIFIED' | 'UNKNOWN' | 'EXPIRED' | 'CONSUMED' | 'LOCKED' | 'BOUND_MISMATCH' | 'CODE_MISMATCH';

const MAX_ATTEMPTS = 5;

function hashCode(code: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${code}`).digest('hex');
}

export class MfaHandoff {
  private store: DurableStore<MfaChallenge>;

  constructor(opts: { dataDir?: string } = {}) {
    this.store = new DurableStore<MfaChallenge>('mfa-challenges', resolveApprovalDataDir(opts.dataDir));
  }

  /** Issue a challenge. Returns the one-time code (only chance to read it). */
  issue(params: { requestId: string; approverId: string; ttlSeconds?: number }): { challenge: MfaChallenge; code: string } {
    const ttl = Math.max(30, Math.min(params.ttlSeconds ?? 120, 600));
    const code = String(randomBytes(4).readUInt32BE(0) % 1_000_000).padStart(6, '0');
    const salt = randomBytes(8).toString('hex');
    const challenge: MfaChallenge = {
      id: `MFA-${randomBytes(5).toString('hex')}`,
      requestId: params.requestId,
      approverId: params.approverId,
      codeHash: hashCode(code, salt),
      salt,
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
      consumed: false,
      attempts: 0,
    };
    this.store.insert(challenge);
    return { challenge, code };
  }

  verify(params: { challengeId: string; requestId: string; approverId: string; code: string }): { ok: boolean; status: MfaVerifyStatus } {
    const c = this.store.get(params.challengeId);
    if (!c) return { ok: false, status: 'UNKNOWN' };
    if (c.consumed) return { ok: false, status: 'CONSUMED' };
    if (c.attempts >= MAX_ATTEMPTS) return { ok: false, status: 'LOCKED' };
    if (new Date(c.expiresAt).getTime() < Date.now()) return { ok: false, status: 'EXPIRED' };
    if (c.requestId !== params.requestId || c.approverId !== params.approverId) {
      this.store.update(c.id, { attempts: c.attempts + 1 });
      return { ok: false, status: 'BOUND_MISMATCH' };
    }
    const candidate = Buffer.from(hashCode(params.code, c.salt));
    const expected = Buffer.from(c.codeHash);
    const match = candidate.length === expected.length && timingSafeEqual(candidate, expected);
    if (!match) {
      this.store.update(c.id, { attempts: c.attempts + 1 });
      return { ok: false, status: 'CODE_MISMATCH' };
    }
    this.store.update(c.id, { consumed: true, attempts: c.attempts + 1 });
    return { ok: true, status: 'VERIFIED' };
  }

  pending(): MfaChallenge[] {
    const now = Date.now();
    return this.store.filter((c) => !c.consumed && new Date(c.expiresAt).getTime() >= now);
  }
}
