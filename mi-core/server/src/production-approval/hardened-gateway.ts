/**
 * hardened-gateway.ts — Phase 2D+ Production Approval Gateway (hardened).
 *
 * Phase 2D proved the decision/audit gate but deferred three things to "2D+":
 *   1. Session Vault        — credentials encrypted at rest, handed out as handles.
 *   2. MFA Handoff          — approver must clear a multi-factor challenge before grant.
 *   3. Durable persistence  — requests/tokens/audit survive process restart.
 *
 * This gateway composes all three while preserving every Phase 2D guarantee:
 * tokens are single-use, short-lived, scope-bound, and every action is appended
 * to an immutable, durable audit log. Approver authorization policy is reused
 * from the Phase 2D module (single source of truth). No production system is
 * touched — credentials are redeemed only as masked references in results.
 */
import { randomBytes } from 'crypto';
import type { ProductionMode } from './index';
import { isAuthorizedApprover, getApprovers } from './index';
import { DurableStore, resolveApprovalDataDir } from './durable-store';
import { SessionVault } from './session-vault';
import { MfaHandoff } from './mfa-handoff';

export interface HardenedRequest {
  id: string;
  objectiveId: string;
  requester: string;
  targetKey: string;
  actionKey: string;
  mode: ProductionMode;
  reason: string;
  vaultHandle: string | null;
  status: 'pending' | 'mfa_pending' | 'granted' | 'denied' | 'expired' | 'consumed';
  createdAt: string;
  resolvedAt: string | null;
  ttlSeconds: number;
  challengeId: string | null;
  token: string | null;
}

export interface HardenedToken {
  id: string; // === token string (DurableStore key)
  token: string;
  requestId: string;
  approver: string;
  targetKey: string;
  actionKey: string;
  mode: ProductionMode;
  issuedAt: string;
  expiresAt: string;
  consumed: boolean;
  revoked: boolean;
}

export interface HardenedAuditEvent {
  id: string;
  at: string;
  type:
    | 'requested' | 'mfa_issued' | 'mfa_failed' | 'granted' | 'denied'
    | 'verified' | 'consumed' | 'revoked' | 'expired' | 'scope_mismatch'
    | 'rejected_unknown_token' | 'credential_redeemed';
  requestId: string | null;
  token: string | null;
  actor: string;
  detail: string;
}

export interface HardenedVerifyResult {
  ok: boolean;
  status: 'ALLOWED' | 'NO_TOKEN' | 'EXPIRED' | 'CONSUMED' | 'REVOKED' | 'SCOPE_MISMATCH' | 'UNKNOWN';
  reason: string;
  requestId: string | null;
  approver: string | null;
  /** masked credential reference (fingerprint), never the plaintext secret */
  credentialRef: string | null;
  auditEventId: string;
}

export class HardenedApprovalGateway {
  private requests: DurableStore<HardenedRequest>;
  private tokens: DurableStore<HardenedToken>;
  private auditLog: DurableStore<HardenedAuditEvent>;
  readonly vault: SessionVault;
  readonly mfa: MfaHandoff;
  private reqCounter = 0;

  constructor(opts: { dataDir?: string; vaultSecret?: string } = {}) {
    const dataDir = resolveApprovalDataDir(opts.dataDir);
    this.requests = new DurableStore<HardenedRequest>('hardened-requests', dataDir);
    this.tokens = new DurableStore<HardenedToken>('hardened-tokens', dataDir);
    this.auditLog = new DurableStore<HardenedAuditEvent>('hardened-audit', dataDir);
    this.vault = new SessionVault({ dataDir, secret: opts.vaultSecret });
    this.mfa = new MfaHandoff({ dataDir });
    // Restore request counter from durable state so ids stay unique across restarts.
    this.reqCounter = this.requests.count();
  }

  private audit(type: HardenedAuditEvent['type'], requestId: string | null, token: string | null, actor: string, detail: string): HardenedAuditEvent {
    return this.auditLog.insert({
      id: `HAUD-${randomBytes(5).toString('hex')}`,
      at: new Date().toISOString(),
      type,
      requestId,
      token,
      actor,
      detail,
    });
  }

