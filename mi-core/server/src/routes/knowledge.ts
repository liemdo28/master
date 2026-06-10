import { Router, Request, Response } from 'express';
import {
  search, searchByCategory, getStats,
  fullIngest, clearAndRebuild, buildCatalog, ingestDirectory,
} from '../knowledge/knowledge-db';
import { listPacks, installPack, installAllPacks, uninstallPack } from '../knowledge/pack-manager';

export const knowledgeRouter = Router();

knowledgeRouter.get('/search', (req: Request, res: Response) => {
  const { q, category, limit } = req.query as { q?: string; category?: string; limit?: string };
  if (!q?.trim()) return res.status(400).json({ error: 'q required' });
  res.json(search(q, parseInt(limit || '10'), category));
});

knowledgeRouter.get('/category/:cat', (req: Request, res: Response) => {
  res.json(searchByCategory(req.params.cat, 20));
});

knowledgeRouter.get('/stats', (_req: Request, res: Response) => {
  res.json(getStats());
});

knowledgeRouter.get('/catalog', (_req: Request, res: Response) => {
  res.json(buildCatalog());
});

knowledgeRouter.post('/ingest', (_req: Request, res: Response) => {
  const result = fullIngest();
  res.json({ ok: true, ...result });
});

knowledgeRouter.post('/rebuild', (_req: Request, res: Response) => {
  const result = clearAndRebuild();
  res.json({ ok: true, ...result });
});

knowledgeRouter.post('/ingest-dir', (req: Request, res: Response) => {
  const { dir, source } = req.body as { dir: string; source?: string };
  if (!dir) return res.status(400).json({ error: 'dir required' });
  res.json({ ok: true, ...ingestDirectory(dir, source) });
});

// Packs
knowledgeRouter.get('/packs', (_req: Request, res: Response) => {
  res.json(listPacks());
});

knowledgeRouter.post('/packs/install-all', (_req: Request, res: Response) => {
  res.json(installAllPacks());
});

knowledgeRouter.post('/packs/:packId/install', (req: Request, res: Response) => {
  res.json(installPack(req.params.packId));
});

knowledgeRouter.delete('/packs/:packId', (req: Request, res: Response) => {
  res.json(uninstallPack(req.params.packId));
});
