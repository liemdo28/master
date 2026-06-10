"use strict";
/**
 * Data Analyst Pipeline Handler (TypeScript)
 * Bridges chat pipeline to data analyst JS modules.
 * Handles: file ingestion, analysis questions, report generation.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDataAnalystMessage = isDataAnalystMessage;
exports.handleDataAnalystMessage = handleDataAnalystMessage;
exports.buildDataAnalystRouteContext = buildDataAnalystRouteContext;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const DATA_DIR = path_1.default.join(GLOBAL_DIR, 'data-analyst');
const CATALOG_FILE = path_1.default.join(DATA_DIR, 'dataset_catalog.json');
const LAST_ANALYSIS_FILE = path_1.default.join(DATA_DIR, 'last_analysis.json');
// ── Intent Detection ─────────────────────────────────────────────────────────
function isDataAnalystMessage(message) {
    return /phân tích|analyze.*file|doanh thu.*file|file.*doanh|ngày nào.*cao nhất|giờ nào.*bán|món nào.*bán chạy|món nào.*chậm|cơ hội.*tăng|store nào.*giảm|tạo report|generate.*report|xuất báo cáo|week.*over.*week|tuần sau|revenue.*by|sales.*data|load.*data|import.*data|read.*csv|read.*excel|đọc file.*csv|đọc file.*xlsx/i.test(message);
}
// ── Catalog Reader ────────────────────────────────────────────────────────────
function getCatalog() {
    try {
        return JSON.parse(fs_1.default.readFileSync(CATALOG_FILE, 'utf-8'));
    }
    catch {
        return { datasets: [] };
    }
}
function getLastAnalysis() {
    try {
        return JSON.parse(fs_1.default.readFileSync(LAST_ANALYSIS_FILE, 'utf-8'));
    }
    catch {
        return null;
    }
}
// ── Message Handlers ─────────────────────────────────────────────────────────
function handleDataAnalystMessage(message) {
    const q = message.toLowerCase();
    // "show datasets" / "datasets nào đang có?"
    if (/dataset|imported|đã import|file nào đã load|dữ liệu đang có/i.test(message)) {
        const catalog = getCatalog();
        if (catalog.datasets.length === 0) {
            return `📊 Chưa có dataset nào được import.\n\nĐể phân tích doanh thu, hãy:\n1. Tìm file: "Tìm file doanh thu"\n2. Phân tích: "Phân tích file [tên file]"\n3. Hoặc drop file CSV/Excel vào Mi`;
        }
        const list = catalog.datasets.slice(0, 5).map((d, i) => `${i + 1}. **${d['file_name']}** (${d['row_count']} rows, ${d['confidence']}% confidence, ${d['period'] || 'unknown period'})`).join('\n');
        return `📊 Datasets đã import (${catalog.datasets.length}):\n${list}\n\nHỏi: "Ngày nào cao nhất?", "Giờ nào tốt nhất?", "Tạo report tuần này"`;
    }
    // "last analysis" / "phân tích gần nhất"
    if (/last.*analysis|phân tích gần nhất|kết quả phân tích|báo cáo gần nhất/i.test(message)) {
        const last = getLastAnalysis();
        if (!last) {
            return `📊 Chưa có phân tích nào. Upload file doanh thu để bắt đầu.`;
        }
        const summary = last['summary'];
        if (summary) {
            return `📊 Phân tích gần nhất (${last['generated_at']}):\n` +
                `- Tổng doanh thu: $${summary['total_revenue'] || 0}\n` +
                `- Kỳ: ${summary['date_range']?.from || '?'} → ${summary['date_range']?.to || '?'}\n` +
                `- ${summary['total_rows'] || 0} rows | ${summary['unique_items'] || 0} items\n\n` +
                `Hỏi chi tiết: "Ngày nào cao nhất?", "Món nào bán chạy?"`;
        }
        return `Có phân tích gần nhất nhưng không đọc được summary. Dataset ID: ${last['dataset_id']}`;
    }
    // "find sales file" / "tìm file doanh thu"
    if (/tìm.*file.*doanh|find.*sales.*file|file.*revenue|file.*doanh thu/i.test(message)) {
        return buildFileFindInstructions();
    }
    return null; // Fall through to AI
}
function buildFileFindInstructions() {
    const searchRoot = 'E:/Project/Master';
    const common = [
        `${searchRoot}/Raw/sales/`,
        `${searchRoot}/Bakudan/revenue/`,
        `${searchRoot}/reports/`,
    ];
    return `📁 Tìm file doanh thu trong:\n${common.map(p => `- ${p}`).join('\n')}\n\n` +
        `**Để phân tích:** "Phân tích file E:/path/to/file.csv"\n` +
        `**Hỗ trợ:** CSV, Excel (.xlsx/.xls), JSON, PDF, Word (.docx)\n` +
        `**Không hỗ trợ:** Files nhạy cảm (.env, credentials, keys)`;
}
// ── Route Handler for /api/data-analyst ─────────────────────────────────────
function buildDataAnalystRouteContext(message) {
    const catalog = getCatalog();
    const last = getLastAnalysis();
    if (catalog.datasets.length === 0 && !last) {
        return {
            contextLine: '[DataAnalyst] No datasets loaded. Suggest CEO to upload a CSV/Excel file.',
            shouldInjectToAI: true,
        };
    }
    const lines = ['[DataAnalyst Context]'];
    if (catalog.datasets.length > 0) {
        const d = catalog.datasets[0];
        lines.push(`Latest dataset: ${d['file_name']} (${d['row_count']} rows, ${d['confidence']}% confidence, period: ${d['period'] || 'unknown'})`);
    }
    if (last) {
        const s = last['summary'] || {};
        lines.push(`Last analysis: total_revenue=$${s['total_revenue'] || 0}, rows=${s['total_rows'] || 0}, items=${s['unique_items'] || 0}`);
    }
    return {
        contextLine: lines.join('\n'),
        shouldInjectToAI: true,
    };
}
