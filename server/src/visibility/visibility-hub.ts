/**
 * Universal Visibility Hub — aggregates all platform data.
 * Handles connected + stub connectors uniformly.
 */

import fs from 'fs';
import path from 'path';
import { connectorRegistry } from './connector-registry';
import { syncLocalProjects, getCachedProjects, searchProjects as searchLocalProjects } from './connectors/local-projects';
import { syncDashboard, getCachedDashboard } from './connectors/dashboard';
import { getStubResult } from './connectors/stub-connector';
import { getAuthStatus as googleAuthStatus } from './connectors/google/google-auth';
import { getCachedGmail, getImportantEmails, syncGmail } from './connectors/google/gmail-connector';
import { getCachedCalendar, getTodayEvents, syncCalendar } from './connectors/google/calendar-connector';
import { getCachedDrive, searchDriveFiles, syncDrive } from './connectors/google/drive-connector';
import { certifyGoogleSheets, getCachedGoogleSheets } from './connectors/google/sheets-connector';
import { getCachedAsana, getOverdueTasks, getTasksForPerson, syncAsana, isAsanaConfigured } from './connectors/asana/asana-connector';
import { getHealthSummaryText, parseHealthExport, hasHealthExport, syncHealthExport } from './connectors/health/health-connector';
import { syncAccounting, getCachedAccounting, getAccountingSummaryText } from './connectors/accounting-connector';
import { syncFoodSafety, getCachedFoodSafety, getFoodSafetySummaryText } from './connectors/food-safety-connector';
import { syncWebsiteSource, syncWebsiteSources } from './connectors/website-source-connector';
import { getQuickBooksRuntimeSnapshot, writeQuickBooksCache } from './connectors/qb-runtime-connector';

const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';

export interface DailySnapshot {
  generated_at: string;
  date: string;
  platforms: { connected: string[]; not_configured: string[] };
  projects: {
    total: number; with_issues: number;
    top_issues: Array<{ name: string; issues: string[] }>;
    recent: string[];
  };
  dashboard: { status: string; modules_count?: number; reports_count?: number };
  tasks: {
    asana_status: string; asana_overdue?: number; asana_my_tasks?: number;
    dashboard_status: string;
  };
  emails: { status: string; unread?: number; important?: number };
  calendar: { status: string; today_count?: number; events_today?: Array<{ title: string; start: string }> };
  health: { status: string; summary?: string };
  accounting: { status: string; summary?: string };
  food_safety: { status: string; total_records?: number; pending_sync?: number };
  action_items: string[];
}

