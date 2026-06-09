async function renderDashboard({
  waStatus,
  waDiagnostics = null,
  telegramEnabled,
  stats = {},
  recent = [],
  qrData,
  safetyState = {},
  fsData = null,
  templateData = null,
  templateOcrData = null,
  agentData = null,
  yolinkData = null,
  storeGroupData = null,
  managerAlertData = null,
  incidentData = null,
  complianceData = null,
  pilotData = null,
  adminSetupData = null,
  parallelData = null,
  unknownData = null,
  runtimeData = null,
  formPhotoData = null,
  buildInfo = {},
}) {
  let qrImg = '';
  if (qrData) {
    try { qrImg = `data:image/png;base64,${await qrToBase64(qrData)}`; } catch (_) { qrImg = ''; }
  }
  const threads = groupThreads(recent);
  const buildName = buildInfo.name || 'Admin Control Center v1';
  const buildCommit = buildInfo.commit || 'unknown';
  const buildId = buildInfo.build_id || 'unknown';
  const buildStartedAt = buildInfo.startedAt || '';
  const appVersion = buildInfo.app_version || buildInfo.version || '?';
  const appBuild = buildInfo.app_build || '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>WhatsApp AI Gateway</title>
  <style>
    *{box-sizing:border-box}body{margin:0;background:#0b1020;color:#e5e7eb;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px}
    header{display:flex;align-items:center;gap:12px;padding:16px 24px;border-bottom:1px solid #1f2937;background:#111827;position:sticky;top:0;z-index:2}
    h1{font-size:18px;margin:0}.sub{margin-left:auto;color:#94a3b8;font-size:12px}.build{color:#94a3b8;font-size:11px;line-height:1.35;text-align:right}
    main{padding:20px 24px 32px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin-bottom:16px}
    .card,.section{background:#111827;border:1px solid #243044;border-radius:8px;padding:14px}
    .section{margin-bottom:16px}.section-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}
    h2,h3{margin:0}h2{font-size:15px}h3{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#94a3b8}
    .val{font-size:22px;font-weight:700;margin-top:7px}.meta,.dim{color:#94a3b8;font-size:12px}.dim{word-break:break-word}
    .badge{display:inline-flex;align-items:center;border-radius:999px;padding:3px 8px;font-size:11px;font-weight:700;color:#fff}
    .ok{background:#16a34a}.warn{background:#d97706}.bad{background:#dc2626}.off{background:#64748b}
    table{width:100%;border-collapse:collapse}th,td{padding:8px 7px;border-bottom:1px solid #1f2937;text-align:left;vertical-align:top}th{color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:.04em}
    input,select{background:#0f172a;border:1px solid #334155;color:#e5e7eb;border-radius:6px;padding:7px 9px;min-width:0}
    button,.btn{background:#1e293b;border:1px solid #334155;color:#e5e7eb;border-radius:6px;padding:7px 10px;cursor:pointer;text-decoration:none;display:inline-block}
    button:hover,.btn:hover{background:#334155}.primary{border-color:#2563eb;background:#1d4ed8}.danger{border-color:#7f1d1d;color:#fecaca}.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
    .qr{display:flex;align-items:center;gap:12px;margin-top:10px}.qr img{width:150px;border:4px solid #fff;border-radius:6px;background:#fff}
    .alert{background:#7f1d1d;border-bottom:1px solid #ef4444;color:#fecaca;padding:9px 24px}.small{font-size:12px}
    @media (max-width:700px){
      header{padding:12px;align-items:flex-start}.sub{margin-left:0}.build{text-align:left}main{padding:12px}
      .section,.card{padding:10px;overflow-x:auto}.section-head{align-items:flex-start;flex-direction:column}.row{align-items:stretch}
      input,select,button,.btn{max-width:100%}table{min-width:520px}.grid{grid-template-columns:1fr}
    }
  </style>
</head>
<body>
  ${safetyState.aiPaused ? '<div class="alert">AI is globally paused.</div>' : ''}
  <header>
    <h1>WhatsApp AI Gateway</h1>
    <div class="sub build">Version: ${esc(appVersion)}${appBuild ? ' (' + esc(appBuild) + ')' : ''}<br>Build ID: ${esc(buildId)}<br>Commit: ${esc(buildCommit)}<br>Started: ${esc(buildStartedAt)}<br>Rendered: ${new Date().toLocaleString()}</div>
  </header>
  <main>
    <div class="grid">
      ${statCard('WhatsApp', statusBadge(waStatus === 'ready' ? 'READY' : waStatus || 'UNKNOWN', waStatus === 'ready' ? 'ok' : 'warn'), qrImg ? '<div class="qr"><img src="' + qrImg + '" alt="QR"><span class="dim">Scan to connect</span></div>' : '')}
      ${statCard('Telegram', statusBadge(telegramEnabled ? 'ENABLED' : 'OFF', telegramEnabled ? 'ok' : 'off'))}
      ${statCard('AI Engine', statusBadge(safetyState.aiPaused ? 'PAUSED' : 'ACTIVE', safetyState.aiPaused ? 'warn' : 'ok'))}
      ${statCard('Business Hours', statusBadge(safetyState.businessHoursOpen ? 'OPEN' : 'CLOSED', safetyState.businessHoursOpen ? 'ok' : 'warn'), esc(safetyState.todaySchedule || ''))}
      ${statCard('Messages Today', esc(stats.total ?? 0), esc((stats.incoming ?? 0) + ' incoming'))}
      ${statCard('Last Message', stats.lastMessage ? esc(stats.lastMessage.name || stats.lastMessage.phone || '') : '-', stats.lastMessage ? esc((stats.lastMessage.message || '').slice(0, 90)) : '')}
    </div>

    ${renderAdminSetup(adminSetupData)}
    ${renderWhatsAppDiagnostics(waDiagnostics)}
    ${renderRuntimeControl(runtimeData)}
    ${renderStoreMappings(storeGroupData)}
    ${renderManagerAlerts(managerAlertData)}
    ${renderTemplate(templateData)}
    ${renderTemplateOcr(templateOcrData)}
    ${renderFoodSafety(fsData)}
    ${renderFormPhoto(formPhotoData)}
    ${renderAgent(agentData)}
    ${renderYoLink(yolinkData)}
    ${parallelData?.apiSettingsPanel || ''}
    ${parallelData?.sensorMappingPanel || ''}
    ${parallelData?.validationPanel || ''}
    ${renderPilot(pilotData)}
    ${renderIncident(incidentData)}
    ${renderCompliance(complianceData)}
    ${renderUnknownMessages(unknownData)}
    ${renderConversations(threads, recent)}
    ${renderSystemUpdates()}
  </main>
  <script>
    async function apiPost(url, body) {
      try {
        const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
        const d = await r.json();
        if (d.ok === false || d.error) alert(d.error || JSON.stringify(d));
        else location.reload();
      } catch(e) { alert('Request failed: ' + e.message); }
    }
    async function apiDelete(url) {
      try {
        const r = await fetch(url, { method: 'DELETE' });
        const d = await r.json();
        if (d.ok === false || d.error) alert(d.error || JSON.stringify(d));
        else location.reload();
      } catch(e) { alert('Request failed: ' + e.message); }
    }
    async function apiNoReload(url, body) {
      try {
        const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
        return r.json();
      } catch(e) { return { error: e.message }; }
    }
    async function runtimeControlAction(action) {
      const out = document.getElementById('runtime-control-output');
      if (out) out.textContent = 'Running ' + action + '...';
      const method = action === 'status' ? 'GET' : 'POST';
      const url = action === 'status' ? '/api/runtime/control/status' : '/api/runtime/control/' + action;
      try {
        const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: method === 'POST' ? '{}' : undefined });
        const d = await r.json();
        if (out) out.textContent = [d.stdout, d.stderr, d.error].filter(Boolean).join('\\n') || JSON.stringify(d, null, 2);
      } catch(e) {
        if (out) out.textContent = 'Request failed: ' + e.message;
      }
    }
    async function whatsappAction(action) {
      const out = document.getElementById('whatsapp-diagnostics-output');
      if (out) out.textContent = 'Running ' + action + '...';
      const url = action === 'status' ? '/api/whatsapp/status' : '/api/whatsapp/' + action;
      try {
        const r = await fetch(url, { method: action === 'status' ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json' }, body: action === 'status' ? undefined : '{}' });
        const d = await r.json();
        if (out) out.textContent = JSON.stringify(d, null, 2);
        if (action !== 'status') setTimeout(() => location.reload(), 1500);
      } catch(e) {
        if (out) out.textContent = 'Request failed: ' + e.message;
      }
    }
    function addStoreMapping() {
      apiPost('/api/admin/store-groups', {
        store_id: document.getElementById('new-store-select').value,
        chat_id: document.getElementById('new-chat-id').value.trim(),
        group_name: document.getElementById('new-group-name').value.trim(),
        locked: document.getElementById('new-store-locked').checked
      });
    }
    function saveManagerAlert() {
      const debounce = parseInt(document.getElementById('manager-debounce')?.value || '5');
      const escalation = parseInt(document.getElementById('manager-escalation')?.value || '30');
      apiPost('/api/admin/manager-alert-group', {
        chat_id: document.getElementById('manager-chat-id').value.trim(),
        group_name: document.getElementById('manager-group-name').value.trim(),
        enabled: document.getElementById('manager-alert-enabled').checked,
        debounce_minutes: debounce,
        escalation_minutes: escalation,
      });
    }
function saveSheetLinks() {
      apiPost('/api/admin/google-sheet-links', {
        template_sheet_url: document.getElementById('sheet-template-url').value.trim(),
        log_sheet_url: document.getElementById('sheet-log-url').value.trim()
      });
    }
    async function testSheetAccess(type) {
      const r = await apiNoReload('/api/admin/google-sheet-links/test', {});
      if (type === 'template') {
        alert(
          r.template_sheet_url === 'PASS'
            ? 'Template access: PASS\\n' + JSON.stringify({
                item_count: r.template_item_count,
                last_sync_at: r.timestamp,
              }, null, 2)
            : 'Template access: ' + (r.template_error || 'FAIL')
        );
        return;
      }
      alert(
        r.log_sheet_url === 'PASS'
          ? 'Log access: PASS\\n' + JSON.stringify({
              tab: r.log_tab || 'Dashboard_Test_Log',
              range: r.log_range || 'A:I',
              timestamp: r.timestamp,
            }, null, 2)
          : 'Log access: ' + (r.log_error || 'FAIL')
      );
    }
    async function testSheetWrite() {
      const r = await apiNoReload('/api/admin/google-sheet-links/test-write', {});
      alert(r.ok ? 'Test write: PASS\\n' + JSON.stringify(r, null, 2) : 'Test write: ' + (r.error || 'FAIL'));
    }
    // ── YoLink JS ─────────────────────────────────────────────────────────
    async function yolinkApiNoReload(url, body) {
      try {
        const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
        return r.json();
      } catch(e) { return { error: e.message }; }
    }
    function yolinkAddDevice() {
      const d = {
        device_name: document.getElementById('yolink-device-name').value.trim(),
        model: document.getElementById('yolink-model').value.trim(),
        device_eui: document.getElementById('yolink-device-eui').value.trim(),
        serial_number: document.getElementById('yolink-serial').value.trim(),
        store_id: document.getElementById('yolink-store-id').value,
        item_name: document.getElementById('yolink-item-name').value,
        sensor_type: document.getElementById('yolink-sensor-type').value,
        unit: 'F',
        active: document.getElementById('yolink-active').checked,
        trust_enabled: document.getElementById('yolink-trust').checked,
      };
      if (!d.device_eui) { alert('Device EUI is required'); return; }
      if (!d.store_id) { alert('Store is required'); return; }
      if (!d.item_name) { alert('Item/Location is required'); return; }
      const storeNames = { stone_oak: 'Stone Oak', bandera: 'Bandera', rim: 'Rim' };
      d.store_name = storeNames[d.store_id] || d.store_id;
      apiPost('/api/admin/yolink/devices', d);
    }
    function yolinkSaveAndTest() { yolinkAddDevice(); }
    function yolinkClearForm() {
      ['yolink-device-name','yolink-device-eui','yolink-serial','yolink-store-id','yolink-item-name'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
    }
    async function yolinkTestReading(id) {
      const r = await yolinkApiNoReload('/api/admin/yolink/devices/' + id + '/test-reading', {});
      if (r.status === 'NO_CREDENTIALS') alert('YoLink API not configured.\\nHuman workflow remains active.');
      else if (r.ok) alert('Reading: ' + r.value + '\u00b0' + (r.unit || 'F') + '\\nBattery: ' + (r.battery_level || '-') + '\\nSignal: ' + (r.signal_status || '-'));
      else alert('Test failed: ' + (r.error || 'Unknown'));
    }
    async function yolinkRemap(id, currentStore, currentItem) {
      const store_id = prompt('New store (stone_oak/bandera/rim):', currentStore || '');
      if (!store_id) return;
      const item_name = prompt('New item/location:', currentItem || '');
      if (!item_name) return;
      const r = await yolinkApiNoReload('/api/admin/yolink/devices/' + id + '/remap', { store_id, item_name });
      if (r.ok) location.reload(); else alert(r.error || 'Failed');
    }
    function yolinkDisable(id) { apiPost('/api/admin/yolink/devices/' + id + '/disable', {}); }
    function yolinkDelete(id) { if (confirm('Delete device?')) apiDelete('/api/admin/yolink/devices/' + id); }
    function yolinkTestApi() { apiPost('/api/admin/yolink/test-api', {}); }
    function yolinkSync() { apiPost('/api/admin/yolink/sync-devices', {}); }
    function yolinkPoll() { apiPost('/api/admin/yolink/force-poll', {}); }
    async function yolinkSeedDrafts() {
      const r = await fetch('/api/admin/yolink/seed-drafts');
      const data = await r.json();
      const drafts = data.drafts || [];
      if (!drafts.length) { alert('No YoLink devices found in YoLink account.\\nAdd device EUI manually.'); return; }
      const d = drafts[0];
      document.getElementById('yolink-device-name').value = d.device_name || '';
      document.getElementById('yolink-model').value = d.model || 'YS8017-UC';
      document.getElementById('yolink-device-eui').value = d.device_eui || '';
      document.getElementById('yolink-serial').value = d.serial_number || '';
      document.getElementById('yolink-store-id').value = d.store_id || '';
      document.getElementById('yolink-item-name').value = d.item_name || '';
      alert('Draft loaded: ' + d.device_name + '\\nEdit if needed, then Save Device.');
    }
    // ── YoLink API Settings (Phase C) ───────────────────────────────────────
    async function yolinkSaveCredentials() {
      const clientId = document.getElementById('yolink-client-id').value.trim();
      const clientSecret = document.getElementById('yolink-client-secret').value.trim();
      if (!clientId || !clientSecret) { alert('Both Client ID and Client Secret are required.'); return; }
      const r = await yolinkApiNoReload('/api/admin/yolink/save-credentials', { client_id: clientId, client_secret: clientSecret });
      if (r.ok) { alert('Credentials saved. Hash: ' + r.secret_hash); document.getElementById('yolink-client-secret').value = ''; location.reload(); }
      else alert('Save failed: ' + (r.error || 'Unknown'));
    }
    async function yolinkTestConnection() {
      const r = await yolinkApiNoReload('/api/admin/yolink/test-connection', {});
      if (r.ok && r.status === 'PASS') alert('Test Connection: PASS\\nToken acquired.');
      else alert('Test Connection: ' + (r.status || 'FAIL') + '\\n' + (r.error || ''));
    }
    async function yolinkClearCredentials() {
      if (!confirm('Clear YoLink API credentials?')) return;
      const r = await yolinkApiNoReload('/api/admin/yolink/clear-credentials', {});
      if (r.ok) { alert('Credentials cleared.'); location.reload(); }
      else alert('Failed: ' + (r.error || 'Unknown'));
    }
    async function yolinkSetEnabled(enabled) {
      const r = await yolinkApiNoReload('/api/admin/yolink/set-enabled', { enabled: !!enabled });
      if (r.ok) location.reload();
      else alert('Failed: ' + (r.error || 'Unknown'));
    }
    // ── Sensor Mapping (Phase D) ────────────────────────────────────────────
    async function yolinkMapSensor() {
      const sensorId = document.getElementById('yolink-map-sensor').value;
      const storeId = document.getElementById('yolink-map-store').value;
      const itemName = document.getElementById('yolink-map-item').value;
      if (!sensorId) { alert('Pick a temperature sensor.'); return; }
      if (!storeId) { alert('Pick a store.'); return; }
      if (!itemName) { alert('Pick a Daily Entry item.'); return; }
      const r = await yolinkApiNoReload('/api/admin/yolink/mappings', { sensor_id: sensorId, store_id: storeId, item_name: itemName });
      if (r.ok) location.reload();
      else alert('Map failed: ' + (r.error || 'Unknown'));
    }
    async function yolinkUnmapSensor(mappingId) {
      if (!confirm('Unmap this sensor?')) return;
      const r = await fetch('/api/admin/yolink/mappings/' + mappingId, { method: 'DELETE' });
      const data = await r.json();
      if (data.ok) location.reload();
      else alert('Failed: ' + (data.error || 'Unknown'));
    }
    // ── WhatsApp Group Discovery JS ───────────────────────────────────────
    async function refreshWhatsAppGroups() {
      let r;
      try {
        const resp = await fetch('/api/admin/whatsapp-groups/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        r = await resp.json();
      } catch(e) {
        alert('Request failed: ' + e.message);
        return;
      }
      if (r.status === 'WA_NOT_READY') { alert('WhatsApp not connected. Scan QR first.'); return; }
      if (!r.groups || !r.groups.length) { alert('No groups found.'); return; }
      let msg = 'WhatsApp Groups:\\n';
      r.groups.forEach(g => {
        msg += '\\n' + g.name + '\\n  ID: ' + g.chat_id + '\\n  Members: ' + (g.participant_count || 0);
        if (g.store_name || g.store_mapped) msg += '\\n  Mapped: ' + (g.store_name || g.store_mapped);
        msg += '\\n';
      });
      msg += '\\nCopy the chat ID you need.';
      alert(msg);
    }
    async function testWhatsAppGroup(chatId, name) {
      const r = await apiNoReload('/api/admin/whatsapp-groups/test', { chatId, group_name: name });
      if (r.ok) alert('Test message sent to: ' + name);
      else alert('Failed: ' + (r.error || 'Unknown'));
    }
  </script>
</body>
</html>`;
}

// ── Template helpers ──────────────────────────────────────────────────────────
function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function qrToBase64(qrData) {
  const QRCode = require('qrcode');
  const buf = await QRCode.toBuffer(qrData);
  return buf.toString('base64');
}

function statCard(title, value, meta) {
  return `<div class="card"><h3>${esc(title)}</h3><div class="val">${value}</div>${meta ? `<div class="meta">${meta}</div>` : ''}</div>`;
}

function statusBadge(label, cls) {
  return `<span class="badge ${cls}">${esc(label)}</span>`;
}

function badgeClass(status) {
  if (status === 'PASS' || status === 'READY') return 'ok';
  if (status === 'FAIL' || status === 'BLOCKED') return 'bad';
  return 'warn';
}

function emptyRow(cols, msg) {
  return `<tr><td colspan="${cols}" class="dim" style="text-align:center;padding:16px">${esc(msg)}</td></tr>`;
}

// ── Panel renderers ─────────────────────────────────────────────────────────

function renderAdminSetup(data) {
  const setup = data?.setupStatus || {};
  const checks = setup.checks || [];
  const links = data?.sheetLinks || {};
  const manager = data?.managerAlert || {};
  const queue = data?.sheetQueue || {};
  const sync = data?.templateSyncStatus || {};
  const rows = checks.map(c => {
    const cls = badgeClass(c.status);
    return `<tr><td>${esc(c.label || c.id || '')}</td><td>${statusBadge(c.status || 'UNKNOWN', cls)}</td><td class="dim">${esc(c.note || '')}</td></tr>`;
  }).join('');

  return `<section class="section">
    <div class="section-head">
      <h2>Admin Control Center</h2>
      ${statusBadge(setup.readyForPilot ? 'READY' : 'NEEDS ACTION', setup.readyForPilot ? 'ok' : 'warn')}
    </div>
    <div class="grid">
      ${statCard('Template Sheet', links.template_sheet_url ? statusBadge('SET', 'ok') : statusBadge('MISSING', 'warn'), links.template_sheet_url ? `<a class="btn small" href="${esc(links.template_sheet_url)}" target="_blank" rel="noreferrer">Open Daily Entry Template</a>` : '')}
      ${statCard('Daily Log', links.log_sheet_url ? statusBadge('SET', 'ok') : statusBadge('MISSING', 'warn'), links.log_sheet_url ? `<a class="btn small" href="${esc(links.log_sheet_url)}" target="_blank" rel="noreferrer">Open Daily Log</a>` : '')}
      ${statCard('Manager Alert', manager.chat_id ? statusBadge(manager.enabled ? 'ENABLED' : 'DISABLED', manager.enabled ? 'ok' : 'warn') : statusBadge('MISSING', 'warn'), esc(manager.group_name || manager.chat_id || ''))}
      ${statCard('Sheet Queue', esc(queue.pending || 0) + ' pending', esc((queue.failed || 0) + ' failed'))}
      ${statCard('Template Sync', esc(sync.itemCount || 0) + ' items', esc(sync.lastSync || 'not synced'))}
    </div>
    <h3>Google Sheet Settings</h3>
    <div class="row" style="margin:8px 0 14px">
      <input id="sheet-template-url" placeholder="Template sheet URL" value="${esc(links.template_sheet_url || '')}" style="flex:1;min-width:260px">
      <input id="sheet-log-url" placeholder="Daily log sheet URL" value="${esc(links.log_sheet_url || '')}" style="flex:1;min-width:260px">
      <button class="primary" onclick="saveSheetLinks()">Save Sheet Links</button>
      <button onclick="testSheetAccess('template')">Test Template Access</button>
      <button onclick="testSheetWrite()">Test Sheet Write</button>
    </div>
    <h3>Printable Forms</h3>
    <div class="row" style="margin:8px 0 14px">
      <button onclick="window.open('/api/forms/daily-entry-test-form.pdf','_blank')">Open Daily Entry Test Form PDF</button>
      <button onclick="window.open('/api/forms/daily-entry-test-form.xlsx','_blank')">Download Daily Entry Test Form XLSX</button>
      <button class="primary" onclick="apiPost('/api/forms/regenerate',{})">Regenerate Form from Template</button>
    </div>
    <h3>Guides</h3>
    <div class="row" style="margin:8px 0 14px">
      <button onclick="window.open('/api/guides/staff-en','_blank')">Open Staff Guide</button>
      <button onclick="window.open('/api/guides/manager-en','_blank')">Open Manager Guide</button>
    </div>
    <h3>WhatsApp Groups</h3>
    <div class="row" style="margin:8px 0 14px">
      <button class="primary" onclick="refreshWhatsAppGroups()">Refresh WhatsApp Groups</button>
      <span class="dim">Use Store Mapping below to lock each group to the right store.</span>
    </div>
    <h3>Setup Checklist</h3>
    <table><thead><tr><th>Check</th><th>Status</th><th>Note</th></tr></thead>
    <tbody>${rows || emptyRow(3, 'Setup status unavailable')}</tbody></table>
  </section>`;
}

function renderWhatsAppDiagnostics(data) {
  const state = data?.state || String(data?.status || 'UNKNOWN').toUpperCase();
  const ready = state === 'READY';
  const lastError = data?.last_error || '';
  return `<section class="section">
    <div class="section-head">
      <h2>WhatsApp Diagnostics</h2>
      ${statusBadge(ready ? 'CONNECTED / READY' : state, ready ? 'ok' : state === 'AUTH_FAILURE' ? 'bad' : 'warn')}
    </div>
    <div class="grid">
      ${statCard('Current State', statusBadge(state, ready ? 'ok' : state === 'AUTH_FAILURE' ? 'bad' : 'warn'), 'Client ID: bakudan-food-safety')}
      ${statCard('Last QR', esc(data?.last_qr_at || '-'), data?.qrData ? 'QR available on dashboard header' : '')}
      ${statCard('Authenticated', esc(data?.last_authenticated_at || '-'), '')}
      ${statCard('Ready', esc(data?.last_ready_at || '-'), '')}
      ${statCard('Restart Count', esc(data?.restart_count ?? 0), '')}
      ${statCard('Last Error', lastError ? esc(lastError) : '-', '')}
    </div>
    <div class="row" style="margin:8px 0 12px">
      <button onclick="whatsappAction('status')">Refresh Diagnostics</button>
      <button class="primary" onclick="whatsappAction('restart')">Restart WhatsApp</button>
      <button onclick="whatsappAction('restart')">Generate New QR / Re-Pair</button>
      <button class="danger" onclick="if(confirm('Reset WhatsApp session and require a new QR scan?')) whatsappAction('reset-session')">Reset WhatsApp Session</button>
    </div>
    <pre id="whatsapp-diagnostics-output" class="dim" style="white-space:pre-wrap;background:#0f172a;border:1px solid #243044;border-radius:6px;padding:10px;margin:0">${esc(JSON.stringify(data || {}, null, 2))}</pre>
  </section>`;
}

function renderRuntimeControl(data) {
  const output = data?.stdout || data?.error || 'Status not loaded';
  const running = /Gateway status:\s*running/i.test(output);
  return `<section class="section">
    <div class="section-head">
      <h2>Runtime Control</h2>
      ${statusBadge(running ? 'RUNNING' : 'CHECK', running ? 'ok' : 'warn')}
    </div>
    <div class="grid">
      ${statCard('Windows Runtime', running ? statusBadge('RUNNING', 'ok') : statusBadge('UNKNOWN', 'warn'), 'Hidden background process')}
      ${statCard('Port', '3210', '<a class="btn small" href="http://localhost:3210" target="_blank" rel="noreferrer">Open Dashboard</a>')}
      ${statCard('Auto Start', 'Scheduled Task', 'WhatsApp AI Gateway')}
      ${statCard('Watchdog', 'Manual script', 'scripts/windows/watchdog.ps1')}
    </div>
    <div class="row" style="margin:8px 0 12px">
      <button onclick="runtimeControlAction('status')">Status</button>
      <button class="primary" onclick="runtimeControlAction('start')">Start Hidden</button>
      <button class="danger" onclick="runtimeControlAction('stop')">Stop</button>
      <button onclick="runtimeControlAction('install_autostart')">Install Auto Start</button>
      <button onclick="runtimeControlAction('uninstall_autostart')">Uninstall Auto Start</button>
    </div>
    <pre id="runtime-control-output" class="dim" style="white-space:pre-wrap;background:#0f172a;border:1px solid #243044;border-radius:6px;padding:10px;margin:0">${esc(output)}</pre>
  </section>`;
}

function renderStoreMappings(data) {
  if (!data) return '';
  const mappings = data.mappings || [];
  const rows = mappings.map(m => `<tr>
    <td>${esc(m.store_name || m.store_id || '')}</td>
    <td class="dim">${esc(m.group_name || '')}</td>
    <td><code>${esc(m.chat_id || '')}</code></td>
    <td>${statusBadge(m.active ? 'ACTIVE' : 'OFF', m.active ? 'ok' : 'off')}</td>
    <td>${statusBadge(m.locked ? 'LOCKED' : 'UNLOCKED', m.locked ? 'ok' : 'warn')}</td>
  </tr>`).join('');

  return `<section class="section">
    <div class="section-head"><h2>Store Mapping</h2><span class="dim">${esc(mappings.length)} mappings</span></div>
    <div class="row" style="margin-bottom:12px">
      <select id="new-store-select">
        <option value="stone_oak">Stone Oak</option>
        <option value="bandera">Bandera</option>
        <option value="rim">Rim</option>
        <option value="test">Test</option>
      </select>
      <input id="new-chat-id" placeholder="WhatsApp group chat_id" style="min-width:260px">
      <input id="new-group-name" placeholder="Group name" style="min-width:180px">
      <label class="small"><input id="new-store-locked" type="checkbox" checked> Locked</label>
      <button class="primary" onclick="addStoreMapping()">Map Group to Store</button>
    </div>
    <table><thead><tr><th>Store</th><th>Group</th><th>Chat ID</th><th>Active</th><th>Locked</th></tr></thead>
    <tbody>${rows || emptyRow(5, 'No store groups mapped yet')}</tbody></table>
  </section>`;
}

function renderManagerAlerts(data) {
  if (!data) return '';
  const group = data.group || {};
  const stats = data.stats || {};
  const recentRows = (data.recent || []).map(a => `<tr>
    <td class="dim">${esc(a.created_at || a.timestamp || '')}</td>
    <td>${esc(a.store_name || a.store_id || '')}</td>
    <td>${esc(a.status || a.alert_type || '')}</td>
    <td class="dim">${esc((a.message || a.summary || '').slice(0, 120))}</td>
  </tr>`).join('');

  return `<section class="section">
    <div class="section-head"><h2>Manager Alerts</h2>${statusBadge(group.chat_id && group.enabled ? 'ENABLED' : 'NEEDS SETUP', group.chat_id && group.enabled ? 'ok' : 'warn')}</div>
    <div class="grid">
      ${statCard('Alert Group', esc(group.group_name || group.chat_id || 'not set'))}
      ${statCard('Sent Today', esc(stats.sentToday || stats.sent_today || 0))}
      ${statCard('Recent Alerts', esc((data.recent || []).length))}
    </div>
    <div class="row" style="margin-bottom:12px">
      <input id="manager-chat-id" placeholder="Manager alert chat_id" value="${esc(group.chat_id || '')}" style="min-width:260px">
      <input id="manager-group-name" placeholder="Group name" value="${esc(group.group_name || '')}" style="min-width:180px">
      <label class="small"><input id="manager-alert-enabled" type="checkbox" ${group.enabled !== false ? 'checked' : ''}> Enabled</label>
      <input id="manager-debounce" type="number" min="0" value="${esc(group.debounce_minutes ?? 5)}" style="width:90px">
      <input id="manager-escalation" type="number" min="0" value="${esc(group.escalation_minutes ?? 30)}" style="width:90px">
      <button class="primary" onclick="saveManagerAlert()">Save Manager Alert Group</button>
      <button onclick="apiPost('/api/admin/manager-alert-group/test', {})">Test Alert</button>
    </div>
    <table><thead><tr><th>Time</th><th>Store</th><th>Status</th><th>Summary</th></tr></thead>
    <tbody>${recentRows || emptyRow(4, 'No manager alerts yet')}</tbody></table>
  </section>`;
}

// ── WhatsApp Group Discovery Panel ──────────────────────────────────────────────
// PHASE B — shows all WhatsApp groups with copy-id + map-to-store

function renderTemplate(data) {
  if (!data) {
    return `<section class="section">
      <div class="section-head"><h2>Daily Entry Template</h2>${statusBadge('INITIALIZING', 'warn')}</div>
      <div class="dim">Template cache initializing...</div>
    </section>`;
  }
  const source = data.status?.source || 'UNKNOWN';
  const initializing = source === 'default' && !data.status?.syncedAt;
  const items = (data.items || []).slice(0, 30).map((name, idx) => `<tr><td>${idx + 1}</td><td>${esc(name)}</td><td class="dim">${esc(formatThreshold(data.thresholds?.[name]))}</td></tr>`).join('');
  return `<section class="section">
    <div class="section-head"><h2>Daily Entry Template</h2>${statusBadge(initializing ? 'INITIALIZING' : source, data.items?.length ? 'ok' : 'warn')}</div>
    ${initializing ? '<div class="dim" style="margin-bottom:8px">Template cache initializing...</div>' : ''}
    <table><thead><tr><th>#</th><th>Item</th><th>Range</th></tr></thead>
    <tbody>${items || emptyRow(3, 'Template unavailable')}</tbody></table>
  </section>`;
}

function renderTemplateOcr(data) {
  if (!data) return '';
  const deps = data.deps || {};
  const recent = data.recent || [];
  const recentRows = recent.map(r => {
    const v = r.payload?.validation || {};
    const status = r.status || 'UNKNOWN';
    const sheetStatus = r.sheet_write_status || r.sheetWriteStatus || '—';
    const sheetBadge = sheetStatus === 'SENT' ? 'ok' : sheetStatus === 'PENDING' || sheetStatus === 'WAITING_CONFIRM' ? 'warn' : 'off';

    // Submission time from confirmed_at, created_at, or timestamp
    const submissionTime = r.confirmed_at || r.created_at || r.timestamp || '';
    const timeStr = submissionTime ? new Date(submissionTime).toLocaleString('en-US', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    }) : '—';

    // Average confidence across items
    const items = v.items || [];
    const avgConf = items.length > 0
      ? Math.round((items.reduce((s, i) => s + (i.confidence || 0), 0) / items.length) * 100)
      : '—';
    const confColor = avgConf === '—' ? 'off' : avgConf >= 80 ? 'ok' : avgConf >= 50 ? 'warn' : 'bad';

    // Original form image link — prefer aligned path, fall back to original
    const imagePath = r.aligned_image_path || r.payload?.alignedImagePath || r.image_path || r.payload?.imagePath || '';
    const imageLink = imagePath
      ? `<a href="/api/template-ocr/image?path=${encodeURIComponent(imagePath)}" target="_blank" rel="noreferrer" class="btn small">📷 View</a>`
      : '—';

    return `<tr>
      <td class="dim">${esc(timeStr)}</td>
      <td>${esc(r.store || '—')}</td>
      <td>${esc(r.sender_name || r.sender || '—')}</td>
      <td>${statusBadge(status, badgeClass(status))}</td>
      <td>${statusBadge(avgConf === '—' ? '—' : avgConf + '%', confColor)}</td>
      <td>${statusBadge(sheetStatus, sheetBadge)}</td>
      <td>${imageLink}</td>
      <td class="dim">${esc(r.ocr_id || r.ocrId || '')}</td>
    </tr>`;
  }).join('');

  return `<section class="section">
    <div class="section-head"><h2>OCR Runtime</h2>${statusBadge(deps.ok ? 'READY' : 'BLOCKED', deps.ok ? 'ok' : 'bad')}</div>
    <div class="grid">
      ${statCard('Tesseract', statusBadge(deps.tesseract?.ok ? 'OK' : 'MISSING', deps.tesseract?.ok ? 'ok' : 'bad'), esc(deps.tesseract?.version || ''))}
      ${statCard('OpenCV', statusBadge(deps.opencv?.ok ? 'OK' : 'MISSING', deps.opencv?.ok ? 'ok' : 'bad'), esc(deps.opencv?.version || ''))}
      ${statCard('Sharp', statusBadge(deps.sharp?.ok ? 'OK' : 'MISSING', deps.sharp?.ok ? 'ok' : 'bad'))}
      ${statCard('Total Runs', esc(data.stats?.total || 0))}
      ${statCard('Passed', esc(data.stats?.pass_count || 0))}
      ${statCard('Needs Review', esc(data.stats?.needs_review_count || 0))}
    </div>
    <h3>OCR Records</h3>
    <div class="dim small" style="margin-bottom:8px">Recent submissions across all stores. Records traceable from WhatsApp photo → OCR → Database → Google Sheet.</div>
    <table><thead><tr>
      <th>Submission Time</th>
      <th>Store</th>
      <th>Employee</th>
      <th>Record Status</th>
      <th>OCR Confidence</th>
      <th>Google Sync</th>
      <th>Original Form</th>
      <th>OCR ID</th>
    </tr></thead>
    <tbody>${recentRows || emptyRow(8, 'No OCR records yet — send a photo to a mapped store group')}</tbody></table>
  </section>`;
}

// ── Form Photo Submissions Panel (Option B) ─────────────────────────────────
function renderFormPhoto(data) {
  if (!data) return '';
  const stats = data.stats || {};
  const submissions = data.submissions || [];

  const statusColor = (s) => {
    if (s === 'SAVED' || s === 'CONFIRMED') return 'ok';
    if (s === 'OCR_REVIEW_READY') return 'warn';
    if (s === 'SYNC_FAILED' || s === 'NEEDS_REVIEW') return 'bad';
    if (s === 'RETAKE_REQUESTED' || s === 'CANCELLED') return 'off';
    return 'off';
  };

  const rows = submissions.map(s => {
    const statusCls = statusColor(s.status);
    const conf = s.ocr_confidence != null ? Math.round(s.ocr_confidence * 100) + '%' : '—';
    const syncOk = s.sync_error ? 'bad' : s.synced_to_sheet_at ? 'ok' : 'off';
    const imageLink = s.image_path
      ? `<a href="/api/form-photo/image?path=${encodeURIComponent(s.image_path)}" target="_blank" class="small">View</a>`
      : '—';
    return `<tr>
      <td class="dim">${esc(s.created_at || '')}</td>
      <td>${esc(s.store || '—')}</td>
      <td>${esc(s.sender_name || s.sender || '—')}</td>
      <td>${statusBadge(s.status || '—', statusCls)}</td>
      <td>${esc(conf)}</td>
      <td>${statusBadge(s.synced_to_sheet_at ? 'SYNCED' : s.sync_error ? 'FAILED' : 'PENDING', syncOk)}</td>
      <td>${imageLink}</td>
      <td>${esc(s.submission_id || '')}</td>
    </tr>`;
  }).join('');

  return `<section class="section">
    <div class="section-head"><h2>Form Photo Submissions</h2>
      <div class="row">
        ${statCard('Total', stats.total || 0)}
        ${statCard('Saved', stats.saved || 0)}
        ${statCard('Needs Review', stats.needs_review || 0)}
        ${statCard('Sync Failed', stats.sync_failed || 0)}
      </div>
    </div>
    <div class="dim small" style="margin-bottom:8px">
      Employee sends photo → OCR reads form → Employee confirms → Saved to DB → Google Sheet sync
    </div>
    <table><thead><tr>
      <th>Submitted</th><th>Store</th><th>Employee</th>
      <th>Status</th><th>OCR Conf.</th><th>Sheet Sync</th>
      <th>Image</th><th>Submission ID</th>
    </tr></thead>
    <tbody>${rows || '<tr><td colspan="8" class="dim">No submissions yet — use /form in WhatsApp to start</td></tr>'}</tbody></table>
  </section>`;
}

function renderFoodSafety(data) {
  if (!data) return '';
  return `<section class="section">
    <div class="section-head"><h2>Food Safety</h2>${statusBadge(data.enabled ? 'ENABLED' : 'OFF', data.enabled ? 'ok' : 'off')}</div>
    <div class="grid">
      ${statCard('Checks', esc(data.stats?.total || 0))}
      ${statCard('Last Check', esc(data.lastCheck?.created_at || '-'))}
      ${statCard('Sheet Queue', esc(data.sheetQueue?.pending || 0) + ' pending')}
    </div>
  </section>`;
}

function renderAgent(data) {
  if (!data) return '';
  const rows = (data.sessions || []).map(s => `<tr><td class="dim">${esc(s.chatId)}</td><td>${esc(s.ownerName || s.ownerId)}</td><td>${esc(s.store || '')}</td><td>${esc(s.state || '')}</td></tr>`).join('');
  return `<section class="section">
    <div class="section-head"><h2>Agent Sessions</h2><span class="dim">${esc(data.count || 0)} active</span></div>
    <table><thead><tr><th>Chat</th><th>Owner</th><th>Store</th><th>State</th></tr></thead>
    <tbody>${rows || emptyRow(4, 'No active sessions')}</tbody></table>
  </section>`;
}

function renderPilot(data) {
  if (!data) return '';
  const checks = data.checks || [];
  const allPass = checks.every(c => c.status === 'PASS' || c.status === 'READY' || c.status === 'DISABLED');
  const ready = allPass && checks.length >= 10;

  const checkRows = checks.map(c => {
    const cls = badgeClass(c.status);
    return '<tr><td>' + esc(c.label || '') + '</td>' +
      '<td>' + statusBadge(c.status || 'UNKNOWN', cls) + '</td>' +
      '<td class="dim">' + esc(c.note || '') + '</td></tr>';
  }).join('');

  return '<section class="section">' +
    '<div class="section-head"><h2>Pilot Launch Status</h2>' +
    statusBadge(ready ? 'READY' : 'NEEDS ACTION', ready ? 'ok' : 'warn') +
    '</div>' +
    '<table><thead><tr><th>Check</th><th>Status</th><th>Note</th></tr></thead>' +
    '<tbody>' + (checkRows || emptyRow(3, 'No checks available')) + '</tbody></table>' +
    '<div style="margin-top:12px">' +
    '<button class="primary" onclick="location.reload()">Refresh Status</button>' +
    '</div>' +
  '</section>';
}
function renderIncident(data) {
  if (!data) return '';
  return `<section class="section">
    <div class="section-head"><h2>Incidents</h2><span class="dim">${esc(data.stats?.total || 0)} total</span></div>
  </section>`;
}

function renderCompliance(data) {
  if (!data) return '';
  return `<section class="section">
    <div class="section-head"><h2>Compliance</h2><span class="dim">${esc(data.pending?.length || 0)} pending audits</span></div>
  </section>`;
}

function renderUnknownMessages(data) {
  if (!data) return '';
  const rows = (data.top || []).map(r => `<tr>
    <td>${esc(r.message)}</td>
    <td>${esc(r.count)}</td>
    <td>${esc(r.language || 'unknown')}</td>
    <td class="dim">${esc(r.last_seen || '')}</td>
  </tr>`).join('');
  return `<section class="section">
    <div class="section-head"><h2>Top Unknown Messages</h2><span class="dim">${esc(data.path || '')}</span></div>
    <table><thead><tr><th>Message</th><th>Count</th><th>Language</th><th>Last Seen</th></tr></thead>
    <tbody>${rows || emptyRow(4, 'No fallback messages recorded')}</tbody></table>
  </section>`;
}

function renderConversations(threads, recent) {
  const threadRows = threads.map(t => `<tr><td>${esc(t.name || t.phone)}</td><td class="dim">${esc((t.lastMessage || '').slice(0, 120))}</td><td>${esc(t.intent || '')}</td><td>${esc(t.count)}</td><td class="dim">${esc(t.lastTimestamp || '')}</td></tr>`).join('');
  const rawRows = (recent || []).slice(0, 80).map(r => `<tr><td class="dim">${esc(r.timestamp || '')}</td><td>${esc(r.direction || '')}</td><td>${esc(r.name || r.phone || '')}</td><td>${esc(r.intent || '')}</td><td class="dim">${esc((r.message || '').slice(0, 140))}</td></tr>`).join('');
  return `<section class="section">
    <div class="section-head"><h2>Conversations</h2><span class="dim">${esc(recent?.length || 0)} recent messages</span></div>
    <h3>By Customer</h3>
    <table><thead><tr><th>Customer</th><th>Last Message</th><th>Intent</th><th>#</th><th>Time</th></tr></thead>
    <tbody>${threadRows || emptyRow(5, 'No conversations')}</tbody></table>
    <h3 style="margin-top:16px">Raw Messages</h3>
    <table><thead><tr><th>Time</th><th>Dir</th><th>Customer</th><th>Intent</th><th>Message</th></tr></thead>
    <tbody>${rawRows || emptyRow(5, 'No messages')}</tbody></table>
  </section>`;
}

// ── YoLink Device Setup ────────────────────────────────────────────────────────
function renderYoLink(data) {
  if (!data) return '';
  const { devices, credentials } = data;
  const credOk = credentials?.configured;
  const credRow = credOk
    ? `<tr><td>API</td><td><span class="badge ok">CONFIGURED</span></td><td class="dim">${esc(credentials?.last_test_at || '—')}</td></tr>`
    : `<tr><td>API</td><td><span class="badge off">NOT CONFIGURED</span></td><td class="dim">Add YOLINK_CLIENT_ID + YOLINK_CLIENT_SECRET to .env</td></tr>`;

  const deviceRows = devices.length ? devices.map(d => {
    const stateCls = d.device_state === 'warning' ? 'warn' : d.device_state === 'online' ? 'ok' : 'off';
    const activeCls = d.active ? 'ok' : 'off';
    const lastReading = d.last_reading_value != null ? `${d.last_reading_value}\u00b0${esc(d.unit || 'F')}` : '\u2014';
    return `<tr>
      <td>${esc(d.device_name || d.device_eui || '')}<br><small class="dim" style="font-size:10px">${esc(d.model || '\u2014')} | ${esc(d.device_eui || '')}</small></td>
      <td>${esc(d.store_name || '\u2014')}<br><small class="dim">${esc(d.item_name || '\u2014')}</small></td>
      <td>${statusBadge(d.active ? 'ACTIVE' : 'INACTIVE', activeCls)}<br><small class="dim">Trust: ${d.trust_enabled ? 'ON' : 'OFF'}</small></td>
      <td><strong>${lastReading}</strong><br><small class="dim">${d.battery_level ? '\uD83D\uDD0B ' + d.battery_level + '%' : '\u2014'} ${esc(d.signal_status || '')}</small></td>
      <td>${statusBadge(d.device_state || 'unknown', stateCls)}<br><small class="dim">${esc(d.last_seen || 'Never')}</small></td>
      <td>
        <button class="small" onclick="yolinkTestReading(${d.id})">Test</button>
        <button class="small" onclick="yolinkRemap(${d.id}, '${esc(d.store_id || '')}', '${esc(d.item_name || '')}')">Remap</button>
        <button class="small danger" onclick="yolinkDisable(${d.id})">${d.active ? 'Disable' : 'Enable'}</button>
        <button class="small danger" onclick="yolinkDelete(${d.id})">Delete</button>
      </td>
    </tr>`;
  }).join('') : emptyRow(6, 'No devices registered');

  const itemOptions = (data.templateItems || []).map(i => `<option value="${esc(i)}">${esc(i)}</option>`).join('');

  return `<section class="section">
    <div class="section-head"><h2>YoLink Devices</h2>
      <div class="row">
        ${credOk
          ? `<span class="badge ok">API READY</span><button class="small" onclick="yolinkTestApi()">Test API</button><button class="small" onclick="yolinkSync()">Sync</button><button class="small" onclick="yolinkPoll()">Poll</button>`
          : `<span class="badge off">API NOT CONFIGURED</span><span class="dim small">Human workflow remains active</span>`}
      </div>
    </div>
    <table style="margin-bottom:12px"><tbody>${credRow}</tbody></table>

    <h3 style="margin-bottom:6px">Add Device</h3>
    <div class="row" style="flex-wrap:wrap;gap:6px;margin-bottom:6px">
      <input id="yolink-device-name" placeholder="Device name" style="flex:1;min-width:120px">
      <input id="yolink-model" placeholder="Model" value="YS8017-UC" style="width:120px">
      <input id="yolink-device-eui" placeholder="Device EUI *" style="width:140px">
      <input id="yolink-serial" placeholder="Serial" style="width:100px">
      <select id="yolink-store-id" style="width:110px"><option value="">Store *</option><option value="stone_oak">Stone Oak</option><option value="bandera">Bandera</option><option value="rim">Rim</option></select>
      <select id="yolink-item-name" style="flex:1;min-width:130px"><option value="">Item/Location *</option>${itemOptions}</select>
      <select id="yolink-sensor-type" style="width:130px"><option value="temperature">Temperature</option><option value="temperature_humidity">Temp/Humidity</option><option value="door">Door</option><option value="other">Other</option></select>
    </div>
    <div class="row" style="margin-bottom:10px;gap:8px">
      <label class="small"><input id="yolink-active" type="checkbox" checked> Active</label>
      <label class="small"><input id="yolink-trust" type="checkbox" checked> Trust</label>
      <button class="primary small" onclick="yolinkAddDevice()">Save Device</button>
      <button class="small" onclick="yolinkSaveAndTest()">Save + Test</button>
      <button class="small" onclick="yolinkClearForm()">Clear</button>
    </div>

    <h3 style="margin-bottom:6px">Devices (${devices.length})</h3>
    <table><thead><tr><th>Device</th><th>Store / Item</th><th>Active</th><th>Reading</th><th>State</th><th>Actions</th></tr></thead>
    <tbody>${deviceRows}</tbody></table>
  </section>`;
}

// ── Utility ─────────────────────────────────────────────────────────────────
function groupThreads(rows) {
  const map = new Map();
  for (const r of rows || []) {
    const key = r.phone || r.name || 'unknown';
    const current = map.get(key) || { phone: key, name: r.name, count: 0, lastTimestamp: '', lastMessage: '', intent: '' };
    current.count += 1;
    if (!current.lastTimestamp || String(r.timestamp || '').localeCompare(current.lastTimestamp) >= 0) {
      current.lastTimestamp = r.timestamp || '';
      current.lastMessage = r.message || '';
      current.intent = r.intent || '';
      current.name = r.name || current.name;
    }
    map.set(key, current);
  }
  return [...map.values()].sort((a, b) => String(b.lastTimestamp || '').localeCompare(String(a.lastTimestamp || '')));
}

function formatThreshold(t) {
  if (!t) return '';
  if (t.min != null && t.max != null) return `${t.min}\u2013${t.max}`;
  if (t.min != null) return `\u2265 ${t.min}`;
  if (t.max != null) return `\u2264 ${t.max}`;
  return '';
}


// ── WhatsApp Group Discovery Panel (Dev #3) ────────────────────────────────
function copyToClipboard(text) {
  if (navigator.clipboard) navigator.clipboard.writeText(text).catch(function() {});
  var el = document.createElement("span");
  el.textContent = "copied!";
  el.style.cssText = "background:#2a2;padding:2px 8px;border-radius:4px;font-size:12px;position:fixed;top:10px;right:10px;z-index:9999;color:#fff";
  document.body.appendChild(el);
  setTimeout(function() { el.remove(); }, 1500);
}

async function mapWhatsAppGroupToStore(chatId, groupName) {
  var storeOpts = ["stone_oak", "bandera", "rim", "test"];
  var storeId = prompt("Map " + groupName + " to which store?\nOptions: " + storeOpts.join(", "));
  if (!storeId) return;
  try {
    var r = await apiNoReload("/api/admin/store-groups", { chat_id: chatId, group_name: groupName, store_id: storeId.trim(), active: true });
    if (r.ok) { alert("Mapped: " + groupName + " -> " + storeId); location.reload(); }
    else alert("Error: " + (r.error || "Unknown"));
  } catch(e) { alert("Request failed: " + e.message); }
}

// ── WhatsApp Group Discovery Panel (Dev #3) ────────────────────────────────
function renderWhatsApp(data) {
  if (!data) return "";
  var groups = data.groups || [];
  var mappings = data.mappings || [];
  var groupRows = groups.map(function(g) {
    var mapped = mappings.find(function(m) { return m.chat_id === g.chat_id; });
    var mappedStore = mapped ? mapped.store_name : null;
    var storeCell = mappedStore
      ? '<span class="badge ok">' + esc(mappedStore) + '</span>'
      : '<button class="small" onclick="mapWhatsAppGroupToStore(\'' + g.chat_id + '\',\'' + esc(g.name || 'Unknown') + '\')">Map to Store</button>';
    return '<tr>'
      + '<td>' + esc(g.name || 'Unknown') + '</td>'
      + '<td><code class="copy-id" style="cursor:pointer" onclick="copyToClipboard(this.textContent)" title="Click to copy">' + esc(g.chat_id || '') + '</code></td>'
      + '<td class="dim">' + (g.participant_count || '?') + '</td>'
      + '<td class="dim">' + esc(g.last_message_at || '—') + '</td>'
      + '<td>' + storeCell + '</td>'
      + '</tr>';
  }).join("");
  return '<section class="section">'
    + '<div class="section-head"><h2>WhatsApp Groups</h2><button class="primary" onclick="refreshWhatsAppGroups()">Refresh Groups</button></div>'
    + '<table><thead><tr><th>Group Name</th><th>Group ID</th><th>Members</th><th>Last Activity</th><th>Mapped Store</th></tr></thead>'
    + '<tbody>' + (groupRows || emptyRow(5, 'No groups found. Connect WhatsApp first.')) + '</tbody></table>'
    + '</section>';
}

function copyToClipboard(text) {
  if (navigator.clipboard) navigator.clipboard.writeText(text).catch(function() {});
  var el = document.createElement("span");
  el.textContent = "copied!";
  el.style.cssText = "background:#2a2;padding:2px 8px;border-radius:4px;font-size:12px;position:fixed;top:10px;right:10px;z-index:9999;color:#fff";
  document.body.appendChild(el);
  setTimeout(function() { el.remove(); }, 1500);
}

async function mapWhatsAppGroupToStore(chatId, groupName) {
  var storeOpts = ['stone_oak', 'bandera', 'rim', 'test'];
  var storeId = prompt('Map ' + groupName + ' to which store?\nOptions: ' + storeOpts.join(', '));
  if (!storeId) return;
  try {
    var r = await apiNoReload('/api/admin/store-groups', { chat_id: chatId, group_name: groupName, store_id: storeId.trim(), active: true });
    if (r.ok) { alert('Mapped: ' + groupName + ' -> ' + storeId); location.reload(); }
    else alert('Error: ' + (r.error || 'Unknown'));
  } catch(e) { alert("Request failed: " + e.message); }
}

// ── System Updates Panel ──────────────────────────────────────────────────────
function renderSystemUpdates() {
  return `<section class="section" id="system-updates-section">
  <div class="section-head">
    <h2>System Updates</h2>
    <div class="row">
      <button class="small" onclick="checkForUpdates()">Check for Updates</button>
    </div>
  </div>
  <div id="update-status-area" class="dim" style="margin-bottom:10px">Loading...</div>
  <div id="update-action-area"></div>
  <div id="update-log-area" style="margin-top:12px"></div>
  <script>
    (function() {
      function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
      async function loadUpdateStatus() {
        var area = document.getElementById('update-status-area');
        var actionArea = document.getElementById('update-action-area');
        try {
          var r = await fetch('/api/updates/status');
          var d = await r.json();
          if (!d.ok && d.error) {
            area.innerHTML = '<span class="badge warn">Update check: ' + esc(d.error) + '</span>';
            return;
          }
          var cur = d.current || {};
          var man = d.manifest || {};
          var rows = '<table><tbody>'
            + '<tr><td><b>Current Version</b></td><td>' + esc(cur.version||'-') + '</td></tr>'
            + '<tr><td><b>Current Build</b></td><td>' + esc(cur.build||'-') + '</td></tr>'
            + '<tr><td><b>Channel</b></td><td>' + esc(cur.channel||'stable') + '</td></tr>'
            + '<tr><td><b>Release Date</b></td><td>' + esc(cur.releaseDate||'-') + '</td></tr>';
          if (man.latestVersion) {
            rows += '<tr><td><b>Latest Version</b></td><td>' + esc(man.latestVersion) + '</td></tr>';
            rows += '<tr><td><b>Latest Build</b></td><td>' + esc(man.build||'-') + '</td></tr>';
            var status = d.updateAvailable
              ? '<span class="badge warn">Update Available</span>'
              : '<span class="badge ok">Up To Date</span>';
            rows += '<tr><td><b>Status</b></td><td>' + status + '</td></tr>';
            if (man.fileSize) rows += '<tr><td><b>Download Size</b></td><td>' + esc(Math.round(man.fileSize/1048576) + ' MB') + '</td></tr>';
          } else if (d.ok) {
            rows += '<tr><td><b>Status</b></td><td><span class="badge ok">Up To Date</span></td></tr>';
          }
          if (d.checkedAt) rows += '<tr><td><b>Last Checked</b></td><td>' + esc(new Date(d.checkedAt).toLocaleString()) + '</td></tr>';
          rows += '</tbody></table>';
          area.innerHTML = rows;
          if (d.updateAvailable && man.releaseNotes && man.releaseNotes.length) {
            var notes = '<div style="margin-top:8px"><b>Release Notes:</b><ul style="margin:6px 0 0 18px">'
              + man.releaseNotes.map(function(n){return '<li>'+esc(n)+'</li>';}).join('')
              + '</ul></div>';
            area.innerHTML += notes;
          }
          if (d.updateAvailable) {
            actionArea.innerHTML = '<div style="margin-top:10px" class="row">'
              + '<button class="primary" onclick="launchUpdater()">Install Update</button>'
              + '<button class="small danger" onclick="rollbackUpdate()">Rollback Last Update</button>'
              + '</div>';
          } else {
            actionArea.innerHTML = '';
          }
        } catch(e) {
          area.innerHTML = '<span class="badge bad">Status unavailable: ' + esc(e.message) + '</span>';
        }
      }
      window.checkForUpdates = async function() {
        var area = document.getElementById('update-status-area');
        area.innerHTML = '<span class="dim">Checking...</span>';
        try {
          await fetch('/api/updates/check', { method: 'POST' });
          await loadUpdateStatus();
        } catch(e) { area.innerHTML = '<span class="badge bad">Check failed: ' + esc(e.message) + '</span>'; }
      };
      window.launchUpdater = function() {
        if (!confirm('This will download and install the update. The app will restart automatically. Continue?')) return;
        runUpdaterStream('/api/updates/install', 'Installing update...');
      };
      window.rollbackUpdate = function() {
        if (!confirm('Roll back to the previous version? The app will restart.')) return;
        runUpdaterStream('/api/updates/rollback', 'Rolling back to previous version...');
      };
      function runUpdaterStream(endpoint, label) {
        var actionArea = document.getElementById('update-action-area');
        var logArea = document.getElementById('update-log-area');
        actionArea.innerHTML = '<div class="badge warn" style="margin-bottom:8px">' + esc(label) + '</div>';
        logArea.innerHTML = '<div id="updater-stream" style="background:#111;color:#aaffaa;font-family:monospace;font-size:11px;padding:10px;max-height:260px;overflow-y:auto;border-radius:4px;white-space:pre-wrap"></div>';
        var box = document.getElementById('updater-stream');
        function append(text, isErr) {
          var span = document.createElement('span');
          span.style.color = isErr ? '#ff8888' : '#aaffaa';
          span.textContent = text + '\n';
          box.appendChild(span);
          box.scrollTop = box.scrollHeight;
        }
        append('> ' + label);
        fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
          .then(function(res) {
            var reader = res.body.getReader();
            var dec = new TextDecoder();
            var buf = '';
            function pump() {
              return reader.read().then(function(d) {
                if (d.done) {
                  append('> Stream closed. If the app restarted, refresh this page in 30 seconds.');
                  actionArea.innerHTML = '<button class="small" onclick="location.reload()">Refresh Dashboard</button>';
                  return;
                }
                buf += dec.decode(d.value, { stream: true });
                var parts = buf.split('\n\n');
                buf = parts.pop();
                parts.forEach(function(p) {
                  var line = p.replace(/^data: ?/, '').trim();
                  if (!line) return;
                  try {
                    var obj = JSON.parse(line);
                    if (obj.type === 'log')   append(obj.line, false);
                    if (obj.type === 'error') append(obj.line, true);
                    if (obj.type === 'done') {
                      append(obj.ok ? '> Done! Update successful.' : '> Done (exit ' + obj.exitCode + '). Check logs above.', !obj.ok);
                      actionArea.innerHTML = '<button class="small" onclick="location.reload()">Refresh Dashboard</button>';
                    }
                  } catch (_) { append(line, false); }
                });
                return pump();
              });
            }
            return pump();
          })
          .catch(function(e) { append('> Error: ' + e.message, true); });
      };
      async function loadUpdateLog() {
        var logArea = document.getElementById('update-log-area');
        try {
          var r = await fetch('/api/updates/log');
          var entries = await r.json();
          if (!entries.length) { logArea.innerHTML = ''; return; }
          var rows = entries.slice(-10).reverse().map(function(e){
            return '<tr><td class="dim">' + esc(new Date(e.ts).toLocaleString()) + '</td>'
              + '<td>' + esc(e.action||'') + '</td>'
              + '<td>' + esc(e.from||'-') + ' → ' + esc(e.to||'-') + '</td>'
              + '<td><span class="badge ' + (e.status==='ok'?'ok':'bad') + '">' + esc(e.status||'') + '</span></td>'
              + '<td class="dim">' + esc(e.note||'') + '</td></tr>';
          }).join('');
          logArea.innerHTML = '<details style="margin-top:8px"><summary class="dim" style="cursor:pointer">Update History (last 10)</summary>'
            + '<table><thead><tr><th>Time</th><th>Action</th><th>Version</th><th>Status</th><th>Note</th></tr></thead><tbody>'
            + rows + '</tbody></table></details>';
        } catch(_) {}
      }
      // Auto-check on page load (silent — no spinner shown)
      (async function() {
        try { await fetch('/api/updates/check', { method: 'POST' }); } catch(_) {}
        await loadUpdateStatus();
        await loadUpdateLog();
      })();

      // Re-check every 4 hours while dashboard is open
      setInterval(async function() {
        try { await fetch('/api/updates/check', { method: 'POST' }); } catch(_) {}
        await loadUpdateStatus();
      }, 4 * 60 * 60 * 1000);
    })();
  </script>
</section>`;
}

module.exports = { renderDashboard };
