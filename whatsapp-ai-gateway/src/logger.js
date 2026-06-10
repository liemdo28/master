const winston = require('winston');
const path = require('path');
const fs = require('fs');

const LOG_ROOT = path.resolve(process.env.LOG_DIR || './logs');

// Create dated sub-directory: logs/YYYY-MM-DD/
function getDatedDir() {
  const today = new Date().toISOString().slice(0, 10);
  const dir = path.join(LOG_ROOT, today);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const fmt = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const extra = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${extra}`;
  })
);

// Lazy transport — resolves today's date at write time
class DatedFileTransport extends winston.transports.File {
  constructor(opts) {
    const dated = getDatedDir();
    super({ ...opts, filename: path.join(dated, opts.basename) });
    this._basename = opts.basename;
    this._lastDate = new Date().toISOString().slice(0, 10);
  }

  log(info, callback) {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== this._lastDate) {
      // Rotate to new dated directory at midnight
      this._lastDate = today;
      const dated = getDatedDir();
      this.filename = path.join(dated, this._basename);
      this._dest = null; // force stream re-open
    }
    super.log(info, callback);
  }
}

function makeLogger(name) {
  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: fmt,
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(winston.format.colorize(), fmt),
      }),
      new DatedFileTransport({ basename: `${name}.log`, maxsize: 10_000_000, maxFiles: 30 }),
      new DatedFileTransport({ basename: 'error.log', level: 'error', maxsize: 10_000_000, maxFiles: 30 }),
    ],
    exceptionHandlers: [
      new winston.transports.File({
        filename: path.join(LOG_ROOT, 'error.log'),
        maxsize: 10_000_000, maxFiles: 10,
      }),
    ],
    rejectionHandlers: [
      new winston.transports.File({
        filename: path.join(LOG_ROOT, 'error.log'),
        maxsize: 10_000_000, maxFiles: 10,
      }),
    ],
  });
}

module.exports = { makeLogger };
