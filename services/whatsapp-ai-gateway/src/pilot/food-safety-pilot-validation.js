const { run, all, get } = require('../storage/sqlite');

const PILOT_STORES = ['Stone Oak', 'Rim', 'Bandera'];
const FORMS_PER_STORE_TARGET = 10;
const TOTAL_FORMS_TARGET = PILOT_STORES.length * FORMS_PER_STORE_TARGET;
const FIELD_ACCURACY_TARGET = 0.95;

let initialized = false;

async function ensureTables() {
  if (initialized) return;
  await run(`
    CREATE TABLE IF NOT EXISTS food_safety_pilot_forms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store TEXT NOT NULL,
      employee TEXT,
      form_date TEXT,
      shift TEXT,
      image_quality TEXT,
      ocr_items_json TEXT,
      ocr_temperatures_json TEXT,
      ocr_confidence REAL DEFAULT 0,
      corrected_fields INTEGER DEFAULT 0,
      retake_required INTEGER DEFAULT 0,
      manager_review_required INTEGER DEFAULT 0,
      db_save_result TEXT,
      sheet_sync_result TEXT,
      dashboard_visibility TEXT,
      expected_fields INTEGER DEFAULT 0,
      captured_fields INTEGER DEFAULT 0,
      correct_fields INTEGER DEFAULT 0,
      incorrect_fields INTEGER DEFAULT 0,
      missing_fields INTEGER DEFAULT 0,
      low_confidence_fields INTEGER DEFAULT 0,
      edited_fields INTEGER DEFAULT 0,
      status TEXT DEFAULT 'RECORDED',
      notes TEXT DEFAULT '',
      submission_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_pilot_forms_store ON food_safety_pilot_forms(store)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_pilot_forms_submission ON food_safety_pilot_forms(submission_id)`);
  initialized = true;
}

