import { Router, Request, Response } from 'express';
import { executiveMemory } from '../memory/executive-memory';

export const memoryRouter = Router();

memoryRouter.get('/profile', (_req: Request, res: Response) => {
  res.json(executiveMemory.getOwnerProfile());
});

memoryRouter.get('/profile/summary', (_req: Request, res: Response) => {
  res.json({ summary: executiveMemory.summarizeOwnerProfile() });
});

memoryRouter.get('/preferences', (_req: Request, res: Response) => {
  res.json(executiveMemory.getPreferences());
});

memoryRouter.get('/business', (_req: Request, res: Response) => {
  res.json(executiveMemory.getBusinessMemory());
});

memoryRouter.get('/decisions', (_req: Request, res: Response) => {
  res.json(executiveMemory.getDecisions());
});

memoryRouter.get('/personal', (_req: Request, res: Response) => {
  res.json(executiveMemory.getPersonalContext());
});

memoryRouter.get('/consent-log', (_req: Request, res: Response) => {
  res.json(executiveMemory.getConsentLog());
});

memoryRouter.get('/export', (req: Request, res: Response) => {
  const { include_personal } = req.query as { include_personal?: string };
  res.json(executiveMemory.exportMemory(include_personal === 'true'));
});

memoryRouter.get('/search', (req: Request, res: Response) => {
  const { q } = req.query as { q?: string };
  if (!q?.trim()) return res.status(400).json({ error: 'q required' });
  res.json(executiveMemory.searchMemory(q));
});

memoryRouter.post('/remember', (req: Request, res: Response) => {
  const { category, key, value, consent } = req.body as { category: string; key: string; value: unknown; consent?: boolean };
  if (!category || !key || value === undefined) return res.status(400).json({ error: 'category, key, value required' });
  res.json(executiveMemory.remember(category, key, value, consent));
});

memoryRouter.post('/preference', (req: Request, res: Response) => {
  const { key, value } = req.body as { key: string; value: unknown };
  if (!key || value === undefined) return res.status(400).json({ error: 'key, value required' });
  res.json(executiveMemory.addPreference(key, value));
});

memoryRouter.post('/decision', (req: Request, res: Response) => {
  const { title, detail, tags } = req.body as { title: string; detail: string; tags?: string[] };
  if (!title || !detail) return res.status(400).json({ error: 'title, detail required' });
  res.json(executiveMemory.addDecision(title, detail, tags));
});

memoryRouter.delete('/forget', (req: Request, res: Response) => {
  const { category, key } = req.body as { category: string; key?: string };
  if (!category) return res.status(400).json({ error: 'category required' });
  res.json(executiveMemory.forget(category, key));
});

memoryRouter.delete('/personal', (_req: Request, res: Response) => {
  res.json(executiveMemory.deleteSensitiveMemory());
});
