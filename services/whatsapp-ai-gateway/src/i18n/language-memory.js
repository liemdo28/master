/**
 * Language Memory + Store Language Preferences (Phase 1.5)
 *
 * Per-user language preference persistence.
 * Stores:
 *   user_language_preferences
 *   store_language_preferences
 *
 * Tables created lazily by ensureSchema() — safe to call multiple times.
 */

const sqlite = require('../storage/sqlite');
const { detectWithConfidence } = require('./detector');
const { makeLogger } = require('../logger');
const log = makeLogger('i18n');

const SUPPORTED = ['en', 'es', 'vi', 'fr'];

// ── Schema bootstrap ─────────────────────────────────────────────────────────
let schemaReady = false;
let schemaPromise = null;
function ensureSchema() {
  if (schemaReady) return Promise.resolve();
  if (schemaPromise) return schemaPromise;
  schemaPromise = (async () => {
    await sqlite.run(`
      CREATE TABLE IF NOT EXISTS user_language_preferences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wa_id TEXT NOT NULL,
        phone TEXT,
        display_name TEXT,
        language TEXT NOT NULL,
        confidence REAL DEFAULT 0.5,
        source TEXT DEFAULT 'detected',
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
    await sqlite.run(`CREATE INDEX IF NOT EXISTS idx_user_lang_pref_wa ON user_language_preferences(wa_id)`);
    await sqlite.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_user_lang_pref_wa_uniq ON user_language_preferences(wa_id)`);

    await sqlite.run(`
      CREATE TABLE IF NOT EXISTS store_language_preferences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id TEXT NOT NULL,
        default_language TEXT NOT NULL DEFAULT 'en',
        secondary_languages_json TEXT,
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
    await sqlite.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_store_lang_pref_uniq ON store_language_preferences(store_id)`);
    schemaReady = true;
  })();
  return schemaPromise;
}

// ── Per-user language memory ─────────────────────────────────────────────────
function normalizeWaId(phone) {
  return String(phone || '').replace(/@c\.us$/, '').replace(/@g\.us$/, '').replace(/[^\d]/g, '');
}

async function getUserLanguage(phone) {
  if (!phone) return null;
  await ensureSchema();
  try {
    return await sqlite.get(
      `SELECT language, confidence, source, updated_at FROM user_language_preferences WHERE wa_id = ?`,
      [normalizeWaId(phone)]
    );
  } catch (err) {
    log.warn('getUserLanguage err', { error: err.message });
    return null;
  }
}

async function setUserLanguage(phone, language, { displayName, confidence, source } = {}) {
  if (!phone) return false;
  if (!SUPPORTED.includes(language)) return false;
  await ensureSchema();
  try {
    await sqlite.run(
      `INSERT INTO user_language_preferences (wa_id, phone, display_name, language, confidence, source, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(wa_id) DO UPDATE SET
         language = excluded.language,
         confidence = excluded.confidence,
         source = excluded.source,
         display_name = COALESCE(excluded.display_name, display_name),
         updated_at = datetime('now')`,
      [normalizeWaId(phone), String(phone), displayName || null, language, confidence ?? 0.5, source || 'user']
    );
    return true;
  } catch (err) {
    log.warn('setUserLanguage err', { error: err.message });
    return false;
  }
}

async function clearUserLanguage(phone) {
  if (!phone) return false;
  await ensureSchema();
  try {
    const stmt = await sqlite.run(`DELETE FROM user_language_preferences WHERE wa_id = ?`, [normalizeWaId(phone)]);
    return (stmt && stmt.changes > 0) || false;
  } catch (_) {
    return false;
  }
}

async function listUserLanguages({ limit = 50 } = {}) {
  await ensureSchema();
  try {
    return await sqlite.all(
      `SELECT wa_id, phone, display_name, language, confidence, source, updated_at
       FROM user_language_preferences ORDER BY updated_at DESC LIMIT ?`,
      [limit]
    );
  } catch (_) {
    return [];
  }
}

async function countUserLanguages() {
  await ensureSchema();
  try {
    const row = await sqlite.get(`SELECT COUNT(*) as n FROM user_language_preferences`, []);
    return row?.n || 0;
  } catch (_) {
    return 0;
  }
}

// ── Per-store language preferences ───────────────────────────────────────────
async function getStoreLanguage(storeId) {
  if (!storeId) return null;
  await ensureSchema();
  try {
    const row = await sqlite.get(
      `SELECT store_id, default_language, secondary_languages_json, updated_at
       FROM store_language_preferences WHERE store_id = ?`,
      [storeId]
    );
    if (!row) return null;
    let secondary = [];
    try { secondary = JSON.parse(row.secondary_languages_json || '[]'); } catch (_) { secondary = []; }
    return {
      store_id: row.store_id,
      default_language: row.default_language,
      secondary_languages: secondary,
      updated_at: row.updated_at,
    };
  } catch (_) {
    return null;
  }
}

async function setStoreLanguage(storeId, defaultLanguage, secondaryLanguages = []) {
  if (!storeId) return false;
  if (!SUPPORTED.includes(defaultLanguage)) return false;
  const cleanSecondary = (Array.isArray(secondaryLanguages) ? secondaryLanguages : []).filter(l => SUPPORTED.includes(l));
  await ensureSchema();
  try {
    await sqlite.run(
      `INSERT INTO store_language_preferences (store_id, default_language, secondary_languages_json, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(store_id) DO UPDATE SET
         default_language = excluded.default_language,
         secondary_languages_json = excluded.secondary_languages_json,
         updated_at = datetime('now')`,
      [storeId, defaultLanguage, JSON.stringify(cleanSecondary)]
    );
    return true;
  } catch (err) {
    log.warn('setStoreLanguage err', { error: err.message });
    return false;
  }
}

