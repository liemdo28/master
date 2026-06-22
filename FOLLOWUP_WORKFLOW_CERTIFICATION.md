# FOLLOWUP_WORKFLOW_CERTIFICATION.md

**Workflow:** 5 — Follow-up Handling
**CEO Sequence:** "Không có hình hả?" → "Hả?" → "K" → "Sao?"
**Date:** 2026-06-16T09:30:00+07:00
**Target:** FOLLOWUP_WORKFLOW_READY
**Verdict:** NOT CERTIFIED — Conversation context lost on follow-up; ACKNOWLEDGE handler missing for casual inputs

---

## Workflow Steps

```
CEO: "Không có hình hả?"
  │
  ├── [S1] Resolve Previous Context
  │     Required: Load last message(s) to understand what "hình" refers to
  │     Expected: Previous message was about content publishing / SEO draft
  │     Actual: CONTEXT FAILURE — no conversation history loaded
  │     isFollowUp() in conversation-store.ts only triggers on ≤60 chars
  │     Pattern match: "không có hình", "hình" → FA-005 triggered
  │     ─── FAIL ❌ — Context not loaded

CEO: "Hả?"
  │
  ├── [S2] Resolve Ambiguous Input
  │     Required: "Hả?" → CLARIFY or ACKNOWLEDGE based on context
  │     Actual: No conversation history → treated as new query
  │     May produce unrelated dashboard summary (FA-004)
  │     CEO reasoning Category C score: 8% (query #41)
  │     ─── FAIL ❌ — No context, no clarify

CEO: "K"
  │
  ├── [S3] Handle Casual Acknowledgment
  │     Required: "K" → ACKNOWLEDGE "OK anh" or silence
  │     Actual: FA-003 may trigger — casual input → dashboard summary
  │     No ACKNOWLEDGE_ONLY handler exists
  │     ─── FAIL ❌ — No ACKNOWLEDGE handler (FA-003)

CEO: "Sao?"
  │
  ├── [S4] Continue Conversation
  │     Required: "Sao?" → report status of last topic
  │     Actual: No conversation history → treated as new query
  │     May produce unrelated data
  │     CEO reasoning Category C score: 8% (query #42)
  │     ─── FAIL ❌ — Context not preserved
```

---

## Root Cause Analysis

### Problem 1: No Conversation History (FA-010)
**Code:** ContextResolver only sees current message, no last 5 messages loaded
**Impact:** Every follow-up is treated as a new conversation
**Evidence:** CONTEXT_FAILURE_REPORT.md — 25 context destruction chains documented

### Problem 2: No ACKNOWLEDGE Handler (FA-001, FA-003)
**Code:** ActionPlanner.planAction() — no null-action path
**Impact:** "K" / "Ok" / "Đã nhận" may trigger unrelated actions
**Evidence:** CEO_REASONING_CERTIFICATION.md — Category A score 34.2%

### Problem 3: No Clarify Handler (FA-004)
**Code:** "Ha?" / "Sao?" pattern not detected → falls through → may trigger dashboard summary
**Impact:** CEO gets irrelevant response instead of clarification
**Evidence:** CEO_REASONING_CERTIFICATION.md — Category C score 9.2%

### Problem 4: Image Query Not Handled (FA-005)
**Code:** "Không có hình hả?" → no image pipeline status check
**Impact:** CEO not told about actual image existence
**Evidence:** FALSE_ACTION_LEDGER.md — FA-005, no existsSync() for image queries

---

## Verification Checks

| Check | Required | Actual | Status |
|-------|----------|--------|--------|
| Context preserved across follow-ups | Load last 5 messages | No conversation history | ❌ FAIL |
| "Không có hình" → image check | existsSync() + report | No image check | ❌ FAIL |
| "Hả?" → CLARIFY | Clarify or ACKNOWLEDGE | May trigger new action | ❌ FAIL |
| "K" → ACKNOWLEDGE | OK response or silence | May trigger dashboard | ❌ FAIL |
| "Sao?" → report last topic | Load last topic | Context lost | ❌ FAIL |
| No context reset mid-conversation | ConversationMemory persists | TTL: 4hr but no history | ❌ FAIL |

---

## False Action Rate Impact

| Message | Expected | Actual | FA# | Impact |
|---------|----------|--------|-----|--------|
| "Không có hình hả?" | Image status report | No response / wrong | FA-005 | Critical |
| "Hả?" | Clarify | New action | FA-004 | High |
| "K" | OK acknowledgment | Dashboard summary | FA-003 | Medium |
| "Sao?" | Report last topic | Context lost | FA-010 | High |

---

## Known Gaps

| Gap | Severity | Fix Required |
|-----|----------|--------------|
| No conversation history (FA-010) | HIGH | Add ConversationHistory.mjs (~100 LOC) |
| No ACKNOWLEDGE handler (FA-003) | HIGH | Add ACKNOWLEDGE_ONLY path (~80 LOC) |
| No CLARIFY handler (FA-004) | HIGH | Add CLARIFY path (~50 LOC) |
| No image query check (FA-005) | CRITICAL | Add image pipeline status check (~50 LOC) |
| No context persistence | HIGH | Add persistent session storage |

---

## Certification Result

```
FOLLOWUP_WORKFLOW_CERT: NOT CERTIFIED ❌
├── Context preservation: FAIL ❌
├── Image query handling: FAIL ❌
├── Casual acknowledgment: FAIL ❌
├── Clarification handling: FAIL ❌
├── No context reset: FAIL ❌
├── FA-003 (casual input): NOT FIXED ❌
├── FA-004 (ambiguous): NOT FIXED ❌
├── FA-005 (image query): NOT FIXED ❌
└── FA-010 (context loss): NOT FIXED ❌

Verdict: NOT READY for production
         Follow-up handling is architecturally broken
         Requires ConversationHistory + ACKNOWLEDGE + CLARIFY handlers

CEO reasoning Category C score: 9.2% (target: 95%)
```

---

**CERTIFICATION STATUS:** FOLLOWUP_WORKFLOW_NOT_READY
**ROOT CAUSE:** No conversation history, no ACKNOWLEDGE handler, no CLARIFY handler
**REQUIRED FIX:** ~280 LOC across 4 modules
**CEO REASONING CATEGORY C SCORE:** 9.2% (critical failure)