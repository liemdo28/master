# CEO_ONE_MESSAGE_OPERATOR_CERTIFICATION.md

**Phase:** 6 — CEO One Message Operator
**Generated:** 2026-06-16T08:27:00+07:00
**Audit Method:** Full execution trace of single multi-intent CEO message
**Target:** CEO_ONE_MESSAGE_OPERATOR_READY
**Verdict:** NOT CERTIFIED — Requires all Phases 1-5 gates to pass first

---

## The Test

CEO sends ONE message:

> "Kiểm tra Dashboard, QB, Payroll, tạo SEO Raw rồi gửi Maria."

This single message contains 5 distinct intents:

| # | Intent | Type | Source Required |
|---|--------|------|-----------------|
| 1 | Kiểm tra Dashboard | REPORT | DashboardVisibilityConnector |
| 2 | Kiểm tra QB | REPORT | Finance truth layer (QuickBooks) |
| 3 | Kiểm tra Payroll | REPORT | Finance truth layer (payroll) |
| 4 | Tạo SEO Raw | EXECUTE (with approval) | WebsiteActionService |
| 5 | Gửi Maria | EXECUTE (with approval) | EmailActionService + ContactResolver |

---

## Required Mi Behavior (7 Steps)

### Step 1: Split Intents
**Required:** Parse the comma-separated message into 5 discrete intents.
**Code Path:** ActionPlanner.planAction() — single regex match only. No intent splitter exists.

**Result: FAIL**
- No multi-intent splitter in ActionPlanner
- First regex match wins
- 4 of 5 intents silently dropped
- Estimated intents processed: 1 of 5

### Step 2: Verify Evidence for Each Intent
**Required:** For each intent, classify evidence before acting.

| Intent | Evidence Required | Available? |
|--------|-------------------|------------|
| Dashboard | Live ping + cache age | Partial (cache exists, live may be down) |
| QB | QuickBooks sync status | Degraded (last sync > 24h) |
| Payroll | Payroll data source | MISSING (no payroll API connected) |
| SEO Raw | Website files + image pipeline | Partial (local repo exists, no image verification) |
| Send Maria | Contact email + email service | Contact may resolve, email service requires approval |

**Result: FAIL**
- Evidence Gate not wired into ActionPlanner (Phase 1 finding)
- Cannot classify evidence for 5 intents when only 1 is processed
- Payroll data is MISSING — should block numeric responses

### Step 3: Decide Correctly for Each Intent
**Required:** Apply Decision Gate matrix to each intent.

| Intent | Input Type | Evidence | Correct Decision |
|--------|-----------|----------|-----------------|
| Dashboard check | command | CONFIRMED/UNCONFIRMED | REPORT |
| QB check | command | STALE | REPORT + STALE warning |
| Payroll check | command | MISSING | REPORT + MISSING warning |
| Create SEO | command | CONFIRMED (local files) | REQUEST_APPROVAL |
| Send to Maria | command | depends on contact | REQUEST_APPROVAL |

**Result: FAIL**
- Decision Gate not wired (Phase 2 finding)
- No REPORT handler for Dashboard/QB/Payroll queries via this message format
- Cannot apply 5 different decisions when only 1 intent is processed

### Step 4: Execute Correctly for Each Intent
**Required:** Execute report queries + create drafts + request approvals.

| Intent | Execution | Approval? |
|--------|-----------|-----------|
| Dashboard | Get dashboard status | No (read-only) |
| QB | Get QB sync status | No (read-only) |
| Payroll | Report MISSING | No (read-only) |
| SEO Raw | Create SEO draft | Yes (write) |
| Send Maria | Draft email | Yes (write) |

**Result: FAIL**
- Only 1 intent executed (no splitter)
- Read-only queries should NOT require approval
- Write actions (SEO, email) correctly require approval
- But execution of wrong intent means wrong actions taken

### Step 5: Create Approvals Only Where Needed
**Required:** 
- Dashboard check: NO approval
- QB check: NO approval
- Payroll check: NO approval
- SEO Raw: YES approval (schedule-post, risk level 2)
- Send Maria: YES approval (send-email, risk level 2)

