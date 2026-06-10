"use strict";
/**
 * Huawei Health Connector — parses exported JSON/XML from Huawei Health app.
 * Export location: .local-agent-global/visibility/health/export/
 * CONSENT REQUIRED to read health data.
 * Mi does NOT diagnose — only summarizes, reminds, suggests general wellness.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseHealthExport = parseHealthExport;
exports.getHealthSummaryText = getHealthSummaryText;
exports.hasHealthExport = hasHealthExport;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const EXPORT_DIR = path_1.default.join(GLOBAL_DIR, 'visibility', 'health', 'export');
const CACHE_DIR = path_1.default.join(GLOBAL_DIR, 'visibility', 'health');
const DISCLAIMER = 'Mi chỉ tóm tắt dữ liệu sức khỏe. Không phải tư vấn y tế. Anh nên tham khảo bác sĩ cho mọi vấn đề sức khỏe.';
function findLatestExport() {
    if (!fs_1.default.existsSync(EXPORT_DIR))
        return null;
    const files = fs_1.default.readdirSync(EXPORT_DIR)
        .filter(f => /\.(json|xml|csv)$/i.test(f))
        .map(f => ({ name: f, mtime: fs_1.default.statSync(path_1.default.join(EXPORT_DIR, f)).mtime }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    return files.length > 0 ? path_1.default.join(EXPORT_DIR, files[0].name) : null;
}
function parseHuaweiJson(data) {
    // Huawei Health JSON export format (approximated — varies by app version)
    const today = new Date().toISOString().split('T')[0];
    // Try common Huawei export structures
    const motion = data['motionRecord'];
    const sleep = data['sleepRecord'];
    const heart = data['heartRateRecord'];
    return {
        date: data['date'] || today,
        steps: motion?.['step'] || data['steps'],
        distance_km: motion?.['distance'] ? Number((motion?.['distance'] / 1000).toFixed(2)) : undefined,
        calories: motion?.['calories'] || data['calories'],
        sleep_hours: sleep ? Number(((sleep['duration'] || 0) / 60).toFixed(1)) : undefined,
        heart_rate_avg: heart ? Math.round(heart.reduce((s, h) => s + (h['heartRate'] || 0), 0) / heart.length) : undefined,
    };
}
function parseCsvExport(content) {
    const lines = content.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const lastRow = lines[lines.length - 1].split(',');
    const row = {};
    headers.forEach((h, i) => { row[h] = (lastRow[i] || '').trim(); });
    return {
        date: row['date'] || row['day'] || new Date().toISOString().split('T')[0],
        steps: row['steps'] ? parseInt(row['steps']) : undefined,
        sleep_hours: row['sleep'] || row['sleep_hours'] ? parseFloat(row['sleep'] || row['sleep_hours']) : undefined,
        heart_rate_avg: row['heart_rate'] || row['avg_hr'] ? parseInt(row['heart_rate'] || row['avg_hr']) : undefined,
        calories: row['calories'] ? parseInt(row['calories']) : undefined,
    };
}
function parseHealthExport() {
    const exportFile = findLatestExport();
    if (!exportFile)
        return null;
    const content = fs_1.default.readFileSync(exportFile, 'utf-8');
    const ext = path_1.default.extname(exportFile).toLowerCase();
    let parsed = {};
    try {
        if (ext === '.json') {
            const data = JSON.parse(content);
            // Handle array of days
            const record = Array.isArray(data) ? data[data.length - 1] : data;
            parsed = parseHuaweiJson(record);
        }
        else if (ext === '.csv') {
            parsed = parseCsvExport(content);
        }
        else if (ext === '.xml') {
            // Basic XML parsing for Huawei format
            const steps = content.match(/<step[s]?>(\d+)<\/step[s]?>/i);
            const sleep = content.match(/<sleep[^>]*duration="(\d+)"/i);
            parsed = {
                steps: steps ? parseInt(steps[1]) : undefined,
                sleep_hours: sleep ? Number((parseInt(sleep[1]) / 60).toFixed(1)) : undefined,
            };
        }
    }
    catch (e) {
        console.error('[Health Connector] parse error:', e);
        return null;
    }
    const summary = {
        date: parsed.date || new Date().toISOString().split('T')[0],
        steps: parsed.steps,
        steps_goal: 10000,
        distance_km: parsed.distance_km,
        calories: parsed.calories,
        sleep_hours: parsed.sleep_hours,
        sleep_quality: parsed.sleep_hours
            ? parsed.sleep_hours >= 7 ? 'good' : parsed.sleep_hours >= 5 ? 'fair' : 'poor'
            : undefined,
        heart_rate_avg: parsed.heart_rate_avg,
        heart_rate_max: parsed.heart_rate_max,
        active_minutes: parsed.active_minutes,
        source_file: path_1.default.basename(exportFile),
        parsed_at: new Date().toISOString(),
        disclaimer: DISCLAIMER,
    };
    // Cache (without raw sensitive data)
    fs_1.default.mkdirSync(CACHE_DIR, { recursive: true });
    fs_1.default.writeFileSync(path_1.default.join(CACHE_DIR, 'summary.json'), JSON.stringify({
        date: summary.date, steps: summary.steps, sleep_hours: summary.sleep_hours,
        heart_rate_avg: summary.heart_rate_avg, disclaimer: DISCLAIMER,
    }, null, 2));
    fs_1.default.writeFileSync(path_1.default.join(CACHE_DIR, 'last_sync.json'), JSON.stringify({ synced_at: new Date().toISOString() }));
    return summary;
}
function getHealthSummaryText() {
    const data = parseHealthExport();
    if (!data)
        return 'Chưa có dữ liệu sức khỏe. Anh export từ Huawei Health app và đặt file vào .local-agent-global/visibility/health/export/';
    const lines = [`📊 Sức khỏe ${data.date}:`];
    if (data.steps)
        lines.push(`👟 Bước chân: ${data.steps.toLocaleString()}/${(data.steps_goal || 10000).toLocaleString()}`);
    if (data.sleep_hours)
        lines.push(`😴 Giấc ngủ: ${data.sleep_hours}h (${data.sleep_quality || '—'})`);
    if (data.heart_rate_avg)
        lines.push(`❤️ Nhịp tim TB: ${data.heart_rate_avg} bpm`);
    if (data.calories)
        lines.push(`🔥 Calories: ${data.calories}`);
    if (data.distance_km)
        lines.push(`📍 Quãng đường: ${data.distance_km} km`);
    lines.push(`\n⚠️ ${data.disclaimer}`);
    return lines.join('\n');
}
function hasHealthExport() {
    return !!findLatestExport();
}
