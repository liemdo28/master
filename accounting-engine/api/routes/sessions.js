// api/routes/sessions.js
import { Router } from 'express';

export function sessionsRouter(db) {
  const router = Router();

  router.get('/', (req, res) => {
    try {
      const limit  = Math.min(parseInt(req.query.limit  ?? 50,  10), 200);
      const offset = parseInt(req.query.offset ?? 0, 10);
      const status = req.query.status ?? null;
      const where  = status ? 'WHERE status = ?' : '';
      const args   = status ? [status, limit, offset] : [limit, offset];
      const rows   = db.prepare(
        `SELECT * FROM sessions ${where} ORDER BY started_at DESC LIMIT ? OFFSET ?`
      ).all(...args);
      res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.get('/stats', (_req, res) => {
    try {
      const stats = db.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status='active'    THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status='failed'    THEN 1 ELSE 0 END) as failed,
          COUNT(DISTINCT project_name) as projects,
          MIN(started_at) as first_session,
          MAX(started_at) as last_session
        FROM sessions
      `).get();
      res.json(stats);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.get('/:session_id', (req, res) => {
    try {
      const row = db.prepare('SELECT * FROM sessions WHERE session_id = ?').get(req.params.session_id);
      if (!row) return res.status(404).json({ error: 'not found' });
      // attach recent metrics
      const metrics = db.prepare(
        'SELECT * FROM resource_metrics WHERE session_id = ? ORDER BY timestamp DESC LIMIT 100'
      ).all(req.params.session_id);
      res.json({ ...row, recent_metrics: metrics });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  return router;
}