**Result: PARTIAL**
- ApprovalRequiredAction.mjs correctly classifies risk levels
- schedule-post = level 2 (needs approval) ✅
- send-email = level 2 (needs approval) ✅
- search/read = level 1 (auto-allowed) ✅
- BUT: Only 1 intent processed, so approvals for wrong intent

### Step 6: Send Evidence
**Required:** For each intent, send evidence of what was done.

| Intent | Evidence Required | Can Provide? |
|--------|-------------------|-------------|
| Dashboard | Status text from cache/ping | Yes (if connector works) |
| QB | Sync status + timestamp | Yes (finance truth layer) |
| Payroll | MISSING declaration | Yes (correct MISSING response) |
| SEO Raw | Draft preview + approval ID | Yes (WebsiteActionService) |
| Send Maria | Draft preview + approval ID | Yes (if contact resolves) |

**Result: FAIL**
- Only 1 of 5 evidence reports generated (no splitter)
- Evidence Gate not enforced (Phase 1)
- Image proof not verified for SEO content

### Step 7: Update CEO
**Required:** Single combined response with all 5 results.

**Expected Response:**
```
Anh, em đã xử lý 5 yêu cầu:

1. 🏪 Dashboard: [status from cache/live]
2. 📊 QB: [sync status + timestamp] ⚠️ Stale
3. 💰 Payroll: [MISSING — chưa có dữ liệu]
4. 📝 SEO Raw: [draft created] 🔒 Chờ anh duyệt
5. ✉️ Gửi Maria: [email draft] 🔒 Chờ anh duyệt

2 approval cần anh confirm. 3 reports ở trên.
```

**Actual Response:**
- Single intent response only
- No combined multi-intent format
- Missing 4 of 5 reports
- CEO left wondering about 4 items

**Result: FAIL**

---

## Full Execution Trace Summary

```
CEO: "Kiểm tra Dashboard, QB, Payroll, tạo SEO Raw rồi gửi Maria."
     │
     ├── [S1] Split Intents
     │   └── FAIL: No splitter. 1 of 5 intents extracted.
     │
     ├── [S2] Classify Evidence
     │   └── FAIL: Evidence Gate not wired. No classification.
     │
     ├── [S3] Decide Each Intent
     │   └── FAIL: Decision Gate not wired. Wrong decision type.
     │
     ├── [S4] Execute Each
     │   └── FAIL: Only 1 intent executed. 4 dropped.
     │
     ├── [S5] Create Approvals
     │   └── PARTIAL: Risk levels correct, but wrong intent.
     │
     ├── [S6] Send Evidence
     │   └── FAIL: 1 of 5 evidence reports. No image proof.
     │
     └── [S7] Update CEO
         └── FAIL: Single intent response. 4 items missing.
```

---

## Dependency Chain

This test CANNOT pass until these gates are enforced:

| Gate | Status | Required For |
|------|--------|-------------|
| Evidence Gate (Phase 1) | NOT ENFORCED | Step 2, Step 6 |
| Decision Gate (Phase 2) | NOT ENFORCED | Step 3, Step 5 |
| CEO Reasoning (Phase 3) | 45.6/95 | All steps |
| False Actions (Phase 4) | 56% rate | Steps 3-5 |
| Phone Operator (Phase 5) | 5/7 fail | All steps |

---

## What Must Be Built

### 1. Multi-Intent Splitter (NEW MODULE)
```
Location: local-agent/action-layer/IntentSplitter.mjs
Input: Raw CEO message
Logic: Split on commas, "rồi", "và", "+"
Output: Array of { intent_text, intent_type, priority }
```

### 2. Sequential Intent Executor (NEW MODULE)
```
Location: local-agent/action-layer/IntentExecutor.mjs
Input: Array of intents
Logic: For each intent:
  1. Classify evidence
  2. Apply decision gate
  3. Execute if approved
  4. Collect evidence
Output: Array of { intent, decision, evidence, response }
```

