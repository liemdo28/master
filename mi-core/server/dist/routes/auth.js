"use strict";
/**
 * Auth routes:
 * - PIN login for mobile
 * - Google OAuth flow
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
exports.requireAuth = requireAuth;
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const google_auth_1 = require("../visibility/connectors/google/google-auth");
const PIN_HASH = process.env.MI_PIN_HASH || hashPin(process.env.MI_PIN || '');
const sessions = new Set();
const SESSION_TTL = 8 * 60 * 60 * 1000;
function hashPin(pin) {
    if (!pin)
        return '';
    return crypto_1.default.createHash('sha256').update(pin + 'mi-salt-2024').digest('hex');
}
function generateToken() { return crypto_1.default.randomBytes(32).toString('hex'); }
exports.authRouter = (0, express_1.Router)();
// ── PIN Auth ──
exports.authRouter.post('/login', (req, res) => {
    const { pin } = req.body;
    if (!pin)
        return res.status(400).json({ error: 'pin required' });
    if (!PIN_HASH || hashPin(pin) !== PIN_HASH) {
        return res.status(401).json({ error: 'PIN không đúng' });
    }
    const token = generateToken();
    sessions.add(token);
    setTimeout(() => sessions.delete(token), SESSION_TTL);
    res.json({ token, expires_in: SESSION_TTL });
});
exports.authRouter.post('/logout', (req, res) => {
    const token = extractToken(req);
    if (token)
        sessions.delete(token);
    res.json({ ok: true });
});
// ── Google OAuth ──
exports.authRouter.get('/google/status', (_req, res) => {
    if (!(0, google_auth_1.isConfigured)()) {
        return res.json({
            configured: false,
            status: 'not_configured',
            hint: 'Add GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + GOOGLE_REDIRECT_URI to .env',
        });
    }
    res.json((0, google_auth_1.getAuthStatus)());
});
exports.authRouter.get('/google/start', (_req, res) => {
    if (!(0, google_auth_1.isConfigured)()) {
        return res.status(400).json({ error: 'Google OAuth not configured. Add GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET to .env' });
    }
    const url = (0, google_auth_1.getAuthUrl)();
    // Redirect browser to Google
    res.redirect(url);
});
exports.authRouter.get('/google/callback', async (req, res) => {
    const { code, error } = req.query;
    if (error || !code) {
        return res.send(`<html><body style="background:#0d0d0d;color:#e8e8e8;font-family:sans-serif;padding:40px">
      <h2>❌ Google Auth Failed</h2><p>${error || 'No code received'}</p>
      <a href="/brain.html" style="color:#4f8ef7">← Back to Mi</a>
    </body></html>`);
    }
    try {
        const client = (0, google_auth_1.createOAuthClient)();
        const { tokens } = await client.getToken(code);
        (0, google_auth_1.saveTokens)(tokens);
        res.send(`<html><body style="background:#0d0d0d;color:#e8e8e8;font-family:sans-serif;padding:40px">
      <h2>✓ Google Connected!</h2>
      <p>Gmail, Calendar, và Drive đã được kết nối thành công.</p>
      <p style="color:#888">Em sẽ sync dữ liệu trong lần tiếp theo.</p>
      <a href="/brain.html" style="color:#4f8ef7">← Back to Mi Brain</a>
      <script>setTimeout(()=>location.href='/brain.html',3000)</script>
    </body></html>`);
    }
    catch (e) {
        res.status(500).send(`<html><body style="background:#0d0d0d;color:#e8e8e8;font-family:sans-serif;padding:40px">
      <h2>❌ Auth Error</h2><p>${e}</p>
      <a href="/brain.html" style="color:#4f8ef7">← Back</a>
    </body></html>`);
    }
});
// ── Middleware ──
function requireAuth(req, res, next) {
    if (!process.env.MI_PIN && !process.env.MI_PIN_HASH)
        return next();
    // Allow machine-to-machine requests authenticated via X-API-Key (qb-ops-agent, gateway, etc.)
    const apiKey = req.headers['x-api-key'];
    const validApiKey = process.env.MI_CORE_API_KEY || process.env.AGENT_CODING_API_KEY || '';
    if (apiKey && validApiKey && apiKey === validApiKey)
        return next();
    // Allow localhost browser access (CEO dashboard on same machine — PIN protects remote access only)
    if (process.env.LOCALHOST_BYPASS !== 'false') {
        const ip = req.ip || req.socket?.remoteAddress || '';
        const isLocal = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
        if (isLocal)
            return next();
    }
    const token = extractToken(req);
    if (!token || !sessions.has(token)) {
        return res.status(401).json({ error: 'Unauthorized — login with PIN' });
    }
    next();
}
function extractToken(req) {
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer '))
        return auth.slice(7);
    return req.query.token || null;
}
