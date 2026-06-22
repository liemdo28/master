const STORE_TAB_MAP = {
  rim: 'Rim',
  'the rim': 'Rim',
  stoneoak: 'Stone Oak',
  'stone oak': 'Stone Oak',
  bandera: 'Bandera',
  'bandera road': 'Bandera',
  medicalcenter: 'Medical Center',
  'medical center': 'Medical Center',
};

function normalizeStoreKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function getConfiguredStoreTabs() {
  return String(process.env.FOOD_SAFETY_STORE_TABS || 'Rim,Stone Oak,Bandera')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
}

function mapStoreName(rawStore) {
  const normalized = normalizeStoreKey(rawStore);
  const compact = normalized.replace(/\s+/g, '');
  const mapped = STORE_TAB_MAP[normalized] || STORE_TAB_MAP[compact] || null;
  if (!mapped) return { store: rawStore || 'Unknown', tab: getReviewTab(), known: false };

  const allowedTabs = getConfiguredStoreTabs();
  const tab = allowedTabs.find(t => normalizeStoreKey(t) === normalizeStoreKey(mapped)) || mapped;
  return { store: mapped, tab, known: true };
}

function getReviewTab() {
  return process.env.FOOD_SAFETY_NEEDS_REVIEW_TAB || 'Needs_Review';
}

function getTestTab() {
  return process.env.FOOD_SAFETY_TEST_TAB || 'WhatsApp_AI_Daily_Log';
}

function getWriteTab(rawStore) {
  const mode = process.env.FOOD_SAFETY_WRITE_MODE || 'test_only';
  if (mode === 'test_only') {
    return { store: mapStoreName(rawStore).store, tab: getTestTab(), known: mapStoreName(rawStore).known, testOnly: true };
  }
  return { ...mapStoreName(rawStore), testOnly: false };
}

function extractSpreadsheetId(urlOrId) {
  const value = String(urlOrId || '').trim();
  if (!value) return '';
  const match = value.match(/\/spreadsheets\/d\/([^/]+)/);
  return match ? match[1] : value;
}

module.exports = {
  getConfiguredStoreTabs,
  getReviewTab,
  getTestTab,
  getWriteTab,
  mapStoreName,
  extractSpreadsheetId,
};
