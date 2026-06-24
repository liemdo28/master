'use strict';
/**
 * transport-panels.js
 * Admin UI panels for WhatsApp transport layer:
 *   - Session Status (extended — heartbeat, backoff)
 *   - Clients & API Keys
 *   - Routing Status & Validation
 *   - Traffic (recent routed messages)
 *   - Audit Logs
 *
 * All panels are server-rendered HTML strings, consistent with admin-ui.js style.
 */

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function badge(label, cls) {
  return `<span class="badge ${cls}">${esc(label)}</span>`;
}
function statusBadge(val) {
  if (!val) return badge('UNKNOWN', 'off');
  const v = String(val).toUpperCase();
  if (v === 'READY' || v === 'CONNECTED' || v === 'ACTIVE' || v === 'OK' || v === 'TRUE') return badge(v, 'ok');
  if (v === 'AUTH_REQUIRED' || v === 'QR' || v === 'WARN' || v === 'PENDING') return badge(v, 'warn');
  if (v === 'DISCONNECTED' || v === 'AUTH_FAILURE' || v === 'REVOKED' || v === 'FALSE' || v === 'FAIL') return badge(v, 'bad');
  return badge(v, 'off');
}

// ── 1. Session Status Panel ──────────────────────────────────────────────────

function renderSessionPanel(session) {
  if (!session) return '';
  const state = session.state || session.status || 'unknown';
  const cs    = session.connection_status || state;
  const hbOk  = session.heartbeat_active === true;
  const ar    = session.auto_reconnect !== false;

  return `
<section class="section" id="transport-session">
  <div class="section-head">
    <h2>WhatsApp Session</h2>
    <span class="dim">Transport layer — hardened</span>
  </div>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr));margin-bottom:12px">
    <div class="card"><h3>Connection</h3><div class="val" style="font-size:14px">${statusBadge(cs)}</div></div>
    <div class="card"><h3>Heartbeat</h3><div class="val" style="font-size:14px">${badge(hbOk ? 'ACTIVE' : 'INACTIVE', hbOk ? 'ok' : 'warn')}</div><div class="dim">${hbOk ? (session.heartbeat_interval_ms||60000)/1000+'s interval' : 'starts on ready'}</div></div>
    <div class="card"><h3>Auto-Reconnect</h3><div class="val" style="font-size:14px">${badge(ar ? 'ON' : 'OFF', ar ? 'ok' : 'warn')}</div><div class="dim">Backoff: exponential (15→30→60→120s)</div></div>
    <div class="card"><h3>Reconnect Attempts</h3><div class="val">${esc(session.reconnect_count ?? 0)}</div><div class="dim">Next delay: ${((session.next_reconnect_delay_ms||15000)/1000).toFixed(0)}s</div></div>
    <div class="card"><h3>Session Age</h3><div class="val" style="font-size:14px">${formatAge(session.session_age_seconds)}</div><div class="dim">${esc(session.session_started_at || '')}</div></div>
    <div class="card"><h3>Account</h3><div class="val" style="font-size:13px;word-break:break-all">${esc(session.account_name || session.phone_number || '—')}</div><div class="dim">${esc(session.phone_number || '')}</div></div>
  </div>
  <div class="dim" style="margin-bottom:8px">
    Session root: <code>${esc(session.session_root || '')}</code> &nbsp;|&nbsp;
    Restart count: ${esc(session.restart_count ?? 0)} &nbsp;|&nbsp;
    Stored session: ${badge(session.has_stored_session ? 'YES' : 'NO', session.has_stored_session ? 'ok' : 'warn')}
  </div>
  <div class="row">
    <button onclick="whatsappAction('connect')">Connect</button>
    <button onclick="whatsappAction('reconnect')">Reconnect</button>
    <button onclick="whatsappAction('restart')">Restart</button>
    <button class="danger" onclick="if(confirm('Reset session? QR scan required.'))whatsappAction('reset-session')">Reset Session</button>
  </div>
</section>`;
}