async function listStoreLanguages() {
  await ensureSchema();
  try {
    const rows = await sqlite.all(
      `SELECT store_id, default_language, secondary_languages_json, updated_at FROM store_language_preferences`,
      []
    );
    return (rows || []).map(r => {
      let secondary = [];
      try { secondary = JSON.parse(r.secondary_languages_json || '[]'); } catch (_) { secondary = []; }
      return { store_id: r.store_id, default_language: r.default_language, secondary_languages: secondary, updated_at: r.updated_at };
    });
  } catch (_) {
    return [];
  }
}

// ── Language detection for "do you speak X?" question ───────────────────────
function detectLanguageQuestion(text) {
  if (!text) return null;
  const normalized = String(text).toLowerCase().trim();

  if (/bi[ếệ]t\s+n[óo]i\s+ti[ếệ]ng\s+vi[ệe]t|n[óo]i\s+ti[ếệ]ng\s+vi[ệe]t|ti[ếệ]ng\s+vi[ệe]t/i.test(normalized)) return 'vi';
  if (/ti[ếệ]ng\s+[\p{L}\s]+/iu.test(normalized) && /kh[ôo]ng|c[óo]\s+th[ể]|n[óo]i/i.test(normalized)) return 'unsupported';
  if (/[ăằắẳẵặâầấẩẫậêềếểễệôồốổỗộơờớởỡợưừứửữựđ]/.test(normalized) && /kh[ôo]ng|c[óo]\s+th[ể]|n[óo]i/i.test(normalized)) return 'vi';

  if (/tu\s+parles\s+fran[çc]ais|parles?\s+fran[çc]ais|fran[çc]ais\s*\?|vous\s+parlez\s+fran[çc]ais/i.test(normalized)) return 'fr';
  if (/fran[çc]ais/i.test(normalized) && /parl|tu|vous/i.test(normalized)) return 'fr';

  if (/hablas?\s+espa[ñn]ol|espa[ñn]ol\s*\?|hablas\s+castellano|castellano\s*\?/i.test(normalized)) return 'es';
  if (/espa[ñn]ol/i.test(normalized) && /habl|t[uú]/i.test(normalized)) return 'es';

  if (/(language|langue|idioma)/i.test(normalized) && /\?|speak|parl|habl|support|h[ỗo]\s+tr[ợo]/i.test(normalized)) return 'unsupported';

  return null;
}

const QUESTION_REPLIES = {
  vi: (name) => `Được. Tôi có thể hỗ trợ bằng tiếng Việt. Gõ /ldagent để bắt đầu.${name ? `\n\nXin chào ${name}!` : ''}`,
  fr: (name) => `Oui. Je peux vous aider en français. Tapez /ldagent pour commencer.${name ? `\n\nBonjour ${name} !` : ''}`,
  es: (name) => `Sí. Puedo ayudar en español. Escribe /ldagent para empezar.${name ? `\n\n¡Hola ${name}!` : ''}`,
  unsupported: () => 'Hiện tôi hỗ trợ English, Español, Tiếng Việt và Français. Gõ /language vi, /language es, hoặc /language fr để đổi ngôn ngữ.',
};

function buildLanguageQuestionReply(lang, name) {
  const fn = QUESTION_REPLIES[lang];
  return fn ? fn(name || '') : null;
}

// ── Combined language resolution (priority order) ───────────────────────────
async function resolveLanguage({ phone, storeId, text, chatId } = {}) {
  const mem = phone ? await getUserLanguage(phone) : null;
  if (mem && SUPPORTED.includes(mem.language)) {
    return { lang: mem.language, source: 'user_memory', confidence: mem.confidence || 0.9 };
  }

  if (chatId) {
    const groupLang = require('./detector').getGroupLanguage(chatId);
    if (groupLang && SUPPORTED.includes(groupLang)) {
      return { lang: groupLang, source: 'group_seed', confidence: 0.7 };
    }
  }

  if (storeId) {
    const sl = await getStoreLanguage(storeId);
    if (sl && SUPPORTED.includes(sl.default_language)) {
      return { lang: sl.default_language, source: 'store_default', confidence: 0.6 };
    }
  }

  if (text) {
    const { lang, confidence } = detectWithConfidence(text);
    if (lang && SUPPORTED.includes(lang)) {
      return { lang, source: 'detected', confidence };
    }
  }

  return { lang: 'en', source: 'fallback', confidence: 0 };
}

// ── Remember from a message (auto-persist on language question) ──────────────
async function rememberFromMessage(phone, displayName, text) {
  if (!phone) return false;
  const { lang, confidence } = detectWithConfidence(text || '');
  if (!SUPPORTED.includes(lang)) return false;
  if (lang === 'en' && confidence < 0.6) return false;
  return setUserLanguage(phone, lang, { displayName, confidence, source: 'auto_detected' });
}

module.exports = {
  SUPPORTED,
  ensureSchema,
  getUserLanguage,
  setUserLanguage,
  clearUserLanguage,
  listUserLanguages,
  countUserLanguages,
  getStoreLanguage,
  setStoreLanguage,
  listStoreLanguages,
  detectLanguageQuestion,
  buildLanguageQuestionReply,
  resolveLanguage,
  rememberFromMessage,
  normalizeWaId,
};
