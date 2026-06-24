/**
 * Command Aliases (Phase 1.5)
 *
 * Maps localized command words → canonical action IDs.
 * Used by /language, /status, /help, /cancel, /confirm, etc.
 *
 * Canonical action IDs:
 *   help, status, cancel, confirm, reenter, skip, end, menu, language,
 *   ldagent, template, log, history, summary, broth, temp, yes, no
 */

const ALIASES = {
  // ── HELP ────────────────────────────────────────────────────────────────
  help: {
    en: ['help', '/help'],
    es: ['ayuda', '/ayuda'],
    vi: ['giúpđỡ', 'giupdo', 'trợ giúp', 'tro giup', '/giupdo', '/giúpđỡ'],
    fr: ['aide', '/aide'],
  },
  // ── STATUS ──────────────────────────────────────────────────────────────
  status: {
    en: ['status', '/status'],
    es: ['estado', '/estado'],
    vi: ['trạng thái', 'trang thai', 'trạngthái', 'trangthai', '/trangthai', '/trạngthái'],
    fr: ['statut', '/statut'],
  },
  // ── CANCEL ──────────────────────────────────────────────────────────────
  cancel: {
    en: ['cancel', '/cancel'],
    es: ['cancelar', '/cancelar'],
    vi: ['hủy', 'huy', '/huy', '/hủy'],
    fr: ['annuler', '/annuler'],
  },
  // ── CONFIRM ─────────────────────────────────────────────────────────────
  confirm: {
    en: ['confirm', 'yes', '1'],
    es: ['confirmar', 'si', 'sí', '1'],
    vi: ['xác nhận', 'xac nhan', 'đúng', 'dung', '1'],
    fr: ['confirmer', 'oui', '1'],
  },
  // ── RE-ENTER ────────────────────────────────────────────────────────────
  reenter: {
    en: ['2', 're-enter', 'reenter'],
    es: ['2', 'ingresar de nuevo', 'reingresar'],
    vi: ['2', 'nhập lại', 'nhap lai'],
    fr: ['2', 'ressaisir', 'entrer de nouveau'],
  },
  // ── SKIP ────────────────────────────────────────────────────────────────
  skip: {
    en: ['skip', '3'],
    es: ['omitir', 'saltar', '3'],
    vi: ['bỏ qua', 'bo qua', '3'],
    fr: ['ignorer', 'passer', '3'],
  },
  // ── END ─────────────────────────────────────────────────────────────────
  end: {
    en: ['end', 'no'],
    es: ['fin', 'terminar', 'no'],
    vi: ['kết thúc', 'ket thuc', 'không', 'khong'],
    fr: ['fin', 'terminer', 'non'],
  },
  // ── MENU ────────────────────────────────────────────────────────────────
  menu: {
    en: ['menu'],
    es: ['menu', 'menú'],
    vi: ['menu', 'danh mục', 'danh muc'],
    fr: ['menu'],
  },
  // ── LANGUAGE (alias for /language) ──────────────────────────────────────
  language: {
    en: ['language'],
    es: ['idioma', '/idioma'],
    vi: ['ngônngữ', 'ngonngu', '/ngonngu', '/ngônngữ'],
    fr: ['langue', '/langue'],
  },
  // ── LDAGENT (canonical /ldagent is already in command-router) ───────────
  ldagent: {
    en: ['/ldagent'],
    es: ['/ldagent'],
    vi: ['/ldagent'],
    fr: ['/ldagent'],
  },
  // ── TEMPLATE ────────────────────────────────────────────────────────────
  template: { en: ['/template'], es: ['/template', '/plantilla'], vi: ['/template', '/mẫu'], fr: ['/template', '/modèle'] },
  log:      { en: ['/log'], es: ['/log', '/registro'], vi: ['/log', '/nhật ký'], fr: ['/log', '/journal'] },
  broth:    { en: ['/broth'], es: ['/broth', '/caldo'], vi: ['/broth', '/nước dùng'], fr: ['/broth', '/bouillon'] },
  temp:     { en: ['/temp'], es: ['/temp', '/temperatura'], vi: ['/temp', '/nhiệt độ'], fr: ['/temp', '/température'] },
};

// Build a reverse-lookup map: lowercased word → canonical action
const _lookup = new Map();
function _buildLookup() {
  if (_lookup.size > 0) return _lookup;
  for (const [action, langMap] of Object.entries(ALIASES)) {
    for (const lang of Object.keys(langMap)) {
      for (const word of langMap[lang]) {
        _lookup.set(String(word).toLowerCase().trim(), { action, lang });
      }
    }
  }
  return _lookup;
}

/**
 * Match a user message to a canonical command action.
 * Returns { action, lang } or null.
 *
 * Examples:
 *   resolveCommand('/ayuda')     → { action: 'help', lang: 'es' }
 *   resolveCommand('hủy')        → { action: 'cancel', lang: 'vi' }
 *   resolveCommand('annuler')    → { action: 'cancel', lang: 'fr' }
 *   resolveCommand('/status')    → { action: 'status', lang: 'en' }
 */
function resolveCommand(text) {
  if (!text) return null;
  const lookup = _buildLookup();
  const normalized = String(text).toLowerCase().trim();
  return lookup.get(normalized) || null;
}

/**
 * Returns true if the user message matches a localized /help alias.
 */
function isHelpAlias(text) {
  const m = resolveCommand(text);
  return m?.action === 'help';
}

/**
 * Returns true if the user message matches a localized /status alias.
 */
function isStatusAlias(text) {
  const m = resolveCommand(text);
  return m?.action === 'status';
}

/**
 * Returns true if the user message matches a localized /language (or /idioma, /ngonngu, /langue) alias.
 * Returns the target language if found, else null.
 */
function matchLanguageCommand(text) {
  if (!text) return null;
  const trimmed = String(text).trim();
  // Direct forms first
  const m1 = /^\/(?:language|idioma|ngonngu|ngônngữ|langue)\s+([a-z]{2,5})/i.exec(trimmed);
  if (m1) return m1[1].toLowerCase().slice(0, 2);
  // Localized bare forms: "idioma es", "ngônngữ vi", "langue fr"
  const m2 = /^(?:language|idioma|ngonngu|ngônngữ|langue)\s+([a-z]{2,5})/i.exec(trimmed);
  if (m2) return m2[1].toLowerCase().slice(0, 2);
  return null;
}

module.exports = {
  ALIASES,
  resolveCommand,
  isHelpAlias,
  isStatusAlias,
  matchLanguageCommand,
};
