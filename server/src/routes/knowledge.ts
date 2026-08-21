import { Router, Request, Response } from 'express';
import {
  search, searchByCategory, getStats,
  fullIngest, clearAndRebuild, buildCatalog, ingestDirectory,
} from '../knowledge/knowledge-db';
import { listPacks, installPack, installAllPacks, uninstallPack } from '../knowledge/pack-manager';
import {
  getComplianceDBStatus,
  checkUSComplianceDBHealth,
  getUSComplianceDBPath,
} from '../knowledge/reference-brain-path';

export const knowledgeRouter = Router();

const KNOWLEDGE_API_KEY = process.env.MI_CORE_API_KEY || '';
function requireApiKey(req: Request, res: Response, next: () => void) {
  if (!KNOWLEDGE_API_KEY) return res.status(503).json({ error: 'Server not configured — MI_CORE_API_KEY missing' });
  const key = (req.headers['x-api-key'] as string) || (req.body as any)?.api_key || '';
  if (key !== KNOWLEDGE_API_KEY) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

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

knowledgeRouter.post('/ingest', requireApiKey, async (_req: Request, res: Response) => {
  try {
    const result = await fullIngest();
    res.json({ ok: true, ...result });
  } catch (e) { res.status(500).json({ error: e instanceof Error ? e.message : String(e) }); }
});

knowledgeRouter.post('/rebuild', requireApiKey, async (_req: Request, res: Response) => {
  try {
    const result = await clearAndRebuild();
    res.json({ ok: true, ...result });
  } catch (e) { res.status(500).json({ error: e instanceof Error ? e.message : String(e) }); }
});

knowledgeRouter.post('/ingest-dir', requireApiKey, async (req: Request, res: Response) => {
  const { dir, source } = req.body as { dir: string; source?: string };
  if (!dir) return res.status(400).json({ error: 'dir required' });
  try {
    res.json({ ok: true, ...(await ingestDirectory(dir, source)) });
  } catch (e) { res.status(500).json({ error: e instanceof Error ? e.message : String(e) }); }
});

// Packs
knowledgeRouter.get('/packs', (_req: Request, res: Response) => {
  res.json(listPacks());
});

knowledgeRouter.post('/packs/install-all', requireApiKey, async (_req: Request, res: Response) => {
  try {
    res.json(await installAllPacks());
  } catch (e) { res.status(500).json({ error: e instanceof Error ? e.message : String(e) }); }
});

knowledgeRouter.post('/packs/:packId/install', requireApiKey, async (req: Request, res: Response) => {
  try {
    res.json(await installPack(req.params.packId));
  } catch (e) { res.status(500).json({ error: e instanceof Error ? e.message : String(e) }); }
});

knowledgeRouter.delete('/packs/:packId', requireApiKey, (req: Request, res: Response) => {
  res.json(uninstallPack(req.params.packId));
});

// US Compliance DB status (legacy shape: includes status field)
knowledgeRouter.get('/us-compliance/status', (_req: Request, res: Response) => {
  res.json(getComplianceDBStatus());
});

// US Compliance DB health (canonical shape per CEO directive)
knowledgeRouter.get('/us-compliance/health', (_req: Request, res: Response) => {
  res.json(checkUSComplianceDBHealth());
});
