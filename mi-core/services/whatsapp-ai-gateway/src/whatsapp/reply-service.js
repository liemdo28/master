const { makeLogger } = require('../logger');
const fs = require('fs');
const path = require('path');

const log = makeLogger('message');
const gatewaySentMessageIds = new Set();
const recentGatewaySends = [];
const BLOCKED_USER_FACING_PATTERNS = [
  /mi-core is temporarily unavailable/i,
  /temporarily unavailable\.?\s*please try again later/i,
];

function isBlockedUserFacingText(text) {
  const body = String(text || '');
  return BLOCKED_USER_FACING_PATTERNS.some(pattern => pattern.test(body));
}

// Adds a small human-like typing delay
function typingDelay(text) {
  const ms = Math.min(1500 + text.length * 20, 4000);
  return new Promise(res => setTimeout(res, ms));
}

async function send(client, to, text) {
  try {
    if (isBlockedUserFacingText(text)) {
      log.warn('Blocked banned user-facing fallback text', { to, preview: String(text || '').slice(0, 120) });
      return false;
    }
    await typingDelay(text);
    const chat = await client.getChatById(to);
    await chat.sendStateTyping();
    await new Promise(res => setTimeout(res, 800));
    rememberGatewaySend(to, text, null);
    const sentMessage = await client.sendMessage(to, text);
    rememberGatewaySend(to, text, sentMessage);
    log.info('Reply sent', { to, length: text.length });
    return true;
  } catch (err) {
    log.error('Reply failed', { to, error: err.message });
    return false;
  }
}

async function sendMediaFile(client, to, filePath, caption = '') {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      log.warn('Media file missing', { to, filePath });
      return false;
    }
    let sendPath = filePath;
    if (/\.svg$/i.test(filePath)) {
      const sharp = require('sharp');
      const cacheDir = path.join(process.cwd(), 'data', 'whatsapp-media-cache');
      fs.mkdirSync(cacheDir, { recursive: true });
      const pngPath = path.join(cacheDir, `${path.basename(filePath, path.extname(filePath))}.png`);
      const sourceStat = fs.statSync(filePath);
      const needsConvert = !fs.existsSync(pngPath) || fs.statSync(pngPath).mtimeMs < sourceStat.mtimeMs;
      if (needsConvert) {
        await sharp(filePath).png().toFile(pngPath);
      }
      sendPath = pngPath;
    }
    const { MessageMedia } = require('whatsapp-web.js');
    const media = MessageMedia.fromFilePath(sendPath);
    rememberGatewaySend(to, caption || `[media] ${sendPath}`, null);
    const sentMessage = await client.sendMessage(to, media, caption ? { caption } : {});
    rememberGatewaySend(to, caption || `[media] ${sendPath}`, sentMessage);
    log.info('Media sent', { to, filePath, sendPath });
    return true;
  } catch (err) {
    log.error('Media send failed', { to, filePath, error: err.message });
    return false;
  }
}

function rememberGatewaySend(to, text, sentMessage) {
  const id = sentMessage?.id?._serialized || '';
  if (id) gatewaySentMessageIds.add(id);
  recentGatewaySends.push({ to, text, ts: Date.now() });
  while (recentGatewaySends.length > 200) recentGatewaySends.shift();
  if (gatewaySentMessageIds.size > 1000) gatewaySentMessageIds.clear();
}

function isGatewaySentMessage(msg) {
  const id = msg?.id?._serialized || '';
  if (id && gatewaySentMessageIds.has(id)) return true;

  const chatId = msg?.from || msg?.to || '';
  const body = msg?.body || '';
  const cutoff = Date.now() - 2 * 60 * 1000;
  return recentGatewaySends.some(item =>
    item.ts >= cutoff &&
    item.to === chatId &&
    item.text === body
  );
}

module.exports = { send, sendMediaFile, isGatewaySentMessage, isBlockedUserFacingText };