### 3. Combined Response Builder (NEW MODULE)
```
Location: local-agent/action-layer/CombinedResponseBuilder.mjs
Input: Array of intent results
Logic: Combine into single WhatsApp-formatted message
  - Numbered items
  - Evidence tags per item
  - Approval count summary
  - Action items highlighted
Output: Single formatted response string
```

### 4. ACKNOWLEDGE Handler (CRITICAL FIX)
```
Location: local-agent/action-layer/AcknowledgeHandler.mjs
Input: CEO statement
Logic: Detect statement patterns → return acknowledgment
Output: Simple "OK" acknowledgment + DecisionMemory update
```

### 5. Conversation History (CRITICAL FIX)
```
Location: local-agent/federated-memory/ConversationHistory.mjs
Input: Current message
Logic: Load last 5 messages → resolve ambiguous references
Output: Enriched context with conversation thread
```

---

## Certification Result

```
CEO_ONE_MESSAGE_OPERATOR_CERT: NOT CERTIFIED
├── Intent splitting: NOT IMPLEMENTED ❌
├── Evidence classification: NOT WIRED ❌
├── Decision per intent: NOT WIRED ❌
├── Sequential execution: NOT IMPLEMENTED ❌
├── Approval correctness: PARTIAL ⚠️
├── Evidence delivery: FAIL ❌
├── Combined response: NOT IMPLEMENTED ❌
├── ACKNOWLEDGE handler: NOT IMPLEMENTED ❌
├── Conversation history: NOT IMPLEMENTED ❌
└── Verdict: NOT CERTIFIED

Required for READY:
1. Build IntentSplitter.mjs (~60 LOC)
2. Build IntentExecutor.mjs (~100 LOC)
3. Build CombinedResponseBuilder.mjs (~80 LOC)
4. Build AcknowledgeHandler.mjs (~80 LOC)
5. Build ConversationHistory.mjs (~100 LOC)
6. Wire Evidence Gate into all paths (Phase 1 fix)
7. Wire Decision Gate into all paths (Phase 2 fix)
8. Pass all 7 Phone Operator tests (Phase 5)
9. False action rate < 1% (Phase 4)
10. CEO reasoning score > 95% (Phase 3)

Total new code: ~420 LOC
Total fixes from Phases 1-4: ~530 LOC
Grand total: ~950 LOC of production changes
```

---

## Final Status

```
╔══════════════════════════════════════════════════════════════╗
║                    OPERATOR READINESS AUDIT                 ║
╠══════════════════════════════════════════════════════════════╣
║ Phase 1 — Evidence Gate:        PARTIAL ❌                  ║
║ Phase 2 — Decision Gate:        NOT ENFORCED ❌             ║
║ Phase 3 — CEO Reasoning:        45.6/95 ❌                  ║
║ Phase 4 — False Action Rate:    ~56% ❌ (target < 1%)      ║
║ Phase 5 — Phone Operator:       2/7 PASS ❌                 ║
║ Phase 6 — One Message Operator: NOT CERTIFIED ❌            ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  OVERALL: PRODUCTION_CORRECT = NO                            ║
║                                                              ║
║  NOT FEATURE_COMPLETE  ✅ (correct — no new features)       ║
║  NOT TEST_COMPLETE     ✅ (correct — tests fail)            ║
║  NOT CODE_COMPLETE     ✅ (correct — ~950 LOC needed)       ║
║                                                              ║
║  Production Correct = NO                                     ║
║  Reason: 5 execution gaps block correct operator behavior   ║
║                                                              ║
║  Minimum path to PRODUCTION_CORRECT:                         ║
║  1. ACKNOWLEDGE handler (80 LOC) — fixes 40% of failures   ║
║  2. Evidence gate wiring (50 LOC) — fixes data fabrication  ║
║  3. Multi-intent splitter (60 LOC) — fixes dropped intents  ║
║  4. Conversation history (100 LOC) — fixes follow-ups       ║
║  5. Total: ~290 LOC to reach minimum viable operator        ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

---

**CERTIFICATION STATUS:** CEO_ONE_MESSAGE_OPERATOR_NOT_READY
**FINAL TARGET:** NOT REACHED
**PATH TO READY:** ~950 LOC across 10 modules + Phase 1-5 gate enforcement
