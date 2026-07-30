# DEV5 — WORKFLOW TRUTH REPORT

**Date:** 2026-06-15
**Target:** WORKFLOW_TRUTH_READY
**Status:** ✅ ACHIEVED

---

## Executive Summary

The workflow execution truth layer is now complete. Every workflow execution is recorded in an append-only ledger, metrics are computed exclusively from this ledger, and failures are tracked with structured evidence including severity, remediation status, and audit trail.

**No more fabricated success rates.** The old "81.3%" figure is replaced with actual counts from the `workflow_execution_ledger` table.

---

## 1. Execution Ledger

### What It Is
An append-only SQLite table that records every workflow lifecycle event:
- `created` → `started` → `running` → `completed` / `failed` / `timeout` / `rejected`

### Schema
```sql
workflow_execution_ledger (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id     TEXT NOT NULL,
  parent_id       TEXT,
  child_id        TEXT,
  status          TEXT NOT NULL DEFAULT 'created',
  start_time      TEXT,
  finish_time     TEXT,
  duration_ms     INTEGER,
  failure_reason  TEXT,
  domain          TEXT,
  category        TEXT,
  target_entity   TEXT,
  owner           TEXT,
  source_message  TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
)
```

### Key Properties
- **Append-only** — entries are never deleted
- **Immutable status transitions** — terminal states (completed, failed, cancelled, timeout, rejected) are final
- **Duration computed** — `finish_time - start_time` for all terminal entries
- **Parent-child linking** — supports workflow chains and sub-workflows
- **Backfill support** — imports from existing `.local-agent-global/workflows/*.json` and `ops.db/workflows`

### API
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/workflows/ledger` | GET | Recent entries (hours, limit, workflow_id params) |
| `/api/workflows/ledger/backfill` | POST | Import existing workflow files into ledger |

---

## 2. Workflow Metrics API

### Source of Truth
All metrics are computed from `workflow_execution_ledger` table only. No inferred scoring. No synthetic data.

### Metrics Computed
| Metric | Description |
|--------|-------------|
| `total` | All-time total entries |
| `success` | Completed entries |
| `failed` | Failed + timeout entries |
| `running` | Currently executing |
| `cancelled` | Cancelled by user/system |
| `rejected` | Rejected at approval gate |
| `success_rate` | `completed / (completed + failed + cancelled + rejected) * 100` |
| `success_rate_24h` | Same formula, last 24 hours only |
| `top_failures` | Top 10 failure reasons with counts |
| `avg_duration_ms` | Average execution time |
| `p95_duration_ms` | 95th percentile execution time |
| `by_domain` | Breakdown by business domain |
| `by_category` | Breakdown by category |
| `by_status` | Breakdown by status |

### API
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/workflows/metrics` | GET | Authoritative success metrics (hours param) |
| `/api/workflows/metrics/failures` | GET | Failed workflow entries with reasons |

### Why This Matters
Before V2, the "81.3% success rate" had no supporting evidence. No execution ledger existed. The briefing engine showed 0%. Now:
- Success rate = `count(completed) / count(all_terminal)` from the ledger
- Every claimed metric can be traced to specific database rows
- The ledger is the ONLY source — no alternative computations allowed

---

## 3. Failure Evidence Store

### What It Is
A structured SQLite table for tracking workflow failures with:
- **Severity classification** (P0/P1/P2/P3)
- **Failure type** (workflow_fail, approval_fail, intent_fail, connector_fail, timeout, credential_leak, hallucination, data_loss)
- **Category** (credential_leak, approval_bypass, entity_lost, data_inconsistency, connector_misconfig)
- **Remediation tracking** (open → in_progress → resolved)
- **Audit trail** (source, detail, stack_trace)

### Schema
```sql
failure_evidence (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id     TEXT NOT NULL,
  failure_type    TEXT NOT NULL,
  failure_reason  TEXT NOT NULL,
  severity        TEXT NOT NULL DEFAULT 'P2',
  category        TEXT,
  source          TEXT,
  detail          TEXT,
  stack_trace     TEXT,
  remediation     TEXT DEFAULT 'open',
  remediation_note TEXT,
  created_at      TEXT NOT NULL,
  resolved_at     TEXT
)
```

