/**
 * History Panel for Dashboard (CEO Directive — Dashboard History Section)
 * Shows audit logs with filtering and export capability.
 */
function buildHistoryPanelHtml(data) {
  const logs = data?.logs || [];
  const stats = data?.stats || {};
  const submitted = data?.submittedToday || [];
  const missing = data?.missingToday || [];

  const storeNames = { stone_oak: 'Stone Oak', bandera: 'Bandera', rim: 'Rim' };

  const totalBadge = stats.total > 0
    ? `<span class="badge" style="background:#22c55e;font-size:.7rem">${stats.total}</span>`
    : `<span class="badge" style="background:#475569;font-size:.7rem">0</span>`;

  const passRate = stats.total > 0 ? Math.round((stats.pass / stats.total) * 100) : 0;
  const warningRate = stats.total > 0 ? Math.round((stats.warning / stats.total) * 100) : 0;

  const logRows = logs.length
    ? logs.map(log => {
      const time = fmtTime(log.confirmed_at || log.created_at);
      const alertIcon = log.manager_alert_status === 'SENT' ? '⚠️'
        : log.sheet_write_status === 'SENT' ? '✅' : '⏳';
      const alertColor = log.manager_alert_status === 'SENT' ? '#ef4444'
        : log.sheet_write_status === 'SENT' ? '#22c55e' : '#475569';
      return `<tr>
        <td class="dim">${time}</td>
        <td>${esc(log.store_name || log.store_id || '—')}</td>
        <td>${esc(log.employee_name || log.employee_id || '—')}</td>
        <td>${esc(log.workflow_type || 'Daily Entry')}</td>
        <td><span class="badge" style="background:${alertColor};font-size:.6rem">${alertIcon} ${log.sheet_write_status || '?'}</span></td>
        <td><span class="badge" style="background:${log.manager_alert_status === 'SENT' ? '#ef4444' : '#475569'};font-size:.6rem">${log.manager_alert_status || '?'}</span></td>
        <td>
          <button class="ctrl-btn" style="padding:2px 8px;font-size:.65rem" onclick="showHistoryDetail(${log.id})">📋</button>
          ${log.edits_json && log.edits_json !== '[]' ? '<span class="chip" style="background:#4338ca;font-size:.58rem">EDIT</span>' : ''}
        </td>
      </tr>`;
    }).join('')
    : `<tr><td colspan="7" style="text-align:center;color:#475569;padding:24px">
        No audit logs yet. Complete a daily entry to see logs here.
       </td></tr>`;

  const missingRows = missing.length
    ? missing.map(m => `<tr>
        <td>${esc(storeNames[m.store_id] || m.store_id)}</td>
        <td><span class="badge" style="background:#ef4444;font-size:.6rem">NOT SUBMITTED</span></td>
        <td class="dim">—</td>
        <td class="dim">—</td>
        <td class="dim">—</td>
      </tr>`).join('')
    : `<tr><td colspan="5" style="text-align:center;color:#22c55e;padding:8px">All stores submitted today ✅</td></tr>`;

  return `
  <div class="fs-section" style="border-color:#059669">
    <div class="section-head">
      <h2>📋 History &amp; Audit Logs</h2>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <span class="chip" style="background:#1e293b;color:#64748b">${totalBadge} Total</span>
        <span class="chip" style="background:#22c55e22;color:#22c55e">${passRate}% PASS</span>
        <span class="chip" style="background:#ef444422;color:#ef4444">${warningRate}% WARNING</span>
        <button class="ctrl-btn" style="padding:4px 10px;font-size:.7rem" onclick="refreshHistoryPanel()">🔄 Refresh</button>
        <button class="ctrl-btn" style="padding:4px 10px;font-size:.7rem" onclick="exportHistoryCsv()">📥 CSV Export</button>
      </div>
    </div>

    <!-- Filters -->
    <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
      <label style="font-size:.7rem;color:#64748b">Store:</label>
      <select id="hist-store" style="background:#1e293b;color:#e2e8f0;border:1px solid #334155;padding:4px 6px;font-size:.7rem;border-radius:4px">
        <option value="">All stores</option>
        <option value="stone_oak">Stone Oak</option>
        <option value="bandera">Bandera</option>
        <option value="rim">Rim</option>
      </select>
      <label style="font-size:.7rem;color:#64748b">Status:</label>
      <select id="hist-status" style="background:#1e293b;color:#e2e8f0;border:1px solid #334155;padding:4px 6px;font-size:.7rem;border-radius:4px">
        <option value="">All</option>
        <option value="PASS">✅ PASS</option>
        <option value="WARNING">⚠️ WARNING</option>
        <option value="QUEUED">⏳ QUEUED</option>
      </select>
      <label style="font-size:.7rem;color:#64748b">Date:</label>
      <input type="date" id="hist-date" style="background:#1e293b;color:#e2e8f0;border:1px solid #334155;padding:4px 6px;font-size:.7rem;border-radius:4px" value="${todayStr()}">
      <button class="ctrl-btn" style="padding:4px 10px;font-size:.7rem" onclick="applyHistoryFilters()">Filter</button>
    </div>

    <div class="tabs" style="margin-bottom:10px">
      <button class="tab-btn active" data-tab="hist-logs" onclick="switchTab('hist-logs')">📋 Logs (${logs.length})</button>
      <button class="tab-btn" data-tab="hist-missing" onclick="switchTab('hist-missing')">❌ Missing Today (${missing.length})</button>
      <button class="tab-btn" data-tab="hist-stats" onclick="switchTab('hist-stats')">📊 Stats</button>
    </div>

    <div id="tab-hist-logs" class="tab-content active">
      <table>
        <thead><tr><th>Time</th><th>Store</th><th>Employee</th><th>Workflow</th><th>Sheet</th><th>Alert</th><th></th></tr></thead>
        <tbody>${logRows}</tbody>
      </table>
    </div>

    <div id="tab-hist-missing" class="tab-content">
      <table>
        <thead><tr><th>Store</th><th>Status</th><th>Last Submit</th><th>Employee</th><th>Workflow</th></tr></thead>
        <tbody>
          ${submitted.map(s => `<tr>
            <td>${esc(storeNames[s.store_id] || s.store_id)}</td>
            <td><span class="badge" style="background:#22c55e;font-size:.6rem">SUBMITTED</span></td>
            <td class="dim">${fmtTime(s.last_confirmed)}</td>
            <td class="dim">—</td>
            <td class="dim">—</td>
          </tr>`).join('')}
          ${missingRows}
        </tbody>
      </table>
    </div>

    <div id="tab-hist-stats" class="tab-content">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:14px">
        <div class="fs-stat-card">
          <div class="fs-stat-num">${stats.total || 0}</div>
          <div class="fs-stat-label">Total Logs</div>
        </div>
        <div class="fs-stat-card">
          <div class="fs-stat-num" style="color:#22c55e">${stats.pass || 0}</div>
          <div class="fs-stat-label">PASS</div>
        </div>
        <div class="fs-stat-card">
          <div class="fs-stat-num" style="color:#ef4444">${stats.warning || 0}</div>
          <div class="fs-stat-label">WARNING</div>
        </div>
        <div class="fs-stat-card">
          <div class="fs-stat-num" style="color:#f59e0b">${stats.queued || 0}</div>
          <div class="fs-stat-label">QUEUED</div>
        </div>
        <div class="fs-stat-card">
          <div class="fs-stat-num" style="color:#ef4444">${stats.missingToday || 0}</div>
          <div class="fs-stat-label">Missed Today</div>
        </div>
        <div class="fs-stat-card">
          <div class="fs-stat-num" style="color:#94a3b8;font-size:.9rem">${stats.lastLogAt ? fmtTime(stats.lastLogAt) : '—'}</div>
          <div class="fs-stat-label">Last Log</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Detail Modal -->
  <div id="history-detail-modal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.7);z-index:9999;align-items:center;justify-content:center" onclick="if(event.target===this)closeHistoryDetail()">
    <div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:24px;max-width:560px;width:90%;max-height:80vh;overflow-y:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h3 style="margin:0;font-size:.9rem;color:#e2e8f0">Log Detail</h3>
        <button onclick="closeHistoryDetail()" style="background:none;border:none;color:#64748b;font-size:1.2rem;cursor:pointer">✕</button>
      </div>
      <div id="history-detail-content" style="color:#94a3b8;font-size:.8rem;line-height:1.7"></div>
    </div>
  </div>

  <script>
  function showHistoryDetail(id) {
    fetch('/api/history/logs/' + id)
      .then(r => r.json())
      .then(d => {
        const log = d.log;
        if (!log) { alert('Log not found'); return; }
        let html = '';
        html += '<div style="margin-bottom:12px"><strong style="color:#e2e8f0">Store:</strong> ' + esc(log.store_name || log.store_id) + '</div>';
        html += '<div style="margin-bottom:12px"><strong style="color:#e2e8f0">Employee:</strong> ' + esc(log.employee_name || log.employee_id) + '</div>';
        html += '<div style="margin-bottom:12px"><strong style="color:#e2e8f0">Time:</strong> ' + esc(log.confirmed_at || log.created_at) + '</div>';
        html += '<div style="margin-bottom:12px"><strong style="color:#e2e8f0">Workflow:</strong> ' + esc(log.workflow_type) + '</div>';
        html += '<div style="margin-bottom:12px"><strong style="color:#e2e8f0">Sheet:</strong> ' + esc(log.sheet_write_status) + '</div>';
        html += '<div style="margin-bottom:12px"><strong style="color:#e2e8f0">Manager Alert:</strong> ' + esc(log.manager_alert_status) + '</div>';
        if (log.validation_result_json) {
          try {
            const vr = JSON.parse(log.validation_result_json);
            if (vr.failures && vr.failures.length) {
              html += '<div style="margin:12px 0;color:#ef4444;font-weight:600">Warnings:</div>';
              vr.failures.forEach(f => {
                html += '<div style="margin-left:12px;margin-bottom:4px">• ' + esc(f.name || f.item) + ': ' + f.value + ' | Target ' + (f.target || '?') + '</div>';
              });
            }
          } catch(e) {}
        }
        if (log.edits && log.edits.length) {
          html += '<div style="margin:12px 0;color:#4338ca;font-weight:600">Edits:</div>';
          log.edits.forEach(e => {
            html += '<div style="margin-left:12px;margin-bottom:4px">• ' + esc(e.item_name) + ': ' + esc(e.old_value) + ' → ' + esc(e.new_value) + ' (by ' + esc(e.edited_by) + ')</div>';
          });
        }
        document.getElementById('history-detail-content').innerHTML = html;
        document.getElementById('history-detail-modal').style.display = 'flex';
      });
  }
  function closeHistoryDetail() {
    document.getElementById('history-detail-modal').style.display = 'none';
  }
  function applyHistoryFilters() {
    const store = document.getElementById('hist-store').value;
    const status = document.getElementById('hist-status').value;
    const date = document.getElementById('hist-date').value;
    let url = '/api/history/logs?limit=50';
    if (store) url += '&store_id=' + store;
    if (status) url += '&status=' + status;
    if (date) { url += '&start_date=' + date + '&end_date=' + date; }
    fetch(url).then(r => r.json()).then(d => updateHistoryTable(d.logs || []));
  }
  function exportHistoryCsv() {
    window.open('/api/history/export.csv?limit=1000', '_blank');
  }
  function refreshHistoryPanel() { location.reload(); }
  function updateHistoryTable(logs) {
    // Re-render table — simple replace
    const tbody = document.querySelector('#tab-hist-logs table tbody');
    if (!tbody) return;
    if (!logs.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#475569;padding:24px">No logs found.</td></tr>';
      return;
    }
    tbody.innerHTML = logs.map(log => {
      const t = new Date(log.confirmed_at || log.created_at).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:true});
      const alertColor = log.manager_alert_status === 'SENT' ? '#ef4444' : log.sheet_write_status === 'SENT' ? '#22c55e' : '#475569';
      const alertIcon = log.manager_alert_status === 'SENT' ? '⚠️' : log.sheet_write_status === 'SENT' ? '✅' : '⏳';
      return '<tr><td class="dim">' + t + '</td><td>' + esc(log.store_name||log.store_id) + '</td><td>' + esc(log.employee_name||log.employee_id) + '</td><td>' + esc(log.workflow_type||'Daily Entry') + '</td><td><span class="badge" style="background:'+alertColor+';font-size:.6rem">'+alertIcon+' '+(log.sheet_write_status||'?')+'</span></td><td><span class="badge" style="background:'+(log.manager_alert_status==='SENT'?'#ef4444':'#475569')+';font-size:.6rem">'+(log.manager_alert_status||'?')+'</span></td><td><button class="ctrl-btn" style="padding:2px 8px;font-size:.65rem" onclick="showHistoryDetail('+log.id+')">📋</button></td></tr>';
    }).join('');
  }
  </script>`;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function fmtTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return String(ts);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

module.exports = { buildHistoryPanelHtml };