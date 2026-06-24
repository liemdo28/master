'use strict';
/**
 * stone-oak-pilot-collector.js
 * Collects required pilot dataset artifacts for the 10-form pilot:
 *   - WhatsApp message metadata (from audit log)
 *   - OCR JSON output (from parsed_json column)
 *   - SQLite rows snapshot
 *   - Google Sheet rows (placeholder — requires sheet sync)
 *   - Pilot metrics summary
 *
 * Run: node src/pilot/stone-oak-pilot-collector.js
 * Writes output to: logs/pilot-stone-oak/
 */

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { makeLogger } = require('../logger');
const log = makeLogger('pilot-collector');

const OUT_DIR = path.join(process.cwd(), 'logs', 'pilot-stone-oak');

async function collect() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const db = (() => { try { return require('../storage/sqlite'); } catch (_) { return null; } })();
  if (!db) { console.error('DB unavailable'); process.exit(1); }

  await require('./stone-oak-pilot-tracker').ensurePilotTable();

  // 1. Raw SQLite rows — food_safety_submissions for stone_oak
  const submissions = await db.all(
    `SELECT * FROM food_safety_submissions WHERE store_id = 'stone_oak' ORDER BY created_at ASC LIMIT 50`
  ).catch(() => []);
  fs.writeFileSync(path.join(OUT_DIR, 'sqlite-rows.json'), JSON.stringify(submissions, null, 2));
  console.log(`SQLite rows: ${submissions.length} → sqlite-rows.json`);

  // 2. OCR JSON output for each submission
  const ocrDir = path.join(OUT_DIR, 'ocr-json');
  fs.mkdirSync(ocrDir, { recursive: true });
  for (const row of submissions) {
    if (row.parsed_json) {
      const fname = `ocr-${row.id}-${(row.shift||'').replace(/[^A-Za-z0-9]/g,'')}.json`;
      fs.writeFileSync(path.join(ocrDir, fname), row.parsed_json);
    }
  }
  console.log(`OCR JSONs: ${submissions.filter(r => r.parsed_json).length} files → ocr-json/`);

  // 3. Pilot tracker rows
  const pilotRows = await db.all(`SELECT * FROM pilot_stone_oak ORDER BY created_at ASC`).catch(() => []);
  fs.writeFileSync(path.join(OUT_DIR, 'pilot-tracker-rows.json'), JSON.stringify(pilotRows, null, 2));
  console.log(`Pilot tracker rows: ${pilotRows.length} → pilot-tracker-rows.json`);

  // 4. Manager alert log
  const alerts = await db.all(
    `SELECT * FROM manager_alerts WHERE store_id = 'stone_oak' ORDER BY created_at DESC LIMIT 50`
  ).catch(() => []);
  fs.writeFileSync(path.join(OUT_DIR, 'manager-alerts.json'), JSON.stringify(alerts, null, 2));
  console.log(`Manager alerts: ${alerts.length} → manager-alerts.json`);

  // 5. Pilot metrics summary
  const tracker = require('./stone-oak-pilot-tracker');
  const report  = await tracker.getReport();
  fs.writeFileSync(path.join(OUT_DIR, 'pilot-report.json'), JSON.stringify(report, null, 2));
  console.log(`Pilot report → pilot-report.json`);

  // 6. Google Sheet sync status
  const syncedRows = submissions.filter(r => r.synced_to_sheet_at);
  const sheetStatus = {
    total_submissions: submissions.length,
    synced_to_sheet:   syncedRows.length,
    pending_sync:      submissions.length - syncedRows.length,
    synced_ids:        syncedRows.map(r => r.submission_id),
    note: 'Open Google Sheet via GOOGLE_SHEETS_ID env var to verify rows manually',
  };
  fs.writeFileSync(path.join(OUT_DIR, 'sheet-sync-status.json'), JSON.stringify(sheetStatus, null, 2));
  console.log(`Sheet sync status → sheet-sync-status.json`);

  // 7. Accuracy CSV for manual review
  const csvLines = [
    'submission_id,employee,shift,date,status,ocr_confidence,field_accuracy,synced,dashboard,notes',
    ...pilotRows.map(r => [
      r.submission_id, r.employee, r.shift, r.form_date, r.status,
      +(r.ocr_confidence * 100).toFixed(1), +(r.field_accuracy * 100).toFixed(1),
      r.synced_to_sheet ? 'YES' : 'NO', r.dashboard_visible ? 'YES' : 'NO', r.notes || '',
    ].join(',')),
  ];
  fs.writeFileSync(path.join(OUT_DIR, 'pilot-accuracy.csv'), csvLines.join('\r\n'));
  console.log(`Accuracy CSV → pilot-accuracy.csv`);

  // 8. Lessons-learned template
  const lessons = {
    date: new Date().toISOString().slice(0, 10),
    store: 'stone_oak',
    pilot_result: report.pilot_result,
    metrics: report.metrics,
    lessons_learned: [
      { finding: '', severity: 'HIGH|MEDIUM|LOW', action: '' },
    ],
    what_worked: [],
    blockers: [],
    recommendation: 'PROCEED_TO_RIM | HOLD | REQUIRES_RETEST',
  };
  fs.writeFileSync(path.join(OUT_DIR, 'lessons-learned.json'), JSON.stringify(lessons, null, 2));
  console.log(`Lessons learned template → lessons-learned.json`);

  console.log(`\nAll artifacts written to: ${OUT_DIR}`);
  console.log(`\nPilot status: ${report.status}`);
  console.log(`Progress: ${report.progress}`);
  if (report.metrics) console.log(`Accuracy: ${report.metrics.avg_field_accuracy} | Edit rate: ${report.metrics.employee_edit_rate}`);
}

collect().catch(err => { console.error(err); process.exit(1); });
