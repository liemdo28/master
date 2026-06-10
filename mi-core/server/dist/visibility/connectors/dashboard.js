"use strict";
/**
 * Dashboard Connector — reads bakudanramen.com dashboard local files.
 * Scans PHP source for task structure, reports, user data patterns.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncDashboard = syncDashboard;
exports.getCachedDashboard = getCachedDashboard;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const DASHBOARD_PATH = process.env.DASHBOARD_PATH || 'E:/Project/Master/dashboard.bakudanramen.com';
const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const CACHE_DIR = path_1.default.join(GLOBAL_DIR, 'visibility', 'dashboard');
function scanModules(root) {
    const modules = [];
    try {
        for (const e of fs_1.default.readdirSync(root, { withFileTypes: true })) {
            if (e.isDirectory() && !e.name.startsWith('.'))
                modules.push(e.name);
        }
    }
    catch { /* skip */ }
    return modules;
}
function countFiles(root, ext) {
    let count = 0;
    const walk = (dir, depth) => {
        if (depth > 4)
            return;
        try {
            for (const e of fs_1.default.readdirSync(dir, { withFileTypes: true })) {
                if (e.name === 'node_modules' || e.name === 'vendor')
                    continue;
                const full = path_1.default.join(dir, e.name);
                if (e.isFile() && e.name.endsWith(ext))
                    count++;
                if (e.isDirectory())
                    walk(full, depth + 1);
            }
        }
        catch { /* skip */ }
    };
    walk(root, 0);
    return count;
}
function findReports(root) {
    const results = [];
    const walk = (dir, depth) => {
        if (depth > 3)
            return;
        try {
            for (const e of fs_1.default.readdirSync(dir, { withFileTypes: true })) {
                if (e.name === 'node_modules')
                    continue;
                if (e.isFile() && /report|audit|summary/i.test(e.name))
                    results.push(path_1.default.join(dir, e.name).replace(DASHBOARD_PATH, ''));
                if (e.isDirectory())
                    walk(path_1.default.join(dir, e.name), depth + 1);
            }
        }
        catch { /* skip */ }
    };
    walk(root, 0);
    return results.slice(0, 20);
}
async function syncDashboard() {
    if (!fs_1.default.existsSync(DASHBOARD_PATH)) {
        const err = { error: 'Dashboard path not found', path: DASHBOARD_PATH, checked_at: new Date().toISOString() };
        fs_1.default.mkdirSync(CACHE_DIR, { recursive: true });
        fs_1.default.writeFileSync(path_1.default.join(CACHE_DIR, 'errors.json'), JSON.stringify([err], null, 2));
        return null;
    }
    const modules = scanModules(DASHBOARD_PATH);
    const reports = findReports(DASHBOARD_PATH);
    const phpCount = countFiles(DASHBOARD_PATH, '.php');
    const jsCount = countFiles(DASHBOARD_PATH, '.js');
    // Detect capabilities
    const allDirs = modules.map(m => m.toLowerCase());
    const hasAuth = allDirs.some(m => /auth|login|session|user/.test(m));
    const hasApi = allDirs.some(m => /api/.test(m)) || fs_1.default.existsSync(path_1.default.join(DASHBOARD_PATH, 'api'));
    const hasTasks = allDirs.some(m => /task|todo|work/.test(m));
    // Read README if exists
    let readme;
    for (const name of ['README.md', 'readme.md', 'README.txt']) {
        const p = path_1.default.join(DASHBOARD_PATH, name);
        if (fs_1.default.existsSync(p)) {
            readme = fs_1.default.readFileSync(p, 'utf-8').slice(0, 500);
            break;
        }
    }
    const snapshot = {
        path: DASHBOARD_PATH,
        modules,
        reports,
        total_php_files: phpCount,
        total_js_files: jsCount,
        has_auth: hasAuth,
        has_api: hasApi,
        has_tasks: hasTasks,
        readme_summary: readme,
        scanned_at: new Date().toISOString(),
    };
    fs_1.default.mkdirSync(CACHE_DIR, { recursive: true });
    fs_1.default.writeFileSync(path_1.default.join(CACHE_DIR, 'data.json'), JSON.stringify(snapshot, null, 2));
    fs_1.default.writeFileSync(path_1.default.join(CACHE_DIR, 'summary.json'), JSON.stringify({
        modules_count: modules.length, reports_count: reports.length, php_files: phpCount,
    }, null, 2));
    fs_1.default.writeFileSync(path_1.default.join(CACHE_DIR, 'last_sync.json'), JSON.stringify({ synced_at: new Date().toISOString() }));
    fs_1.default.writeFileSync(path_1.default.join(CACHE_DIR, 'errors.json'), JSON.stringify([]));
    return snapshot;
}
function getCachedDashboard() {
    try {
        return JSON.parse(fs_1.default.readFileSync(path_1.default.join(CACHE_DIR, 'data.json'), 'utf-8'));
    }
    catch {
        return null;
    }
}
