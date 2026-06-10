"use strict";
/**
 * Bakudan Website Connector (bakudanramen.com)
 * Node.js Express site at E:/Project/Master/Bakudan/bakudanramen.com-current
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncBakudanWebsite = syncBakudanWebsite;
exports.getCachedBakudanWebsite = getCachedBakudanWebsite;
exports.getBakudanWebsiteStatus = getBakudanWebsiteStatus;
exports.runBakudanQA = runBakudanQA;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const http_1 = __importDefault(require("http"));
const child_process_1 = require("child_process");
const BAKUDAN_ROOT = process.env.BAKUDAN_WEBSITE_ROOT || 'E:/Project/Master/Bakudan/bakudanramen.com-current';
const CACHE_DIR = path_1.default.join(process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global', 'mi-core', 'connectors', 'bakudan-website');
function git(cmd) {
    try {
        return (0, child_process_1.execSync)(`git -C "${BAKUDAN_ROOT}" ${cmd}`, { encoding: 'utf-8', timeout: 5000 }).trim();
    }
    catch {
        return '';
    }
}
async function checkServerLive(port) {
    return new Promise(resolve => {
        const req = http_1.default.get({ hostname: 'localhost', port, path: '/', timeout: 2000 }, () => resolve(true));
        req.on('error', () => resolve(false));
        req.on('timeout', () => { req.destroy(); resolve(false); });
    });
}
function scanMenuData() {
    // Look for menu JSON / data files
    const candidates = [
        path_1.default.join(BAKUDAN_ROOT, 'data', 'menu.json'),
        path_1.default.join(BAKUDAN_ROOT, 'server', 'data', 'menu.json'),
        path_1.default.join(BAKUDAN_ROOT, 'public', 'data', 'menu.json'),
        path_1.default.join(BAKUDAN_ROOT, 'src', 'data', 'menu.json'),
        path_1.default.join(BAKUDAN_ROOT, 'content', 'menu.json'),
    ];
    for (const c of candidates) {
        if (fs_1.default.existsSync(c)) {
            try {
                const data = JSON.parse(fs_1.default.readFileSync(c, 'utf-8'));
                if (Array.isArray(data))
                    return data.length;
                if (data.items && Array.isArray(data.items))
                    return data.items.length;
            }
            catch { /* ignore */ }
        }
    }
    // Count from content directory
    const contentDir = path_1.default.join(BAKUDAN_ROOT, 'content');
    if (fs_1.default.existsSync(contentDir)) {
        return fs_1.default.readdirSync(contentDir).filter(f => f.includes('menu')).length;
    }
    return 0;
}
function scanPages(dir) {
    const pages = [];
    const checkDirs = ['src/pages', 'pages', 'src/content', 'content', 'public'];
    for (const d of checkDirs) {
        const full = path_1.default.join(dir, d);
        if (!fs_1.default.existsSync(full))
            continue;
        try {
            const files = fs_1.default.readdirSync(full);
            pages.push(...files.filter(f => /\.(html|astro|md|jsx|tsx)$/.test(f)).map(f => `${d}/${f}`));
        }
        catch { /* ignore */ }
    }
    return pages;
}
async function syncBakudanWebsite() {
    const now = new Date().toISOString();
    if (!fs_1.default.existsSync(BAKUDAN_ROOT)) {
        const snap = {
            synced_at: now, status: 'not_found', root: BAKUDAN_ROOT,
            git_remote: '', git_branch: '', git_dirty: false, last_commit: '',
            server_live: false, server_port: 0, menu_items: 0, pages: [],
            content_dirs: [], has_env: false, seo_issues: [`Root not found: ${BAKUDAN_ROOT}`],
            summary_text: `❌ Bakudan website not found at ${BAKUDAN_ROOT}`,
        };
        return snap;
    }
    const remote = git('remote get-url origin 2>/dev/null');
    const branch = git('rev-parse --abbrev-ref HEAD 2>/dev/null');
    const dirty = git('status --porcelain 2>/dev/null').length > 0;
    const lastCommit = git('log -1 --pretty=format:"%s (%ar)" 2>/dev/null');
    // Detect port from .env / package.json
    const envContent = ['.env', '.env.example', '.env.local'].map(f => fs_1.default.existsSync(path_1.default.join(BAKUDAN_ROOT, f)) ? fs_1.default.readFileSync(path_1.default.join(BAKUDAN_ROOT, f), 'utf-8') : '').join('');
    const portMatch = envContent.match(/PORT[=\s]+(\d+)/);
    const serverPort = portMatch ? parseInt(portMatch[1]) : 3000;
    const [serverLive, menuItems] = await Promise.all([
        checkServerLive(serverPort),
        Promise.resolve(scanMenuData()),
    ]);
    const pages = scanPages(BAKUDAN_ROOT);
    const contentDirs = ['src/content', 'content', 'src/pages', 'public']
        .filter(d => fs_1.default.existsSync(path_1.default.join(BAKUDAN_ROOT, d)));
    const seoIssues = [];
    if (!fs_1.default.existsSync(path_1.default.join(BAKUDAN_ROOT, 'public', 'robots.txt'))) {
        seoIssues.push('Missing robots.txt');
    }
    if (!serverLive)
        seoIssues.push('Server not running locally');
    const snap = {
        synced_at: now,
        status: 'ok',
        root: BAKUDAN_ROOT,
        git_remote: remote,
        git_branch: branch,
        git_dirty: dirty,
        last_commit: lastCommit,
        server_live: serverLive,
        server_port: serverPort,
        menu_items: menuItems,
        pages,
        content_dirs: contentDirs,
        has_env: fs_1.default.existsSync(path_1.default.join(BAKUDAN_ROOT, '.env')),
        seo_issues: seoIssues,
        summary_text: [
            `🍜 Bakudan Website (${branch || 'no git'})`,
            `  Server: ${serverLive ? `✓ live on :${serverPort}` : `✗ not running (port ${serverPort})`}`,
            `  Menu items: ${menuItems} | Pages: ${pages.length}`,
            `  Git: ${dirty ? '⚠ changes' : '✓ clean'} — ${lastCommit.slice(0, 60)}`,
            seoIssues.length ? `  Issues: ${seoIssues.join('; ')}` : '  No issues',
        ].join('\n'),
    };
    fs_1.default.mkdirSync(CACHE_DIR, { recursive: true });
    fs_1.default.writeFileSync(path_1.default.join(CACHE_DIR, 'data.json'), JSON.stringify(snap, null, 2));
    fs_1.default.writeFileSync(path_1.default.join(CACHE_DIR, 'summary.json'), JSON.stringify({ menu_items: snap.menu_items, server_live: snap.server_live, git_dirty: snap.git_dirty }, null, 2));
    fs_1.default.writeFileSync(path_1.default.join(CACHE_DIR, 'health.json'), JSON.stringify({ status: snap.status, server_live: snap.server_live, synced_at: now }));
    fs_1.default.writeFileSync(path_1.default.join(CACHE_DIR, 'last_sync.json'), JSON.stringify({ synced_at: now }));
    fs_1.default.writeFileSync(path_1.default.join(CACHE_DIR, 'errors.json'), JSON.stringify(seoIssues));
    return snap;
}
function getCachedBakudanWebsite() {
    try {
        return JSON.parse(fs_1.default.readFileSync(path_1.default.join(CACHE_DIR, 'data.json'), 'utf-8'));
    }
    catch {
        return null;
    }
}
function getBakudanWebsiteStatus() {
    const c = getCachedBakudanWebsite();
    if (!c)
        return '🍜 Bakudan Website: chưa sync.';
    return c.summary_text;
}
function runBakudanQA() {
    const snap = getCachedBakudanWebsite();
    if (!snap)
        return { score: 0, issues: ['Not synced yet'], passed: [] };
    const issues = [...snap.seo_issues];
    const passed = [];
    if (snap.git_branch)
        passed.push('Git initialized');
    if (!snap.git_dirty)
        passed.push('No uncommitted changes');
    else
        issues.push('Has uncommitted changes');
    if (snap.server_live)
        passed.push(`Server live on :${snap.server_port}`);
    if (snap.menu_items > 0)
        passed.push(`Menu has ${snap.menu_items} items`);
    const score = Math.round((passed.length / Math.max(passed.length + issues.length, 1)) * 100);
    return { score, issues, passed };
}