function formatAge(seconds) {
  if (seconds === null || seconds === undefined) return '—';
  if (seconds < 60) return seconds + 's';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm';
  return Math.floor(seconds / 3600) + 'h ' + Math.floor((seconds % 3600) / 60) + 'm';
}

// ── 2. Clients & API Keys Panel ──────────────────────────────────────────────

function renderClientsPanel(clientsData) {
  if (!clientsData) return '';
  const clients = clientsData.clients || [];
  const required = clientsData.required || {};

  const rows = clients.map(c => {
    const envOk = c.client_id === 'agent-coding' ? required['agent-coding']?.env_key_configured
                : c.client_id === 'mi-core'       ? required['mi-core']?.env_key_configured
                : false;
    return `<tr>
      <td><strong>${esc(c.client_id)}</strong><br><span class="dim">${esc(c.description||'')}</span></td>
      <td>${statusBadge(c.status)}</td>
      <td><code>${esc(c.key_prefix||'')}***</code></td>
      <td>${esc(c.allowed_commands||'')}</td>
      <td>${badge(envOk ? 'SET' : 'MISSING', envOk ? 'ok' : 'warn')}</td>
      <td class="dim">${esc(c.last_used_at ? new Date(c.last_used_at).toLocaleString() : 'never')}</td>
      <td>
        <button onclick="rotateKey('${esc(c.client_id)}')">Rotate</button>
        <button class="danger" onclick="if(confirm('Revoke ${esc(c.client_id)}?'))apiPost('/api/clients/${esc(c.client_id)}/revoke',{})">Revoke</button>
      </td>
    </tr>`;
  }).join('');

  return `
<section class="section" id="transport-clients">
  <div class="section-head">
    <h2>Clients &amp; API Keys</h2>
    <span class="dim">${clients.length} registered</span>
  </div>
  <table>
    <thead><tr><th>Client</th><th>Status</th><th>Key Prefix</th><th>Commands</th><th>Env Key</th><th>Last Used</th><th>Actions</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="7" class="dim">No clients registered</td></tr>'}</tbody>
  </table>
  <div class="row" style="margin-top:12px">
    <button onclick="document.getElementById('new-client-form').style.display='block'">+ New Client</button>
    <a class="btn" href="/api/audit/api-keys" target="_blank">View Key Audit Log</a>
  </div>
  <div id="new-client-form" style="display:none;margin-top:12px;background:#0f172a;border:1px solid #334155;border-radius:6px;padding:12px">
    <h3 style="margin-bottom:10px">Create Client</h3>
    <div class="row">
      <input id="nc-id" placeholder="client_id" style="width:140px">
      <input id="nc-cmds" placeholder="/agent,/mi" style="width:120px">
      <input id="nc-desc" placeholder="description" style="width:200px">
      <button onclick="createClient()">Create</button>
      <button onclick="document.getElementById('new-client-form').style.display='none'">Cancel</button>
    </div>
    <div id="nc-result" class="dim" style="margin-top:8px"></div>
  </div>
  <script>
  (function(){
    async function rotateKey(clientId) {
      if (!confirm('Rotate key for ' + clientId + '? Update the matching service env var before restarting.')) return;
      const r = await fetch('/api/clients/' + clientId + '/rotate', { method: 'POST' });
      const d = await r.json();
      if (d.ok) {
        alert('New key (save this — shown once):\\n' + d.raw_key_once + '\\n\\nPrefix: ' + d.key_prefix);
      } else { alert('Error: ' + (d.error || JSON.stringify(d))); }
    }
    window.rotateKey = rotateKey;

    async function createClient() {
      const clientId = document.getElementById('nc-id').value.trim();
      const cmds     = document.getElementById('nc-cmds').value.trim() || '/agent,/mi';
      const desc     = document.getElementById('nc-desc').value.trim();
      if (!clientId) { alert('client_id required'); return; }
      const r = await fetch('/api/clients', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ client_id: clientId, allowed_commands: cmds, description: desc }) });
      const d = await r.json();
      const out = document.getElementById('nc-result');
      if (d.ok) {
        out.innerHTML = '<strong>Created!</strong> Raw key (save now): <code>' + (d.raw_key_once||'') + '</code>';
      } else { out.textContent = 'Error: ' + (d.error || JSON.stringify(d)); }
    }
    window.createClient = createClient;
  })();
  </script>
</section>`;
}

