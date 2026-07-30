/**
 * Actions API Routes — Mi Action Layer (Gmail, Drive, Files, Excel, Word)
 * GET  /api/actions/health
 * POST /api/actions/gmail/search
 * POST /api/actions/gmail/read
 * POST /api/actions/gmail/draft
 * POST /api/actions/drive/search
 * POST /api/actions/drive/read
 * POST /api/actions/files/search
 * POST /api/actions/files/read
 * POST /api/actions/excel/create
 * POST /api/actions/word/create
 * POST /api/actions/route        — generic action router
 */

import { Router, Request, Response } from 'express';
import { routeAction } from '../actions/action-router';

export const actionsRouter = Router();

// GET /api/actions/health
actionsRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    capabilities: {
      gmail: { search: true, read: true, draft: true, send: 'approval_required' },
      drive: { search: true, read: true, upload: 'approval_required', share: 'approval_required' },
      files: { search: true, read: true, create: 'approval_required', delete: 'dangerous' },
      excel: { create: true, read: true },
      word: { create: true, read: true },
      pdf: { extract: true, export: 'requires_libreoffice' },
    },
    approval_levels: { read: 'auto', write: 'single', dangerous: 'double' },
  });
});

// Generic router
actionsRouter.post('/route', async (req: Request, res: Response) => {
  const { action, params, description } = req.body || {};
  if (!action) return res.status(400).json({ error: 'action required' });
  const result = await routeAction({ action, params: params || {}, description, requester: 'ceo' });
  res.json(result);
});

// Gmail
actionsRouter.post('/gmail/search', async (req: Request, res: Response) => {
  const result = await routeAction({ action: 'gmail_search', params: req.body, requester: 'ceo' });
  res.json(result);
});

actionsRouter.post('/gmail/read', async (req: Request, res: Response) => {
  const result = await routeAction({ action: 'gmail_read', params: req.body, requester: 'ceo' });
  res.json(result);
});

actionsRouter.post('/gmail/draft', async (req: Request, res: Response) => {
  const result = await routeAction({ action: 'gmail_draft', params: req.body, requester: 'ceo' });
  res.json(result);
});

// Drive
actionsRouter.post('/drive/search', async (req: Request, res: Response) => {
  const result = await routeAction({ action: 'drive_search', params: req.body, requester: 'ceo' });
  res.json(result);
});

actionsRouter.post('/drive/read', async (req: Request, res: Response) => {
  const result = await routeAction({ action: 'drive_read', params: req.body, requester: 'ceo' });
  res.json(result);
});

// Local files
actionsRouter.post('/files/search', async (req: Request, res: Response) => {
  const result = await routeAction({ action: 'file_search', params: req.body, requester: 'ceo' });
  res.json(result);
});

actionsRouter.post('/files/read', async (req: Request, res: Response) => {
  const result = await routeAction({ action: 'file_read', params: req.body, requester: 'ceo' });
  res.json(result);
});

// Excel / Word
actionsRouter.post('/excel/create', async (req: Request, res: Response) => {
  const result = await routeAction({ action: 'excel_create', params: req.body, requester: 'ceo' });
  res.json(result);
});

actionsRouter.post('/word/create', async (req: Request, res: Response) => {
  const result = await routeAction({ action: 'word_create', params: req.body, requester: 'ceo' });
  res.json(result);
});
