"use strict";
/**
 * Connector Registry — tracks all platform connectors, their auth/health status.
 * Single source of truth for what Mi can see.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectorRegistry = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const REGISTRY_PATH = path_1.default.join(GLOBAL_DIR, 'visibility', 'connector-registry.json');
const DEFAULT_CONNECTORS = [
    {
        connector_id: 'local-projects',
        name: 'Master Workspace (Local)',
        type: 'local',
        status: 'active',
        auth_status: 'connected',
        last_sync: null,
        read_capability: ['files', 'folders', 'git-status', 'project-health', 'reports', 'source-maps'],
        write_capability: ['files', 'folders'],
        approval_required: false,
        cache_path: 'projects/',
        health_status: 'healthy',
    },
    {
        connector_id: 'dashboard-bakudan',
        name: 'Dashboard bakudanramen.com',
        type: 'local',
        status: 'active',
        auth_status: 'connected',
        last_sync: null,
        read_capability: ['tasks', 'users', 'reports', 'inventory', 'timesheets'],
        write_capability: ['tasks', 'content'],
        approval_required: true,
        cache_path: 'dashboard/',
        health_status: 'unknown',
        config: { base_url: 'http://dashboard.bakudanramen.com', local_path: 'E:/Project/Master/dashboard.bakudanramen.com' },
    },
    {
        connector_id: 'asana',
        name: 'Asana',
        type: 'api',
        status: 'pending',
        auth_status: 'not_configured',
        last_sync: null,
        read_capability: ['tasks', 'projects', 'teams', 'goals'],
        write_capability: ['tasks', 'projects'],
        approval_required: true,
        cache_path: 'asana/',
        health_status: 'unknown',
        setup_hint: 'Set ASANA_TOKEN in .env — get from app.asana.com/0/my-apps',
    },
    {
        connector_id: 'gmail',
        name: 'Gmail',
        type: 'api',
        status: 'pending',
        auth_status: 'not_configured',
        last_sync: null,
        read_capability: ['emails', 'threads', 'labels', 'attachments'],
        write_capability: ['drafts', 'send'],
        approval_required: true,
        cache_path: 'gmail/',
        health_status: 'unknown',
        setup_hint: 'Set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET in .env — Google Cloud Console → OAuth 2.0',
    },
    {
        connector_id: 'google-calendar',
        name: 'Google Calendar',
        type: 'api',
        status: 'pending',
        auth_status: 'not_configured',
        last_sync: null,
        read_capability: ['events', 'calendars', 'reminders'],
        write_capability: ['events'],
        approval_required: true,
        cache_path: 'google-calendar/',
        health_status: 'unknown',
        setup_hint: 'Same OAuth as Gmail — shares GOOGLE_CLIENT_ID/SECRET',
    },
    {
        connector_id: 'google-drive',
        name: 'Google Drive',
        type: 'api',
        status: 'pending',
        auth_status: 'not_configured',
        last_sync: null,
        read_capability: ['files', 'folders', 'docs', 'sheets'],
        write_capability: ['files', 'docs'],
        approval_required: true,
        cache_path: 'google-drive/',
        health_status: 'unknown',
        setup_hint: 'Same OAuth as Gmail — add Drive scope: https://www.googleapis.com/auth/drive.readonly',
    },
    {
        connector_id: 'health-export',
        name: 'Huawei Health Export',
        type: 'export',
        status: 'pending',
        auth_status: 'not_configured',
        last_sync: null,
        read_capability: ['steps', 'sleep', 'heart-rate', 'workouts'],
        write_capability: [],
        approval_required: false,
        cache_path: 'health/',
        health_status: 'unknown',
        setup_hint: 'Export from Huawei Health app → place JSON/XML in .local-agent-global/visibility/health/export/',
    },
    {
        connector_id: 'website-raw',
        name: 'rawsushibar.com',
        type: 'local',
        status: 'active',
        auth_status: 'connected',
        last_sync: null,
        read_capability: ['files', 'content', 'reports', 'qa-results'],
        write_capability: ['content'],
        approval_required: true,
        cache_path: 'websites/raw/',
        health_status: 'unknown',
        config: { local_path: 'E:/Project/Master/RawSushi' },
    },
    {
        connector_id: 'website-bakudan',
        name: 'bakudanramen.com',
        type: 'local',
        status: 'active',
        auth_status: 'connected',
        last_sync: null,
        read_capability: ['files', 'content', 'reports', 'qa-results'],
        write_capability: ['content'],
        approval_required: true,
        cache_path: 'websites/bakudan/',
        health_status: 'unknown',
        config: { local_path: 'E:/Project/Master/Bakudan' },
    },
    {
        connector_id: 'accounting',
        name: 'Accounting Engine',
        type: 'api',
        status: 'active',
        auth_status: 'connected',
        last_sync: null,
        read_capability: ['ledger', 'stats', 'costs', 'patches', 'qa-metrics', 'sessions'],
        write_capability: [],
        approval_required: false,
        cache_path: 'accounting/',
        health_status: 'unknown',
        setup_hint: 'Start: node E:/Project/Master/accounting-engine/api/server.js (port 8844)',
        config: { api_url: 'http://127.0.0.1:8844', db_path: 'E:/Project/Master/accounting-engine/ledgers/accounting.db' },
    },
    {
        connector_id: 'food-safety',
        name: 'Food Safety Gateway',
        type: 'local',
        status: 'active',
        auth_status: 'connected',
        last_sync: null,
        read_capability: ['inspection-records', 'audit-trail', 'stores', 'reports'],
        write_capability: [],
        approval_required: false,
        cache_path: 'food-safety/',
        health_status: 'unknown',
        config: { root_path: 'E:/Project/Master/food-safety-gateway' },
    },
];
function ensureDir(p) {
    if (!fs_1.default.existsSync(p))
        fs_1.default.mkdirSync(p, { recursive: true });
}
function loadRegistry() {
    try {
        return JSON.parse(fs_1.default.readFileSync(REGISTRY_PATH, 'utf-8'));
    }
    catch {
        return DEFAULT_CONNECTORS;
    }
}
function saveRegistry(connectors) {
    ensureDir(path_1.default.dirname(REGISTRY_PATH));
    fs_1.default.writeFileSync(REGISTRY_PATH, JSON.stringify(connectors, null, 2));
}
exports.connectorRegistry = {
    getAll() {
        return loadRegistry();
    },
    getById(id) {
        return loadRegistry().find(c => c.connector_id === id);
    },
    getConnected() {
        return loadRegistry().filter(c => c.auth_status === 'connected' && c.status === 'active');
    },
    update(id, patch) {
        const all = loadRegistry();
        const idx = all.findIndex(c => c.connector_id === id);
        if (idx < 0)
            return null;
        all[idx] = { ...all[idx], ...patch };
        saveRegistry(all);
        return all[idx];
    },
    markSynced(id, health = 'healthy') {
        this.update(id, { last_sync: new Date().toISOString(), health_status: health });
    },
    getSummary() {
        const all = loadRegistry();
        return {
            total: all.length,
            connected: all.filter(c => c.auth_status === 'connected').length,
            not_configured: all.filter(c => c.auth_status === 'not_configured').length,
            healthy: all.filter(c => c.health_status === 'healthy').length,
            connectors: all.map(c => ({
                id: c.connector_id,
                name: c.name,
                auth: c.auth_status,
                health: c.health_status,
                last_sync: c.last_sync,
                setup_hint: c.auth_status !== 'connected' ? c.setup_hint : undefined,
            })),
        };
    },
    init() {
        if (!fs_1.default.existsSync(REGISTRY_PATH)) {
            saveRegistry(DEFAULT_CONNECTORS);
        }
    },
};
