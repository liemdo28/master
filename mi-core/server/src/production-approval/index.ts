/**
 * Phase 2D — Production Approval Gateway
 *
 * Phase 2B's policy-guard blocks ALL production actions (PRODUCTION_WRITE,
 * FINANCIAL_ACTION, etc.) unconditionally. Phase 2D is the human-in-the-loop
 * layer that lets a production action proceed ONLY when an explicit, audited,
 * short-lived approval token is issued by an authorized approver.
 *
 * Flow: requestApproval -> (human) -> grantApproval(token) -> verifyApproval(token) -> ALLOWED
 *
 * Safety guarantees (all enforced in code, all tested):
 *  - No token is ever auto-granted. Every grant requires an authorized approver.
 *  - Tokens are single-use (consumed on verify) and short-lived (expiry).
 *  - Scope-bound: a token for target X + action Y cannot authorize anything else.
 *  - Every request, grant, verify, deny is appended to an immutable audit log.
 *  - No real production system is touched. This is a pure decision layer.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type ProductionMode =
  | 'PRODUCTION_WRITE'
  | 'FINANCIAL_ACTION'
  | 'SECURITY_ACTION'
  | 'CREDENTIAL_ACTION';

export interface ApprovalRequest {
  id: string;
  objectiveId: string;
  requester: string;
  targetKey: string;
  actionKey: string;
  mode: ProductionMode;
  reason: string;
  status: 'pending' | 'granted' | 'denied' | 'expired' | 'consumed';
  createdAt: string;
  resolvedAt: string | null;
  token: string | null;
  ttlSeconds: number;
}

export interface ApprovalToken {
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

export interface VerifyResult {
  ok: boolean;
  status: 'ALLOWED' | 'NO_TOKEN' | 'EXPIRED' | 'CONSUMED' | 'REVOKED' | 'SCOPE_MISMATCH' | 'UNKNOWN';
  reason: string;
  requestId: string | null;
  approver: string | null;
  auditEventId: string;
}

export interface ApprovalAuditEvent {
  id: string;
  at: string;
  type: 'requested' | 'granted' | 'denied' | 'verified' | 'consumed' | 'revoked' | 'expired' | 'rejected_unknown_token';
  requestId: string | null;
  token: string | null;
  actor: string;
  detail: string;
}

export interface ApproverRecord {
  id: string;
  name: string;
  authorizedTargets: string[];
  maxTtlSeconds: number;
  active: boolean;
}

export interface ProductionApprovalDashboard {
  status: 'OPERATIONAL' | 'PARTIAL' | 'BLOCKED';
  approvers: number;
  pendingRequests: number;
  activeTokens: number;
  auditEvents: number;
  warnings: string[];
}

// ── In-memory registries (deterministic, no external deps) ───────────────────

const auditLog: ApprovalAuditEvent[] = [];
const requests = new Map<string, ApprovalRequest>();
const tokens = new Map<string, ApprovalToken>();
let eventCounter = 0;
let requestCounter = 0;

function nextEventId(): string { eventCounter++; return `AUD-${String(eventCounter).padStart(4, '0')}`; }
function nextRequestId(): string { requestCounter++; return `APR-${String(requestCounter).padStart(3, '0')}`; }
function mintToken(): string {
  return `TKN-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function nowISO(): string { return new Date().toISOString(); }
function audit(type: ApprovalAuditEvent['type'], requestId: string | null, token: string | null, actor: string, detail: string): ApprovalAuditEvent {
  const ev: ApprovalAuditEvent = { id: nextEventId(), at: nowISO(), type, requestId, token, actor, detail };
  auditLog.push(ev);
  return ev;
}

// ── Approvers ────────────────────────────────────────────────────────────────

const approvers = new Map<string, ApproverRecord>([
  ['ceo', {
    id: 'ceo', name: 'CEO',
    authorizedTargets: ['doordash', 'quickbooks', 'toast', 'google_business_profile', 'website', 'payroll', 'banking'],
    maxTtlSeconds: 600, active: true,
  }],
  ['cfo', {
    id: 'cfo', name: 'CFO',
    authorizedTargets: ['quickbooks', 'banking', 'payroll', 'toast'],
    maxTtlSeconds: 300, active: true,
  }],
]);

export function getApprovers(): ApproverRecord[] { return Array.from(approvers.values()); }

export function isAuthorizedApprover(approverId: string, targetKey: string): boolean {
  const a = approvers.get(approverId);
  return !!a && a.active && a.authorizedTargets.includes(targetKey);
}

// ── Request / Grant / Deny / Revoke ──────────────────────────────────────────

export function requestApproval(params: {
  objectiveId: string;
  requester: string;
  targetKey: string;
  actionKey: string;
  mode: ProductionMode;
  reason: string;
  ttlSeconds?: number;
}): ApprovalRequest {
  const ttl = Math.max(1, Math.min(params.ttlSeconds ?? 300, 900));
  const req: ApprovalRequest = {
    id: nextRequestId(),
    objectiveId: params.objectiveId,
    requester: params.requester,
    targetKey: params.targetKey,
    actionKey: params.actionKey,
    mode: params.mode,
    reason: params.reason,
    status: 'pending',
    createdAt: nowISO(),
    resolvedAt: null,
    token: null,
    ttlSeconds: ttl,
  };
  requests.set(req.id, req);
  audit('requested', req.id, null, params.requester, `Requested ${req.mode} on ${req.targetKey}/${req.actionKey}`);
  return req;
}

export function grantApproval(requestId: string, approverId: string): { ok: boolean; request: ApprovalRequest | null; token: ApprovalToken | null; reason: string } {
  const req = requests.get(requestId);
  if (!req) return { ok: false, request: null, token: null, reason: 'Unknown request' };
  if (req.status !== 'pending') return { ok: false, request: req, token: null, reason: `Request already ${req.status}` };

  if (!isAuthorizedApprover(approverId, req.targetKey)) {
    audit('denied', req.id, null, approverId, `Not authorized for target ${req.targetKey}`);
    req.status = 'denied';
    req.resolvedAt = nowISO();
    return { ok: false, request: req, token: null, reason: `Approver ${approverId} not authorized for ${req.targetKey}` };
  }

  const approver = approvers.get(approverId)!;
  const ttl = Math.min(req.ttlSeconds, approver.maxTtlSeconds);
  const issuedAt = nowISO();
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
  const tokenStr = mintToken();

  const token: ApprovalToken = {
    token: tokenStr, requestId: req.id, approver: approverId,
    targetKey: req.targetKey, actionKey: req.actionKey, mode: req.mode,
    issuedAt, expiresAt, consumed: false, revoked: false,
  };
  tokens.set(tokenStr, token);

  req.status = 'granted';
  req.resolvedAt = issuedAt;
  req.token = tokenStr;
  audit('granted', req.id, tokenStr, approverId, `Granted for ${ttl}s`);
  return { ok: true, request: req, token, reason: 'Granted' };
}

export function denyApproval(requestId: string, approverId: string, reason: string): { ok: boolean; request: ApprovalRequest | null } {
  const req = requests.get(requestId);
  if (!req) return { ok: false, request: null };
  req.status = 'denied';
  req.resolvedAt = nowISO();
  audit('denied', req.id, null, approverId, reason);
  return { ok: true, request: req };
}

export function revokeToken(tokenStr: string, approverId: string): boolean {
  const t = tokens.get(tokenStr);
  if (!t) return false;
  t.revoked = true;
  audit('revoked', t.requestId, tokenStr, approverId, 'Token revoked');
  return true;
}

// ── Verify (the actual gate the operator calls before executing) ──────────────

export function verifyApproval(params: {
  token: string;
  targetKey: string;
  actionKey: string;
  mode: ProductionMode;
}): VerifyResult {
  const t = tokens.get(params.token);
  if (!t) {
    const ev = audit('rejected_unknown_token', null, params.token, 'system', 'Token not found');
    return { ok: false, status: 'UNKNOWN', reason: 'Token not found', requestId: null, approver: null, auditEventId: ev.id };
  }
  if (t.revoked) {
    const ev = audit('revoked', t.requestId, params.token, 'system', 'Token revoked');
    return { ok: false, status: 'REVOKED', reason: 'Token revoked', requestId: t.requestId, approver: t.approver, auditEventId: ev.id };
  }
  if (t.consumed) {
    const ev = audit('consumed', t.requestId, params.token, 'system', 'Token already consumed');
    return { ok: false, status: 'CONSUMED', reason: 'Token already consumed (single-use)', requestId: t.requestId, approver: t.approver, auditEventId: ev.id };
  }
  if (new Date(t.expiresAt).getTime() < Date.now()) {
    t.revoked = false;
    const req = requests.get(t.requestId);
    if (req) { req.status = 'expired'; req.resolvedAt = nowISO(); }
    const ev = audit('expired', t.requestId, params.token, 'system', 'Token expired');
    return { ok: false, status: 'EXPIRED', reason: 'Token expired', requestId: t.requestId, approver: t.approver, auditEventId: ev.id };
  }
  // Scope check: token must match target + action + mode exactly.
  if (t.targetKey !== params.targetKey || t.actionKey !== params.actionKey || t.mode !== params.mode) {
    const ev = audit('verified', t.requestId, params.token, 'system', `Scope mismatch: wanted ${params.targetKey}/${params.actionKey}/${params.mode}`);
    return { ok: false, status: 'SCOPE_MISMATCH', reason: 'Token scope does not match requested action', requestId: t.requestId, approver: t.approver, auditEventId: ev.id };
  }
  // Allow: consume the token (single-use).
  t.consumed = true;
  const req = requests.get(t.requestId);
  if (req) { req.status = 'consumed'; req.resolvedAt = nowISO(); }
  const ev = audit('verified', t.requestId, params.token, t.approver, `Allowed ${params.targetKey}/${params.actionKey}/${params.mode}`);
  return { ok: true, status: 'ALLOWED', reason: 'Approved action allowed', requestId: t.requestId, approver: t.approver, auditEventId: ev.id };
}

// ── Query / Dashboard / Bootstrap ────────────────────────────────────────────

export function getAuditLog(): ApprovalAuditEvent[] { return [...auditLog]; }
export function getPendingRequests(): ApprovalRequest[] { return Array.from(requests.values()).filter(r => r.status === 'pending'); }
export function getActiveTokens(): ApprovalToken[] { return Array.from(tokens.values()).filter(t => !t.consumed && !t.revoked); }
export function getRequest(id: string): ApprovalRequest | null { return requests.get(id) ?? null; }

export function buildProductionApprovalDashboard(): ProductionApprovalDashboard {
  const warnings: string[] = [];
  const pending = getPendingRequests();
  if (pending.length > 0) warnings.push(`${pending.length} approval request(s) pending human review.`);
  warnings.push('Every production action requires an audited, single-use, short-lived approval token.');
  warnings.push('No production SaaS system is touched by this layer — it is a pure decision/audit gate.');
  return {
    status: 'PARTIAL',
    approvers: approvers.size,
    pendingRequests: pending.length,
    activeTokens: getActiveTokens().length,
    auditEvents: auditLog.length,
    warnings,
  };
}

export function runProductionApprovalBootstrap() {
  const objectiveId = 'OBJ-PHASE-2D';
  // A demonstration request that mirrors the BO-005 pending campaign-launch from Phase 2C.
  const req = requestApproval({
    objectiveId,
    requester: 'marketing',
    targetKey: 'google_business_profile',
    actionKey: 'publish_campaign',
    mode: 'PRODUCTION_WRITE',
    reason: 'Publish Q3 campaign to Google Business Profile',
    ttlSeconds: 300,
  });
  const dashboard = buildProductionApprovalDashboard();
  return { objectiveId, request: req, dashboard };
}
