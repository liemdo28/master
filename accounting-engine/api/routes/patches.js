// api/routes/patches.js
import { Router }          from 'express';
import { listPatches, getPatchRecord, getPatchLineage, getPatchStats } from '../../core/PatchLedger.js';

export function patchesRouter(db) {
  const router = Router();

  router.get('/', (req, res) => {
    try {
      const limit  = Math.min(parseInt(req.query.limit  ?? 100, 10), 500);
      const offset = parseInt(req.query.offset ?? 0, 10);
      const status = req.query.status ?? null;
      res.json(listPatches(db, { limit, offset, status }));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/stats', (_req, res) => {
    try {
      res.json(getPatchStats(db));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/:patch_id', (req, res) => {
    try {
      const patch = getPatchRecord(db, req.params.patch_id);
      if (!patch) return res.status(404).json({ error: 'not found' });
      res.json(patch);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/:patch_id/lineage', (req, res) => {
    try {
      res.json(getPatchLineage(db, req.params.patch_id));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
