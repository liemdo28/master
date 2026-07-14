import type { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getAuthSessionFromBearerRequest, type AuthSession, type MiRole } from '../routes/auth';
import { getSeoDb } from './seo-db';
import { validateSeoApproval, hashPayload, type SeoApprovalExpectation } from './seo-approval-binding';

export type SeoPermission =
  | 'view'
  | 'create_keyword'
  | 'create_brief'
  | 'generate_article_draft'
  | 'edit_draft'
  | 'run_audit'
  | 'create_gbp_post_draft'
  | 'create_backlink_evaluation'
  | 'approve_non_production'
  | 'manage_schedule'
  | 'manage_connectors'
  | 'manage_brand_config'
  | 'production_approval'
  | 'policy_approval'
  | 'rollback_approval'
  | 'gbp_core_data_approval';

const ROLE_PERMISSIONS: Record<MiRole, Set<SeoPermission>> = {
  SEO_VIEWER: new Set(['view']),
  SEO_MANAGER: new Set([
    'view',
    'create_keyword',
    'create_brief',
    'generate_article_draft',
    'edit_draft',
    'run_audit',
    'create_gbp_post_draft',
    'create_backlink_evaluation',
  ]),
  ADMIN: new Set([
    'view',
    'create_keyword',
    'create_brief',
    'generate_article_draft',
    'edit_draft',
    'run_audit',
    'create_gbp_post_draft',
    'create_backlink_evaluation',
    'approve_non_production',
    'manage_schedule',
    'manage_connectors',
    'manage_brand_config',
  ]),
  CEO: new Set([
    'view',
    'create_keyword',
    'create_brief',
    'generate_article_draft',
    'edit_draft',
    'run_audit',
    'create_gbp_post_draft',
    'create_backlink_evaluation',
    'approve_non_production',
    'manage_schedule',
    'manage_connectors',
    'manage_brand_config',
    'production_approval',
    'policy_approval',
    'rollback_approval',
    'gbp_core_data_approval',
  ]),
};

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
function auditPath(): string {
  return process.env.SEO_SECURITY_AUDIT_PATH ||
    path.resolve(__dirname, '../../..', 'reports', 'evidence', 'seo-security', 'seo-auth-audit.jsonl');
}
const APPROVAL_TTL_MS = Number(process.env.SEO_APPROVAL_TTL_MS || 24 * 60 * 60 * 1000);

interface SeoAccessDecision {
  permission: SeoPermission;
  highRisk: boolean;
  csrfRequired: boolean;
  approvalRequired: boolean;
  approvalCategory?: string;
  approvalAction?: string;
  resourceType?: string;
  routeKey: string;
}

function sessionHash(session?: AuthSession | null): string | null {
  if (!session) return null;
  return crypto.createHash('sha256').update(session.token).digest('hex').slice(0, 16);
}

function appendAudit(event: Record<string, unknown>): boolean {
  if (process.env.SEO_SECURITY_TEST_MODE === '1' && process.env.SEO_AUDIT_FAIL_FOR_TEST === '1') {
    return false;
  }
  try {
    const AUDIT_PATH = auditPath();
    fs.mkdirSync(path.dirname(AUDIT_PATH), { recursive: true });
    fs.appendFileSync(AUDIT_PATH, JSON.stringify({ timestamp: new Date().toISOString(), ...event }) + '\n');
    return true;
  } catch {
    return false;
  }
}

function deny(req: Request, res: Response, status: number, code: string, session?: AuthSession | null, decision?: Partial<SeoAccessDecision>, resource?: SeoScopedResource | null): void {
  appendAudit({
    event: 'seo_auth_denied',
    decision: 'deny',
    status,
    code,
    role: session?.role || null,
    actor_id_hash: session?.actor_id ? crypto.createHash('sha256').update(session.actor_id).digest('hex').slice(0, 16) : null,
    session_hash: sessionHash(session),
    method: req.method,
    route: decision?.routeKey || normalizePath(req),
    path: req.originalUrl || req.url,
    resource_id: resource?.id || null,
    brand_id: resource?.brand_id || null,
    location_id: resource?.location_id || null,
    permission: decision?.permission || null,
    approval_id: req.body?.approval_id || req.query?.approval_id || null,
    ip: req.ip,
    user_agent: req.headers['user-agent'] || null,
  });
  res.status(status).json({ ok: false, error: code });
}

