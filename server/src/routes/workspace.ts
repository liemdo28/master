import { Router, Request, Response } from 'express';
import { scanProjects, searchFiles, getRunningProcesses, getListeningPorts } from '../connectors/pc-connector';
import { getAllProjectHealth, getProjectsWithIssues } from '../connectors/project-connector';
import { generateBriefing } from '../connectors/briefing-engine';

export const workspaceRouter = Router();

workspaceRouter.get('/projects', (_req: Request, res: Response) => {
  res.json(scanProjects());
});

workspaceRouter.get('/projects/health', (_req: Request, res: Response) => {
  res.json(getAllProjectHealth());
});

workspaceRouter.get('/projects/issues', (_req: Request, res: Response) => {
  res.json(getProjectsWithIssues());
});

workspaceRouter.get('/search', (req: Request, res: Response) => {
  const { q } = req.query as { q?: string };
  if (!q?.trim()) return res.status(400).json({ error: 'q required' });
  res.json(searchFiles(q));
});

workspaceRouter.get('/processes', (_req: Request, res: Response) => {
  res.json(getRunningProcesses());
});

workspaceRouter.get('/ports', (_req: Request, res: Response) => {
  res.json(getListeningPorts());
});

workspaceRouter.get('/briefing', async (_req: Request, res: Response) => {
  try {
    const result = await generateBriefing();
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});
