/**
 * DEV5 — Workflow Metrics API
 *
 * GET /api/workflows/metrics          — authoritative workflow success metrics
 * GET /api/workflows/metrics/failures — failed workflow list with reasons
 * GET /api/workflows/ledger           — execution ledger entries
 * POST /api/workflows/log             — Phase 0.7 workflow log + dedup + evidence
 * GET /api/workflows/status           — Phase 0.7 fabric dashboard
 *
 * Source of truth: workflow_execution_ledger table.
 */

import { Router, Request, Response } from 'express';
import { computeWorkflowMetrics } from '../execution/workflow-metrics';
import { getRecentEntries, getFailedEntries, getEntriesSince, backfillFromWorkflowFiles, getLedgerByWorkflow } from '../execution/workflow-execution-ledger';
import { getFailureSummary, getRecentFailures, getOpenFailures, recordFailure, remediateFailure } from '../execution/failure-evidence-store';
import { getApprovalSourceOfTruth } from '../operations/approval-source-of-truth';
import { validateMemoryArchitecture } from '../operations/memory-architecture-validator';
import { probeAllConnectors, getProbeSummary } from '../operations/connector-live-probes';
import { buildWorkflowFabricStatus } from '../workflow-fabric/workflow-dashboard';
import { logWorkflowExecution } from '../workflow-fabric/workflow-log-service';

// ── In-memory stores for n8n fabric ────────────────────────────────────────
const evidenceLog: Array<{
  received_at: string; workflow_id: string; status: string; evidence: unknown[]; duration_ms: number
}> = [];

const deadLetterLog: Array<{
  workflow_id: string; execution_id: string; error: string; retries: number;
  failed_at: string; department: string; owner: string; priority: string;
  task_id: string; status: string; created_at: string;
}> = [];

// ── /api/workflows/* router (existing) ─────────────────────────────────────
export const workflowMetricsRouter = Router();

workflowMetricsRouter.get('/metrics', (req: Request, res: Response) => {
  try {
    const hours = parseInt(String(req.query.hours || '24'), 10);
    const metrics = computeWorkflowMetrics(hours);
    res.json({ ok: true, metrics });
  } catch (e) { res.status(500).json({ ok: false, error: String(e) }); }
});

workflowMetricsRouter.get('/metrics/failures', (req: Request, res: Response) => {
  try {
    const hours = parseInt(String(req.query.hours || '24'), 10);
    const failures = getFailedEntries(hours);
    res.json({ ok: true, count: failures.length, failures: failures.map(f => ({
      workflow_id: f.workflow_id, status: f.status, failure_reason: f.failure_reason,
      domain: f.domain, category: f.category, target_entity: f.target_entity,
      owner: f.owner, start_time: f.start_time, finish_time: f.finish_time,
      duration_ms: f.duration_ms, created_at: f.created_at,
    }))});
  } catch (e) { res.status(500).json({ ok: false, error: String(e) }); }
});

workflowMetricsRouter.get('/ledger', (req: Request, res: Response) => {
  try {
    const workflow_id = req.query.workflow_id ? String(req.query.workflow_id) : undefined;
    if (workflow_id) {
      const entries = getLedgerByWorkflow(workflow_id);
      res.json({ ok: true, count: entries.length, entries });
    } else {
      const hours = parseInt(String(req.query.hours || '24'), 10);
      res.json({ ok: true, count: getEntriesSince(hours).length, entries: getEntriesSince(hours) });
    }
  } catch (e) { res.status(500).json({ ok: false, error: String(e) }); }
});

workflowMetricsRouter.post('/ledger/backfill', (_req: Request, res: Response) => {
  try { res.json({ ok: true, ...backfillFromWorkflowFiles() }); }
  catch (e) { res.status(500).json({ ok: false, error: String(e) }); }
});

workflowMetricsRouter.post('/log', (req: Request, res: Response) => {
  try {
    const result = logWorkflowExecution(req.body);
    if (!result.ok) return res.status(result.statusCode).json(result);
    res.json(result);
  } catch (e) { res.status(500).json({ ok: false, error: String(e) }); }
});

workflowMetricsRouter.get('/status', (req: Request, res: Response) => {
  try {
    const workflowId = req.query.workflow_id ? String(req.query.workflow_id) : '';
    if (!workflowId) return res.json({ ok: true, status: buildWorkflowFabricStatus() });
    const entries = getLedgerByWorkflow(workflowId);
    return res.json({ ok: true, workflow_id: workflowId, status: entries.at(-1)?.status ?? 'unknown', entries });
  } catch (e) { res.status(500).json({ ok: false, error: String(e) }); }
});

