const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const { makeLogger } = require('../logger');
const { sendAlert } = require('../telegram/telegram-forwarder');

const log = makeLogger('connection');

const CLIENT_ID = process.env.WHATSAPP_CLIENT_ID || 'bakudan-food-safety';
const SESSION_DIR = path.resolve(process.env.SESSION_DIR || './.wwebjs_auth');
const CACHE_DIR = path.resolve(process.env.WWEBJS_CACHE_DIR || './.wwebjs_cache');
const DIAGNOSTICS_LOG = path.resolve('./logs/whatsapp-diagnostics.log');
const PUPPETEER_EXECUTABLE_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH || '';
const HEADLESS = String(process.env.WHATSAPP_HEADLESS || 'false').toLowerCase() !== 'false';

let client = null;
let qrData = null;
let reconnectTimer = null;
let initializing = null;

const runtimeStatus = {
  state: 'DISCONNECTED',
  last_error: '',
  last_qr_at: '',
  last_authenticated_at: '',
  last_ready_at: '',
  last_disconnected_at: '',
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

function getStatus() {
  return {
    status: runtimeStatus.state.toLowerCase(),
    qrData,
    readyAt: runtimeStatus.last_ready_at || null,
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
  fs.mkdirSync(SESSION_DIR, { recursive: true });
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  setState('INITIALIZING');
  writeDiagnostics('initializing', {
    clientId: CLIENT_ID,
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
    setState('AUTHENTICATED', { last_authenticated_at: now(), last_error: '' });
    log.info('WhatsApp authenticated');
    writeDiagnostics('authenticated');
  });

  client.on('ready', () => {
    qrData = null;
    setState('READY', { last_ready_at: now(), last_error: '' });
    log.info('WhatsApp client READY');
    writeDiagnostics('ready');
    sendAlert('WhatsApp bot is ONLINE').catch(() => {});
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
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

function scheduleReconnect(delay = 15_000) {
  if (reconnectTimer) return;
  log.info(`Reconnecting in ${delay / 1000}s...`);
  writeDiagnostics('reconnect_scheduled', { reason: `${delay}ms` });
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    restart().catch(err => {
      setState('DISCONNECTED', { last_error: err.message });
      writeDiagnostics('restart_failed', { error: err.message });
    });
  }, delay);
}

async function destroyClient() {
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

async function restart() {
  runtimeStatus.restart_count += 1;
  writeDiagnostics('restart_requested', { restart_count: runtimeStatus.restart_count });
  return init();
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

function getClient() { return client; }

module.exports = {
  CLIENT_ID,
  SESSION_DIR,
  CACHE_DIR,
  DIAGNOSTICS_LOG,
  init,
  restart,
  resetSession,
  destroyClient,
  getClient,
  getStatus,
};
