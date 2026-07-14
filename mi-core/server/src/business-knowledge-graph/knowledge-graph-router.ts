/**
 * Knowledge Graph Router — Business Knowledge Graph API Layer
 */

import { Router, Request, Response } from 'express';
import { getAllEntities, getEntitiesByType, getAllRelationships, getEntity, getEntityTypes } from './entity-registry';
import { analyzeImpact, analyzeDoordashFailure } from './impact-analysis-engine';
import { queryGraph, getEntityProfile } from './knowledge-query-engine';

export const knowledgeGraphRouter = Router({ mergeParams: true });

// GET /api/knowledge-graph/entities
knowledgeGraphRouter.get('/entities', (req: Request, res: Response) => {
  try {
    const type = req.query.type as string | undefined;
    const division = req.query.division as string | undefined;
    const search = req.query.search as string | undefined;
    const limit = parseInt(String(req.query.limit || '100'), 10);

    let entities = type ? getEntitiesByType(type as Parameters<typeof getEntitiesByType>[0]) : getAllEntities();
    if (division) entities = entities.filter(e => e.metadata.division === division);
    if (search) {
      const q = search.toLowerCase();
      entities = entities.filter(e => e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q));
    }
    entities = entities.slice(0, limit);

    res.json({
      count: entities.length,
      entityTypes: getEntityTypes(),
      entities,
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// GET /api/knowledge-graph/relationships
knowledgeGraphRouter.get('/relationships', (req: Request, res: Response) => {
  try {
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const type = req.query.type as string | undefined;

    let rels = getAllRelationships();
    if (from) rels = rels.filter(r => r.from === from);
    if (to) rels = rels.filter(r => r.to === to);
    if (type) rels = rels.filter(r => r.type === type);

    res.json({ count: rels.length, relationships: rels });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// POST /api/knowledge-graph/query
knowledgeGraphRouter.post('/query', (req: Request, res: Response) => {
  try {
    const result = queryGraph(req.body);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// POST /api/knowledge-graph/impact-analysis
knowledgeGraphRouter.post('/impact-analysis', (req: Request, res: Response) => {
  try {
    const { entityId } = req.body;
    if (!entityId) return res.status(400).json({ error: 'entityId is required' });
    const result = analyzeImpact(entityId);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// GET /api/knowledge-graph/doordash-failure
knowledgeGraphRouter.get('/doordash-failure', (_req: Request, res: Response) => {
  res.json(analyzeDoordashFailure());
});