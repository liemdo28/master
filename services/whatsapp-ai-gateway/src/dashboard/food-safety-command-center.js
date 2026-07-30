const formPhotoStorage = require('../workflows/form-photo-storage');

const STORE_NAMES = ['Stone Oak', 'Rim', 'Bandera'];

async function getCommandCenterData({ date = new Date() } = {}) {
  const submissions = await formPhotoStorage.getRecentSubmissions(200);
  const todayKey = toDateKey(date);
  const today = submissions.filter(s => toDateKey(s.created_at) === todayKey || s.form_date === todayKey);
  const expectedSubmissions = STORE_NAMES.length;
  const byStore = STORE_NAMES.map(store => {
    const storeRows = today.filter(s => sameStore(s.store, store));
    return {
      store,
      expected: 1,
      received: storeRows.length,
      missing: storeRows.length > 0 ? 0 : 1,
      unsafe: storeRows.filter(s => getSafetyStatus(s) === 'UNSAFE').length,
      warnings: storeRows.filter(s => getSafetyStatus(s) === 'WARNING').length,
      managerReviews: storeRows.filter(s => s.status === 'MANAGER_REVIEW' || getSafetyStatus(s) === 'NEEDS_REVIEW').length,
      syncFailures: storeRows.filter(s => s.status === 'SYNC_FAILED' || !!s.sync_error).length,
    };
  });

  const receivedSubmissions = today.length;
  const unsafeTemperatures = today.filter(s => getSafetyStatus(s) === 'UNSAFE').length;
  const warningTemperatures = today.filter(s => getSafetyStatus(s) === 'WARNING').length;
  const managerReviews = today.filter(s => s.status === 'MANAGER_REVIEW' || getSafetyStatus(s) === 'NEEDS_REVIEW').length;
  const evidencePhotos = today.filter(s => !!s.image_path).length;
  const syncFailures = today.filter(s => s.status === 'SYNC_FAILED' || !!s.sync_error).length;
  const syncPending = today.filter(s => !s.synced_to_sheet_at && !s.sync_error).length;
  const ocrAccuracy = average(today.map(s => Number(s.ocr_confidence || 0)));
  const complianceScore = calculateComplianceScore({
    expectedSubmissions,
    receivedSubmissions,
    unsafeTemperatures,
    warningTemperatures,
    managerReviews,
    syncFailures,
  });

  return {
    date: todayKey,
    storeStatusToday: byStore,
    expectedSubmissions,
    receivedSubmissions,
    missingSubmissions: Math.max(expectedSubmissions - new Set(today.map(s => normalizeStore(s.store))).size, 0),
    unsafeTemperatures,
    warningTemperatures,
    managerReviews,
    evidencePhotos,
    ocrAccuracy,
    googleSheetSyncStatus: syncFailures > 0 ? 'FAILED' : syncPending > 0 ? 'PENDING' : receivedSubmissions > 0 ? 'SYNCED' : 'NO_DATA',
    complianceScore,
    weeklyTrend: buildWeeklyTrend(submissions, date),
    filters: ['Store', 'Date range', 'Status', 'Employee', 'Issue type', 'OCR confidence', 'Google Sheet sync status'],
    actions: ['Open submission', 'View original form', 'View parsed rows', 'Mark reviewed', 'Request retake', 'Export CSV', 'Export PDF'],
    recentSubmissions: today.slice(0, 30).map(rowToCommandCenterSubmission),
  };
}

function rowToCommandCenterSubmission(row) {
  return {
    submissionId: row.submission_id,
    store: row.store,
    employee: row.sender_name || row.sender,
    status: row.status,
    safetyStatus: getSafetyStatus(row),
    ocrConfidence: row.ocr_confidence,
    sheetSyncStatus: row.synced_to_sheet_at ? 'SYNCED' : row.sync_error ? 'FAILED' : 'PENDING',
    imagePath: row.image_path,
    createdAt: row.created_at,
  };
}

function buildWeeklyTrend(submissions, date) {
  const base = new Date(date);
  const rows = [];
  for (let offset = 6; offset >= 0; offset--) {
    const d = new Date(base);
    d.setDate(base.getDate() - offset);
    const key = toDateKey(d);
    const dayRows = submissions.filter(s => toDateKey(s.created_at) === key || s.form_date === key);
    rows.push({
      date: key,
      received: dayRows.length,
      unsafe: dayRows.filter(s => getSafetyStatus(s) === 'UNSAFE').length,
      warnings: dayRows.filter(s => getSafetyStatus(s) === 'WARNING').length,
      syncFailures: dayRows.filter(s => s.status === 'SYNC_FAILED' || !!s.sync_error).length,
    });
  }
  return rows;
}

function calculateComplianceScore({ expectedSubmissions, receivedSubmissions, unsafeTemperatures, warningTemperatures, managerReviews, syncFailures }) {
  if (!expectedSubmissions) return 0;
  let score = Math.round((receivedSubmissions / expectedSubmissions) * 100);
  score -= unsafeTemperatures * 20;
  score -= warningTemperatures * 5;
  score -= managerReviews * 5;
  score -= syncFailures * 10;
  return Math.max(0, Math.min(100, score));
}

function getSafetyStatus(row) {
  try {
    const parsed = row.parsed_json ? JSON.parse(row.parsed_json) : {};
    if (parsed.safetyStatus) return parsed.safetyStatus;
    const issues = parsed.safetyIssues || [];
    if (issues.some(i => i.severity === 'UNSAFE')) return 'UNSAFE';
    if (issues.some(i => i.severity === 'NEEDS_REVIEW')) return 'NEEDS_REVIEW';
    if (issues.some(i => i.severity === 'WARNING')) return 'WARNING';
  } catch (_) {}
  if (row.status === 'NEEDS_REVIEW' || row.status === 'MANAGER_REVIEW') return 'NEEDS_REVIEW';
  return 'SAFE';
}

function sameStore(a, b) {
  return normalizeStore(a) === normalizeStore(b);
}

function normalizeStore(store) {
  return String(store || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function average(values) {
  const valid = values.filter(v => Number.isFinite(v) && v > 0);
  if (!valid.length) return 0;
  return Number((valid.reduce((sum, v) => sum + v, 0) / valid.length).toFixed(4));
}

function toDateKey(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toISOString().slice(0, 10);
}

module.exports = {
  getCommandCenterData,
  getSafetyStatus,
  calculateComplianceScore,
};
