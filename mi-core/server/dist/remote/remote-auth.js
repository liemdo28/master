"use strict";
/**
 * Remote Auth — device-aware PIN auth for Mi-Core remote access
 * Handles: PIN login, session tokens, device tracking,
 *          failed-login lockout, audit log, IP allowlist
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfig = getConfig;
exports.hashPin = hashPin;
exports.isIpAllowed = isIpAllowed;
exports.audit = audit;
exports.login = login;
exports.validateSession = validateSession;
exports.logout = logout;
exports.revokeDevice = revokeDevice;
exports.listDevices = listDevices;
exports.listActiveSessions = listActiveSessions;
exports.getAuditLog = getAuditLog;
exports.ipGuard = ipGuard;
exports.requireRemoteAuth = requireRemoteAuth;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
// ── Paths ───────────────────────────────────────────────────────────────────
const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const REMOTE_DIR = path_1.default.join(GLOBAL_DIR, 'remote-access');
const CONFIG_PATH = path_1.default.join(REMOTE_DIR, 'config.json');
const DEVICES_PATH = path_1.default.join(REMOTE_DIR, 'trusted_devices.json');
const SESSIONS_PATH = path_1.default.join(REMOTE_DIR, 'sessions.json');
const AUDIT_PATH = path_1.default.join(REMOTE_DIR, 'audit_log.json');
// ── State (in-memory + persisted) ──────────────────────────────────────────
const failedAttempts = new Map();
// ── Boot ────────────────────────────────────────────────────────────────────
function ensureDir() {
    if (!fs_1.default.existsSync(REMOTE_DIR))
        fs_1.default.mkdirSync(REMOTE_DIR, { recursive: true });
}
function loadConfig() {
    ensureDir();
    let stored = {};
    if (fs_1.default.existsSync(CONFIG_PATH)) {
        try {
            stored = JSON.parse(fs_1.default.readFileSync(CONFIG_PATH, 'utf-8'));
        }
        catch { }
    }
    // Env PIN always wins — if MI_PIN is set, override stored pin_hash + require_auth
    const envPin = process.env.MI_PIN || '';
    const cfg = {
        pin_hash: envPin ? hashPin(envPin) : (stored.pin_hash || ''),
        session_ttl_ms: stored.session_ttl_ms || 8 * 60 * 60 * 1000,
        max_failed_attempts: stored.max_failed_attempts || 5,
        lockout_ms: stored.lockout_ms || 15 * 60 * 1000,
        allowed_subnets: stored.allowed_subnets || ['127.0.0.1', '192.168.0.0/24', '100.0.0.0/8', '10.0.0.0/8', '172.16.0.0/12'],
        require_auth: envPin ? true : (stored.require_auth || false),
    };
    fs_1.default.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
    return cfg;
}
function getConfig() { return loadConfig(); }
function saveDevices(devices) {
    ensureDir();
    fs_1.default.writeFileSync(DEVICES_PATH, JSON.stringify(devices, null, 2));
}
function loadDevices() {
    if (!fs_1.default.existsSync(DEVICES_PATH))
        return [];
    try {
        return JSON.parse(fs_1.default.readFileSync(DEVICES_PATH, 'utf-8'));
    }
    catch {
        return [];
    }
}
function saveSessions(sessions) {
    ensureDir();
    fs_1.default.writeFileSync(SESSIONS_PATH, JSON.stringify(sessions, null, 2));
}
function loadSessions() {
    if (!fs_1.default.existsSync(SESSIONS_PATH))
        return [];
    try {
        return JSON.parse(fs_1.default.readFileSync(SESSIONS_PATH, 'utf-8'));
    }
    catch {
        return [];
    }
}
// ── Helpers ─────────────────────────────────────────────────────────────────
function hashPin(pin) {
    if (!pin)
        return '';
    return crypto_1.default.createHash('sha256').update(pin + 'mi-remote-salt-2025').digest('hex');
}
function generateToken() { return crypto_1.default.randomBytes(32).toString('hex'); }
function generateDeviceId() { return 'dev_' + crypto_1.default.randomBytes(8).toString('hex'); }
function getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || req.socket.remoteAddress
        || 'unknown';
}
function getUserAgent(req) {
    return (req.headers['user-agent'] || 'unknown').slice(0, 200);
}
// ── IP Allowlist (CIDR check) ────────────────────────────────────────────────
function ipToInt(ip) {
    return ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct), 0) >>> 0;
}
function isIpAllowed(ip, allowedSubnets) {
    // Always allow loopback
    if (ip === '127.0.0.1' || ip === '::1' || ip === 'unknown')
        return true;
    // Strip IPv6 prefix
    const cleanIp = ip.replace(/^::ffff:/, '');
    for (const subnet of allowedSubnets) {
        if (subnet === cleanIp)
            return true;
        if (subnet.includes('/')) {
            const [base, maskStr] = subnet.split('/');
            const mask = parseInt(maskStr);
            try {
                const baseInt = ipToInt(base);
                const ipInt = ipToInt(cleanIp);
                const maskInt = (0xffffffff << (32 - mask)) >>> 0;
                if ((baseInt & maskInt) === (ipInt & maskInt))
                    return true;
            }
            catch { }
        }
    }
    return false;
}
// ── Audit Log ────────────────────────────────────────────────────────────────
function audit(entry) {
    ensureDir();
    const log = fs_1.default.existsSync(AUDIT_PATH)
        ? (() => { try {
            return JSON.parse(fs_1.default.readFileSync(AUDIT_PATH, 'utf-8'));
        }
        catch {
            return [];
        } })()
        : [];
    log.push({ ts: new Date().toISOString(), ...entry });
    // Keep last 2000 entries
    if (log.length > 2000)
        log.splice(0, log.length - 2000);
    fs_1.default.writeFileSync(AUDIT_PATH, JSON.stringify(log, null, 2));
}
// ── Login ────────────────────────────────────────────────────────────────────
function login(pin, req) {
    const cfg = loadConfig();
    const ip = getClientIp(req);
    const ua = getUserAgent(req);
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
    }
    else {
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
function validateSession(token) {
    const sessions = loadSessions();
    const session = sessions.find(s => s.token === token && s.active);
    if (!session)
        return { valid: false };
    if (new Date(session.expires_at) < new Date()) {
        session.active = false;
        saveSessions(sessions);
        return { valid: false };
    }
    // Check device not revoked
    const devices = loadDevices();
    const device = devices.find(d => d.device_id === session.device_id);
    if (device?.revoked)
        return { valid: false };
    return { valid: true, device_id: session.device_id, ip: session.ip };
}
// ── Logout / Revoke ──────────────────────────────────────────────────────────
function logout(token) {
    const sessions = loadSessions();
    const s = sessions.find(s => s.token === token);
    if (s) {
        s.active = false;
        saveSessions(sessions);
    }
}
function revokeDevice(device_id) {
    const devices = loadDevices();
    const d = devices.find(d => d.device_id === device_id);
    if (d) {
        d.revoked = true;
        saveDevices(devices);
    }
    // Kill all sessions for this device
    const sessions = loadSessions();
    sessions.filter(s => s.device_id === device_id).forEach(s => s.active = false);
    saveSessions(sessions);
}
// ── Queries ──────────────────────────────────────────────────────────────────
function listDevices() { return loadDevices(); }
function listActiveSessions() {
    return loadSessions().filter(s => s.active && new Date(s.expires_at) > new Date());
}
function getAuditLog(limit = 100) {
    if (!fs_1.default.existsSync(AUDIT_PATH))
        return [];
    try {
        const log = JSON.parse(fs_1.default.readFileSync(AUDIT_PATH, 'utf-8'));
        return log.slice(-limit).reverse();
    }
    catch {
        return [];
    }
}
// ── Express Middleware ────────────────────────────────────────────────────────
/** Block requests from non-allowed IPs (before auth check) */
function ipGuard(req, res, next) {
    const cfg = loadConfig();
    const ip = getClientIp(req);
    if (!isIpAllowed(ip, cfg.allowed_subnets)) {
        console.warn(`[RemoteAuth] BLOCKED IP: ${ip} → ${req.path}`);
        audit({ device_id: 'unknown', ip, action: req.method + ' ' + req.path, result: 'blocked', detail: 'IP not in allowlist' });
        return res.status(403).json({ error: 'Access denied — not in allowed network' });
    }
    next();
}
/** Require valid session token (skip if no PIN configured) */
function requireRemoteAuth(req, res, next) {
    const cfg = loadConfig();
    if (!cfg.require_auth)
        return next();
    const token = extractToken(req);
    if (!token)
        return res.status(401).json({ error: 'Unauthorized — Mi PIN required', hint: 'POST /api/remote/login' });
    const session = validateSession(token);
    if (!session.valid)
        return res.status(401).json({ error: 'Session expired or invalid — please login again' });
    req.device_id = session.device_id;
    next();
}
function extractToken(req) {
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer '))
        return auth.slice(7);
    return req.query.token || (req.cookies?.mi_token) || null;
}
function detectDeviceName(ua) {
    if (/iPhone/.test(ua))
        return 'iPhone';
    if (/iPad/.test(ua))
        return 'iPad';
    if (/Macintosh|Mac OS X/.test(ua))
        return 'MacBook';
    if (/Android/.test(ua))
        return 'Android';
    if (/Windows/.test(ua))
        return 'Windows PC';
    return 'Unknown Device';
}
