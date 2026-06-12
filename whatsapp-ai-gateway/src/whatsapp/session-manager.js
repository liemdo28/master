const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const { makeLogger } = require('../logger');
const { sendAlert } = require('../telegram/telegram-forwarder');

const log = makeLogger('connection');

const CLIENT_ID = process.env.WHATSAPP_CLIENT_ID || 'bakudan-food-safety';
const DEFAULT_SESSION_ROOT = process.env.PROGRAMDATA
  ? path.join(process.env.PROGRAMDATA, 'BakudanFoodSafety', 'whatsapp')
  : path.resolve('./data/whatsapp');
const SESSION_ROOT = path.resolve(process.env.WHATSAPP_SESSION_ROOT || DEFAULT_SESSION_ROOT);
const SESSION_DIR = path.resolve(process.env.SESSION_DIR || path.join(SESSION_ROOT, 'auth'));
const CACHE_DIR = path.resolve(process.env.WWEBJS_CACHE_DIR || path.join(SESSION_ROOT, 'cache'));
const SESSION_META_FILE = path.join(SESSION_ROOT, 'session.json');
const AUTH_STATE_FILE = path.join(SESSION_ROOT, 'auth-state.json');
const DIAGNOSTICS_LOG = path.resolve('./logs/whatsapp-diagnostics.log');
const PUPPETEER_EXECUTABLE_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH || '';
const HEADLESS = String(process.env.WHATSAPP_HEADLESS || 'false').toLowerCase() !== 'false';
const REMOTE_WEB_CACHE = process.env.WWEBJS_REMOTE_WEB_CACHE || 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/{version}.html';
const USER_AGENT = process.env.WHATSAPP_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';

let client = null;
let qrData = null;
let reconnectTimer = null;
let initializing = null;
let heartbeatTimer = null;
let reconnectCount = 0;
let reconnectDelay = 15_000;

const RECONNECT_DELAYS = [15_000, 30_000, 60_000, 120_000]; // exponential cap at 120s
const MAX_RECONNECT_ALERTS = 3; // send Telegram alert every N failures

const runtimeStatus = {
  state: 'DISCONNECTED',
  last_error: '',
  last_qr_at: '',
  last_authenticated_at: '',
  last_ready_at: '',
  last_disconnected_at: '',
  last_connected_at: '',
  account_name: '',
  phone_number: '',
  session_started_at: '',
  restart_count: 0,
};

function now() {
  return new Date().toISOString();
}

function setState(state, extra = {}) {
  runtimeStatus.state = state;
  Object.assign(runtimeStatus, extra);
}

function writeDiagnostics(event, detail = {}) {
  const line = {
    timestamp: now(),
    event,
    state: runtimeStatus.state,
    ...detail,
  };
  try {
    fs.mkdirSync(path.dirname(DIAGNOSTICS_LOG), { recursive: true });
    fs.appendFileSync(DIAGNOSTICS_LOG, `${JSON.stringify(line)}\n`, 'utf8');
  } catch (err) {
    log.warn('WhatsApp diagnostics write failed', { error: err.message });
  }
}

function hasStoredSession() {
  const localAuthDir = path.join(SESSION_DIR, `session-${CLIENT_ID}`);
  return fs.existsSync(localAuthDir) || fs.existsSync(SESSION_META_FILE) || fs.existsSync(AUTH_STATE_FILE);
}

function copyDirectoryContents(source, target) {
  if (!fs.existsSync(source)) return false;
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    fs.cpSync(from, to, { recursive: true, force: true });
  }
  return true;
}

function migrateLegacySessionIfNeeded() {
  if (hasStoredSession()) return;
  const legacyAuthSources = [
    path.resolve('./.wwebjs_auth'),
    path.resolve('./data/session'),
    path.resolve('./LocalAuth'),
  ];
  for (const source of legacyAuthSources) {
    try {
      if (copyDirectoryContents(source, SESSION_DIR)) {
        writeDiagnostics('legacy_session_migrated', { source, target: SESSION_DIR });
        break;
      }
    } catch (err) {
      writeDiagnostics('legacy_session_migration_failed', { source, error: err.message });
    }
  }
  try {
    copyDirectoryContents(path.resolve('./.wwebjs_cache'), CACHE_DIR);
  } catch (err) {
    writeDiagnostics('legacy_cache_migration_failed', { error: err.message });
  }
}

function getConnectionStatus() {
  if (runtimeStatus.state === 'READY') return 'CONNECTED';
  if (runtimeStatus.state === 'INITIALIZING') return hasStoredSession() ? 'RECONNECTING' : 'AUTH_REQUIRED';
  if (runtimeStatus.state === 'AUTHENTICATED') return 'RECONNECTING';
  if (runtimeStatus.state === 'QR') return 'AUTH_REQUIRED';
  if (runtimeStatus.state === 'AUTH_FAILURE') return 'AUTH_REQUIRED';
  if (reconnectTimer) return 'RECONNECTING';
  return 'DISCONNECTED';
}

