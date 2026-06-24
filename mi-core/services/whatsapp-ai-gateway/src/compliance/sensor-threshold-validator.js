/**
 * Sensor Threshold Validator (Phase 1.2E)
 * Compares sensor readings against Daily_Entry_Template min/max thresholds.
 */
const { run, all, get } = require('../storage/sqlite');
const { makeLogger } = require('../logger');
const log = makeLogger('yolink');

let templateCache;
try { templateCache = require('../templates/template-cache'); } catch (_) {}

const STALE_MINUTES = () => parseInt(process.env.SENSOR_STALE_MINUTES || '15', 10);
const OFFLINE_MINUTES = () => parseInt(process.env.SENSOR_OFFLINE_MINUTES || '60', 10);

/**
 * Validate a single reading against template thresholds
 * Returns status: PASS | FAIL_HIGH | FAIL_LOW | STALE | OFFLINE | NEEDS_MAPPING
 */
async function validateReading(reading) {
  if (!reading || reading.value == null) {
    return { status: 'OFFLINE', reading };
  }

  if (!reading.online_status) {
    await logSensorStatus(reading.sensor_id, 'OFFLINE');
    return { status: 'OFFLINE', reading };
  }

  // Check staleness
  if (reading.provider_timestamp) {
    const ageMinutes = (Date.now() - new Date(reading.provider_timestamp).getTime()) / 60000;
    if (ageMinutes >= OFFLINE_MINUTES()) {
      await logSensorStatus(reading.sensor_id, 'OFFLINE');
      return { status: 'OFFLINE', reading, ageMinutes };
    }
    if (ageMinutes >= STALE_MINUTES()) {
      await logSensorStatus(reading.sensor_id, 'STALE');
      return { status: 'STALE', reading, ageMinutes };
    }
  }

  // Resolve item mapping
  const itemName = reading.item_name || await resolveItemName(reading.sensor_id, reading.store_id);
  if (!itemName) {
    return { status: 'NEEDS_MAPPING', reading };
  }

  // Get thresholds from template
  const thresholds = getThresholds(itemName);
  if (!thresholds) {
    return { status: 'NEEDS_MAPPING', reading, reason: 'No template thresholds found' };
  }

  const { min, max } = thresholds;
  let status = 'PASS';

  if (max != null && reading.value > max) {
    status = 'FAIL_HIGH';
  } else if (min != null && reading.value < min) {
    status = 'FAIL_LOW';
  }

  const result = {
    status,
    reading,
    item_name: itemName,
    target_min: min,
    target_max: max,
  };

  if (status !== 'PASS') {
    log.warn('Sensor threshold violation', {
      sensor_id: reading.sensor_id,
      item: itemName,
      value: reading.value,
      min, max, status,
    });
    try {
      const sensorAlerts = require('../alerts/sensor-alert-service');
      await sensorAlerts.handleThresholdFailure(result);
    } catch (_) {}
  } else {
    try {
      const sensorAlerts = require('../alerts/sensor-alert-service');
      await sensorAlerts.resolveAlert(reading.sensor_id);
    } catch (_) {}
  }

  return result;
}

async function resolveItemName(sensorId, storeId) {
  // Check sensor_item_mapping first
  const mapping = await get(
    'SELECT item_name FROM sensor_item_mapping WHERE sensor_id = ? AND active = 1',
    [sensorId]
  );
  if (mapping) return mapping.item_name;

  // Fallback to sensors table
  const sensor = await get('SELECT item_name FROM sensors WHERE sensor_id = ?', [sensorId]);
  return sensor?.item_name || null;
}

function getThresholds(itemName) {
  if (!templateCache) return null;
  const raw = templateCache.getThresholds();
  if (!raw) return null;
  // getThresholds() may return array or object — normalize to array
  const all = Array.isArray(raw) ? raw : Object.values(raw);
  const entry = all.find(t => (t.item || t.name || '') === itemName);
  if (!entry) return null;
  return { min: entry.min ?? entry.target_min, max: entry.max ?? entry.target_max };
}

async function logSensorStatus(sensorId, status) {
  // Avoid duplicate status events within 5 minutes
  const recent = await get(
    "SELECT id FROM sensor_status_events WHERE sensor_id = ? AND status = ? AND created_at > datetime('now', '-5 minutes')",
    [sensorId, status]
  );
  if (recent) return;
  await run(
    'INSERT INTO sensor_status_events (sensor_id, event_type, status, message) VALUES (?, ?, ?, ?)',
    [sensorId, 'THRESHOLD_CHECK', status, `Sensor marked ${status}`]
  );
}

/**
 * Check all sensors for staleness (called periodically)
 */
async function checkAllSensorHealth() {
  const sensors = await all('SELECT * FROM sensors WHERE active = 1');
  const results = [];

  for (const sensor of sensors) {
    const latest = await get(
      'SELECT * FROM sensor_readings WHERE sensor_id = ? ORDER BY received_at DESC LIMIT 1',
      [sensor.sensor_id]
    );

    if (!latest) {
      results.push({ sensor_id: sensor.sensor_id, status: 'NO_DATA' });
      continue;
    }

    const ageMinutes = (Date.now() - new Date(latest.received_at).getTime()) / 60000;
    let status = 'OK';
    if (ageMinutes >= OFFLINE_MINUTES()) status = 'OFFLINE';
    else if (ageMinutes >= STALE_MINUTES()) status = 'STALE';

    if (status !== 'OK') {
      await logSensorStatus(sensor.sensor_id, status);
    }

    results.push({ sensor_id: sensor.sensor_id, status, ageMinutes, lastReading: latest });
  }

  return results;
}

module.exports = { validateReading, checkAllSensorHealth, resolveItemName, getThresholds };
