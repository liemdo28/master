/**
 * GStack API Routes
 * HTTP interface for the Mi Operating Backend.
 *
 * POST /api/gstack/process        — submit CEO request to GStack pipeline
 * GET  /api/gstack/orders         — list work orders
 * GET  /api/gstack/orders/:id     — get specific work order
 * GET  /api/gstack/ledger         — execution ledger
 * GET  /api/gstack/ledger/stats   — ledger stats
 * GET  /api/gstack/health         — GStack health
 */

import { Router, Request, Response } from 'express';
import { processGStackRequest, shouldUseGStack } from '../gstack/gstack-orchestrator';
import { listWorkOrders, getWorkOrder, getActiveWorkOrders } from '../gstack/work-order-engine';
import { getEntries, getStats } from '../gstack/execution-ledger';
import { classifyIntent } from '../gstack/intent-router';
import { generateEvidencePackage, getEvidenceDir } from '../gstack/evidence-engine';
import fs from 'fs';

export const gstackRouter = Router();

const API_KEY = process.env.MI_CORE_API_KEY || '';
function requireKey(req: Request, res: Response, next: () => void) {
  if (!API_KEY) return res.status(503).json({ error: 'Server not configured — MI_CORE_API_KEY missing' });
  const key = (req.headers['x-api-key'] as string) || (req.body as Record<string,string>)?.api_key || '';
  if (key !== API_KEY) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// POST /api/gstack/process
gstackRouter.post('/process', requireKey, async (req: Request, res: Response) => {
  const { raw_request, requested_by, source } = req.body as {
    raw_request: string; requested_by?: string; source?: string;
  };
  if (!raw_request) return res.status(400).json({ error: 'raw_request required' });

  try {
    const result = await processGStackRequest({
      raw_request,
      requested_by: requested_by || 'api',
      source: (source as 'whatsapp' | 'api' | 'dashboard') || 'api',
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// GET /api/gstack/intent?text=...
gstackRouter.get('/intent', requireKey, (req: Request, res: Response) => {
  const text = String(req.query.text || '');
  if (!text) return res.status(400).json({ error: 'text required' });
  res.json({
    should_use_gstack: shouldUseGStack(text),
    intent: classifyIntent(text),
  });
});

// GET /api/gstack/orders
gstackRouter.get('/orders', requireKey, (req: Request, res: Response) => {
  const limit = parseInt(String(req.query.limit || '20'), 10);
  const active = req.query.active === '1';
  const orders = active ? getActiveWorkOrders() : listWorkOrders(limit);
  res.json({ orders, count: orders.length });
});

// GET /api/gstack/orders/:id
gstackRouter.get('/orders/:id', requireKey, (req: Request, res: Response) => {
  const wo = getWorkOrder(req.params.id);
  if (!wo) return res.status(404).json({ error: 'Work order not found' });
  res.json(wo);
});

// GET /api/gstack/ledger
gstackRouter.get('/ledger', requireKey, (req: Request, res: Response) => {
  const limit = parseInt(String(req.query.limit || '50'), 10);
  const wo_id = req.query.wo_id ? String(req.query.wo_id) : undefined;
  res.json({ entries: getEntries(limit, wo_id) });
});

// GET /api/gstack/ledger/stats
gstackRouter.get('/ledger/stats', requireKey, (_req: Request, res: Response) => {
  res.json(getStats());
});

// GET /api/gstack/evidence/:id
gstackRouter.get('/evidence/:id', requireKey, (req: Request, res: Response) => {
  const pkg = generateEvidencePackage(req.params.id);
  if (!pkg.files.length) return res.status(404).json({ error: 'No evidence found for this work order' });
  res.json(pkg);
});

// GET /api/gstack/evidence/:id/:filename
gstackRouter.get('/evidence/:id/:filename', requireKey, (req: Request, res: Response) => {
  const dir = getEvidenceDir(req.params.id);
  const filePath = `${dir}/${req.params.filename}`;
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Evidence file not found' });
  const content = fs.readFileSync(filePath, 'utf8');
  const isJson = req.params.filename.endsWith('.json');
  res.type(isJson ? 'application/json' : 'text/plain').send(content);
});

// GET /api/gstack/health
gstackRouter.get('/health', (_req: Request, res: Response) => {
  const active = getActiveWorkOrders();
  res.json({
    status: 'ok',
    module: 'MI_OPERATING_BACKEND',
    version: '1.0.0',
    active_work_orders: active.length,
    ledger_stats: getStats(),
  });
});
