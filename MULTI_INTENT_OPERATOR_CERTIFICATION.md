# MULTI_INTENT_OPERATOR_CERTIFICATION.md

**Workflow:** 6 — Multi-Intent Operations
**CEO Request:** "Kiểm tra Dashboard, QB, tạo SEO Raw rồi gửi Maria."
**Date:** 2026-06-16T09:30:00+07:00
**Target:** MULTI_INTENT_OPERATOR_READY
**Verdict:** NOT CERTIFIED — No intent splitter; 3 of 4 intents silently dropped

---

## Workflow Steps

```
CEO: "Kiểm tra Dashboard, QB, tạo SEO Raw rồi gửi Maria."
  │
  ├── [S1] Split Intents
  │     Required: Parse into 4 discrete intents
  │     Intents expected:
  │       1. Kiểm tra Dashboard → REPORT (read-only)
  │       2. Kiểm tra QB → REPORT (read-only)
  │       3. Tạo SEO Raw → EXECUTE (approval required)
  │       4. Gửi Maria → EXECUTE (approval required)
  │     Actual: NO SPLITTER — first regex match wins
  │     Only 1 of 4 intents processed
  │     ─── FAIL ❌ — IntentSplitter.mjs NOT implemented
  │
  ├── [S2] Execute Intents (Independence)
  │     Required: Each intent executes independently
  │     Actual: Only first matched intent executes
  │     Intents 2, 3, 4 silently dropped
  │     ─── FAIL ❌ — 75% intent drop rate
  │
  ├── [S3] Preserve Failures
  │     Required: If one intent fails, others continue
  │     Actual: First failure = complete stop (no splitter = no continuation)
  │     ─── FAIL ❌ — Cannot continue if single intent fails
  │
  ├── [S4] Continue Successful Branches
  │     Required: REPORT intents (Dashboard, QB) execute without approval
  │     Required: EXECUTE intents (SEO, email) create approvals
  │     Actual: No parallel execution — only 1 branch runs
  │     ─── FAIL ❌ — No branching capability
  │
  └── [S5] Generate Evidence
        Required: Evidence for ALL 4 intents
        Actual: Evidence for only 1 intent (QB status)
        ─── FAIL ❌ — 75% evidence missing
```

---

## Live Test Evidence (DEV4_MULTI_INTENT_BASELINE.md)

### Test Message
```
"Mi kiểm tra Dashboard, coi QB sync, tạo bài SEO Raw Sushi, rồi soạn mail cho Maria."
```

### Test Result
```json
{
  "reply": "QB status: degraded. Company: Raw Japanese Bistro and Sushi Bar.
    Last sync: 2026-06-14T15:04:32.890153+00:00. Transactions today: 0.
    Checksum mismatch: no. Action required: On Laptop1, review QB connector
    runtime and clear these gaps: Latest QB heartbeat is stale (92 minutes old).
    Owner: Dev1.",
  "intent": "finance_request",
  "mode": "ceo",
  "model": "executive-snapshot",
  "sources": ["/api/visibility/quickbooks"]
}
```

### Intent Breakdown
| # | Intent | Expected | Actual | Status |
|---|--------|----------|--------|--------|
| I1 | Kiểm tra Dashboard | REPORT dashboard health | NOT EXECUTED | ❌ DROPPED |
| I2 | Coi QB sync | REPORT QB status | EXECUTED | ✅ PASS |
| I3 | Tạo bài SEO Raw Sushi | CREATE draft + approval | NOT EXECUTED | ❌ DROPPED |
| I4 | Soạn mail cho Maria | CREATE draft + approval | NOT EXECUTED | ❌ DROPPED |

**Intent execution rate: 25% (1/4)**
**Intent drop rate: 75% (3/4)**
**Target: 0% drop rate**

---

## Root Cause Analysis

### FA-008: Multi-Intent Reduces to Single Action
**Code:** ActionPlanner.planAction() — first regex match wins
**Pipeline:** processMessage → intent classification → single intent execution → single response
**Impact:** No multi-intent decomposition, no intent queue, no sequential execution
**Evidence:** DEV4_MULTI_INTENT_BASELINE.md — 3 of 4 intents silently dropped

### Missing Modules
1. **IntentSplitter.mjs** — Split comma-separated intents
2. **IntentExecutor.mjs** — Sequential/parallel intent execution
3. **CombinedResponseBuilder.mjs** — Aggregate results into single response

---

## False Action Analysis (FA-008 from FALSE_ACTION_LEDGER.md)

| Metric | Before | Target | After |
|--------|--------|--------|-------|
| Intent drop rate | 75% (3/4) | < 1% | N/A — not fixed |
| Intents executed | 1/4 | 4/4 | 1/4 |
| Evidence delivered | 1/4 | 4/4 | 1/4 |
| Multi-intent message frequency | ~10-15% of CEO messages | — | — |

---

## Verification Checks

| Check | Required | Actual | Status |
|-------|----------|--------|--------|
| Intent splitting | Parse 4 intents from single message | No splitter | ❌ FAIL |
| Independent execution | Each intent executes independently | Only 1 intent | ❌ FAIL |
| Failure preservation | Failed intent doesn't block others | Complete stop | ❌ FAIL |
| Successful continuation | Read-only runs, write creates approval | Single path only | ❌ FAIL |
| Full evidence | Evidence for all 4 intents | Evidence for 1 | ❌ FAIL |
| Intent drop rate | ≤ 1% | 75% | ❌ FAIL |

---

## Known Gaps

| Gap | Severity | Fix Required |
|-----|----------|--------------|
| No IntentSplitter module | CRITICAL | Build IntentSplitter.mjs (~60 LOC) |
| No IntentExecutor module | CRITICAL | Build IntentExecutor.mjs (~100 LOC) |
| No CombinedResponseBuilder | CRITICAL | Build CombinedResponseBuilder.mjs (~80 LOC) |
| ActionPlanner single-match only | CRITICAL | Replace with intent queue |

---

## Certification Result

```
MULTI_INTENT_OPERATOR_CERT: NOT CERTIFIED ❌
├── Intent splitting: NOT IMPLEMENTED ❌
├── Independent execution: FAIL ❌ (only 1/4)
├── Failure preservation: FAIL ❌ (no continuation)
├── Successful continuation: FAIL ❌ (no branching)
├── Full evidence: FAIL ❌ (only 1/4)
├── Intent drop rate: 75% ❌ (target: ≤ 1%)
└── FA-008: NOT FIXED ❌

Dev4 baseline (DEV4_MULTI_INTENT_BASELINE.md):
  Intents executed: 1/4 (25%)
  Dropped: Dashboard check, SEO creation, email drafting
  Pipeline: Single intent → single response

Verdict: NOT READY for production
         Multi-intent handling is architecturally broken
         Requires IntentSplitter + IntentExecutor + CombinedResponseBuilder
```

---

**CERTIFICATION STATUS:** MULTI_INTENT_OPERATOR_NOT_READY
**INTENT DROP RATE:** 75% (3 of 4 intents silently dropped)
**TARGET:** ≤ 1% intent drop rate
**REQUIRED FIX:** ~240 LOC across 3 new modules