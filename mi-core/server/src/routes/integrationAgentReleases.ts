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
import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import * as releaseService from '../services/integrationAgentReleaseService';

export const integrationAgentReleasesRouter = Router();

// ── Auth middleware (Bearer token same as QB Agent) ───────────────────────────
function requireAuth(req: Request, res: Response, next: Function): void {
  const apiKey = process.env.MI_CORE_API_KEY || '';
  const auth = req.headers.authorization || '';
  if (!apiKey || auth === `Bearer ${apiKey}`) {
    next();
    return;
  }
  res.status(401).json({ error: 'Unauthorized' });
}

// ── GET /api/integration-agent/releases/latest ────────────────────────────────
integrationAgentReleasesRouter.get('/releases/latest', (req: Request, res: Response) => {
  const manifest = releaseService.getLatestManifest();
  if (!manifest) {
    res.status(404).json({ error: 'No releases published yet' });
    return;
  }
  res.json(manifest);
});

// ── GET /api/integration-agent/releases/:version ──────────────────────────────
integrationAgentReleasesRouter.get('/releases/:version', (req: Request, res: Response) => {
  const { version } = req.params;
  const manifest = releaseService.getManifest(version);
  if (!manifest) {
    res.status(404).json({ error: `Version ${version} not found` });
    return;
  }
  res.json(manifest);
});

// ── POST /api/integration-agent/releases ─────────────────────────────────────
integrationAgentReleasesRouter.post('/releases', requireAuth, (req: Request, res: Response) => {
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
integrationAgentReleasesRouter.post('/update-events', requireAuth, (req: Request, res: Response) => {
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
integrationAgentReleasesRouter.get('/update-events', requireAuth, (req: Request, res: Response) => {
  const machine_id = req.query.machine_id as string | undefined;
  const limit = Number(req.query.limit) || 50;
  res.json(releaseService.getUpdateEvents(machine_id, limit));
});

// ── GET /api/integration-agent/machines/versions ─────────────────────────────
integrationAgentReleasesRouter.get('/machines/versions', requireAuth, (req: Request, res: Response) => {
  res.json(releaseService.getMachineVersions());
});

// ── File download route ───────────────────────────────────────────────────────
integrationAgentReleasesRouter.get('/downloads/:version/:filename', (req: Request, res: Response) => {
  const { version, filename } = req.params;
  // Only allow .exe files
  if (!filename.endsWith('.exe')) {
    res.status(400).json({ error: 'Only .exe downloads are supported' });
    return;
  }
  const filePath = path.join(releaseService.getReleasesDir(), version, filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'File not found' });
    return;
  }
  res.download(filePath, filename);
});
