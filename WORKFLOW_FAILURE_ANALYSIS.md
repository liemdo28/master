# WORKFLOW FAILURE ANALYSIS

**Date:** 2026-06-15
**Author:** DEV5
**Trigger:** Burn-in audit found 81.3% success rate claim

---

## Executive Summary

The claimed 81.3% workflow success rate has **no supporting evidence**. After exhaustive investigation:

1. **No execution ledger existed** before this commit
2. **The 81.3% figure is unsubstantiated** — it appears to have been inferred or synthetic
3. **All 1090 workflow files are in `created` status** — none have been marked completed or failed
4. **8 real failures** have been documented across the system

---

## Investigation: Where Did 81.3% Come From?

### Source Trace

| Source | What It Says | Status |
|--------|-------------|--------|
| Burn-in monitor V1 | Reports 81.3% workflow success | **UNSUBSTANTIATED** |
| `workflow-registry.ts` | `getWorkflowAnalytics()` returns rates from `workflows` table | **Empty table** |
| `quality-metrics.ts` | `action_success_rate` from quality_events | **Separate metric, not workflow rate** |
| Briefing engine | Shows 0% success on one surface | **Contradicts 81.3%** |

### Root Cause of False Claim

The 81.3% was likely computed from one of:

1. **Quality metrics `action_success_rate`** — this measures conversational action quality (context_retained vs context_lost, action_success vs action_fail events), NOT workflow completion. It's a different metric entirely.

2. **Synthetic/inferred calculation** — The burn-in monitor V1 had `workflow_failures: 0` hardcoded in the snapshot. With 0 failures recorded, any computation would show 100% or a "healthy" number.

3. **Stale or external source** — The number may have been copied from an earlier assessment without verification.

### Evidence

```typescript
// burn-in.ts V1 — workflow_failures hardcoded to 0
const snapshot: BurnInSnapshot = {
  ...
  workflow_failures: 0,  // ← ALWAYS ZERO — never updated
  ...
};
```

This means the burn-in monitor **never recorded any workflow failures**, which would produce an artificially high success rate.

---

## Actual Failed Workflows

### From Evidence Files (DEV4 Audit)

| # | Workflow | Severity | Failure Type | Source |
|---|----------|----------|-------------|--------|
| 1 | Deploy production | P0 | Credential leaked before approval gate | DEV4_FAILED_CASES.md (FC-001) |
| 2 | Submit tax | P1 | Approval gate not enforced | DEV4_FAILED_CASES.md (FC-002) |
| 3 | Multi-intent: Dashboard | P2 | Dropped silently (1 of 4 intents only) | DEV4_MULTI_INTENT_BASELINE.md |
| 4 | Multi-intent: SEO creation | P2 | Dropped silently | DEV4_MULTI_INTENT_BASELINE.md |
| 5 | Multi-intent: Email draft | P2 | Dropped silently | DEV4_MULTI_INTENT_BASELINE.md |
| 6 | Entity carryover | P2 | Lost after 1 turn | DEV4_FAILED_CASES.md (FC-004) |
| 7 | Health consistency | P2 | Contradictory across 3 surfaces | DEV4_FAILED_CASES.md (FC-006) |
| 8 | "/dash" shorthand | P2 | Wrong entity matched | DEV4_FAILED_CASES.md |

### From Workflow File Analysis

| Metric | Count |
|--------|-------|
| Total workflow files in `.local-agent-global/workflows/` | 1090+ |
| Files with status `created` | ~1090 (all) |
| Files with status `completed` | 0 |
| Files with status `failed` | 0 |
| Files with status `executing` | 0 |
| Files that reached approval stage | 0 |

**All 1090 workflows are stuck at `created` status.** This means:
- Workflows are created by the intent engine
- They are never advanced through their lifecycle
- The execution pipeline creates but does not execute

### From pm2-err.log (Infrastructure Failures)

| Timestamp | Error | Impact |
|-----------|-------|--------|
| Jun 14 ~22:28-22:48 | 50+ `EADDRINUSE` on port 4001 | Crash loop — 20 min downtime |
| Jun 13 ~10:17-10:28 | 20+ rogue PIDs killed by watchdog | Zombie instances competing |
| Jun 14 ~20:13+ | MinIO unavailability cascade | Multiple service restarts |
| Jun 14-15 (multiple) | `generateText failed: timeout` | AI provider failures |

---

## Root Cause Analysis

### RC-1: No Workflow Advancement Pipeline (P0)

**Evidence:** All 1090 workflows stuck at `created`. The `processCEORequest()` function creates workflows and enqueues jobs, but nothing dequeues and executes them.

**Impact:** 100% of workflows never progress beyond creation.

**Fix Required:** Implement a workflow executor that dequeues jobs and advances workflow steps.

### RC-2: Burn-In Monitor Used Hardcoded Zero (P0)

**Evidence:** `workflow_failures: 0` was hardcoded in `captureHourlySnapshot()`.

**Impact:** Monitor always showed 0 failures → inflated success rate.

**Fix:** FIXED in V2 — now reads from `workflow_execution_ledger`.

### RC-3: Multi-Intent Pipeline Drops Intents (P1)

**Evidence:** When CEO sends 4 intents in one message, only 1 is processed. The other 3 are silently dropped.

**Impact:** 75% action loss on multi-intent messages.

**Fix Required:** Implement multi-intent decomposition (`multi-intent-engine.ts` exists but not wired into main pipeline).

### RC-4: Approval Gate Runs After Response (P1)

**Evidence:** FC-002 shows the approval check runs AFTER the LLM generates a response, not before. Dangerous content can be sent to WhatsApp before approval.

**Impact:** P0 credential leak (FC-001) was possible.

**Fix Required:** Move approval gate before LLM response generation for safety-keyword matches.

---

## Corrected Success Rate

Based on actual ledger data (once backfilled):

| Metric | Value | Source |
|--------|-------|--------|
| Total workflows | 1090+ | `.local-agent-global/workflows/` |
| Completed | 0 | Ledger status check |
| Failed | 8+ | Documented failures from DEV4 audit |
| Success rate (actual) | **~0%** | Ledger-based computation |
| Previous claim | 81.3% | **UNSUBSTANTIATED — no evidence** |

> **The 81.3% claim was false. The actual success rate is approximately 0% because no workflows have been completed.**

---

## Corrective Actions

| # | Priority | Action | Status |
|---|----------|--------|--------|
| 1 | P0 | Create execution ledger | ✅ DONE |
| 2 | P0 | Create workflow metrics API | ✅ DONE |
| 3 | P0 | Update burn-in monitor to use ledger | ✅ DONE |
| 4 | P0 | Implement workflow executor (advance steps) | ⬜ TODO |
| 5 | P1 | Wire multi-intent decomposition | ⬜ TODO |
| 6 | P1 | Move approval gate before LLM response | ⬜ TODO |
| 7 | P1 | Fix approval count aggregation | ⬜ TODO |

---

*WORKFLOW_FAILURE_ANALYSIS: COMPLETE*
*81.3% claim: DISPROVEN*
*Actual success rate: ~0% (no workflows completed)*
