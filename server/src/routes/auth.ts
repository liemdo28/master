/**
 * Auth routes:
 * - PIN login for mobile
 * - Google OAuth flow
 */

import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import {
  getAuthUrl, createOAuthClient, saveTokens,
  getAuthStatus, isConfigured,
} from '../visibility/connectors/google/google-auth';

const PIN_HASH = process.env.MI_PIN_HASH || hashPin(process.env.MI_PIN || '');
const sessions = new Set<string>();
const SESSION_TTL = 8 * 60 * 60 * 1000;

function hashPin(pin: string): string {
  if (!pin) return '';
  return crypto.createHash('sha256').update(pin + 'mi-salt-2024').digest('hex');
}
function generateToken(): string { return crypto.randomBytes(32).toString('hex'); }

export const authRouter = Router();

// ── PIN Auth ──

authRouter.post('/login', (req: Request, res: Response) => {
  const { pin } = req.body as { pin: string };
  if (!pin) return res.status(400).json({ error: 'pin required' });
  if (!PIN_HASH || hashPin(pin) !== PIN_HASH) {
    return res.status(401).json({ error: 'PIN không đúng' });
  }
  const token = generateToken();
  sessions.add(token);
  setTimeout(() => sessions.delete(token), SESSION_TTL);
  res.json({ token, expires_in: SESSION_TTL });
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
  const token = extractToken(req);
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorized — login with PIN' });
  }
  next();
}

function extractToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return (req.query.token as string) || null;
}
