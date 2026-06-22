/**
 * WhatsApp API Key Manager for Mi-Core
 *
 * Manages API keys issued by whatsapp-api.
 * - Stores only hash, never raw key
 * - Supports setup, rotate, validate, revoke
 * - Rate limiting per client
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// ── Paths ───────────────────────────────────────────────────────────────────
const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const CONFIG_DIR = path.join(GLOBAL_DIR, 'mi-core');
const CONFIG_PATH = path.join(CONFIG_DIR, 'whatsapp-client.json');
const AUDIT_LOG_PATH = path.join(GLOBAL_DIR, 'connectors', 'whatsapp', 'audit_log.json');

// ── Types ───────────────────────────────────────────────────────────────────
export interface WhatsAppClientConfig {
  client_id: string;
  whatsapp_api_base_url: string;
  api_key_hash: string;
  status: 'active' | 'revoked' | 'expired';
  allowed_routes: string[];
  created_at: string;
  last_used_at: string;
  rate_limit: {
    per_minute: number;
    per_hour: number;
  };
}

export interface RateLimitState {
  minute_window: number[];    // timestamps of requests in current minute
  hour_window: number[];      // timestamps of requests in current hour
}

// ── In-memory state ─────────────────────────────────────────────────────────
const rateLimitMap = new Map<string, RateLimitState>();

// ── Helpers ─────────────────────────────────────────────────────────────────
function ensureDir() {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

function hashApiKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey + 'mi-wa-salt-2026').digest('hex');
}

function getAuditLog(): any[] {
  if (!fs.existsSync(AUDIT_LOG_PATH)) return [];
  try { return JSON.parse(fs.readFileSync(AUDIT_LOG_PATH, 'utf-8')); } catch { return []; }
}

function appendAudit(entry: any) {
  const log = getAuditLog();
  log.push({ ts: new Date().toISOString(), ...entry });
  if (log.length > 2000) log.splice(0, log.length - 2000);
  ensureDir();
  const auditDir = path.dirname(AUDIT_LOG_PATH);
  if (!fs.existsSync(auditDir)) fs.mkdirSync(auditDir, { recursive: true });
  fs.writeFileSync(AUDIT_LOG_PATH, JSON.stringify(log, null, 2));
}

// ── Config management ───────────────────────────────────────────────────────
function loadConfig(): WhatsAppClientConfig {
  ensureDir();
  let stored: Partial<WhatsAppClientConfig> = {};
  if (fs.existsSync(CONFIG_PATH)) {
    try { stored = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')); } catch {}
  }

  const cfg: WhatsAppClientConfig = {
    client_id: stored.client_id || 'mi-core',
    whatsapp_api_base_url: stored.whatsapp_api_base_url || '',
    api_key_hash: stored.api_key_hash || '',
    status: stored.status || 'active',
    allowed_routes: stored.allowed_routes || ['/api/whatsapp/mi'],
    created_at: stored.created_at || '',
    last_used_at: stored.last_used_at || '',
    rate_limit: stored.rate_limit || { per_minute: 60, per_hour: 1000 },
  };

  return cfg;
}

function saveConfig(cfg: WhatsAppClientConfig) {
  ensureDir();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Check if an API key is configured.
 */
export function isKeyConfigured(): boolean {
  const cfg = loadConfig();
  return cfg.api_key_hash.length > 0 && cfg.status === 'active';
}

/**
 * Setup API key: validate against whatsapp-api, then store hash.
 * @param rawKey The raw API key from whatsapp-api
 * @param baseUrl Optional base URL of whatsapp-api
 */
export async function setupApiKey(rawKey: string, baseUrl?: string): Promise<{ ok: boolean; error?: string }> {
  if (!rawKey || rawKey.length < 8) {
    return { ok: false, error: 'API key too short — must be at least 8 characters' };
  }

  const cfg = loadConfig();

  // Validate against whatsapp-api health endpoint
  const url = baseUrl || cfg.whatsapp_api_base_url || process.env.WHATSAPP_API_BASE_URL;
  if (url) {
    try {
      const healthRes = await fetch(`${url}/health`, {
        headers: { 'X-API-Key': rawKey },
        signal: AbortSignal.timeout(10000),
      });
      if (!healthRes.ok) {
        appendAudit({ action: 'key_setup_failed', detail: `whatsapp-api returned ${healthRes.status}`, ip: 'internal' });
        return { ok: false, error: `whatsapp-api rejected key (HTTP ${healthRes.status})` };
      }
    } catch (e: any) {
      appendAudit({ action: 'key_setup_warning', detail: `Cannot reach whatsapp-api: ${e.message}`, ip: 'internal' });
      // Allow setup even if whatsapp-api is unreachable — key can be validated later
    }
  }

  cfg.api_key_hash = hashApiKey(rawKey);
  cfg.whatsapp_api_base_url = url || cfg.whatsapp_api_base_url || '';
  cfg.status = 'active';
  cfg.created_at = cfg.created_at || new Date().toISOString();
  cfg.last_used_at = new Date().toISOString();

  saveConfig(cfg);
  appendAudit({ action: 'key_setup', detail: 'API key configured successfully', ip: 'internal' });
  return { ok: true };
}

