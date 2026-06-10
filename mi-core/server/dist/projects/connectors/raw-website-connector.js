"use strict";
/**
 * Raw Sushi Website Connector (rawsushibar.com)
 * Astro.js site at E:/Project/Master/RawSushi/RawWebsite
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncRawWebsite = syncRawWebsite;
exports.getCachedRawWebsite = getCachedRawWebsite;
exports.getRawWebsiteStatus = getRawWebsiteStatus;
exports.listRawPages = listRawPages;
exports.runRawQA = runRawQA;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const RAW_ROOT = process.env.RAW_WEBSITE_ROOT || 'E:/Project/Master/RawSushi/RawWebsite';
const CACHE_DIR = path_1.default.join(process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global', 'mi-core', 'connectors', 'raw-website');
function git(cmd) {
    try {
        return (0, child_process_1.execSync)(`git -C "${RAW_ROOT}" ${cmd}`, { encoding: 'utf-8', timeout: 5000 }).trim();
    }
    catch {
        return '';
    }
}
function parseFrontmatter(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match)
        return {};
    const result = {};
    for (const line of match[1].split('\n')) {
        const [k, ...v] = line.split(':');
        if (k && v.length)
            result[k.trim()] = v.join(':').trim().replace(/^["']|["']$/g, '');
    }
    return result;
}
function scanPages(dir) {
    const pages = [];
    if (!fs_1.default.existsSync(dir))
        return pages;
    function walk(d) {
        const entries = fs_1.default.readdirSync(d, { withFileTypes: true });
        for (const e of entries) {
            const full = path_1.default.join(d, e.name);
            if (e.isDirectory()) {
                walk(full);
                continue;
            }
            if (!/\.(md|mdx|astro)$/.test(e.name))
                continue;
            try {
                const content = fs_1.default.readFileSync(full, 'utf-8').slice(0, 2000);
                const fm = parseFrontmatter(content);
                const rel = path_1.default.relative(RAW_ROOT, full).replace(/\\/g, '/');
                pages.push({
                    slug: rel,
                    title: fm.title || e.name.replace(/\.[^.]+$/, ''),
                    description: fm.description,
                    draft: fm.draft === 'true',
                    path: full.replace(/\\/g, '/'),
                });
            }
            catch { /* skip */ }
        }
    }
    walk(dir);
    return pages;
}
function syncRawWebsite() {
    const now = new Date().toISOString();
    if (!fs_1.default.existsSync(RAW_ROOT)) {
        const snap = {
            synced_at: now, status: 'not_found', root: RAW_ROOT,
            framework: 'astro', git_remote: '', git_branch: '', git_dirty: false,
            last_commit: '', pages: [], content_dirs: [], total_pages: 0,
            seo_issues: [`Root not found: ${RAW_ROOT}`], has_env: false,
            build_ready: false, summary_text: `❌ RawWebsite not found at ${RAW_ROOT}`,
        };
        return snap;
    }
    const remote = git('remote get-url origin 2>/dev/null');
    const branch = git('rev-parse --abbrev-ref HEAD 2>/dev/null');
    const dirty = git('status --porcelain 2>/dev/null').length > 0;
    const lastCommit = git('log -1 --pretty=format:"%s (%ar)" 2>/dev/null');
    // Scan content directories
    const contentDirs = ['src/content', 'content', 'src/pages', 'pages']
        .filter(d => fs_1.default.existsSync(path_1.default.join(RAW_ROOT, d)));
    const pages = [];
    for (const d of contentDirs) {
        pages.push(...scanPages(path_1.default.join(RAW_ROOT, d)));
    }
    // SEO issues
    const seoIssues = [];
    const noTitle = pages.filter(p => !p.title || p.title.length < 5);
    const noDesc = pages.filter(p => !p.description);
    if (noTitle.length)
        seoIssues.push(`${noTitle.length} pages missing title`);
    if (noDesc.length)
        seoIssues.push(`${noDesc.length} pages missing description`);
    const drafts = pages.filter(p => p.draft);
    if (drafts.length)
        seoIssues.push(`${drafts.length} pages are drafts`);
    const snap = {
        synced_at: now,
        status: 'ok',
        root: RAW_ROOT,
        framework: 'astro',
        git_remote: remote,
        git_branch: branch,
        git_dirty: dirty,
        last_commit: lastCommit,
        pages,
        content_dirs: contentDirs,
        total_pages: pages.length,
        seo_issues: seoIssues,
        has_env: fs_1.default.existsSync(path_1.default.join(RAW_ROOT, '.env')),
        build_ready: fs_1.default.existsSync(path_1.default.join(RAW_ROOT, 'package.json')),
        summary_text: [
            `🍣 Raw Sushi Website (${branch || 'no git'})`,
            `  Framework: Astro | Pages: ${pages.length}`,
            `  Git: ${dirty ? '⚠ uncommitted changes' : '✓ clean'} — ${lastCommit.slice(0, 60)}`,
            seoIssues.length ? `  SEO issues: ${seoIssues.join('; ')}` : '  SEO: no issues detected',
        ].join('\n'),
    };
    fs_1.default.mkdirSync(CACHE_DIR, { recursive: true });
    fs_1.default.writeFileSync(path_1.default.join(CACHE_DIR, 'data.json'), JSON.stringify(snap, null, 2));
    fs_1.default.writeFileSync(path_1.default.join(CACHE_DIR, 'summary.json'), JSON.stringify({ total_pages: snap.total_pages, git_dirty: snap.git_dirty, seo_issues: snap.seo_issues.length }, null, 2));
    fs_1.default.writeFileSync(path_1.default.join(CACHE_DIR, 'health.json'), JSON.stringify({ status: snap.status, build_ready: snap.build_ready, synced_at: now }));
    fs_1.default.writeFileSync(path_1.default.join(CACHE_DIR, 'last_sync.json'), JSON.stringify({ synced_at: now }));
    fs_1.default.writeFileSync(path_1.default.join(CACHE_DIR, 'errors.json'), JSON.stringify(seoIssues));
    return snap;
}
function getCachedRawWebsite() {
    try {
        return JSON.parse(fs_1.default.readFileSync(path_1.default.join(CACHE_DIR, 'data.json'), 'utf-8'));
    }
    catch {
        return null;
    }
}
function getRawWebsiteStatus() {
    const c = getCachedRawWebsite();
    if (!c)
        return '🍣 RawWebsite: chưa sync. Gọi syncRawWebsite() để lấy data.';
    return c.summary_text;
}
function listRawPages() {
    return getCachedRawWebsite()?.pages || [];
}
function runRawQA() {
    const snap = syncRawWebsite();
    const issues = [...snap.seo_issues];
    const passed = [];
    if (snap.git_branch)
        passed.push('Git initialized');
    if (snap.build_ready)
        passed.push('package.json present');
    if (snap.total_pages > 0)
        passed.push(`${snap.total_pages} pages found`);
    else
        issues.push('No content pages found');
    if (!snap.git_dirty)
        passed.push('No uncommitted changes');
    else
        issues.push('Has uncommitted changes');
    const score = Math.round((passed.length / (passed.length + issues.length)) * 100);
    return { score, issues, passed };
}
