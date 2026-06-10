/**
 * Unified Measurement Records Service — Phase A (CEO Parallel Validation)
 *
 * Source-agnostic, unified table for comparing human, sensor, OCR, and
 * manager-override values side-by-side.
 *
 * Source types:
 *   HUMAN_WHATSAPP   — human-entered value (via WhatsApp)
 *   YOLINK_API       — API sensor reading (YoLink)
 *   YOLINK_MANUAL    — manually entered sensor reading from dashboard
 *   OCR_TEMPLATE     — OCR-extracted reading
 *   MANAGER_OVERRIDE — manager-chosen final value
 *
 * Status values (final value states):
 *   PENDING              — recorded, no decision yet
 *   MATCH                — within tolerance of another source
 *   MISMATCH             — outside tolerance of another source
 *   CONFIRMED_HUMAN      — human value used as final
 *   USED_SENSOR          — sensor value used as final
 *   OUT_OF_RANGE         — outside Daily_Entry_Template min/max
 *   NO_SENSOR            — human entry, no sensor mapped
 *   SENSOR_NO_READING    — sensor mapped, no reading yet
 *   SENSOR_STALE         — reading too old
 *   SENSOR_OFFLINE       — sensor reporting offline
 *   API_NOT_CONFIGURED   — YoLink not configured
 *
 * Does NOT replace sensor_readings, audit logs, or food-safety storage.
 * It is a parallel, source-agnostic table for cross-comparison.
 */

const { run, all, get } = require('../storage/sqlite');
const { makeLogger } = require('../logger');

const log = makeLogger('measurement');

const SOURCE_TYPES = ['HUMAN_WHATSAPP', 'YOLINK_API', 'YOLINK_MANUAL', 'OCR_TEMPLATE', 'MANAGER_OVERRIDE'];

let initialized = false;

async function ensureSchema() {
  if (initialized) return;
  await run(`
    CREATE TABLE IF NOT EXISTS measurement_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_id TEXT,
      store_name TEXT,
      item_name TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_ref_id TEXT,
      value REAL,
      unit TEXT,
      confidence REAL,
      status TEXT,
      raw_payload_json TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_measurement_store_item ON measurement_records(store_id, item_name, created_at)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_measurement_source ON measurement_records(source_type, created_at)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_measurement_status ON measurement_records(status, created_at)`);
  initialized = true;
}

/**
 * Record a measurement.
 * sourceRefId is the id from the originating table (sensor_readings.id,
 * audit log id, etc.). It is informational only.
 */
async function record({
  storeId = null,
  storeName = null,
  itemName,
  sourceType,
  sourceRefId = null,
  value,
  unit = 'F',
  confidence = null,
  status = 'PENDING',
  rawPayload = null,
} = {}) {
  if (!itemName) throw new Error('measurement_records.record: itemName required');
  if (!SOURCE_TYPES.includes(sourceType)) {
    throw new Error(`measurement_records.record: invalid sourceType ${sourceType}`);
  }
  await ensureSchema();
  const result = await run(
    `INSERT INTO measurement_records
     (store_id, store_name, item_name, source_type, source_ref_id, value, unit, confidence, status, raw_payload_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      storeId,
      storeName,
      itemName,
      sourceType,
      sourceRefId,
      value ?? null,
      unit,
      confidence,
      status,
      rawPayload ? JSON.stringify(rawPayload) : null,
    ]
  );
  return {
    id: result.lastID,
    storeId,
    storeName,
    itemName,
    sourceType,
    source_type: sourceType,
    value,
    unit,
    status,
  };
}

/**
 * Update status of a measurement record.
 */
async function updateStatus(id, status) {
  await ensureSchema();
  await run(`UPDATE measurement_records SET status = ? WHERE id = ?`, [status, id]);
  return { id, status };
}

/**
 * Get the latest record for a given (store, item, source).
 */
async function getLatestForSource({ storeId, itemName, sourceType }) {
  await ensureSchema();
  return get(
    `SELECT * FROM measurement_records
     WHERE store_id = ? AND item_name = ? AND source_type = ?
     ORDER BY created_at DESC LIMIT 1`,
    [storeId, itemName, sourceType]
  );
}

/**
 * Get latest two source values (human + sensor) for an item,
 * with metadata for cross-comparison. Designed for the dashboard panel.
 */
async function getLatestPair({ storeId, itemName, matchWindowMinutes = 10 } = {}) {
  await ensureSchema();
  const windowIso = new Date(Date.now() - matchWindowMinutes * 60_000).toISOString();
  const human = await get(
    `SELECT * FROM measurement_records
     WHERE item_name = ? AND source_type = 'HUMAN_WHATSAPP'
       AND (? IS NULL OR store_id = ?)
       AND created_at >= ?
     ORDER BY created_at DESC LIMIT 1`,
    [itemName, storeId || null, storeId || null, windowIso]
  );
  const sensor = await get(
    `SELECT * FROM measurement_records
     WHERE item_name = ? AND source_type IN ('YOLINK_API', 'YOLINK_MANUAL')
       AND (? IS NULL OR store_id = ?)
       AND created_at >= ?
     ORDER BY CASE WHEN source_type = 'YOLINK_API' THEN 0 ELSE 1 END, created_at DESC LIMIT 1`,
    [itemName, storeId || null, storeId || null, windowIso]
  );
  return { human, sensor };
}

/**
 * Get the most recent human entry for an item — useful when bot
 * is asking "are you sure?" and needs to display the prior human value.
 */
async function getLatestHuman({ storeId, itemName, sinceIso = null }) {
  await ensureSchema();
  const since = sinceIso || new Date(Date.now() - 60 * 60_000).toISOString();
  return get(
    `SELECT * FROM measurement_records
     WHERE item_name = ? AND source_type = 'HUMAN_WHATSAPP'
       AND (? IS NULL OR store_id = ?)
       AND created_at >= ?
     ORDER BY created_at DESC LIMIT 1`,
    [itemName, storeId || null, storeId || null, since]
  );
}

/**
 * Count records grouped by source/status (for dashboard stats).
 */
async function getStats(storeId = null) {
  await ensureSchema();
  const where = storeId ? 'WHERE store_id = ?' : '';
  const params = storeId ? [storeId] : [];
  const rows = await all(
    `SELECT source_type, status, COUNT(*) as c
     FROM measurement_records ${where}
     GROUP BY source_type, status
     ORDER BY source_type, status ASC`,
    params
  );
  const stats = { total: 0, bySource: {}, byStatus: {} };
  for (const r of rows) {
    stats.total += r.c;
    stats.bySource[r.source_type] = (stats.bySource[r.source_type] || 0) + r.c;
    stats.byStatus[r.status] = (stats.byStatus[r.status] || 0) + r.c;
  }
  return stats;
}

module.exports = {
  ensureSchema,
  record,
  updateStatus,
  getLatestForSource,
  getLatestPair,
  getLatestHuman,
  getStats,
  SOURCE_TYPES,
};
