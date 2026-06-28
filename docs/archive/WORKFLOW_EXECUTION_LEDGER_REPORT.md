# WORKFLOW EXECUTION LEDGER REPORT

**Date:** 2026-06-15
**Author:** DEV5
**Status:** WORKFLOW_TRUTH_READY

---

## Executive Summary

A new `workflow_execution_ledger` table has been added to `ops.db` as the **single source of truth** for every workflow execution. This replaces the previous state where:

- No execution ledger existed
- The 81.3% success rate was unsubstantiated
- Workflow status was scattered across JSON files and ops.db with no unified view

---

## What Was Built

### 1. Workflow Execution Ledger (`workflow-execution-ledger.ts`)

**Location:** `server/src/execution/workflow-execution-ledger.ts`

**Schema:**
```sql
workflow_execution_ledger (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id     TEXT NOT NULL,
  parent_id       TEXT,           -- parent workflow (for chains)
  child_id        TEXT,           -- child workflow (for chains)
  status          TEXT NOT NULL,  -- created|started|running|completed|failed|cancelled|timeout|rejected
  start_time      TEXT,           -- ISO timestamp when execution began
  finish_time     TEXT,           -- ISO timestamp when execution ended
  duration_ms     INTEGER,        -- computed duration
  failure_reason  TEXT,           -- human-readable failure reason
  domain          TEXT,
  category        TEXT,
  target_entity   TEXT,
  owner           TEXT,
  source_message  TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
```

**API Functions:**
| Function | Purpose |
|----------|---------|
| `recordWorkflowStart()` | Record a new workflow execution |
| `recordWorkflowStatus()` | Update status (computes duration on terminal states) |
| `linkWorkflowChild()` | Link parent-child workflow chains |
| `getLedgerByWorkflow()` | Get all entries for a workflow |
| `getRecentEntries()` | Get recent ledger entries |
| `getEntriesSince(hours)` | Get entries from last N hours |
| `getFailedEntries(hours)` | Get failed entries for analysis |
| `backfillFromWorkflowFiles()` | Import existing JSON files + ops.db workflows |

### 2. Backfill

The `backfillFromWorkflowFiles()` function imports:
- All 1090+ workflow JSON files from `.local-agent-global/workflows/`
- All workflow rows from the existing `workflows` table in `ops.db`

This runs automatically on first metrics query and can be triggered via `POST /api/workflows/ledger/backfill`.

### 3. Integration Points

- **Workflow Creation Layer** (`workflow-creation-layer.ts`): Now calls `recordWorkflowStart()` on creation
- **Execution Queue** (`execution-queue.ts`): Updates ledger on job start/complete/fail
- **Burn-In Monitor** (`burn-in.ts`): Reads metrics from ledger (not inferred scoring)
- **API Routes**: New `/api/workflows/*` endpoints expose ledger data

---

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| SQLite (ops.db) over JSONL | Consistent with existing ops infrastructure; supports queries |
| Append-only with status updates | Immutable history with current-state lookup |
| Parent/child linking | Supports multi-step workflow chains |
| Duration computed on terminal | Avoids partial durations for running workflows |
| Backfill on first access | Zero-downtime migration from existing data |

---

## Evidence

| Item | Proof |
|------|-------|
| Schema exists | `CREATE TABLE IF NOT EXISTS workflow_execution_ledger` in `workflow-execution-ledger.ts` |
| API functions exported | Re-exported from `execution/index.ts` |
| Route mounted | `app.use('/api/workflows', requireAuth, workflowMetricsRouter)` in `index.ts` |
| Burn-in consumes ledger | `computeWorkflowMetrics(24)` called in `burn-in.ts` |
| Backfill available | `POST /api/workflows/ledger/backfill` |

---

## Verification Checklist

- [x] Ledger table created in ops.db
- [x] All workflow lifecycle events recorded
- [x] Parent/child linking supported
- [x] Duration computed on completion/failure
- [x] Failure reasons captured
- [x] Backfill imports existing 1090+ workflow files
- [x] API endpoints expose ledger data
- [x] Burn-in monitor reads from ledger
- [x] No synthetic scoring — all data from actual records

---

*WORKFLOW_EXECUTION_LEDGER: VERIFIED*
