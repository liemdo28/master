/**
 * DEV5 — Phase E4: Execution Queue
 * 
 * All actions go through queue. No direct execution from chat response.
 * Each queued job has: idempotency_key, retry policy, owner, timeout, evidence, final status.
 */

import fs from 'fs';
import path from 'path';

// ── Types ──────────────────────────────────────────────────────────────────

export type QueueName =
  | 'website_queue'
  | 'marketing_queue'
  | 'email_queue'
  | 'finance_queue'
  | 'code_queue'
  | 'browser_queue'
  | 'report_queue';

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'retrying' | 'cancelled';

export interface QueueJob {
  id: string;
  idempotency_key: string;
  queue: QueueName;
  workflow_id: string;
  workflow_type: string;
  target_entity: string | undefined;
  owner: string;
  status: JobStatus;
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
  timeout_ms: number;
  max_retries: number;
  retry_count: number;
  last_error?: string;
  evidence?: string;
  result?: {
    status: string;
    summary: string;
    deliverables: string[];
  };
}

// ── Storage ────────────────────────────────────────────────────────────────

const MI_CORE_ROOT = process.env.MI_CORE_ROOT || 'E:/Project/Master/mi-core';
const QUEUE_DIR = path.join(MI_CORE_ROOT, '.local-agent-global', 'execution-queue');

function ensureDir() {
  fs.mkdirSync(QUEUE_DIR, { recursive: true });
}

function jobPath(id: string) {
  return path.join(QUEUE_DIR, `${id}.json`);
}

function saveJob(job: QueueJob) {
  ensureDir();
  job.updated_at = new Date().toISOString();
  fs.writeFileSync(jobPath(job.id), JSON.stringify(job, null, 2));
}

function loadJob(id: string): QueueJob | null {
  try { return JSON.parse(fs.readFileSync(jobPath(id), 'utf8')); } catch { return null; }
}

function listJobs(): QueueJob[] {
  ensureDir();
  return fs.readdirSync(QUEUE_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => { try { return JSON.parse(fs.readFileSync(path.join(QUEUE_DIR, f), 'utf8')); } catch { return null; } })
    .filter(Boolean)
    .sort((a: QueueJob, b: QueueJob) => b.created_at.localeCompare(a.created_at));
}

// ── Queue routing ──────────────────────────────────────────────────────────

function routeToQueue(workflowType: string, domain: string): QueueName {
  const key = `${workflowType}_${domain}`.toLowerCase();
  if (/seo|website|post/.test(key)) return 'website_queue';
  if (/social|campaign|flyer|video|marketing/.test(key)) return 'marketing_queue';
  if (/email/.test(key)) return 'email_queue';
  if (/finance|qb|report/.test(key)) return 'finance_queue';
  if (/bug|fix|code/.test(key)) return 'code_queue';
  if (/browser/.test(key)) return 'browser_queue';
  return 'report_queue';
}

function getTimeout(queue: QueueName): number {
  const timeouts: Record<QueueName, number> = {
    website_queue: 300_000,
    marketing_queue: 600_000,
    email_queue: 120_000,
    finance_queue: 300_000,
    code_queue: 600_000,
    browser_queue: 600_000,
    report_queue: 180_000,
  };
  return timeouts[queue] || 300_000;
}

// ── Public API ─────────────────────────────────────────────────────────────

export function enqueueJob(params: {
  workflow_id: string;
  workflow_type: string;
  target_entity: string | undefined;
  domain: string;
  owner: string;
  idempotency_key: string;
}): QueueJob {
  const queue = routeToQueue(params.workflow_type, params.domain);
  const now = new Date().toISOString();
  const job: QueueJob = {
    id: `JOB-${Date.now().toString(36)}-${String(Math.floor(Math.random() * 999)).padStart(3, '0')}`,
    idempotency_key: params.idempotency_key,
    queue,
    workflow_id: params.workflow_id,
    workflow_type: params.workflow_type,
    target_entity: params.target_entity,
    owner: params.owner,
    status: 'queued',
    created_at: now,
    updated_at: now,
    timeout_ms: getTimeout(queue),
    max_retries: 3,
    retry_count: 0,
  };
  saveJob(job);
  return job;
}

export function startJob(id: string): QueueJob | null {
  const job = loadJob(id);
  if (!job || job.status !== 'queued') return null;
  job.status = 'running';
  job.started_at = new Date().toISOString();
  saveJob(job);
  return job;
}

export function completeJob(id: string, result: { status: string; summary: string; deliverables: string[] }): QueueJob | null {
  const job = loadJob(id);
  if (!job) return null;
  job.status = 'completed';
  job.completed_at = new Date().toISOString();
  job.result = result;
  job.evidence = `Job ${id} completed at ${job.completed_at}`;
  saveJob(job);
  return job;
}

export function failJob(id: string, error: string): QueueJob | null {
  const job = loadJob(id);
  if (!job) return null;
  job.last_error = error;
  if (job.retry_count < job.max_retries) {
    job.status = 'retrying';
    job.retry_count += 1;
  } else {
    job.status = 'failed';
    job.completed_at = new Date().toISOString();
  }
  saveJob(job);
  return job;
}

export function cancelJob(id: string): QueueJob | null {
  const job = loadJob(id);
  if (!job) return null;
  job.status = 'cancelled';
  job.completed_at = new Date().toISOString();
  saveJob(job);
  return job;
}

export function getJob(id: string): QueueJob | null {
  return loadJob(id);
}

export function getJobsByWorkflow(workflowId: string): QueueJob[] {
  return listJobs().filter(j => j.workflow_id === workflowId);
}

export function getQueuedJobs(queue?: QueueName): QueueJob[] {
  return listJobs().filter(j => j.status === 'queued' && (!queue || j.queue === queue));
}

export function hasDuplicateJob(idempotencyKey: string): boolean {
  return listJobs().some(j => j.idempotency_key === idempotencyKey && ['queued', 'running'].includes(j.status));
}
