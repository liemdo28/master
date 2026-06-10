"use strict";
/**
 * PC Connector — read-only scan of local filesystem, processes, ports.
 * All reads are Level 1 (auto-allowed). No writes here.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanProjects = scanProjects;
exports.searchFiles = searchFiles;
exports.getRunningProcesses = getRunningProcesses;
exports.getListeningPorts = getListeningPorts;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const MASTER_ROOT = process.env.MASTER_ROOT || 'E:/Project/Master';
const SCAN_DEPTH = 2;
function detectProjectType(dir) {
    const files = fs_1.default.readdirSync(dir).map(f => f.toLowerCase());
    if (files.includes('package.json'))
        return 'node';
    if (files.includes('requirements.txt') || files.includes('pyproject.toml'))
        return 'python';
    if (files.includes('composer.json'))
        return 'php';
    if (files.some(f => f.endsWith('.go')))
        return 'go';
    if (files.includes('cargo.toml'))
        return 'rust';
    return 'unknown';
}
function scanProjects(rootDir = MASTER_ROOT) {
    const results = [];
    try {
        const entries = fs_1.default.readdirSync(rootDir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory())
                continue;
            if (entry.name.startsWith('.') || entry.name.startsWith('_'))
                continue;
            const fullPath = path_1.default.join(rootDir, entry.name);
            try {
                const stat = fs_1.default.statSync(fullPath);
                results.push({
                    name: entry.name,
                    path: fullPath,
                    type: detectProjectType(fullPath),
                    has_package_json: fs_1.default.existsSync(path_1.default.join(fullPath, 'package.json')),
                    has_git: fs_1.default.existsSync(path_1.default.join(fullPath, '.git')),
                    last_modified: stat.mtime.toISOString(),
                });
            }
            catch { /* skip inaccessible */ }
        }
    }
    catch (e) {
        console.error('[PC Connector] scanProjects error:', e);
    }
    return results.sort((a, b) => new Date(b.last_modified).getTime() - new Date(a.last_modified).getTime());
}
function searchFiles(query, rootDir = MASTER_ROOT) {
    const results = [];
    const q = query.toLowerCase();
    function walk(dir, depth) {
        if (depth > SCAN_DEPTH)
            return;
        try {
            const entries = fs_1.default.readdirSync(dir, { withFileTypes: true });
            for (const e of entries) {
                if (e.name.startsWith('.') || e.name === 'node_modules')
                    continue;
                const full = path_1.default.join(dir, e.name);
                if (e.name.toLowerCase().includes(q))
                    results.push(full);
                if (e.isDirectory())
                    walk(full, depth + 1);
                if (results.length >= 50)
                    return;
            }
        }
        catch { /* skip */ }
    }
    walk(rootDir, 0);
    return results;
}
function getRunningProcesses() {
    try {
        const out = (0, child_process_1.execSync)('wmic process get ProcessId,Name,WorkingSetSize /format:csv 2>nul', { encoding: 'utf-8', timeout: 5000 });
        return out.split('\n')
            .slice(2)
            .filter(l => l.trim())
            .map(line => {
            const parts = line.split(',');
            return { name: parts[1]?.trim() || '', pid: parts[2]?.trim() || '', mem: parts[3]?.trim() };
        })
            .filter(p => p.name && p.pid)
            .slice(0, 30);
    }
    catch {
        return [];
    }
}
function getListeningPorts() {
    try {
        const out = (0, child_process_1.execSync)('netstat -ano | findstr LISTENING', { encoding: 'utf-8', timeout: 5000 });
        const seen = new Set();
        return out.split('\n')
            .filter(l => l.includes('LISTENING'))
            .map(line => {
            const parts = line.trim().split(/\s+/);
            const addr = parts[1] || '';
            const port = addr.split(':').pop() || '';
            const pid = parts[4] || '';
            return { port, pid };
        })
            .filter(p => p.port && !seen.has(p.port) && seen.add(p.port))
            .sort((a, b) => parseInt(a.port) - parseInt(b.port));
    }
    catch {
        return [];
    }
}
