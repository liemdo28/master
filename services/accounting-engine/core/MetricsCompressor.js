// core/MetricsCompressor.js - Compress raw metrics >24h into hourly aggregates
// Raw recent data stays intact; old data is rolled up then deleted to prevent DB bloat

const RAW_RETENTION_MS = 24 * 60 * 60 * 1000;  // 24 hours

export function ensureHourlyTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS metrics_hourly (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id    TEXT,
      hour_bucket   TEXT    NOT NULL,
      sample_count  INTEGER DEFAULT 0,
      cpu_min       REAL, cpu_avg  REAL, cpu_max  REAL, cpu_p95  REAL,
      mem_min       REAL, mem_avg  REAL, mem_max  REAL, mem_p95  REAL,
      created_at    TEXT    NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_metrics_hourly_bucket
      ON metrics_hourly(session_id, hour_bucket);
  `);
}

export function compressOldMetrics(db, retentionMs = RAW_RETENTION_MS) {
  ensureHourlyTable(db);

  const cutoff = new Date(Date.now() - retentionMs).toISOString();

  // Get distinct session × hour combinations that are old enough
  const buckets = db.prepare(`
    SELECT
      session_id,
      strftime('%Y-%m-%dT%H:00:00.000Z', timestamp) as hour_bucket,
      COUNT(*) as n
    FROM resource_metrics
    WHERE timestamp < ?
    GROUP BY session_id, hour_bucket
    HAVING n > 0
  `).all(cutoff);

  if (!buckets.length) return { bucketsCompressed: 0, rowsDeleted: 0 };

  let bucketsCompressed = 0;
  let rowsDeleted       = 0;

  const insertBucket = db.prepare(`
    INSERT OR REPLACE INTO metrics_hourly
      (session_id, hour_bucket, sample_count,
       cpu_min, cpu_avg, cpu_max, cpu_p95,
       mem_min, mem_avg, mem_max, mem_p95, created_at)
    VALUES
      (@session_id, @hour_bucket, @sample_count,
       @cpu_min, @cpu_avg, @cpu_max, @cpu_p95,
       @mem_min, @mem_avg, @mem_max, @mem_p95, @created_at)
  `);

  const deleteRaw = db.prepare(`
    DELETE FROM resource_metrics
    WHERE session_id IS @session_id
      AND strftime('%Y-%m-%dT%H:00:00.000Z', timestamp) = @hour_bucket
      AND timestamp < @cutoff
  `);

  const compressBucket = db.transaction((bucket) => {
    const rows = db.prepare(`
      SELECT cpu_pct, memory_mb FROM resource_metrics
      WHERE session_id IS ? AND strftime('%Y-%m-%dT%H:00:00.000Z', timestamp) = ?
      ORDER BY cpu_pct
    `).all(bucket.session_id, bucket.hour_bucket);

    if (!rows.length) return 0;

    const cpus = rows.map((r) => r.cpu_pct).sort((a, b) => a - b);
    const mems = rows.map((r) => r.memory_mb).sort((a, b) => a - b);
    const p95i = Math.floor(rows.length * 0.95);

    insertBucket.run({
      session_id:    bucket.session_id,
      hour_bucket:   bucket.hour_bucket,
      sample_count:  rows.length,
      cpu_min:  cpus[0],
      cpu_avg:  cpus.reduce((s, v) => s + v, 0) / cpus.length,
      cpu_max:  cpus[cpus.length - 1],
      cpu_p95:  cpus[p95i],
      mem_min:  mems[0],
      mem_avg:  mems.reduce((s, v) => s + v, 0) / mems.length,
      mem_max:  mems[mems.length - 1],
      mem_p95:  mems[p95i],
      created_at: new Date().toISOString(),
    });

    const del = deleteRaw.run({ session_id: bucket.session_id, hour_bucket: bucket.hour_bucket, cutoff });
    return del.changes;
  });

  for (const bucket of buckets) {
    const deleted = compressBucket(bucket);
    rowsDeleted += deleted;
    bucketsCompressed++;
  }

  return { bucketsCompressed, rowsDeleted };
}

export function getHourlyStats(db, sessionId = null, hours = 168) {
  ensureHourlyTable(db);
  const since = new Date(Date.now() - hours * 3600000).toISOString();
  const where = sessionId ? 'AND session_id = ?' : '';
  const args  = sessionId ? [since, sessionId] : [since];
  return db.prepare(`
    SELECT * FROM metrics_hourly WHERE hour_bucket > ? ${where}
    ORDER BY hour_bucket DESC
  `).all(...args);
}
