// AI control flags — runtime toggles without restart
// All state is in-memory + persisted to SQLite app_state table

const { getDb } = require('../storage/sqlite');
const { makeLogger } = require('../logger');
const log = makeLogger('whatsapp');

// In-memory state (fast path)
let _globalPause = false;
const _humanTakeover = new Map(); // phone → { by, at, note }
const _blocklist = new Set();

// --- Init: load from DB ---
async function init() {
  try {
    const db = getDb();

    // global pause
    db.get(`SELECT value FROM app_state WHERE key='ai_paused'`, (err, row) => {
      if (!err && row) _globalPause = row.value === 'true';
    });

    // blocklist
    db.get(`SELECT value FROM app_state WHERE key='blocklist'`, (err, row) => {
      if (!err && row) {
        try {
          JSON.parse(row.value).forEach(p => _blocklist.add(p));
        } catch (_) {}
      }
    });

    await new Promise(r => setTimeout(r, 200));
    log.info('AI control loaded', { paused: _globalPause, blocked: _blocklist.size });
  } catch (err) {
    log.warn('AI control init error (non-fatal)', { error: err.message });
  }
}

// --- Global AI pause ---
function pauseAI(note = '') {
  _globalPause = true;
  persist('ai_paused', 'true');
  log.warn('AI PAUSED', { note });
}
function resumeAI() {
  _globalPause = false;
  persist('ai_paused', 'false');
  log.info('AI RESUMED');
}
function isAIPaused() { return _globalPause; }

// --- Human takeover per conversation ---
function setHumanTakeover(phone, by = 'admin', note = '') {
  _humanTakeover.set(phone, { by, at: new Date().toISOString(), note });
  log.info('Human takeover set', { phone, by });
}
function clearHumanTakeover(phone) {
  _humanTakeover.delete(phone);
  log.info('Human takeover cleared', { phone });
}
function isHumanTakeover(phone) { return _humanTakeover.has(phone); }
function getTakeoverInfo(phone) { return _humanTakeover.get(phone) || null; }
function getAllTakeovers() { return Object.fromEntries(_humanTakeover.entries()); }

// --- Blocklist ---
function blockPhone(phone) {
  _blocklist.add(phone);
  persist('blocklist', JSON.stringify([..._blocklist]));
  log.warn('Phone blocked', { phone });
}
function unblockPhone(phone) {
  _blocklist.delete(phone);
  persist('blocklist', JSON.stringify([..._blocklist]));
  log.info('Phone unblocked', { phone });
}
function isBlocked(phone) { return _blocklist.has(phone); }
function getBlocklist() { return [..._blocklist]; }

// --- DB persist ---
function persist(key, value) {
  try {
    getDb().run(
      `INSERT INTO app_state (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`,
      [key, value],
      (err) => { if (err) log.warn('persist failed', { key, error: err.message }); }
    );
  } catch (err) {
    log.warn('persist error', { key, error: err.message });
  }
}

module.exports = {
  init,
  pauseAI, resumeAI, isAIPaused,
  setHumanTakeover, clearHumanTakeover, isHumanTakeover, getTakeoverInfo, getAllTakeovers,
  blockPhone, unblockPhone, isBlocked, getBlocklist,
};
