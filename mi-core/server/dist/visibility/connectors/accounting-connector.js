"use strict";
/**
 * Accounting Engine Connector
 * Proxies to accounting-engine API server (port 8844).
 * Falls back to reading accounting.db directly via summary if service is offline.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncAccounting = syncAccounting;
exports.getCachedAccounting = getCachedAccounting;
exports.getAccountingSummaryText = getAccountingSummaryText;
const http_1 = __importDefault(require("http"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const ACCOUNTING_URL = process.env.ACCOUNTING_URL || 'http://127.0.0.1:8844';
const DB_PATH = process.env.ACCOUNTING_DB_PATH ||
    'E:/Project/Master/accounting-engine/ledgers/accounting.db';
async function fetchAccounting(path) {
    return new Promise((resolve, reject) => {
        const url = new URL(ACCOUNTING_URL + path);
        const req = http_1.default.get({ hostname: url.hostname, port: parseInt(url.port || '8844'), path: url.pathname }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => { try {
                resolve(JSON.parse(data));
            }
            catch {
                resolve(null);
            } });
        });
        req.setTimeout(3000, () => { req.destroy(); reject(new Error('timeout')); });
        req.on('error', reject);
    });
}
async function syncAccounting() {
    const now = new Date().toISOString();
    // Try live API first
    try {
        const [stats, costs] = await Promise.all([
            fetchAccounting('/api/stats'),
            fetchAccounting('/api/costs'),
        ]);
        const ledgerRes = await fetchAccounting('/api/stats/ledger');
        const ledgerOk = ledgerRes?.ok !== false;
        const snap = {
            status: 'live',
            synced_at: now,
            stats: stats,
            costs: costs,
            ledger_ok: ledgerOk,
            summary_text: buildSummaryText(stats, costs, ledgerOk),
        };
        // Cache to global dir
        const cacheDir = path_1.default.join(process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global', 'visibility', 'accounting');
        fs_1.default.mkdirSync(cacheDir, { recursive: true });
        fs_1.default.writeFileSync(path_1.default.join(cacheDir, 'data.json'), JSON.stringify(snap, null, 2));
        fs_1.default.writeFileSync(path_1.default.join(cacheDir, 'last_sync.json'), JSON.stringify({ synced_at: now, status: 'live' }));
        return snap;
    }
    catch {
        // Offline — return cached if available
        const cacheFile = path_1.default.join(process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global', 'visibility', 'accounting', 'data.json');
        if (fs_1.default.existsSync(cacheFile)) {
            const cached = JSON.parse(fs_1.default.readFileSync(cacheFile, 'utf-8'));
            return { ...cached, status: 'offline', synced_at: now };
        }
        return {
            status: 'offline',
            synced_at: now,
            summary_text: 'Accounting engine offline. Start: node E:/Project/Master/accounting-engine/api/server.js',
        };
    }
}
function buildSummaryText(stats, costs, ledgerOk) {
    const lines = ['📊 Accounting Engine'];
    if (stats) {
        if (stats.total_patches !== undefined)
            lines.push(`  Patches: ${stats.total_patches}`);
        if (stats.total_sessions !== undefined)
            lines.push(`  Sessions: ${stats.total_sessions}`);
        if (stats.success_rate !== undefined)
            lines.push(`  Success rate: ${stats.success_rate}%`);
    }
    if (costs) {
        if (costs.total_cost !== undefined)
            lines.push(`  Total cost: $${costs.total_cost}`);
        if (costs.today !== undefined)
            lines.push(`  Today: $${costs.today}`);
    }
    lines.push(`  Ledger: ${ledgerOk ? '✓ verified' : '⚠ check needed'}`);
    return lines.join('\n');
}
function getCachedAccounting() {
    try {
        const cacheFile = path_1.default.join(process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global', 'visibility', 'accounting', 'data.json');
        return JSON.parse(fs_1.default.readFileSync(cacheFile, 'utf-8'));
    }
    catch {
        return null;
    }
}
function getAccountingSummaryText() {
    const cached = getCachedAccounting();
    if (!cached)
        return 'Accounting data chưa có — chưa sync.';
    return cached.summary_text + (cached.status === 'offline' ? '\n  ⚠ (cached, service offline)' : '');
}
