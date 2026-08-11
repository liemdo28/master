import { Router } from 'express';
import { OperatorControlService } from './service';
import type { OperatorServiceOptions } from './types';

export function createOperatorControlRouter(options: OperatorServiceOptions = {}): Router {
  const router = Router();

  function withService<T>(fn: (service: OperatorControlService) => T): T {
    const service = new OperatorControlService(options);
    try { return fn(service); } finally { service.close(); }
  }

  router.get('/operator/overview', (_req, res) => {
    res.json(withService(service => service.snapshot().overview));
  });

  router.get('/operator/pending', (_req, res) => {
    res.json({ items: withService(service => service.pending()) });
  });

  router.get('/operator/authority', (_req, res) => {
    res.json(withService(service => service.authority()));
  });

  router.get('/operator/blocked', (_req, res) => {
    res.json({ items: withService(service => service.blocked()) });
  });

  router.get('/operator/item/:id', (req, res) => {
    const found = withService(service => service.item(req.params.id));
    if (!found) return res.status(404).json({ error: 'operator item not found' });
    return res.json({ item: found });
  });

  return router;
}

export const operatorControlRouter = createOperatorControlRouter();
