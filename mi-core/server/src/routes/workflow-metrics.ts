/**
 * DEV5 — Workflow Metrics API
 * 
 * GET /api/workflows/metrics          — authoritative workflow success metrics
 * GET /api/workflows/metrics/failures — failed workflow list with reasons
 * GET /api/workflows/ledger           — execution ledger entries
 * 
 * Source of truth: workflow_execution_ledger table.
 * No inferred scoring. No synthetic scoring.
 */

import { Router, Request, Response } from 'express';
import { computeWorkflowMetrics } from '../execution/workflow-metrics';
import { getRecentEntries, getFailedEntries, getEntriesSince, backfillFromWorkflowFiles, getLedgerByWorkflow } from '../execution/workflow-execution-ledger';
import { getFailureSummary, getRecentFailures, getOpenFailures, recordFailure, remediateFailure } from '../execution/failure-evidence-store';
import { getApprovalSourceOfTruth } from '../operations/approval-source-of-truth';
import { validateMemoryArchitecture } from '../operations/memory-architecture-validator';
import { probeAllConnectors, getProbeSummary } from '../operations/connector-live-probes';

export const workflowMetricsRouter = Router();

/**
 * GET /api/workflows/metrics
 * 
 * Returns authoritative workflow success metrics.
 * Query params:
 *   hours — lookback window (default: 24)
 */
workflowMetricsRouter.get('/metrics', (req: Request, res: Response) => {
  try {
    const hours = parseInt(String(req.query.hours || '24'), 10);
    const metrics = computeWorkflowMetrics(hours);
    res.json({ ok: true, metrics });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

/**
 * GET /api/workflows/metrics/failures
 * 
 * Returns actual failed workflow list with reasons.
 * Query params:
 *   hours — lookback window (default: 24)
 */
workflowMetricsRouter.get('/metrics/failures', (req: Request, res: Response) => {
  try {
    const hours = parseInt(String(req.query.hours || '24'), 10);
    const failures = getFailedEntries(hours);
    res.json({
      ok: true,
      count: failures.length,
      failures: failures.map(f => ({
        workflow_id: f.workflow_id,
        status: f.status,
        failure_reason: f.failure_reason,
        domain: f.domain,
        category: f.category,
        target_entity: f.target_entity,
        owner: f.owner,
        start_time: f.start_time,
        finish_time: f.finish_time,
        duration_ms: f.duration_ms,
        created_at: f.created_at,
      })),
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

/**
 * GET /api/workflows/ledger
 * 
 * Returns execution ledger entries.
 * Query params:
 *   hours — lookback window (default: 24)
 *   limit — max entries (default: 100)
 *   workflow_id — filter by specific workflow
 */
workflowMetricsRouter.get('/ledger', (req: Request, res: Response) => {
  try {
    const workflow_id = req.query.workflow_id ? String(req.query.workflow_id) : undefined;
    if (workflow_id) {
      const entries = getLedgerByWorkflow(workflow_id);
      res.json({ ok: true, count: entries.length, entries });
    } else {
      const hours = parseInt(String(req.query.hours || '24'), 10);
      const entries = getEntriesSince(hours);
      res.json({ ok: true, count: entries.length, entries });
    }
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

/**
 * POST /api/workflows/ledger/backfill
 * 
 * Trigger backfill of existing workflow files into the ledger.
 */
workflowMetricsRouter.post('/ledger/backfill', (_req: Request, res: Response) => {
  try {
    const result = backfillFromWorkflowFiles();
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// ── V2.1: Failure Evidence API ────────────────────────────────────────────

/**
 * GET /api/workflows/failures
 * Returns failure evidence summary (V2.1).
 */
workflowMetricsRouter.get('/failures', (req: Request, res: Response) => {
  try {
    const hours = parseInt(String(req.query.hours || '24'), 10);
    const summary = getFailureSummary(hours);
    res.json({ ok: true, summary });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

/**
 * GET /api/workflows/failures/open
 * Returns open (unresolved) failures.
 */
workflowMetricsRouter.get('/failures/open', (_req: Request, res: Response) => {
  try {
    const open = getOpenFailures();
    res.json({ ok: true, count: open.length, failures: open });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

/**
 * POST /api/workflows/failures
 * Record a new failure evidence entry.
 */
workflowMetricsRouter.post('/failures', (req: Request, res: Response) => {
  try {
    const { workflow_id, failure_type, failure_reason, severity, category, source, detail, stack_trace } = req.body;
    if (!workflow_id || !failure_type || !failure_reason) {
      return res.status(400).json({ ok: false, error: 'workflow_id, failure_type, failure_reason required' });
    }
    const evidence = recordFailure({ workflow_id, failure_type, failure_reason, severity, category, source, detail, stack_trace });
    res.json({ ok: true, evidence });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

/**
 * PATCH /api/workflows/failures/:id/remediate
 * Update remediation status of a failure.
 */
workflowMetricsRouter.patch('/failures/:id/remediate', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status, note } = req.body;
    if (!status) return res.status(400).json({ ok: false, error: 'status required (open|in_progress|resolved|wont_fix)' });
    const updated = remediateFailure(id, status, note);
    if (!updated) return res.status(404).json({ ok: false, error: 'not found' });
    res.json({ ok: true, evidence: updated });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// ── V2.1: Approval Source of Truth ────────────────────────────────────────

/**
 * GET /api/workflows/approval-truth
 * Returns unified approval state across all stores.
 */
workflowMetricsRouter.get('/approval-truth', (_req: Request, res: Response) => {
  try {
    const truth = getApprovalSourceOfTruth();
    res.json({ ok: true, truth });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// ── V2.1: Memory Architecture Validation ──────────────────────────────────

/**
 * GET /api/workflows/memory-arch
 * Returns memory architecture validation report.
 */
workflowMetricsRouter.get('/memory-arch', (_req: Request, res: Response) => {
  try {
    const report = validateMemoryArchitecture();
    res.json({ ok: true, report });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// ── V2.1: Connector Live Probes ───────────────────────────────────────────

/**
 * GET /api/workflows/connector-probes
 * Returns live connector probe results.
 */
workflowMetricsRouter.get('/connector-probes', (_req: Request, res: Response) => {
  try {
    const summary = getProbeSummary();
    res.json({ ok: true, summary });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});