function hasPermission(role: MiRole, permission: SeoPermission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) || false;
}

export interface SeoScopedResource {
  id: string;
  brand_id: string;
  location_id?: string | null;
  category?: string | null;
  target?: string | null;
}

export interface SeoAuthContext {
  session: AuthSession;
  permission: SeoPermission;
  resource?: SeoScopedResource | null;
  routeKey: string;
  approvalId?: string | null;
  approvalExpectation?: SeoApprovalExpectation | null;
}

interface SeoRoutePolicy {
  methods: string[];
  match: RegExp;
  routeKey: string;
  permission: SeoPermission;
  highRisk?: boolean;
  approvalCategory?: string;
  approvalAction?: string;
  resourceType?: string;
}

export const ROUTE_POLICIES: SeoRoutePolicy[] = [
  { methods: ['POST'], match: /^\/publish\/([^/]+)\/preview$/, routeKey: '/publish/:brandId/preview', permission: 'edit_draft' },
  { methods: ['POST'], match: /^\/publish\/([^/]+)\/([^/]+)\/publish$/, routeKey: '/publish/:brandId/:snapshotId/publish', permission: 'production_approval', highRisk: true, approvalCategory: 'production_deploy', approvalAction: 'publish_snapshot', resourceType: 'publish_snapshot' },
  { methods: ['POST'], match: /^\/publish\/([^/]+)\/([^/]+)\/rollback$/, routeKey: '/publish/:brandId/:snapshotId/rollback', permission: 'rollback_approval', highRisk: true, approvalCategory: 'rollback', approvalAction: 'rollback_snapshot', resourceType: 'publish_snapshot' },
  { methods: ['POST'], match: /^\/gbp\/posts\/generate$/, routeKey: '/gbp/posts/generate', permission: 'create_gbp_post_draft' },
  { methods: ['POST'], match: /^\/gbp\/posts\/([^/]+)\/approve$/, routeKey: '/gbp/posts/:id/approve', permission: 'view', resourceType: 'seo_action' },
  { methods: ['POST'], match: /^\/gbp\/posts\/([^/]+)\/publish$/, routeKey: '/gbp/posts/:id/publish', permission: 'production_approval', highRisk: true, approvalCategory: 'gbp_post_publish', approvalAction: 'publish_gbp_post', resourceType: 'seo_action' },
  { methods: ['POST'], match: /^\/backlinks\/evaluate$/, routeKey: '/backlinks/evaluate', permission: 'create_backlink_evaluation' },
  { methods: ['POST'], match: /^\/backlinks\/([^/]+)\/approve$/, routeKey: '/backlinks/:id/approve', permission: 'production_approval', highRisk: true, approvalCategory: 'backlink_approval', approvalAction: 'approve_backlink', resourceType: 'backlink' },
  { methods: ['POST'], match: /^\/backlinks\/([^/]+)\/reject$/, routeKey: '/backlinks/:id/reject', permission: 'approve_non_production', resourceType: 'backlink' },
  { methods: ['POST'], match: /^\/calendar\/items$/, routeKey: '/calendar/items', permission: 'manage_schedule' },
  { methods: ['PATCH'], match: /^\/calendar\/items\/([^/]+)$/, routeKey: '/calendar/items/:id', permission: 'manage_schedule', resourceType: 'content_item' },
  { methods: ['POST'], match: /^\/keywords$/, routeKey: '/keywords', permission: 'create_keyword' },
  { methods: ['POST'], match: /^\/keywords\/discover$/, routeKey: '/keywords/discover', permission: 'create_keyword' },
  { methods: ['POST'], match: /^\/keywords\/cluster$/, routeKey: '/keywords/cluster', permission: 'run_audit' },
  { methods: ['POST'], match: /^\/keywords\/([^/]+)\/approve$/, routeKey: '/keywords/:id/approve', permission: 'approve_non_production', resourceType: 'keyword' },
  { methods: ['POST'], match: /^\/cannibalization$/, routeKey: '/cannibalization', permission: 'run_audit' },
  { methods: ['POST'], match: /^\/clusters\/generate$/, routeKey: '/clusters/generate', permission: 'run_audit' },
  { methods: ['POST'], match: /^\/facts$/, routeKey: '/facts', permission: 'edit_draft' },
  { methods: ['POST'], match: /^\/facts\/([^/]+)\/verify$/, routeKey: '/facts/:id/verify', permission: 'approve_non_production', resourceType: 'fact' },
  { methods: ['POST'], match: /^\/facts\/check-claims$/, routeKey: '/facts/check-claims', permission: 'run_audit' },
  { methods: ['POST'], match: /^\/local\/([^/]+)\/audit$/, routeKey: '/local/:locationId/audit', permission: 'run_audit' },
  { methods: ['POST'], match: /^\/local\/([^/]+)\/gbp-sync$/, routeKey: '/local/:locationId/gbp-sync', permission: 'gbp_core_data_approval', highRisk: true, approvalCategory: 'gbp_core_info_change', approvalAction: 'sync_gbp_snapshot', resourceType: 'local_location' },
  { methods: ['POST'], match: /^\/internal-links\/analyze$/, routeKey: '/internal-links/analyze', permission: 'run_audit' },
  { methods: ['POST'], match: /^\/reports\/generate$/, routeKey: '/reports/generate', permission: 'run_audit' },
  { methods: ['POST'], match: /^\/agents\/register$/, routeKey: '/agents/register', permission: 'manage_connectors' },
  { methods: ['POST'], match: /^\/agents\/([^/]+)\/health$/, routeKey: '/agents/:id/health', permission: 'manage_connectors' },
  { methods: ['POST'], match: /^\/agents\/([^/]+)\/status$/, routeKey: '/agents/:id/status', permission: 'manage_connectors' },
  { methods: ['POST'], match: /^\/agents\/([^/]+)\/reports$/, routeKey: '/agents/:id/reports', permission: 'manage_connectors' },
  { methods: ['POST'], match: /^\/agents\/([^/]+)\/sync$/, routeKey: '/agents/:id/sync', permission: 'manage_connectors' },
  { methods: ['POST'], match: /^\/dashboard\/([^/]+)$/, routeKey: '/dashboard/:id', permission: 'manage_connectors' },
  { methods: ['POST'], match: /^\/tasks$/, routeKey: '/tasks', permission: 'manage_schedule' },
  { methods: ['POST'], match: /^\/tasks\/([^/]+)\/complete$/, routeKey: '/tasks/:taskId/complete', permission: 'manage_schedule' },
  { methods: ['POST'], match: /^\/connectors\/run$/, routeKey: '/connectors/run', permission: 'manage_connectors' },
  { methods: ['POST'], match: /^\/issues$/, routeKey: '/issues', permission: 'run_audit' },
  { methods: ['POST'], match: /^\/opportunities$/, routeKey: '/opportunities', permission: 'run_audit' },
  { methods: ['POST'], match: /^\/orchestrator\/run\/([^/]+)$/, routeKey: '/orchestrator/run/:jobId', permission: 'manage_connectors' },
  { methods: ['POST'], match: /^\/config\/reload$/, routeKey: '/config/reload', permission: 'manage_brand_config' },
];

