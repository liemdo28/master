/**
 * CEO Account Session Manager — Session A
 *
 * Manages a dedicated whatsapp-web.js Client for the CEO's main WhatsApp
 * account. This session is COMPLETELY ISOLATED from Session B (whatsapp-ai-gateway).
 *
 * Isolation guarantees:
 *   - Different clientId: 'mi-ceo-observer'
 *   - Different session storage: CEO_SESSION_ROOT (default ./data/ceo-session)
 *   - Different Puppeteer profile
 *   - Different Puppeteer port
 *   - No shared state with whatsapp-ai-gateway
 *
 * This session is READ-ONLY by policy. It NEVER sends messages.
 * All outbound communication goes through Session B (whatsapp-ai-gateway).
 */

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');
const { detectTaskIntents, buildWorkflowRequest } = require('./task-detector');
const { shouldObserve } = require('./whitelist');
const { forwardEvent } = require('./mi-core-client');

const CLIENT_ID = process.env.CEO_CLIENT_ID || 'mi-ceo-observer';
const SESSION_ROOT = path.resolve(process.env.CEO_SESSION_ROOT || './data/ceo-session');
const SESSION_DIR = path.join(SESSION_ROOT, 'auth');
const CACHE_DIR = path.join(SESSION_ROOT, 'cache');
const HEADLESS = String(process.env.WHATSAPP_HEADLESS || 'false').toLowerCase() !== 'false';

// Dedup: skip messages already processed
const processedIds = new Set();
const DEDUP_TTL_MS = 5 * 60 * 1000;
const dedupTimestamps = new Map();

let client = null;
let latestQrData = null; // exposed for API server /qr endpoint
let runtimeStatus = {
  state: 'DISCONNECTED',
  phone_number: '',
  account_name: '',
  messages_observed: 0,
  tasks_detected: 0,
  last_message_at: '',
  session_started_at: '',
};

function now() { return new Date().toISOString(); }

function pruneDedupCache() {
  const cutoff = Date.now() - DEDUP_TTL_MS;
  for (const [id, ts] of dedupTimestamps.entries()) {
    if (ts < cutoff) { processedIds.delete(id); dedupTimestamps.delete(id); }
  }
}

/**
 * Handle an incoming message from CEO's account.
 * Applies whitelist, task detection, and forwards actionable events to mi-core.
 */
async function handleMessage(msg) {
  try {
    const msgId = msg?.id?._serialized || msg?.id?.id || '';

    // Dedup
    pruneDedupCache();
    if (msgId && processedIds.has(msgId)) return;
    if (msgId) { processedIds.add(msgId); dedupTimestamps.set(msgId, Date.now()); }

    const chat = await msg.getChat();
    const chatId = chat?.id?._serialized || msg.from || '';
    const chatName = chat?.name || '';
    const isGroup = chatId.includes('@g.us');
    const sender = msg.author || msg.from || '';
    const senderContact = await msg.getContact().catch(() => null);
    const senderName = senderContact?.pushname || senderContact?.name || sender;

    runtimeStatus.messages_observed++;
    runtimeStatus.last_message_at = now();

    // Whitelist check
    if (!shouldObserve(chatId, chatName)) {
      logger.debug('Chat not in observe list — skipping', { chatId, chatName });
      return;
    }

    const text = msg.body || '';
    if (!text.trim()) return;

    logger.info('CEO message observed', {
      chat: chatName || chatId,
      sender: senderName,
      preview: text.slice(0, 60),
      is_group: isGroup,
    });

    // Task detection
    const detection = detectTaskIntents(text, { chatName, isGroup, sender });

    if (!detection.should_create_workflow) {
      logger.debug('No actionable intent', { summary: detection.summary });
      return;
    }

    runtimeStatus.tasks_detected++;

    const workflow_request = buildWorkflowRequest({
      text, sender_name: senderName, chat_name: chatName,
      intents: detection.intents, is_group: isGroup,
    });

    logger.info('Task detected — forwarding to mi-core', {
      intents: detection.intents,
      confidence: detection.confidence,
      chat: chatName,
    });

    await forwardEvent({
      text,
      workflow_request,
      sender,
      sender_name: senderName,
      chat_id: chatId,
      chat_name: chatName,
      is_group: isGroup,
      message_id: msgId,
      timestamp: now(),
      intents: detection.intents,
    });

  } catch (e) {
    logger.error('Error handling CEO message', { error: e.message });
  }
}

