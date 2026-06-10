"use strict";
/**
 * Stub Connector — for not-yet-configured platforms (Asana, Gmail, Calendar, Drive, Health).
 * Returns a clear "not configured" status with setup instructions.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStubResult = getStubResult;
exports.readHealthExport = readHealthExport;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const STUBS = {
    asana: {
        message: 'Asana chưa được kết nối.',
        hint: 'Thêm ASANA_TOKEN vào .env. Lấy token tại: app.asana.com → My Profile → Apps → Personal Access Tokens.',
    },
    gmail: {
        message: 'Gmail chưa được kết nối.',
        hint: 'Cần Google OAuth 2.0. Thêm GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + GOOGLE_REFRESH_TOKEN vào .env.',
    },
    'google-calendar': {
        message: 'Google Calendar chưa được kết nối.',
        hint: 'Dùng chung OAuth với Gmail. Cần thêm scope: https://www.googleapis.com/auth/calendar.readonly',
    },
    'google-drive': {
        message: 'Google Drive chưa được kết nối.',
        hint: 'Dùng chung OAuth với Gmail. Cần thêm scope: https://www.googleapis.com/auth/drive.readonly',
    },
    'health-export': {
        message: 'Huawei Health chưa được kết nối.',
        hint: 'Export file từ Huawei Health app → đặt vào .local-agent-global/visibility/health/export/. Hỗ trợ JSON hoặc XML.',
    },
};
function getStubResult(connectorId) {
    const stub = STUBS[connectorId] || {
        message: `Connector "${connectorId}" chưa được cấu hình.`,
        hint: 'Kiểm tra connector-registry.json để xem hướng dẫn setup.',
    };
    // Check if there's cached data from a previous sync
    const cachePath = path_1.default.join(GLOBAL_DIR, 'visibility', connectorId.replace('-', '/'), 'data.json');
    let cachedData;
    try {
        cachedData = JSON.parse(fs_1.default.readFileSync(cachePath, 'utf-8'));
    }
    catch { /* no cache */ }
    return {
        connector_id: connectorId,
        status: 'not_configured',
        message: stub.message,
        setup_hint: stub.hint,
        cache_exists: !!cachedData,
        cached_data: cachedData,
    };
}
function readHealthExport() {
    const exportDir = path_1.default.join(GLOBAL_DIR, 'visibility', 'health', 'export');
    if (!fs_1.default.existsSync(exportDir))
        return null;
    const files = fs_1.default.readdirSync(exportDir).filter(f => /\.(json|xml)$/i.test(f));
    if (!files.length)
        return null;
    try {
        const latest = files.sort().pop();
        const raw = fs_1.default.readFileSync(path_1.default.join(exportDir, latest), 'utf-8');
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