// ── 3. Routing Status Panel ───────────────────────────────────────────────────

function renderRoutingPanel(routerData, validationData) {
  const r   = routerData   || {};
  const v   = validationData || {};
  const vChecks = v.checks || [];
  const agentEndpoint = r.endpoints?.agent_coding || {};
  const miEndpoint    = r.endpoints?.mi_core || {};

  const checkRows = vChecks.map(c => `<tr>
    <td>${badge(c.pass ? 'PASS' : 'FAIL', c.pass ? 'ok' : 'bad')}</td>
    <td>${esc(c.name)}</td>
    <td class="dim">${esc(c.detail)}</td>
  </tr>`).join('');

  return `
<section class="section" id="transport-routing">
  <div class="section-head">
    <h2>Routing Status</h2>
    <span class="dim">
      ${v.ok !== undefined ? badge(v.ok ? 'ALL PASS' : 'FAIL', v.ok ? 'ok' : 'bad') : badge('NOT RUN', 'off')}
      &nbsp;${v.summary ? v.summary.pass+'/'+v.summary.total+' checks' : ''}
    </span>
  </div>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));margin-bottom:12px">
    <div class="card">
      <h3>/agent → Agent-Coding</h3>
      <div class="val" style="font-size:13px">${statusBadge(agentEndpoint.reachable ? 'OK' : 'UNREACHABLE')}</div>
      <div class="dim">${esc(r.env?.agent_coding_url?.value || process.env.AGENT_CODING_URL || 'localhost:3100')}</div>
      <div class="dim">Key: ${badge(r.env?.agent_coding_api_key?.configured ? 'SET' : 'MISSING', r.env?.agent_coding_api_key?.configured ? 'ok' : 'warn')}</div>
    </div>
    <div class="card">
      <h3>/mi → Mi-Core</h3>
      <div class="val" style="font-size:13px">${statusBadge(miEndpoint.reachable ? 'OK' : 'UNREACHABLE')}</div>
      <div class="dim">${esc(r.env?.mi_core_url?.value || process.env.MI_CORE_URL || 'localhost:4001')}</div>
      <div class="dim">Key: ${badge(r.env?.mi_core_api_key?.configured ? 'SET' : 'MISSING', r.env?.mi_core_api_key?.configured ? 'ok' : 'warn')}</div>
    </div>
    <div class="card">
      <h3>Food Safety</h3>
      <div class="val" style="font-size:13px">${badge('INTERNAL', 'ok')}</div>
      <div class="dim">Unprefix photos → store OCR pipeline</div>
    </div>
  </div>
  ${vChecks.length ? `
  <details>
    <summary class="dim" style="cursor:pointer">Routing Isolation Checks (${v.summary?.pass||0}/${v.summary?.total||0} pass)</summary>
    <table style="margin-top:8px">
      <thead><tr><th>Result</th><th>Check</th><th>Detail</th></tr></thead>
      <tbody>${checkRows}</tbody>
    </table>
  </details>` : ''}
  <div class="row" style="margin-top:10px">
    <button onclick="runRouterValidation()">Run Validation</button>
    <button onclick="location.href='/api/router/status'">View Router Status JSON</button>
  </div>
  <div id="validation-result" class="dim" style="margin-top:8px"></div>
  <script>
  (function(){
    async function runRouterValidation() {
      document.getElementById('validation-result').textContent = 'Running...';
      const r = await fetch('/api/router/validate');
      const d = await r.json();
      const el = document.getElementById('validation-result');
      if (d.ok) el.innerHTML = '<span style="color:#4ade80">All ' + d.summary.total + ' checks passed.</span>';
      else el.innerHTML = '<span style="color:#f87171">' + d.summary.fail + '/' + d.summary.total + ' checks failed. See JSON: </span>'
        + '<pre style="font-size:11px;overflow:auto;max-height:200px">' + JSON.stringify(d.checks.filter(c=>!c.pass), null, 2) + '</pre>';
    }
    window.runRouterValidation = runRouterValidation;
  })();
  </script>
</section>`;
}

