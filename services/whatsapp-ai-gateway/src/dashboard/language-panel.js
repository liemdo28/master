/**
 * Language Panel (Phase 1.5)
 *
 * Renders an HTML fragment for the Admin Control Center — Languages tab.
 * Loaded client-side via /api/admin/languages/panel-html and inserted by the
 * dashboard's existing panel container.
 *
 * This file does NOT modify the existing dashboard render — it only emits
 * a self-contained HTML/JS fragment that the dashboard can inject.
 */

const STORES = ['stone_oak', 'bandera', 'rim', 'test'];
const STORE_NAMES = { stone_oak: 'Stone Oak', bandera: 'Bandera', rim: 'Rim', test: 'Test' };
const SUPPORTED = ['en', 'es', 'vi', 'fr'];
const SUPPORTED_LABELS = { en: 'English', es: 'Español', vi: 'Tiếng Việt', fr: 'Français' };

function renderLanguagePanel({ userCount, recentUsers, storeLanguages, lastDetected, supported }) {
  const supportedList = supported || SUPPORTED;
  const supportedBadges = supportedList.map(l =>
    `<span class="lang-badge" data-lang="${l}">${SUPPORTED_LABELS[l] || l}</span>`
  ).join(' ');

  const storesHtml = (storeLanguages || []).map(s => {
    const sec = (s.secondary_languages || []).join(', ') || '—';
    return `<tr>
      <td>${STORE_NAMES[s.store_id] || s.store_id}</td>
      <td>${(s.default_language || 'en').toUpperCase()}</td>
      <td>${sec}</td>
      <td>${s.updated_at || '—'}</td>
    </tr>`;
  }).join('');

  const storesFormHtml = STORES.map(id =>
    `<tr>
      <td>${STORE_NAMES[id]}</td>
      <td><select data-store-default="${id}">
        <option value="en">English</option>
        <option value="es">Español</option>
        <option value="vi">Tiếng Việt</option>
        <option value="fr">Français</option>
      </select></td>
      <td><input data-store-secondary="${id}" placeholder="es, vi" /></td>
      <td><button class="lang-save-store" data-store-id="${id}">Save</button></td>
    </tr>`
  ).join('');

  const recentUsersHtml = (recentUsers || []).slice(0, 10).map(u =>
    `<tr>
      <td>${u.display_name || '—'}</td>
      <td>${u.wa_id}</td>
      <td>${(u.language || 'en').toUpperCase()}</td>
      <td>${(u.confidence || 0).toFixed(2)}</td>
      <td>${u.source || '—'}</td>
      <td>${u.updated_at || '—'}</td>
      <td><button class="lang-reset-user" data-wa-id="${u.wa_id}">Reset</button></td>
    </tr>`
  ).join('');

  return [
    '<div id="lang-panel" class="card">',
    '  <h2>🌍 Languages (Phase 1.5)</h2>',
    '  <p>Multi-language support: EN / ES / VI / FR. Staff-facing replies use the user\'s chosen language. Manager alerts are always in English and include the staff language + original input.</p>',
    `  <div class="badges">${supportedBadges}</div>`,
    '  <hr/>',
    '  <h3>Status</h3>',
    '  <ul>',
    `    <li>Supported languages: <strong>${supportedList.join(', ').toUpperCase()}</strong></li>`,
    `    <li>User language memory count: <strong>${userCount || 0}</strong></li>`,
    `    <li>Last detected: <strong>${lastDetected ? (lastDetected.language || 'en').toUpperCase() + ' (' + (lastDetected.source || '—') + ', conf ' + (lastDetected.confidence || 0).toFixed(2) + ')' : '—'}</strong></li>`,
    '  </ul>',
    '  <hr/>',
    '  <h3>Store default languages</h3>',
    '  <p>Per-store default language applied when user has no memory. Per directive: Stone Oak = en (secondary es); Bandera = es (secondary en); Rim = en (secondary vi).</p>',
    '  <table class="lang-table">',
    '    <thead><tr><th>Store</th><th>Default</th><th>Secondary</th><th>Updated</th></tr></thead>',
    `    <tbody>${storesHtml || '<tr><td colspan="4">No store preferences set yet. Fill in the form below.</td></tr>'}</tbody>`,
    '  </table>',
    '  <h4>Set / update store preferences</h4>',
    '  <table class="lang-table">',
    '    <thead><tr><th>Store</th><th>Default</th><th>Secondary (csv)</th><th>Save</th></tr></thead>',
    `    <tbody>${storesFormHtml}</tbody>`,
    '  </table>',
    '  <hr/>',
    '  <h3>User language memory</h3>',
    '  <p>Languages stored per WhatsApp ID. Click "Reset" to clear. Operators can also set a user\'s language via API.</p>',
    '  <table class="lang-table">',
    '    <thead><tr><th>Name</th><th>wa_id</th><th>Lang</th><th>Conf</th><th>Source</th><th>Updated</th><th>Action</th></tr></thead>',
    `    <tbody>${recentUsersHtml || '<tr><td colspan="7">No users yet.</td></tr>'}</tbody>`,
    '  </table>',
    '  <hr/>',
    '  <h3>Test translation</h3>',
    '  <p>Type a message to see detected language + confidence.</p>',
    '  <input id="lang-test-input" placeholder="bonjour / hola / xin chào / hello" style="width:60%"/>',
    '  <button id="lang-test-run">Detect</button>',
    '  <pre id="lang-test-result" style="background:#222;color:#0f0;padding:8px;border-radius:4px;min-height:40px;margin-top:8px"></pre>',
    '</div>',
    '<style>',
    '#lang-panel { padding: 16px; border: 1px solid #444; border-radius: 8px; background: #1d1d1d; color: #eee; }',
    '#lang-panel h2 { margin-top: 0; }',
    '#lang-panel .badges { display: flex; gap: 6px; flex-wrap: wrap; }',
    '#lang-panel .lang-badge { background:#0a3;color:#fff;padding:3px 8px;border-radius:4px;font-size:12px; }',
    '#lang-panel .lang-table { width: 100%; border-collapse: collapse; margin: 8px 0; }',
    '#lang-panel .lang-table th, #lang-panel .lang-table td { padding: 6px 8px; border-bottom: 1px solid #333; text-align: left; }',
    '#lang-panel .lang-table input, #lang-panel .lang-table select { background: #222; color: #eee; border: 1px solid #555; padding: 3px 6px; }',
    '#lang-panel button { background: #06c; color: #fff; border: 0; padding: 4px 10px; border-radius: 4px; cursor: pointer; }',
    '#lang-panel button:hover { background: #08f; }',
    '</style>',
    '<script>',
    '(function() {',
    '  function postJSON(url, body) {',
    '    return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(function(r){ return r.json(); });',
    '  }',
    '  document.querySelectorAll(".lang-save-store").forEach(function(btn) {',
    '    btn.addEventListener("click", function() {',
    '      var storeId = btn.getAttribute("data-store-id");',
    '      var def = document.querySelector("[data-store-default=\\"" + storeId + "\\"]").value;',
    '      var sec = (document.querySelector("[data-store-secondary=\\"" + storeId + "\\"]").value || "").split(",").map(function(s){ return s.trim(); }).filter(Boolean);',
    '      postJSON("/api/admin/languages/stores/" + storeId, { defaultLanguage: def, secondaryLanguages: sec })',
    '        .then(function(r){ alert(r.ok ? "Saved." : "Error: " + (r.error || "Unknown")); if (r.ok) location.reload(); });',
    '    });',
    '  });',
    '  document.querySelectorAll(".lang-reset-user").forEach(function(btn) {',
    '    btn.addEventListener("click", function() {',
    '      var wa = btn.getAttribute("data-wa-id");',
    '      if (!confirm("Reset language for " + wa + "?")) return;',
    '      postJSON("/api/admin/languages/users/" + wa + "/reset", {}).then(function(r){',
    '        alert(r.ok ? "Reset." : "Error"); if (r.ok) location.reload();',
    '      });',
    '    });',
    '  });',
    '  var testBtn = document.getElementById("lang-test-run");',
    '  if (testBtn) {',
    '    testBtn.addEventListener("click", function() {',
    '      var txt = document.getElementById("lang-test-input").value;',
    '      postJSON("/api/admin/languages/test-detect", { text: txt }).then(function(r){',
    '        document.getElementById("lang-test-result").textContent = JSON.stringify(r, null, 2);',
    '      });',
    '    });',
    '  }',
    '})();',
    '</script>',
  ].join('\n');
}

module.exports = { renderLanguagePanel, STORES, STORE_NAMES, SUPPORTED, SUPPORTED_LABELS };
