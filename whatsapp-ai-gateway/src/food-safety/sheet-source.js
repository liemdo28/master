/**
 * Food Safety Sheet Source
 * Fetches temperature/check rules from Google Sheets and caches to JSON.
 *
 * Config:
 *   FOOD_SAFETY_ENABLED=true
 *   FOOD_SAFETY_SHEET_URL=...
 *   FOOD_SAFETY_TEST_MODE=true
 *   FOOD_SAFETY_ALLOWED_CHAT_IDS=...
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const https = require('https');
const { makeLogger } = require('../logger');

const log = makeLogger('food-safety');
const CACHE_FILE = path.join(__dirname, '../../data/food-safety-rules.json');
const DEFAULT_RULES_FILE = path.join(__dirname, '../../knowledge/food-safety/default-rules.json');
const MIN_RULE_COUNT = 19;
const DEFAULT_RULE_SHEET = process.env.FOOD_SAFETY_RULE_SHEET_NAME || 'Thresholds_SOP';
const VALID_OPERATORS = new Set(['<=', '>=', '<', '>', '=']);

// In-memory cache
let rules = [];
let lastSynced = null;

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Fetch Google Sheet as CSV via public URL
 * URL format: https://docs.google.com/spreadsheets/d/{ID}/export?format=csv&gid={GID}
 */
async function fetchSheet() {
  const url = process.env.FOOD_SAFETY_SHEET_URL;
  if (!url) throw new Error('FOOD_SAFETY_SHEET_URL not set');

  log.info('Fetching food safety rules from Google Sheet...', { url });

  const exportUrl = toCsvExportUrl(url);
  return fetchUrl(exportUrl);
}

function toCsvExportUrl(url) {
  const sheetId = extractSheetId(url);
  if (sheetId) {
    const gidMatch = url.match(/[?&#]gid=(\d+)/);
    if (gidMatch) {
      return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gidMatch[1]}`;
    }
    return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(DEFAULT_RULE_SHEET)}`;
  }
  return url
    .replace('/edit?gid=', '/export?format=csv&gid=')
    .replace('/edit#gid=', '/export?format=csv&gid=')
    .replace('/edit', '/export?format=csv');
}

function extractSheetId(url) {
  const match = String(url).match(/\/spreadsheets\/d\/([^/]+)/);
  return match ? match[1] : null;
}

function fetchUrl(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects < 5) {
        resolve(fetchUrl(res.headers.location, redirects + 1));
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`Sheet fetch failed: HTTP ${res.statusCode}`));
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parseCsvToRules(csv) {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  // First row is headers: Category, Item, Operator, Target, Unit, Corrective Action
  const rules = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 5) continue;
    const [category, item, operator, target, unit, ...rest] = cols;
    if (!item || !operator || !target) continue;
    const normalizedOperator = operator.trim();
    const normalizedTarget = parseFloat(target);
    if (!VALID_OPERATORS.has(normalizedOperator) || Number.isNaN(normalizedTarget)) continue;
    rules.push({
      category: category?.trim() || '',
      item: item.trim(),
      operator: normalizedOperator,
      target: normalizedTarget,
      unit: normalizeUnit(unit || 'F'),
      correctiveAction: rest.join(',').trim(),
    });
  }
  return rules;
}

function normalizeUnit(unit) {
  const normalized = String(unit || 'F').trim().replace('°', '');
  return normalized || 'F';
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

async function syncRules() {
  try {
    const csv = await fetchSheet();
    const parsed = parseCsvToRules(csv);
    if (!isValidRuleSet(parsed)) {
      throw new Error(`Sheet parsed ${parsed.length} valid rules; expected at least ${MIN_RULE_COUNT}`);
    }
    rules = parsed;
    lastSynced = new Date().toISOString();

    // Cache to disk
    writeCache(parsed, lastSynced);
    log.info('Food safety rules synced', { count: parsed.length, lastSynced });
    return parsed;
  } catch (err) {
    log.warn('Sheet sync failed, using cached rules', { error: err.message });
    return getCachedRules();
  }
}

function getCachedRules() {
  if (isValidRuleSet(rules)) return rules;
  return loadCacheFromDisk();
}

function loadCacheFromDisk() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      if (isValidRuleSet(cache.rules || [])) {
        rules = cache.rules;
        lastSynced = cache.lastSynced;
        log.info('Loaded cached food safety rules', { count: rules.length, lastSynced });
        return rules;
      }
      log.warn('Cached food safety rules invalid, using hardcoded defaults', { count: (cache.rules || []).length });
    }
  } catch (err) {
    log.warn('Failed to load cached rules', { error: err.message });
  }
  // Return hardcoded defaults if nothing available
  rules = getHardcodedRules();
  lastSynced = '2026-06-03T00:00:00.000Z (hardcoded fallback)';
  writeCache(rules, lastSynced);
  return rules;
}

function writeCache(nextRules, syncedAt) {
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ rules: nextRules, lastSynced: syncedAt }, null, 2));
  } catch (err) {
    log.warn('Failed to write food safety rules cache', { error: err.message });
  }
}

function isValidRuleSet(candidate) {
  return Array.isArray(candidate) &&
    candidate.length >= MIN_RULE_COUNT &&
    candidate.every(rule =>
      rule &&
      rule.item &&
      VALID_OPERATORS.has(rule.operator) &&
      Number.isFinite(Number(rule.target))
    );
}

function getHardcodedRules() {
  const data = JSON.parse(fs.readFileSync(DEFAULT_RULES_FILE, 'utf8'));
  return data.rules || [];
}

async function init() {
  const enabled = process.env.FOOD_SAFETY_ENABLED === 'true';
  if (!enabled) {
    log.info('Food safety module disabled');
    return;
  }
  loadCacheFromDisk();
  // Try background sync
  if (process.env.FOOD_SAFETY_SHEET_URL) {
    try {
      await syncRules();
    } catch (_) {}
  }
}

function isAllowedChat(chatId) {
  const allowed = process.env.FOOD_SAFETY_ALLOWED_CHAT_IDS || '';
  if (!allowed) return process.env.FOOD_SAFETY_TEST_MODE === 'true' ? false : true;
  return allowed.split(',').map(s => s.trim()).includes(String(chatId));
}

module.exports = {
  init,
  syncRules,
  getRules: getCachedRules,
  getLastSynced: () => lastSynced,
  isAllowedChat,
  toCsvExportUrl,
  extractSheetId,
  parseCsvToRules,
  isValidRuleSet,
  HARD_RULES: getHardcodedRules(),
};
