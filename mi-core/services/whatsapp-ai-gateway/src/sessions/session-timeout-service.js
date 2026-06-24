/**
 * Session Timeout Service
 *
 * Checks for expired agent sessions every minute.
 * On timeout: closes session, abandons active drafts, sends farewell message.
 */

const agentMgr   = require('./agent-session-manager');
const { makeLogger } = require('../logger');
const log = makeLogger('whatsapp');

let _timer      = null;
let _sendFn     = null; // injected: async (chatId, text) => void

function setSendFunction(fn) { _sendFn = fn; }

async function checkTimeouts() {
  const expired = agentMgr.getExpiredSessions();
  for (const { chatId, session } of expired) {
    log.warn('Session timeout', { chatId, sessionId: session.sessionId, owner: session.ownerName });

    const closed = await agentMgr.closeSession(chatId, agentMgr.CLOSE_REASONS.TIMEOUT, true);

    if (process.env.SESSION_END_MESSAGE_ENABLED !== 'false' && _sendFn && closed) {
      const ownerName = closed.ownerName || 'there';
      try {
        await _sendFn(chatId,
          `⏱️ Session closed due to inactivity.\nThank you, ${ownerName}.`
        );
      } catch (err) {
        log.warn('Could not send timeout message', { chatId, error: err.message });
      }
    }
  }
}

function start(sendFn = null) {
  if (sendFn) _sendFn = sendFn;
  _timer = setInterval(() => {
    checkTimeouts().catch(err => log.warn('Timeout check error', { error: err.message }));
  }, 60_000); // check every 60 seconds
  _timer.unref();
  log.info('Session timeout service started');
}

function stop() {
  if (_timer) { clearInterval(_timer); _timer = null; }
}

module.exports = { start, stop, checkTimeouts, setSendFunction };
