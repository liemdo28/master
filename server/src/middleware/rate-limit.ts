import rateLimit from 'express-rate-limit';
import type { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const RATE_LIMIT_AUDIT = path.resolve(__dirname, '../../..', 'reports', 'evidence', 'knowledge-rate-limit', 'runtime-429-audit.jsonl');

function internalKey(): string {
  const key = process.env.MI_CORE_API_KEY;
  if (!key) {
    console.warn('[RateLimit] MI_CORE_API_KEY not set — internal rate-limit bypass disabled');
    return '';  // fail-safe: empty string means no request will match
  }
  return key;
}

// Bypass rate limiting ONLY for authenticated Jarvis/QB-agent API calls.
// Public routes (/api/remote/health, /api/remote/login, /api/health) are
// never issued the internal key and therefore always rate-limited.
//
// /api/qb-agent was added after the runtime-429-audit log showed 565k+
// throttled requests over 14 days (95% on /qb-agent/heartbeat) from the
// laptop1 QB desktop agent — an authenticated caller (correct X-API-Key)
// that was never in this bypass scope, sharing the same 120-req/60s bucket
// as every unauthenticated caller on its IP. This does not widen authority:
// the still-quarantined /api/qb-agent/* mutation routes (commands, event,
// etc.) remain blocked by the separate legacyAuthorityBoundary check
// regardless of whether the request is rate-limited first.
//
// `req.path` for this prefix has been observed both with and without the
// leading /api segment (e.g. '/api/qb-agent/heartbeat' and
// '/qb-agent/heartbeat') depending on the calling path — matched loosely
// via includes() so both are covered.
function isInternalJarvisCall(req: Request): boolean {
  if (process.env.MI_E2E_FIXTURE === '1') return true;
  const key = req.headers['x-api-key'];
  if (key !== internalKey()) return false;
  // Scope to Jarvis + internal API + QB-agent paths only
  return req.path.startsWith('/api/jarvis') || req.path.startsWith('/api/mi') || req.path.includes('/qb-agent');
}

function headerValue(req: Request, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()];
  if (Array.isArray(value)) return value.join(',');
  return value;
}

function callerIdentity(req: Request): string {
  return headerValue(req, 'x-caller-id')
    || headerValue(req, 'x-client-id')
    || headerValue(req, 'user-agent')
    || 'unknown';
}

function writeRateLimitAudit(req: Request, res: Response, routeLimit: number) {
  try {
    const info = (req as Request & { rateLimit?: { limit?: number; used?: number; remaining?: number; resetTime?: Date } }).rateLimit;
    const resetTime = info?.resetTime instanceof Date ? info.resetTime.toISOString() : undefined;
    const retryAfter = res.getHeader('Retry-After');
    const event = {
      timestamp: new Date().toISOString(),
      limiter: 'global-express-rate-limit',
      route: req.originalUrl || req.url,
      path: req.path,
      method: req.method,
      ip: req.ip,
      ips: req.ips,
      client_key: req.ip,
      caller_identity: callerIdentity(req),
      has_internal_key: headerValue(req, 'x-api-key') === internalKey(),
      retry_after: typeof retryAfter === 'number' || typeof retryAfter === 'string' ? String(retryAfter) : undefined,
      bucket: {
        limit: info?.limit ?? routeLimit,
        used: info?.used,
        remaining: info?.remaining,
        reset_time: resetTime,
      },
      headers: {
        user_agent: headerValue(req, 'user-agent'),
        x_forwarded_for: headerValue(req, 'x-forwarded-for'),
        x_real_ip: headerValue(req, 'x-real-ip'),
        x_caller_id: headerValue(req, 'x-caller-id'),
        x_client_id: headerValue(req, 'x-client-id'),
      },
    };
    fs.mkdirSync(path.dirname(RATE_LIMIT_AUDIT), { recursive: true });
    fs.appendFileSync(RATE_LIMIT_AUDIT, JSON.stringify(event) + '\n');
  } catch (error) {
    console.warn('[RateLimitAudit] Failed to write 429 audit log:', error);
  }
}

export const rateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
  skip: isInternalJarvisCall,
  handler: (req: Request, res: Response, _next: NextFunction, options) => {
    writeRateLimitAudit(req, res, Number(options.limit) || 120);
    res.status(options.statusCode).json({
      error: 'Too many requests',
      limiter: 'global-express-rate-limit',
      route: req.originalUrl || req.url,
      retry_after: res.getHeader('Retry-After') || null,
    });
  },
});
