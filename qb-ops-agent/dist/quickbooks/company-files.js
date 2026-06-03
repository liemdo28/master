"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTrackedCompanyFiles = exports.addConfiguredCompanyFile = exports.syncConfiguredCompanyFiles = exports.loadConfiguredCompanyFiles = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const local_db_1 = require("../storage/local-db");
const logs_1 = require("../storage/logs");
const SETTINGS_FILE = path_1.default.join(process.cwd(), 'data', 'company-files.json');
function ensureSettingsFile() {
    const dir = path_1.default.dirname(SETTINGS_FILE);
    if (!fs_1.default.existsSync(dir))
        fs_1.default.mkdirSync(dir, { recursive: true });
    if (!fs_1.default.existsSync(SETTINGS_FILE))
        fs_1.default.writeFileSync(SETTINGS_FILE, '[]', 'utf8');
}
function hashPath(filePath) {
    return crypto_1.default.createHash('sha256').update(filePath.toLowerCase()).digest('hex').slice(0, 32);
}
function loadConfiguredCompanyFiles() {
    ensureSettingsFile();
    const raw = fs_1.default.readFileSync(SETTINGS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed.map((file) => ({
        company_file_id: file.company_file_id || hashPath(file.company_file_path || ''),
        company_name: file.company_name || null,
        company_file_path: file.company_file_path || '',
        assigned_store: file.assigned_store || null,
        assigned_department: file.assigned_department || null,
        notes: file.notes || null,
    })).filter(f => !!f.company_file_path);
}
exports.loadConfiguredCompanyFiles = loadConfiguredCompanyFiles;
function syncConfiguredCompanyFiles(machineId) {
    const configured = loadConfiguredCompanyFiles();
    const now = new Date().toISOString();
    for (const file of configured) {
        (0, local_db_1.upsertCompanyFile)({
            company_file_id: file.company_file_id,
            company_name: file.company_name,
            company_file_path: file.company_file_path,
            last_opened_at: null,
            last_checked_at: now,
            status: fs_1.default.existsSync(file.company_file_path) ? 'configured' : 'missing',
            assigned_store: file.assigned_store,
            assigned_department: file.assigned_department,
            notes: file.notes,
            machine_id: machineId,
            created_at: now,
            updated_at: now,
        });
    }
    const result = (0, local_db_1.getCompanyFiles)(machineId);
    logs_1.logger.info('Configured company files synchronized', { machineId, count: result.length });
    return result;
}
exports.syncConfiguredCompanyFiles = syncConfiguredCompanyFiles;
function addConfiguredCompanyFile(machineId, filePath, companyName) {
    const existing = loadConfiguredCompanyFiles();
    const normalizedPath = path_1.default.normalize(filePath);
    const item = {
        company_file_id: hashPath(normalizedPath),
        company_name: companyName || path_1.default.basename(normalizedPath, path_1.default.extname(normalizedPath)),
        company_file_path: normalizedPath,
        assigned_store: null,
        assigned_department: null,
        notes: null,
    };
    const deduped = existing.filter(f => f.company_file_path.toLowerCase() !== normalizedPath.toLowerCase());
    deduped.push(item);
    fs_1.default.writeFileSync(SETTINGS_FILE, JSON.stringify(deduped, null, 2), 'utf8');
    syncConfiguredCompanyFiles(machineId);
    return item;
}
exports.addConfiguredCompanyFile = addConfiguredCompanyFile;
function getTrackedCompanyFiles(machineId) {
    return (0, local_db_1.getCompanyFiles)(machineId);
}
exports.getTrackedCompanyFiles = getTrackedCompanyFiles;
//# sourceMappingURL=company-files.js.map