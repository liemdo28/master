const { normalizeText } = require('./language-aware-normalizer');
const { extractEntities } = require('./entity-extractor');

const INTENTS = [
  ['LANGUAGE_QUESTION', 0.95, [
    /biet noi tieng viet khong/, /do you speak vietnamese/, /hablas espanol/, /tu parles francais/, /parlez vous francais/,
  ]],
  ['START_AGENT', 0.9, [
    /^\/ldagent$/, /^start$/, /^bat dau$/, /hola agent/, /necesito registrar temperatura/, /je veux commencer/, /^commencer$/, /^empezar$/,
  ]],
  ['HELP', 0.9, [/^\/help$/, /^help$/, /^ayuda$/, /^tro giup$/, /^aide$/]],
  ['STATUS', 0.9, [/^\/status$/, /^status$/, /^trang thai$/, /^estado$/, /^statut$/]],
  ['CANCEL', 0.9, [/^cancel$/, /^huy$/, /^cancelar$/, /^annuler$/, /^stop$/]],
  ['CONFIRM', 0.9, [/^yes$/, /^ok$/, /^confirm$/, /^dung$/, /^confirmar$/, /^oui$/]],
  ['REENTER', 0.88, [/nhap lai/, /re-?enter/, /corregir/, /ressaisir/]],
  ['SKIP', 0.88, [/^skip$/, /bo qua/, /^omitir$/, /^ignorer$/]],
  ['DAILY_ENTRY', 0.86, [/daily log/, /line check/, /ghi log hom nay/, /kiem tra nhiet do/, /registro diario/, /controle quotidien/, /contrôle quotidien/]],
  ['BROTH_COUNT', 0.86, [/^broth$/, /soup count/, /count broth/, /dem broth/, /^caldo$/, /^bouillon$/]],
];

function detectIntent(text) {
  const normalized = normalizeText(text);
  const entities = extractEntities(text);
  if (entities.temperature !== undefined) {
    return { intent: 'TEMPERATURE_VALUE', confidence: 0.94, language: normalized.language, entities };
  }

  for (const [intent, confidence, patterns] of INTENTS) {
    if (patterns.some(pattern => pattern.test(normalized.compact) || pattern.test(normalized.lower))) {
      return { intent, confidence, language: normalized.language, entities };
    }
  }

  if (/^(chao|xin chao)$/.test(normalized.compact)) return { intent: 'GREETING', confidence: 0.92, language: 'vi', entities };
  if (/^hola$/.test(normalized.compact)) return { intent: 'GREETING', confidence: 0.92, language: 'es', entities };
  if (/^bonjour$/.test(normalized.compact)) return { intent: 'GREETING', confidence: 0.92, language: 'fr', entities };
  if (/^(hello|hi|hey)$/.test(normalized.compact)) return { intent: 'GREETING', confidence: 0.92, language: 'en', entities };

  return { intent: 'UNKNOWN', confidence: 0.2, language: normalized.language, entities };
}

module.exports = { detectIntent };
