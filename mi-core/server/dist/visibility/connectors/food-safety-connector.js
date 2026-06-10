"use strict";
/**
 * Food Safety Gateway Connector
 * Reads submission records and inspection status from food-safety-gateway.
 * File-based (RecordStore uses JSON) — no separate service needed.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncFoodSafety = syncFoodSafety;
exports.getCachedFoodSafety = getCachedFoodSafety;
exports.getFoodSafetySummaryText = getFoodSafetySummaryText;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const GATEWAY_ROOT = process.env.FOOD_SAFETY_ROOT ||
    'E:/Project/Master/food-safety-gateway';
const RECORD_FILE = path_1.default.join(GATEWAY_ROOT, 'data', 'records.json');
const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
function syncFoodSafety() {
    const now = new Date().toISOString();
    try {
        // Try to read RecordStore JSON file
        let records = [];
        // Check multiple possible paths
        const candidates = [
            RECORD_FILE,
            path_1.default.join(GATEWAY_ROOT, 'records.json'),
            path_1.default.join(GLOBAL_DIR, 'food-safety', 'records.json'),
        ];
        for (const candidate of candidates) {
            if (fs_1.default.existsSync(candidate)) {
                const raw = fs_1.default.readFileSync(candidate, 'utf-8');
                records = JSON.parse(raw);
                break;
            }
        }
        if (records.length === 0) {
            const snap = {
                synced_at: now,
                total_records: 0,
                pending_sync: 0,
                recent_submissions: [],
                stores: [],
                status: 'no_data',
                summary_text: '🍱 Food Safety Gateway: Chưa có dữ liệu kiểm tra. Pilot chưa bắt đầu.',
            };
            cacheSnapshot(snap);
            return snap;
        }
        const pending = records.filter(r => r.sync_status === 'PENDING').length;
        const stores = [...new Set(records.map(r => r.store || 'unknown').filter(Boolean))];
        const recent = [...records]
            .sort((a, b) => new Date(b.submitted_at || 0).getTime() - new Date(a.submitted_at || 0).getTime())
            .slice(0, 10);
        const passCount = records.filter(r => r.status === 'passed' || (r.score !== undefined && r.score >= 80)).length;
        const failCount = records.filter(r => r.status === 'failed' || (r.score !== undefined && r.score < 80)).length;
        const summaryLines = [
            `🍱 Food Safety Gateway`,
            `  Tổng kiểm tra: ${records.length}`,
            `  Đạt: ${passCount} | Không đạt: ${failCount}`,
            `  Chưa sync GSheet: ${pending}`,
            `  Stores: ${stores.join(', ') || 'N/A'}`,
        ];
        if (recent[0]?.submitted_at) {
            summaryLines.push(`  Gần nhất: ${new Date(recent[0].submitted_at).toLocaleDateString('vi-VN')}`);
        }
        const snap = {
            synced_at: now,
            total_records: records.length,
            pending_sync: pending,
            recent_submissions: recent,
            stores,
            status: 'ok',
            summary_text: summaryLines.join('\n'),
        };
        cacheSnapshot(snap);
        return snap;
    }
    catch (e) {
        const snap = {
            synced_at: now,
            total_records: 0,
            pending_sync: 0,
            recent_submissions: [],
            stores: [],
            status: 'error',
            summary_text: `🍱 Food Safety Gateway: Lỗi đọc dữ liệu — ${e.message}`,
        };
        return snap;
    }
}
function cacheSnapshot(snap) {
    const cacheDir = path_1.default.join(GLOBAL_DIR, 'visibility', 'food-safety');
    fs_1.default.mkdirSync(cacheDir, { recursive: true });
    fs_1.default.writeFileSync(path_1.default.join(cacheDir, 'data.json'), JSON.stringify(snap, null, 2));
    fs_1.default.writeFileSync(path_1.default.join(cacheDir, 'last_sync.json'), JSON.stringify({ synced_at: snap.synced_at, status: snap.status }));
}
function getCachedFoodSafety() {
    try {
        return JSON.parse(fs_1.default.readFileSync(path_1.default.join(GLOBAL_DIR, 'visibility', 'food-safety', 'data.json'), 'utf-8'));
    }
    catch {
        return null;
    }
}
function getFoodSafetySummaryText() {
    const cached = getCachedFoodSafety();
    if (!cached)
        return '🍱 Food Safety: Chưa sync.';
    return cached.summary_text;
}
