const { makeLogger } = require('../logger');

const log = makeLogger('message');

// Adds a small human-like typing delay
function typingDelay(text) {
  const ms = Math.min(1500 + text.length * 20, 4000);
  return new Promise(res => setTimeout(res, ms));
}

async function send(client, to, text) {
  try {
    await typingDelay(text);
    const chat = await client.getChatById(to);
    await chat.sendStateTyping();
    await new Promise(res => setTimeout(res, 800));
    await client.sendMessage(to, text);
    log.info('Reply sent', { to, length: text.length });
    return true;
  } catch (err) {
    log.error('Reply failed', { to, error: err.message });
    return false;
  }
}

module.exports = { send };
