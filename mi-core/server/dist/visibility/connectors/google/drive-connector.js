"use strict";
/**
 * Google Drive Connector — lists recent files, searches docs.
 * Read-only. Caches to .local-agent-global/visibility/google-drive/
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncDrive = syncDrive;
exports.getCachedDrive = getCachedDrive;
exports.searchDriveFiles = searchDriveFiles;
const googleapis_1 = require("googleapis");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const google_auth_1 = require("./google-auth");
const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const CACHE_DIR = path_1.default.join(GLOBAL_DIR, 'visibility', 'google-drive');
const MIME_LABELS = {
    'application/vnd.google-apps.document': 'Google Doc',
    'application/vnd.google-apps.spreadsheet': 'Google Sheet',
    'application/vnd.google-apps.presentation': 'Google Slides',
    'application/vnd.google-apps.folder': 'Folder',
    'application/pdf': 'PDF',
};
async function syncDrive(maxFiles = 50) {
    const auth = await (0, google_auth_1.getAuthedClient)();
    const drive = googleapis_1.google.drive({ version: 'v3', auth });
    const res = await drive.files.list({
        pageSize: maxFiles,
        fields: 'files(id,name,mimeType,modifiedTime,size,webViewLink,owners,shared,parents)',
        orderBy: 'modifiedTime desc',
        q: "trashed=false",
    });
    const files = (res.data.files || []).map(f => ({
        id: f.id || '',
        name: f.name || '',
        mime_type: MIME_LABELS[f.mimeType || ''] || f.mimeType || '',
        modified_at: f.modifiedTime || '',
        size: f.size || undefined,
        web_link: f.webViewLink || '',
        owner: f.owners?.[0]?.displayName || f.owners?.[0]?.emailAddress || '',
        shared: f.shared || false,
        parent_folder: f.parents?.[0],
    }));
    const snapshot = {
        synced_at: new Date().toISOString(),
        recent_files: files,
        total_found: files.length,
    };
    fs_1.default.mkdirSync(CACHE_DIR, { recursive: true });
    fs_1.default.writeFileSync(path_1.default.join(CACHE_DIR, 'data.json'), JSON.stringify(snapshot, null, 2));
    fs_1.default.writeFileSync(path_1.default.join(CACHE_DIR, 'summary.json'), JSON.stringify({
        total: files.length, synced_at: snapshot.synced_at,
    }, null, 2));
    fs_1.default.writeFileSync(path_1.default.join(CACHE_DIR, 'last_sync.json'), JSON.stringify({ synced_at: snapshot.synced_at }));
    fs_1.default.writeFileSync(path_1.default.join(CACHE_DIR, 'errors.json'), JSON.stringify([]));
    return snapshot;
}
function getCachedDrive() {
    try {
        return JSON.parse(fs_1.default.readFileSync(path_1.default.join(CACHE_DIR, 'data.json'), 'utf-8'));
    }
    catch {
        return null;
    }
}
function searchDriveFiles(query) {
    const cached = getCachedDrive();
    if (!cached)
        return [];
    const q = query.toLowerCase();
    return cached.recent_files.filter(f => f.name.toLowerCase().includes(q));
}
