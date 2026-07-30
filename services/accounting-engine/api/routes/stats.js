// api/routes/stats.js
import { Router }        from 'express';
import { getFullStats }  from '../../analyzers/StatsAnalyzer.js';
import { verifyLedger }  from '../../analyzers/LedgerVerifier.js';

export function statsRouter(db) {
  const router = Router();

  router.get('/', (_req, res) => {
    try {
      res.json(getFullStats(db));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/ledger', (_req, res) => {
    try {
      res.json(verifyLedger(db));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