export async function getDailySnapshot(): Promise<DailySnapshot> {
  const now = new Date();
  const registry = connectorRegistry.getAll();
  const googleAuth = googleAuthStatus();

  const connected: string[] = [];
  const notConfigured: string[] = [];

  // Projects (always local)
  const projects = getCachedProjects().length > 0 ? getCachedProjects() : await syncLocalProjects();
  connected.push('Master Workspace');

  // Dashboard
  const dashboard = getCachedDashboard();
  if (dashboard) connected.push('Dashboard');

  // Google
  const googleConnected = googleAuth.configured && googleAuth.has_tokens;
  if (googleConnected) {
    connected.push('Gmail', 'Google Calendar', 'Google Drive');
  } else {
    notConfigured.push('Gmail', 'Google Calendar', 'Google Drive');
  }

  // Asana
  if (isAsanaConfigured()) {
    connected.push('Asana');
  } else {
    notConfigured.push('Asana');
  }

  // Health
  if (hasHealthExport()) connected.push('Huawei Health (export)');
  else notConfigured.push('Huawei Health');

  const withIssues = projects.filter(p => p.issues.length > 0);
  const actionItems: string[] = [];
  if (withIssues.length > 0) actionItems.push(`${withIssues.length} project có uncommitted changes`);

  // Email
  const gmail = getCachedGmail();
  const emailStatus = gmail
    ? `synced (${gmail.unread_count} unread, ${gmail.important_count} important)`
    : googleConnected ? 'not synced yet' : 'not configured';
  if (gmail?.unread_count && gmail.unread_count > 5) actionItems.push(`${gmail.unread_count} emails chưa đọc`);

  // Calendar
  const cal = getCachedCalendar();
  const calStatus = cal
    ? `synced (${cal.events_today.length} events today)`
    : googleConnected ? 'not synced yet' : 'not configured';
  if (cal?.events_today.length) actionItems.push(`${cal.events_today.length} sự kiện hôm nay`);

  // Tasks
  const asana = getCachedAsana();
  const asanaStatus = asana
    ? `synced (${asana.my_tasks.length} tasks, ${asana.overdue_tasks.length} overdue)`
    : isAsanaConfigured() ? 'not synced yet' : 'not configured — set ASANA_TOKEN';
  if (asana?.overdue_tasks.length) actionItems.push(`${asana.overdue_tasks.length} Asana tasks overdue`);

  // Health
  const healthSummary = hasHealthExport() ? getHealthSummaryText() : undefined;

  // Accounting
  const accounting = getCachedAccounting();
  if (accounting?.status === 'live') connected.push('Accounting Engine');
  else notConfigured.push('Accounting Engine');

  // Food Safety
  const foodSafety = getCachedFoodSafety();
  if (foodSafety?.status === 'ok' && foodSafety.total_records > 0) connected.push('Food Safety Gateway');
  if (foodSafety?.pending_sync && foodSafety.pending_sync > 0) actionItems.push(`${foodSafety.pending_sync} food safety records pending sync`);

  const snapshot: DailySnapshot = {
    generated_at: now.toISOString(),
    date: now.toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    platforms: { connected, not_configured: notConfigured },
    projects: {
      total: projects.length,
      with_issues: withIssues.length,
      top_issues: withIssues.slice(0, 5).map(p => ({ name: p.name, issues: p.issues })),
      recent: projects.slice(0, 5).map(p => p.name),
    },
    dashboard: dashboard
      ? { status: 'synced', modules_count: dashboard.modules.length, reports_count: dashboard.reports.length }
      : { status: 'not_synced' },
    tasks: {
      asana_status: asanaStatus,
      asana_overdue: asana?.overdue_tasks.length,
      asana_my_tasks: asana?.my_tasks.length,
      dashboard_status: dashboard?.has_tasks ? 'has_tasks_module' : 'no_tasks_module',
    },
    emails: {
      status: emailStatus,
      unread: gmail?.unread_count,
      important: gmail?.important_count,
    },
    calendar: {
      status: calStatus,
      today_count: cal?.events_today.length,
      events_today: cal?.events_today.slice(0, 5).map(e => ({ title: e.title, start: e.start })),
    },
    health: { status: hasHealthExport() ? 'export_available' : 'no_export', summary: healthSummary },
    accounting: {
      status: accounting?.status || 'not_synced',
      summary: accounting?.summary_text,
    },
    food_safety: {
      status: foodSafety?.status || 'not_synced',
      total_records: foodSafety?.total_records,
      pending_sync: foodSafety?.pending_sync,
    },
    action_items: actionItems,
  };

  const snapshotDir = path.join(GLOBAL_DIR, 'visibility');
  fs.mkdirSync(snapshotDir, { recursive: true });
  fs.writeFileSync(path.join(snapshotDir, 'daily-snapshot.json'), JSON.stringify(snapshot, null, 2));
  return snapshot;
}

