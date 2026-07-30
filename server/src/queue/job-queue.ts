import { pgQuery, pgQueryOne } from '../bigdata/db-client';

export type QueueJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'dead_letter';

export interface QueueJob {
  id: number;
  queue_name: string;
  job_type: string;
  status: QueueJobStatus;
  priority: number;
  attempts: number;
  max_attempts: number;
  payload_json: Record<string, unknown>;
  result_json?: Record<string, unknown>;
  error_message?: string;
  run_after: string;
  locked_at?: string;
  locked_by?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

let schemaReady: Promise<void> | null = null;

export function ensureEnterpriseSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pgQuery(`
        CREATE TABLE IF NOT EXISTS queue_jobs (
          id BIGSERIAL PRIMARY KEY,
          queue_name VARCHAR(96) NOT NULL DEFAULT 'default',
          job_type VARCHAR(96) NOT NULL,
          status VARCHAR(32) NOT NULL DEFAULT 'pending',
          priority INTEGER NOT NULL DEFAULT 100,
          attempts INTEGER NOT NULL DEFAULT 0,
          max_attempts INTEGER NOT NULL DEFAULT 3,
          payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
          result_json JSONB,
          error_message TEXT,
          run_after TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          locked_at TIMESTAMPTZ,
          locked_by VARCHAR(128),
          created_by VARCHAR(128) NOT NULL DEFAULT 'system',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_queue_jobs_claim ON queue_jobs(status, run_after, priority, created_at);
        CREATE INDEX IF NOT EXISTS idx_queue_jobs_type ON queue_jobs(job_type);
        CREATE INDEX IF NOT EXISTS idx_queue_jobs_created ON queue_jobs(created_at DESC);
        CREATE TABLE IF NOT EXISTS queue_dead_letters (
          id BIGSERIAL PRIMARY KEY,
          job_id BIGINT,
          queue_name VARCHAR(96),
          job_type VARCHAR(96),
          payload_json JSONB,
          error_message TEXT,
          attempts INTEGER,
          moved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS provider_call_audit (
          id BIGSERIAL PRIMARY KEY,
          operation VARCHAR(64) NOT NULL,
          primary_provider VARCHAR(64),
          selected_provider VARCHAR(64),
          model VARCHAR(128),
          status VARCHAR(32) NOT NULL,
          latency_ms INTEGER,
          error_message TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS permission_audit (
          id BIGSERIAL PRIMARY KEY,
          actor VARCHAR(128) NOT NULL,
          action VARCHAR(128) NOT NULL,
          resource TEXT NOT NULL,
          decision VARCHAR(32) NOT NULL,
          reason TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
    })();
  }
  return schemaReady;
}

export async function enqueueJob(params: {
  queue_name?: string;
  job_type: string;
  payload_json?: Record<string, unknown>;
  priority?: number;
  max_attempts?: number;
  created_by?: string;
  run_after?: string;
}): Promise<QueueJob> {
  await ensureEnterpriseSchema();
  const rows = await pgQuery<QueueJob>(
    `INSERT INTO queue_jobs
     (queue_name, job_type, payload_json, priority, max_attempts, created_by, run_after)
     VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7::timestamptz,NOW()))
     RETURNING *`,
    [
      params.queue_name || 'default',
      params.job_type,
      params.payload_json || {},
      params.priority || 100,
      params.max_attempts || 3,
      params.created_by || 'api',
      params.run_after || null,
    ],
  );
  return rows[0];
}

export async function claimNextJob(queueName = 'default', workerId = 'mi-worker'): Promise<QueueJob | null> {
  await ensureEnterpriseSchema();
  return pgQueryOne<QueueJob>(
    `UPDATE queue_jobs
     SET status='running', attempts=attempts+1, locked_at=NOW(), locked_by=$2, updated_at=NOW()
     WHERE id = (
       SELECT id FROM queue_jobs
       WHERE queue_name=$1 AND status='pending' AND run_after <= NOW()
       ORDER BY priority ASC, created_at ASC
       FOR UPDATE SKIP LOCKED
       LIMIT 1
     )
     RETURNING *`,
    [queueName, workerId],
  );
}

export async function completeJob(id: number, result: Record<string, unknown> = {}): Promise<QueueJob | null> {
  await ensureEnterpriseSchema();
  return pgQueryOne<QueueJob>(
    `UPDATE queue_jobs
     SET status='completed', result_json=$2, error_message=NULL, updated_at=NOW()
     WHERE id=$1
     RETURNING *`,
    [id, result],
  );
}

export async function failJob(id: number, error: string): Promise<QueueJob | null> {
  await ensureEnterpriseSchema();
  const job = await pgQueryOne<QueueJob>('SELECT * FROM queue_jobs WHERE id=$1', [id]);
  if (!job) return null;

  if (job.attempts >= job.max_attempts) {
    await pgQuery(
      `INSERT INTO queue_dead_letters (job_id, queue_name, job_type, payload_json, error_message, attempts)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [job.id, job.queue_name, job.job_type, job.payload_json, error, job.attempts],
    );
    return pgQueryOne<QueueJob>(
      `UPDATE queue_jobs SET status='dead_letter', error_message=$2, updated_at=NOW() WHERE id=$1 RETURNING *`,
      [id, error],
    );
  }

  return pgQueryOne<QueueJob>(
    `UPDATE queue_jobs
     SET status='pending', error_message=$2, run_after=NOW() + ($3 || ' seconds')::interval, updated_at=NOW()
     WHERE id=$1
     RETURNING *`,
    [id, error, Math.min(300, Math.pow(2, job.attempts) * 15)],
  );
}

export async function cancelJob(id: number, reason = 'cancelled'): Promise<QueueJob | null> {
  await ensureEnterpriseSchema();
  return pgQueryOne<QueueJob>(
    `UPDATE queue_jobs
     SET status='failed', error_message=$2, updated_at=NOW()
     WHERE id=$1 AND status IN ('pending','running')
     RETURNING *`,
    [id, reason],
  );
}

export async function retryJob(id: number): Promise<QueueJob | null> {
  await ensureEnterpriseSchema();
  return pgQueryOne<QueueJob>(
    `UPDATE queue_jobs
     SET status='pending', error_message=NULL, run_after=NOW(), locked_at=NULL, locked_by=NULL, updated_at=NOW()
     WHERE id=$1 AND status IN ('failed','dead_letter')
     RETURNING *`,
    [id],
  );
}

export async function getQueueJob(id: number): Promise<QueueJob | null> {
  await ensureEnterpriseSchema();
  return pgQueryOne<QueueJob>('SELECT * FROM queue_jobs WHERE id=$1', [id]);
}

export async function listQueueJobs(limit = 100): Promise<QueueJob[]> {
  await ensureEnterpriseSchema();
  return pgQuery<QueueJob>('SELECT * FROM queue_jobs ORDER BY created_at DESC LIMIT $1', [limit]);
}

export async function queueStats(): Promise<Record<string, unknown>[]> {
  await ensureEnterpriseSchema();
  return pgQuery(
    `SELECT queue_name, job_type, status, COUNT(*)::int as count
     FROM queue_jobs
     GROUP BY queue_name, job_type, status
     ORDER BY queue_name, job_type, status`,
  );
}
