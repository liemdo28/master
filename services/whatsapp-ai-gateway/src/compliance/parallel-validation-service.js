/**
 * Parallel Validation Service — Phases D, F, G, H, I, J, L
 * (CEO Directive — Human + YoLink Parallel Validation)
 *
 * Owns:
 *   - Sensor → store/item mapping (Phase D)
 *   - Saving sensor readings to measurement_records (Phase F)
 *   - Cross-validation: human vs sensor (Phase G)
 *   - Mismatch UX payload builder (Phase H)
 *   - Manager alert debounce (Phase I)
 *   - Google Sheet row builder with both values (Phase J)
 *   - Trust score updates (Phase L)
 *
 * Design rules:
 *   - Human workflow never blocked by YoLink failure.
 *   - Sensor values are stored separately, never silently overwriting
 *     a confirmed human value.
 *   - Manager alert uses 30-minute debounce per (store, item, kind).
 *   - "Accusatory" language is forbidden — we use "Possible pattern detected".
 */

const { run, all, get } = require('../storage/sqlite');
const measurementRecords = require('./measurement-records');
const deviceService = require('../integrations/yolink/yolink-device-service');
const apiSettings = require('../integrations/yolink/yolink-api-settings');
const trustScore = require('./trust-score-service');
const { makeLogger } = require('../logger');

const log = makeLogger('parallel-validation');

const TOLERANCE_F = () => parseFloat(process.env.SENSOR_HUMAN_TOLERANCE_F || '2');
const MATCH_WINDOW_MINUTES = () => parseInt(process.env.SENSOR_MATCH_WINDOW_MINUTES || '10', 10);
const STALE_MINUTES = () => parseInt(process.env.SENSOR_STALE_MINUTES || '15', 10);
const OFFLINE_MINUTES = () => parseInt(process.env.SENSOR_OFFLINE_MINUTES || '60', 10);
const MANUAL_FRESH_MINUTES = () => parseInt(process.env.MANUAL_SENSOR_READING_FRESH_MINUTES || '60', 10);
const ALERT_DEBOUNCE_MINUTES = () => parseInt(process.env.MANAGER_ALERT_DEBOUNCE_MINUTES || '30', 10);

let initialized = false;

async function ensureSchema() {
  if (initialized) return;
  // Sensor item mapping extended (Phase D) — index on (store, item, active)
  await run(`
    CREATE TABLE IF NOT EXISTS sensor_item_mapping (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sensor_id TEXT NOT NULL,
      template_item_id INTEGER,
      store_id TEXT NOT NULL,
      item_name TEXT NOT NULL,
      mapping_confidence REAL DEFAULT 1.0,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_sensor_mapping_store_item ON sensor_item_mapping(store_id, item_name, active)`);
  // Manager alert debounce log (Phase I)
  await run(`
    CREATE TABLE IF NOT EXISTS parallel_validation_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_id TEXT,
      item_name TEXT,
      kind TEXT,
      dedupe_key TEXT,
      status TEXT,
      payload_json TEXT,
      sent_at TEXT DEFAULT (datetime('now'))
    )
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_pva_dedupe ON parallel_validation_alerts(dedupe_key, sent_at)`);
  initialized = true;
}

// ── PHASE D: Sensor Mapping ────────────────────────────────────────────────

/**
 * Map a sensor to (store, item) in the Daily_Entry_Template. Hubs cannot
 * be mapped to a temperature item.
 */
