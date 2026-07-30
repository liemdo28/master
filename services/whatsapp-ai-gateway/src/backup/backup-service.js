/**
 * Backup Service
 *
 * Export / import operational configuration only.
 *
 * Scope (EXPORTED):
 *   - store_groups            (chat_id → store mapping, locked flag)
 *   - app_config              (sheet URLs, manager alert group, etc.)
 *   - sensors                 (YoLink device rows: EUI, store_id, item_name,
 *                              active, trust_enabled — NO credentials, NO readings)
 *   - sensor_item_mapping     (per-store, per-item sensor mapping)
 *   - template_cache_meta     (template_items count + current version + syncAt)
 *
 * Scope (NEVER EXPORTED):
 *   - .env, secrets/, service-account JSON
 *   - WhatsApp session files
 *   - browser cache, screenshots
 *   - runtime DB outside the listed tables
 *   - audit logs, sheet_write_queue rows (volatile; can grow huge)
 *
 * The export is a single JSON file with a versioned schema. The import
 * validates the schema, runs a dry-run, and only writes on confirm.
 *
 * The apply path is **schema-aware**: it introspects the live SQLite
 * columns for each target table and only INSERTs the columns that
 * actually exist. This keeps the service robust against drift between
 * `ensureTables()` migrations.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { run, all, get } = require('../storage/sqlite');
const { makeLogger } = require('../logger');

const log = makeLogger('backup');

const EXPORT_SCHEMA_VERSION = 1;
const EXPORT_TABLES = ['store_groups', 'app_config', 'sensors', 'sensor_item_mapping'];

const EXPORT_DENYLIST_KEYS = new Set([
  'YOLINK_CLIENT_SECRET',
  'GEMINI_API_KEY',
  'VISION_API_KEY',
  'GOOGLE_SERVICE_ACCOUNT_JSON',
  'SESSION_DIR',
  'TELEGRAM_BOT_TOKEN',
  'WHATSAPP_SESSION',
]);

// Column whitelist per table — defensive allowlist for what applyImport
// is allowed to write. Anything else in the export is ignored.
const WRITEABLE_COLUMNS = {
  store_groups: [
    'chat_id', 'group_name', 'store_id', 'store_name',
    'active', 'locked', 'last_message_at', 'last_log_write_at',
  ],
  app_config: ['key', 'value'],
  sensors: [
    'sensor_id', 'provider', 'provider_device_id', 'device_eui',
    'serial_number', 'model', 'device_name', 'store_id', 'store_name',
    'location_name', 'item_name', 'sensor_type', 'unit',
    'active', 'trust_enabled',
  ],
  sensor_item_mapping: [
    'sensor_id', 'template_item_id', 'store_id', 'item_name',
    'mapping_confidence', 'active',
  ],
};

// Natural keys per table — for merge / dedupe. Schema-version tolerant.
const NATURAL_KEYS = {
  store_groups: ['chat_id'],
  app_config: ['key'],
  sensors: ['device_eui'],
  sensor_item_mapping: ['sensor_id', 'store_id', 'item_name'],
};

function isDeniedKey(key) {
  const upper = String(key || '').toUpperCase();
  for (const denied of EXPORT_DENYLIST_KEYS) {
    if (upper.includes(denied)) return true;
  }
  return false;
}

function computeChecksum(payload) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');
}

async function readTableAsObjects(tableName) {
  if (!EXPORT_TABLES.includes(tableName)) {
    throw new Error(`Refusing to read non-whitelisted table: ${tableName}`);
  }
  return all(`SELECT * FROM ${tableName}`);
}

async function readTemplateCacheMeta() {
  try {
    const items = await all(`SELECT COUNT(*) AS c FROM template_items`).catch(() => [{ c: 0 }]);
    const version = await get(
      `SELECT version, synced_at FROM template_cache_status ORDER BY id DESC LIMIT 1`
    ).catch(() => null);
    return {
      item_count: items?.[0]?.c || 0,
      latest_version: version?.version || null,
      latest_synced_at: version?.synced_at || null,
    };
  } catch (_) {
    return { item_count: 0, latest_version: null, latest_synced_at: null };
  }
}

async function buildExport() {
  await require('../stores/store-registry').ensureTables();

  const storeGroups = await readTableAsObjects('store_groups');
  const rawConfig = await readTableAsObjects('app_config');
  const appConfig = rawConfig.filter(row => !isDeniedKey(row.key));
  const sensors = await readTableAsObjects('sensors');
  const sensorItemMapping = await readTableAsObjects('sensor_item_mapping');
  const templateCacheMeta = await readTemplateCacheMeta();

  const payload = {
    schema_version: EXPORT_SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    generator: 'whatsapp-ai-gateway/backup-service',
    counts: {
      store_groups: storeGroups.length,
      app_config: appConfig.length,
      sensors: sensors.length,
      sensor_item_mapping: sensorItemMapping.length,
    },
    template_cache_meta: templateCacheMeta,
    data: {
      store_groups: storeGroups,
      app_config: appConfig,
      sensors,
      sensor_item_mapping: sensorItemMapping,
    },
  };
  payload.checksum_sha256 = computeChecksum({
    schema_version: payload.schema_version,
    counts: payload.counts,
    data: payload.data,
  });
  return payload;
}

function buildExportFilename() {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return `waig-config-${ts}.json`;
}

function getDefaultBackupDir() {
  const dir = path.resolve('./data/backup');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function writeExportToDisk({ outDir = getDefaultBackupDir() } = {}) {
  const payload = await buildExport();
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const filePath = path.join(outDir, buildExportFilename());
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
  log.info('Config export written', { filePath, counts: payload.counts });
  return { filePath, payload };
}

// ── Validation ────────────────────────────────────────────────────────────────

function validatePayloadShape(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object') errors.push('payload is not an object');
  if (!payload.schema_version) errors.push('schema_version missing');
  if (payload.schema_version !== EXPORT_SCHEMA_VERSION) {
    errors.push(`unsupported schema_version: ${payload.schema_version} (expected ${EXPORT_SCHEMA_VERSION})`);
  }
  if (!payload.data || typeof payload.data !== 'object') errors.push('data block missing');
  for (const table of EXPORT_TABLES) {
    if (!Array.isArray(payload?.data?.[table])) {
      errors.push(`data.${table} is not an array`);
    }
  }
  return errors;
}

function validateRowTypes(payload) {
  const errors = [];
  for (const row of payload.data.store_groups || []) {
    if (!row.chat_id) errors.push(`store_groups row missing chat_id: ${JSON.stringify(row)}`);
    if (!row.store_id) errors.push(`store_groups row missing store_id: ${JSON.stringify(row)}`);
    if (!['stone_oak', 'bandera', 'rim', 'test'].includes(String(row.store_id))) {
      errors.push(`store_groups row has unknown store_id: ${row.store_id}`);
    }
  }
  for (const row of payload.data.app_config || []) {
    if (!row.key) errors.push(`app_config row missing key: ${JSON.stringify(row)}`);
    if (isDeniedKey(row.key)) {
      errors.push(`app_config row contains denied key: ${row.key}`);
    }
  }
  const euis = new Set();
  for (const row of payload.data.sensors || []) {
    if (!row.sensor_id) errors.push(`sensors row missing sensor_id: ${JSON.stringify(row)}`);
    if (row.device_eui) {
      if (euis.has(row.device_eui)) errors.push(`sensors row duplicate device_eui: ${row.device_eui}`);
      euis.add(row.device_eui);
    }
  }
  for (const row of payload.data.sensor_item_mapping || []) {
    if (!row.sensor_id) errors.push(`sensor_item_mapping row missing sensor_id: ${JSON.stringify(row)}`);
    if (!row.store_id) errors.push(`sensor_item_mapping row missing store_id: ${JSON.stringify(row)}`);
    if (!row.item_name) errors.push(`sensor_item_mapping row missing item_name: ${JSON.stringify(row)}`);
  }
  return errors;
}

function validateChecksum(payload) {
  if (!payload.checksum_sha256) return ['checksum_sha256 missing'];
  const recomputed = computeChecksum({
    schema_version: payload.schema_version,
    counts: payload.counts,
    data: payload.data,
  });
  if (recomputed !== payload.checksum_sha256) {
    return [`checksum mismatch: declared=${payload.checksum_sha256} recomputed=${recomputed}`];
  }
  return [];
}

function validateImport(payload) {
  const errors = [
    ...validatePayloadShape(payload),
    ...validateRowTypes(payload),
    ...validateChecksum(payload),
  ];
  return { ok: errors.length === 0, errors };
}

function diffVsCurrent(payload) {
  return {
    incoming: payload.counts,
    note: 'Counts only. Dashboard diff view will be added in Phase 2.',
  };
}

// ── Schema introspection helpers ──────────────────────────────────────────────

async function getTableColumns(tableName) {
  const rows = await all(`PRAGMA table_info(${tableName})`).catch(() => []);
  return new Set(rows.map(r => r.name));
}

function pickAllowedColumns(row, allowedCols, liveCols) {
  // Return only the fields the live table actually has, in the
  // allowlist order.
  const out = {};
  for (const col of allowedCols) {
    if (liveCols.has(col) && row[col] !== undefined) {
      out[col] = row[col];
    }
  }
  return out;
}

// ── Import / Restore ──────────────────────────────────────────────────────────

async function dryRunImport(payload) {
  const validation = validateImport(payload);
  return {
    validation,
    diff: validation.ok ? diffVsCurrent(payload) : null,
  };
}

async function applyImport(payload, { mode = 'merge' } = {}) {
  const validation = validateImport(payload);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors, applied: {} };
  }
  await require('../stores/store-registry').ensureTables();

  const applied = { store_groups: 0, app_config: 0, sensors: 0, sensor_item_mapping: 0 };

  // If replace, delete existing rows first.
  if (mode === 'replace') {
    for (const t of EXPORT_TABLES) {
      try { await run(`DELETE FROM ${t}`); } catch (e) { log.warn(`replace-mode DELETE failed on ${t}`, { err: e.message }); }
    }
  }

  for (const table of EXPORT_TABLES) {
    const allowedCols = WRITEABLE_COLUMNS[table];
    const naturalKeys = NATURAL_KEYS[table];
    const liveCols = await getTableColumns(table);
    const rows = payload.data[table] || [];

    for (const rawRow of rows) {
      const row = pickAllowedColumns(rawRow, allowedCols, liveCols);
      // Drop natural-key fields with no value (can't form a conflict)
      const hasAllKeys = naturalKeys.every(k => row[k] !== undefined && row[k] !== null && row[k] !== '');
      if (!hasAllKeys && naturalKeys.length > 0) {
        // Skip — we cannot dedupe / upsert without natural keys
        continue;
      }

      const cols = Object.keys(row);
      const placeholders = cols.map(() => '?').join(', ');
      const values = cols.map(c => {
        const v = row[c];
        if (v === true) return 1;
        if (v === false) return 0;
        return v == null ? null : v;
      });

      // Build a WHERE clause on the natural keys for ON CONFLICT
      // detection. SQLite needs the conflict target to match a UNIQUE
      // constraint, which we cannot always guarantee (e.g. sensors.device_eui
      // may not have a UNIQUE index after a partial migration). So we use
      // a defensive strategy:
      //   - First, try INSERT OR IGNORE (no conflict target). If the row
      //     already exists with the same natural-key values, the IGNORE
      //     will still insert (no unique constraint) but we treat any
      //     failure as a row-level error.
      //   - For tables that DO have UNIQUE on natural keys (store_groups.chat_id,
      //     app_config.key), we can use ON CONFLICT to merge.
      const useUpsert = table === 'store_groups' || table === 'app_config';
      let sql, r;
      if (useUpsert) {
        const conflictTarget = naturalKeys.join(', ');
        const updateClause = cols
          .filter(c => !naturalKeys.includes(c))
          .map(c => `${c}=excluded.${c}`).join(', ');
        if (updateClause) {
          sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})
                 ON CONFLICT(${conflictTarget}) DO UPDATE SET ${updateClause}, updated_at=datetime('now')`;
        } else {
          sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})
                 ON CONFLICT(${conflictTarget}) DO NOTHING`;
        }
        r = await run(sql, values).catch(err => { log.warn(`${table} import row failed`, { err: err.message }); return null; });
      } else {
        // Plain INSERT (sensors and sensor_item_mapping may not have UNIQUE
        // on the natural key). De-dupe is left to the operator (replace mode
        // is the safe path here).
        sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`;
        r = await run(sql, values).catch(err => { log.warn(`${table} import row failed`, { err: err.message }); return null; });
      }
      if (r) applied[table]++;
    }
  }

  log.info('Config import applied', { mode, applied });
  return { ok: true, errors: [], applied, mode };
}

function readImportFile(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
  const raw = fs.readFileSync(filePath, 'utf8');
  let payload;
  try { payload = JSON.parse(raw); }
  catch (e) { throw new Error(`Invalid JSON: ${e.message}`); }
  return payload;
}

module.exports = {
  EXPORT_SCHEMA_VERSION,
  EXPORT_TABLES,
  WRITEABLE_COLUMNS,
  NATURAL_KEYS,
  buildExport,
  writeExportToDisk,
  validateImport,
  dryRunImport,
  applyImport,
  readImportFile,
  isDeniedKey,
};
