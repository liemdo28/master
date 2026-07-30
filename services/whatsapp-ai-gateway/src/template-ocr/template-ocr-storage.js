const { run, all, get } = require('../storage/sqlite');

let initialized = false;

async function ensureTables() {
  if (initialized) return;
  await run(`
    CREATE TABLE IF NOT EXISTS template_ocr_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ocr_id TEXT NOT NULL UNIQUE,
      chat_id TEXT,
      sender TEXT,
      sender_name TEXT,
      store TEXT,
      template_id TEXT,
      template_version TEXT,
      image_path TEXT,
      aligned_image_path TEXT,
      payload_json TEXT,
      status TEXT,
      sheet_write_status TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      confirmed_at TEXT,
      reviewed_at TEXT
    )
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_template_ocr_runs_created ON template_ocr_runs(created_at)`);
  initialized = true;
}

function makeOcrId(chatId, messageId) {
  const raw = `${chatId || ''}:${messageId || Date.now()}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) hash = ((hash << 5) - hash) + raw.charCodeAt(i) | 0;
  return `TOCR${Math.abs(hash).toString(36).toUpperCase().padStart(8, '0')}`;
}

async function saveRun(runData) {
  await ensureTables();
  const ocrId = runData.ocrId || makeOcrId(runData.chatId, runData.messageId);
  await run(
    `INSERT OR REPLACE INTO template_ocr_runs
     (ocr_id, chat_id, sender, sender_name, store, template_id, template_version, image_path, aligned_image_path, payload_json, status, sheet_write_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      ocrId,
      runData.chatId || '',
      runData.sender || '',
      runData.senderName || '',
      runData.store || 'Unknown',
      runData.templateId || '',
      runData.templateVersion || '',
      runData.imagePath || '',
      runData.alignedImagePath || '',
      JSON.stringify(runData.payload || {}),
      runData.status || 'NEEDS_REVIEW',
      runData.sheetWriteStatus || 'NOT_WRITTEN',
    ]
  );
  return ocrId;
}

async function updateRunStatus(ocrId, { status, sheetWriteStatus, payload, confirmed = false, reviewed = false }) {
  await ensureTables();
  const sets = [];
  const params = [];
  if (status) { sets.push('status = ?'); params.push(status); }
  if (sheetWriteStatus) { sets.push('sheet_write_status = ?'); params.push(sheetWriteStatus); }
  if (payload) { sets.push('payload_json = ?'); params.push(JSON.stringify(payload)); }
  if (confirmed) sets.push('confirmed_at = datetime(\'now\')');
  if (reviewed) sets.push('reviewed_at = datetime(\'now\')');
  if (!sets.length) return;
  params.push(ocrId);
  await run(`UPDATE template_ocr_runs SET ${sets.join(', ')} WHERE ocr_id = ?`, params);
}

async function getRun(ocrId) {
  await ensureTables();
  const row = await get(`SELECT * FROM template_ocr_runs WHERE ocr_id = ?`, [ocrId]);
  return inflate(row);
}

async function getRecentRuns(limit = 10) {
  await ensureTables();
  const rows = await all(`SELECT * FROM template_ocr_runs ORDER BY created_at DESC LIMIT ?`, [limit]);
  return rows.map(inflate);
}

async function getLastRun() {
  const rows = await getRecentRuns(1);
  return rows[0] || null;
}

async function getStats() {
  await ensureTables();
  return get(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'PASS' THEN 1 ELSE 0 END) as pass_count,
      SUM(CASE WHEN status = 'FAIL' THEN 1 ELSE 0 END) as fail_count,
      SUM(CASE WHEN status = 'NEEDS_REVIEW' THEN 1 ELSE 0 END) as needs_review_count,
      MAX(created_at) as last_run_at
    FROM template_ocr_runs
  `);
}

function inflate(row) {
  if (!row) return null;
  try { row.payload = JSON.parse(row.payload_json || '{}'); } catch (_) { row.payload = {}; }
  return row;
}

module.exports = {
  ensureTables,
  makeOcrId,
  saveRun,
  updateRunStatus,
  getRun,
  getRecentRuns,
  getLastRun,
  getStats,
};
