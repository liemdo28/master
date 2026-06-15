"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const RATE_LIMIT_AUDIT = path_1.default.resolve(__dirname, '../../..', 'reports', 'evidence', 'knowledge-rate-limit', 'runtime-429-audit.jsonl');
function internalKey() {
    return process.env.MI_CORE_API_KEY || 'mi-core-secret-2026';
}
// Bypass rate limiting ONLY for authenticated Jarvis API calls.
// Public routes (/api/remote/health, /api/remote/login, /api/health) are
// never issued the internal key and therefore always rate-limited.
function isInternalJarvisCall(req) {
    const key = req.headers['x-api-key'];
    if (key !== internalKey())
        return false;
    // Scope to Jarvis + internal API paths only
    return req.path.startsWith('/api/jarvis') || req.path.startsWith('/api/mi');
}
function headerValue(req, name) {
    const value = req.headers[name.toLowerCase()];
    if (Array.isArray(value))
        return value.join(',');
    return value;
}
function callerIdentity(req) {
    return headerValue(req, 'x-caller-id')
        || headerValue(req, 'x-client-id')
        || headerValue(req, 'user-agent')
        || 'unknown';
}
function writeRateLimitAudit(req, res, routeLimit) {
    try {
        const info = req.rateLimit;
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
        fs_1.default.mkdirSync(path_1.default.dirname(RATE_LIMIT_AUDIT), { recursive: true });
        fs_1.default.appendFileSync(RATE_LIMIT_AUDIT, JSON.stringify(event) + '\n');
    }
    catch (error) {
        console.warn('[RateLimitAudit] Failed to write 429 audit log:', error);
    }
}
exports.rateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests' },
    skip: isInternalJarvisCall,
    handler: (req, res, _next, options) => {
        writeRateLimitAudit(req, res, Number(options.limit) || 120);
        res.status(options.statusCode).json({
            error: 'Too many requests',
            limiter: 'global-express-rate-limit',
            route: req.originalUrl || req.url,
            retry_after: res.getHeader('Retry-After') || null,
        });
    },
});
