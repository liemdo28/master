import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';

const CEO_DB_DIR = path.join(
  process.env.GLOBAL_DIR || path.resolve(process.cwd(), '..', '.local-agent-global'),
  'ceo-control',
);

if (!fs.existsSync(CEO_DB_DIR)) fs.mkdirSync(CEO_DB_DIR, { recursive: true });

export const ceoControlRouter = Router();

ceoControlRouter.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true, service: 'ceo-control', dir: CEO_DB_DIR, timestamp: new Date().toISOString() });
});

ceoControlRouter.get('/status', (_req: Request, res: Response) => {
  res.json({ ok: true, status: 'operational', timestamp: new Date().toISOString() });
});
