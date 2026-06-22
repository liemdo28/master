/**
 * DailySnapshotBuilder — builds and caches daily visibility snapshots
 * Aggregates data from all connected platforms into a single daily view.
 * NEVER fakes data — shows actual connector status and cache availability.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { registry } from './ConnectorRegistry.mjs';
import { visibilityCache } from './VisibilityCache.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const SNAPSHOT_DIR = path.join(GLOBAL_DIR, 'visibility');

function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

export class DailySnapshotBuilder {
  /**
   * Build a comprehensive daily snapshot
   * @param {object} options
   * @param {boolean} options.forceRefresh - force rebuild even if recent snapshot exists
   * @param {number} options.maxAgeMs - max age of cached snapshot (default 30 min)
   * @returns {object} daily snapshot
   */
  build(options = {}) {
    const { forceRefresh = false, maxAgeMs = 1800000 } = options;

    // Return cached snapshot if fresh
    if (!forceRefresh) {
      const cached = visibilityCache.getDailySnapshot();
      if (cached) {
        const age = Date.now() - new Date(cached.generated_at).getTime();
        if (age < maxAgeMs) return cached;
      }
    }

    const snapshot = this._buildSnapshot();
    this._save(snapshot);
    return snapshot;
  }

  _buildSnapshot() {
    const now = new Date();
    const allConnectors = registry.getAll();
    const connected = registry.getConnected();
    const notConfigured = registry.getNotConfigured();

    const snapshot = {
      generated_at: now.toISOString(),
      date: now.toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      time: now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      platforms: {
        connected: connected.map(c => c.name),
        not_configured: notConfigured.map(c => c.name),
        total: allConnectors.length,
        connected_count: connected.length,
      },
      projects: this._getProjectsSnapshot(),
      dashboard: this._getDashboardSnapshot(),
      tasks: this._getTasksSnapshot(),
      emails: this._getEmailsSnapshot(),
      calendar: this._getCalendarSnapshot(),
      health: this._getHealthSnapshot(),
      action_items: this._buildActionItems(),
    };

    return snapshot;
  }

  _getProjectsSnapshot() {
    const cached = visibilityCache.get('local-projects', 3600000);
    if (!cached) {
      return { status: 'no_cache', message: 'Run sync to generate project cache' };
    }
    const data = cached.data;
    const projects = Array.isArray(data) ? data : (data.projects || []);
    const dirty = projects.filter(p => p.git_dirty);
    const recent = projects.slice(0, 5).map(p => p.name);
    return {
      status: 'ok',
      total: projects.length,
      with_issues: dirty.length,
      dirty_projects: dirty.map(p => p.name),
      recent,
    };
  }

  _getDashboardSnapshot() {
    const cached = visibilityCache.get('dashboard-bakudan', 3600000);
    if (!cached) {
      return { status: 'no_cache', message: 'Dashboard not synced yet' };
    }
    const data = cached.data;
    return {
      status: 'ok',
      has_tasks: !!(data.tasks || data.modules),
      modules_count: data.modules?.length || 0,
      reports_count: data.reports?.length || 0,
      last_cached: cached.cached_at,
    };
  }

  _getTasksSnapshot() {
    const asanaCached = visibilityCache.get('asana', 3600000);
    const dashboardCached = visibilityCache.get('dashboard-bakudan', 3600000);

    return {
      asana: asanaCached
        ? { status: 'synced', overdue: asanaCached.data.overdue_tasks?.length || 0, my_tasks: asanaCached.data.my_tasks?.length || 0 }
        : { status: 'not_configured', message: 'Asana connector not configured — set ASANA_TOKEN in .env' },
      dashboard: dashboardCached
        ? { status: 'synced', pending: dashboardCached.data.pending_tasks?.length || 0 }
        : { status: 'no_cache', message: 'Dashboard not synced yet' },
    };
  }

  _getEmailsSnapshot() {
    const cached = visibilityCache.get('gmail', 3600000);
    if (!cached) {
      return {
        status: 'not_configured',
        message: 'Gmail connector not configured — set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET in .env',
        unread: null,
        important: null,
      };
    }
    const data = cached.data;
    return {
      status: 'synced',
      unread: data.unread_count || 0,
      important: data.important_count || 0,
      last_cached: cached.cached_at,
    };
  }

  _getCalendarSnapshot() {
    const cached = visibilityCache.get('google-calendar', 3600000);
    if (!cached) {
      return {
        status: 'not_configured',
        message: 'Google Calendar not configured — set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET in .env',
        today_count: null,
        events_today: [],
      };
    }
    const data = cached.data;
    return {
      status: 'synced',
      today_count: data.events_today?.length || 0,
      events_today: (data.events_today || []).map(e => ({ title: e.title, start: e.start, end: e.end })),
      last_cached: cached.cached_at,
    };
  }

  _getHealthSnapshot() {
    const cached = visibilityCache.get('health-export', 86400000); // 24hr for health
    if (!cached) {
      return {
        status: 'not_configured',
        message: 'Huawei Health export not configured — place export JSON in .local-agent-global/visibility/health/export/',
        steps: null,
        sleep: null,
      };
    }
    const data = cached.data;
    return {
      status: 'ok',
      steps: data.steps || null,
      sleep: data.sleep || null,
    };
  }

  _buildActionItems() {
    const items = [];
    const projects = this._getProjectsSnapshot();
    if (projects.status === 'ok' && projects.with_issues > 0) {
      items.push(`${projects.with_issues} project có uncommitted changes — cần commit/stash`);
    }
    const tasks = this._getTasksSnapshot();
    if (tasks.asana?.status === 'synced' && tasks.asana.overdue > 0) {
      items.push(`${tasks.asana.overdue} Asana task overdue — cần xử lý`);
    }
    if (tasks.dashboard?.status === 'synced' && tasks.dashboard.pending > 0) {
      items.push(`${tasks.dashboard.pending} dashboard task pending`);
    }
    const emails = this._getEmailsSnapshot();
    if (emails.status === 'synced' && emails.unread > 5) {
      items.push(`${emails.unread} emails chưa đọc — nên kiểm tra`);
    }
    const calendar = this._getCalendarSnapshot();
    if (calendar.status === 'synced' && calendar.today_count > 0) {
      items.push(`${calendar.today_count} sự kiện hôm nay`);
    }
    return items;
  }

  _save(snapshot) {
    ensureDir(SNAPSHOT_DIR);
    const snapPath = path.join(SNAPSHOT_DIR, 'daily-snapshot.json');
    fs.writeFileSync(snapPath, JSON.stringify(snapshot, null, 2));
  }

  /**
   * Generate a human-readable briefing text for Mi to speak
   * @returns {string} briefing in Vietnamese
   */
  generateBriefingText() {
    const snap = this.build();
    const lines = [];
    lines.push(`📅 ${snap.date} — ${snap.time}`);
    lines.push('');
    lines.push(`🔌 Nền tảng đang kết nối: ${snap.platforms.connected_count}/${snap.platforms.total}`);
    for (const name of snap.platforms.connected) {
      lines.push(`  ✓ ${name}`);
    }
    if (snap.platforms.not_configured.length > 0) {
      lines.push('');
      lines.push(`⚠ Chưa cấu hình:`);
      for (const name of snap.platforms.not_configured) {
        lines.push(`  ○ ${name}`);
      }
    }
    lines.push('');
    if (snap.projects.status === 'ok') {
      lines.push(`📁 Projects: ${snap.projects.total} tổng, ${snap.projects.with_issues} có vấn đề`);
      if (snap.projects.dirty_projects.length > 0) {
        lines.push(`  ⚠ Dirty: ${snap.projects.dirty_projects.join(', ')}`);
      }
    } else {
      lines.push(`📁 Projects: ${snap.projects.message}`);
    }
    if (snap.tasks.asana.status === 'synced') {
      lines.push(`✅ Asana: ${snap.tasks.asana.my_tasks} task, ${snap.tasks.asana.overdue} overdue`);
    } else {
      lines.push(`✅ Asana: ${snap.tasks.asana.message || snap.tasks.asana.status}`);
    }
    if (snap.emails.status === 'synced') {
      lines.push(`📧 Gmail: ${snap.emails.unread} unread, ${snap.emails.important} important`);
    } else {
      lines.push(`📧 Gmail: ${snap.emails.message || snap.emails.status}`);
    }
    if (snap.calendar.status === 'synced') {
      lines.push(`📆 Calendar: ${snap.calendar.today_count} sự kiện hôm nay`);
      for (const e of snap.calendar.events_today.slice(0, 3)) {
        const time = new Date(e.start).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        lines.push(`  • ${time} — ${e.title}`);
      }
    } else {
      lines.push(`📆 Calendar: ${snap.calendar.message || snap.calendar.status}`);
    }
    if (snap.action_items.length > 0) {
      lines.push('');
      lines.push(`⚠️ Cần làm hôm nay:`);
      for (const item of snap.action_items) {
        lines.push(`  → ${item}`);
      }
    }
    return lines.join('\n');
  }
}