async function recordPilotForm(form) {
  await ensureTables();
  const result = await run(`
    INSERT INTO food_safety_pilot_forms
    (store, employee, form_date, shift, image_quality, ocr_items_json, ocr_temperatures_json,
     ocr_confidence, corrected_fields, retake_required, manager_review_required,
     db_save_result, sheet_sync_result, dashboard_visibility,
     expected_fields, captured_fields, correct_fields, incorrect_fields, missing_fields,
     low_confidence_fields, edited_fields, status, notes, submission_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    form.store || '',
    form.employee || '',
    form.formDate || form.form_date || '',
    form.shift || '',
    form.imageQuality || form.image_quality || '',
    JSON.stringify(form.ocrItems || form.ocr_items || []),
    JSON.stringify(form.ocrTemperatures || form.ocr_temperatures || []),
    Number(form.ocrConfidence ?? form.ocr_confidence ?? 0),
    Number(form.correctedFields ?? form.corrected_fields ?? 0),
    form.retakeRequired || form.retake_required ? 1 : 0,
    form.managerReviewRequired || form.manager_review_required ? 1 : 0,
    form.dbSaveResult || form.db_save_result || '',
    form.sheetSyncResult || form.sheet_sync_result || '',
    form.dashboardVisibility || form.dashboard_visibility || '',
    Number(form.expectedFields ?? form.expected_fields ?? 0),
    Number(form.capturedFields ?? form.captured_fields ?? 0),
    Number(form.correctFields ?? form.correct_fields ?? 0),
    Number(form.incorrectFields ?? form.incorrect_fields ?? 0),
    Number(form.missingFields ?? form.missing_fields ?? 0),
    Number(form.lowConfidenceFields ?? form.low_confidence_fields ?? 0),
    Number(form.editedFields ?? form.edited_fields ?? 0),
    form.status || 'RECORDED',
    form.notes || '',
    form.submissionId || form.submission_id || '',
  ]);
  return result.lastID;
}

async function getPilotForms(limit = 100) {
  await ensureTables();
  return all(`SELECT * FROM food_safety_pilot_forms ORDER BY created_at DESC, id DESC LIMIT ?`, [limit]);
}

async function getPilotMetrics() {
  await ensureTables();
  const totals = await get(`
    SELECT
      COUNT(*) as total_forms_tested,
      SUM(expected_fields) as total_fields_expected,
      SUM(captured_fields) as total_fields_captured,
      SUM(correct_fields) as correct_fields,
      SUM(incorrect_fields) as incorrect_fields,
      SUM(missing_fields) as missing_fields,
      SUM(low_confidence_fields) as low_confidence_fields,
      SUM(edited_fields) as edited_fields,
      SUM(retake_required) as retake_count,
      SUM(manager_review_required) as manager_review_count,
      SUM(CASE WHEN sheet_sync_result NOT IN ('PASS', 'SYNCED', 'OK') AND sheet_sync_result != '' THEN 1 ELSE 0 END) as sheet_sync_failures,
      SUM(CASE WHEN dashboard_visibility NOT IN ('PASS', 'VISIBLE', 'OK') AND dashboard_visibility != '' THEN 1 ELSE 0 END) as dashboard_display_failures,
      SUM(CASE WHEN db_save_result IN ('PASS', 'SAVED', 'OK') THEN 1 ELSE 0 END) as db_save_successes,
      SUM(CASE WHEN sheet_sync_result IN ('PASS', 'SYNCED', 'OK') THEN 1 ELSE 0 END) as sheet_sync_successes,
      SUM(CASE WHEN dashboard_visibility IN ('PASS', 'VISIBLE', 'OK') THEN 1 ELSE 0 END) as dashboard_visible_count
    FROM food_safety_pilot_forms
  `);
  const byStore = await all(`
    SELECT store, COUNT(*) as forms_tested,
      SUM(expected_fields) as expected_fields,
      SUM(correct_fields) as correct_fields
    FROM food_safety_pilot_forms
    GROUP BY store
    ORDER BY store
  `);

  const t = normalizeTotals(totals || {});
  const formSuccesses = Math.min(t.db_save_successes, t.dashboard_visible_count || t.db_save_successes);
  return {
    ...t,
    byStore,
    targets: {
      stores: PILOT_STORES,
      formsPerStore: FORMS_PER_STORE_TARGET,
      totalForms: TOTAL_FORMS_TARGET,
      fieldAccuracyRate: FIELD_ACCURACY_TARGET,
    },
    form_success_rate: rate(formSuccesses, t.total_forms_tested),
    field_capture_rate: rate(t.total_fields_captured, t.total_fields_expected),
    field_accuracy_rate: rate(t.correct_fields, t.total_fields_captured),
    edit_rate: rate(t.edited_fields, t.total_fields_expected),
    retake_rate: rate(t.retake_count, t.total_forms_tested),
    manager_review_rate: rate(t.manager_review_count, t.total_forms_tested),
    sync_success_rate: rate(t.sheet_sync_successes, t.total_forms_tested),
  };
}

async function getProductionReadiness() {
  const metrics = await getPilotMetrics();
  const storeCounts = Object.fromEntries((metrics.byStore || []).map(r => [r.store, Number(r.forms_tested || 0)]));
  const allStoresTested = PILOT_STORES.every(store => (storeCounts[store] || 0) >= FORMS_PER_STORE_TARGET);
  const gates = [
    { id: 'thirty_real_forms', label: '30 real forms tested', pass: metrics.total_forms_tested >= TOTAL_FORMS_TARGET && allStoresTested },
    { id: 'field_accuracy', label: '95%+ field accuracy achieved', pass: metrics.field_accuracy_rate >= FIELD_ACCURACY_TARGET },
    { id: 'no_data_loss', label: 'No confirmed data lost', pass: metrics.total_forms_tested > 0 && metrics.db_save_successes === metrics.total_forms_tested },
    { id: 'no_dashboard_missing', label: 'No confirmed dashboard records missing', pass: metrics.dashboard_display_failures === 0 && metrics.dashboard_visible_count === metrics.total_forms_tested },
    { id: 'sheet_non_blocking', label: 'Google Sheet failure does not block local DB save', pass: metrics.db_save_successes === metrics.total_forms_tested },
  ];
  return {
    verdict: gates.every(g => g.pass) ? 'PASS' : 'FAIL',
    gates,
    metrics,
  };
}

function normalizeTotals(row) {
  const out = {};
  for (const key of [
    'total_forms_tested', 'total_fields_expected', 'total_fields_captured', 'correct_fields',
    'incorrect_fields', 'missing_fields', 'low_confidence_fields', 'edited_fields',
    'retake_count', 'manager_review_count', 'sheet_sync_failures', 'dashboard_display_failures',
    'db_save_successes', 'sheet_sync_successes', 'dashboard_visible_count',
  ]) {
    out[key] = Number(row[key] || 0);
  }
  return out;
}

function rate(numerator, denominator) {
  const d = Number(denominator || 0);
  if (!d) return 0;
  return Number((Number(numerator || 0) / d).toFixed(4));
}

module.exports = {
  ensureTables,
  recordPilotForm,
  getPilotForms,
  getPilotMetrics,
  getProductionReadiness,
  PILOT_STORES,
  FORMS_PER_STORE_TARGET,
  TOTAL_FORMS_TARGET,
  FIELD_ACCURACY_TARGET,
};
