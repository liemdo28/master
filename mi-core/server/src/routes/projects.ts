/**
 * Projects Route — /api/projects
 * CEO's single control point for all Master projects.
 */

import { Router, Request, Response } from 'express';
import {
  scanAllProjects, getProjectById, getProjectSummary,
} from '../projects/project-scanner';
import {
  routeCommand, getConnectorHealthBoard,
  detectProjectTarget, detectActionType,
} from '../projects/connector-router';
import { syncRawWebsite, runRawQA } from '../projects/connectors/raw-website-connector';
import { syncBakudanWebsite, runBakudanQA } from '../projects/connectors/bakudan-website-connector';
import { syncDashboardProject, runDashboardQA } from '../projects/connectors/dashboard-connector';
import { syncRemoteProject, checkRemoteAgent, getAllRemoteStatuses, runRemoteQA } from '../projects/connectors/remote-proxy-connector';
import { enqueue, approve, getPending } from '../approval/gate';
import fs from 'fs';
import path from 'path';

export const projectsRouter = Router();

const GLOBAL_DIR = process.env.GLOBAL_DIR || 'D:/Project/Master/.local-agent-global';

// GET /api/projects — list all projects
projectsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const projects = scanAllProjects();
    res.json({ total: projects.length, projects });
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// GET /api/projects/scan — force rescan
projectsRouter.get('/scan', async (_req: Request, res: Response) => {
  try {
    const projects = scanAllProjects(true);
    res.json({ scanned: true, total: projects.length, summary: getProjectSummary(), projects });
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// GET /api/projects/health — connector health board
projectsRouter.get('/health', async (_req: Request, res: Response) => {
  try {
    const [board, remotes] = await Promise.all([
      getConnectorHealthBoard(),
      getAllRemoteStatuses(),
    ]);
    res.json({ board, remotes });
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// GET /api/projects/registry — project-connectors.json
projectsRouter.get('/registry', (_req: Request, res: Response) => {
  try {
    const file = path.join(GLOBAL_DIR, 'mi-core', 'project-connectors.json');
    if (!fs.existsSync(file)) return res.json({ connectors: [], message: 'Registry not built yet — scan first' });
    res.json(JSON.parse(fs.readFileSync(file, 'utf-8')));
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// POST /api/projects/command — route a CEO command
projectsRouter.post('/command', async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'message required' });
    const result = await routeCommand(message);
    res.json(result);
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// GET /api/projects/:id — single project info
projectsRouter.get('/:id', (req: Request, res: Response) => {
  try {
    const project = getProjectById(req.params.id);
    if (!project) return res.status(404).json({ error: `Project "${req.params.id}" not found` });
    res.json(project);
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// GET /api/projects/:id/status — connector status
projectsRouter.get('/:id/status', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const result = await routeCommand(`Check ${id}`);
    res.json(result);
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// POST /api/projects/:id/pull — pull data
projectsRouter.post('/:id/pull', async (req: Request, res: Response) => {
  try {
    const result = await routeCommand(`Pull data from ${req.params.id}`);
    res.json(result);
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// POST /api/projects/:id/qa — run QA
projectsRouter.post('/:id/qa', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    let result: unknown;

    if (id === 'raw-website' || id === 'rawwebsite') result = runRawQA();
    else if (id === 'bakudan-website' || id === 'bakudan') { await syncBakudanWebsite(); result = runBakudanQA(); }
    else if (id === 'dashboard') { await syncDashboardProject(); result = runDashboardQA(); }
    else if (id === 'integration-system') result = await runRemoteQA('integration-system');
    else if (id === 'whatsapp-api') result = await runRemoteQA('whatsapp-api');
    else result = await routeCommand(`Run QA ${id}`);

    res.json({ project: id, qa: result });
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// POST /api/projects/:id/sync — force sync
projectsRouter.post('/:id/sync', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    let snap: unknown;

    if (id === 'raw-website' || id === 'rawwebsite')  snap = syncRawWebsite();
    else if (id === 'bakudan-website' || id === 'bakudan') snap = await syncBakudanWebsite();
    else if (id === 'dashboard')   snap = await syncDashboardProject();
    else if (id === 'integration-system') snap = await syncRemoteProject('integration-system');
    else if (id === 'whatsapp-api')       snap = await syncRemoteProject('whatsapp-api');
    else return res.status(404).json({ error: `No connector for "${id}"` });

    res.json({ synced: true, data: snap });
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// POST /api/projects/:id/command — preview a command (dry-run)
projectsRouter.post('/:id/command', async (req: Request, res: Response) => {
  try {
    const { command } = req.body;
    if (!command) return res.status(400).json({ error: 'command required' });

    // All commands go to approval gate
    const action = enqueue({
      risk_level: 2,
      category: 'project-command',
      target: req.params.id,
      description: `Command preview: ${command}`,
      before_state: `Project: ${req.params.id}`,
      rollback_plan: 'Reject the approval to cancel',
    });

    res.json({
      queued: true,
      approval_id: action.id,
      command,
      message: `Command queued for approval — use /api/approval/${action.id} to approve or reject`,
    });
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// POST /api/projects/sync-all — sync all local connectors
projectsRouter.post('/sync-all', async (_req: Request, res: Response) => {
  try {
    const results: Record<string, string> = {};

    const [raw, bakudan, dash, integration, whatsapp] = await Promise.allSettled([
      Promise.resolve(syncRawWebsite()),
      syncBakudanWebsite(),
      syncDashboardProject(),
      syncRemoteProject('integration-system'),
      syncRemoteProject('whatsapp-api'),
    ]);

    results['raw-website']         = raw.status         === 'fulfilled' ? 'ok' : 'error';
    results['bakudan-website']     = bakudan.status     === 'fulfilled' ? 'ok' : 'error';
    results['dashboard']           = dash.status        === 'fulfilled' ? 'ok' : 'error';
    results['integration-system']  = integration.status === 'fulfilled' ? 'ok' : (integration as PromiseRejectedResult).reason;
    results['whatsapp-api']        = whatsapp.status    === 'fulfilled' ? 'ok' : (whatsapp as PromiseRejectedResult).reason;

    // Also rescan projects
    const projects = scanAllProjects(true);
    results['project-scan'] = `${projects.length} projects`;

    res.json({ synced_at: new Date().toISOString(), results });
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
});
