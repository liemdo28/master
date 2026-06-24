/**
 * History Commands (CEO Directive — WhatsApp Manager Commands)
 * Allows managers to query historical logs from WhatsApp.
 *
 * Allowed only in: Manager Alert Group, Direct chat with CEO/admin
 *
 * Commands:
 *   /history [today|yesterday|week|store|employee|warnings|missing|detail <id>]
 *   /who <item> [today|yesterday|<store>]
 *   /summary [today|week|<store>]
 */
const historyService = require('../history/history-service');
const roleService = require('../auth/role-service');

const MANAGER_COMMANDS = ['/history', '/who', '/summary'];

function isHistoryCommand(text) {
  const t = String(text || '').trim().toLowerCase();
  return MANAGER_COMMANDS.some(c => t.startsWith(c));
}

function buildHelpMessage() {
  return [
    '📋 History Commands (Manager only)',
    '',
    '/history today — Today\'s logs',
    '/history yesterday — Yesterday\'s logs',
    '/history week — This week\'s logs',
    '/history Stone Oak — Store logs',
    '/history Omar — Employee logs',
    '/history warnings — Logs with warnings',
    '/history missing — Stores that missed today',
    '/history detail <id> — Full log detail',
    '',
    '/who Walk-in Cooler today — Who recorded item',
    '/who Walk-in Cooler Stone Oak — Item at store',
    '',
    '/summary today — Daily summary',
    '/summary week — Weekly summary',
    '/summary Stone Oak — Store summary',
  ].join('\n');
}

async function handleHistoryCommand({ text, chatId, sender, senderName, isGroup, client, groupName }) {
  const t = String(text || '').trim();

  // Check permission — only manager group, direct to admin, or configured admin IDs
  const role = await roleService.getRole(sender);
  const canAccess = roleService.getRoleLevel(role) >= roleService.getRoleLevel('MANAGER');
  const isManagerGroup = roleService.isManagerGroup(chatId) || roleService.isAdminChat(chatId);
  const isDirectAdmin = roleService.getRoleLevel(role) >= roleService.getRoleLevel('ADMIN');

  if (!canAccess && !isManagerGroup && !isDirectAdmin) {
    return {
      handled: true,
      blocked: false,
      reply: 'You do not have permission to use history commands.',
    };
  }

  // /history
  if (t.startsWith('/history')) {
    return handleHistory(t, sender, role);
  }

  // /who
  if (t.startsWith('/who')) {
    return handleWho(t, sender, role);
  }

  // /summary
  if (t.startsWith('/summary')) {
    return handleSummary(t, sender, role);
  }

  return { handled: false };
}

async function handleHistory(text, sender, role) {
  const args = text.replace('/history', '').trim();
  const today = new Date().toISOString().slice(0, 10);

  // /history detail <id>
  const detailMatch = args.match(/^detail\s+(\d+)/i);
  if (detailMatch) {
    return buildHistoryDetail(detailMatch[1]);
  }

  // Parse filters
  let startDate = null;
  let endDate = null;
  let storeId = null;
  let status = null;
  let employeeId = null;

  const a = args.toLowerCase();
  if (a === 'today' || a === '') {
    startDate = today + 'T00:00:00.000Z';
    endDate = today + 'T23:59:59.999Z';
  } else if (a === 'yesterday') {
    const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    startDate = y + 'T00:00:00.000Z';
    endDate = y + 'T23:59:59.999Z';
  } else if (a === 'week') {
    const d = new Date();
    const day = d.getDay();
    const start = new Date(d.getTime() - (day === 0 ? 6 : day - 1) * 86400000);
    startDate = start.toISOString().slice(0, 10) + 'T00:00:00.000Z';
    endDate = new Date(start.getTime() + 6 * 86400000).toISOString().slice(0, 10) + 'T23:59:59.999Z';
  } else if (a.includes('warning')) {
    status = 'WARNING';
    startDate = today + 'T00:00:00.000Z';
    endDate = today + 'T23:59:59.999Z';
  } else if (a.includes('missing')) {
    return buildMissingToday();
  } else if (a.includes('stone oak')) { storeId = 'stone_oak'; }
  else if (a.includes('bandera')) { storeId = 'bandera'; }
  else if (a.includes('rim')) { storeId = 'rim'; }

  // Check role — limit scope
  const filter = await roleService.filterByRole(sender, storeId);
  if (filter.storeId) storeId = filter.storeId;
  if (filter.employeeId) employeeId = filter.employeeId;

  const logs = await historyService.getRecentLogs({
    storeId, employeeId, status,
    startDate, endDate, limit: 20,
  });

  if (!logs.length) {
    return { handled: true, reply: 'No logs found for this period.' };
  }

  const lines = ['📋 Logs'];
  logs.forEach((log, i) => {
    const time = fmtTime(log.confirmed_at || log.created_at);
    const badge = log.manager_alert_status === 'SENT' ? '⚠️' : log.sheet_write_status === 'SENT' ? '✅' : '⏳';
    lines.push(`${i + 1}. ${badge} ${log.store_name || log.store_id} — ${log.employee_name || log.employee_id} — ${log.workflow_type || 'Daily Entry'} — ${time}`);
    lines.push(`   ID: ${log.id} | Status: ${log.sheet_write_status} | Alert: ${log.manager_alert_status}`);
  });

  lines.push('');
  lines.push('Reply /history detail <id> for full detail.');
  return { handled: true, reply: lines.join('\n') };
}

