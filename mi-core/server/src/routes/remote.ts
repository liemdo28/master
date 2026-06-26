/**
 * Remote Access Routes — /api/remote
 * Health, login, logout, device management, audit log
 */

import { Router, Request, Response } from 'express';
import { getPending } from '../approval/gate';
import { getNetworkInfo } from '../remote/network-info';
import {
  login, logout, revokeDevice, listDevices, listActiveSessions,
  getAuditLog, getConfig, requireRemoteAuth, hashPin,
} from '../remote/remote-auth';
import fs from 'fs';
import path from 'path';

export const remoteRouter = Router();

const PORT = parseInt(process.env.MI_PORT || '4001');
const GLOBAL_DIR = process.env.GLOBAL_DIR || 'D:/Project/Master/.local-agent-global';
const CONFIG_PATH = path.join(GLOBAL_DIR, 'remote-access', 'config.json');

// ── GET /api/remote/health — public, shows server info ──────────────────────
remoteRouter.get('/health', (_req: Request, res: Response) => {
  const net = getNetworkInfo(PORT);
  const cfg = getConfig();
  const pending = getPending();

  res.json({
    server: 'online',
    host: '0.0.0.0',
    port: PORT,
    lan_ip:       net.lan_ip,
    lan_url:      net.lan_url,
    tailscale_ip: net.tailscale_ip,
    tailscale_url: net.tailscale_url,
    auth_enabled: cfg.require_auth,
    approval_gate: {
      pending: pending.length,
      levels: { read: 'free', write: 2, dangerous: 3 },
    },
    uptime_sec: Math.floor(process.uptime()),
    ts: new Date().toISOString(),
  });
});

// ── POST /api/remote/login ────────────────────────────────────────────────────
remoteRouter.post('/login', (req: Request, res: Response) => {
  const { pin } = req.body as { pin?: string };
  if (!pin) return res.status(400).json({ error: 'pin required' });

  const result = login(pin, req);
  if (!result.ok) return res.status(401).json({ error: result.error });

  res.json({
    ok: true,
    token: result.token,
    device_id: result.device_id,
    message: 'Đăng nhập thành công — chào anh 👋',
  });
});

// ── POST /api/remote/logout ───────────────────────────────────────────────────
remoteRouter.post('/logout', (req: Request, res: Response) => {
  const token = extractToken(req);
  if (token) logout(token);
  res.json({ ok: true });
});

// ── GET /api/remote/devices — list trusted devices ───────────────────────────
remoteRouter.get('/devices', requireRemoteAuth, (_req: Request, res: Response) => {
  res.json({ devices: listDevices() });
});

// ── DELETE /api/remote/devices/:id — revoke device ───────────────────────────
remoteRouter.delete('/devices/:id', requireRemoteAuth, (req: Request, res: Response) => {
  revokeDevice(req.params.id);
  res.json({ ok: true, revoked: req.params.id });
});

// ── GET /api/remote/sessions — active sessions ───────────────────────────────
remoteRouter.get('/sessions', requireRemoteAuth, (_req: Request, res: Response) => {
  res.json({ sessions: listActiveSessions() });
});

// ── GET /api/remote/audit — audit log ────────────────────────────────────────
remoteRouter.get('/audit', requireRemoteAuth, (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string || '100');
  res.json({ log: getAuditLog(limit) });
});

// ── POST /api/remote/config — update config (require auth + PIN confirm) ─────
remoteRouter.post('/config', requireRemoteAuth, (req: Request, res: Response) => {
  const { new_pin, session_ttl_hours, allowed_subnets } = req.body as {
    new_pin?: string;
    session_ttl_hours?: number;
    allowed_subnets?: string[];
  };

  const cfg = getConfig();
  if (new_pin) cfg.pin_hash = hashPin(new_pin);
  if (session_ttl_hours) cfg.session_ttl_ms = session_ttl_hours * 3600 * 1000;
  if (allowed_subnets?.length) cfg.allowed_subnets = allowed_subnets;
  cfg.require_auth = true;

  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
  res.json({ ok: true, config: cfg });
});

// ── GET /api/remote/qr-data — data to build QR on frontend ──────────────────
remoteRouter.get('/qr-data', (_req: Request, res: Response) => {
  const net = getNetworkInfo(PORT);
  const preferredUrl = net.tailscale_url || net.lan_url || `http://127.0.0.1:${PORT}`;
  res.json({
    url: preferredUrl,
    tailscale_url: net.tailscale_url,
    lan_url: net.lan_url,
    note: net.tailscale_url ? 'Tailscale (ưu tiên — an toàn hơn)' : 'LAN only',
  });
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function extractToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return (req.query.token as string) || null;
}