export async function syncAll(): Promise<Record<string, string>> {
  const results: Record<string, string> = {};
  const errors: string[] = [];

  // Always sync local
  try { await syncLocalProjects(); results['local-projects'] = 'ok'; connectorRegistry.markSynced('local-projects'); }
  catch (e) { results['local-projects'] = `error: ${e}`; errors.push(`local-projects: ${e}`); }

  try { await syncDashboard(); results['dashboard'] = 'ok'; connectorRegistry.markSynced('dashboard-bakudan'); }
  catch (e) { results['dashboard'] = `error: ${e}`; }

  // Google (if configured)
  const gAuth = googleAuthStatus();
  if (gAuth.configured && gAuth.has_tokens) {
    for (const [name, fn] of [
      ['gmail', syncGmail],
      ['calendar', syncCalendar],
      ['drive', syncDrive],
    ] as const) {
      try { await fn(); results[name] = 'ok'; connectorRegistry.markSynced(`google-${name === 'calendar' ? 'calendar' : name === 'drive' ? 'drive' : 'gmail'}`); }
      catch (e) { results[name] = `error: ${e}`; }
    }
    try {
      const sheets = await certifyGoogleSheets();
      results['google-sheets'] = sheets.status;
      connectorRegistry.update('google-sheets', { auth_status: sheets.has_required_scope ? 'connected' : 'error', status: sheets.status === 'ready' ? 'active' : 'pending' });
      connectorRegistry.markSynced('google-sheets', sheets.status === 'ready' ? 'healthy' : 'degraded');
    } catch (e) {
      results['google-sheets'] = `error: ${e}`;
      connectorRegistry.markSynced('google-sheets', 'degraded');
    }
  } else {
    results['gmail'] = 'not_configured'; results['calendar'] = 'not_configured'; results['drive'] = 'not_configured'; results['google-sheets'] = 'not_configured';
  }

  // Asana
  if (isAsanaConfigured()) {
    try { await syncAsana(); results['asana'] = 'ok'; connectorRegistry.markSynced('asana'); }
    catch (e) {
      results['asana'] = `error: ${e}`;
      const cached = getCachedAsana();
      connectorRegistry.update('asana', { auth_status: 'connected', status: 'active' });
      connectorRegistry.markSynced('asana', cached ? 'degraded' : 'offline');
    }
  } else { results['asana'] = 'not_configured'; }

  // Health (file-based local Huawei/Apple export)
  try {
    const health = syncHealthExport();
    results['health'] = health.ok ? 'ok' : health.status;
    if (health.ok) {
      connectorRegistry.update('health-export', { auth_status: 'connected', status: 'active' });
      connectorRegistry.markSynced('health-export');
    }
  } catch (e) {
    results['health'] = `error: ${e}`;
  }

  // Accounting (try live API, graceful fallback)
  try { await syncAccounting(); results['accounting'] = 'ok'; connectorRegistry.markSynced('accounting'); }
  catch (e) { results['accounting'] = `offline: ${e}`; }

  try {
    const qb = writeQuickBooksCache();
    results['quickbooks-runtime'] = qb.status;
    connectorRegistry.update('quickbooks-runtime', { auth_status: 'connected', status: 'active' });
    connectorRegistry.markSynced('quickbooks-runtime', qb.certified ? 'healthy' : 'degraded');
  } catch (e) {
    results['quickbooks-runtime'] = `error: ${e}`;
    connectorRegistry.markSynced('quickbooks-runtime', 'degraded');
  }

  // Food Safety (file-based)
  try { syncFoodSafety(); results['food-safety'] = 'ok'; connectorRegistry.markSynced('food-safety'); }
  catch (e) { results['food-safety'] = `error: ${e}`; }

  // Websites (source-of-truth local source + GitHub metadata)
  try {
    syncWebsiteSources();
    results['website-bakudan'] = 'ok';
    results['website-raw'] = 'ok';
    connectorRegistry.markSynced('website-bakudan');
    connectorRegistry.markSynced('website-raw');
  } catch (e) {
    results['websites'] = `error: ${e}`;
  }

  // Write sync log
  const logPath = path.join(GLOBAL_DIR, 'visibility', 'sync_log.json');
  const log = { synced_at: new Date().toISOString(), results, errors };
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2));

  return results;
}