async function buildHistoryDetail(logId) {
  const log = await historyService.getLogDetail(parseInt(logId, 10));
  if (!log) return { handled: true, reply: `Log #${logId} not found.` };

  const time = fmtTime(log.confirmed_at || log.created_at);
  const lines = [
    `📋 Log Detail #${log.id}`,
    '',
    `Store: ${log.store_name || log.store_id || 'Unknown'}`,
    `Employee: ${log.employee_name || log.employee_id || 'Unknown'}`,
    `Time: ${time}`,
    `Workflow: ${log.workflow_type || 'Daily Entry'}`,
  ];

  // Validation result
  try {
    const vr = JSON.parse(log.validation_result_json || '{}');
    const failCount = vr.failCount || 0;
    const warnCount = vr.warningCount || 0;
    const status = failCount > 0 ? '⚠️ WARNING' : '✅ PASS';
    lines.push(`Status: ${status}`);
    if (vr.failures?.length) {
      lines.push('');
      lines.push('Warnings:');
      vr.failures.forEach(f => {
        lines.push(`- ${f.name || f.item}: ${f.value} | Target ${f.target || '?'} | ${f.reason?.includes('above') ? 'HIGH' : 'LOW'}`);
      });
    }
  } catch (_) {}

  // Edits
  const edits = log.edits || [];
  if (edits.length) {
    lines.push('');
    lines.push('Edits:');
    edits.forEach(e => {
      lines.push(`- ${e.item_name}: ${e.old_value} → ${e.new_value} (by ${e.edited_by || 'Unknown'})`);
    });
  }

  lines.push('');
  lines.push(`Sheet: ${log.sheet_write_status || '?'}`);
  lines.push(`Manager Alert: ${log.manager_alert_status || '?'}`);

  return { handled: true, reply: lines.join('\n') };
}

async function buildMissingToday() {
  const today = new Date().toISOString().slice(0, 10);
  const allStores = ['stone_oak', 'bandera', 'rim'];
  const storeNames = { stone_oak: 'Stone Oak', bandera: 'Bandera', rim: 'Rim' };

  const submitted = await historyService.getStoresSubmittedToday();
  const submittedIds = new Set(submitted.map(s => s.store_id));

  const missing = allStores.filter(id => !submittedIds.has(id));
  const lines = ['📋 Today\'s Missing Logs'];

  submitted.forEach(s => {
    const time = fmtTime(s.last_confirmed);
    lines.push(`✅ ${storeNames[s.store_id] || s.store_id} — Last: ${time}`);
  });

  missing.forEach(id => {
    lines.push(`❌ ${storeNames[id]} — NOT SUBMITTED`);
  });

  return { handled: true, reply: lines.join('\n') };
}

