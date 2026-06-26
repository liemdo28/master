/**
 * Remote Auth — device-aware PIN auth for Mi-Core remote access
 * Handles: PIN login, session tokens, device tracking,
 *          failed-login lockout, audit log, IP allowlist
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

// ── Paths ───────────────────────────────────────────────────────────────────
const GLOBAL_DIR = process.env.GLOBAL_DIR || 'D:/Project/Master/.local-agent-global';
const REMOTE_DIR = path.join(GLOBAL_DIR, 'remote-access');
const CONFIG_PATH   = path.join(REMOTE_DIR, 'config.json');
const DEVICES_PATH  = path.join(REMOTE_DIR, 'trusted_devices.json');
const SESSIONS_PATH = path.join(REMOTE_DIR, 'sessions.json');
const AUDIT_PATH    = path.join(REMOTE_DIR, 'audit_log.json');

// ── Types ───────────────────────────────────────────────────────────────────
export interface RemoteConfig {
  pin_hash: string;
  session_ttl_ms: number;     // default 8h
  max_failed_attempts: number;
  lockout_ms: number;         // default 15min
  allowed_subnets: string[];  // CIDR list
  require_auth: boolean;
}

export interface DeviceRecord {
  device_id: string;
  name: string;
  ip: string;
  user_agent: string;
  first_seen: string;
  last_seen: string;
  trusted: boolean;
  revoked: boolean;
}

export interface SessionRecord {
  token: string;
  device_id: string;
  ip: string;
  created_at: string;
  expires_at: string;
  active: boolean;
}

export interface AuditEntry {
  ts: string;
  device_id: string;
  ip: string;
  action: string;
  path?: string;
  result: 'ok' | 'denied' | 'blocked' | 'error';
  detail?: string;
}

// ── State (in-memory + persisted) ──────────────────────────────────────────
const failedAttempts = new Map<string, { count: number; until: number }>();

// ── Boot ────────────────────────────────────────────────────────────────────
function ensureDir() {
  if (!fs.existsSync(REMOTE_DIR)) fs.mkdirSync(REMOTE_DIR, { recursive: true });
}

function loadConfig(): RemoteConfig {
  ensureDir();
  let stored: Partial<RemoteConfig> = {};
  if (fs.existsSync(CONFIG_PATH)) {
    try { stored = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')); } catch {}
  }

  // Env PIN always wins — if MI_PIN is set, override stored pin_hash + require_auth
  const envPin = process.env.MI_PIN || '';
  const cfg: RemoteConfig = {
    pin_hash:             envPin ? hashPin(envPin) : (stored.pin_hash || ''),
    session_ttl_ms:       stored.session_ttl_ms   || 8 * 60 * 60 * 1000,
    max_failed_attempts:  stored.max_failed_attempts || 5,
    lockout_ms:           stored.lockout_ms        || 15 * 60 * 1000,
    allowed_subnets:      stored.allowed_subnets   || ['127.0.0.1', '192.168.0.0/24', '100.0.0.0/8', '10.0.0.0/8', '172.16.0.0/12'],
    require_auth:         envPin ? true : (stored.require_auth || false),
  };

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
  return cfg;
}

export function getConfig(): RemoteConfig { return loadConfig(); }

function saveDevices(devices: DeviceRecord[]) {
  ensureDir();
  fs.writeFileSync(DEVICES_PATH, JSON.stringify(devices, null, 2));
}
function loadDevices(): DeviceRecord[] {
  if (!fs.existsSync(DEVICES_PATH)) return [];
  try { return JSON.parse(fs.readFileSync(DEVICES_PATH, 'utf-8')); } catch { return []; }
}

function saveSessions(sessions: SessionRecord[]) {
  ensureDir();
  fs.writeFileSync(SESSIONS_PATH, JSON.stringify(sessions, null, 2));
}
function loadSessions(): SessionRecord[] {
  if (!fs.existsSync(SESSIONS_PATH)) return [];
  try { return JSON.parse(fs.readFileSync(SESSIONS_PATH, 'utf-8')); } catch { return []; }
}

// ── Helpers ─────────────────────────────────────────────────────────────────
export function hashPin(pin: string): string {
  if (!pin) return '';
  return crypto.createHash('sha256').update(pin + 'mi-remote-salt-2025').digest('hex');
}

function generateToken(): string { return crypto.randomBytes(32).toString('hex'); }
function generateDeviceId(): string { return 'dev_' + crypto.randomBytes(8).toString('hex'); }

function getClientIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || req.socket.remoteAddress
    || 'unknown';
}

function getUserAgent(req: Request): string {
  return (req.headers['user-agent'] || 'unknown').slice(0, 200);
}

// ── IP Allowlist (CIDR check) ────────────────────────────────────────────────
function ipToInt(ip: string): number {
  return ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct), 0) >>> 0;
}

export function isIpAllowed(ip: string, allowedSubnets: string[]): boolean {
  // Always allow loopback
  if (ip === '127.0.0.1' || ip === '::1' || ip === 'unknown') return true;
  // Strip IPv6 prefix
  const cleanIp = ip.replace(/^::ffff:/, '');
  for (const subnet of allowedSubnets) {
    if (subnet === cleanIp) return true;
    if (subnet.includes('/')) {
      const [base, maskStr] = subnet.split('/');
      const mask = parseInt(maskStr);
      try {
        const baseInt = ipToInt(base);
        const ipInt   = ipToInt(cleanIp);
        const maskInt = (0xffffffff << (32 - mask)) >>> 0;
        if ((baseInt & maskInt) === (ipInt & maskInt)) return true;
      } catch {}
    }
  }
  return false;
}

// ── Audit Log ────────────────────────────────────────────────────────────────
export function audit(entry: Omit<AuditEntry, 'ts'>) {
  ensureDir();
  const log: AuditEntry[] = fs.existsSync(AUDIT_PATH)
    ? (() => { try { return JSON.parse(fs.readFileSync(AUDIT_PATH, 'utf-8')); } catch { return []; } })()
    : [];
  log.push({ ts: new Date().toISOString(), ...entry });
  // Keep last 2000 entries
  if (log.length > 2000) log.splice(0, log.length - 2000);
  fs.writeFileSync(AUDIT_PATH, JSON.stringify(log, null, 2));
}

// ── Login ────────────────────────────────────────────────────────────────────
export function login(pin: string, req: Request): { ok: boolean; token?: string; device_id?: string; error?: string } {
  const cfg = loadConfig();
  const ip  = getClientIp(req);
  const ua  = getUserAgent(req);

  // Lockout check
  const fail = failedAttempts.get(ip);
  if (fail && fail.until > Date.now()) {
    const waitMin = Math.ceil((fail.until - Date.now()) / 60000);
    audit({ device_id: 'unknown', ip, action: 'login', result: 'blocked', detail: `locked out ${waitMin}min` });
    return { ok: false, error: `Locked out — try again in ${waitMin} minute(s)` };
  }

  // PIN check
  if (!cfg.pin_hash || hashPin(pin) !== cfg.pin_hash) {
    const current = failedAttempts.get(ip) || { count: 0, until: 0 };
    current.count++;
    if (current.count >= cfg.max_failed_attempts) {
      current.until = Date.now() + cfg.lockout_ms;
      console.warn(`[RemoteAuth] IP ${ip} locked out after ${current.count} failed attempts`);
    }
    failedAttempts.set(ip, current);
    audit({ device_id: 'unknown', ip, action: 'login_failed', result: 'denied', detail: `attempt ${current.count}` });
    return { ok: false, error: 'PIN không đúng' };
  }

  // Reset failures
  failedAttempts.delete(ip);

  // Device
  const devices = loadDevices();
  let device = devices.find(d => d.ip === ip && d.user_agent === ua && !d.revoked);
  if (!device) {
    device = {
      device_id: generateDeviceId(),
      name: detectDeviceName(ua),
      ip, user_agent: ua,
      first_seen: new Date().toISOString(),
      last_seen: new Date().toISOString(),
      trusted: true, revoked: false,
    };
    devices.push(device);
  } else {
    device.last_seen = new Date().toISOString();
  }
  saveDevices(devices);

  // Session
  const sessions = loadSessions().filter(s => s.active && new Date(s.expires_at) > new Date());
  const token = generateToken();
  const now = new Date();
  sessions.push({
    token,
    device_id: device.device_id,
    ip,
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + cfg.session_ttl_ms).toISOString(),
    active: true,
  });
  saveSessions(sessions);

  audit({ device_id: device.device_id, ip, action: 'login_ok', result: 'ok', detail: device.name });
  console.log(`[RemoteAuth] Login OK — ${device.name} (${ip})`);
  return { ok: true, token, device_id: device.device_id };
}

// ── Validate session ─────────────────────────────────────────────────────────
export function validateSession(token: string): { valid: boolean; device_id?: string; ip?: string } {
  const sessions = loadSessions();
  const session = sessions.find(s => s.token === token && s.active);
  if (!session) return { valid: false };
  if (new Date(session.expires_at) < new Date()) {
    session.active = false;
    saveSessions(sessions);
    return { valid: false };
  }
  // Check device not revoked
  const devices = loadDevices();
  const device = devices.find(d => d.device_id === session.device_id);
  if (device?.revoked) return { valid: false };
  return { valid: true, device_id: session.device_id, ip: session.ip };
}

// ── Logout / Revoke ──────────────────────────────────────────────────────────
export function logout(token: string) {
  const sessions = loadSessions();
  const s = sessions.find(s => s.token === token);
  if (s) { s.active = false; saveSessions(sessions); }
}

export function revokeDevice(device_id: string) {
  const devices = loadDevices();
  const d = devices.find(d => d.device_id === device_id);
  if (d) { d.revoked = true; saveDevices(devices); }
  // Kill all sessions for this device
  const sessions = loadSessions();
  sessions.filter(s => s.device_id === device_id).forEach(s => s.active = false);
  saveSessions(sessions);
}

// ── Queries ──────────────────────────────────────────────────────────────────
export function listDevices(): DeviceRecord[] { return loadDevices(); }
export function listActiveSessions(): SessionRecord[] {
  return loadSessions().filter(s => s.active && new Date(s.expires_at) > new Date());
}
export function getAuditLog(limit = 100): AuditEntry[] {
  if (!fs.existsSync(AUDIT_PATH)) return [];
  try {
    const log: AuditEntry[] = JSON.parse(fs.readFileSync(AUDIT_PATH, 'utf-8'));
    return log.slice(-limit).reverse();
  } catch { return []; }
}

// ── Express Middleware ────────────────────────────────────────────────────────

/** Block requests from non-allowed IPs (before auth check) */
export function ipGuard(req: Request, res: Response, next: NextFunction) {
  const cfg = loadConfig();
  const ip  = getClientIp(req);
  if (!isIpAllowed(ip, cfg.allowed_subnets)) {
    console.warn(`[RemoteAuth] BLOCKED IP: ${ip} → ${req.path}`);
    audit({ device_id: 'unknown', ip, action: req.method + ' ' + req.path, result: 'blocked', detail: 'IP not in allowlist' });
    return res.status(403).json({ error: 'Access denied — not in allowed network' });
  }
  next();
}

/** Require valid session token (skip if no PIN configured) */
export function requireRemoteAuth(req: Request, res: Response, next: NextFunction) {
  const cfg = loadConfig();
  if (!cfg.require_auth) return next();

  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized — Mi PIN required', hint: 'POST /api/remote/login' });

  const session = validateSession(token);
  if (!session.valid) return res.status(401).json({ error: 'Session expired or invalid — please login again' });

  (req as Request & { device_id?: string }).device_id = session.device_id;
  next();
}

function extractToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return (req.query.token as string) || (req.cookies?.mi_token) || null;
}

function detectDeviceName(ua: string): string {
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Macintosh|Mac OS X/.test(ua)) return 'MacBook';
  if (/Android/.test(ua)) return 'Android';
  if (/Windows/.test(ua)) return 'Windows PC';
  return 'Unknown Device';
}
