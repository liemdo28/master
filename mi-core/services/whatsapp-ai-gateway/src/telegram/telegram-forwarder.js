const TelegramBot = require('node-telegram-bot-api');
const { makeLogger } = require('../logger');

const log = makeLogger('whatsapp');

let bot = null;
let chatId = null;
let enabled = false;

function init() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || token === 'your_bot_token_here') {
    log.warn('Telegram not configured — forwarding disabled');
    return;
  }
  if (!chatId) {
    log.warn('TELEGRAM_CHAT_ID not set — forwarding disabled');
    return;
  }

  bot = new TelegramBot(token, { polling: false });
  enabled = true;
  log.info('Telegram forwarder ready', { chatId });
}

async function forwardMessage({ phone, name, message, intent, confidence, escalate, escalateReason }) {
  if (!enabled) return;

  const confBar = confidence != null ? ` (${confidence}%)` : '';
  const intentLine = intent ? `\n🏷️ Intent: \`${intent}\`${confBar}` : '';
  const escalateLine = escalate
    ? `\n\n⚠️ *HUMAN REQUIRED* — ${escMd(escalateReason || 'Escalated')}`
    : '';

  const text =
    `📱 *New WhatsApp Message*\n` +
    `👤 ${escMd(name || phone)}\n` +
    `📞 \`${phone}\`\n` +
    `💬 ${escMd(message)}` +
    intentLine +
    escalateLine;

  try {
    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    log.info('Forwarded to Telegram', { phone, escalate });
  } catch (err) {
    log.error('Telegram forward failed', { error: err.message });
  }
}

async function sendAlert(text) {
  if (!enabled) return;
  try {
    await bot.sendMessage(chatId, `🔔 ${text}`);
  } catch (err) {
    log.error('Telegram alert failed', { error: err.message });
  }
}

function isEnabled() { return enabled; }

function escMd(str) {
  return (str || '').replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}

module.exports = { init, forwardMessage, sendAlert, isEnabled };