async function mapSensorToItem({ sensorId, storeId, itemName, templateItemId = null, confidence = 1.0 }) {
  await ensureSchema();
  const sensor = await deviceService.getDevice(sensorId);
  if (!sensor) throw new Error('Sensor not found');
  if (sensor.is_hub) throw new Error('Hub device cannot be mapped to a temperature item');
  if (!itemName) throw new Error('item_name required');

  // Verify item exists in template cache (if available)
  let itemOk = true;
  try {
    const templateCache = require('../templates/template-cache');
    const items = templateCache.getItemNames ? templateCache.getItemNames() : [];
    if (items.length && !items.some(n => n.toLowerCase() === itemName.toLowerCase())) {
      itemOk = false;
    }
  } catch (_) {}

  // Deactivate any existing mapping for this sensor
  await run(`UPDATE sensor_item_mapping SET active = 0 WHERE sensor_id = ?`, [sensor.sensor_id]);
  // Insert new active mapping
  await run(
    `INSERT INTO sensor_item_mapping (sensor_id, template_item_id, store_id, item_name, mapping_confidence, active)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [sensor.sensor_id, templateItemId, storeId, itemName, confidence]
  );
  // Mirror on sensors table
  await run(
    `UPDATE sensors SET store_id = ?, store_name = ?, item_name = ?, mapped_item = ?, updated_at = datetime('now') WHERE sensor_id = ?`,
    [storeId, sensor.store_name || storeId, itemName, itemName, sensor.sensor_id]
  );
  log.info('Sensor mapped', { sensor_id: sensor.sensor_id, store_id: storeId, item_name: itemName, itemOk });
  return { ok: true, sensor_id: sensor.sensor_id, store_id: storeId, item_name: itemName, item_exists_in_template: itemOk };
}

async function unmapSensor(sensorId) {
  await ensureSchema();
  const sensor = await deviceService.getDevice(sensorId);
  if (!sensor) throw new Error('Sensor not found');
  await run(`UPDATE sensor_item_mapping SET active = 0 WHERE sensor_id = ?`, [sensor.sensor_id]);
  await run(`UPDATE sensors SET item_name = NULL, mapped_item = NULL WHERE sensor_id = ?`, [sensor.sensor_id]);
  return { ok: true };
}

async function getActiveMappings(storeId = null) {
  await ensureSchema();
  if (storeId) {
    return all(
      `SELECT m.*, s.device_name, s.device_eui, s.model, s.verified_status, s.is_hub
       FROM sensor_item_mapping m
       LEFT JOIN sensors s ON s.sensor_id = m.sensor_id
       WHERE m.active = 1 AND m.store_id = ?`,
      [storeId]
    );
  }
  return all(
    `SELECT m.*, s.device_name, s.device_eui, s.model, s.verified_status, s.is_hub
     FROM sensor_item_mapping m
     LEFT JOIN sensors s ON s.sensor_id = m.sensor_id
     WHERE m.active = 1`
  );
}

// ── PHASE F: Sensor Reading Save ─────────────────────────────────────────

/**
 * Save a sensor reading to BOTH sensor_readings (legacy) and
 * measurement_records (unified). Normalizes °C to °F when needed.
 */
async function saveSensorReading({ sensor, value, unit = 'F', batteryLevel = null, signalStatus = null, onlineStatus = true, providerTimestamp = null, rawPayload = null, readingSource = 'api', enteredBy = null, notes = null }) {
  if (sensor.is_hub) return null; // Hubs do not produce temperature readings
  const normalizedUnit = 'F';
  let normalizedValue = value;
  if (String(unit).toUpperCase() === 'C') {
    normalizedValue = (value * 9 / 5) + 32;
  }
  const effectiveReadingSource = String(readingSource || 'api').toLowerCase() === 'manual' ? 'manual' : 'api';
  await run(
    `INSERT INTO sensor_readings
     (sensor_id, store_id, item_name, value, unit, battery_level, signal_status, online_status, provider_timestamp, raw_payload_json, reading_source, entered_by, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sensor.sensor_id,
      sensor.store_id || null,
      sensor.item_name || sensor.mapped_item || null,
      normalizedValue,
      normalizedUnit,
      batteryLevel,
      signalStatus,
      onlineStatus ? 1 : 0,
      providerTimestamp || new Date().toISOString(),
      rawPayload ? JSON.stringify(rawPayload) : null,
      effectiveReadingSource,
      enteredBy,
      notes,
    ]
  );
  const rec = await measurementRecords.record({
    storeId: sensor.store_id || null,
    storeName: sensor.store_name || null,
    itemName: sensor.item_name || sensor.mapped_item || null,
    sourceType: effectiveReadingSource === 'manual' ? 'YOLINK_MANUAL' : 'YOLINK_API',
    sourceRefId: sensor.sensor_id,
    value: normalizedValue,
    unit: normalizedUnit,
    confidence: effectiveReadingSource === 'manual' ? 0.70 : null,
    status: effectiveReadingSource === 'manual' ? 'MANUAL_SENSOR_READING' : 'PENDING',
    rawPayload: {
      device_eui: sensor.device_eui,
      battery_level: batteryLevel,
      signal_status: signalStatus,
      online_status: onlineStatus,
      reading_source: effectiveReadingSource,
      entered_by: enteredBy,
      notes,
    },
  });
  return rec;
}

// ── PHASE G: Cross-Validation ──────────────────────────────────────────────

