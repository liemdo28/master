// api/routes/models.js - Model usage analytics derived from qa_runs + model_usage table
import { Router } from 'express';

export function modelsRouter(db) {
  const router = Router();

  // Ensure model_usage table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS model_usage (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id   TEXT,
      model_name   TEXT    NOT NULL,
      provider     TEXT    DEFAULT 'ollama',
      prompt_tokens  INTEGER DEFAULT 0,
      output_tokens  INTEGER DEFAULT 0,
      latency_ms     INTEGER DEFAULT 0,
      cost_cents     INTEGER DEFAULT 0,
      task_type    TEXT,
      success      INTEGER DEFAULT 1,
      recorded_at  TEXT    NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_model_usage_model ON model_usage(model_name, recorded_at);
  `);

  router.get('/', (_req, res) => {
    try {
      const models = db.prepare(`
        SELECT
          model_name, provider,
          COUNT(*)                                as total_calls,
          SUM(CASE WHEN success=1 THEN 1 ELSE 0 END) as success_calls,
          AVG(latency_ms)                         as avg_latency_ms,
          SUM(prompt_tokens + output_tokens)      as total_tokens,
          SUM(cost_cents)                         as total_cost_cents,
          MIN(recorded_at)                        as first_used,
          MAX(recorded_at)                        as last_used
        FROM model_usage
        GROUP BY model_name, provider
        ORDER BY total_calls DESC
      `).all();
      res.json(models);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.get('/leaderboard', (_req, res) => {
    try {
      const rows = db.prepare(`
        SELECT
          model_name,
          COUNT(*) as calls,
          ROUND(AVG(latency_ms), 1) as avg_ms,
          ROUND(SUM(cost_cents) * 1.0 / NULLIF(COUNT(*),0), 2) as cost_per_call_cents,
          ROUND(SUM(CASE WHEN success=1 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*),0), 1) as success_rate_pct
        FROM model_usage
        GROUP BY model_name
        HAVING calls > 0
        ORDER BY success_rate_pct DESC, avg_ms ASC
      `).all();
      res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Record a model usage event
  router.post('/', (req, res) => {
    try {
      const { session_id, model_name, provider = 'ollama', prompt_tokens = 0,
              output_tokens = 0, latency_ms = 0, cost_cents = 0, task_type, success = true } = req.body;
      if (!model_name) return res.status(400).json({ error: 'model_name required' });
      db.prepare(`
        INSERT INTO model_usage
          (session_id, model_name, provider, prompt_tokens, output_tokens, latency_ms, cost_cents, task_type, success, recorded_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(session_id, model_name, provider, prompt_tokens, output_tokens, latency_ms, cost_cents, task_type, success ? 1 : 0, new Date().toISOString());
      res.status(201).json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  return router;
}
