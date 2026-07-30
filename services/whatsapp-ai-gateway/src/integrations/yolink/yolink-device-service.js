/**
 * YoLink Device Service
 *
 * Manages YoLink devices manually via dashboard UI.
 * Stores device metadata in SQLite sensors table.
 * Does NOT require YoLink API credentials to save devices.
 */

const { run, all, get } = require('../../storage/sqlite');
const { makeLogger } = require('../../logger');

const log = makeLogger('yolink');

// ── Schema migration ─────────────────────────────────────────────────────────
let schemaReady = false;
let schemaPromise = null;

async function ensureSchema() {
  if (schemaReady) return;
  if (schemaPromise) return schemaPromise;
  schemaPromise = ensureSchemaInner()
    .then(() => { schemaReady = true; })
    .finally(() => { schemaPromise = null; });
  return schemaPromise;
}

async function ensureSchemaInner() {
  // sensors table with enhanced fields for manual management
  await run(`
    CREATE TABLE IF NOT EXISTS sensors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sensor_id TEXT NOT NULL UNIQUE,
      provider TEXT NOT NULL DEFAULT 'yolink',
      provider_device_id TEXT,
      device_eui TEXT UNIQUE,
      serial_number TEXT,
      model TEXT,
      device_name TEXT,
      store_id TEXT,
      store_name TEXT,
      location_name TEXT,
      item_name TEXT,
      sensor_type TEXT DEFAULT 'temperature',
      unit TEXT DEFAULT 'F',
      active INTEGER DEFAULT 1,
      trust_enabled INTEGER DEFAULT 1,
      battery_level INTEGER,
      signal_status TEXT,
      device_state TEXT DEFAULT 'unknown',
      last_seen TEXT,
      last_warning TEXT,
      warning_reason TEXT,
      last_reading_value REAL,
      last_reading_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // sensor_readings
  await run(`
    CREATE TABLE IF NOT EXISTS sensor_readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sensor_id TEXT NOT NULL,
      store_id TEXT,
      item_name TEXT,
      value REAL,
      unit TEXT DEFAULT 'F',
      battery_level INTEGER,
      signal_status TEXT,
      online_status INTEGER DEFAULT 1,
      provider_timestamp TEXT,
      received_at TEXT DEFAULT (datetime('now')),
      raw_payload_json TEXT,
      reading_source TEXT DEFAULT 'api',
      entered_by TEXT,
      notes TEXT
    )
  `);

  // sensor_item_mapping
  await run(`
    CREATE TABLE IF NOT EXISTS sensor_item_mapping (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sensor_id TEXT NOT NULL,
      store_id TEXT NOT NULL,
      item_name TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // sensor_alerts
  await run(`
    CREATE TABLE IF NOT EXISTS sensor_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sensor_id TEXT NOT NULL,
      store_id TEXT,
      alert_type TEXT,
      message TEXT,
      severity TEXT DEFAULT 'warning',
      resolved INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      resolved_at TEXT
    )
  `);

  // app_config for YoLink credentials status tracking
  await run(`
    CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Safe migration: add missing columns — check existing columns first
  const existingCols = await all(`PRAGMA table_info(sensors)`).catch(() => []);
  const existingNames = new Set(existingCols.map(c => c.name));

  const migrations = [
    ['device_eui', 'TEXT'],
    ['serial_number', 'TEXT'],
    ['model', 'TEXT'],
    ['device_name', 'TEXT'],
    ['battery_level', 'INTEGER'],
    ['signal_status', 'TEXT'],
    ['last_seen', 'TEXT'],
    ['last_warning', 'TEXT'],
    ['warning_reason', 'TEXT'],
    ['last_reading_value', 'REAL'],
    ['last_reading_at', 'TEXT'],
    ['device_state', 'TEXT'],
    // Phase B (CEO Parallel Validation) — extra registry fields
    ['verified_status', "TEXT DEFAULT 'MANUAL'"],
    ['is_hub', 'INTEGER DEFAULT 0'],
    ['mapped_item', 'TEXT'],
    ['room', 'TEXT'],
    ['hardware_verified_at', 'TEXT'],
    ['first_poll_at', 'TEXT'],
    ['last_offline_at', 'TEXT'],
    ['last_stale_at', 'TEXT'],
    ['offline_minutes_total', 'INTEGER DEFAULT 0'],
    ['stale_minutes_total', 'INTEGER DEFAULT 0'],
    ['hardware_status', "TEXT DEFAULT 'NOT_ADDED'"],
    ['api_status', "TEXT DEFAULT 'NOT_CONFIGURED'"],
    ['manual_mode_enabled', 'INTEGER DEFAULT 1'],
  ];
  for (const [col, type] of migrations) {
    if (!existingNames.has(col)) {
      try { await run(`ALTER TABLE sensors ADD COLUMN ${col} ${type}`); } catch (_) {}
    }
  }

  const readingCols = await all(`PRAGMA table_info(sensor_readings)`).catch(() => []);
  const readingNames = new Set(readingCols.map(c => c.name));
  for (const [col, type] of [
    ['reading_source', "TEXT DEFAULT 'api'"],
    ['entered_by', 'TEXT'],
    ['notes', 'TEXT'],
  ]) {
    if (!readingNames.has(col)) {
      try { await run(`ALTER TABLE sensor_readings ADD COLUMN ${col} ${type}`); } catch (_) {}
    }
  }

  // Create indexes (safe if already exist)
  try { await run(`CREATE INDEX IF NOT EXISTS idx_sensors_device_eui ON sensors(device_eui)`); } catch (_) {}
  try { await run(`CREATE INDEX IF NOT EXISTS idx_sensors_store ON sensors(store_id, item_name, active)`); } catch (_) {}
}

// ── Device CRUD ──────────────────────────────────────────────────────────────

function generateSensorId(deviceEui) {
  return 'yolink_' + (deviceEui || '').toLowerCase().replace(/[^a-f0-9]/g, '');
}

async function listDevices() {
  await ensureSchema();
  const rows = await all(
    `SELECT id, sensor_id, provider, provider_device_id, device_eui, serial_number,
            model, device_name, store_id, store_name, location_name, item_name,
            mapped_item, sensor_type, unit, active, trust_enabled,
            battery_level, signal_status, device_state,
            last_seen, last_warning, warning_reason,
            last_reading_value, last_reading_at, created_at, updated_at,
            verified_status, is_hub, room, hardware_verified_at,
            first_poll_at, last_offline_at, last_stale_at,
            offline_minutes_total, stale_minutes_total
     FROM sensors ORDER BY store_name ASC, device_name ASC`
  );
  return rows.map(r => ({
    ...r,
    active: !!r.active,
    trust_enabled: !!r.trust_enabled,
    is_hub: !!r.is_hub,
    battery_level: r.battery_level ?? null,
    last_seen: r.last_seen || null,
    device_state: r.device_state || 'unknown',
    verified_status: r.verified_status || 'MANUAL',
  }));
}

/**
 * List temperature sensors (excludes hubs) for a store.
 * Used by the dashboard Sensor-Mapping panel.
 */
async function listTemperatureSensors(storeId = null) {
  await ensureSchema();
  if (storeId) {
    return all(
      `SELECT id, sensor_id, device_name, device_eui, model, store_id, store_name,
              item_name, mapped_item, room, verified_status, is_hub, active, trust_enabled
       FROM sensors WHERE store_id = ? AND is_hub = 0 ORDER BY device_name ASC`,
      [storeId]
    );
  }
  return all(
    `SELECT id, sensor_id, device_name, device_eui, model, store_id, store_name,
            item_name, mapped_item, room, verified_status, is_hub, active, trust_enabled
     FROM sensors WHERE is_hub = 0 ORDER BY store_name ASC, device_name ASC`
  );
}

/**
 * List all hubs (gateway devices) for a store.
 */
async function listHubs(storeId = null) {
  await ensureSchema();
  if (storeId) {
    return all(
      `SELECT * FROM sensors WHERE store_id = ? AND is_hub = 1 ORDER BY device_name ASC`,
      [storeId]
    );
  }
  return all(`SELECT * FROM sensors WHERE is_hub = 1 ORDER BY store_name ASC, device_name ASC`);
}

/**
 * Update a device's verified_status (MANUAL | HARDWARE_VERIFIED |
 * API_CONNECTED | OFFLINE | DISABLED). Used by the dashboard.
 */
async function setVerifiedStatus(id, verifiedStatus, extra = {}) {
  await ensureSchema();
  const allowed = ['MANUAL', 'HARDWARE_VERIFIED', 'API_CONNECTED', 'OFFLINE', 'DISABLED'];
  if (!allowed.includes(verifiedStatus)) {
    throw new Error(`Invalid verified_status: ${verifiedStatus}`);
  }
  await run(
    `UPDATE sensors SET verified_status = ?, device_state = COALESCE(?, device_state),
       hardware_verified_at = CASE WHEN ? = 'HARDWARE_VERIFIED' AND hardware_verified_at IS NULL
                                   THEN datetime('now') ELSE hardware_verified_at END,
       updated_at = datetime('now')
     WHERE id = ?`,
    [verifiedStatus, extra.device_state || null, verifiedStatus, id]
  );
  return getDevice(id);
}

async function getDevice(id) {
  await ensureSchema();
  const row = await get(`SELECT * FROM sensors WHERE id = ? OR sensor_id = ?`, [id, id]);
  return row ? { ...row, active: !!row.active, trust_enabled: !!row.trust_enabled } : null;
}

async function addDevice(payload) {
  await ensureSchema();

  const { device_name, model, device_eui, serial_number,
    store_id, store_name, item_name, sensor_type, unit, active, trust_enabled,
    is_hub, room, mapped_item, verified_status, hardware_status, api_status, manual_mode_enabled } = payload;

  // Validation — Hub devices don't need item_name
  if (!device_eui) throw new Error('Device EUI required');
  if (!model) throw new Error('Model required');
  if (!store_id) throw new Error('Store required');
  if (!is_hub && !item_name) throw new Error('Item (location) required (or mark as Hub)');

  // Check unique device_eui
  const existing = await get(`SELECT id FROM sensors WHERE device_eui = ?`, [device_eui]);
  if (existing) throw new Error(`Device EUI ${device_eui} already registered`);

  const sensorId = generateSensorId(device_eui);
  const finalVerified = verified_status || 'HARDWARE_VERIFIED';
  const finalHardwareStatus = hardware_status || (finalVerified === 'HARDWARE_VERIFIED' ? 'HARDWARE_VERIFIED' : 'MANUAL_MODE');
  const finalApiStatus = api_status || 'NOT_CONFIGURED';
  const finalManualMode = manual_mode_enabled !== false ? 1 : 0;
  const finalIsHub = is_hub ? 1 : 0;
  // Hubs don't get an item mapping; temperature sensors do
  const finalItem = finalIsHub ? null : (item_name || null);
  const finalMappedItem = finalIsHub ? null : (mapped_item || item_name || null);

  await run(
    `INSERT INTO sensors (sensor_id, provider, device_eui, serial_number, model, device_name,
       store_id, store_name, item_name, mapped_item, sensor_type, unit, active, trust_enabled,
       is_hub, room, verified_status, hardware_status, api_status, manual_mode_enabled,
       hardware_verified_at, updated_at)
     VALUES (?, 'yolink', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [sensorId, device_eui, serial_number || null, model, device_name || '',
     store_id, store_name || store_id, finalItem, finalMappedItem,
     sensor_type || (finalIsHub ? 'hub' : 'temperature'),
     unit || 'F', active !== false ? 1 : 0, trust_enabled ? 1 : 0,
     finalIsHub, room || null, finalVerified, finalHardwareStatus, finalApiStatus, finalManualMode]
  );

  log.info('YoLink device added', { sensorId, device_name, store_id, item_name: finalItem, is_hub: !!finalIsHub, verified_status: finalVerified });
  return getDeviceBySensorId(sensorId);
}

async function updateDevice(id, payload) {
  await ensureSchema();
  const device = await getDevice(id);
  if (!device) throw new Error('Device not found');

  const {
    device_name, model, device_eui, serial_number,
    store_id, store_name, item_name, sensor_type, unit, active, trust_enabled,
    battery_level, signal_status, device_state, last_seen, last_warning, warning_reason,
    last_reading_value, last_reading_at,
  } = payload;

  await run(
    `UPDATE sensors SET
       device_name = COALESCE(?, device_name),
       model = COALESCE(?, model),
       serial_number = COALESCE(?, serial_number),
       store_id = COALESCE(?, store_id),
       store_name = COALESCE(?, store_name),
       item_name = COALESCE(?, item_name),
       sensor_type = COALESCE(?, sensor_type),
       unit = COALESCE(?, unit),
       active = CASE WHEN ? IS NOT NULL THEN ? ELSE active END,
       trust_enabled = CASE WHEN ? IS NOT NULL THEN ? ELSE trust_enabled END,
       battery_level = ?,
       signal_status = ?,
       device_state = ?,
       last_seen = ?,
       last_warning = ?,
       warning_reason = ?,
       last_reading_value = ?,
       last_reading_at = ?,
       updated_at = datetime('now')
     WHERE id = ?`,
    [device_name, model, serial_number, store_id, store_name, item_name,
     sensor_type, unit,
     active !== undefined ? 1 : null, active !== undefined ? (active ? 1 : 0) : null,
     trust_enabled !== undefined ? 1 : null, trust_enabled !== undefined ? (trust_enabled ? 1 : 0) : null,
     battery_level ?? null, signal_status || null, device_state || null,
     last_seen || null, last_warning || null, warning_reason || null,
     last_reading_value ?? null, last_reading_at || null, id]
  );

  log.info('YoLink device updated', { id, device_name });
  return getDevice(id);
}

async function deleteDevice(id) {
  await ensureSchema();
  const device = await getDevice(id);
  if (!device) throw new Error('Device not found');
  await run(`DELETE FROM sensors WHERE id = ?`, [id]);
  await run(`DELETE FROM sensor_item_mapping WHERE sensor_id = ?`, [device.sensor_id]);
  log.info('YoLink device deleted', { id, sensor_id: device.sensor_id });
  return { ok: true };
}

async function disableDevice(id) {
  return updateDevice(id, { active: false });
}

async function getDeviceBySensorId(sensorId) {
  await ensureSchema();
  const row = await get(`SELECT * FROM sensors WHERE sensor_id = ?`, [sensorId]);
  return row ? { ...row, active: !!row.active, trust_enabled: !!row.trust_enabled } : null;
}

// ── Test Reading ────────────────────────────────────────────────────────────

async function testReading(id) {
  const device = await getDevice(id);
  if (!device) return { ok: false, error: 'Device not found' };

  // Try to get real reading via yolink-reading-service if credentials exist
  const yolinkAuth = (() => { try { return require('./yolink-auth'); } catch (_) { return null; } })();
  const yolinkReadingService = (() => { try { return require('./yolink-reading-service'); } catch (_) { return null; } })();

  if (!yolinkAuth?.isConfigured()) {
    return {
      ok: false,
      status: 'NO_CREDENTIALS',
      message: 'YoLink API credentials are not configured.\nDevice saved for manual mapping.\nHuman workflow remains active.',
      device: {
        sensor_id: device.sensor_id,
        device_eui: device.device_eui,
        store_id: device.store_id,
        item_name: device.item_name,
      },
    };
  }

  if (yolinkReadingService) {
    try {
      const reading = await yolinkReadingService.getLatestReading(device.sensor_id);
      if (reading) {
        // Update device with latest reading
        await updateDevice(id, {
          last_reading_value: reading.value,
          last_reading_at: reading.timestamp || new Date().toISOString(),
          battery_level: reading.battery_level ?? null,
          signal_status: reading.signal_status || null,
          device_state: reading.online_status !== false ? 'online' : 'offline',
          last_seen: reading.provider_timestamp || new Date().toISOString(),
        });
        return {
          ok: true,
          status: 'LIVE_READING',
          value: reading.value,
          unit: reading.unit || 'F',
          battery_level: reading.battery_level ?? null,
          signal_status: reading.signal_status || null,
          device_state: reading.online_status !== false ? 'online' : 'offline',
          timestamp: reading.timestamp,
        };
      }
    } catch (err) {
      return { ok: false, status: 'API_ERROR', error: err.message };
    }
  }

  return { ok: false, status: 'NO_READING', message: 'No reading available' };
}

// ── Remap device ──────────────────────────────────────────────────────────────

async function remapDevice(id, { store_id, store_name, item_name }) {
  const device = await getDevice(id);
  if (!device) throw new Error('Device not found');
  return updateDevice(id, { store_id, store_name, store_name, item_name });
}

// ── Store/item warning check ──────────────────────────────────────────────────

async function checkItemTemplateWarning(deviceId) {
  const device = await getDevice(deviceId);
  if (!device) return null;
  if (!device.item_name) return null;
  // Check if item still exists in template
  const templateCache = (() => { try { return require('../../templates/template-cache'); } catch (_) { return null; } })();
  if (templateCache) {
    const itemNames = templateCache.getItemNames ? templateCache.getItemNames() : [];
    const exists = itemNames.some(n => n.toLowerCase() === device.item_name.toLowerCase());
    if (!exists) {
      return {
        warning: true,
        message: `Mapping warning: item "${device.item_name}" no longer exists in Daily Entry Template.`,
        device_name: device.device_name,
        store_id: device.store_id,
      };
    }
  }
  return null;
}

// ── Seed CEO devices ──────────────────────────────────────────────────────────

const CEO_DEVICES = [
  {
    device_name: 'Stone Oak Walk-in Cooler Sensor',
    model: 'YS8017-UC',
    device_eui: 'd88b4c01000f1398',
    serial_number: '7651DDF730',
    store_id: 'stone_oak',
    store_name: 'Stone Oak',
    item_name: 'Walk-in Cooler',
    sensor_type: 'temperature',
    unit: 'F',
    active: true,
    trust_enabled: true,
  },
  {
    device_name: 'Bandera Walk-in Cooler Sensor',
    model: 'YS8017-UC',
    device_eui: 'd88b4c01000f176f',
    serial_number: '7651DDF731',
    store_id: 'bandera',
    store_name: 'Bandera',
    item_name: 'Walk-in Cooler',
    sensor_type: 'temperature',
    unit: 'F',
    active: true,
    trust_enabled: true,
  },
  {
    device_name: 'Rim Walk-in Cooler Sensor',
    model: 'YS8017-UC',
    device_eui: 'd88b4c01000f069b',
    serial_number: '7651DDF732',
    store_id: 'rim',
    store_name: 'Rim',
    item_name: 'Walk-in Cooler',
    sensor_type: 'temperature',
    unit: 'F',
    active: true,
    trust_enabled: true,
  },
];

async function getSeedDrafts() {
  await ensureSchema();
  const existing = await listDevices();
  const existingEuis = new Set(existing.map(d => d.device_eui).filter(Boolean));
  return CEO_DEVICES.map(d => ({
    ...d,
    already_registered: existingEuis.has(d.device_eui),
  }));
}

// ── Cross-validation helpers ─────────────────────────────────────────────────

const SENSOR_MATCH_WINDOW_MINUTES = 30;

async function findSensorForStoreItem(storeId, itemName) {
  await ensureSchema();
  const row = await get(
    `SELECT * FROM sensors WHERE store_id = ? AND item_name = ? AND active = 1 AND trust_enabled = 1`,
    [storeId, itemName]
  );
  return row ? { ...row, active: !!row.active, trust_enabled: !!row.trust_enabled } : null;
}

async function getLatestReadingForSensor(sensorId) {
  await ensureSchema();
  const row = await get(
    `SELECT * FROM sensor_readings WHERE sensor_id = ? ORDER BY received_at DESC LIMIT 1`,
    [sensorId]
  );
  return row || null;
}

async function crossValidate(storeId, itemName, humanValue) {
  const sensor = await findSensorForStoreItem(storeId, itemName);
  if (!sensor) return { status: 'NO_SENSOR', sensor: null, reading: null };

  const reading = await getLatestReadingForSensor(sensor.sensor_id);
  if (!reading) return { status: 'NO_READING', sensor, reading: null };

  const readingTime = new Date(reading.received_at);
  const ageMinutes = (Date.now() - readingTime.getTime()) / 60000;

  if (ageMinutes > SENSOR_MATCH_WINDOW_MINUTES) {
    return { status: 'SENSOR_STALE', sensor, reading, age_minutes: Math.round(ageMinutes) };
  }

  if (reading.online_status === 0) {
    return { status: 'SENSOR_OFFLINE', sensor, reading };
  }

  if (sensor.device_state === 'offline' || sensor.device_state === 'unknown') {
    return { status: 'SENSOR_OFFLINE', sensor, reading };
  }

  return {
    status: 'SENSOR_OK',
    sensor,
    reading,
    sensor_value: reading.value,
    human_value: humanValue,
    age_minutes: Math.round(ageMinutes),
  };
}

// ── API credentials status ─────────────────────────────────────────────────────

function isApiConfigured() {
  const yolinkAuth = (() => { try { return require('./yolink-auth'); } catch (_) { return null; } })();
  return yolinkAuth?.isConfigured() || false;
}

async function getCredentialsStatus() {
  const configured = isApiConfigured();
  // Get last auth test / sync from app_config
  await ensureSchema();
  const lastAuth = await get(`SELECT value, updated_at FROM app_config WHERE key = 'YOLINK_LAST_AUTH_TEST'`);
  const lastSync = await get(`SELECT value, updated_at FROM app_config WHERE key = 'YOLINK_LAST_SYNC'`);
  const lastPoll = await get(`SELECT value, updated_at FROM app_config WHERE key = 'YOLINK_LAST_POLL'`);
  return {
    configured,
    client_id_status: configured ? 'configured' : 'not configured',
    client_secret_status: configured ? 'configured' : 'not configured',
    last_auth_test: lastAuth ? { value: lastAuth.value, at: lastAuth.updated_at } : null,
    last_device_sync: lastSync ? { value: lastSync.value, at: lastSync.updated_at } : null,
    last_poll: lastPoll ? { value: lastPoll.value, at: lastPoll.updated_at } : null,
  };
}

async function setAppConfig(key, value) {
  await ensureSchema();
  await run(
    `INSERT OR REPLACE INTO app_config (key, value, updated_at) VALUES (?, ?, datetime('now'))`,
    [key, String(value || '')]
  );
}

module.exports = {
  ensureSchema,
  listDevices,
  listTemperatureSensors,
  listHubs,
  getDevice,
  addDevice,
  updateDevice,
  deleteDevice,
  disableDevice,
  getDeviceBySensorId,
  testReading,
  remapDevice,
  checkItemTemplateWarning,
  getSeedDrafts,
  findSensorForStoreItem,
  getLatestReadingForSensor,
  crossValidate,
  isApiConfigured,
  getCredentialsStatus,
  setAppConfig,
  setVerifiedStatus,
  SENSOR_MATCH_WINDOW_MINUTES,
};