workflowMetricsRouter.get('/failures', (req: Request, res: Response) => {
  try { res.json({ ok: true, summary: getFailureSummary(parseInt(String(req.query.hours || '24'), 10)) }); }
  catch (e) { res.status(500).json({ ok: false, error: String(e) }); }
});

workflowMetricsRouter.get('/failures/open', (_req: Request, res: Response) => {
  try { res.json({ ok: true, count: getOpenFailures().length, failures: getOpenFailures() }); }
  catch (e) { res.status(500).json({ ok: false, error: String(e) }); }
});

workflowMetricsRouter.post('/failures', (req: Request, res: Response) => {
  try {
    const { workflow_id, failure_type, failure_reason, severity, category, source, detail, stack_trace } = req.body;
    if (!workflow_id || !failure_type || !failure_reason) return res.status(400).json({ ok: false, error: 'workflow_id, failure_type, failure_reason required' });
    res.json({ ok: true, evidence: recordFailure({ workflow_id, failure_type, failure_reason, severity, category, source, detail, stack_trace }) });
  } catch (e) { res.status(500).json({ ok: false, error: String(e) }); }
});

workflowMetricsRouter.patch('/failures/:id/remediate', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status, note } = req.body;
    if (!status) return res.status(400).json({ ok: false, error: 'status required' });
    const updated = remediateFailure(id, status, note);
    if (!updated) return res.status(404).json({ ok: false, error: 'not found' });
    res.json({ ok: true, evidence: updated });
  } catch (e) { res.status(500).json({ ok: false, error: String(e) }); }
});

workflowMetricsRouter.get('/approval-truth', (_req: Request, res: Response) => {
  try { res.json({ ok: true, truth: getApprovalSourceOfTruth() }); }
  catch (e) { res.status(500).json({ ok: false, error: String(e) }); }
});

workflowMetricsRouter.get('/memory-arch', (_req: Request, res: Response) => {
  try { res.json({ ok: true, report: validateMemoryArchitecture() }); }
  catch (e) { res.status(500).json({ ok: false, error: String(e) }); }
});

workflowMetricsRouter.get('/connector-probes', (_req: Request, res: Response) => {
  try { res.json({ ok: true, summary: getProbeSummary() }); }
  catch (e) { res.status(500).json({ ok: false, error: String(e) }); }
});

// ── /api/workflows/evidence (n8n fabric — mirrors /api/mi/workflows/evidence) ─
workflowMetricsRouter.get('/evidence', (req: Request, res: Response) => {
  try {
    const limit = parseInt(String(req.query.limit || '50'), 10);
    res.json({ ok: true, count: evidenceLog.length, records: evidenceLog.slice(0, limit) });
  } catch (e) { res.status(500).json({ ok: false, error: String(e) }); }
});

workflowMetricsRouter.post('/evidence', (req: Request, res: Response) => {
  try {
    const { workflow_id, status, evidence = [], duration_ms } = req.body;
    if (!workflow_id) return res.status(400).json({ ok: false, error: 'workflow_id required' });
    evidenceLog.push({ received_at: new Date().toISOString(), workflow_id, status: status || 'unknown', evidence, duration_ms: duration_ms || 0 });
    if (evidenceLog.length > 500) evidenceLog.splice(500);
    res.json({ ok: true, logged: true, workflow_id });
  } catch (e) { res.status(500).json({ ok: false, error: String(e) }); }
});

// ── /api/mi/workflows/* router — n8n fabric endpoints ────────────────────────
export const miWorkflowsRouter = Router();

// GET /api/mi/workflows/status
miWorkflowsRouter.get('/status', (req: Request, res: Response) => {
  try {
    const workflowId = req.query.workflow_id ? String(req.query.workflow_id) : '';
    if (!workflowId) return res.json({ ok: true, status: buildWorkflowFabricStatus() });
    const entries = getLedgerByWorkflow(workflowId);
    return res.json({ ok: true, workflow_id: workflowId, status: entries.at(-1)?.status ?? 'unknown', entries });
  } catch (e) { res.status(500).json({ ok: false, error: String(e) }); }
});

