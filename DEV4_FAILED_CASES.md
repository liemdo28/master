# DEV4 — Failed Cases & Bugs

**Date:** 2026-06-15
**Source:** DEV4 WhatsApp Jarvis Real-World QA

---

## FAILED CASES

### FC-001: Deploy Production Credential Leak (P0 SECURITY)
- **Input:** `deploy production`
- **Expected:** Approval gate triggered with `requires_approval: true`, NO credentials in reply
- **Actual:** Full deploy instructions with actual URL and API key exposed in plaintext
- **Evidence:**
  ```
  URL: https://dashboard.bakudanramen.com/deploy.php?key=deploy-p3-2026
  ```
- **Root Cause:** The LLM pipeline (not the deterministic approval gate) handles the response. The `requiresDoubleApproval` function in `whatsapp.ts` line 549 checks for `deploy` and `production` keywords, but the code flow first routes through Jarvis → pipeline → LLM, which generates the response. The approval check on line 543-587 only triggers AFTER the pipeline has already generated and returned the reply.
- **Impact:** Sensitive credentials exposed to WhatsApp chat. Any screen recording, notification preview, or chat backup would contain the deploy key.
- **Fix:** Add credential scrubber to pipeline responses. Move approval gate BEFORE pipeline execution for safety keywords.

### FC-002: Approval Count Inconsistency (P1)
- **Input:** `co gi can duyet` vs `/api/whatsapp/mi/status`
- **Expected:** Consistent approval count across all surfaces
- **Actual:** WhatsApp says "0 chờ duyệt"; Status API shows 19 pending
- **Root Cause:** `approvalsCommand()` uses `getPending()` from approval gate only. Status API aggregates `getPendingWhatsAppApprovals()` as well. Different data stores.
- **Impact:** CEO sees conflicting approval counts depending on which surface they check.
- **Fix:** Unify approval sources. Briefing and WhatsApp should query the same aggregated store.

### FC-003: "dash" Ambiguity — DoorDash vs Dashboard (P2)
- **Input:** `dash sao roi`
- **Expected:** Dashboard status (more likely CEO intent for general status query)
- **Actual:** `✅ DoorDash: online`
- **Root Cause:** The `has()` pattern match in jarvis-core.ts hits the DoorDash pattern (`doordash`) because "dash" is a substring of "doordash" in the normalized text. The dashboard pattern requires the full word "dashboard".
- **Impact:** CEO gets wrong information if they meant Dashboard (more common for daily status).
- **Fix:** Add disambiguation: "Anh muốn check Dashboard hay DoorDash?" when only "dash" is detected.

### FC-004: Multi-Turn Entity Carryover Failure (P2)
- **Input sequence:** `raw sushi seo` → `post website`
- **Expected:** "post website" should reference Raw Sushi context
- **Actual:** Found Bakudan Ramen posts instead
- **Root Cause:** "post website" is not in `FOLLOWUP_PATTERNS` (conversation-store.ts line 49-55), so it's treated as a new message without context. The entity extraction doesn't append the session's `last_entity` to non-follow-up messages.
- **Impact:** Context lost between related messages, CEO has to repeat context.
- **Fix:** Extend session context injection to cover action-type messages, not just pure follow-ups.

### FC-005: Tax Query Timeout (P2)
- **Input:** `chuan bi tax` (first attempt)
- **Expected:** Response within 30s
- **Actual:** Client-side timeout at 30s. Second attempt succeeded.
- **Root Cause:** Pipeline processing time exceeded 30s. The chat-queue timeout is 90s, but the send-test caller timed out at 30s. Real WhatsApp gateway may have different timeout behavior.
- **Impact:** CEO sees no response, may think Mi is broken.
- **Fix:** Add "thinking" indicator or faster initial acknowledgment for slow queries.

### FC-006: Health Status Contradiction (P2)
- **Input:** Various health/status queries
- **Expected:** Consistent health assessment
- **Actual:** Status command says "services ổn"; Briefing says "CRITICAL — 0% success"
- **Root Cause:** `statusCommand()` checks live WhatsApp health; briefing engine uses `execution_ledger` with different success criteria (includes "undefined execs" in denominator).
- **Impact:** CEO gets mixed signals about system health.
- **Fix:** Standardize health criteria across all reporting surfaces.

### FC-007: No `/api/executive/snapshot` Endpoint (P3)
- **Input:** `curl http://127.0.0.1:4001/api/executive/snapshot`
- **Expected:** JSON snapshot data
- **Actual:** 404 — `Cannot GET /api/executive/snapshot`
- **Root Cause:** This endpoint was planned but not implemented on the Mi-Core server. Dashboard has `/api/mi/snapshot`.
- **Impact:** Data consistency comparison incomplete; Dev6 integration may fail.
- **Fix:** Implement `/api/executive/snapshot` on Mi-Core or document that it lives on Dashboard only.

---

## SUMMARY

| Severity | Count | IDs |
|----------|-------|-----|
| P0 (Critical) | 1 | FC-001 |
| P1 (High) | 1 | FC-002 |
| P2 (Medium) | 4 | FC-003, FC-004, FC-005, FC-006 |
| P3 (Low) | 1 | FC-007 |
| **Total** | **7** | |
