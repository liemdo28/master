/**
 * Auth routes:
 * - PIN login for mobile
 * - Google OAuth flow
 */

import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import rateLimit from 'express-rate-limit';
import {
  getAuthUrl, createOAuthClient, saveTokens,
  getAuthStatus, isConfigured,
} from '../visibility/connectors/google/google-auth';

const PIN_HASH = process.env.MI_PIN_HASH || hashPin(process.env.MI_PIN || '');
export type MiRole = 'CEO' | 'ADMIN' | 'SEO_MANAGER' | 'SEO_VIEWER';

export interface AuthSession {
  token: string;
  role: MiRole;
  actor_id: string;
  csrf_token: string;
  brand_scope: string[];
  location_scope: string[];
  created_at: string;
  expires_at: number;
}

const sessions = new Map<string, AuthSession>();
const SESSION_TTL = 8 * 60 * 60 * 1000;

function hashPin(pin: string): string {
  if (!pin) return '';
  return crypto.createHash('sha256').update(pin + 'mi-salt-2024').digest('hex');
}
function generateToken(): string { return crypto.randomBytes(32).toString('hex'); }
function generateCsrfToken(): string { return crypto.randomBytes(24).toString('hex'); }

function normalizeRole(value: unknown): MiRole | null {
  const raw = String(value || '').toUpperCase();
  if (raw === 'ADMIN' || raw === 'SEO_MANAGER' || raw === 'SEO_VIEWER' || raw === 'CEO') return raw;
  return null;
}

function parseScope(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  const raw = String(value || '').trim();
  if (!raw) return [];
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

interface TrustedAssignment {
  role: MiRole;
  actor_id: string;
  brand_scope: string[];
  location_scope: string[];
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a || '', 'hex');
  const bb = Buffer.from(b || '', 'hex');
  if (ab.length !== bb.length || ab.length === 0) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function trustedAssignmentFor(req: Request): TrustedAssignment | null {
  void req;
  const identity = process.env.MI_AUTH_DEFAULT_USER;
  const mapRaw = process.env.MI_AUTH_USER_MAP_JSON;
  if (mapRaw) {
    if (!identity) return null;
    try {
      const map = JSON.parse(mapRaw) as Record<string, { role?: unknown; actor_id?: unknown; brand_scope?: unknown; location_scope?: unknown }>;
      const entry = map[identity];
      if (!entry) return null;
      const role = normalizeRole(entry.role);
      if (!role) return null;
      if (typeof entry.actor_id !== 'string' || !entry.actor_id.trim()) return null;
      if (!Array.isArray(entry.brand_scope)) return null;
      if (!Array.isArray(entry.location_scope)) return null;
      return {
        role,
        actor_id: entry.actor_id,
        brand_scope: parseScope(entry.brand_scope),
        location_scope: parseScope(entry.location_scope),
      };
    } catch {
      return null;
    }
  }

  if (process.env.MI_AUTH_ALLOW_SINGLE_USER_ENV_FALLBACK !== 'true') return null;
  const role = normalizeRole(process.env.MI_DEFAULT_ROLE);
  if (!role) return null;
  if (!process.env.MI_AUTH_ACTOR_ID) return null;
  if (process.env.MI_BRAND_SCOPE == null || process.env.MI_LOCATION_SCOPE == null) return null;
  return {
    role,
    actor_id: process.env.MI_AUTH_ACTOR_ID,
    brand_scope: parseScope(process.env.MI_BRAND_SCOPE),
    location_scope: parseScope(process.env.MI_LOCATION_SCOPE),
  };
}

export function getAuthConfigurationStatus(): { ok: boolean; status: 'OK' | 'AUTH_CONFIGURATION_BLOCKED'; reason?: string } {
  const fakeReq = { body: {}, headers: {} } as Request;
  const assignment = trustedAssignmentFor(fakeReq);
  return assignment ? { ok: true, status: 'OK' } : { ok: false, status: 'AUTH_CONFIGURATION_BLOCKED', reason: 'trusted_auth_assignment_unavailable' };
}

function createSession(input: { assignment: TrustedAssignment; ttlMs?: number }): AuthSession {
  const token = generateToken();
  const ttl = typeof input.ttlMs === 'number' ? input.ttlMs : SESSION_TTL;
  const session: AuthSession = {
    token,
    role: input.assignment.role,
    actor_id: input.assignment.actor_id,
    csrf_token: generateCsrfToken(),
    brand_scope: input.assignment.brand_scope,
    location_scope: input.assignment.location_scope,
    created_at: new Date().toISOString(),
    expires_at: Date.now() + ttl,
  };
  sessions.set(token, session);
  const cleanup = setTimeout(() => sessions.delete(token), Math.max(0, ttl));
  cleanup.unref?.();
  return session;
}

export function getAuthSessionFromToken(token: string | null): AuthSession | null {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expires_at <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session;
}

export function getAuthSessionFromRequest(req: Request): AuthSession | null {
  return getAuthSessionFromToken(extractToken(req));
}

export function getAuthSessionFromBearerRequest(req: Request): AuthSession | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  return getAuthSessionFromToken(auth.slice(7));
}