// POST /api/mi/workflows/log
miWorkflowsRouter.post('/log', (req: Request, res: Response) => {
  try {
    const result = logWorkflowExecution(req.body);
    if (!result.ok) return res.status(result.statusCode).json(result);
    res.json(result);
  } catch (e) { res.status(500).json({ ok: false, error: String(e) }); }
});

// POST /api/mi/workflows/evidence
miWorkflowsRouter.post('/evidence', (req: Request, res: Response) => {
  try {
    const { workflow_id, status, evidence = [], duration_ms } = req.body;
    if (!workflow_id) return res.status(400).json({ ok: false, error: 'workflow_id required' });
    evidenceLog.push({ received_at: new Date().toISOString(), workflow_id, status: status || 'unknown', evidence, duration_ms: duration_ms || 0 });
    if (evidenceLog.length > 500) evidenceLog.splice(500);
    res.json({ ok: true, logged: true, workflow_id });
  } catch (e) { res.status(500).json({ ok: false, error: String(e) }); }
});

// GET /api/mi/workflows/evidence
miWorkflowsRouter.get('/evidence', (req: Request, res: Response) => {
  try {
    const limit = parseInt(String(req.query.limit || '50'), 10);
    res.json({ ok: true, count: evidenceLog.length, records: evidenceLog.slice(0, limit) });
  } catch (e) { res.status(500).json({ ok: false, error: String(e) }); }
});

// POST /api/mi/workflows/heartbeat
miWorkflowsRouter.post('/heartbeat', (req: Request, res: Response) => {
  try {
    const { workflow_id, status } = req.body;
    if (!workflow_id) return res.status(400).json({ ok: false, error: 'workflow_id required' });
    console.log(`[n8n][HEARTBEAT] workflow=${workflow_id} status=${status || 'running'} ts=${new Date().toISOString()}`);
    res.json({ ok: true, heartbeat: true, workflow_id, status: status || 'running' });
  } catch (e) { res.status(500).json({ ok: false, error: String(e) }); }
});

// POST /api/mi/workflows/dead-letter
miWorkflowsRouter.post('/dead-letter', (req: Request, res: Response) => {
  try {
    const { workflow_id, execution_id, error, retries, failed_at, department, owner, priority } = req.body;
    if (!workflow_id || !error) return res.status(400).json({ ok: false, error: 'workflow_id and error required' });
    const task_id = `tsk_deadletter_${Date.now()}`;
    const entry = {
      workflow_id, execution_id: execution_id || '', error, retries: retries || 3,
      failed_at: failed_at || new Date().toISOString(),
      department: department || 'unknown', owner: owner || 'unknown', priority: priority || 'P3',
      task_id, status: 'pending', created_at: new Date().toISOString(),
    };
    deadLetterLog.unshift(entry);
    if (deadLetterLog.length > 200) deadLetterLog.splice(200);
    console.error(`[n8n][DEAD-LETTER] workflow=${workflow_id} error=${error} retries=${retries} task=${task_id}`);
    res.json({ ok: true, dead_letter_created: true, entry });
  } catch (e) { res.status(500).json({ ok: false, error: String(e) }); }
});

// GET /api/mi/workflows/dead-letter
miWorkflowsRouter.get('/dead-letter', (req: Request, res: Response) => {
  try {
    const limit = parseInt(String(req.query.limit || '50'), 10);
    res.json({ ok: true, count: deadLetterLog.length, dead_letters: deadLetterLog.slice(0, limit) });
  } catch (e) { res.status(500).json({ ok: false, error: String(e) }); }
});

// POST /api/mi/workflows/retry
miWorkflowsRouter.post('/retry', (req: Request, res: Response) => {
  try {
    const { workflow_id, attempt, max_retries, retry_delay_ms } = req.body;
    if (!workflow_id) return res.status(400).json({ ok: false, error: 'workflow_id required' });
    const nextAttempt = (attempt || 1) + 1;
    const max = max_retries || 3;
    const delay = retry_delay_ms || 5000;
    const shouldRetry = nextAttempt <= max;
    console.log(`[n8n][RETRY] workflow=${workflow_id} attempt=${nextAttempt}/${max} retry=${shouldRetry} delay=${delay}ms`);
    res.json({ ok: true, retry_scheduled: shouldRetry, next_attempt: shouldRetry ? nextAttempt : null, scheduled_delay_ms: shouldRetry ? delay : null });
  } catch (e) { res.status(500).json({ ok: false, error: String(e) }); }
});
