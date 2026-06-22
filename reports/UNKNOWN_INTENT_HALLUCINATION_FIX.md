# Unknown Intent Hallucination Fix
**Date:** 2026-06-15
**Blocker:** B2 — Fake "CERTIFIED 90%" for all unhandled intents
**Result:** UNKNOWN_INTENT_NO_HALLUCINATION

---

## Problem

GStack's `processGStackRequest` routed ALL unrecognized intents to `runFullPipeline()`.
The full pipeline always:
1. Created a work order
2. Ran a generic `source_scan.log` template (engineering_manager tasks)
3. Ran QA against the template output (always passed)
4. Issued a QA certification at 90% confidence
5. Returned `✅ Hoàn thành | CERTIFIED | 90%` to the CEO

This meant the CEO received confident "completed" responses for questions the system had no data for:
- "Doanh thu Raw Sushi tháng này bao nhiêu?" → `✅ CERTIFIED 90%`
- "Tồn kho cá hồi còn bao nhiêu kg?" → `✅ CERTIFIED 90%`
- "Nhân viên nào đang nghỉ phép?" → `✅ CERTIFIED 90%`

**Hallucination rate: 100%** on all `intent: unknown` queries.

## Fix Applied

**File:** `server/src/gstack/gstack-orchestrator.ts`

Added an early-exit guard immediately before pipeline routing:

```typescript
// Unknown intent: never run the full fabrication pipeline.
// Return an honest clarification instead of a fake "CERTIFIED 90%" response.
if (wo.intent.intent === 'unknown') {
  const clarification = buildUnknownIntentReply(req.raw_request, wo.request_id);
  deliverWorkOrder(wo.request_id, {
    verdict: 'FAILED',
    summary: 'Intent not recognized — clarification requested',
    findings: [],
    fixed: [],
    tested: [],
    needs_approval: [],
    confidence_score: 0,
  });
  return {
    work_order_id: wo.request_id,
    ceo_message: clarification,
    status: 'rejected',
    verdict: 'FAILED',
    confidence_score: 0,
    pm_package: pmPackage,
    duration_ms: Date.now() - t0,
    handled: false,   // signals caller that intent was not understood
  };
}
```

Added `buildUnknownIntentReply()` helper that:
- Tells the CEO clearly: "Mi chưa hiểu yêu cầu này"
- States the actual query back for confirmation
- Gives domain-specific hints (revenue → QB connector, inventory → POS needed, etc.)
- Does NOT claim any work was completed
- Sets `confidence_score: 0`

## Verification

### Before fix:
```
"Doanh thu Raw Sushi tháng này bao nhiêu?"
→ status: delivered | *4️⃣ Kết quả:* ✅ Hoàn thành
  🏆 Certification: CERT-WO-... CERTIFIED | 90%
```

### After fix:
```
"Doanh thu Raw Sushi tháng này bao nhiêu?"
→ status: rejected | handled: false

❓ Mi chưa hiểu yêu cầu này
Anh hỏi: "Doanh thu Raw Sushi..."
WO: WO-20260615-053 | Kết quả: Không đủ dữ liệu để xử lý

Mi không tự bịa kết quả. Nếu dữ liệu chưa có trong hệ thống, Mi sẽ nói thẳng.

💡 Gợi ý:
📊 Dữ liệu doanh thu — cần kết nối QuickBooks hoặc POS (chưa sync)
```

| Query | Before | After |
|-------|--------|-------|
| Revenue question | ✅ CERTIFIED 90% (fabricated) | ❌ Honest: data missing |
| Inventory question | ✅ CERTIFIED 90% (fabricated) | ❌ Honest: no connector |
| Staff question | ✅ CERTIFIED 90% (fabricated) | ❌ Honest: no HR system |
| Calendar question | ✅ CERTIFIED 90% (fabricated) | 💡 Hint: use Google Calendar |

**Hallucination rate after fix: 0%** on `intent: unknown` queries.

## What is NOT changed

- Known intents (`audit_project`, `check_status`, `build_feature`, etc.) still route to full pipeline as before.
- Task intelligence fast-path (`query_personal_tasks`) still short-circuits before any pipeline.
- The multi-intent splitter routes each fragment individually — fragments that resolve to known intents execute; fragments that resolve to `unknown` return honest clarification.

---

## Certification

- UNKNOWN_INTENT_NO_FULL_PIPELINE: ✅
- UNKNOWN_INTENT_NO_FAKE_CERTIFICATION: ✅
- UNKNOWN_INTENT_RETURNS_HONEST_REPLY: ✅
- UNKNOWN_INTENT_CONFIDENCE_ZERO: ✅
- KNOWN_INTENTS_UNAFFECTED: ✅
- **UNKNOWN_INTENT_NO_HALLUCINATION: ✅**