export const authRouter = Router();

const authAuditPath = process.env.AUTH_AUDIT_PATH ||
  path.resolve(__dirname, '../../..', 'reports', 'evidence', 'auth-audit.jsonl');

function appendAuthAudit(event: Record<string, unknown>): void {
  try {
    fs.mkdirSync(path.dirname(authAuditPath), { recursive: true });
    fs.appendFileSync(authAuditPath, JSON.stringify({ timestamp: new Date().toISOString(), ...event }) + '\n');
  } catch {
    // Login must not reveal audit-path internals; operational logs still show the high-level outcome.
  }
}

export const loginRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.MI_LOGIN_RATE_LIMIT_PER_MINUTE || 20),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'login_rate_limited' },
  handler: (req, res, _next, options) => {
    appendAuthAudit({ event: 'login_rate_limited', ip: req.ip, user_agent: req.headers['user-agent'] || null });
    res.status(options.statusCode).json({ error: 'login_rate_limited' });
  },
});

// ── PIN Auth ──

authRouter.post('/login', loginRateLimiter, (req: Request, res: Response) => {
  const { pin } = req.body as { pin: string };
  if (!pin) {
    appendAuthAudit({ event: 'login_failed', reason: 'missing_pin', ip: req.ip, user_agent: req.headers['user-agent'] || null });
    return res.status(400).json({ error: 'pin required' });
  }
  if (!PIN_HASH || !timingSafeEqualHex(hashPin(pin), PIN_HASH)) {
    appendAuthAudit({ event: 'login_failed', reason: 'invalid_pin', ip: req.ip, user_agent: req.headers['user-agent'] || null });
    console.warn('[Auth] login_failed invalid_pin');
    return res.status(401).json({ error: 'PIN không đúng' });
  }
  const assignment = trustedAssignmentFor(req);
  if (!assignment) {
    appendAuthAudit({ event: 'login_failed', reason: 'trusted_assignment_missing_or_invalid', ip: req.ip, user_agent: req.headers['user-agent'] || null });
    console.warn('[Auth] login_failed trusted_assignment_missing_or_invalid');
    return res.status(403).json({ error: 'trusted role mapping unavailable' });
  }
  const session = createSession({ assignment });
  appendAuthAudit({
    event: 'login_success',
    role: session.role,
    actor_id_hash: crypto.createHash('sha256').update(session.actor_id).digest('hex').slice(0, 16),
    brand_scope: session.brand_scope,
    location_scope: session.location_scope,
    ip: req.ip,
    user_agent: req.headers['user-agent'] || null,
  });
  console.log('[Auth] login_success', { role: session.role, brand_scope: session.brand_scope, location_scope: session.location_scope });
  res.json({
    token: session.token,
    csrf_token: session.csrf_token,
    role: session.role,
    brand_scope: session.brand_scope,
    location_scope: session.location_scope,
    expires_in: SESSION_TTL,
  });
});

authRouter.post('/logout', (req: Request, res: Response) => {
  const token = extractToken(req);
  if (token) sessions.delete(token);
  res.json({ ok: true });
});

