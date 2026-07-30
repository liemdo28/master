import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const SESSIONS_DIR = path.join(GLOBAL_DIR, 'remote-sessions');
const DEVICES_FILE = path.join(GLOBAL_DIR, 'remote-devices.json');
function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }
function loadDevices() { try { return JSON.parse(fs.readFileSync(DEVICES_FILE, 'utf-8')); } catch { return { trusted: [], revoked: [] }; } }
function saveDevices(d) { fs.writeFileSync(DEVICES_FILE, JSON.stringify(d, null, 2)); }
export class RemoteAccessManager {
  constructor(options = {}) {
    this.sessionTimeout = options.sessionTimeout || 30 * 60 * 1000;
    this.sessions = new Map();
    this.pin = process.env.MI_REMOTE_PIN || '1234';
  }
  createSession(deviceInfo = {}) {
    const sid = crypto.randomUUID();
    const session = { id: sid, created_at: new Date().toISOString(), last_active: new Date().toISOString(), device: deviceInfo, ip_address: deviceInfo.ip || 'unknown' };
    this.sessions.set(sid, session);
    ensureDir(SESSIONS_DIR);
    fs.writeFileSync(path.join(SESSIONS_DIR, sid + '.json'), JSON.stringify(session));
    return { session_id: sid, expires_in: this.sessionTimeout };
  }
  validateSession(sid) {
    let s = this.sessions.get(sid);
    if (!s) { const sp = path.join(SESSIONS_DIR, sid + '.json'); if (fs.existsSync(sp)) { s = JSON.parse(fs.readFileSync(sp, 'utf-8')); this.sessions.set(sid, s); } else return { valid: false, reason: 'Session not found' }; }
    const age = Date.now() - new Date(s.last_active).getTime();
    if (age > this.sessionTimeout) { this.sessions.delete(sid); return { valid: false, reason: 'Session expired' }; }
    s.last_active = new Date().toISOString();
    return { valid: true, session: s };
  }
  revokeSession(sid) { this.sessions.delete(sid); const sp = path.join(SESSIONS_DIR, sid + '.json'); if (fs.existsSync(sp)) fs.unlinkSync(sp); return { ok: true }; }
  validatePin(pin) { return pin === this.pin; }
  getTrustedDevices() { return loadDevices().trusted; }
  revokeDevice(deviceId) { const d = loadDevices(); d.revoked.push({ device_id: deviceId, revoked_at: new Date().toISOString() }); saveDevices(d); return { ok: true }; }
  addTrustedDevice(device) { const d = loadDevices(); if (!d.trusted.find(x => x.device_id === device.device_id)) d.trusted.push(device); saveDevices(d); return { ok: true }; }
  isDeviceRevoked(deviceId) { const d = loadDevices(); return d.revoked.some(x => x.device_id === deviceId); }
}
export const remoteAccessManager = new RemoteAccessManager();
