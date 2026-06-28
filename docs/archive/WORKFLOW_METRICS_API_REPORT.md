# WORKFLOW METRICS API REPORT

**Date:** 2026-06-15
**Author:** DEV5
**Status:** DEPLOYED

---

## Executive Summary

A new authoritative Workflow Metrics API has been created at `/api/workflows/metrics`. This API is the **only source** for workflow success rate data. No inferred scoring. No synthetic scoring.

---

## API Endpoints

### GET /api/workflows/metrics

**Purpose:** Authoritative workflow success metrics

**Query Parameters:**
| Param | Default | Description |
|-------|---------|-------------|
| `hours` | 24 | Lookback window for 24h metrics |

**Response:**
```json
{
  "ok": true,
  "metrics": {
    "total": 1090,
    "success": 0,
    "failed": 0,
    "running": 0,
    "cancelled": 0,
    "approval_pending": 0,
    "rejected": 0,
    "created": 1090,
    "success_rate": 0,
    "total_24h": 1090,
    "success_24h": 0,
    "failed_24h": 0,
    "running_24h": 0,
    "success_rate_24h": 0,
    "by_domain": { "general": 1090 },
    "by_status": { "created": 1090 },
    "by_category": { "dashboard_audit": 1090 },
    "top_failures": [],
    "avg_duration_ms": null,
    "p95_duration_ms": null,
    "computed_at": "2026-06-15T..."
  }
}
```

**Key Metrics Explained:**

| Metric | Definition |
|--------|-----------|
| `total` | All workflow records in ledger (all-time) |
| `success` | Workflows with status `completed` |
| `failed` | Workflows with status `failed` or `timeout` |
| `running` | Workflows with status `started` or `running` |
| `success_rate` | `completed / (completed + failed + cancelled + rejected) × 100` |
| `success_rate_24h` | Same formula, last 24h only |
| `top_failures` | Top 10 failure reasons by count |

### GET /api/workflows/metrics/failures

**Purpose:** Actual failed workflow list with reasons

**Query Parameters:**
| Param | Default | Description |
|-------|---------|-------------|
| `hours` | 24 | Lookback window |

**Response:**
```json
{
  "ok": true,
  "count": 0,
  "failures": []
}
```

### GET /api/workflows/ledger

**Purpose:** Execution ledger entries

**Query Parameters:**
| Param | Default | Description |
|-------|---------|-------------|
| `hours` | 24 | Lookback window |
| `workflow_id` | - | Filter by specific workflow |

### POST /api/workflows/ledger/backfill

**Purpose:** Trigger backfill of existing workflow files into ledger

**Response:**
```json
{
  "ok": true,
  "imported": 1090,
  "skipped": 0
}
```

---

## Source of Truth Chain

```
workflow-execution-ledger.ts  (SQLite table)
        ↓
workflow-metrics.ts           (computeWorkflowMetrics())
        ↓
workflow-metrics.ts route     (GET /api/workflows/metrics)
        ↓
burn-in.ts                    (consumes computeWorkflowMetrics(24))
```

**No other module may compute workflow success rate.**

---

## What This Replaces

| Before (V1) | After (V2) |
|-------------|-----------|
| No execution ledger | workflow_execution_ledger table |
| "81.3% success" with no evidence | Computed from actual status counts |
| workflow-registry.ts analytics | Superseded by ledger-based metrics |
| Burn-in used `getWorkflowAnalytics()` | Burn-in uses `computeWorkflowMetrics()` |
| Status scattered across JSON + SQLite | Single unified ledger |

---

## Evidence

| Item | Proof |
|------|-------|
| Route file exists | `server/src/routes/workflow-metrics.ts` |
| Route mounted in index.ts | `app.use('/api/workflows', requireAuth, workflowMetricsRouter)` |
| Metrics module exists | `server/src/execution/workflow-metrics.ts` |
| Ledger module exists | `server/src/execution/workflow-execution-ledger.ts` |
| Re-exports in execution/index.ts | All ledger + metrics functions exported |

---

*WORKFLOW_METRICS_API: DEPLOYED*
