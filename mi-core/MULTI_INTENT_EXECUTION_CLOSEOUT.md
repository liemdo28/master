# MULTI_INTENT_EXECUTION_CLOSEOUT

**Date:** 2026-06-15
**Status:** MULTI_INTENT_EXECUTION_READY
**Target:** CEO message with 4+ intents → all children executed, 0 dropped

---

## Problem (Before)

CEO message: "Kiểmtra Dashboard, coi QB sync, tạo bài SEO Raw Sushi, rồi soạn mail cho Maria."

- **Before fix:** Only QB executed. Dashboard, SEO, and Maria silently dropped. Success rate: 25%.
- **Root cause:** Single-intent pipeline — classifier picks ONE intent per message, discards the rest.

---

## Solution (After)

Multi-intent execution engine with:

### M1 — Parent Workflow

Compound CEO messages create a parent workflow (`CEO-MULTI-YYYYMMDD-XXX`) that tracks all child intents.

**File:** `server/src/execution/multi-intent-engine.ts`

- `splitClauses()` — splits Vietnamese/English compound messages on conjunctions ("rồi", "và", ",", ";")
- `detectMultiIntent()` — classifies each clause independently via `classifyActionIntent()`
- `processMultiIntent()` — creates parent workflow + child workflows for each intent

### M2 — Child Workflows

Each intent clause creates its own workflow with:
- Unique workflow ID
- Workflow type (DASHBOARD_AUDIT, QB_CHECK, SEO_CONTENT, EMAIL_DRAFT, etc.)
- Target entity resolution
- Independent execution

**File:** `server/src/execution/multi-intent-executor.ts`

### M3 — Partial Failure Handling

If one child fails (e.g., QB unavailable):
- Dashboard still runs ✅
- SEO still runs ✅
- Maria email draft still creates ✅
- QB marked `failed` ✅
- Other children continue independently ✅
- No global abort ✅

Tested via M4 regression case with `forcedFailureDomains: ['finance_qb']`.

### M4 — Evidence Tracking

Every child workflow produces:
- `workflow_id` — unique identifier
- `tracking_id` — parent-child hierarchy (e.g., `WF-001-A`, `WF-001-B`)
- `status` — completed | failed | approval_pending
- `evidence[]` — file paths for workflow JSON, job JSON, drafts
- `parent_tracking_id` — links to parent
- `created_at` — ISO timestamp

### M5 — WhatsApp Response

CEO receives structured response:
```
Task 1 executed: DASHBOARD_AUDIT (approval pending)
Task 2 executed: FINANCE_REPORT
Task 3 executed: SEO_CONTENT (approval pending)
Task 4 executed: EMAIL_DRAFT (approval pending)
Final summary: Executed 4/4 child workflows. 0 failed, 3 waiting for approval, 0 dropped.
No silent drop. Total tasks: 4.
```

### M6 — Regression Suite

**File:** `tests/multi-intent-execution-fix.mjs`

- 100 compound CEO message variants
- Tests M1-M5 (2-4 intent scenarios, partial failure, tracking hierarchy)
- **Result: 100/100 passed (100%)**
- **0 silently dropped child workflows**
- **0 duplicate child workflows**
- **0 fake workflow claims**

---

## Architecture

```
CEO Message → splitClauses() → detectMultiIntent() → processMultiIntent()
                                                          ↓
                                                   Parent Workflow
                                                          ↓
                                              ┌─── Child WF A (DASHBOARD_AUDIT)
                                              ├─── Child WF B (FINANCE_REPORT)
                                              ├─── Child WF C (SEO_CONTENT)
                                              └─── Child WF D (EMAIL_DRAFT)
                                                          ↓
                                               executeMultiIntent()
                                                          ↓
                                              MultiIntentExecutionSummary
```

---

## Files

| File | Purpose |
|------|---------|
| `server/src/execution/multi-intent-engine.ts` | Clause splitting + intent detection |
| `server/src/execution/multi-intent-executor.ts` | Child workflow execution orchestrator |
| `server/src/execution/action-intent-engine.ts` | Action intent classifier |
| `server/src/execution/workflow-creation-layer.ts` | Workflow persistence |
| `server/src/routes/chat.ts` | Integration with chat pipeline |
| `tests/multi-intent-execution-fix.mjs` | Regression test (100 cases) |
| `reports/multi-intent-execution-evidence.json` | Evidence JSON |

---

## Verdict

**MULTI_INTENT_EXECUTION_READY** ✅

Every child intent executes or fails explicitly. No silent drop. 100% regression pass.