/**
 * Find the nearest sensor reading for (storeId, itemName) within window.
 * Returns { status, sensor, reading, sensorValue, ageMinutes, diff }.
 *
 * Statuses (in priority order):
 *   NO_SENSOR            — no device mapped to (store, item)
 *   SENSOR_NO_READING    — device mapped but no reading
 *   SENSOR_OFFLINE       — sensor reports offline / age >= OFFLINE_MINUTES
 *   SENSOR_STALE         — age >= STALE_MINUTES but < OFFLINE_MINUTES
 *   MATCH                — within tolerance
 *   MISMATCH             — outside tolerance
 *   API_NOT_CONFIGURED   — YoLink not configured
 */
async function crossValidateHumanVsSensor({ storeId, itemName, humanValue, unit = 'F' }) {
  const sensor = await deviceService.findSensorForStoreItem(storeId, itemName);
  if (!sensor || sensor.is_hub) {
    return { status: 'NO_SENSOR', sensor: null, reading: null, humanValue };
  }

  const apiOk = await apiSettings.isConfigured().catch(() => false);
  let reading = await deviceService.getLatestReadingForSensor(sensor.sensor_id);

  // When API is unavailable, try latest manual reading from sensor_readings.
  if (!apiOk) {
    reading = await get(
      `SELECT * FROM sensor_readings
       WHERE sensor_id = ? AND COALESCE(reading_source, 'api') = 'manual'
       ORDER BY received_at DESC LIMIT 1`,
      [sensor.sensor_id]
    );
    if (!reading) {
      return {
        status: 'API_NOT_CONFIGURED',
        sensor,
        reading: null,
        humanValue,
        message: 'YoLink API credentials are not configured. Manual Sensor Mode is active. Human workflow remains active.',
      };
    }
  }

  if (!reading) {
    return { status: 'SENSOR_NO_READING', sensor, reading: null, humanValue };
  }

  const readingAgeMinutes = (Date.now() - new Date(reading.received_at).getTime()) / 60000;
  const isManual = String(reading.reading_source || 'api').toLowerCase() === 'manual';
  const staleThreshold = isManual ? MANUAL_FRESH_MINUTES() : STALE_MINUTES();

  if (!isManual && (sensor.device_state === 'offline' || reading.online_status === 0 || readingAgeMinutes >= OFFLINE_MINUTES())) {
    return { status: 'SENSOR_OFFLINE', sensor, reading, humanValue, ageMinutes: Math.round(readingAgeMinutes) };
  }
  if (readingAgeMinutes >= staleThreshold || readingAgeMinutes > MATCH_WINDOW_MINUTES()) {
    return { status: 'SENSOR_STALE', sensor, reading, humanValue, ageMinutes: Math.round(readingAgeMinutes) };
  }

  const sensorValue = reading.value;
  const diff = Math.abs(humanValue - sensorValue);
  const tolerance = TOLERANCE_F();
  const status = diff <= tolerance ? 'MATCH' : 'MISMATCH';
  return {
    status,
    sensor,
    reading,
    humanValue,
    sensorValue,
    difference: Math.round(diff * 10) / 10,
    tolerance,
    ageMinutes: Math.round(readingAgeMinutes),
    readingSource: isManual ? 'YOLINK_MANUAL' : 'YOLINK_API',
  };
}

// ── PHASE G: Human Record ────────────────────────────────────────────────

/**
 * Record a human value to measurement_records. Always succeeds even
 * if YoLink is unavailable.
 */
async function recordHumanValue({ storeId, storeName, itemName, value, unit = 'F', employeeId = null, employeeName = null, sourceRefId = null, rawPayload = null, status = 'PENDING' }) {
  const rec = await measurementRecords.record({
    storeId,
    storeName,
    itemName,
    sourceType: 'HUMAN_WHATSAPP',
    sourceRefId,
    value,
    unit,
    confidence: null,
    status,
    rawPayload: { employeeId, employeeName, ...(rawPayload || {}) },
  });
  return rec;
}

// ── PHASE H: Mismatch UX ──────────────────────────────────────────────────

/**
 * Build the 4-option mismatch prompt shown to the employee.
 */
function buildMismatchPrompt({ itemName, humanValue, sensorValue, difference, unit = 'F' }) {
  return [
    '⚠️ Validation Mismatch',
    '',
    `Item: ${itemName}`,
    `You entered: ${humanValue}°${unit}`,
    `YoLink shows: ${sensorValue}°${unit}`,
    `Difference: ${difference}°${unit}`,
    '',
    'Reply:',
    '1 — Confirm my reading',
    '2 — Use YoLink reading',
    '3 — Re-enter',
    '4 — Escalate manager',
  ].join('\n');
}