async function handleWho(text, sender, role) {
  const args = text.replace('/who', '').trim();
  if (!args) return { handled: true, reply: 'Usage: /who <item> [today|store]' };

  // Parse: /who Walk-in Cooler today
  //        /who Walk-in Cooler Stone Oak
  const parts = args.split(/\s+/);
  const itemName = parts[0];
  const filter = args.includes('today') ? 'today' : null;
  const storeName = parts.find(p => ['stone_oak', 'bandera', 'rim', 'stone oak', 'bandera', 'rim'].includes(p.toLowerCase()));

  let storeId = null;
  if (storeName) storeId = storeName.replace(' ', '_').toLowerCase();

  const roleFilter = await roleService.filterByRole(sender, storeId);
  const who = await historyService.getWhoRecorded({
    storeId: roleFilter.storeId || storeId,
    itemName,
    date: filter === 'today' ? null : null,
  });

  if (!who.length) {
    return { handled: true, reply: `No records found for "${itemName}"${storeId ? ' at ' + storeId : ''} today.` };
  }

  const lines = [`👤 Who recorded "${itemName}" today?`];
  who.forEach(r => {
    const statusIcon = r.status === 'PASS' ? '✅' : r.status === 'WARNING' ? '⚠️' : '❓';
    const value = r.item_value != null ? `${r.item_value}°F` : '—';
    lines.push(`${statusIcon} ${r.store_name || r.store_id}: ${r.employee_name || r.employee_id} at ${fmtTime(r.confirmed_at)} — ${value} [${r.sheet_write_status}]`);
  });

  return { handled: true, reply: lines.join('\n') };
}

async function handleSummary(text, sender, role) {
  const args = text.replace('/summary', '').trim().toLowerCase();
  const today = new Date().toISOString().slice(0, 10);

  // Check role for store filter
  const roleFilter = await roleService.filterByRole(sender);
  const storeId = roleFilter.storeId;

  if (args.includes('week')) {
    const summary = await historyService.getWeeklySummary();
    return buildWeeklySummary(summary);
  }

  // Daily summary
  const rows = await historyService.getDailySummary();
  return buildDailySummary(rows);
}

async function buildDailySummary(rows) {
  if (!rows.length) {
    return { handled: true, reply: '📋 Today\'s Summary — No submissions yet.' };
  }

  const lines = ['📋 Today\'s Summary'];
  rows.forEach(r => {
    const alertIcon = r.alert_count > 0 ? '⚠️' : '✅';
    lines.push(`${alertIcon} ${r.store_name || r.store_id}: ${r.submission_count} submission(s), ${r.alert_count} alert(s)`);
    lines.push(`   Last: ${fmtTime(r.last_confirmed_at)}`);
  });

  const total = rows.reduce((s, r) => s + r.submission_count, 0);
  const alerts = rows.reduce((s, r) => s + r.alert_count, 0);
  lines.push('');
  lines.push(`Total: ${total} submissions, ${alerts} manager alerts`);

  return { handled: true, reply: lines.join('\n') };
}

async function buildWeeklySummary(summary) {
  const lines = [
    `📋 Weekly Summary (${summary.startDate} → ${summary.endDate})`,
    '',
  ];

  if (!summary.entries.length) {
    lines.push('No submissions this week.');
    return { handled: true, reply: lines.join('\n') };
  }

  summary.entries.forEach(e => {
    const rate = e.total_entries > 0 ? Math.round((e.sheet_written / e.total_entries) * 100) : 0;
    const alertIcon = e.manager_alerts > 0 ? '⚠️' : '✅';
    lines.push(`${alertIcon} ${e.store_name || e.store_id}: ${e.total_entries} entries, ${rate}% sheet written, ${e.manager_alerts} alerts`);
  });

  const total = summary.entries.reduce((s, e) => s + e.total_entries, 0);
  const alerts = summary.entries.reduce((s, e) => s + e.manager_alerts, 0);
  lines.push('');
  lines.push(`Week total: ${total} entries, ${alerts} manager alerts`);

  return { handled: true, reply: lines.join('\n') };
}

function fmtTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

module.exports = {
  isHistoryCommand,
  handleHistoryCommand,
  buildHelpMessage,
};