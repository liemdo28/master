"use strict";
/**
 * Local Projects Connector — reads Master Workspace.
 * Returns project registry, health, reports, source maps.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncLocalProjects = syncLocalProjects;
exports.getCachedProjects = getCachedProjects;
exports.searchProjects = searchProjects;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const MASTER_ROOT = process.env.MASTER_ROOT || 'E:/Project/Master';
const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const CACHE_DIR = path_1.default.join(GLOBAL_DIR, 'visibility', 'projects');
const SKIP_DIRS = new Set([
    'node_modules', '.git', 'dist', 'build', 'vendor', 'cache',
    '.claude', '_archive', '_zip_agent.ps1',
]);
function detectType(dir) {
    try {
        const files = fs_1.default.readdirSync(dir).map(f => f.toLowerCase());
        if (files.includes('package.json'))
            return 'node';
        if (files.some(f => f === 'requirements.txt' || f === 'pyproject.toml'))
            return 'python';
        if (files.includes('composer.json'))
            return 'php';
        if (files.some(f => f.endsWith('.go')))
            return 'go';
        return 'project';
    }
    catch {
        return 'unknown';
    }
}
function gitInfo(dir) {
    const run = (cmd) => { try {
        return (0, child_process_1.execSync)(cmd, { cwd: dir, encoding: 'utf-8', timeout: 4000 }).trim();
    }
    catch {
        return '';
    } };
    if (!fs_1.default.existsSync(path_1.default.join(dir, '.git')))
        return {};
    return {
        git_branch: run('git rev-parse --abbrev-ref HEAD'),
        git_dirty: run('git status --porcelain').length > 0,
        last_commit: run('git log -1 --format="%h %s (%ar)" 2>/dev/null'),
    };
}
function findReports(dir) {
    const reports = [];
    const scan = (d, depth) => {
        if (depth > 2)
            return;
        try {
            for (const e of fs_1.default.readdirSync(d, { withFileTypes: true })) {
                if (SKIP_DIRS.has(e.name))
                    continue;
                const full = path_1.default.join(d, e.name);
                if (e.isFile() && /\.(md|txt)$/i.test(e.name) &&
                    /report|audit|qa|validation|summary/i.test(e.name)) {
                    reports.push(full.replace(MASTER_ROOT, ''));
                }
                if (e.isDirectory())
                    scan(full, depth + 1);
            }
        }
        catch { /* skip */ }
    };
    scan(dir, 0);
    return reports.slice(0, 10);
}
async function syncLocalProjects() {
    const projects = [];
    try {
        for (const entry of fs_1.default.readdirSync(MASTER_ROOT, { withFileTypes: true })) {
            if (!entry.isDirectory() || SKIP_DIRS.has(entry.name) || entry.name.startsWith('.'))
                continue;
            const fullPath = path_1.default.join(MASTER_ROOT, entry.name);
            const stat = fs_1.default.statSync(fullPath);
            const issues = [];
            const git = gitInfo(fullPath);
            if (git.git_dirty)
                issues.push('uncommitted changes');
            const reports = findReports(fullPath);
            projects.push({
                name: entry.name,
                path: fullPath,
                type: detectType(fullPath),
                ...git,
                issues,
                reports,
                has_qa: fs_1.default.existsSync(path_1.default.join(fullPath, 'qa-reports')) || reports.some(r => /qa/i.test(r)),
                last_modified: stat.mtime.toISOString(),
            });
        }
    }
    catch (e) {
        console.error('[local-projects]', e);
    }
    // Write cache
    try {
        fs_1.default.mkdirSync(CACHE_DIR, { recursive: true });
        const now = new Date().toISOString();
        fs_1.default.writeFileSync(path_1.default.join(CACHE_DIR, 'data.json'), JSON.stringify(projects, null, 2));
        fs_1.default.writeFileSync(path_1.default.join(CACHE_DIR, 'summary.json'), JSON.stringify({
            total: projects.length,
            with_issues: projects.filter(p => p.issues.length > 0).length,
            has_reports: projects.filter(p => p.reports.length > 0).length,
            types: [...new Set(projects.map(p => p.type))],
        }, null, 2));
        fs_1.default.writeFileSync(path_1.default.join(CACHE_DIR, 'last_sync.json'), JSON.stringify({ synced_at: now }));
        fs_1.default.writeFileSync(path_1.default.join(CACHE_DIR, 'errors.json'), JSON.stringify([]));
    }
    catch { /* skip cache write */ }
    return projects;
}
function getCachedProjects() {
    try {
        return JSON.parse(fs_1.default.readFileSync(path_1.default.join(CACHE_DIR, 'data.json'), 'utf-8'));
    }
    catch {
        return [];
    }
}
function searchProjects(query) {
    const q = query.toLowerCase();
    return getCachedProjects().filter(p => p.name.toLowerCase().includes(q) ||
        p.type.toLowerCase().includes(q) ||
        p.reports.some(r => r.toLowerCase().includes(q)));
}