function getSessionAgeSeconds() {
  const started = runtimeStatus.session_started_at || readSessionMetadata().session_started_at;
  if (!started) return null;
  const ts = new Date(started).getTime();
  if (!Number.isFinite(ts)) return null;
  return Math.max(0, Math.floor((Date.now() - ts) / 1000));
}

function readSessionMetadata() {
  try {
    if (!fs.existsSync(SESSION_META_FILE)) return {};
    return JSON.parse(fs.readFileSync(SESSION_META_FILE, 'utf8'));
  } catch (_) {
    return {};
  }
}

function saveSessionMetadata(extra = {}) {
  const info = client?.info || {};
  const wid = info.wid?._serialized || info.wid?.user || '';
  const metadata = {
    client_id: CLIENT_ID,
    session_root: SESSION_ROOT,
    session_dir: SESSION_DIR,
    cache_dir: CACHE_DIR,
    state: runtimeStatus.state,
    connection_status: getConnectionStatus(),
    account_name: runtimeStatus.account_name || info.pushname || info.displayName || '',
    phone_number: runtimeStatus.phone_number || info.me?._serialized || wid || '',
    session_started_at: runtimeStatus.session_started_at || runtimeStatus.last_authenticated_at || now(),
    last_connected_at: runtimeStatus.last_connected_at || runtimeStatus.last_ready_at || '',
    last_saved_at: now(),
    ...extra,
  };
  try {
    fs.mkdirSync(SESSION_ROOT, { recursive: true });
    fs.writeFileSync(SESSION_META_FILE, JSON.stringify(metadata, null, 2), 'utf8');
    fs.writeFileSync(AUTH_STATE_FILE, JSON.stringify({
      client_id: CLIENT_ID,
      has_local_auth: hasStoredSession(),
      saved_at: metadata.last_saved_at,
      session_dir: SESSION_DIR,
    }, null, 2), 'utf8');
  } catch (err) {
    writeDiagnostics('save_session_error', { error: err.message });
  }
  return metadata;
}

function getStatus() {
  const metadata = readSessionMetadata();
  return {
    status: runtimeStatus.state.toLowerCase(),
    client_id: CLIENT_ID,
    connection_status: getConnectionStatus(),
    qrData,
    readyAt: runtimeStatus.last_ready_at || null,
    account_name: runtimeStatus.account_name || metadata.account_name || '',
    phone_number: runtimeStatus.phone_number || metadata.phone_number || '',
    last_connected_at: runtimeStatus.last_connected_at || metadata.last_connected_at || '',
    session_started_at: runtimeStatus.session_started_at || metadata.session_started_at || '',
    session_age_seconds: getSessionAgeSeconds(),
    has_stored_session: hasStoredSession(),
    session_root: SESSION_ROOT,
    session_dir: SESSION_DIR,
    cache_dir: CACHE_DIR,
    ...runtimeStatus,
  };
}

function getPuppeteerConfig() {
  return {
    headless: HEADLESS,
    ...(PUPPETEER_EXECUTABLE_PATH ? { executablePath: PUPPETEER_EXECUTABLE_PATH } : {}),
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  };
}

