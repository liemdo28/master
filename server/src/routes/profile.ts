import { Router, Request, Response } from 'express';
import { ownerProfile } from '../services/owner-profile';

export const profileRouter = Router();

profileRouter.get('/', (_req: Request, res: Response) => {
  res.json(ownerProfile.getAll());
});

profileRouter.get('/health', (_req: Request, res: Response) => {
  res.json(ownerProfile.getHealth());
});

profileRouter.get('/consent-log', (_req: Request, res: Response) => {
  res.json(ownerProfile.getConsentLog());
});

profileRouter.post('/remember', (req: Request, res: Response) => {
  const { category, key, value } = req.body as { category: string; key: string; value: unknown };
  if (!category || !key || value === undefined) {
    return res.status(400).json({ error: 'category, key, value required' });
  }
  ownerProfile.remember(category, key, value);
  res.json({ ok: true, saved: { category, key, value } });
});

profileRouter.delete('/forget', (req: Request, res: Response) => {
  const { category, key } = req.body as { category: string; key?: string };
  if (!category) return res.status(400).json({ error: 'category required' });
  ownerProfile.forget(category, key);
  res.json({ ok: true, deleted: { category, key } });
});
