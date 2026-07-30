// api/routes/qa.js
import { Router }          from 'express';
import { listQARuns, getQAStats, getQARun } from '../../core/QAAccounting.js';
import { getTopRegressions } from '../../analyzers/RegressionAnalyzer.js';

export function qaRouter(db) {
  const router = Router();

  router.get('/', (_req, res) => {
    try {
      const limit  = Math.min(parseInt(_req.query.limit  ?? 50,  10), 200);
      const offset = parseInt(_req.query.offset ?? 0, 10);
      res.json(listQARuns(db, { limit, offset }));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/stats', (_req, res) => {
    try {
      res.json(getQAStats(db));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/regressions', (_req, res) => {
    try {
      res.json(getTopRegressions(db));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/:run_id', (req, res) => {
    try {
      const run = getQARun(db, req.params.run_id);
      if (!run) return res.status(404).json({ error: 'not found' });
      res.json(run);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