### Seeded Baseline Failures (from DEV4_FAILED_CASES.md)
| ID | Type | Reason | Severity |
|----|------|--------|----------|
| FC-001 | credential_leak | Credential leaked in LLM response before approval gate | P0 |
| FC-002 | approval_fail | Approval gate runs AFTER LLM response | P1 |
| FC-003 | intent_fail | Multi-intent: Dashboard dropped silently | P2 |
| FC-004 | intent_fail | Entity carryover lost after 1 turn | P2 |
| FC-005 | workflow_fail | Health status contradictory across 3 surfaces | P2 |
| FC-006 | intent_fail | /dash shorthand matched wrong entity | P2 |
| FC-007 | workflow_fail | Approval count mismatch across surfaces | P1 |
| FC-008 | connector_fail | Accounting engine route prefix wrong | P1 |

### API
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/workflows/failures` | GET | Failure summary (hours param) |
| `/api/workflows/failures/open` | GET | Open (unresolved) failures |
| `/api/workflows/failures` | POST | Record new failure evidence |
| `/api/workflows/failures/:id/remediate` | PATCH | Update remediation status |

---

## 4. Success Rate Source

### Before V2
```
Monitor Claim: 81.3%
Evidence: None found
Briefing: 0%
Execution Ledger: Does not exist
Actual Failures: 7+ documented
```

### After V2.1
```
Source: workflow_execution_ledger table
Formula: count(completed) / count(terminal_statuses) * 100
Breakdown: All-time AND 24h window
Verification: /api/workflows/metrics returns live counts
Additional: /api/workflows/failures returns structured evidence
```

---

## 5. Burn-In Score Integration

The workflow metrics are consumed by the burn-in monitor for scoring:

```
Burn-In Score Component: Workflow Success Rate (15 pts)
Source: computeWorkflowMetrics(24).success_rate_24h
Formula: workflowMetrics.success_rate_24h * 0.15
```

This means the burn-in score directly reflects real workflow outcomes — not estimates, not inferences.

---

## 6. API Surface Summary

### Complete V2.1 API Surface

| Endpoint | Method | Module | Description |
|----------|--------|--------|-------------|
| `/api/workflows/metrics` | GET | workflow-metrics.ts | Authoritative success metrics |
| `/api/workflows/metrics/failures` | GET | workflow-execution-ledger.ts | Failed entries from ledger |
| `/api/workflows/ledger` | GET | workflow-execution-ledger.ts | Execution ledger entries |
| `/api/workflows/ledger/backfill` | POST | workflow-execution-ledger.ts | Import existing workflows |
| `/api/workflows/failures` | GET | failure-evidence-store.ts | Failure summary with severity |
| `/api/workflows/failures/open` | GET | failure-evidence-store.ts | Unresolved failures |
| `/api/workflows/failures` | POST | failure-evidence-store.ts | Record new failure |
| `/api/workflows/failures/:id/remediate` | PATCH | failure-evidence-store.ts | Update remediation |
| `/api/workflows/approval-truth` | GET | approval-source-of-truth.ts | Unified approval counts |
| `/api/workflows/memory-arch` | GET | memory-architecture-validator.ts | Memory architecture validation |
| `/api/workflows/connector-probes` | GET | connector-live-probes.ts | Live connector health |

---

## 7. Files Created

### DEV5 — Execution Truth Layer
| File | Lines | Purpose |
|------|-------|---------|
| `server/src/execution/workflow-execution-ledger.ts` | 352 | Append-only execution ledger |
| `server/src/execution/workflow-metrics.ts` | 187 | Metrics computed from ledger |
| `server/src/execution/failure-evidence-store.ts` | 260 | Structured failure evidence |

### DEV5 — API Layer
| File | Lines | Purpose |
|------|-------|---------|
| `server/src/routes/workflow-metrics.ts` | 200+ | All workflow truth API endpoints |

---

## 8. Data Flow

```
User Message
  → processCEORequest()
  → recordWorkflowStart()          [ledger]
  → execute workflow
  → recordWorkflowStatus()         [ledger]
  → if failure: recordFailure()    [failure_evidence]
  → computeWorkflowMetrics()       [metrics from ledger]
  → getFailureSummary()            [failure evidence]
  → burn-in report                 [consumes all above]
```

Every step is traceable. Every claim has evidence.

---

## Target: WORKFLOW_TRUTH_READY ✅

| Requirement | Status |
|------------|--------|
| Execution ledger exists and is append-only | ✅ `workflow_execution_ledger` table |
| Workflow metrics API returns real data | ✅ `computeWorkflowMetrics()` |
| Failure evidence is structured and trackable | ✅ `failure_evidence` table |
| Success rate has a single source of truth | ✅ Ledger-only computation |
| Burn-in monitor consumes truth layer | ✅ V2.1 integration complete |
| No fabricated metrics | ✅ All metrics trace to DB rows |
