/**
 * local-agent/universal-visibility/index.mjs
 * Public API entry point for all universal visibility modules.
 */

export { ConnectorRegistry, registry } from './ConnectorRegistry.mjs';
export { VisibilityCache, visibilityCache } from './VisibilityCache.mjs';
export { DailySnapshotBuilder } from './DailySnapshotBuilder.mjs';
export { PlatformHealthChecker, healthChecker } from './PlatformHealthChecker.mjs';

/**
 * Build and return a daily briefing for Mi to speak
 * @returns {string} Vietnamese briefing text
 */
export async function getDailyBriefing() {
  const { DailySnapshotBuilder } = await import('./DailySnapshotBuilder.mjs');
  const builder = new DailySnapshotBuilder();
  return builder.generateBriefingText();
}

/**
 * Get full visibility status
 * @returns {object} visibility status
 */
export function getVisibilityStatus() {
  const { registry } = require('./ConnectorRegistry.mjs');
  return registry.getSummary();
}

/**
 * Answer "what do I need to do today" type questions
 * @param {string} query - the user's question
 * @returns {string} answer
 */
export function answerVisibilityQuery(query) {
  const { DailySnapshotBuilder } = require('./DailySnapshotBuilder.mjs');
  const { PlatformHealthChecker } = require('./PlatformHealthChecker.mjs');

  const q = query.toLowerCase();

  // "hôm nay có gì cần làm" / "what do I need to do today"
  if (/hôm nay.*cần.*làm|what.*do today|should.*do today/i.test(q)) {
    const builder = new DailySnapshotBuilder();
    return builder.generateBriefingText();
  }

  // "task nào overdue" / "overdue tasks"
  if (/task.*overdue|overdue.*task|task.*nào.*quá hạn/i.test(q)) {
    const snap = new DailySnapshotBuilder().build();
    if (snap.tasks.asana?.status === 'synced' && snap.tasks.asana.overdue > 0) {
      return `Có ${snap.tasks.asana.overdue} Asana task đang overdue. Em khuyên anh nên xử lý sớm.`;
    }
    return 'Không có Asana task overdue nào.';
  }

  // "email nào quan trọng" / "important emails"
  if (/email.*quan trọng|important.*email|gmail.*important/i.test(q)) {
    const snap = new DailySnapshotBuilder().build();
    if (snap.emails.status === 'synced') {
      return `Gmail: ${snap.emails.unread} chưa đọc, ${snap.emails.important} quan trọng.`;
    }
    return `Gmail: ${snap.emails.message || 'Chưa cấu hình Gmail connector.'}`;
  }

  // "calendar hôm nay" / "today's calendar"
  if (/calendar.*hôm nay|today.*calendar|sự kiện.*hôm nay/i.test(q)) {
    const snap = new DailySnapshotBuilder().build();
    if (snap.calendar.status === 'synced' && snap.calendar.today_count > 0) {
      const events = snap.calendar.events_today.map(e => {
        const time = new Date(e.start).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        return `${time} — ${e.title}`;
      }).join('\n');
      return `Hôm nay có ${snap.calendar.today_count} sự kiện:\n${events}`;
    }
    return `Calendar: ${snap.calendar.message || 'Chưa cấu hình Google Calendar.'}`;
  }

  // "dashboard có task gì" / "dashboard tasks"
  if (/dashboard.*task|task.*dashboard|bakudan.*task/i.test(q)) {
    const snap = new DailySnapshotBuilder().build();
    if (snap.dashboard.status === 'ok') {
      return `Dashboard: ${snap.dashboard.modules_count} modules, ${snap.dashboard.reports_count} reports.`;
    }
    return `Dashboard: ${snap.dashboard.message || 'Dashboard chưa sync.'}`;
  }

  // "project nào đang lỗi" / "project issues"
  if (/project.*lỗi|project.*issue|lỗi.*project|project.*problem/i.test(q)) {
    const snap = new DailySnapshotBuilder().build();
    if (snap.projects.status === 'ok') {
      if (snap.projects.dirty_projects.length > 0) {
        return `Có ${snap.projects.dirty_projects.length} project có uncommitted changes: ${snap.projects.dirty_projects.join(', ')}.`;
      }
      return 'Không có project nào đang có vấn đề.';
    }
    return `Projects: ${snap.projects.message || 'Chưa sync.'}`;
  }

  // "file/report nằm đâu" / "where is file/report"
  if (/file.*nằm đâu|report.*nằm đâu|tìm file|tìm report/i.test(q)) {
    return 'Anh thử dùng lệnh "Tìm project [tên]" để tìm file/report cụ thể nhé. Em sẽ tìm trong Master Workspace.';
  }

  // "health checker" — connector health overview
  if (/health|kiểm tra.*kết nối|check.*connector/i.test(q)) {
    const checker = new PlatformHealthChecker();
    const board = checker.checkAll();
    const lines = [`🔌 Connector Health (${board.total} total)`];
    for (const c of board.connectors) {
      const icon = c.status === 'healthy' ? '✓' : c.status === 'degraded' ? '⚠' : c.status === 'offline' ? '✗' : '○';
      lines.push(`  ${icon} ${c.name}: ${c.message}`);
    }
    return lines.join('\n');
  }

  // default: return visibility summary
  const snap = new DailySnapshotBuilder().build();
  return builder.generateBriefingText();
}
