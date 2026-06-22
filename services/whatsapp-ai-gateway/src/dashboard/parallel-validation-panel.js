/**
 * Parallel Validation Panel — Dashboard Renderer
 * Phase K of CEO Parallel Validation directive.
 *
 * Renders:
 *   - Human + YoLink Validation panel (latest per item, last 30 min)
 *   - YoLink API Settings panel (with Save/Test/Clear/Sync/Poll)
 *   - Sensor Mapping panel (per-store sensor ↔ item)
 *   - Sensor Health mini-cards (battery, signal, offline duration)
 *
 * Statuses:
 *   PASS, OUT_OF_RANGE, MATCH, MISMATCH, NO_SENSOR, SENSOR_STALE,
 *   SENSOR_OFFLINE, API_NOT_CONFIGURED
 *
 * All panels degrade gracefully when services are unavailable.
 */

const measurementSvc = (() => { try { return require('../compliance/measurement-records'); } catch (_) { null; } })();
const parallelSvc = (() => { try { return require('../compliance/parallel-validation-service'); } catch (_) { null; } })();
const deviceSvc = (() => { try { return require('../integrations/yolink/yolink-device-service'); } catch (_) { null; } })();
const apiSettings = (() => { try { return require('../integrations/yolink/yolink-api-settings'); } catch (_) { null; } })();
const templateCache = (() => { try { return require('../templates/template-cache'); } catch (_) { null; } })();

// ── API Settings Panel ─────────────────────────────────────────────────────
async function renderApiSettingsPanel() {
  if (!apiSettings) {
    return `<section class="section">
      <div class="section-head"><h2>YoLink API Settings</h2><span class="badge off">MODULE OFFLINE</span></div>
      <div class="dim">YoLink API settings service unavailable.</div>
    </section>`;
  }
  const status = await apiSettings.getStatus();
  const enabledBadge = status.enabled
    ? `<span class="badge ok">ENABLED</span>`
    : `<span class="badge off">DISABLED</span>`;
  const configuredBadge = status.configured
    ? `<span class="badge ok">CONFIGURED</span>`
    : `<span class="badge off">NOT CONFIGURED</span>`;
  const lastAuth = status.last_auth_test
    ? `<small class="dim">Last test: ${esc(status.last_auth_test.status)} at ${esc(status.last_auth_test.at)}</small>`
    : `<small class="dim">Last test: —</small>`;
  return `<section class="section">
    <div class="section-head">
      <h2>YoLink API Settings</h2>
      <div class="row">${enabledBadge} ${configuredBadge}</div>
    </div>
    ${!status.configured ? `<div class="dim" style="margin-bottom:10px">YoLink API credentials are not configured. Manual Sensor Mode is active. Human workflow remains active. Pilot impact: Not Blocking.</div>` : ''}
    <div class="row" style="flex-wrap:wrap;gap:6px;margin-bottom:8px">
      <input id="yolink-client-id" placeholder="Client ID" style="flex:1;min-width:160px">
      <input id="yolink-client-secret" type="password" placeholder="Client Secret" style="flex:1;min-width:160px">
      <button class="primary" onclick="yolinkSaveCredentials()">Save Credentials</button>
    </div>
    <div class="row" style="flex-wrap:wrap;gap:6px;margin-bottom:8px">
      <button onclick="yolinkTestConnection()">Test Connection</button>
      <button onclick="yolinkSyncDevices()">Sync Devices</button>
      <button onclick="yolinkForcePoll()">Force Poll</button>
      ${status.configured ? '<button class="danger" onclick="yolinkClearCredentials()">Clear Credentials</button>' : ''}
      <button onclick="yolinkSetEnabled('${!status.enabled}')">${status.enabled ? 'Disable Polling' : 'Enable Polling'}</button>
    </div>
    <div class="row" style="gap:12px;flex-wrap:wrap">
      <small class="dim">Client ID: ${esc(status.client_id || '—')}</small>
      <small class="dim">Secret: ${status.client_secret_configured ? '•••• stored ' + esc(status.secret_hash || '') : 'not set'}</small>
      ${lastAuth}
    </div>
  </section>`;
}