export async function syncPlatform(connectorId: string): Promise<unknown> {
  const gAuth = googleAuthStatus();
  switch (connectorId) {
    case 'local-projects': return syncLocalProjects();
    case 'dashboard-bakudan': return syncDashboard();
    case 'gmail': return gAuth.has_tokens ? syncGmail() : getStubResult('gmail');
    case 'google-calendar': return gAuth.has_tokens ? syncCalendar() : getStubResult('google-calendar');
    case 'google-drive': return gAuth.has_tokens ? syncDrive() : getStubResult('google-drive');
    case 'google-sheets': {
      if (!gAuth.has_tokens) return getStubResult('google-sheets');
      const result = await certifyGoogleSheets();
      connectorRegistry.update('google-sheets', { auth_status: result.has_required_scope ? 'connected' : 'error', status: result.status === 'ready' ? 'active' : 'pending' });
      connectorRegistry.markSynced('google-sheets', result.status === 'ready' ? 'healthy' : 'degraded');
      return result;
    }
    case 'asana': {
      if (!isAsanaConfigured()) return getStubResult('asana');
      try {
        const result = await syncAsana();
        connectorRegistry.update('asana', { auth_status: 'connected', status: 'active' });
        connectorRegistry.markSynced('asana', 'healthy');
        return result;
      } catch (e) {
        const cached = getCachedAsana();
        connectorRegistry.update('asana', { auth_status: 'connected', status: 'active' });
        connectorRegistry.markSynced('asana', cached ? 'degraded' : 'offline');
        return {
          status: cached ? 'degraded' : 'offline',
          error: e instanceof Error ? e.message : String(e),
          cached,
        };
      }
    }
    case 'health-export': {
      const result = syncHealthExport();
      if (result.ok) {
        connectorRegistry.update('health-export', { auth_status: 'connected', status: 'active' });
        connectorRegistry.markSynced('health-export');
      }
      return result.ok ? result : getStubResult('health-export');
    }
    case 'accounting': return syncAccounting();
    case 'quickbooks-runtime': {
      const result = writeQuickBooksCache();
      connectorRegistry.update('quickbooks-runtime', { auth_status: 'connected', status: 'active' });
      connectorRegistry.markSynced('quickbooks-runtime', result.certified ? 'healthy' : 'degraded');
      return result;
    }
    case 'food-safety': return syncFoodSafety();
    case 'website-bakudan': {
      const result = syncWebsiteSource('website-bakudan');
      connectorRegistry.markSynced('website-bakudan');
      return result;
    }
    case 'website-raw': {
      const result = syncWebsiteSource('website-raw');
      connectorRegistry.markSynced('website-raw');
      return result;
    }
    default: return getStubResult(connectorId);
  }
}

export function listConnectedPlatforms() { return connectorRegistry.getConnected(); }
export function getPlatformHealth() {
  const gAuth = googleAuthStatus();
  const normalized = new Map(connectorRegistry.getSummary().connectors.map(c => [c.id, c]));
  return connectorRegistry.getAll().map(c => {
    const n = normalized.get(c.connector_id);
    return {
      id: c.connector_id,
      name: c.name,
      auth: c.connector_id.startsWith('google') ? (gAuth.has_tokens ? 'connected' : gAuth.configured ? 'needs_authorization' : 'not_configured') : c.auth_status,
      health: n?.health || 'offline',
      last_sync: c.last_sync || n?.last_sync || null,
      setup_hint: c.auth_status !== 'connected' || n?.health !== 'healthy' ? c.setup_hint : undefined,
    };
  });
}

export function getProjectSnapshot() { return getCachedProjects(); }
export function getBusinessSnapshot() { return { dashboard: getCachedDashboard(), projects: getCachedProjects() }; }
export function getSheetsSnapshot() { return getCachedGoogleSheets() || getStubResult('google-sheets'); }
export function getQuickBooksSnapshot() {
  const snapshot = getQuickBooksRuntimeSnapshot();
  if (snapshot.certified) snapshot.errors = [];
  return writeQuickBooksCache(snapshot);
}
export function getTasksSnapshot() {
  return {
    asana: isAsanaConfigured() ? getCachedAsana() : getStubResult('asana'),
    dashboard: getCachedDashboard(),
  };
}
export function getHealthSnapshot() {
  if (!hasHealthExport()) return getStubResult('health-export');
  return { status: 'export_available', summary: getHealthSummaryText(), data: parseHealthExport() };
}

// Cross-connector queries
export function getTasksForPerson_(name: string) {
  const asanaTasks = getTasksForPerson(name);
  return { asana: asanaTasks };
}
export function getOverdueTasksAll() {
  return { asana: getOverdueTasks() };
}
export function getImportantEmailsAll(limit = 10) {
  return { gmail: getImportantEmails(limit) };
}
export function getTodayEventsAll() {
  return { calendar: getTodayEvents() };
}
export function searchDrive(query: string) {
  return { drive: searchDriveFiles(query) };
}
export { searchLocalProjects as searchProjects };