// ── Google OAuth ──

authRouter.get('/google/status', (_req: Request, res: Response) => {
  if (!isConfigured()) {
    return res.json({
      configured: false,
      status: 'not_configured',
      hint: 'Add GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + GOOGLE_REDIRECT_URI to .env',
    });
  }
  res.json(getAuthStatus());
});

authRouter.get('/google/start', (_req: Request, res: Response) => {
  if (!isConfigured()) {
    return res.status(400).json({ error: 'Google OAuth not configured. Add GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET to .env' });
  }
  const url = getAuthUrl();
  // Redirect browser to Google
  res.redirect(url);
});

authRouter.get('/google/callback', async (req: Request, res: Response) => {
  const { code, error } = req.query as { code?: string; error?: string };
  if (error || !code) {
    return res.send(`<html><body style="background:#0d0d0d;color:#e8e8e8;font-family:sans-serif;padding:40px">
      <h2>❌ Google Auth Failed</h2><p>${error || 'No code received'}</p>
      <a href="/brain.html" style="color:#4f8ef7">← Back to Mi</a>
    </body></html>`);
  }
  try {
    const client = createOAuthClient();
    const { tokens } = await client.getToken(code);
    saveTokens(tokens as Parameters<typeof saveTokens>[0]);
    res.send(`<html><body style="background:#0d0d0d;color:#e8e8e8;font-family:sans-serif;padding:40px">
      <h2>✓ Google Connected!</h2>
      <p>Gmail, Calendar, và Drive đã được kết nối thành công.</p>
      <p style="color:#888">Em sẽ sync dữ liệu trong lần tiếp theo.</p>
      <a href="/brain.html" style="color:#4f8ef7">← Back to Mi Brain</a>
      <script>setTimeout(()=>location.href='/brain.html',3000)</script>
    </body></html>`);
  } catch (e) {
    res.status(500).send(`<html><body style="background:#0d0d0d;color:#e8e8e8;font-family:sans-serif;padding:40px">
      <h2>❌ Auth Error</h2><p>${e}</p>
      <a href="/brain.html" style="color:#4f8ef7">← Back</a>
    </body></html>`);
  }
});

// ── Middleware ──

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!process.env.MI_PIN && !process.env.MI_PIN_HASH) return next();
  // Allow machine-to-machine requests authenticated via X-API-Key (qb-ops-agent, gateway, etc.)
  const apiKey = req.headers['x-api-key'] as string;
  const validApiKey = process.env.MI_CORE_API_KEY || process.env.AGENT_CODING_API_KEY || '';
  if (apiKey && validApiKey && apiKey === validApiKey) return next();
  // Allow localhost browser access (CEO dashboard on same machine — PIN protects remote access only)
  if (process.env.LOCALHOST_BYPASS !== 'false') {
    const ip = req.ip || req.socket?.remoteAddress || '';
    const isLocal = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
    if (isLocal) return next();
  }
  if (req.query.token || req.query.csrf) {
    appendAuthAudit({
      event: 'query_token_rejected',
      path: req.path,
      ip: req.ip,
      user_agent: req.headers['user-agent'] || null,
    });
    return res.status(401).json({ error: 'query_token_auth_rejected' });
  }
  const token = extractToken(req);
  if (!getAuthSessionFromToken(token)) {
    return res.status(401).json({ error: 'Unauthorized — login with PIN' });
  }
  next();
}

function extractToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

export function __createTestSessionForAuth(input: { role?: MiRole; actor_id?: string; brand_scope?: string[]; location_scope?: string[]; ttlMs?: number } = {}): AuthSession {
  if (process.env.NODE_ENV !== 'test' && process.env.SEO_SECURITY_TEST_MODE !== '1') {
    throw new Error('__createTestSessionForAuth is only available in test mode');
  }
  return createSession({
    assignment: {
      role: input.role || 'SEO_VIEWER',
      actor_id: input.actor_id || `${(input.role || 'SEO_VIEWER').toLowerCase()}-test`,
      brand_scope: input.brand_scope || [],
      location_scope: input.location_scope || [],
    },
    ttlMs: input.ttlMs,
  });
}