function normalizePath(req: Pick<Request, 'path' | 'url'>): string {
  const p = (req.path || req.url || '').toLowerCase();
  return p.split('?')[0].replace(/^\/api\/seo/, '') || '/';
}

function policyFor(req: Pick<Request, 'method' | 'path' | 'url'>): SeoRoutePolicy | null {
  const p = normalizePath(req);
  const method = req.method.toUpperCase();
  return ROUTE_POLICIES.find(policy => policy.methods.includes(method) && policy.match.test(p)) || null;
}

export function classifySeoAccess(req: Pick<Request, 'method' | 'path' | 'url'>): SeoAccessDecision {
  const method = req.method.toUpperCase();
  const csrfRequired = !SAFE_METHODS.has(method);

  if (SAFE_METHODS.has(method)) {
    return { permission: 'view', highRisk: false, csrfRequired, approvalRequired: false, routeKey: normalizePath(req) };
  }

  const policy = policyFor(req);
  if (!policy) {
    return { permission: 'view', highRisk: true, csrfRequired, approvalRequired: false, routeKey: 'missing' };
  }
  return {
    permission: policy.permission,
    highRisk: !!policy.highRisk,
    csrfRequired,
    approvalRequired: !!policy.approvalCategory,
    approvalCategory: policy.approvalCategory,
    approvalAction: policy.approvalAction,
    resourceType: policy.resourceType,
    routeKey: policy.routeKey,
  };
}

function inScope(scope: string[], value?: unknown): boolean {
  if (!value) return true;
  if (scope.includes('*')) return true;
  return scope.includes(String(value));
}