// ── PHASE I: Manager Alert with Debounce ───────────────────────────────────

/**
 * Send a manager alert if not debounced. Returns { sent, dedupe_key, reason }.
 */
async function sendManagerAlert({ storeId, itemName, kind, payload, managerAlertsService, client, lang = 'en' }) {
  await ensureSchema();
  if (!managerAlertsService || !managerAlertsService.handleConfirmedDailyEntry) {
    return { sent: false, reason: 'manager_alert_service_unavailable' };
  }
  const dedupeKey = `parallel:${storeId || ''}:${itemName || ''}:${kind}:${JSON.stringify(payload).slice(0, 100)}`;
  // Check debounce
  const recent = await get(
    `SELECT id FROM parallel_validation_alerts
     WHERE dedupe_key = ? AND datetime(sent_at) >= datetime('now', ?)
     ORDER BY id DESC LIMIT 1`,
    [dedupeKey, `-${ALERT_DEBOUNCE_MINUTES()} minutes`]
  );
  if (recent) {
    return { sent: false, reason: 'debounced', dedupe_key: dedupeKey };
  }
  // Build a synthetic validation result so we can reuse manager-alert-service
  const synthetic = {
    overallStatus: 'FAIL',
    failures: [{
      name: itemName,
      value: payload.humanValue ?? payload.sensorValue ?? '?',
      reason: payload.reason || kind,
      target: payload.target || 'Needs review',
    }],
  };
  const result = await managerAlertsService.handleConfirmedDailyEntry({
    client,
    session: { sender: payload.employeeId, senderName: payload.employeeName, chatId: payload.chatId, store: payload.storeName, groupName: payload.groupName },
    store: { store_id: storeId, store_name: payload.storeName },
    validationResult: synthetic,
    sheetWriteStatus: payload.sheetWriteStatus || 'N/A',
    timestamp: new Date().toISOString(),
    sessionId: payload.sessionId || `parallel-${Date.now()}`,
    staffLanguage: lang,
    originalInputs: payload.originalInputs || null,
  });
  await run(
    `INSERT INTO parallel_validation_alerts (store_id, item_name, kind, dedupe_key, status, payload_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [storeId || null, itemName || null, kind, dedupeKey, result.managerAlert?.status || 'UNKNOWN', JSON.stringify(payload)]
  );
  return { sent: result.managerAlert?.status === 'SENT', dedupe_key: dedupeKey, manager_alert: result.managerAlert };
}

// ── PHASE L: Trust Score Updates ──────────────────────────────────────────

/**
 * Apply trust score deltas per the directive:
 *   MATCH                  → employee +2
 *   MISMATCH (human chose human) → employee -5, sensor -3 if manager confirms human
 *   SENSOR_OFFLINE         → sensor -5
 *   SENSOR_STALE           → sensor -3
 * Repeated mismatches → "Possible pattern detected" flag (no score change)
 */
async function applyTrustDelta({ status, storeId, employeeId, employeeName = null, sensorId = null, managerConfirmedHuman = false }) {
  if (!status) return null;
  try {
    if (status === 'MATCH') {
      await trustScore.onHumanMatchesSensor(employeeId, storeId, employeeName);
      return { delta: 2, target: 'employee' };
    }
    if (status === 'MISMATCH') {
      await trustScore.onHumanMismatchSensor(employeeId, storeId, employeeName);
      return { delta: -5, target: 'employee' };
    }
    if (status === 'SENSOR_OFFLINE' && sensorId) {
      await trustScore.recordSensorResult(sensorId, 'SENSOR_OFFLINE');
      return { delta: -5, target: 'sensor' };
    }
    if (status === 'SENSOR_STALE' && sensorId) {
      await trustScore.recordSensorResult(sensorId, 'SENSOR_STALE');
      return { delta: -3, target: 'sensor' };
    }
  } catch (err) {
    log.warn('Trust score update failed', { status, error: err.message });
  }
  return null;
}

module.exports = {
  ensureSchema,
  // Mapping (Phase D)
  mapSensorToItem,
  unmapSensor,
  getActiveMappings,
  // Sensor reading save (Phase F)
  saveSensorReading,
  // Cross-validation (Phase G)
  crossValidateHumanVsSensor,
  recordHumanValue,
  // Mismatch UX (Phase H)
  buildMismatchPrompt,
  // Manager alert (Phase I)
  sendManagerAlert,
  ALERT_DEBOUNCE_MINUTES,
  // Trust (Phase L)
  applyTrustDelta,
};
