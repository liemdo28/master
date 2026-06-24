/**
 * Shared logger - appends JSON lines to shared/logs/<agent>.log
 */
const fs = require('fs');
const path = require('path');

const LOG_DIR = __dirname;

function makeLogger(agentId) {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
  const file = path.join(LOG_DIR, `${agentId}.log`);

  function write(level, msg, meta) {
    const entry = {
      ts: new Date().toISOString(),
      agent: agentId,
      level,
      msg,
      ...(meta ? { meta } : {}),
    };
    try {
      fs.appendFileSync(file, JSON.stringify(entry) + '\n');
    } catch (_) {
      /* swallow log errors */
    }
    if (process.env.SEO_LOG_STDOUT !== '0') {
      // eslint-disable-next-line no-console
      console.log(`[${agentId}] ${level} ${msg}`);
    }
  }

  return {
    file,
    info: (m, meta) => write('info', m, meta),
    warn: (m, meta) => write('warn', m, meta),
    error: (m, meta) => write('error', m, meta),
    debug: (m, meta) => write('debug', m, meta),
  };
}

module.exports = { makeLogger, LOG_DIR };