function createClient() {
  fs.mkdirSync(SESSION_ROOT, { recursive: true });
  fs.mkdirSync(SESSION_DIR, { recursive: true });
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  migrateLegacySessionIfNeeded();
  setState('INITIALIZING');
  writeDiagnostics('initializing', {
    clientId: CLIENT_ID,
    sessionRoot: SESSION_ROOT,
    sessionDir: SESSION_DIR,
    cacheDir: CACHE_DIR,
    chrome: PUPPETEER_EXECUTABLE_PATH || 'puppeteer-default',
    headless: HEADLESS,
  });

  client = new Client({
    authStrategy: new LocalAuth({
      clientId: CLIENT_ID,
      dataPath: SESSION_DIR,
    }),
    authTimeoutMs: parseInt(process.env.WHATSAPP_AUTH_TIMEOUT_MS || '120000', 10),
    qrMaxRetries: parseInt(process.env.WHATSAPP_QR_MAX_RETRIES || '0', 10),
    takeoverOnConflict: process.env.WHATSAPP_TAKEOVER_ON_CONFLICT !== 'false',
    takeoverTimeoutMs: parseInt(process.env.WHATSAPP_TAKEOVER_TIMEOUT_MS || '0', 10),
    userAgent: USER_AGENT,
    webVersionCache: {
      type: 'remote',
      remotePath: REMOTE_WEB_CACHE,
      strict: false,
    },
    puppeteer: getPuppeteerConfig(),
  });

  client.on('qr', (qr) => {
    qrData = qr;
    setState('QR', { last_qr_at: now(), last_error: '' });
    qrcode.generate(qr, { small: true });
    log.info('QR generated');
    writeDiagnostics('qr');
  });

  client.on('authenticated', () => {
    qrData = null;
    const at = now();
    setState('AUTHENTICATED', {
      last_authenticated_at: at,
      session_started_at: runtimeStatus.session_started_at || at,
      last_error: '',
    });
    log.info('WhatsApp authenticated');
    writeDiagnostics('authenticated');
    saveSessionMetadata();
  });

  client.on('ready', () => {
    qrData = null;
    const at = now();
    const info = client?.info || {};
    setState('READY', {
      last_ready_at: at,
      last_connected_at: at,
      session_started_at: runtimeStatus.session_started_at || runtimeStatus.last_authenticated_at || at,
      account_name: info.pushname || info.displayName || runtimeStatus.account_name || '',
      phone_number: info.me?._serialized || info.wid?._serialized || info.wid?.user || runtimeStatus.phone_number || '',
      last_error: '',
    });
    reconnectCount = 0; // reset backoff counter on successful connect
    log.info('WhatsApp client READY');
    writeDiagnostics('ready');
    saveSessionMetadata();
    sendAlert('WhatsApp bot is ONLINE').catch(() => {});
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    startHeartbeat();
  });

  client.on('auth_failure', (msg) => {
    setState('AUTH_FAILURE', { last_error: String(msg || 'auth_failure') });
    log.error('WhatsApp auth failure', { msg });
    writeDiagnostics('auth_failure', { error: String(msg || '') });
  });

  client.on('disconnected', (reason) => {
    qrData = null;
    setState('DISCONNECTED', { last_disconnected_at: now(), last_error: String(reason || '') });
    log.warn('WhatsApp disconnected', { reason });
    writeDiagnostics('disconnected', { reason: String(reason || '') });
    sendAlert(`WhatsApp disconnected: ${reason}`).catch(() => {});
    saveSessionMetadata({ last_disconnected_at: runtimeStatus.last_disconnected_at });
    if (process.env.AUTO_RECONNECT !== 'false') scheduleReconnect();
  });

  client.on('change_state', (state) => {
    log.info('WhatsApp state changed', { state });
    writeDiagnostics('change_state', { reason: String(state || '') });
  });

  client.on('loading_screen', (percent, message) => {
    log.info('WhatsApp loading screen', { percent, message });
    writeDiagnostics('loading_screen', { reason: `${percent || 0}% ${message || ''}`.trim() });
  });

  return client;
}

function nextReconnectDelay() {
  const idx = Math.min(reconnectCount, RECONNECT_DELAYS.length - 1);
  return RECONNECT_DELAYS[idx];
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  const delay = nextReconnectDelay();
  reconnectCount += 1;
  log.info(`Reconnecting in ${delay / 1000}s (attempt ${reconnectCount})...`);
  setState('INITIALIZING');
  writeDiagnostics('reconnect_scheduled', { reason: `${delay}ms`, attempt: reconnectCount });
  if (reconnectCount % MAX_RECONNECT_ALERTS === 0) {
    sendAlert(`WhatsApp reconnect attempt ${reconnectCount} (${delay / 1000}s delay) — check device`).catch(() => {});
  }
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    restart().catch(err => {
      setState('DISCONNECTED', { last_error: err.message });
      writeDiagnostics('restart_failed', { error: err.message });
    });
  }, delay);
}

function startHeartbeat() {
  stopHeartbeat();
  const HEARTBEAT_INTERVAL = parseInt(process.env.WHATSAPP_HEARTBEAT_MS || '60000', 10);
  heartbeatTimer = setInterval(async () => {
    if (!client) return;
    if (runtimeStatus.state !== 'READY') return;
    try {
      const state = await client.getState().catch(() => null);
      if (state === null || state === 'CONFLICT' || state === 'UNPAIRED') {
        writeDiagnostics('heartbeat_lost', { state });
        log.warn('Heartbeat: client lost — scheduling reconnect', { state });
        stopHeartbeat();
        setState('DISCONNECTED', { last_error: `heartbeat_lost: ${state}` });
        scheduleReconnect();
      }
    } catch (err) {
      writeDiagnostics('heartbeat_error', { error: err.message });
    }
  }, HEARTBEAT_INTERVAL);
}

function stopHeartbeat() {
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
}

