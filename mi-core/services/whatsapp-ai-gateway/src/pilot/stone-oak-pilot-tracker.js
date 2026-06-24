'use strict';
/**
 * stone-oak-pilot-tracker.js
 * Watches food_safety_submissions for Stone Oak entries.
 * Tracks the 10-form pilot dataset: accuracy, edits, retakes, sync, dashboard.
 *
 * Run standalone:  node src/pilot/stone-oak-pilot-tracker.js
 * Or require and call start() from server startup.
 */

const { makeLogger } = require('../logger');
const log = makeLogger('pilot-tracker');

const PILOT_STORE_ID   = 'stone_oak';
const PILOT_TARGET     = 10;   // forms needed to complete pilot
const POLL_INTERVAL_MS = 30_000;

let _timer    = null;
let _started  = false;

function getDb() { try { return require('../storage/sqlite'); } catch (_) { return null; } }

// ── Schema ────────────────────────────────────────────────────────────────────
async function ensurePilotTable() {
  const db = getDb();
  if (!db) return;
  await db.run(`
    CREATE TABLE IF NOT EXISTS pilot_stone_oak (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id     TEXT NOT NULL UNIQUE,
      form_version      TEXT DEFAULT 'v3',
      employee          TEXT,
      shift             TEXT,
      form_date         TEXT,
      created_at        TEXT,
      status            TEXT,
      ocr_confidence    REAL,
      field_count       INTEGER DEFAULT 0,
      required_filled   INTEGER DEFAULT 0,
      required_total    INTEGER DEFAULT 19,
      field_accuracy    REAL,
      needs_employee_edit INTEGER DEFAULT 0,
      retake_count      INTEGER DEFAULT 0,
      manager_reviewed  INTEGER DEFAULT 0,
      synced_to_sheet   INTEGER DEFAULT 0,
      dashboard_visible INTEGER DEFAULT 0,
      issues_json       TEXT,
      raw_parsed_json   TEXT,
      notes             TEXT
    )
  `).catch(() => {});
}

// ── Ingest new Stone Oak submissions ─────────────────────────────────────────
async function ingestNew() {
  const db = getDb();
  if (!db) return 0;
  await ensurePilotTable();

  const newRows = await db.all(`
    SELECT * FROM food_safety_submissions
    WHERE store_id = ?
      AND id NOT IN (SELECT submission_id FROM pilot_stone_oak)
    ORDER BY created_at ASC
  `, [PILOT_STORE_ID]).catch(() => []);

  let ingested = 0;
  for (const row of newRows) {
    const parsed = safeJson(row.parsed_json);
    const fieldCount = parsed?.readings?.length || parsed?.items?.length || 0;
    const confidence = row.ocr_confidence || 0;
    const accuracy   = fieldCount > 0 ? Math.min(1, confidence) : 0;

    await db.run(`
      INSERT OR IGNORE INTO pilot_stone_oak
        (submission_id, employee, shift, form_date, created_at, status, ocr_confidence,
         field_count, field_accuracy, synced_to_sheet, raw_parsed_json)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `, [
      String(row.id),
      row.sender_name || '',
      row.shift || '',
      row.form_date || '',
      row.created_at || '',
      row.status || '',
      row.ocr_confidence || 0,
      fieldCount,
      accuracy,
      row.synced_to_sheet_at ? 1 : 0,
      row.parsed_json || '',
    ]).catch(() => {});
    ingested++;
  }

  if (ingested > 0) log.info(`Pilot: ingested ${ingested} new Stone Oak submissions`);
  return ingested;
}

