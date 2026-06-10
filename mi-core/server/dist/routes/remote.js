"use strict";
/**
 * Remote Access Routes — /api/remote
 * Health, login, logout, device management, audit log
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.remoteRouter = void 0;
const express_1 = require("express");
const gate_1 = require("../approval/gate");
const network_info_1 = require("../remote/network-info");
const remote_auth_1 = require("../remote/remote-auth");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
exports.remoteRouter = (0, express_1.Router)();
const PORT = parseInt(process.env.MI_PORT || '4001');
const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const CONFIG_PATH = path_1.default.join(GLOBAL_DIR, 'remote-access', 'config.json');
// ── GET /api/remote/health — public, shows server info ──────────────────────
exports.remoteRouter.get('/health', (_req, res) => {
    const net = (0, network_info_1.getNetworkInfo)(PORT);
    const cfg = (0, remote_auth_1.getConfig)();
    const pending = (0, gate_1.getPending)();
    res.json({
        server: 'online',
        host: '0.0.0.0',
        port: PORT,
        lan_ip: net.lan_ip,
        lan_url: net.lan_url,
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
exports.remoteRouter.post('/login', (req, res) => {
    const { pin } = req.body;
    if (!pin)
        return res.status(400).json({ error: 'pin required' });
    const result = (0, remote_auth_1.login)(pin, req);
    if (!result.ok)
        return res.status(401).json({ error: result.error });
    res.json({
        ok: true,
        token: result.token,
        device_id: result.device_id,
        message: 'Đăng nhập thành công — chào mừng CEO 👋',
    });
});
// ── POST /api/remote/logout ───────────────────────────────────────────────────
exports.remoteRouter.post('/logout', (req, res) => {
    const token = extractToken(req);
    if (token)
        (0, remote_auth_1.logout)(token);
    res.json({ ok: true });
});
// ── GET /api/remote/devices — list trusted devices ───────────────────────────
exports.remoteRouter.get('/devices', remote_auth_1.requireRemoteAuth, (_req, res) => {
    res.json({ devices: (0, remote_auth_1.listDevices)() });
});
// ── DELETE /api/remote/devices/:id — revoke device ───────────────────────────
exports.remoteRouter.delete('/devices/:id', remote_auth_1.requireRemoteAuth, (req, res) => {
    (0, remote_auth_1.revokeDevice)(req.params.id);
    res.json({ ok: true, revoked: req.params.id });
});
// ── GET /api/remote/sessions — active sessions ───────────────────────────────
exports.remoteRouter.get('/sessions', remote_auth_1.requireRemoteAuth, (_req, res) => {
    res.json({ sessions: (0, remote_auth_1.listActiveSessions)() });
});
// ── GET /api/remote/audit — audit log ────────────────────────────────────────
exports.remoteRouter.get('/audit', remote_auth_1.requireRemoteAuth, (req, res) => {
    const limit = parseInt(req.query.limit || '100');
    res.json({ log: (0, remote_auth_1.getAuditLog)(limit) });
});
// ── POST /api/remote/config — update config (require auth + PIN confirm) ─────
exports.remoteRouter.post('/config', remote_auth_1.requireRemoteAuth, (req, res) => {
    const { new_pin, session_ttl_hours, allowed_subnets } = req.body;
    const cfg = (0, remote_auth_1.getConfig)();
    if (new_pin)
        cfg.pin_hash = (0, remote_auth_1.hashPin)(new_pin);
    if (session_ttl_hours)
        cfg.session_ttl_ms = session_ttl_hours * 3600 * 1000;
    if (allowed_subnets?.length)
        cfg.allowed_subnets = allowed_subnets;
    cfg.require_auth = true;
    fs_1.default.mkdirSync(path_1.default.dirname(CONFIG_PATH), { recursive: true });
    fs_1.default.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
    res.json({ ok: true, config: cfg });
});
// ── GET /api/remote/qr-data — data to build QR on frontend ──────────────────
exports.remoteRouter.get('/qr-data', (_req, res) => {
    const net = (0, network_info_1.getNetworkInfo)(PORT);
    const preferredUrl = net.tailscale_url || net.lan_url || `http://127.0.0.1:${PORT}`;
    res.json({
        url: preferredUrl,
        tailscale_url: net.tailscale_url,
        lan_url: net.lan_url,
        note: net.tailscale_url ? 'Tailscale (ưu tiên — an toàn hơn)' : 'LAN only',
    });
});
// ── Helpers ──────────────────────────────────────────────────────────────────
function extractToken(req) {
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer '))
        return auth.slice(7);
    return req.query.token || null;
}
