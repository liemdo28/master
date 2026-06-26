/**
 * Admin — API Key Management Dashboard
 * Served at GET /admin/keys
 * Full CRUD for provider API keys with encryption, test-before-save, audit log.
 */

export function adminKeysDashboardHtml(): string {
  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n' +
    '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">\n' +
    '<title>API Key Management — Antigravity Admin</title>\n' +
    '<style>\n' + CSS + '\n</style>\n</head>\n' +
    '<body>\n' + BODY + '\n<script>\n' + JS + '\n</script>\n</body>\n</html>';
}

// ══════════════════════════ CSS ══════════════════════════════════════════════
const CSS = `
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --bg:#070c18;--surface:rgba(6,16,40,0.85);--surface2:rgba(0,8,24,0.6);
  --border:rgba(40,130,255,0.12);--border-hi:rgba(40,130,255,0.3);
  --text:#b8cce8;--text-dim:#3c5572;--text-bright:#deeeff;
  --accent:#00b8ff;--green:#00f090;--yellow:#ffc800;--red:#ff3860;--orange:#ff8c00;
}
html,body{min-height:100%;background:var(--bg);color:var(--text);font-family:'Courier New',monospace;font-size:13px}
body{background-image:radial-gradient(ellipse at 15% 15%,rgba(0,60,140,.25) 0%,transparent 55%)}

/* Header */
.hdr{display:flex;align-items:center;justify-content:space-between;padding:12px 24px;
  border-bottom:1px solid var(--border);background:rgba(0,6,20,0.9);position:sticky;top:0;z-index:100}
.hdr h1{font-size:12px;letter-spacing:5px;color:var(--accent);font-weight:400;text-transform:uppercase}
.hdr-links{display:flex;gap:12px;font-size:10px}
.hdr-links a{color:var(--text-dim);text-decoration:none;letter-spacing:1px}
.hdr-links a:hover{color:var(--accent)}

/* Layout */
.main{max-width:1300px;margin:0 auto;padding:20px 24px;display:flex;flex-direction:column;gap:16px}

/* Cards */
.card{background:var(--surface);border:1px solid var(--border);border-radius:6px;overflow:hidden}
.card-hd{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;
  border-bottom:1px solid var(--border);background:rgba(0,4,16,.5)}
.card-title{font-size:9px;letter-spacing:3px;text-transform:uppercase;color:var(--accent)}
.card-sub{font-size:9px;color:var(--text-dim);letter-spacing:1px}

/* Provider summary pills */
.prov-grid{display:flex;flex-wrap:wrap;gap:10px;padding:14px 16px}
.prov-card{display:flex;flex-direction:column;gap:5px;padding:12px 16px;
  border:1px solid var(--border);border-radius:5px;min-width:160px;background:var(--surface2)}
.prov-name{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--text-bright)}
.prov-stats{font-size:9px;color:var(--text-dim);display:flex;flex-direction:column;gap:2px}
.prov-ok{color:var(--green)}
.prov-bad{color:var(--red)}

/* Table */
.tbl{width:100%;border-collapse:collapse;font-size:11px}
.tbl th{text-align:left;padding:7px 14px;color:var(--text-dim);font-size:9px;
  letter-spacing:2px;text-transform:uppercase;border-bottom:1px solid var(--border);font-weight:400}
.tbl td{padding:10px 14px;border-bottom:1px solid rgba(40,130,255,.05);vertical-align:middle}
.tbl tr:last-child td{border-bottom:none}
.tbl tbody tr:hover td{background:rgba(40,130,255,.03)}
.tbl-empty{padding:20px;text-align:center;color:var(--text-dim);font-size:10px}

/* Status badges */
.badge{font-size:8px;padding:2px 8px;border-radius:10px;letter-spacing:1.5px;text-transform:uppercase}
.s-healthy{background:rgba(0,240,144,.1);color:var(--green);border:1px solid rgba(0,240,144,.3)}
.s-pending{background:rgba(0,184,255,.08);color:var(--accent);border:1px solid rgba(0,184,255,.2)}
.s-disabled{background:rgba(80,80,80,.12);color:var(--text-dim);border:1px solid rgba(80,80,80,.2)}
.s-expired{background:rgba(255,56,96,.1);color:var(--red);border:1px solid rgba(255,56,96,.3)}
.s-auth_failed{background:rgba(255,56,96,.15);color:var(--red);border:1px solid rgba(255,56,96,.4)}
.s-rate_limited{background:rgba(255,200,0,.1);color:var(--yellow);border:1px solid rgba(255,200,0,.3)}
.s-other{background:rgba(255,140,0,.1);color:var(--orange);border:1px solid rgba(255,140,0,.3)}

/* Buttons */
.btn{font-family:'Courier New',monospace;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;
  padding:5px 12px;border-radius:3px;border:1px solid;cursor:pointer;transition:all .15s ease}
.btn:disabled{opacity:.4;cursor:default}
.btn-primary{background:rgba(0,184,255,.1);border-color:rgba(0,184,255,.3);color:var(--accent)}
.btn-primary:hover:not(:disabled){background:rgba(0,184,255,.22);border-color:rgba(0,184,255,.6)}
.btn-green{background:rgba(0,240,144,.08);border-color:rgba(0,240,144,.3);color:var(--green)}
.btn-green:hover:not(:disabled){background:rgba(0,240,144,.18)}
.btn-red{background:rgba(255,56,96,.08);border-color:rgba(255,56,96,.3);color:var(--red)}
.btn-red:hover:not(:disabled){background:rgba(255,56,96,.18)}
.btn-sm{font-size:8px;padding:3px 8px;letter-spacing:1px}

/* Masked key mono */
.mono{font-family:'Courier New',monospace;font-size:10px;color:var(--text-dim);letter-spacing:1px}

/* Modal overlay */
.overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:500;
  align-items:center;justify-content:center}
.overlay.open{display:flex}
.modal{background:rgba(4,12,32,.97);border:1px solid var(--border-hi);border-radius:8px;
  padding:0;width:540px;max-width:95vw;max-height:90vh;overflow-y:auto;
  box-shadow:0 0 40px rgba(0,100,255,.15)}
.modal-hd{display:flex;align-items:center;justify-content:space-between;
  padding:14px 20px;border-bottom:1px solid var(--border);position:sticky;top:0;
  background:rgba(4,12,32,.98)}
.modal-title{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:var(--accent)}
.modal-close{background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:16px;padding:4px 8px}
.modal-close:hover{color:var(--text)}
.modal-body{padding:20px}
.modal-footer{padding:14px 20px;border-top:1px solid var(--border);display:flex;gap:8px;justify-content:flex-end}

/* Form */
.form-row{display:flex;flex-direction:column;gap:5px;margin-bottom:14px}
.form-label{font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:var(--text-dim)}
.form-input{background:rgba(0,8,24,.7);border:1px solid var(--border);border-radius:3px;
  color:var(--text-bright);font-family:'Courier New',monospace;font-size:12px;
  padding:8px 10px;width:100%;outline:none}
.form-input:focus{border-color:var(--accent);box-shadow:0 0 0 2px rgba(0,184,255,.1)}
.form-select{background:rgba(0,8,24,.8);border:1px solid var(--border);border-radius:3px;
  color:var(--text-bright);font-family:'Courier New',monospace;font-size:12px;
  padding:7px 10px;width:100%;outline:none;cursor:pointer}
.form-row-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.form-hint{font-size:9px;color:var(--text-dim);margin-top:2px}

/* Test result */
.test-result{margin-top:8px;padding:8px 12px;border-radius:3px;font-size:10px;display:none}
.test-ok{background:rgba(0,240,144,.1);border:1px solid rgba(0,240,144,.3);color:var(--green)}
.test-fail{background:rgba(255,56,96,.1);border:1px solid rgba(255,56,96,.3);color:var(--red)}

/* Toast */
.toast{position:fixed;bottom:24px;right:24px;padding:10px 16px;border-radius:4px;
  font-size:11px;letter-spacing:.5px;z-index:999;animation:fadeIn .2s ease;
  border:1px solid;max-width:340px}
.toast-ok{background:rgba(0,240,144,.15);border-color:rgba(0,240,144,.4);color:var(--green)}
.toast-err{background:rgba(255,56,96,.15);border-color:rgba(255,56,96,.4);color:var(--red)}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}

/* Audit log */
.audit-list{max-height:240px;overflow-y:auto;display:flex;flex-direction:column}
.audit-row{display:flex;gap:12px;padding:7px 14px;border-bottom:1px solid rgba(40,130,255,.04);font-size:10px}
.audit-ts{color:var(--text-dim);white-space:nowrap;min-width:76px}
.audit-actor{color:var(--accent);min-width:72px}
.audit-action{color:var(--text)}
.audit-detail{color:var(--text-dim);font-size:9px}
`;