function requestValue(req: Request, key: string): unknown {
  return req.params?.[key] ?? req.body?.[key] ?? req.query?.[key];
}

function scopeAllowed(req: Request, session: AuthSession): boolean {
  const brandId = requestValue(req, 'brand_id') ?? requestValue(req, 'brandId');
  const locationId = requestValue(req, 'location_id') ?? requestValue(req, 'locationId');
  return inScope(session.brand_scope, brandId) && inScope(session.location_scope, locationId);
}

function resourceScoped(session: AuthSession, resource: SeoScopedResource | null): boolean {
  if (!resource) return true;
  return inScope(session.brand_scope, resource.brand_id) && inScope(session.location_scope, resource.location_id || undefined);
}

function matchAt(req: Request, policy: SeoRoutePolicy): RegExpMatchArray | null {
  return normalizePath(req).match(policy.match);
}

function resolveSeoResource(req: Request, decision: SeoAccessDecision): SeoScopedResource | null {
  const policy = policyFor(req);
  if (!policy?.resourceType) return null;
  const match = matchAt(req, policy);
  const db = getSeoDb();
  if (policy.resourceType === 'publish_snapshot') {
    const snapshotId = match?.[2];
    const row = db.prepare('SELECT id, brand_id, content_id, target, status FROM seo_publish_snapshots WHERE id = ?').get(snapshotId) as { id: string; brand_id: string; content_id?: string; target?: string } | undefined;
    if (!row) return { id: snapshotId || '', brand_id: '__missing__', target: snapshotId || '' };
    return { id: row.id, brand_id: row.brand_id, target: row.id };
  }
  if (policy.resourceType === 'seo_action') {
    const id = match?.[1];
    const row = db.prepare('SELECT id, brand_id, category, target FROM seo_actions WHERE id = ?').get(id) as { id: string; brand_id: string | null; category: string; target: string | null } | undefined;
    return row ? { id: row.id, brand_id: row.brand_id || 'global', category: row.category, target: row.id, location_id: row.target || null } : { id: id || '', brand_id: '__missing__' };
  }
  if (policy.resourceType === 'backlink') {
    const id = match?.[1];
    const row = db.prepare('SELECT id, brand_id, source_url FROM seo_backlinks WHERE id = ?').get(id) as { id: string; brand_id: string; source_url: string } | undefined;
    return row ? { id: row.id, brand_id: row.brand_id, target: row.id } : { id: id || '', brand_id: '__missing__' };
  }
  if (policy.resourceType === 'content_item') {
    const id = match?.[1];
    const row = db.prepare('SELECT id, brand_id, location_id FROM seo_content_items WHERE id = ?').get(id) as { id: string; brand_id: string; location_id: string | null } | undefined;
    return row ? { id: row.id, brand_id: row.brand_id, location_id: row.location_id, target: row.id } : { id: id || '', brand_id: '__missing__' };
  }
  if (policy.resourceType === 'keyword') {
    const id = match?.[1];
    const row = db.prepare('SELECT id, brand_id, location_id FROM seo_keywords WHERE id = ?').get(id) as { id: string; brand_id: string; location_id: string | null } | undefined;
    return row ? { id: row.id, brand_id: row.brand_id, location_id: row.location_id, target: row.id } : { id: id || '', brand_id: '__missing__' };
  }
  if (policy.resourceType === 'fact') {
    const id = match?.[1];
    const row = db.prepare('SELECT id, brand_id, location_id FROM seo_business_facts WHERE id = ?').get(id) as { id: string; brand_id: string; location_id: string | null } | undefined;
    return row ? { id: row.id, brand_id: row.brand_id, location_id: row.location_id, target: row.id } : { id: id || '', brand_id: '__missing__' };
  }
  if (policy.resourceType === 'local_location') {
    return { id: match?.[1] || '', brand_id: String(req.body?.brand_id || req.query?.brand_id || ''), location_id: match?.[1] || null, target: match?.[1] || '' };
  }
  void decision;
  return null;
}

