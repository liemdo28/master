/**
 * YoLink Reading Service — fetches and stores sensor readings
 */
const client = require('./yolink-client');
const normalizer = require('./yolink-normalizer');
const deviceSync = require('./yolink-device-sync');
const { run, all, get } = require('../../storage/sqlite');
const { makeLogger } = require('../../logger');
const log = makeLogger('yolink');

async function pollAllSensors() {
  const sensors = await deviceSync.getActiveSensors();
  if (!sensors.length) {
    log.info('YoLink poll: no active sensors');
    return { polled: 0, readings: [] };
  }

  const readings = [];
  for (const sensor of sensors) {
    try {
      const reading = await pollSensor(sensor);
      if (reading) readings.push(reading);
    } catch (err) {
      log.error('YoLink poll sensor failed', { sensor_id: sensor.sensor_id, error: err.message });
      await logStatusEvent(sensor.sensor_id, 'POLL_ERROR', 'ERROR', err.message);
    }
  }

  log.info('YoLink poll complete', { polled: sensors.length, readings: readings.length });
  return { polled: sensors.length, readings };
}

async function pollSensor(sensor) {
  const state = await client.getDeviceState(sensor.provider_device_id);
  const normalized = normalizer.normalizeReading(state, sensor);
  if (!normalized) return null;

  await saveReading(normalized);
  return normalized;
}

async function saveReading(reading) {
  // Try parallel-validation save first (writes to BOTH sensor_readings + measurement_records).
  // Fall back to direct insert if the service is unavailable (e.g. test runs).
  try {
    const parallel = require('../../compliance/parallel-validation-service');
    await parallel.ensureSchema();
    await parallel.saveSensorReading({
      sensor: reading,
      value: reading.value,
      unit: reading.unit,
      batteryLevel: reading.battery_level,
      signalStatus: reading.signal_status,
      onlineStatus: reading.online_status,
      providerTimestamp: reading.provider_timestamp,
      rawPayload: reading.raw_payload_json ? safeJsonParse(reading.raw_payload_json) : null,
    });
    return;
  } catch (err) {
    // Fallback — direct insert into sensor_readings
    await run(
      `INSERT INTO sensor_readings
       (sensor_id, store_id, item_name, value, unit, battery_level, signal_status, online_status, provider_timestamp, raw_payload_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reading.sensor_id, reading.store_id, reading.item_name,
        reading.value, reading.unit, reading.battery_level,
        reading.signal_status, reading.online_status,
        reading.provider_timestamp, reading.raw_payload_json,
      ]
    );
  }
}

function safeJsonParse(s) {
  if (!s) return null;
  if (typeof s !== 'string') return s;
  try { return JSON.parse(s); } catch (_) { return null; }
}

async function getLatestReading(sensorId) {
  return get(
    'SELECT * FROM sensor_readings WHERE sensor_id = ? ORDER BY received_at DESC LIMIT 1',
    [sensorId]
  );
}

async function getLatestReadingForItem(storeId, itemName) {
  // Find sensor mapped to this item
  const mapping = await get(
    'SELECT sensor_id FROM sensor_item_mapping WHERE store_id = ? AND item_name = ? AND active = 1',
    [storeId, itemName]
  );
  if (!mapping) {
    // Fallback: check sensors table direct item_name
    const sensor = await get(
      'SELECT sensor_id FROM sensors WHERE store_id = ? AND item_name = ? AND active = 1',
      [storeId, itemName]
    );
    if (!sensor) return null;
    return getLatestReading(sensor.sensor_id);
  }
  return getLatestReading(mapping.sensor_id);
}

async function getReadingsForStore(storeId, limit = 20) {
  return all(
    'SELECT * FROM sensor_readings WHERE store_id = ? ORDER BY received_at DESC LIMIT ?',
    [storeId, limit]
  );
}

async function getRecentReadings(limit = 50) {
  return all('SELECT * FROM sensor_readings ORDER BY received_at DESC LIMIT ?', [limit]);
}

async function logStatusEvent(sensorId, eventType, status, message) {
  await run(
    'INSERT INTO sensor_status_events (sensor_id, event_type, status, message) VALUES (?, ?, ?, ?)',
    [sensorId, eventType, status, message]
  );
}

module.exports = {
  pollAllSensors, pollSensor, saveReading,
  getLatestReading, getLatestReadingForItem, getReadingsForStore, getRecentReadings,
  logStatusEvent,
};