function buildClient() {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  const puppeteerArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--disable-gpu',
    `--remote-debugging-port=9223`, // different port from Session B (9222)
  ];

  const opts = {
    authStrategy: new LocalAuth({
      clientId: CLIENT_ID,
      dataPath: SESSION_DIR,
      // Note: LocalAuth manages its own userDataDir — do NOT pass userDataDir to puppeteer
    }),
    puppeteer: {
      headless: HEADLESS,
      args: puppeteerArgs,
      // No userDataDir here — conflicts with LocalAuth
      ...(process.env.PUPPETEER_EXECUTABLE_PATH
        ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH }
        : {}),
    },
    webVersionCache: {
      type: 'remote',
      remotePath: process.env.WWEBJS_REMOTE_WEB_CACHE ||
        'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/{version}.html',
    },
  };

  const c = new Client(opts);

  c.on('qr', (qr) => {
    latestQrData = qr;
    runtimeStatus.state = 'QR_PENDING';
    logger.info('=== QR READY — open http://localhost:3212/qr in browser to scan ===');
    qrcode.generate(qr, { small: true });
  });

  c.on('authenticated', () => {
    latestQrData = null; // QR no longer needed
    runtimeStatus.state = 'AUTHENTICATED';
    logger.info('CEO account authenticated');
  });

  c.on('ready', async () => {
    runtimeStatus.state = 'READY';
    runtimeStatus.session_started_at = now();
    const info = c.info;
    runtimeStatus.phone_number = info?.wid?.user || '';
    runtimeStatus.account_name = info?.pushname || '';
    logger.info('CEO observer READY', {
      phone: runtimeStatus.phone_number,
      name: runtimeStatus.account_name,
    });
  });

  c.on('message', handleMessage);

  // Also observe messages that come from CEO themselves (self-messages in chats)
  c.on('message_create', async (msg) => {
    if (!msg.fromMe) return; // skip — already handled above for incoming
    // CEO sent a message — observe it but with lower priority
    const text = msg.body || '';
    if (!text.trim()) return;
    const detection = detectTaskIntents(text);
    if (detection.should_create_workflow && detection.confidence >= 75) {
      await handleMessage(msg);
    }
  });

  c.on('disconnected', (reason) => {
    runtimeStatus.state = 'DISCONNECTED';
    logger.warn('CEO session disconnected', { reason });
    // Auto-reconnect after 15s
    setTimeout(() => {
      if (client === c) {
        logger.info('Attempting CEO session reconnect...');
        c.initialize().catch(e => logger.error('Reconnect failed', { error: e.message }));
      }
    }, 15000);
  });

  c.on('auth_failure', (msg) => {
    runtimeStatus.state = 'AUTH_FAILED';
    logger.error('CEO session auth failure', { msg });
  });

  return c;
}

async function start() {
  logger.info('Starting CEO Observer — Session A', { clientId: CLIENT_ID, sessionDir: SESSION_DIR });
  client = buildClient();
  await client.initialize();
}

function getStatus() {
  return { ...runtimeStatus, client_id: CLIENT_ID, session_dir: SESSION_DIR };
}

async function getChats() {
  if (!client || runtimeStatus.state !== 'READY') return [];
  try { return await client.getChats(); } catch { return []; }
}

function getQrData() { return latestQrData; }

module.exports = { start, getStatus, getChats, getQrData };
