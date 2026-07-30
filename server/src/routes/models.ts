import { Router, Request, Response } from 'express';
import { getModelStatus, benchmarkModel, getInstalledModels } from '../model-router/ollama-router';

export const modelsRouter = Router();

modelsRouter.get('/status', async (_req: Request, res: Response) => {
  res.json(await getModelStatus());
});

modelsRouter.get('/list', async (_req: Request, res: Response) => {
  res.json(await getInstalledModels(true));
});

modelsRouter.post('/benchmark', async (req: Request, res: Response) => {
  const { model } = req.body as { model: string };
  if (!model) return res.status(400).json({ error: 'model required' });
  res.json(await benchmarkModel(model));
});
