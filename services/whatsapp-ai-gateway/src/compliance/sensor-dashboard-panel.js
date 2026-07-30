/**
 * Sensor Dashboard Panel (Phase 1.2D)
 * Builds the Sensor Monitoring HTML section for the admin dashboard.
 */
function buildSensorPanelHtml(sensorData) {
  const status = sensorData?.status || {};
  const readings = sensorData?.readings || [];
  const alerts = sensorData?.alerts || [];
  const crossVal = sensorData?.crossVal || {};
  const trustData = sensorData?.trust || {};

  if (!status.configured) {
    return `
    <div class="fs-section" style="border-color:#475569">
      <div class="section-head">
        <h2>🌡 Sensor Monitoring</h2>
        <span class="badge" style="background:#6b7280">NOT CONFIGURED</span>
      </div>
      <div class="fs-warning-box" style="background:#1e293b;border-color:#334155;color:#64748b">
        YoLink is not configured. Human workflow remains active.<br>
        To enable: set <code>YOLINK_ENABLED=true</code>, <code>YOLINK_CLIENT_ID</code>, and <code>YOLINK_CLIENT_SECRET</code> in .env
      </div>
    </div>`;
  }

  const enabledBadge = status.enabled
    ? `<span class="badge" style="background:#22c55e">ENABLED</span>`
    : `<span class="badge" style="background:#6b7280">DISABLED</span>`;
  const pollingBadge = status.polling
    ? `<span class="badge" style="background:#22c55e;font-size:.6rem">POLLING</span>`
    : `<span class="badge" style="background:#475569;font-size:.6rem">STOPPED</span>`;
  const pollingInterval = status.intervalSeconds || 300;
  const lastPoll = status.lastPollAt ? fmtTime(status.lastPollAt) : 'Never';
  const pollCount = status.pollCount || 0;

  const sensorRows = readings.length
    ? readings.map(r => {
      const statusColor = r.status === 'PASS' ? '#22c55e'
                       : r.status === 'FAIL_HIGH' || r.status === 'FAIL_LOW' ? '#ef4444'
                       : r.status === 'STALE' ? '#f59e0b'
                       : r.status === 'OFFLINE' ? '#ef4444'
                       : '#475569';
      const batteryColor = r.battery >= 75 ? '#22c55e' : r.battery >= 25 ? '#f59e0b' : '#ef4444';
      const onlineColor = r.online ? '#22c55e' : '#ef4444';
      return `<tr>
        <td>${esc(r.sensor_id || r.device_name || '—')}</td>
        <td>${esc(r.item_name || r.location_name || '—')}</td>
        <td>${esc(r.store_name || '—')}</td>
        <td style="font-weight:700">${r.value != null ? `${r.value}°F` : '—'}</td>
        <td><span class="badge" style="background:${statusColor};font-size:.6rem">${esc(r.status || 'OFFLINE')}</span></td>
        <td><span style="color:${onlineColor};font-size:.78rem">${r.online ? '🟢 Online' : '🔴 Offline'}</span></td>
        <td class="dim">${r.last_seen ? fmtTime(r.last_seen) : '—'}</td>
        <td style="color:${batteryColor}">${r.battery != null ? `${r.battery}%` : '—'}</td>
        <td><span class="badge" style="background:#4338ca;font-size:.6rem">YoLink</span></td>
        <td>
          <button class="ctrl-btn" style="padding:3px 8px;font-size:.65rem" onclick="apiPost('/api/sensors/force-poll',{})">Force Poll</button>
        </td>
      </tr>`;
    }).join('')
    : `<tr><td colspan="10" style="text-align:center;color:#475569;padding:20px">
        No sensor readings yet. Click "Sync Devices" to discover YoLink sensors.
       </td></tr>`;

  const alertRows = alerts.length
    ? alerts.map(a => {
      const alertColor = a.alert_type === 'FAIL_HIGH' ? '#ef4444' : '#f59e0b';
      return `<tr>
        <td>${esc(a.sensor_id || '—')}</td>
        <td>${esc(a.store_name || '—')}</td>
        <td>${esc(a.item_name || '—')}</td>
        <td>${a.reading_value != null ? `${a.reading_value}°F` : '—'}</td>
        <td><span class="badge" style="background:${alertColor};font-size:.6rem">${esc(a.alert_type || '—')}</span></td>
        <td>${a.duration_minutes || 0}m</td>
        <td>${a.store_alert_sent ? '<span class="badge" style="background:#22c55e;font-size:.58rem">Store</span>' : ''} ${a.manager_alert_sent ? '<span class="badge" style="background:#ef4444;font-size:.58rem">Manager</span>' : ''}</td>
        <td class="dim">${fmtTime(a.created_at)}</td>
      </tr>`;
    }).join('')
    : `<tr><td colspan="8" style="text-align:center;color:#475569;padding:12px">No active sensor alerts</td></tr>`;

  // Cross-validation section
  const cvStats = crossVal?.stats || {};
  const cvRows = (crossVal?.recent || []).slice(0, 10).map(r => {
    const c = r.status === 'MATCH' ? '#22c55e' : r.status === 'MISMATCH' ? '#ef4444' : '#475569';
    return `<tr>
      <td>${esc(r.employee_id || '—')}</td>
      <td>${esc(r.store_id || '—')}</td>
      <td>${esc(r.item_name || '—')}</td>
      <td>${r.human_value != null ? `${r.human_value}°F` : '—'}</td>
      <td>${r.sensor_value != null ? `${r.sensor_value}°F` : '—'}</td>
      <td>${r.difference_human_sensor != null ? `${r.difference_human_sensor}°F` : '—'}</td>
      <td><span class="badge" style="background:${c};font-size:.6rem">${esc(r.status || '—')}</span></td>
      <td class="dim">${fmtTime(r.created_at)}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="8" style="text-align:center;color:#475569;padding:12px">No cross-validation results yet</td></tr>`;

  // Trust scores section
  const topEmployees = trustData?.topEmployees || [];
  const storeScores = trustData?.storeScores || [];
  const employeeRows = topEmployees.length
    ? topEmployees.map(e => {
      const sc = e.score >= 80 ? '#22c55e' : e.score >= 50 ? '#f59e0b' : '#ef4444';
      return `<tr>
        <td>${esc(e.employee_name || e.employee_id || '—')}</td>
        <td>${esc(e.store_id || '—')}</td>
        <td><span style="color:${sc};font-weight:700">${e.score}</span></td>
        <td class="dim">${e.total_matches || 0}</td>
        <td class="dim">${e.total_mismatches || 0}</td>
        <td class="dim">${e.total_submissions || 0}</td>
        <td class="dim">${fmtTime(e.last_updated)}</td>
      </tr>`;
    }).join('')
    : `<tr><td colspan="7" style="text-align:center;color:#475569;padding:12px">No employee trust scores yet</td></tr>`;

  const storeRow = storeScores.length
    ? storeScores.map(s => {
      const sc = s.score >= 80 ? '#22c55e' : s.score >= 50 ? '#f59e0b' : '#ef4444';
      return `<tr>
        <td>${esc(s.store_name || s.store_id || '—')}</td>
        <td><span style="color:${sc};font-weight:700">${s.score}</span></td>
        <td>${s.match_rate != null ? Math.round(s.match_rate * 100) + '%' : '—'}</td>
        <td>${s.mismatch_count || 0}</td>
        <td>${s.missed_logs || 0}</td>
        <td class="dim">${fmtTime(s.last_updated)}</td>
      </tr>`;
    }).join('')
    : `<tr><td colspan="6" style="text-align:center;color:#475569;padding:12px">No store compliance scores yet</td></tr>`;

  return `
  <div class="fs-section" style="border-color:#4338ca">
    <div class="section-head">
      <h2>🌡 Sensor Monitoring</h2>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        ${enabledBadge}
        ${pollingBadge}
        <span class="chip" style="background:#1e293b;color:#64748b">Poll every ${pollingInterval}s</span>
        <button class="ctrl-btn" style="padding:4px 10px;font-size:.7rem" onclick="apiPost('/api/sensors/sync',{})">🔄 Sync Devices</button>
        <button class="ctrl-btn" style="padding:4px 10px;font-size:.7rem" onclick="apiPost('/api/sensors/test',{})">🧪 Test Connection</button>
        <button class="ctrl-btn" style="padding:4px 10px;font-size:.7rem" onclick="apiPost('/api/sensors/force-poll',{})">⚡ Force Poll</button>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;margin-bottom:14px">
      <div class="fs-stat-card">
        <div class="fs-stat-num">${readings.length}</div>
        <div class="fs-stat-label">Sensors</div>
      </div>
      <div class="fs-stat-card">
        <div class="fs-stat-num" style="color:${(alerts.length) > 0 ? '#ef4444' : '#22c55e'}">${alerts.length}</div>
        <div class="fs-stat-label">Active Alerts</div>
      </div>
      <div class="fs-stat-card">
        <div class="fs-stat-num" style="color:#a5b4fc">${cvStats.matchRate || 0}%</div>
        <div class="fs-stat-label">Match Rate</div>
      </div>
      <div class="fs-stat-card">
        <div class="fs-stat-num" style="color:#94a3b8">${pollCount}</div>
        <div class="fs-stat-label">Total Polls</div>
      </div>
      <div class="fs-stat-card">
        <div class="fs-stat-num" style="color:#94a3b8;font-size:.9rem">${lastPoll.slice(0, 16)}</div>
        <div class="fs-stat-label">Last Poll</div>
      </div>
    </div>

    <div class="tabs" style="margin-bottom:10px">
      <button class="tab-btn active" data-tab="sensor-readings" onclick="switchTab('sensor-readings')">📊 Readings</button>
      <button class="tab-btn" data-tab="sensor-alerts" onclick="switchTab('sensor-alerts')">⚠️ Alerts (${alerts.length})</button>
      <button class="tab-btn" data-tab="cross-val" onclick="switchTab('cross-val')">🔄 Cross-Validation (${cvStats.total || 0})</button>
      <button class="tab-btn" data-tab="trust-scores" onclick="switchTab('trust-scores')">⭐ Trust Scores</button>
    </div>

    <div id="tab-sensor-readings" class="tab-content active">
      <table>
        <thead><tr><th>Sensor ID</th><th>Item</th><th>Store</th><th>Reading</th><th>Status</th><th>Online</th><th>Last Seen</th><th>Battery</th><th>Source</th><th></th></tr></thead>
        <tbody>${sensorRows}</tbody>
      </table>
    </div>

    <div id="tab-sensor-alerts" class="tab-content">
      <table>
        <thead><tr><th>Sensor ID</th><th>Store</th><th>Item</th><th>Reading</th><th>Alert Type</th><th>Duration</th><th>Alerts Sent</th><th>Time</th></tr></thead>
        <tbody>${alertRows}</tbody>
      </table>
    </div>

    <div id="tab-cross-val" class="tab-content">
      <table>
        <thead><tr><th>Employee</th><th>Store</th><th>Item</th><th>Human</th><th>Sensor</th><th>Diff</th><th>Status</th><th>Time</th></tr></thead>
        <tbody>${cvRows}</tbody>
      </table>
    </div>

    <div id="tab-trust-scores" class="tab-content">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div>
          <h3 style="font-size:.72rem;color:#94a3b8;margin-bottom:8px;text-transform:uppercase">👤 Employee Trust Scores</h3>
          <table>
            <thead><tr><th>Employee</th><th>Store</th><th>Score</th><th>Matches</th><th>Mismatches</th><th>Submissions</th><th>Updated</th></tr></thead>
            <tbody>${employeeRows}</tbody>
          </table>
        </div>
        <div>
          <h3 style="font-size:.72rem;color:#94a3b8;margin-bottom:8px;text-transform:uppercase">🏪 Store Compliance</h3>
          <table>
            <thead><tr><th>Store</th><th>Score</th><th>Match Rate</th><th>Mismatches</th><th>Missed Logs</th><th>Updated</th></tr></thead>
            <tbody>${storeRow}</tbody>
          </table>
        </div>
      </div>
    </div>

    <div style="margin-top:10px;font-size:.72rem;color:#475569">
      Cross-validation: ${cvStats.match || 0} match / ${cvStats.mismatch || 0} mismatch / ${cvStats.noSensor || 0} no sensor
      &nbsp;|&nbsp; Match rate: <span style="color:#a5b4fc">${cvStats.matchRate || 0}%</span>
    </div>
  </div>`;
}

function fmtTime(ts) {
  return ts ? String(ts).slice(0, 19).replace('T', ' ') : '—';
}

module.exports = { buildSensorPanelHtml };