  // ── Step 1: request ─────────────────────────────────────────────────────────
  requestApproval(params: {
    objectiveId: string;
    requester: string;
    targetKey: string;
    actionKey: string;
    mode: ProductionMode;
    reason: string;
    ttlSeconds?: number;
    vaultHandle?: string;
  }): HardenedRequest {
    this.reqCounter += 1;
    const req: HardenedRequest = {
      id: `HAPR-${String(this.reqCounter).padStart(4, '0')}-${randomBytes(2).toString('hex')}`,
      objectiveId: params.objectiveId,
      requester: params.requester,
      targetKey: params.targetKey,
      actionKey: params.actionKey,
      mode: params.mode,
      reason: params.reason,
      vaultHandle: params.vaultHandle ?? null,
      status: 'pending',
      createdAt: new Date().toISOString(),
      resolvedAt: null,
      ttlSeconds: Math.max(1, Math.min(params.ttlSeconds ?? 300, 900)),
      challengeId: null,
      token: null,
    };
    this.requests.insert(req);
    this.audit('requested', req.id, null, params.requester, `Requested ${req.mode} on ${req.targetKey}/${req.actionKey}`);
    return req;
  }

  // ── Step 2: initiate grant -> issue MFA challenge ────────────────────────────
  initiateGrant(requestId: string, approverId: string): { ok: boolean; challengeId: string | null; code: string | null; reason: string } {
    const req = this.requests.get(requestId);
    if (!req) return { ok: false, challengeId: null, code: null, reason: 'Unknown request' };
    if (req.status !== 'pending') return { ok: false, challengeId: null, code: null, reason: `Request already ${req.status}` };
    if (!isAuthorizedApprover(approverId, req.targetKey)) {
      this.requests.update(req.id, { status: 'denied', resolvedAt: new Date().toISOString() });
      this.audit('denied', req.id, null, approverId, `Not authorized for target ${req.targetKey}`);
      return { ok: false, challengeId: null, code: null, reason: `Approver ${approverId} not authorized for ${req.targetKey}` };
    }
    const { challenge, code } = this.mfa.issue({ requestId: req.id, approverId });
    this.requests.update(req.id, { status: 'mfa_pending', challengeId: challenge.id });
    this.audit('mfa_issued', req.id, null, approverId, `MFA challenge ${challenge.id} issued`);
    return { ok: true, challengeId: challenge.id, code, reason: 'MFA challenge issued' };
  }

  // ── Step 3: complete grant -> verify MFA -> mint durable token ───────────────
  completeGrant(params: { requestId: string; approverId: string; code: string }): { ok: boolean; token: HardenedToken | null; reason: string } {
    const req = this.requests.get(params.requestId);
    if (!req) return { ok: false, token: null, reason: 'Unknown request' };
    if (req.status !== 'mfa_pending' || !req.challengeId) return { ok: false, token: null, reason: `Request not awaiting MFA (status ${req.status})` };

    const mfaResult = this.mfa.verify({ challengeId: req.challengeId, requestId: req.id, approverId: params.approverId, code: params.code });
    if (!mfaResult.ok) {
      this.audit('mfa_failed', req.id, null, params.approverId, `MFA ${mfaResult.status}`);
      return { ok: false, token: null, reason: `MFA failed: ${mfaResult.status}` };
    }

    const approver = getApprovers().find((a) => a.id === params.approverId)!;
    const ttl = Math.min(req.ttlSeconds, approver.maxTtlSeconds);
    const tokenStr = `HTKN-${Date.now().toString(36)}-${randomBytes(5).toString('hex')}`;
    const token: HardenedToken = {
      id: tokenStr,
      token: tokenStr,
      requestId: req.id,
      approver: params.approverId,
      targetKey: req.targetKey,
      actionKey: req.actionKey,
      mode: req.mode,
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
      consumed: false,
      revoked: false,
    };
    this.tokens.insert(token);
    this.requests.update(req.id, { status: 'granted', resolvedAt: new Date().toISOString(), token: tokenStr });
    this.audit('granted', req.id, tokenStr, params.approverId, `Granted for ${ttl}s after MFA`);
    return { ok: true, token, reason: 'Granted' };
  }

