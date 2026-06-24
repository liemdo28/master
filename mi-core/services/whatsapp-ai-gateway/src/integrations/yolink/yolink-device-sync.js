/**
 * YoLink Device Sync — discovers devices and stores them in sensors table
 */
const client = require('./yolink-client');
const normalizer = require('./yolink-normalizer');
const { run, all, get } = require('../../storage/sqlite');
const { makeLogger } = require('../../logger');
const log = makeLogger('yolink');

async function syncDevices() {
  const devices = await client.getDeviceList();
  const thSensors = devices.filter(d =>
    (d.type || '').toLowerCase().includes('thsensor') ||
    (d.modelName || '').toLowerCase().includes('th')
  );

  log.info('YoLink device sync', { total: devices.length, thSensors: thSensors.length });
  const results = [];

  for (const device of thSensors) {
    const norm = normalizer.normalizeDevice(device);
    const sensorId = `yolink_${norm.provider_device_id}`;

    const existing = await get('SELECT id FROM sensors WHERE sensor_id = ?', [sensorId]);
    if (existing) {
      await run(`
        UPDATE sensors SET provider_device_id = ?, updated_at = datetime('now')
        WHERE sensor_id = ?
      `, [norm.provider_device_id, sensorId]);
    } else {
      await run(`
        INSERT INTO sensors (sensor_id, provider, provider_device_id, sensor_type, unit, active)
        VALUES (?, 'yolink', ?, 'temperature', 'F', 1)
      `, [sensorId, norm.provider_device_id]);
    }

    // Log sync event
    await run(`
      INSERT INTO sensor_status_events (sensor_id, event_type, status, message)
      VALUES (?, 'DEVICE_SYNC', 'OK', ?)
    `, [sensorId, `Synced: ${norm.device_name} (${norm.model})`]);

    results.push({ sensor_id: sensorId, device_name: norm.device_name, model: norm.model, device_token: norm.token });
  }

  return { synced: results.length, devices: results };
}

async function getActiveSensors() {
  return all('SELECT * FROM sensors WHERE active = 1 AND provider = ?', ['yolink']);
}

async function getSensor(sensorId) {
  return get('SELECT * FROM sensors WHERE sensor_id = ?', [sensorId]);
}

async function updateSensorStore(sensorId, storeId, storeName, locationName, itemName) {
  await run(`
    UPDATE sensors SET store_id = ?, store_name = ?, location_name = ?, item_name = ?,
    updated_at = datetime('now') WHERE sensor_id = ?
  `, [storeId, storeName, locationName, itemName, sensorId]);
}

async function disableSensor(sensorId) {
  await run("UPDATE sensors SET active = 0, updated_at = datetime('now') WHERE sensor_id = ?", [sensorId]);
}

async function enableSensor(sensorId) {
  await run("UPDATE sensors SET active = 1, updated_at = datetime('now') WHERE sensor_id = ?", [sensorId]);
}

module.exports = { syncDevices, getActiveSensors, getSensor, updateSensorStore, disableSensor, enableSensor };