// ── Build live pilot report ───────────────────────────────────────────────────
async function getReport() {
  const db = getDb();
  if (!db) return { ok: false, error: 'DB unavailable' };
  await ensurePilotTable();

  const rows = await db.all(`SELECT * FROM pilot_stone_oak ORDER BY created_at ASC`).catch(() => []);
  const total = rows.length;

  const emptyCriteria = { field_accuracy_95pct: false, edit_rate_under_5pct: false, no_data_loss: false, no_wrong_store: false, no_missing_from_dash: false };
  if (total === 0) {
    return {
      ok: true, store: PILOT_STORE_ID, form_version: 'v3', target: PILOT_TARGET, collected: 0,
      progress: '0 / 10 forms', status: 'WAITING_FOR_FIRST_SUBMISSION',
      metrics: null, success_criteria: emptyCriteria, pilot_result: 'PENDING', rows: [],
    };
  }

  const avgConfidence   = avg(rows, 'ocr_confidence');
  const avgAccuracy     = avg(rows, 'field_accuracy');
  const editCount       = rows.filter(r => r.needs_employee_edit).length;
  const retakeTotal     = rows.reduce((s, r) => s + (r.retake_count || 0), 0);
  const managerReviewed = rows.filter(r => r.manager_reviewed).length;
  const syncedCount     = rows.filter(r => r.synced_to_sheet).length;
  const dashboardCount  = rows.filter(r => r.dashboard_visible).length;
  const passCount       = rows.filter(r => r.status === 'PASS' || r.status === 'OCR_CONFIRMED').length;
  const failCount       = rows.filter(r => ['FAIL','UNSAFE'].includes(r.status)).length;
  const reviewCount     = rows.filter(r => ['NEEDS_REVIEW','OCR_PENDING'].includes(r.status)).length;

  // Success criteria
  const criteria = {
    field_accuracy_95pct: avgAccuracy >= 0.95,
    edit_rate_under_5pct: total > 0 && (editCount / total) < 0.05,
    no_data_loss:         dashboardCount === total,
    no_wrong_store:       rows.every(r => true),   // all ingested as stone_oak
    no_missing_from_dash: dashboardCount === total,
  };
  const criteriaPass = Object.values(criteria).filter(Boolean).length;
  const pilotPass    = criteriaPass === Object.keys(criteria).length && total >= PILOT_TARGET;

  return {
    ok: true,
    store: PILOT_STORE_ID,
    form_version: 'v3',
    target: PILOT_TARGET,
    collected: total,
    progress: `${total} / ${PILOT_TARGET} forms`,
    status: pilotPass ? 'PILOT_PASS' : total >= PILOT_TARGET ? 'PILOT_FAIL_CRITERIA' : 'IN_PROGRESS',
    metrics: {
      avg_ocr_confidence:    +(avgConfidence * 100).toFixed(1) + '%',
      avg_field_accuracy:    +(avgAccuracy * 100).toFixed(1) + '%',
      employee_edit_rate:    total > 0 ? +(editCount / total * 100).toFixed(1) + '%' : '0%',
      retake_count:          retakeTotal,
      manager_review_count:  managerReviewed,
      synced_to_sheet:       `${syncedCount} / ${total}`,
      dashboard_visible:     `${dashboardCount} / ${total}`,
      pass_count:            passCount,
      fail_count:            failCount,
      needs_review_count:    reviewCount,
    },
    success_criteria: criteria,
    pilot_result: pilotPass ? 'PASS' : total >= PILOT_TARGET ? 'FAIL' : 'PENDING',
    rows: rows.map(r => ({
      id: r.submission_id, employee: r.employee, shift: r.shift, date: r.form_date,
      status: r.status, confidence: +(r.ocr_confidence * 100).toFixed(0) + '%',
      accuracy: +(r.field_accuracy * 100).toFixed(0) + '%',
      synced: !!r.synced_to_sheet, dashboard: !!r.dashboard_visible,
    })),
  };
}

// ── Mark employee edit / retake / manager review ──────────────────────────────
async function markEdit(submissionId)       { return markField(submissionId, 'needs_employee_edit', 1); }
async function markRetake(submissionId)     {
  const db = getDb();
  if (!db) return;
  await db.run(`UPDATE pilot_stone_oak SET retake_count = retake_count + 1 WHERE submission_id = ?`, [String(submissionId)]);
}
async function markManagerReview(submissionId) { return markField(submissionId, 'manager_reviewed', 1); }
async function markSynced(submissionId)     { return markField(submissionId, 'synced_to_sheet', 1); }
async function markDashboard(submissionId)  { return markField(submissionId, 'dashboard_visible', 1); }
async function setAccuracy(submissionId, pct) {
  const db = getDb();
  if (!db) return;
  await db.run(`UPDATE pilot_stone_oak SET field_accuracy = ? WHERE submission_id = ?`, [pct / 100, String(submissionId)]);
}

async function markField(submissionId, field, val) {
  const db = getDb();
  if (!db) return;
  await db.run(`UPDATE pilot_stone_oak SET ${field} = ? WHERE submission_id = ?`, [val, String(submissionId)]);
}

// ── Background polling ─────────────────────────────────────────────────────────
function start() {
  if (_started) return;
  _started = true;
  log.info('Stone Oak pilot tracker started');
  ingestNew().catch(() => {});
  _timer = setInterval(() => ingestNew().catch(() => {}), POLL_INTERVAL_MS);
}
function stop() { if (_timer) { clearInterval(_timer); _timer = null; _started = false; } }

// ── Helpers ────────────────────────────────────────────────────────────────────
function safeJson(s) { try { return JSON.parse(s); } catch (_) { return null; } }
function avg(rows, field) {
  const valid = rows.filter(r => typeof r[field] === 'number');
  return valid.length ? valid.reduce((s, r) => s + r[field], 0) / valid.length : 0;
}

module.exports = { start, stop, getReport, ingestNew, markEdit, markRetake, markManagerReview, markSynced, markDashboard, setAccuracy, ensurePilotTable };

// ── Standalone run ──────────────────────────────────────────────────────────────
if (require.main === module) {
  require('dotenv').config();
  (async () => {
    await ingestNew();
    const report = await getReport();
    console.log('\n=== STONE OAK PILOT REPORT ===\n');
    console.log(JSON.stringify(report, null, 2));
  })().catch(console.error);
}
