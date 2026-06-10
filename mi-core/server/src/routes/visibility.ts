import { Router, Request, Response } from 'express';
import {
  getDailySnapshot, syncAll, syncPlatform,
  getPlatformHealth, getProjectSnapshot,
  getBusinessSnapshot, getTasksSnapshot, getHealthSnapshot,
  getTasksForPerson_, getOverdueTasksAll, getImportantEmailsAll,
  getTodayEventsAll, searchDrive,
} from '../visibility/visibility-hub';
import { connectorRegistry } from '../visibility/connector-registry';
import { syncLocalProjects } from '../visibility/connectors/local-projects';

export const visibilityRouter = Router();

visibilityRouter.get('/snapshot', async (_req: Request, res: Response) => {
  res.json(await getDailySnapshot());
});

visibilityRouter.get('/connectors', (_req: Request, res: Response) => {
  res.json(connectorRegistry.getSummary());
});

visibilityRouter.get('/connectors/health', (_req: Request, res: Response) => {
  res.json(getPlatformHealth());
});

visibilityRouter.post('/sync', async (_req: Request, res: Response) => {
  res.json(await syncAll());
});

visibilityRouter.post('/sync/:connectorId', async (req: Request, res: Response) => {
  res.json(await syncPlatform(req.params.connectorId));
});

visibilityRouter.get('/projects', async (_req: Request, res: Response) => {
  const projects = await syncLocalProjects();
  res.json({ projects, count: projects.length });
});

visibilityRouter.get('/tasks', (_req: Request, res: Response) => res.json(getTasksSnapshot()));
visibilityRouter.get('/tasks/overdue', (_req: Request, res: Response) => res.json(getOverdueTasksAll()));
visibilityRouter.get('/tasks/person/:name', (req: Request, res: Response) => res.json(getTasksForPerson_(req.params.name)));

visibilityRouter.get('/emails', (_req: Request, res: Response) => res.json(getImportantEmailsAll(20)));
visibilityRouter.get('/calendar', (_req: Request, res: Response) => res.json(getTodayEventsAll()));

visibilityRouter.get('/business', (_req: Request, res: Response) => res.json(getBusinessSnapshot()));
visibilityRouter.get('/health-data', (_req: Request, res: Response) => res.json(getHealthSnapshot()));

visibilityRouter.get('/drive/search', (req: Request, res: Response) => {
  const { q } = req.query as { q?: string };
  if (!q) return res.status(400).json({ error: 'q required' });
  res.json(searchDrive(q));
});