function expectedApproval(decision: SeoAccessDecision, resource: SeoScopedResource | null, req: Request): SeoApprovalExpectation | null {
  if (!decision.approvalCategory || !decision.approvalAction) return null;
  const session = getAuthSessionFromBearerRequest(req);
  const brandId = resource?.brand_id || String(req.params?.brandId || req.body?.brand_id || req.query?.brand_id || 'global');
  const locationId = resource?.location_id || req.body?.location_id || req.query?.location_id || null;
  const target = resource?.target || resource?.id || String(req.params?.snapshotId || req.params?.id || brandId);
  const payloadHash = hashPayload({
    route: decision.routeKey,
    resource_id: resource?.id || target,
    brand_id: brandId,
    location_id: locationId ? String(locationId) : null,
    category: decision.approvalCategory,
    action: decision.approvalAction,
    target,
  });
  return {
    category: decision.approvalCategory,
    action: decision.approvalAction,
    target,
    brand_id: brandId,
    location_id: locationId ? String(locationId) : null,
    actor_id: session?.actor_id || null,
    payload_hash: payloadHash,
  };
}

export const seoRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 90,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'seo_rate_limited' },
  handler: (req, res, _next, options) => {
    appendAudit({ event: 'seo_rate_limited', method: req.method, path: req.originalUrl || req.url, ip: req.ip });
    res.status(options.statusCode).json({ ok: false, error: 'seo_rate_limited' });
  },
});

export function requireSeoAccess(req: Request, res: Response, next: NextFunction): void {
  const session = getAuthSessionFromBearerRequest(req);
  if (!session) return deny(req, res, 401, 'seo_bearer_auth_required');

  const decision = classifySeoAccess(req);
  if (decision.routeKey === 'missing') {
    return deny(req, res, 403, 'seo_route_policy_missing', session, decision);
  }
  if (!hasPermission(session.role, decision.permission)) {
    return deny(req, res, 403, 'seo_forbidden', session, decision);
  }

  const resource = resolveSeoResource(req, decision);
  if (resource?.brand_id === '__missing__') {
    return deny(req, res, 404, 'seo_resource_not_found', session, decision, resource);
  }
  if (!scopeAllowed(req, session)) {
    return deny(req, res, 403, 'seo_scope_violation', session, decision, resource);
  }
  if (!resourceScoped(session, resource)) {
    return deny(req, res, 403, 'seo_resource_scope_violation', session, decision, resource);
  }

  if (decision.csrfRequired && req.headers['x-csrf-token'] !== session.csrf_token) {
    return deny(req, res, 403, 'seo_csrf_required', session, decision, resource);
  }

  if (decision.approvalRequired) {
    const expected = expectedApproval(decision, resource, req);
    if (!expected) return deny(req, res, 403, 'seo_approval_expectation_missing', session, decision, resource);
    const approval = validateSeoApproval(req.body?.approval_id || req.query?.approval_id, expected);
    if (!approval.ok) return deny(req, res, 403, `seo_${approval.reason}`, session, decision, resource);
  }

  const auditOk = appendAudit({
    event: 'seo_auth_allowed',
    decision: 'allow',
    role: session.role,
    actor_id_hash: crypto.createHash('sha256').update(session.actor_id).digest('hex').slice(0, 16),
    session_hash: sessionHash(session),
    permission: decision.permission,
    method: req.method,
    route: decision.routeKey,
    path: req.originalUrl || req.url,
    resource_id: resource?.id || null,
    brand_id: resource?.brand_id || requestValue(req, 'brand_id') || requestValue(req, 'brandId') || null,
    location_id: resource?.location_id || requestValue(req, 'location_id') || requestValue(req, 'locationId') || null,
    approval_id: req.body?.approval_id || req.query?.approval_id || null,
    high_risk: decision.highRisk,
  });
  if (decision.highRisk && !auditOk) {
    res.status(503).json({ ok: false, error: 'seo_audit_unavailable' });
    return;
  }

  const approvalExpectation = decision.approvalRequired ? expectedApproval(decision, resource, req) : null;
  (req as Request & { seoAuth?: SeoAuthContext }).seoAuth = {
    session,
    permission: decision.permission,
    resource,
    routeKey: decision.routeKey,
    approvalId: req.body?.approval_id || req.query?.approval_id || null,
    approvalExpectation,
  };
  next();
}

export function getSeoRbacMatrix(): Record<MiRole, SeoPermission[]> {
  return {
    SEO_VIEWER: Array.from(ROLE_PERMISSIONS.SEO_VIEWER),
    SEO_MANAGER: Array.from(ROLE_PERMISSIONS.SEO_MANAGER),
    ADMIN: Array.from(ROLE_PERMISSIONS.ADMIN),
    CEO: Array.from(ROLE_PERMISSIONS.CEO),
  };
}
