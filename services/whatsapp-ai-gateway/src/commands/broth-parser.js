/**
 * Broth Parser — v2
 *
 * Parses /broth commands, count submissions (full, partial, continuation),
 * and session control messages (CONFIRM / CANCEL / STATUS / EDIT).
 *
 * Item list is passed in at call time from Daily_Entry_Template,
 * so the parser is stateless and always works with the live list.
 */

// No hardcoded operational fallback. Callers must pass the active template list.
const DEFAULT_BROTH_ITEMS = [];
const nlpResolver = require('../nlp/command-resolver');

const BROTH_ITEMS = DEFAULT_BROTH_ITEMS;

// ── /broth command detection ──────────────────────────────────────────────────
function parseBrothCommand(text) {
  const match = String(text || '').trim().match(/^\/broth(?:\s+(.+))?$/i);
  return match
    ? { isCommand: true, storeText: match[1]?.trim() || '' }
    : { isCommand: false, storeText: '' };
}

// ── Session control commands ──────────────────────────────────────────────────
/**
 * Parses CONFIRM / CANCEL / STATUS / EDIT.
 * Returns: { type: 'CONFIRM'|'CANCEL'|'STATUS'|'EDIT'|null, index?, value?, itemName? }
 * Pass itemList to enable name-based EDIT resolution.
 */
function parseControlCommand(text, itemList = DEFAULT_BROTH_ITEMS) {
  const raw = String(text || '').trim();
  const nlp = nlpResolver.resolveCommand(raw);
  if (nlp.autoHandle) {
    if (nlp.intent === 'CONFIRM') return { type: 'CONFIRM' };
    if (nlp.intent === 'CANCEL') return { type: 'CANCEL' };
    if (nlp.intent === 'STATUS') return { type: 'STATUS' };
  }
  const upper = raw.toUpperCase();

  if (upper === 'CONFIRM' || upper === 'YES' || upper === 'OK') return { type: 'CONFIRM' };
  if (upper === 'CANCEL'  || upper === 'ABORT' || upper === 'STOP') return { type: 'CANCEL' };
  if (upper === 'STATUS'  || upper === 'DRAFT') return { type: 'STATUS' };

  // EDIT <number> <value>
  const editNum = raw.match(/^edit\s+(\d{1,2})\s+(\d+(?:\.\d+)?)$/i);
  if (editNum) {
    const index = parseInt(editNum[1], 10);
    if (index >= 1 && index <= itemList.length) {
      return { type: 'EDIT', index, itemName: itemList[index - 1], value: Number(editNum[2]) };
    }
  }

  // EDIT <name> <value>
  const editName = raw.match(/^edit\s+(.+?)\s+(\d+(?:\.\d+)?)$/i);
  if (editName) {
    const itemName = resolveItemName(editName[1], itemList);
    if (itemName) {
      return { type: 'EDIT', index: itemList.indexOf(itemName) + 1, itemName, value: Number(editName[2]) };
    }
  }

  return { type: null };
}

// ── Full submission parsing ────────────────────────────────────────────────────
/**
 * Parse a full or partial count submission.
 * Returns { values: { [itemName]: string }, invalid: [...] }
 *
 * @param {string}   text
 * @param {string[]} itemList  - the active item list for this session
 */
function parseSubmission(text, itemList = DEFAULT_BROTH_ITEMS) {
  const raw = String(text || '').trim();
  if (!raw) return { values: {}, invalid: [] };

  if (looksLikeCsv(raw)) return parseCsv(raw, itemList);

  const values = {};
  const invalid = [];

  for (const line of raw.split(/\r?\n/).map(v => v.trim()).filter(Boolean)) {
    // Numbered: "6. 42"  "6: 42"  "6 = 42"  "6 42"
    const numbered = line.match(/^(\d{1,2})[\).\-\s:=]+(.+)$/);
    if (numbered) {
      const index = Number(numbered[1]);
      if (index >= 1 && index <= itemList.length) {
        assign(values, invalid, itemList[index - 1], numbered[2]);
      }
      continue;
    }

    // Named: "Shoyu = 42"  "Shoyu: 42"  "Shoyu 42"
    const named = matchNamedLine(line, itemList);
    if (named) {
      assign(values, invalid, named.item, named.value);
      continue;
    }
  }

  return { values, invalid };
}

/**
 * Parse a continuation reply that fills ONLY the missing items, in order.
 * CSV values are mapped positionally to missingItems list.
 *
 * @param {string}   text         - user's reply (e.g. "0,0,0,0,0")
 * @param {string[]} missingItems - ordered list of item names still needed
 * @param {string[]} itemList     - full item list (for named/numbered fallback)
 */
function parseContinuation(text, missingItems, itemList = DEFAULT_BROTH_ITEMS) {
  const raw = String(text || '').trim();
  if (!raw) return { values: {}, invalid: [] };

  // Pure CSV → map positionally to missingItems
  if (looksLikeCsv(raw)) {
    const values = {};
    const invalid = [];
    raw.split(',').map(v => v.trim()).forEach((val, idx) => {
      if (idx < missingItems.length) assign(values, invalid, missingItems[idx], val);
    });
    return { values, invalid };
  }

  // Single number → map to first missing item
  if (/^\d+(?:\.\d+)?$/.test(raw) && missingItems.length > 0) {
    const values = {};
    const invalid = [];
    assign(values, invalid, missingItems[0], raw);
    return { values, invalid };
  }

  // Fall back to full submission parsing (numbered/named lines still work)
  return parseSubmission(raw, itemList);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function looksLikeCsv(raw) {
  return raw.includes(',') && raw.split(',').length > 1 && !raw.includes('\n');
}

function parseCsv(raw, itemList = DEFAULT_BROTH_ITEMS) {
  const values = {};
  const invalid = [];
  raw.split(',').map(v => v.trim()).forEach((value, idx) => {
    if (idx < itemList.length) assign(values, invalid, itemList[idx], value);
  });
  return { values, invalid };
}

function matchNamedLine(line, itemList = DEFAULT_BROTH_ITEMS) {
  const normalized = normalize(line);
  const matches = itemList
    .map(item => ({ item, key: normalize(item) }))
    .filter(({ key }) =>
      normalized.startsWith(key + ' ') ||
      normalized.startsWith(key + '=') ||
      normalized.startsWith(key + ':'));
  if (!matches.length) return null;
  const match = matches.sort((a, b) => b.key.length - a.key.length)[0];
  return { item: match.item, value: line.slice(match.item.length).replace(/^[:=\s-]+/, '').trim() };
}

function assign(values, invalid, item, rawValue) {
  const cleaned = String(rawValue || '').replace(/=/g, '').trim();
  values[item] = cleaned;
  if (!isNumericString(cleaned)) invalid.push({ item, value: cleaned });
}

function resolveItemName(text, itemList = DEFAULT_BROTH_ITEMS) {
  const norm = normalize(text);
  return itemList.find(item =>
    normalize(item) === norm ||
    normalize(item).startsWith(norm) ||
    norm.startsWith(normalize(item))
  ) || null;
}

function isNumericString(value) {
  return /^-?\d+(?:\.\d+)?$/.test(String(value || '').trim());
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

module.exports = {
  BROTH_ITEMS,
  DEFAULT_BROTH_ITEMS,
  parseBrothCommand,
  parseSubmission,
  parseContinuation,
  parseControlCommand,
  resolveItemName,
};