async function destroyClient() {
  stopHeartbeat();
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (client) {
    try { await client.destroy(); } catch (err) { writeDiagnostics('destroy_error', { error: err.message }); }
    client = null;
  }
}

async function init() {
  if (initializing) return initializing;
  initializing = (async () => {
    await destroyClient();
    createClient();
    try {
      await client.initialize();
    } catch (err) {
      setState('DISCONNECTED', { last_error: err.message });
      log.error('WhatsApp init error', { error: err.message });
      writeDiagnostics('init_error', { error: err.message });
      scheduleReconnect();
    }
    return getStatus();
  })();
  try {
    return await initializing;
  } finally {
    initializing = null;
  }
}

async function focusBrowserPage() {
  const page = client?.pupPage;
  if (!page) return false;
  try {
    await page.bringToFront();
    return true;
  } catch (err) {
    writeDiagnostics('browser_focus_failed', { error: err.message });
    return false;
  }
}

async function connect() {
  writeDiagnostics('connect_requested', { hasStoredSession: hasStoredSession() });
  if (!client || ['DISCONNECTED', 'AUTH_FAILURE'].includes(runtimeStatus.state)) {
    await init();
  } else {
    await focusBrowserPage();
  }
  return getStatus();
}

async function restart() {
  runtimeStatus.restart_count += 1;
  writeDiagnostics('restart_requested', { restart_count: runtimeStatus.restart_count });
  return init();
}

async function reconnect() {
  runtimeStatus.restart_count += 1;
  setState('INITIALIZING');
  writeDiagnostics('reconnect_requested', { restart_count: runtimeStatus.restart_count });
  return init();
}

async function disconnect() {
  writeDiagnostics('disconnect_requested');
  await destroyClient();
  qrData = null;
  setState('DISCONNECTED', { last_disconnected_at: now(), last_error: '' });
  saveSessionMetadata();
  return getStatus();
}

function backupAndRemove(target, backupRoot) {
  if (!fs.existsSync(target)) return false;
  fs.mkdirSync(backupRoot, { recursive: true });
  const dest = path.join(backupRoot, path.basename(target));
  fs.cpSync(target, dest, { recursive: true, force: true });
  fs.rmSync(target, { recursive: true, force: true });
  return true;
}

async function resetSession() {
  runtimeStatus.restart_count += 1;
  writeDiagnostics('reset_session_requested', { restart_count: runtimeStatus.restart_count });
  await destroyClient();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupRoot = path.resolve('./data/backup', `whatsapp-session-reset-${stamp}`);
  const targets = [
    SESSION_ROOT,
    SESSION_DIR,
    CACHE_DIR,
    path.resolve('./.session'),
    path.resolve('./.auth'),
    path.resolve('./LocalAuth'),
    path.resolve('./data/session'),
  ];
  const backedUp = [];
  for (const target of targets) {
    try {
      if (backupAndRemove(target, backupRoot)) backedUp.push(target);
    } catch (err) {
      setState('AUTH_FAILURE', { last_error: `reset failed for ${target}: ${err.message}` });
      writeDiagnostics('reset_session_error', { error: runtimeStatus.last_error });
      throw err;
    }
  }
  qrData = null;
  setState('DISCONNECTED', { last_error: '' });
  writeDiagnostics('reset_session_complete', { backupRoot, backedUp });
  await init();
  return { ...getStatus(), backup_root: backupRoot, backed_up: backedUp };
}

async function clearSession() {
  return resetSession();
}

async function healthCheck() {
  return getStatus();
}

function getClient() { return client; }

class WhatsAppSessionManager {
  connect() { return connect(); }
  disconnect() { return disconnect(); }
  reconnect() { return reconnect(); }
  healthCheck() { return healthCheck(); }
  saveSession() { return saveSessionMetadata(); }
  restoreSession() { return init(); }
  clearSession() { return clearSession(); }
}

function getDetailedStatus() {
  return {
    ...getStatus(),
    heartbeat_active: !!heartbeatTimer,
    reconnect_count: reconnectCount,
    next_reconnect_delay_ms: nextReconnectDelay(),
    heartbeat_interval_ms: parseInt(process.env.WHATSAPP_HEARTBEAT_MS || '60000', 10),
    auto_reconnect: process.env.AUTO_RECONNECT !== 'false',
  };
}

module.exports = {
  CLIENT_ID,
  SESSION_ROOT,
  SESSION_DIR,
  CACHE_DIR,
  DIAGNOSTICS_LOG,
  WhatsAppSessionManager,
  connect,
  init,
  reconnect,
  restart,
  disconnect,
  resetSession,
  clearSession,
  healthCheck,
  saveSession: saveSessionMetadata,
  restoreSession: init,
  destroyClient,
  getClient,
  getStatus,
  getDetailedStatus,
};