/**
 * Validate an incoming API key.
 */
export function validateApiKey(rawKey: string): boolean {
  const cfg = loadConfig();
  if (!cfg.api_key_hash || cfg.status !== 'active') return false;
  return hashApiKey(rawKey) === cfg.api_key_hash;
}

/**
 * Rotate API key: validate new key, replace hash.
 */
export async function rotateApiKey(newRawKey: string): Promise<{ ok: boolean; error?: string }> {
  if (!newRawKey || newRawKey.length < 8) {
    return { ok: false, error: 'New API key too short' };
  }

  const cfg = loadConfig();
  cfg.api_key_hash = hashApiKey(newRawKey);
  cfg.last_used_at = new Date().toISOString();
  saveConfig(cfg);

  appendAudit({ action: 'key_rotated', detail: 'API key rotated successfully', ip: 'internal' });
  return { ok: true };
}

/**
 * Revoke the API key locally.
 */
export function revokeApiKey(): void {
  const cfg = loadConfig();
  cfg.api_key_hash = '';
  cfg.status = 'revoked';
  cfg.last_used_at = new Date().toISOString();
  saveConfig(cfg);

  appendAudit({ action: 'key_revoked', detail: 'API key revoked locally', ip: 'internal' });
}

/**
 * Get API key status (safe — no raw key).
 */
export function getKeyStatus(): {
  configured: boolean;
  status: string;
  last_used_at: string;
  created_at: string;
  base_url: string;
  rate_limit: { per_minute: number; per_hour: number };
} {
  const cfg = loadConfig();
  return {
    configured: cfg.api_key_hash.length > 0,
    status: cfg.status,
    last_used_at: cfg.last_used_at,
    created_at: cfg.created_at,
    base_url: cfg.whatsapp_api_base_url,
    rate_limit: cfg.rate_limit,
  };
}

/**
 * Rate limit check per client_id.
 */
export function checkRateLimit(clientId: string): { allowed: boolean; retry_after_seconds?: number } {
  const cfg = loadConfig();
  const now = Date.now();
  const minuteAgo = now - 60_000;
  const hourAgo = now - 3_600_000;

  let state = rateLimitMap.get(clientId);
  if (!state) {
    state = { minute_window: [], hour_window: [] };
    rateLimitMap.set(clientId, state);
  }

  // Clean old entries
  state.minute_window = state.minute_window.filter(t => t > minuteAgo);
  state.hour_window = state.hour_window.filter(t => t > hourAgo);

  // Check limits
  if (state.minute_window.length >= cfg.rate_limit.per_minute) {
    const oldest = state.minute_window[0];
    const retryAfter = Math.ceil((oldest - minuteAgo) / 1000);
    return { allowed: false, retry_after_seconds: retryAfter };
  }

  if (state.hour_window.length >= cfg.rate_limit.per_hour) {
    const oldest = state.hour_window[0];
    const retryAfter = Math.ceil((oldest - hourAgo) / 1000);
    return { allowed: false, retry_after_seconds: retryAfter };
  }

  // Allow
  state.minute_window.push(now);
  state.hour_window.push(now);

  // Update last_used
  cfg.last_used_at = new Date().toISOString();
  saveConfig(cfg);

  return { allowed: true };
}

/**
 * Get rate limit state for debugging.
 */
export function getRateLimitState(clientId: string): { minute_count: number; hour_count: number; limits: { per_minute: number; per_hour: number } } {
  const cfg = loadConfig();
  const now = Date.now();
  const minuteAgo = now - 60_000;
  const hourAgo = now - 3_600_000;

  const state = rateLimitMap.get(clientId);
  if (!state) return { minute_count: 0, hour_count: 0, limits: cfg.rate_limit };

  return {
    minute_count: state.minute_window.filter(t => t > minuteAgo).length,
    hour_count: state.hour_window.filter(t => t > hourAgo).length,
    limits: cfg.rate_limit,
  };
}

/**
 * Replay protection by message_id.
 */
const processedMessageIds = new Set<string>();
const REPLAY_CLEANUP_INTERVAL = 30 * 60_000; // 30 min

// Periodic cleanup
setInterval(() => {
  if (processedMessageIds.size > 10000) processedMessageIds.clear();
}, REPLAY_CLEANUP_INTERVAL);

export function isMessageDuplicate(messageId: string): boolean {
  if (!messageId) return false;
  if (processedMessageIds.has(messageId)) return true;
  processedMessageIds.add(messageId);
  return false;
}

/**
 * Get audit log entries.
 */
export function getAuditEntries(limit = 100): any[] {
  return getAuditLog().slice(-limit).reverse();
}
