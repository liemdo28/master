// In-memory rate limiter — per phone number
// Window: configurable, default 5 minutes / 10 messages

const windows = new Map(); // phone → { count, resetAt }

const WINDOW_MS   = parseInt(process.env.RATE_WINDOW_MS)  || 5 * 60 * 1000; // 5 min
const MAX_MSG     = parseInt(process.env.RATE_MAX_MESSAGES) || 10;
const BLOCK_MSG   = parseInt(process.env.RATE_BLOCK_MESSAGES) || 30; // hard-block after this many

function check(phone) {
  const now = Date.now();
  let w = windows.get(phone);

  if (!w || now > w.resetAt) {
    w = { count: 0, resetAt: now + WINDOW_MS };
    windows.set(phone, w);
  }

  w.count++;

  if (w.count > BLOCK_MSG) return { allowed: false, reason: 'hard_block', count: w.count };
  if (w.count > MAX_MSG)   return { allowed: false, reason: 'rate_limited', count: w.count };
  return { allowed: true, count: w.count };
}

function reset(phone) {
  windows.delete(phone);
}

function getStats(phone) {
  return windows.get(phone) || { count: 0, resetAt: Date.now() };
}

// Clean up stale windows every 10 min
setInterval(() => {
  const now = Date.now();
  for (const [phone, w] of windows.entries()) {
    if (now > w.resetAt) windows.delete(phone);
  }
}, 10 * 60 * 1000).unref();

module.exports = { check, reset, getStats };
