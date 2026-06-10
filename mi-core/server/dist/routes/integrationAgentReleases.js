"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.integrationAgentReleasesRouter = void 0;
/**
 * integrationAgentReleases.ts
 * Routes:
 *   GET  /api/integration-agent/releases/latest
 *   GET  /api/integration-agent/releases/:version
 *   POST /api/integration-agent/releases         (publish new release, auth required)
 *   POST /api/integration-agent/update-events    (agent reports update events, auth required)
 *   GET  /api/integration-agent/update-events    (CEO dashboard, auth required)
 *   GET  /api/integration-agent/machines/versions (CEO dashboard)
 */
const express_1 = require("express");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const releaseService = __importStar(require("../services/integrationAgentReleaseService"));
exports.integrationAgentReleasesRouter = (0, express_1.Router)();
// ── Auth middleware (Bearer token same as QB Agent) ───────────────────────────
function requireAuth(req, res, next) {
    const apiKey = process.env.MI_CORE_API_KEY || '';
    const auth = req.headers.authorization || '';
    if (!apiKey || auth === `Bearer ${apiKey}`) {
        next();
        return;
    }
    res.status(401).json({ error: 'Unauthorized' });
}
// ── GET /api/integration-agent/releases/latest ────────────────────────────────
exports.integrationAgentReleasesRouter.get('/releases/latest', (req, res) => {
    const manifest = releaseService.getLatestManifest();
    if (!manifest) {
        res.status(404).json({ error: 'No releases published yet' });
        return;
    }
    res.json(manifest);
});
// ── GET /api/integration-agent/releases/:version ──────────────────────────────
exports.integrationAgentReleasesRouter.get('/releases/:version', (req, res) => {
    const { version } = req.params;
    const manifest = releaseService.getManifest(version);
    if (!manifest) {
        res.status(404).json({ error: `Version ${version} not found` });
        return;
    }
    res.json(manifest);
});
// ── POST /api/integration-agent/releases ─────────────────────────────────────
exports.integrationAgentReleasesRouter.post('/releases', requireAuth, (req, res) => {
    const body = req.body;
    if (!body.version || !body.download_url) {
        res.status(400).json({ error: 'version and download_url are required' });
        return;
    }
    const manifest = {
        app: 'integration-system',
        channel: body.channel || 'stable',
        version: body.version,
        build: body.build || '',
        published_at: body.published_at || new Date().toISOString(),
        min_supported_version: body.min_supported_version || '0.0.0',
        download_url: body.download_url,
        sha256: body.sha256 || 'CHANGE_ME',
        size_bytes: Number(body.size_bytes) || 0,
        release_notes: body.release_notes || [],
        requires_restart: body.requires_restart !== false,
        rollback_supported: body.rollback_supported !== false,
    };
    const result = releaseService.publishRelease(manifest);
    res.json({ ok: result.ok, manifest_path: result.path, manifest });
});
// ── POST /api/integration-agent/update-events ────────────────────────────────
exports.integrationAgentReleasesRouter.post('/update-events', requireAuth, (req, res) => {
    const { machine_id, event_type, version, error, timestamp } = req.body;
    if (!machine_id || !event_type) {
        res.status(400).json({ error: 'machine_id and event_type are required' });
        return;
    }
    const VALID_EVENTS = [
        'UPDATE_CHECKED', 'UPDATE_AVAILABLE', 'UPDATE_DOWNLOADED',
        'UPDATE_INSTALL_STARTED', 'UPDATE_COMPLETED', 'UPDATE_FAILED',
        'UPDATE_ROLLBACK_STARTED', 'UPDATE_ROLLBACK_COMPLETED',
    ];
    if (!VALID_EVENTS.includes(event_type)) {
        res.status(400).json({ error: `Invalid event_type: ${event_type}` });
        return;
    }
    releaseService.recordUpdateEvent({
        machine_id, event_type,
        version: version || '',
        error: error || '',
        timestamp: timestamp || new Date().toISOString(),
    });
    res.json({ ok: true });
});
// ── GET /api/integration-agent/update-events ─────────────────────────────────
exports.integrationAgentReleasesRouter.get('/update-events', requireAuth, (req, res) => {
    const machine_id = req.query.machine_id;
    const limit = Number(req.query.limit) || 50;
    res.json(releaseService.getUpdateEvents(machine_id, limit));
});
// ── GET /api/integration-agent/machines/versions ─────────────────────────────
exports.integrationAgentReleasesRouter.get('/machines/versions', requireAuth, (req, res) => {
    res.json(releaseService.getMachineVersions());
});
// ── File download route ───────────────────────────────────────────────────────
exports.integrationAgentReleasesRouter.get('/downloads/:version/:filename', (req, res) => {
    const { version, filename } = req.params;
    // Only allow .exe files
    if (!filename.endsWith('.exe')) {
        res.status(400).json({ error: 'Only .exe downloads are supported' });
        return;
    }
    const filePath = path_1.default.join(releaseService.getReleasesDir(), version, filename);
    if (!fs_1.default.existsSync(filePath)) {
        res.status(404).json({ error: 'File not found' });
        return;
    }
    res.download(filePath, filename);
});