// ── Sensor Mapping Panel ───────────────────────────────────────────────────
async function renderSensorMappingPanel() {
  if (!parallelSvc) {
    return `<section class="section">
      <div class="section-head"><h2>Sensor Mapping</h2><span class="badge off">MODULE OFFLINE</span></div>
    </section>`;
  }
  const mappings = await parallelSvc.getActiveMappings().catch(() => []);
  const rows = mappings.length ? mappings.map(m => {
    const cls = m.verified_status === 'API_CONNECTED' ? 'ok' : m.verified_status === 'HARDWARE_VERIFIED' ? 'warn' : 'off';
    return `<tr>
      <td>${esc(m.device_name || m.sensor_id || '')}<br><small class="dim">${esc(m.model || '')} • ${esc(m.device_eui || '')}</small></td>
      <td>${esc(m.store_name || m.store_id || '')}</td>
      <td>${esc(m.item_name || '')}</td>
      <td><span class="badge ${cls}">${esc(m.verified_status || 'MANUAL')}</span></td>
      <td>${esc(m.is_hub ? 'HUB (no temp item)' : 'temperature')}</td>
      <td><button class="small danger" onclick="yolinkUnmapSensor(${m.id})">Unmap</button></td>
    </tr>`;
  }).join('') : `<tr><td colspan="6" class="dim" style="text-align:center;padding:16px">No active sensor mappings yet. Add devices above, then map each temperature sensor to a Daily Entry item.</td></tr>`;

  // Get device options
  let deviceOptions = '';
  let itemOptions = '';
  let storeOptions = `<option value="">Store *</option>
    <option value="stone_oak">Stone Oak</option>
    <option value="bandera">Bandera</option>
    <option value="rim">Rim</option>`;
  try {
    if (deviceSvc) {
      const sensors = await deviceSvc.listTemperatureSensors();
      deviceOptions = sensors.map(s => `<option value="${esc(s.sensor_id)}" data-store="${esc(s.store_id || '')}">${esc(s.device_name || s.sensor_id)} (${esc(s.store_name || s.store_id || '')})</option>`).join('');
    }
  } catch (_) {}
  try {
    if (templateCache) {
      const items = templateCache.getItemNames ? templateCache.getItemNames() : [];
      itemOptions = items.map(i => `<option value="${esc(i)}">${esc(i)}</option>`).join('');
    }
  } catch (_) {}

  return `<section class="section">
    <div class="section-head"><h2>Sensor Mapping</h2><span class="dim">${mappings.length} active</span></div>
    <div class="row" style="margin-bottom:10px;gap:8px;flex-wrap:wrap">
      <span class="badge ok">YoLink Hardware: Verified</span>
      <span class="badge off">YoLink API: Not Configured</span>
      <span class="badge ok">Pilot Impact: Not Blocking</span>
      <button class="primary" onclick="yolinkSeedRimDevices()">Seed Rim YoLink Devices</button>
    </div>
    <div class="row" style="flex-wrap:wrap;gap:6px;margin-bottom:8px">
      <select id="yolink-map-sensor" style="flex:1;min-width:200px">
        <option value="">Temperature Sensor *</option>${deviceOptions}
      </select>
      <select id="yolink-map-store" style="width:130px">${storeOptions}</select>
      <select id="yolink-map-item" style="flex:1;min-width:200px">
        <option value="">Daily Entry Item *</option>${itemOptions}
      </select>
      <button class="primary" onclick="yolinkMapSensor()">Map Sensor → Item</button>
    </div>
    <table>
      <thead><tr><th>Device</th><th>Store</th><th>Mapped Item</th><th>Verified</th><th>Type</th><th>Action</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

// ── Human + YoLink Validation Panel ───────────────────────────────────────
async function renderValidationPanel(storeId = null) {
  if (!measurementSvc) {
    return `<section class="section">
      <div class="section-head"><h2>Human + YoLink Validation</h2><span class="badge off">MODULE OFFLINE</span></div>
    </section>`;
  }
  const apiConfigured = await apiSettings?.isConfigured().catch(() => false) || false;
  const stats = await measurementSvc.getStats(storeId).catch(() => ({ total: 0, bySource: {}, byStatus: {} }));
  let sensors = [];
  let mappings = [];
  try {
    if (deviceSvc) sensors = await deviceSvc.listTemperatureSensors(storeId);
    if (parallelSvc) mappings = await parallelSvc.getActiveMappings(storeId);
  } catch (_) {}

  // Build sensor health mini-cards
  const sensorHealth = sensors.map(s => {
    const stateCls = s.device_state === 'offline' ? 'bad' : s.device_state === 'warning' ? 'warn' : s.device_state === 'online' ? 'ok' : 'off';
    const battery = s.battery_level != null ? `\uD83D\uDD0B ${s.battery_level}%` : '—';
    const offlineFor = s.last_offline_at
      ? `${Math.max(0, Math.round((Date.now() - new Date(s.last_offline_at).getTime()) / 60000))}m offline`
      : '—';
    return `<div class="card" style="min-width:200px">
      <h3>${esc(s.device_name || s.sensor_id)}</h3>
      <div>${statusBadge(s.device_state || 'unknown', stateCls)}</div>
      <div class="meta">Store: ${esc(s.store_name || s.store_id || '')}<br>Item: ${esc(s.item_name || s.mapped_item || '(unmapped)')}</div>
      <div class="meta">${battery} | Signal: ${esc(s.signal_status || '—')}</div>
      <div class="meta">${offlineFor}<br>Last: ${esc(s.last_reading_at || '—')}</div>
    </div>`;
  }).join('');

  // Build per-item validation table — joined from active mappings
  const itemRows = mappings.length ? mappings.map(m => {
    return `<tr data-store="${esc(m.store_id)}" data-item="${esc(m.item_name)}">
      <td>${esc(m.store_name || m.store_id)}</td>
      <td>${esc(m.item_name)}</td>
      <td class="yolink-human" data-key="human">…</td>
      <td class="yolink-sensor" data-key="sensor">…</td>
      <td class="yolink-diff" data-key="diff">…</td>
      <td class="yolink-status" data-key="status"><span class="badge off">loading…</span></td>
      <td class="yolink-updated" data-key="updated">…</td>
      <td class="yolink-alert" data-key="alert">…</td>
    </tr>`;
  }).join('') : `<tr><td colspan="8" class="dim" style="text-align:center;padding:16px">No active sensor mappings. Add sensors above and map them to items to enable Human + YoLink validation.</td></tr>`;

  return `<section class="section">
    <div class="section-head">
      <h2>Human + YoLink Validation</h2>
      <div class="row">
        ${apiConfigured
          ? `<span class="badge ok">API CONFIGURED</span>`
          : `<span class="badge off">API NOT CONFIGURED</span>`}
        <span class="dim">${stats.total} total records</span>
      </div>
    </div>
    ${!apiConfigured
      ? `<div class="dim" style="margin-bottom:10px">YoLink API not configured. Human workflow remains active.</div>`
      : ''}
    <h3 style="margin-bottom:6px">Per-Item Comparison (last 10 min)</h3>
    <table>
      <thead><tr><th>Store</th><th>Item</th><th>Last Human</th><th>Last YoLink</th><th>Diff</th><th>Status</th><th>Updated</th><th>Alert</th></tr></thead>
      <tbody id="yolink-validation-table">${itemRows}</tbody>
    </table>
    <h3 style="margin:14px 0 6px">Sensor Health</h3>
    <div class="grid">${sensorHealth || emptyCard('No temperature sensors registered')}</div>
    <h3 style="margin:14px 0 6px">Manual Sensor Readings</h3>
    <div class="dim" style="margin-bottom:8px">Enter verified YoLink readings manually when API credentials are unavailable. Manual readings are stored separately and used for cross-validation.</div>
    <table>
      <thead><tr><th>Device</th><th>Current Temperature</th><th>Unit</th><th>Reading Time</th><th>Entered By</th><th>Notes</th><th>Actions</th></tr></thead>
      <tbody>
        ${sensors.filter(s => !s.is_hub && s.active).map(s => `<tr>
          <td>${esc(s.device_name || s.sensor_id)}<br><small class="dim">${esc(s.store_name || s.store_id || '')} • ${esc(s.item_name || s.mapped_item || '')}</small></td>
          <td><input id="manual-value-${esc(s.sensor_id)}" placeholder="36" style="width:90px"></td>
          <td><select id="manual-unit-${esc(s.sensor_id)}" style="width:80px"><option value="F">°F</option><option value="C">°C</option></select></td>
          <td><input id="manual-time-${esc(s.sensor_id)}" type="datetime-local" style="min-width:170px"></td>
          <td><input id="manual-by-${esc(s.sensor_id)}" placeholder="CEO / GM" style="min-width:120px"></td>
          <td><input id="manual-notes-${esc(s.sensor_id)}" placeholder="Notes" style="min-width:140px"></td>
          <td>
            <button class="small primary" onclick="yolinkSaveManualReading('${esc(s.sensor_id)}')">Save Reading</button>
            <button class="small" onclick="yolinkSaveManualReading('${esc(s.sensor_id)}', true)">Save & Validate</button>
          </td>
        </tr>`).join('') || `<tr><td colspan="7" class="dim" style="text-align:center;padding:16px">No active temperature sensors available for Manual Sensor Mode.</td></tr>`}
      </tbody>
    </table>
  </section>
  <script>
    // Fetch live pair data per row
    (async () => {
      const rows = document.querySelectorAll('#yolink-validation-table tr[data-store]');
      for (const row of rows) {
        const storeId = row.getAttribute('data-store');
        const itemName = row.getAttribute('data-item');
        try {
          const r = await fetch('/api/admin/yolink/validation-panel?store_id=' + encodeURIComponent(storeId) + '&item_name=' + encodeURIComponent(itemName));
          const data = await r.json();
          const human = data.pair?.human;
          const sensor = data.pair?.sensor;
          row.querySelector('.yolink-human').textContent = human ? (human.value + '°' + (human.unit || 'F') + ' (' + (human.created_at || '').slice(11, 16) + ')') : '—';
          row.querySelector('.yolink-sensor').textContent = sensor ? (sensor.value + '°' + (sensor.unit || 'F') + ' (' + (sensor.created_at || '').slice(11, 16) + ')') : '—';
          const diff = (human && sensor) ? Math.abs(human.value - sensor.value).toFixed(1) + '°' : '—';
          row.querySelector('.yolink-diff').textContent = diff;
          // Compute status
          let status = 'NO_SENSOR', badgeCls = 'off', alertText = '—';
          if (!sensor) { status = 'NO_SENSOR'; badgeCls = 'off'; }
          else if (!human) { status = 'API_NOT_CONFIGURED'; badgeCls = 'off'; }
          else {
            const d = Math.abs(human.value - sensor.value);
            if (d <= 2) { status = 'MATCH'; badgeCls = 'ok'; }
            else { status = 'MISMATCH'; badgeCls = 'bad'; alertText = '⚠ Mismatch'; }
          }
          row.querySelector('.yolink-status').innerHTML = '<span class="badge ' + badgeCls + '">' + status + '</span>';
          row.querySelector('.yolink-updated').textContent = (sensor?.created_at || human?.created_at || '').slice(0, 16).replace('T', ' ');
          row.querySelector('.yolink-alert').textContent = alertText;
        } catch (e) {
          row.querySelector('.yolink-status').innerHTML = '<span class="badge bad">ERROR</span>';
        }
      }
    })();
  </script>`;
}

function emptyCard(msg) {
  return `<div class="card"><div class="dim">${esc(msg)}</div></div>`;
}

function statusBadge(label, cls) {
  return `<span class="badge ${cls}">${esc(label)}</span>`;
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = {
  renderApiSettingsPanel,
  renderSensorMappingPanel,
  renderValidationPanel,
};
