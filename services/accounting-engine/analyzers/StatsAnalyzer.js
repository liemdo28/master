// analyzers/StatsAnalyzer.js - Aggregate stats queries, all must complete < 3s
import { getStats }     from '../core/DatabaseManager.js';
import { getQAStats }   from '../core/QAAccounting.js';
import { getPatchStats } from '../core/PatchLedger.js';

export function getFullStats(db) {
  const db_stats     = getStats(db);
  const qa_stats     = getQAStats(db);
  const patch_stats  = getPatchStats(db);
  const metric_stats = getMetricStats(db);

  return {
    database:  db_stats,
    qa:        qa_stats,
    patches:   patch_stats,
    metrics:   metric_stats,
    timestamp: new Date().toISOString(),
  };
}

export function getMetricStats(db) {
  return db.prepare(`
    SELECT
      COUNT(*) as total_samples,
      AVG(cpu_pct) as avg_cpu_pct,
      MAX(cpu_pct) as max_cpu_pct,
      AVG(memory_mb) as avg_memory_mb,
      MAX(memory_mb) as max_memory_mb,
      MIN(timestamp) as first_sample,
      MAX(timestamp) as last_sample
    FROM resource_metrics
  `).get();
}

export function getSessionStats(db, sessionId = null) {
  if (sessionId) {
    return db.prepare(`
      SELECT session_id, COUNT(*) as samples,
             AVG(cpu_pct) as avg_cpu, MAX(cpu_pct) as max_cpu,
             AVG(memory_mb) as avg_mem, MAX(memory_mb) as max_mem
      FROM resource_metrics WHERE session_id = ?
      GROUP BY session_id
    `).get(sessionId);
  }
  return db.prepare(`
    SELECT session_id, COUNT(*) as samples,
           AVG(cpu_pct) as avg_cpu, MAX(cpu_pct) as max_cpu,
           AVG(memory_mb) as avg_mem, MAX(memory_mb) as max_mem
    FROM resource_metrics GROUP BY session_id ORDER BY samples DESC LIMIT 20
  `).all();
}

export function getRecentMetrics(db, minutes = 60) {
  const since = new Date(Date.now() - minutes * 60000).toISOString();
  return db.prepare(`
    SELECT * FROM resource_metrics WHERE timestamp > ? ORDER BY timestamp DESC LIMIT 1000
  `).all(since);
}
