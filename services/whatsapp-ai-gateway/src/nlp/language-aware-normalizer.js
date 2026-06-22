const { detectWithConfidence } = require('../i18n/detector');

function stripDiacritics(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

function normalizeText(text) {
  const original = String(text || '').trim();
  const lower = original.toLowerCase();
  const ascii = stripDiacritics(lower);
  const compact = ascii.replace(/[“”"']/g, '').replace(/\s+/g, ' ').trim();
  const languageTrace = detectWithConfidence(original);
  return {
    original,
    lower,
    ascii,
    compact,
    language: languageTrace.lang,
    languageConfidence: languageTrace.confidence,
  };
}

module.exports = { normalizeText, stripDiacritics };
