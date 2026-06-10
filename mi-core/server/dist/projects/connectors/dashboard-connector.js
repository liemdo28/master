"use strict";
/**
 * Dashboard Connector (dashboard.bakudanramen.com)
 * PHP site — reads local files + optional local dev API
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncDashboardProject = syncDashboardProject;
exports.getCachedDashboardProject = getCachedDashboardProject;
exports.getDashboardStatus = getDashboardStatus;
exports.runDashboardQA = runDashboardQA;
exports.createTaskDraft = createTaskDraft;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const http_1 = __importDefault(require("http"));
const child_process_1 = require("child_process");
const DASHBOARD_ROOT = process.env.DASHBOARD_ROOT || 'E:/Project/Master/Bakudan/dashboard.bakudanramen.com';
const CACHE_DIR = path_1.default.join(process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global', 'mi-core', 'connectors', 'dashboard');
const DASHBOARD_API = process.env.DASHBOARD_API_URL || 'http://dashboard.bakudanramen.com';
function git(cmd) {
    try {
        return (0, child_process_1.execSync)(`git -C "${DASHBOARD_ROOT}" ${cmd}`, { encoding: 'utf-8', timeout: 5000 }).trim();
    }
    catch {
        return '';
    }
}
async function checkApiLive() {
    return new Promise(resolve => {
        const url = new URL(DASHBOARD_API);
        const req = http_1.default.get({ hostname: url.hostname, port: parseInt(url.port || '80'), path: '/', timeout: 3000 }, () => resolve(true));
        req.on('error', () => resolve(false));
        req.on('timeout', () => { req.destroy(); resolve(false); });
    });
}
function scanModules(dir) {
    const modules = [];
    if (!fs_1.default.existsSync(dir))
        return modules;
    // Look for PHP controllers/modules
    const controllerDirs = [
        path_1.default.join(dir, 'controllers'),
        path_1.default.join(dir, 'modules'),
        path_1.default.join(dir, 'api'),
        dir,
    ].filter(d => fs_1.default.existsSync(d));
    for (const d of controllerDirs) {
        try {
            const files = fs_1.default.readdirSync(d).filter(f => f.endsWith('.php'));
            for (const f of files.slice(0, 30)) {
                const content = fs_1.default.readFileSync(path_1.default.join(d, f), 'utf-8').slice(0, 500);
                modules.push({
                    name: f.replace('.php', ''),
                    file: path_1.default.relative(dir, path_1.default.join(d, f)).replace(/\\/g, '/'),
                    has_api: /\$_GET|\$_POST|json_encode|header.*json/i.test(content),
                });
            }
        }
        catch { /* ignore */ }
    }
    return modules.slice(0, 50);
}
function countReports(dir) {
    const reportDirs = [path_1.default.join(dir, 'reports'), path_1.default.join(dir, 'artifacts')];
    let count = 0;
    for (const d of reportDirs) {
        if (fs_1.default.existsSync(d)) {
            try {
                count += fs_1.default.readdirSync(d).filter(f => /\.(md|json|html|pdf)$/.test(f)).length;
            }
            catch { /* ignore */ }
        }
    }
    return count;
}
async function syncDashboardProject() {
    const now = new Date().toISOString();
    if (!fs_1.default.existsSync(DASHBOARD_ROOT)) {
        const snap = {
            synced_at: now, status: 'not_found', root: DASHBOARD_ROOT,
            php_files: 0, modules: [], tasks_cached: [], users_cached: [],
            git_branch: '', git_dirty: false, last_commit: '', api_live: false,
            api_url: DASHBOARD_API, reports_count: 0,
            summary_text: `❌ Dashboard not found at ${DASHBOARD_ROOT}`,
        };
        return snap;
    }
    const branch = git('rev-parse --abbrev-ref HEAD 2>/dev/null');
    const dirty = git('status --porcelain 2>/dev/null').length > 0;
    const lastCommit = git('log -1 --pretty=format:"%s (%ar)" 2>/dev/null');
    const phpFiles = (() => {
        try {
            return parseInt((0, child_process_1.execSync)(`find "${DASHBOARD_ROOT}" -name "*.php" -not -path "*/vendor/*" 2>/dev/null | wc -l`, { encoding: 'utf-8', timeout: 5000 }).trim());
        }
        catch {
            return 0;
        }
    })();
    const modules = scanModules(DASHBOARD_ROOT);
    const reportsCount = countReports(DASHBOARD_ROOT);
    const [apiLive] = await Promise.all([checkApiLive()]);
    // Parse cached tasks from any local JSON files
    const taskCandidates = [
        path_1.default.join(DASHBOARD_ROOT, 'data', 'tasks.json'),
        path_1.default.join(CACHE_DIR, 'tasks.json'),
    ];
    let tasksCached = [];
    for (const tc of taskCandidates) {
        if (fs_1.default.existsSync(tc)) {
            try {
                tasksCached = JSON.parse(fs_1.default.readFileSync(tc, 'utf-8'));
                break;
            }
            catch { /* ignore */ }
        }
    }
    const snap = {
        synced_at: now,
        status: 'ok',
        root: DASHBOARD_ROOT,
        php_files: phpFiles,
        modules: modules.slice(0, 20),
        tasks_cached: tasksCached.slice(0, 50),
        users_cached: [],
        git_branch: branch,
        git_dirty: dirty,
        last_commit: lastCommit,
        api_live: apiLive,
        api_url: DASHBOARD_API,
        reports_count: reportsCount,
        summary_text: [
            `📊 Dashboard (${branch || 'no git'})`,
            `  PHP files: ${phpFiles} | Modules: ${modules.length} | Reports: ${reportsCount}`,
            `  API (${DASHBOARD_API}): ${apiLive ? '✓ live' : '✗ not reachable'}`,
            `  Git: ${dirty ? '⚠ uncommitted' : '✓ clean'} — ${lastCommit.slice(0, 60)}`,
            tasksCached.length ? `  Cached tasks: ${tasksCached.length}` : '  No cached task data',
        ].join('\n'),
    };
    fs_1.default.mkdirSync(CACHE_DIR, { recursive: true });
    fs_1.default.writeFileSync(path_1.default.join(CACHE_DIR, 'data.json'), JSON.stringify(snap, null, 2));
    fs_1.default.writeFileSync(path_1.default.join(CACHE_DIR, 'summary.json'), JSON.stringify({ php_files: phpFiles, modules: modules.length, api_live: apiLive }, null, 2));
    fs_1.default.writeFileSync(path_1.default.join(CACHE_DIR, 'health.json'), JSON.stringify({ status: snap.status, api_live: apiLive, synced_at: now }));
    fs_1.default.writeFileSync(path_1.default.join(CACHE_DIR, 'last_sync.json'), JSON.stringify({ synced_at: now }));
    fs_1.default.writeFileSync(path_1.default.join(CACHE_DIR, 'errors.json'), JSON.stringify(apiLive ? [] : [`API not reachable: ${DASHBOARD_API}`]));
    return snap;
}
function getCachedDashboardProject() {
    try {
        return JSON.parse(fs_1.default.readFileSync(path_1.default.join(CACHE_DIR, 'data.json'), 'utf-8'));
    }
    catch {
        return null;
    }
}
function getDashboardStatus() {
    const c = getCachedDashboardProject();
    if (!c)
        return '📊 Dashboard: chưa sync.';
    return c.summary_text;
}
function runDashboardQA() {
    const snap = getCachedDashboardProject();
    if (!snap)
        return { score: 0, issues: ['Not synced'], passed: [] };
    const issues = [];
    const passed = [];
    if (snap.api_live)
        passed.push('API reachable');
    else
        issues.push(`API not reachable: ${snap.api_url}`);
    if (snap.php_files > 0)
        passed.push(`${snap.php_files} PHP files`);
    if (!snap.git_dirty)
        passed.push('No uncommitted changes');
    else
        issues.push('Has uncommitted changes');
    if (snap.modules.length)
        passed.push(`${snap.modules.length} modules mapped`);
    const score = Math.round((passed.length / Math.max(passed.length + issues.length, 1)) * 100);
    return { score, issues, passed };
}
// Action: Create task (writes to local cache, queued for push with approval)
function createTaskDraft(task) {
    const draft = {
        id: `draft-${Date.now()}`,
        title: task.title || 'Untitled task',
        assignee: task.assignee,
        status: 'pending',
        due_date: task.due_date,
    };
    const draftsFile = path_1.default.join(CACHE_DIR, 'task-drafts.json');
    let drafts = [];
    if (fs_1.default.existsSync(draftsFile)) {
        try {
            drafts = JSON.parse(fs_1.default.readFileSync(draftsFile, 'utf-8'));
        }
        catch { /* ignore */ }
    }
    drafts.push(draft);
    fs_1.default.writeFileSync(draftsFile, JSON.stringify(drafts, null, 2));
    return draft;
}
