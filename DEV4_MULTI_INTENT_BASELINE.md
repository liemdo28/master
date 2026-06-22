# DEV4 — Track V5: Multi-Intent Baseline

**Date:** 2026-06-15  
**Tester:** DEV4  
**Target:** `MULTI_INTENT_BASELINE_READY`

---

## Objective

Establish a baseline test for multi-intent handling. Dev5 owns the fix. Dev4 documents the current broken state so Dev5 can verify improvement by rerunning the same test.

---

## Test Message

```
"Mi kiểm tra Dashboard, coi QB sync, tạo bài SEO Raw Sushi, rồi soạn mail cho Maria."
```

### Intents in this message (4 distinct intents):

| # | Intent | Category | Expected Action |
|---|--------|----------|-----------------|
| I1 | Kiểm tra Dashboard | visibility/read | Show dashboard health/status |
| I2 | Coi QB sync | finance/read | Check QuickBooks sync status |
| I3 | Tạo bài SEO Raw Sushi | content/write | Create SEO article for Raw Sushi |
| I4 | Soạn mail cho Maria | communication/draft | Draft email to Maria |

---

## Result

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

---

## Analysis

### What executed: 1 of 4 intents

| # | Intent | Status | Evidence |
|---|--------|--------|----------|
| I1 | Kiểm tra Dashboard | ❌ **DROPPED** | Response does not mention dashboard status |
| I2 | Coi QB sync | ✅ **EXECUTED** | Full QB sync status returned |
| I3 | Tạo bài SEO Raw Sushi | ❌ **DROPPED** | No SEO article creation mentioned |
| I4 | Soạn mail cho Maria | ❌ **DROPPED** | No email draft mentioned |

### Root Cause

The intent engine (`skill-router` / `executive-snapshot`) picks the **first/highest-confidence intent** and executes only that one. The remaining intents are silently discarded.

**Pipeline:** `processMessage` → intent classification → single intent execution → single response

There is no multi-intent decomposition, no intent queue, and no sequential execution.

### Classification

- **Intent recognized:** `finance_request` (QB sync — the only one processed)
- **Intent dropped:** 3 (Dashboard, SEO article, email draft)
- **Success rate:** 25% (1/4 intents executed)

---

## Baseline for Dev5

### Before Fix (Current State)
- **Intents executed:** 1/4 (25%)
- **Dropped:** Dashboard check, SEO creation, email drafting
- **Pipeline:** Single intent → single response

### After Dev5 Fix (Expected)
- **Intents executed:** 4/4 (100%)
- **Pipeline:** Multi-intent decomposition → sequential execution → aggregated response

### Rerun Command (for Dev5 verification)
```bash
curl -X POST http://localhost:4001/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"message":"Mi kiểm tra Dashboard, coi QB sync, tạo bài SEO Raw Sushi, rồi soạn mail cho Maria.","sessionId":"dev5-multiintent-test"}'
```

### Expected Evidence of Fix
Response should contain status/results for ALL 4 intents:
1. Dashboard health/status summary
2. QB sync status
3. SEO article creation confirmation or draft
4. Email draft for Maria

---

## Verdict

**Track V5 Status: `MULTI_INTENT_BASELINE_READY`** ✅

Baseline documented. Dev5 must implement multi-intent decomposition to achieve 4/4 intent execution.