// ── 4. Traffic Panel ─────────────────────────────────────────────────────────

function renderTrafficPanel(messagesData) {
  const routed = (messagesData?.routed_messages || []).slice(0, 20);

  const rows = routed.map(m => {
    const ok = m.success === 1 || m.success === true;
    return `<tr>
      <td class="dim" style="white-space:nowrap">${esc(new Date(m.timestamp||'').toLocaleTimeString())}</td>
      <td>${badge(ok ? 'OK' : 'FAIL', ok ? 'ok' : 'bad')}</td>
      <td><code>${esc(m.command_prefix||'')}</code></td>
      <td>${esc(m.target_project||'')}</td>
      <td class="dim">${esc(m.source_chat?.replace('@g.us','@g')||'')}</td>
      <td class="dim">${esc(m.approval_status||'none')}</td>
      <td class="dim" style="white-space:nowrap">${esc(m.duration_ms||0)}ms</td>
    </tr>`;
  }).join('');

  return `
<section class="section" id="transport-traffic">
  <div class="section-head">
    <h2>Routing Traffic</h2>
    <span class="dim">Last ${routed.length} routed messages</span>
  </div>
  <table>
    <thead><tr><th>Time</th><th>Status</th><th>Cmd</th><th>Target</th><th>Source</th><th>Approval</th><th>Latency</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="7" class="dim">No routed messages yet</td></tr>'}</tbody>
  </table>
  <div class="row" style="margin-top:8px">
    <a class="btn" href="/api/audit/messages" target="_blank">Full Traffic Log JSON</a>
  </div>
</section>`;
}

// ── 5. Audit Logs Panel ───────────────────────────────────────────────────────

function renderAuditPanel(messagesData) {
  const audit = (messagesData?.api_key_audit || []).slice(0, 20);

  const rows = audit.map(a => {
    const ok = a.success === 1 || a.success === true;
    return `<tr>
      <td class="dim" style="white-space:nowrap">${esc(new Date(a.timestamp||'').toLocaleString())}</td>
      <td>${badge(ok ? 'OK' : 'FAIL', ok ? 'ok' : 'bad')}</td>
      <td>${esc(a.client_id||'')}</td>
      <td>${esc(a.action||'')}</td>
      <td class="dim">${esc(a.detail||'')}</td>
    </tr>`;
  }).join('');

  return `
<section class="section" id="transport-audit">
  <div class="section-head">
    <h2>API Key Audit Log</h2>
    <span class="dim">Last ${audit.length} events</span>
  </div>
  <table>
    <thead><tr><th>Time</th><th>Result</th><th>Client</th><th>Action</th><th>Detail</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="5" class="dim">No audit events yet</td></tr>'}</tbody>
  </table>
  <div class="row" style="margin-top:8px">
    <a class="btn" href="/api/audit/api-keys" target="_blank">Full API Key Audit JSON</a>
    <a class="btn" href="/api/audit/logs" target="_blank">All Audit Logs JSON</a>
  </div>
</section>`;
}

// ── Composite renderer ────────────────────────────────────────────────────────

async function renderTransportPanels({ session, clients, router, validation, messages } = {}) {
  return [
    renderSessionPanel(session),
    renderClientsPanel(clients),
    renderRoutingPanel(router, validation),
    renderTrafficPanel(messages),
    renderAuditPanel(messages),
  ].join('\n');
}

module.exports = {
  renderTransportPanels,
  renderSessionPanel,
  renderClientsPanel,
  renderRoutingPanel,
  renderTrafficPanel,
  renderAuditPanel,
};
