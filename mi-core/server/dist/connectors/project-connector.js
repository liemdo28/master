"use strict";
/**
 * Project Connector — reads project health from Master Workspace.
 * Checks git status, package.json, QA reports, recent changes.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProjectHealth = getProjectHealth;
exports.getAllProjectHealth = getAllProjectHealth;
exports.getProjectsWithIssues = getProjectsWithIssues;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const MASTER_ROOT = process.env.MASTER_ROOT || 'E:/Project/Master';
function runGit(cmd, cwd) {
    try {
        return (0, child_process_1.execSync)(cmd, { cwd, encoding: 'utf-8', timeout: 5000 }).trim();
    }
    catch {
        return '';
    }
}
function getProjectHealth(projectPath) {
    const name = path_1.default.basename(projectPath);
    const issues = [];
    const hasGit = fs_1.default.existsSync(path_1.default.join(projectPath, '.git'));
    let git_branch;
    let git_dirty;
    let git_ahead;
    let last_commit;
    if (hasGit) {
        git_branch = runGit('git rev-parse --abbrev-ref HEAD', projectPath);
        const status = runGit('git status --porcelain', projectPath);
        git_dirty = status.length > 0;
        if (git_dirty)
            issues.push(`${status.split('\n').length} uncommitted changes`);
        const ahead = runGit('git rev-list @{u}..HEAD --count 2>/dev/null || echo 0', projectPath);
        git_ahead = parseInt(ahead) || 0;
        if (git_ahead > 0)
            issues.push(`${git_ahead} commits ahead of remote`);
        last_commit = runGit('git log -1 --format="%h %s (%ar)" 2>/dev/null', projectPath);
    }
    // Check for error indicators
    const hasErrors = ['error.log', 'crash.log'].some(f => fs_1.default.existsSync(path_1.default.join(projectPath, f)));
    if (hasErrors)
        issues.push('Error log found');
    // Check QA reports
    let qa_status;
    const qaDir = path_1.default.join(projectPath, 'qa-reports');
    if (fs_1.default.existsSync(qaDir)) {
        const reports = fs_1.default.readdirSync(qaDir).filter(f => f.endsWith('.json'));
        if (reports.length > 0) {
            try {
                const latest = reports.sort().pop();
                const report = JSON.parse(fs_1.default.readFileSync(path_1.default.join(qaDir, latest), 'utf-8'));
                qa_status = report.status || report.result || 'unknown';
                if (qa_status === 'fail' || qa_status === 'error')
                    issues.push('QA failed');
            }
            catch { /* skip */ }
        }
    }
    return { name, path: projectPath, git_branch, git_dirty, git_ahead, last_commit, qa_status, issues };
}
function getAllProjectHealth() {
    const results = [];
    try {
        const entries = fs_1.default.readdirSync(MASTER_ROOT, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name.startsWith('_'))
                continue;
            const fullPath = path_1.default.join(MASTER_ROOT, entry.name);
            results.push(getProjectHealth(fullPath));
        }
    }
    catch (e) {
        console.error('[Project Connector]', e);
    }
    return results;
}
function getProjectsWithIssues() {
    return getAllProjectHealth().filter(p => p.issues.length > 0);
}
