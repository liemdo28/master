/**
 * Weekly Compliance Report (CEO Directive — Manager Group Reports)
 * Sent every Sunday at 8 PM to manager alert group.
 */
const historyService = require('../history/history-service');
const replyService = require('../whatsapp/reply-service');
const managerAlerts = require('../alerts/manager-alert-service');
const { makeLogger } = require('../logger');

const log = makeLogger('reports');

function isEnabled() {
  return process.env.WEEKLY_REPORT_ENABLED === 'true';
}

function getReportDay() {
  return (process.env.WEEKLY_REPORT_DAY || 'SUNDAY').toUpperCase();
}

function getReportTime() {
  return process.env.WEEKLY_REPORT_TIME || '20:00'; // 8 PM default
}

/**
 * Generate and send weekly compliance report.
 * Called by daily health report scheduler or standalone.
 */
async function generateAndSend(client) {
  if (!isEnabled()) return { sent: false, reason: 'disabled' };

  const summary = await historyService.getWeeklySummary();
  const managerChatId = managerAlerts.getManagerChatId();

  if (!client || !managerChatId) {
    log.warn('Weekly report skipped — no client or manager chat ID');
    return { sent: false, reason: 'no_client_or_manager_chat_id' };
  }

  const report = buildWeeklyReportText(summary);

  try {
    await replyService.send(client, managerChatId, report);
    log.info('Weekly compliance report sent', { week: summary.startDate + ' to ' + summary.endDate });
    return { sent: true, entries: summary.entries.length };
  } catch (err) {
    log.error('Weekly report send failed', { error: err.message });
    return { sent: false, reason: err.message };
  }
}

function buildWeeklyReportText(summary) {
  const lines = [
    '📊 WEEKLY COMPLIANCE REPORT',
    `${summary.startDate} → ${summary.endDate}`,
    '',
  ];

  if (!summary.entries.length) {
    lines.push('No submissions this week.');
    lines.push('');
    lines.push('Check store teams — all stores may have missed logging.');
    return lines.join('\n');
  }

  const totalEntries = summary.entries.reduce((s, e) => s + e.total_entries, 0);
  const totalAlerts = summary.entries.reduce((s, e) => s + e.manager_alerts, 0);

  lines.push(`Total entries: ${totalEntries}`);
  lines.push(`Manager alerts: ${totalAlerts}`);
  lines.push('');
  lines.push('Per Store:');

  summary.entries.forEach(e => {
    const rate = e.total_entries > 0 ? Math.round((e.sheet_written / e.total_entries) * 100) : 0;
    const alertIcon = e.manager_alerts > 0 ? '⚠️' : '✅';
    const pendingIcon = e.sheet_pending > 0 ? ` (${e.sheet_pending} queued)` : '';
    lines.push(
      `${alertIcon} ${e.store_name || e.store_id}: ` +
      `${e.total_entries} entries | ${rate}% sheet written${pendingIcon} | ${e.manager_alerts} alerts`
    );
  });

  lines.push('');
  lines.push('Recommendation:');
  const missingStores = summary.entries.filter(e => e.total_entries === 0);
  if (missingStores.length) {
    lines.push(`⚠️ ${missingStores.map(s => s.store_name || s.store_id).join(', ')} — no submissions this week`);
  } else {
    lines.push('✅ All stores submitted at least once this week.');
  }

  if (totalAlerts > 0) {
    lines.push('');
    lines.push(`⚠️ ${totalAlerts} manager alerts were sent this week.`);
    lines.push('Review any outstanding issues in the dashboard.');
  }

  return lines.join('\n');
}

module.exports = {
  isEnabled,
  getReportDay,
  getReportTime,
  generateAndSend,
  buildWeeklyReportText,
};