// ══════════════════════════ HTML BODY ════════════════════════════════════════
const BODY = `
<div class="hdr">
  <h1>⚙ API Key Management</h1>
  <div class="hdr-links">
    <a href="/runtime">Runtime OPS</a>
    <a href="/">Dashboard</a>
  </div>
</div>

<div class="main">

  <!-- Provider Summary -->
  <div class="card">
    <div class="card-hd">
      <span class="card-title">Providers</span>
      <span class="card-sub" id="prov-ts">—</span>
    </div>
    <div class="prov-grid" id="prov-grid">
      <div style="color:var(--text-dim);font-size:10px;padding:8px">Loading…</div>
    </div>
  </div>

  <!-- Key Table -->
  <div class="card">
    <div class="card-hd">
      <span class="card-title">API Keys</span>
      <button class="btn btn-primary" onclick="openAddModal()">+ Add Key</button>
    </div>
    <table class="tbl" id="key-tbl">
      <thead><tr>
        <th>Provider</th><th>Key Name</th><th>Masked Key</th><th>Status</th>
        <th>Quota</th><th>Last Success</th><th>Expires</th><th>Actions</th>
      </tr></thead>
      <tbody id="key-tbody"><tr><td colspan="8" class="tbl-empty">Loading…</td></tr></tbody>
    </table>
  </div>

  <!-- Audit Log -->
  <div class="card">
    <div class="card-hd">
      <span class="card-title">Audit Log</span>
      <button class="btn btn-sm btn-primary" onclick="loadAudit()">↻ Refresh</button>
    </div>
    <div class="audit-list" id="audit-list">
      <div style="color:var(--text-dim);font-size:10px;padding:12px">Loading…</div>
    </div>
  </div>

</div>

<!-- Add / Edit Modal -->
<div class="overlay" id="modal-overlay">
  <div class="modal">
    <div class="modal-hd">
      <span class="modal-title" id="modal-title">Add API Key</span>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <input type="hidden" id="edit-id" value="">

      <div class="form-row">
        <label class="form-label">Provider *</label>
        <select class="form-select" id="f-provider">
          <option value="antigravity">Antigravity (NKQ)</option>
          <option value="opusmax">OpusMax</option>
          <option value="anthropic">Anthropic Direct</option>
          <option value="openrouter">OpenRouter</option>
          <option value="openai">OpenAI</option>
        </select>
      </div>

      <div class="form-row">
        <label class="form-label">Key Name *</label>
        <input class="form-input" id="f-name" placeholder="e.g. Production Key A" autocomplete="off">
      </div>

      <div class="form-row">
        <label class="form-label">API Key *</label>
        <input class="form-input" id="f-value" type="password" placeholder="Paste API key here" autocomplete="new-password">
        <span class="form-hint">Stored encrypted (AES-256-GCM). Never shown again after save.</span>
      </div>

      <div class="form-row-2">
        <div class="form-row" style="margin:0">
          <label class="form-label">Priority (lower = first)</label>
          <input class="form-input" id="f-priority" type="number" value="10" min="1" max="100">
        </div>
        <div class="form-row" style="margin:0">
          <label class="form-label">Weight</label>
          <input class="form-input" id="f-weight" type="number" value="1" min="1" max="10">
        </div>
      </div>

      <div class="form-row-2">
        <div class="form-row" style="margin:0">
          <label class="form-label">Quota Limit (blank = unlimited)</label>
          <input class="form-input" id="f-quota" type="number" placeholder="e.g. 1000">
        </div>
        <div class="form-row" style="margin:0">
          <label class="form-label">Expires At (UTC date)</label>
          <input class="form-input" id="f-expires" type="date">
        </div>
      </div>

      <div class="form-row">
        <label class="form-label" style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" id="f-enabled" checked style="width:14px;height:14px">
          Enabled immediately after save
        </label>
      </div>

      <!-- Test Key -->
      <div style="margin-top:8px">
        <button class="btn btn-primary" id="btn-test" onclick="testKey()">⚡ Test Key</button>
        <div class="test-result" id="test-result"></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn" onclick="closeModal()" style="border-color:var(--border);color:var(--text-dim)">Cancel</button>
      <button class="btn btn-green" id="btn-save" onclick="saveKey()" disabled>Save Key</button>
    </div>
  </div>
</div>
`;