  // ── Step 4: verify (the gate the operator calls before executing) ────────────
  verify(params: { token: string; targetKey: string; actionKey: string; mode: ProductionMode }): HardenedVerifyResult {
    const t = this.tokens.get(params.token);
    const fail = (status: HardenedVerifyResult['status'], reason: string, evType: HardenedAuditEvent['type'], approver: string | null, requestId: string | null): HardenedVerifyResult => {
      const ev = this.audit(evType, requestId, params.token, 'system', reason);
      return { ok: false, status, reason, requestId, approver, credentialRef: null, auditEventId: ev.id };
    };

    if (!t) return fail('UNKNOWN', 'Token not found', 'rejected_unknown_token', null, null);
    if (t.revoked) return fail('REVOKED', 'Token revoked', 'revoked', t.approver, t.requestId);
    if (t.consumed) return fail('CONSUMED', 'Token already consumed (single-use)', 'consumed', t.approver, t.requestId);
    if (new Date(t.expiresAt).getTime() < Date.now()) {
      this.requests.update(t.requestId, { status: 'expired', resolvedAt: new Date().toISOString() });
      return fail('EXPIRED', 'Token expired', 'expired', t.approver, t.requestId);
    }
    if (t.targetKey !== params.targetKey || t.actionKey !== params.actionKey || t.mode !== params.mode) {
      return fail('SCOPE_MISMATCH', 'Token scope does not match requested action', 'scope_mismatch', t.approver, t.requestId);
    }

    // Allow: consume (single-use) + redeem the bound credential as a masked ref.
    this.tokens.update(t.token, { consumed: true });
    this.requests.update(t.requestId, { status: 'consumed', resolvedAt: new Date().toISOString() });
    let credentialRef: string | null = null;
    const req = this.requests.get(t.requestId);
    if (req?.vaultHandle) {
      const redeemed = this.vault.redeem(req.vaultHandle, t.targetKey);
      if (redeemed.ok) {
        const meta = this.vault.list().find((m) => m.handle === req.vaultHandle);
        credentialRef = meta ? `vault:${meta.handle}#${meta.fingerprint}` : `vault:${req.vaultHandle}`;
        this.audit('credential_redeemed', t.requestId, t.token, t.approver, `Redeemed ${req.vaultHandle} for ${t.targetKey}`);
      }
    }
    const ev = this.audit('verified', t.requestId, t.token, t.approver, `Allowed ${params.targetKey}/${params.actionKey}/${params.mode}`);
    return { ok: true, status: 'ALLOWED', reason: 'Approved action allowed', requestId: t.requestId, approver: t.approver, credentialRef, auditEventId: ev.id };
  }

  revokeToken(tokenStr: string, approverId: string): boolean {
    const t = this.tokens.get(tokenStr);
    if (!t) return false;
    this.tokens.update(t.token, { revoked: true });
    this.audit('revoked', t.requestId, tokenStr, approverId, 'Token revoked');
    return true;
  }

  // ── Query / Dashboard ────────────────────────────────────────────────────────
  getRequest(id: string): HardenedRequest | null { return this.requests.get(id); }
  getAuditLog(): HardenedAuditEvent[] { return this.auditLog.all(); }
  getActiveTokens(): HardenedToken[] { return this.tokens.filter((t) => !t.consumed && !t.revoked); }
  getPendingRequests(): HardenedRequest[] { return this.requests.filter((r) => r.status === 'pending' || r.status === 'mfa_pending'); }

  dashboard(): {
    status: 'OPERATIONAL';
    durable: boolean;
    vaultEntries: number;
    vaultUsingDevKey: boolean;
    pendingRequests: number;
    activeTokens: number;
    auditEvents: number;
    guarantees: string[];
  } {
    return {
      status: 'OPERATIONAL',
      durable: true,
      vaultEntries: this.vault.list().length,
      vaultUsingDevKey: this.vault.usingDevKey,
      pendingRequests: this.getPendingRequests().length,
      activeTokens: this.getActiveTokens().length,
      auditEvents: this.auditLog.count(),
      guarantees: [
        'Credentials encrypted at rest (AES-256-GCM); only handles are exposed.',
        'Every grant requires an MFA challenge bound to request + approver.',
        'Tokens are single-use, short-lived, scope-bound.',
        'Requests, tokens, MFA challenges, and audit log are durable across restart.',
      ],
    };
  }
}
