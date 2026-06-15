"use strict";
/**
 * Universal Visibility Hub — aggregates all platform data.
 * Handles connected + stub connectors uniformly.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchProjects = void 0;
exports.getDailySnapshot = getDailySnapshot;
exports.syncAll = syncAll;
exports.syncPlatform = syncPlatform;
exports.listConnectedPlatforms = listConnectedPlatforms;
exports.getPlatformHealth = getPlatformHealth;
exports.getProjectSnapshot = getProjectSnapshot;
exports.getBusinessSnapshot = getBusinessSnapshot;
exports.getSheetsSnapshot = getSheetsSnapshot;
exports.getQuickBooksSnapshot = getQuickBooksSnapshot;
exports.getTasksSnapshot = getTasksSnapshot;
exports.getHealthSnapshot = getHealthSnapshot;
exports.getTasksForPerson_ = getTasksForPerson_;
exports.getOverdueTasksAll = getOverdueTasksAll;
exports.getImportantEmailsAll = getImportantEmailsAll;
exports.getTodayEventsAll = getTodayEventsAll;
exports.searchDrive = searchDrive;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const connector_registry_1 = require("./connector-registry");
const local_projects_1 = require("./connectors/local-projects");
Object.defineProperty(exports, "searchProjects", { enumerable: true, get: function () { return local_projects_1.searchProjects; } });
const dashboard_1 = require("./connectors/dashboard");
const stub_connector_1 = require("./connectors/stub-connector");
const google_auth_1 = require("./connectors/google/google-auth");
const gmail_connector_1 = require("./connectors/google/gmail-connector");
const calendar_connector_1 = require("./connectors/google/calendar-connector");
const drive_connector_1 = require("./connectors/google/drive-connector");
const sheets_connector_1 = require("./connectors/google/sheets-connector");
const asana_connector_1 = require("./connectors/asana/asana-connector");
const health_connector_1 = require("./connectors/health/health-connector");
const accounting_connector_1 = require("./connectors/accounting-connector");
const food_safety_connector_1 = require("./connectors/food-safety-connector");
const website_source_connector_1 = require("./connectors/website-source-connector");
const qb_runtime_connector_1 = require("./connectors/qb-runtime-connector");
const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
async function getDailySnapshot() {
    const now = new Date();
    const registry = connector_registry_1.connectorRegistry.getAll();
    const googleAuth = (0, google_auth_1.getAuthStatus)();
    const connected = [];
    const notConfigured = [];
    // Projects (always local)
    const projects = (0, local_projects_1.getCachedProjects)().length > 0 ? (0, local_projects_1.getCachedProjects)() : await (0, local_projects_1.syncLocalProjects)();
    connected.push('Master Workspace');
    // Dashboard
    const dashboard = (0, dashboard_1.getCachedDashboard)();
    if (dashboard)
        connected.push('Dashboard');
    // Google
    const googleConnected = googleAuth.configured && googleAuth.has_tokens;
    if (googleConnected) {
        connected.push('Gmail', 'Google Calendar', 'Google Drive');
    }
    else {
        notConfigured.push('Gmail', 'Google Calendar', 'Google Drive');
    }
    // Asana
    if ((0, asana_connector_1.isAsanaConfigured)()) {
        connected.push('Asana');
    }
    else {
        notConfigured.push('Asana');
    }
    // Health
    if ((0, health_connector_1.hasHealthExport)())
        connected.push('Huawei Health (export)');
    else
        notConfigured.push('Huawei Health');
    const withIssues = projects.filter(p => p.issues.length > 0);
    const actionItems = [];
    if (withIssues.length > 0)
        actionItems.push(`${withIssues.length} project có uncommitted changes`);
    // Email
    const gmail = (0, gmail_connector_1.getCachedGmail)();
    const emailStatus = gmail
        ? `synced (${gmail.unread_count} unread, ${gmail.important_count} important)`
        : googleConnected ? 'not synced yet' : 'not configured';
    if (gmail?.unread_count && gmail.unread_count > 5)
        actionItems.push(`${gmail.unread_count} emails chưa đọc`);
    // Calendar
    const cal = (0, calendar_connector_1.getCachedCalendar)();
    const calStatus = cal
        ? `synced (${cal.events_today.length} events today)`
        : googleConnected ? 'not synced yet' : 'not configured';
    if (cal?.events_today.length)
        actionItems.push(`${cal.events_today.length} sự kiện hôm nay`);
    // Tasks
    const asana = (0, asana_connector_1.getCachedAsana)();
    const asanaStatus = asana
        ? `synced (${asana.my_tasks.length} tasks, ${asana.overdue_tasks.length} overdue)`
        : (0, asana_connector_1.isAsanaConfigured)() ? 'not synced yet' : 'not configured — set ASANA_TOKEN';
    if (asana?.overdue_tasks.length)
        actionItems.push(`${asana.overdue_tasks.length} Asana tasks overdue`);
    // Health
    const healthSummary = (0, health_connector_1.hasHealthExport)() ? (0, health_connector_1.getHealthSummaryText)() : undefined;
    // Accounting
    const accounting = (0, accounting_connector_1.getCachedAccounting)();
    if (accounting?.status === 'live')
        connected.push('Accounting Engine');
    else
        notConfigured.push('Accounting Engine');
    // Food Safety
    const foodSafety = (0, food_safety_connector_1.getCachedFoodSafety)();
    if (foodSafety?.status === 'ok' && foodSafety.total_records > 0)
        connected.push('Food Safety Gateway');
    if (foodSafety?.pending_sync && foodSafety.pending_sync > 0)
        actionItems.push(`${foodSafety.pending_sync} food safety records pending sync`);
    const snapshot = {
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
        health: { status: (0, health_connector_1.hasHealthExport)() ? 'export_available' : 'no_export', summary: healthSummary },
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
    const snapshotDir = path_1.default.join(GLOBAL_DIR, 'visibility');
    fs_1.default.mkdirSync(snapshotDir, { recursive: true });
    fs_1.default.writeFileSync(path_1.default.join(snapshotDir, 'daily-snapshot.json'), JSON.stringify(snapshot, null, 2));
    return snapshot;
}
async function syncAll() {
    const results = {};
    const errors = [];
    // Always sync local
    try {
        await (0, local_projects_1.syncLocalProjects)();
        results['local-projects'] = 'ok';
        connector_registry_1.connectorRegistry.markSynced('local-projects');
    }
    catch (e) {
        results['local-projects'] = `error: ${e}`;
        errors.push(`local-projects: ${e}`);
    }
    try {
        await (0, dashboard_1.syncDashboard)();
        results['dashboard'] = 'ok';
        connector_registry_1.connectorRegistry.markSynced('dashboard-bakudan');
    }
    catch (e) {
        results['dashboard'] = `error: ${e}`;
    }
    // Google (if configured)
    const gAuth = (0, google_auth_1.getAuthStatus)();
    if (gAuth.configured && gAuth.has_tokens) {
        for (const [name, fn] of [
            ['gmail', gmail_connector_1.syncGmail],
            ['calendar', calendar_connector_1.syncCalendar],
            ['drive', drive_connector_1.syncDrive],
        ]) {
            try {
                await fn();
                results[name] = 'ok';
                connector_registry_1.connectorRegistry.markSynced(`google-${name === 'calendar' ? 'calendar' : name === 'drive' ? 'drive' : 'gmail'}`);
            }
            catch (e) {
                results[name] = `error: ${e}`;
            }
        }
        try {
            const sheets = await (0, sheets_connector_1.certifyGoogleSheets)();
            results['google-sheets'] = sheets.status;
            connector_registry_1.connectorRegistry.update('google-sheets', { auth_status: sheets.has_required_scope ? 'connected' : 'error', status: sheets.status === 'ready' ? 'active' : 'pending' });
            connector_registry_1.connectorRegistry.markSynced('google-sheets', sheets.status === 'ready' ? 'healthy' : 'degraded');
        }
        catch (e) {
            results['google-sheets'] = `error: ${e}`;
            connector_registry_1.connectorRegistry.markSynced('google-sheets', 'degraded');
        }
    }
    else {
        results['gmail'] = 'not_configured';
        results['calendar'] = 'not_configured';
        results['drive'] = 'not_configured';
        results['google-sheets'] = 'not_configured';
    }
    // Asana
    if ((0, asana_connector_1.isAsanaConfigured)()) {
        try {
            await (0, asana_connector_1.syncAsana)();
            results['asana'] = 'ok';
            connector_registry_1.connectorRegistry.markSynced('asana');
        }
        catch (e) {
            results['asana'] = `error: ${e}`;
            const cached = (0, asana_connector_1.getCachedAsana)();
            connector_registry_1.connectorRegistry.update('asana', { auth_status: 'connected', status: 'active' });
            connector_registry_1.connectorRegistry.markSynced('asana', cached ? 'degraded' : 'offline');
        }
    }
    else {
        results['asana'] = 'not_configured';
    }
    // Health (file-based local Huawei/Apple export)
    try {
        const health = (0, health_connector_1.syncHealthExport)();
        results['health'] = health.ok ? 'ok' : health.status;
        if (health.ok) {
            connector_registry_1.connectorRegistry.update('health-export', { auth_status: 'connected', status: 'active' });
            connector_registry_1.connectorRegistry.markSynced('health-export');
        }
    }
    catch (e) {
        results['health'] = `error: ${e}`;
    }
    // Accounting (try live API, graceful fallback)
    try {
        await (0, accounting_connector_1.syncAccounting)();
        results['accounting'] = 'ok';
        connector_registry_1.connectorRegistry.markSynced('accounting');
    }
    catch (e) {
        results['accounting'] = `offline: ${e}`;
    }
    try {
        const qb = (0, qb_runtime_connector_1.writeQuickBooksCache)();
        results['quickbooks-runtime'] = qb.status;
        connector_registry_1.connectorRegistry.update('quickbooks-runtime', { auth_status: 'connected', status: 'active' });
        connector_registry_1.connectorRegistry.markSynced('quickbooks-runtime', qb.certified ? 'healthy' : 'degraded');
    }
    catch (e) {
        results['quickbooks-runtime'] = `error: ${e}`;
        connector_registry_1.connectorRegistry.markSynced('quickbooks-runtime', 'degraded');
    }
    // Food Safety (file-based)
    try {
        (0, food_safety_connector_1.syncFoodSafety)();
        results['food-safety'] = 'ok';
        connector_registry_1.connectorRegistry.markSynced('food-safety');
    }
    catch (e) {
        results['food-safety'] = `error: ${e}`;
    }
    // Websites (source-of-truth local source + GitHub metadata)
    try {
        (0, website_source_connector_1.syncWebsiteSources)();
        results['website-bakudan'] = 'ok';
        results['website-raw'] = 'ok';
        connector_registry_1.connectorRegistry.markSynced('website-bakudan');
        connector_registry_1.connectorRegistry.markSynced('website-raw');
    }
    catch (e) {
        results['websites'] = `error: ${e}`;
    }
    // Write sync log
    const logPath = path_1.default.join(GLOBAL_DIR, 'visibility', 'sync_log.json');
    const log = { synced_at: new Date().toISOString(), results, errors };
    fs_1.default.writeFileSync(logPath, JSON.stringify(log, null, 2));
    return results;
}
async function syncPlatform(connectorId) {
    const gAuth = (0, google_auth_1.getAuthStatus)();
    switch (connectorId) {
        case 'local-projects': return (0, local_projects_1.syncLocalProjects)();
        case 'dashboard-bakudan': return (0, dashboard_1.syncDashboard)();
        case 'gmail': return gAuth.has_tokens ? (0, gmail_connector_1.syncGmail)() : (0, stub_connector_1.getStubResult)('gmail');
        case 'google-calendar': return gAuth.has_tokens ? (0, calendar_connector_1.syncCalendar)() : (0, stub_connector_1.getStubResult)('google-calendar');
        case 'google-drive': return gAuth.has_tokens ? (0, drive_connector_1.syncDrive)() : (0, stub_connector_1.getStubResult)('google-drive');
        case 'google-sheets': {
            if (!gAuth.has_tokens)
                return (0, stub_connector_1.getStubResult)('google-sheets');
            const result = await (0, sheets_connector_1.certifyGoogleSheets)();
            connector_registry_1.connectorRegistry.update('google-sheets', { auth_status: result.has_required_scope ? 'connected' : 'error', status: result.status === 'ready' ? 'active' : 'pending' });
            connector_registry_1.connectorRegistry.markSynced('google-sheets', result.status === 'ready' ? 'healthy' : 'degraded');
            return result;
        }
        case 'asana': {
            if (!(0, asana_connector_1.isAsanaConfigured)())
                return (0, stub_connector_1.getStubResult)('asana');
            try {
                const result = await (0, asana_connector_1.syncAsana)();
                connector_registry_1.connectorRegistry.update('asana', { auth_status: 'connected', status: 'active' });
                connector_registry_1.connectorRegistry.markSynced('asana', 'healthy');
                return result;
            }
            catch (e) {
                const cached = (0, asana_connector_1.getCachedAsana)();
                connector_registry_1.connectorRegistry.update('asana', { auth_status: 'connected', status: 'active' });
                connector_registry_1.connectorRegistry.markSynced('asana', cached ? 'degraded' : 'offline');
                return {
                    status: cached ? 'degraded' : 'offline',
                    error: e instanceof Error ? e.message : String(e),
                    cached,
                };
            }
        }
        case 'health-export': {
            const result = (0, health_connector_1.syncHealthExport)();
            if (result.ok) {
                connector_registry_1.connectorRegistry.update('health-export', { auth_status: 'connected', status: 'active' });
                connector_registry_1.connectorRegistry.markSynced('health-export');
            }
            return result.ok ? result : (0, stub_connector_1.getStubResult)('health-export');
        }
        case 'accounting': return (0, accounting_connector_1.syncAccounting)();
        case 'quickbooks-runtime': {
            const result = (0, qb_runtime_connector_1.writeQuickBooksCache)();
            connector_registry_1.connectorRegistry.update('quickbooks-runtime', { auth_status: 'connected', status: 'active' });
            connector_registry_1.connectorRegistry.markSynced('quickbooks-runtime', result.certified ? 'healthy' : 'degraded');
            return result;
        }
        case 'food-safety': return (0, food_safety_connector_1.syncFoodSafety)();
        case 'website-bakudan': {
            const result = (0, website_source_connector_1.syncWebsiteSource)('website-bakudan');
            connector_registry_1.connectorRegistry.markSynced('website-bakudan');
            return result;
        }
        case 'website-raw': {
            const result = (0, website_source_connector_1.syncWebsiteSource)('website-raw');
            connector_registry_1.connectorRegistry.markSynced('website-raw');
            return result;
        }
        default: return (0, stub_connector_1.getStubResult)(connectorId);
    }
}
function listConnectedPlatforms() { return connector_registry_1.connectorRegistry.getConnected(); }
function getPlatformHealth() {
    const gAuth = (0, google_auth_1.getAuthStatus)();
    const normalized = new Map(connector_registry_1.connectorRegistry.getSummary().connectors.map(c => [c.id, c]));
    return connector_registry_1.connectorRegistry.getAll().map(c => {
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
function getProjectSnapshot() { return (0, local_projects_1.getCachedProjects)(); }
function getBusinessSnapshot() { return { dashboard: (0, dashboard_1.getCachedDashboard)(), projects: (0, local_projects_1.getCachedProjects)() }; }
function getSheetsSnapshot() { return (0, sheets_connector_1.getCachedGoogleSheets)() || (0, stub_connector_1.getStubResult)('google-sheets'); }
function getQuickBooksSnapshot() {
    const snapshot = (0, qb_runtime_connector_1.getQuickBooksRuntimeSnapshot)();
    if (snapshot.certified)
        snapshot.errors = [];
    return (0, qb_runtime_connector_1.writeQuickBooksCache)(snapshot);
}
function getTasksSnapshot() {
    return {
        asana: (0, asana_connector_1.isAsanaConfigured)() ? (0, asana_connector_1.getCachedAsana)() : (0, stub_connector_1.getStubResult)('asana'),
        dashboard: (0, dashboard_1.getCachedDashboard)(),
    };
}
function getHealthSnapshot() {
    if (!(0, health_connector_1.hasHealthExport)())
        return (0, stub_connector_1.getStubResult)('health-export');
    return { status: 'export_available', summary: (0, health_connector_1.getHealthSummaryText)(), data: (0, health_connector_1.parseHealthExport)() };
}
// Cross-connector queries
function getTasksForPerson_(name) {
    const asanaTasks = (0, asana_connector_1.getTasksForPerson)(name);
    return { asana: asanaTasks };
}
function getOverdueTasksAll() {
    return { asana: (0, asana_connector_1.getOverdueTasks)() };
}
function getImportantEmailsAll(limit = 10) {
    return { gmail: (0, gmail_connector_1.getImportantEmails)(limit) };
}
function getTodayEventsAll() {
    return { calendar: (0, calendar_connector_1.getTodayEvents)() };
}
function searchDrive(query) {
    return { drive: (0, drive_connector_1.searchDriveFiles)(query) };
}