// ══════════════════════════ JAVASCRIPT ═══════════════════════════════════════
const JS = `
var editingId = null;
var testPassed = false;

function get(id) { return document.getElementById(id); }
function setText(id, v) { var e=get(id); if(e) e.textContent=v; }
function setHtml(id, v) { var e=get(id); if(e) e.innerHTML=v; }

var _bkkFmt = new Intl.DateTimeFormat('en-GB',{
  timeZone:'Asia/Bangkok', hour12:false,
  day:'2-digit', month:'2-digit', year:'numeric',
  hour:'2-digit', minute:'2-digit'
});
function fmtTs(ms) { return ms ? _bkkFmt.format(new Date(ms)) : '—'; }
function fmtDate(ms) {
  if (!ms) return '—';
  var d = new Date(ms);
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function toast(msg, isErr) {
  var el = document.createElement('div');
  el.className = 'toast ' + (isErr ? 'toast-err' : 'toast-ok');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(function() { el.remove(); }, 3500);
}

// ── Data loading ──────────────────────────────────────────────────────────────
function loadAll() { loadProviders(); loadKeys(); loadAudit(); }

function loadProviders() {
  fetch('/api/admin/providers').then(function(r){return r.json();}).then(function(d) {
    setText('prov-ts', 'updated ' + new Date().toLocaleTimeString());
    var provs = d.providers || [];
    if (!provs.length) { setHtml('prov-grid','<div style="color:var(--text-dim);font-size:10px;padding:8px">No providers found</div>'); return; }
    setHtml('prov-grid', provs.map(function(p) {
      return '<div class="prov-card">' +
        '<div class="prov-name">' + p.provider_name + '</div>' +
        '<div class="prov-stats">' +
          '<span>' + p.total + ' keys total</span>' +
          '<span class="prov-ok">' + p.healthy + ' healthy</span>' +
          (p.disabled > 0 ? '<span class="prov-bad">' + p.disabled + ' disabled</span>' : '') +
          (p.expired  > 0 ? '<span class="prov-bad">' + p.expired  + ' expired</span>'  : '') +
        '</div></div>';
    }).join(''));
  }).catch(function(e) { toast('Failed to load providers: ' + e.message, true); });
}

function loadKeys() {
  fetch('/api/admin/keys').then(function(r){return r.json();}).then(function(d) {
    var keys = d.keys || [];
    if (!keys.length) {
      setHtml('key-tbody','<tr><td colspan="8" class="tbl-empty">No API keys found. Click "+ Add Key" to get started.</td></tr>');
      return;
    }
    setHtml('key-tbody', keys.map(function(k) {
      var sc = k.status === 'healthy' ? 's-healthy'
             : k.status === 'pending' ? 's-pending'
             : k.status === 'disabled' ? 's-disabled'
             : k.status === 'expired' ? 's-expired'
             : k.status === 'auth_failed' ? 's-auth_failed'
             : k.status === 'rate_limited' ? 's-rate_limited'
             : 's-other';
      var quota = k.quota_limit ? (k.quota_used + '/' + k.quota_limit) : 'Unlimited';
      var isActive = k.enabled && k.status !== 'disabled' && k.status !== 'expired';
      var rowStyle = k.status === 'expired' || k.status === 'auth_failed'
        ? ' style="opacity:.6;border-left:2px solid var(--red)"' : '';

      return '<tr' + rowStyle + '>' +
        '<td style="font-size:10px;letter-spacing:1px;text-transform:uppercase">' + k.provider_name + '</td>' +
        '<td>' + escHtml(k.key_name) + '</td>' +
        '<td><span class="mono">' + escHtml(k.masked_key) + '</span></td>' +
        '<td><span class="badge ' + sc + '">' + k.status + '</span></td>' +
        '<td>' + quota + '</td>' +
        '<td style="font-size:10px">' + fmtTs(k.last_success_at) + '</td>' +
        '<td style="font-size:10px' + (k.expires_at && k.expires_at < Date.now() ? ';color:var(--red)' : '') + '">' +
          (k.expires_at ? fmtDate(k.expires_at) : '—') + '</td>' +
        '<td style="white-space:nowrap">' +
          '<button class="btn btn-sm btn-primary" onclick="openEditModal(' + k.id + ')">Edit</button> ' +
          (isActive
            ? '<button class="btn btn-sm btn-red" onclick="doKeyAction(' + k.id + ',\'disable\')">Disable</button>'
            : '<button class="btn btn-sm btn-green" onclick="doKeyAction(' + k.id + ',\'enable\')">Enable</button>') +
          ' <button class="btn btn-sm" style="border-color:var(--border);color:var(--red);font-size:8px" onclick="doDelete(' + k.id + ',\'' + escHtml(k.key_name) + '\')">Del</button>' +
        '</td>' +
      '</tr>';
    }).join(''));
  }).catch(function(e) { toast('Failed to load keys: ' + e.message, true); });
}

function loadAudit() {
  fetch('/api/admin/audit?limit=50').then(function(r){return r.json();}).then(function(d) {
    var logs = d.logs || [];
    if (!logs.length) { setHtml('audit-list','<div style="color:var(--text-dim);font-size:10px;padding:12px">No audit events yet</div>'); return; }
    setHtml('audit-list', logs.map(function(l) {
      return '<div class="audit-row">' +
        '<span class="audit-ts">' + fmtTs(l.performed_at) + '</span>' +
        '<span class="audit-actor">' + escHtml(l.performed_by) + '</span>' +
        '<span class="audit-action">' + escHtml(l.action) + '</span>' +
        '<span class="audit-detail">' + (l.detail ? escHtml(l.detail) : '') + '</span>' +
      '</div>';
    }).join(''));
  }).catch(function() {});
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function openAddModal() {
  editingId = null; testPassed = false;
  setText('modal-title', 'Add API Key');
  get('edit-id').value = '';
  get('f-provider').value = 'antigravity';
  get('f-provider').disabled = false;
  get('f-name').value = '';
  get('f-value').value = ''; get('f-value').placeholder = 'Paste API key here'; get('f-value').disabled = false;
  get('f-priority').value = '10'; get('f-weight').value = '1';
  get('f-quota').value = ''; get('f-expires').value = '';
  get('f-enabled').checked = true;
  setHtml('test-result', ''); get('test-result').style.display = 'none';
  get('btn-save').disabled = true;
  get('modal-overlay').classList.add('open');
  setTimeout(function(){ get('f-name').focus(); }, 80);
}

function openEditModal(id) {
  fetch('/api/admin/keys/' + id).then(function(r){return r.json();}).then(function(d) {
    var k = d.key;
    editingId = id; testPassed = true; // allow saving without re-test when editing
    setText('modal-title', 'Edit API Key');
    get('edit-id').value = id;
    get('f-provider').value = k.provider_name; get('f-provider').disabled = true;
    get('f-name').value = k.key_name;
    get('f-value').value = ''; get('f-value').placeholder = 'Leave blank to keep current key'; get('f-value').disabled = false;
    get('f-priority').value = k.priority; get('f-weight').value = k.weight;
    get('f-quota').value = k.quota_limit || '';
    get('f-expires').value = k.expires_at ? fmtDate(k.expires_at) : '';
    get('f-enabled').checked = !!k.enabled;
    setHtml('test-result', ''); get('test-result').style.display = 'none';
    get('btn-save').disabled = false;
    get('modal-overlay').classList.add('open');
  }).catch(function(e) { toast('Failed to load key: ' + e.message, true); });
}

function closeModal() {
  get('modal-overlay').classList.remove('open');
  editingId = null;
}

// ── Test Key ─────────────────────────────────────────────────────────────────
function testKey() {
  var keyVal = get('f-value').value.trim();
  var provider = get('f-provider').value;
  if (!keyVal) { alert('Enter API key to test.'); return; }

  var btn = get('btn-test');
  btn.disabled = true; btn.textContent = 'Testing…';
  testPassed = false;
  get('btn-save').disabled = true;
  setHtml('test-result', ''); get('test-result').style.display = 'none';

  // Save the key temporarily to DB for testing (will be updated/deleted based on result)
  fetch('/api/admin/keys', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      provider_name: provider, key_name: '__test__', api_key: keyVal,
      enabled: false, created_by: 'test'
    })
  })
  .then(function(r){return r.json();})
  .then(function(d) {
    if (!d.ok) { throw new Error(d.error || 'Failed to save test key'); }
    var tempId = d.key.id;
    return fetch('/api/admin/keys/' + tempId + '/test', {method:'POST'})
      .then(function(r){return r.json();})
      .then(function(result) {
        // Delete temp key
        fetch('/api/admin/keys/' + tempId, {method:'DELETE'}).catch(function(){});
        return result;
      });
  })
  .then(function(result) {
    btn.disabled = false; btn.textContent = '⚡ Test Key';
    var el = get('test-result');
    el.style.display = 'block';
    if (result.ok) {
      testPassed = true;
      el.className = 'test-result test-ok';
      el.textContent = '✓ Valid — ' + result.latencyMs + 'ms response';
      get('btn-save').disabled = false;
    } else {
      testPassed = false;
      el.className = 'test-result test-fail';
      el.textContent = '✗ Invalid: ' + (result.error || 'Unknown error');
      get('btn-save').disabled = true;
    }
  })
  .catch(function(e) {
    btn.disabled = false; btn.textContent = '⚡ Test Key';
    var el = get('test-result');
    el.style.display = 'block';
    el.className = 'test-result test-fail';
    el.textContent = '✗ Test error: ' + e.message;
    get('btn-save').disabled = true;
  });
}

// ── Save ──────────────────────────────────────────────────────────────────────
function saveKey() {
  var provider = get('f-provider').value;
  var name = get('f-name').value.trim();
  var keyVal = get('f-value').value.trim();
  if (!name) { toast('Key name required', true); return; }
  if (!editingId && !keyVal) { toast('API key required', true); return; }

  var expiresInput = get('f-expires').value;
  var expiresAt = expiresInput ? new Date(expiresInput + 'T23:59:59Z').getTime() : null;
  var quotaInput = get('f-quota').value;
  var quota = quotaInput ? parseInt(quotaInput, 10) : null;

  var btn = get('btn-save'); btn.disabled = true; btn.textContent = 'Saving…';

  var body = {
    provider_name: provider, key_name: name,
    enabled: get('f-enabled').checked,
    weight: parseInt(get('f-weight').value, 10),
    priority: parseInt(get('f-priority').value, 10),
    quota_limit: quota, expires_at: expiresAt
  };
  if (keyVal) body.api_key = keyVal;

  var url = editingId ? '/api/admin/keys/' + editingId : '/api/admin/keys';
  var method = editingId ? 'PUT' : 'POST';

  fetch(url, { method: method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) })
    .then(function(r){ return r.json(); })
    .then(function(d) {
      btn.disabled = false; btn.textContent = 'Save Key';
      if (d.ok) {
        toast(editingId ? 'Key updated.' : 'Key added successfully.', false);
        closeModal(); loadAll();
      } else {
        toast('Save failed: ' + (d.error || 'Unknown error'), true);
      }
    })
    .catch(function(e) {
      btn.disabled = false; btn.textContent = 'Save Key';
      toast('Error: ' + e.message, true);
    });
}

// ── Actions ───────────────────────────────────────────────────────────────────
function doKeyAction(id, action) {
  fetch('/api/admin/keys/' + id + '/' + action, {method:'POST'})
    .then(function(r){return r.json();})
    .then(function(d) {
      if (d.ok) { toast(action + ' OK', false); loadAll(); }
      else { toast(action + ' failed', true); }
    }).catch(function(e) { toast('Error: ' + e.message, true); });
}

function doDelete(id, name) {
  if (!confirm('Delete key "' + name + '"?\\n\\nThis is a soft delete — key will be archived in audit history.')) return;
  fetch('/api/admin/keys/' + id, {method:'DELETE'})
    .then(function(r){return r.json();})
    .then(function(d) {
      if (d.ok) { toast('Key deleted (archived)', false); loadAll(); }
      else { toast('Delete failed', true); }
    }).catch(function(e) { toast('Error: ' + e.message, true); });
}

// ── Utils ─────────────────────────────────────────────────────────────────────
function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Close modal on backdrop click
get('modal-overlay').addEventListener('click', function(e) {
  if (e.target === get('modal-overlay')) closeModal();
});

// Enable save button when form changes (for edit mode)
['f-name','f-value','f-priority','f-weight','f-quota','f-expires'].forEach(function(id) {
  var el = get(id);
  if (el) el.addEventListener('input', function() {
    if (editingId) get('btn-save').disabled = false;
  });
});

// Initial load + auto-refresh every 15s
loadAll();
setInterval(loadAll, 15000);
`;
