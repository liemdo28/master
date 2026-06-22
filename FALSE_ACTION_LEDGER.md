# FALSE_ACTION_LEDGER.md

**Phase:** 4 — False Action Elimination
**Generated:** 2026-06-16T08:25:00+07:00
**Audit Method:** Full trace of every code path that can produce unwanted actions
**Target:** FALSE_ACTION_RATE_UNDER_1_PERCENT
**Actual Rate:** Estimated 35-40% of CEO statement/context messages
**Verdict:** NOT CERTIFIED — False action rate far exceeds 1% threshold

---

## What Constitutes a False Action

A false action occurs when Mi produces ANY of the following in response to a CEO message that does not require it:

1. **Unnecessary workflow creation** — CEO states a fact, Mi starts a process
2. **Unnecessary approval request** — CEO informs, Mi asks for approval
3. **Wrong action execution** — Mi executes action A when CEO intended B
4. **False completion claim** — Mi says "done" without verification
5. **Hallucinated data** — Mi presents fabricated numbers as facts
6. **Context-destroying response** — Mi loses conversation thread and starts fresh

---

## False Action Inventory

### FA-001: Statement Triggers Workflow Creation

**Source:** WhatsApp CEO message
**Message Pattern:** "[Task X] da hoan thanh / xong roi"
**Example:** "QB Report da hoan thanh roi ma"
**Code Path:** `ActionPlanner.planAction()` — regex no match → returns null → falls through to default handler → server-side handler creates workflow
**Expected Behavior:** ACKNOWLEDGE — "OK em ghi nhan."
**Actual Behavior:** Creates approval workflow (APPR-*), sends dashboard summary, launches review process
**Severity:** HIGH
**Fix Required:** Add statement detection before ActionPlanner. Route to ACKNOWLEDGE_ONLY handler.
**Estimated Frequency:** Every "done/completed" message from CEO = ~15-20% of all messages

### FA-002: Context Update Triggers Workflow

**Source:** WhatsApp CEO message
**Message Pattern:** "[Topic] la tuan roi / hom qua / ngay kia"
**Example:** "Payroll Raw la tuan roi"
**Code Path:** `ActionPlanner.planAction()` — no match → falls through → server creates payroll workflow
**Expected Behavior:** ACKNOWLEDGE + UPDATE context memory
**Actual Behavior:** Starts payroll workflow, sends payroll checklist, launches status report
**Severity:** HIGH
**Fix Required:** Add temporal context detection. Route to CONTEXT_UPDATE handler.
**Estimated Frequency:** Every temporal update = ~5-10% of all messages

### FA-003: Casual Acknowledgment Triggers New Action

**Source:** WhatsApp CEO message
**Message Pattern:** "K" / "Ok" / "Da nhan" / "Vang"
**Example:** "K"
**Code Path:** `ActionPlanner.planAction()` — no match → null → falls through → default handler may produce dashboard summary or status report
**Expected Behavior:** ACKNOWLEDGE — "OK" or silence
**Actual Behavior:** May produce unrelated dashboard summary or status update
**Severity:** MEDIUM
**Fix Required:** Casual input detection → ACKNOWLEDGE_ONLY
**Estimated Frequency:** ~5-8% of all messages

### FA-004: Ambiguous Input Triggers New Workflow

**Source:** WhatsApp CEO message
**Message Pattern:** "Ha?" / "Sao?" / "Cai do sao roi?"
**Example:** "Ha?"
**Code Path:** `ActionPlanner.planAction()` — no match → null → falls through → intent router may classify as `check_status` → produces dashboard summary
**Expected Behavior:** CLARIFY — "Anh hoi ve cai nao?" or ACKNOWLEDGE based on context
**Actual Behavior:** Starts new workflow or sends unrelated dashboard data
**Severity:** HIGH
**Fix Required:** Add conversation history to ContextResolver. Route ambiguous → CLARIFY.
**Estimated Frequency:** ~10-15% of all messages

### FA-005: "Khong co hinh ha?" Triggers Wrong Response

**Source:** WhatsApp CEO message
**Message Pattern:** Follow-up about image existence
**Example:** "Khong co hinh hinh ha?"
**Code Path:** No regex match for image query → falls through → may respond with unrelated data
**Expected Behavior:** REPORT — check image pipeline, report actual image status with existsSync()
**Actual Behavior:** Responds with unrelated content or no relevant response
**Severity:** CRITICAL (CEO trust impact)
**Fix Required:** Add image pipeline status check + existsSync() verification
**Estimated Frequency:** Every content publishing follow-up

### FA-006: Content Publish Without Image Verification

**Source:** CEO command "Post bai len Raw"
**Message Pattern:** Content creation request
**Code Path:** `ActionPlanner` → `/lên lịch post/` matches → `WebsiteActionService.createDraft()` → creates draft + approval
**Expected Behavior:** Create draft → verify image exists (existsSync) → send image proof → request approval
**Actual Behavior:** Creates draft → requests approval. NO image verification. May claim "image ready" without checking.
**Severity:** CRITICAL
**Fix Required:** Add existsSync() gate in WebsiteActionService before returning "ready" status
**Estimated Frequency:** Every content publish command

### FA-007: Finance Number Fabrication

**Source:** Finance truth layer + LLM override
**Message Pattern:** "Doanh thu sao roi?" when QB is degraded
**Code Path:** Finance truth returns "degraded" → LLM completion layer fills in plausible numbers
**Expected Behavior:** "[MISSING] Em chua co du lieu that de ket luan." with NO numeric content
**Actual Behavior:** Revenue numbers presented without freshness disclaimer
**Severity:** CRITICAL (CEO trust + business decisions)
**Fix Required:** Hard gate: if finance_truth.status = "degraded"/"unavailable" → block ALL numeric output
**Estimated Frequency:** Every finance query when QB is stale (~20 queries tested, 2 fabricated)

### FA-008: Multi-Intent Reduces to Single Action

**Source:** CEO multi-intent message
**Message Pattern:** "Check Dashboard, QB, roi post bai"
**Code Path:** `ActionPlanner.planAction()` — first regex match wins → only first intent processed
**Expected Behavior:** Split into 3 intents → execute each: CHECK Dashboard, CHECK QB, CREATE draft for post
**Actual Behavior:** Only first matched intent is processed. Others silently dropped.
**Severity:** HIGH
**Fix Required:** Add multi-intent splitter before ActionPlanner
**Estimated Frequency:** Every multi-intent message (~10-15% of CEO messages)

### FA-009: Missing Connector Returns Unrelated Data

**Source:** CEO query about disconnected platform
**Message Pattern:** "Email moi co gi?" (Gmail not connected)
**Code Path:** Intent router → Gmail query → ConnectorRegistry shows "not_configured" → falls back to unrelated data
**Expected Behavior:** "[MISSING] Gmail chua duoc ket noi. Anh can setup GOOGLE_CLIENT_ID."
**Actual Behavior:** May return website data or other unrelated connector info (per FINANCE_TRUTH test #7)
**Severity:** MEDIUM
**Fix Required:** Check connector status BEFORE attempting data retrieval. Return MISSING with setup hint.
**Estimated Frequency:** Every query to disconnected platform

### FA-010: Conversation Thread Reset on Follow-up

**Source:** Any follow-up message
**Message Pattern:** "Roi sao nua?" / "Con gi khong?" after previous topic
**Code Path:** ContextResolver only sees current message → no history → treats as new conversation
**Expected Behavior:** Load last 5 messages → identify topic → continue
**Actual Behavior:** Resets to default behavior, loses entire conversation context
**Severity:** HIGH
**Fix Required:** Add conversation history to ContextResolver
**Estimated Frequency:** Every conversation with follow-up (~20% of interactions)

---

## False Action Rate Calculation

### Total CEO Message Types (estimated distribution)

| Type | % of Messages | False Action Rate | False Actions per 100 |
|------|--------------|-------------------|----------------------|
| Status Statements | 20% | 90% (FA-001, FA-002, FA-003) | 18.0 |
| Status Queries | 20% | 30% (FA-007, FA-009) | 6.0 |
| Ambiguous Follow-ups | 20% | 95% (FA-004, FA-005, FA-010) | 19.0 |
| Action Commands | 20% | 15% (FA-006, FA-008) | 3.0 |
| Multi-Intent | 10% | 80% (FA-008) | 8.0 |
| Other | 10% | 20% | 2.0 |
| **TOTAL** | **100%** | — | **56.0** |

**Estimated false action rate: 56% of CEO messages produce at least one false action**
**Target: < 1%**
**Gap: 56x over threshold**

---

## Prioritized Fix List

| Priority | FA# | Fix | Lines of Code | Impact |
|----------|-----|-----|---------------|--------|
| P0 | FA-007 | Finance numeric hard gate | ~30 | Blocks hallucinated numbers |
| P0 | FA-006 | Image existsSync() gate | ~20 | Blocks false "ready" claims |
| P0 | FA-001 | ACKNOWLEDGE handler | ~80 | Fixes 18% false action rate |
| P1 | FA-002 | CONTEXT_UPDATE handler | ~40 | Fixes temporal context errors |
| P1 | FA-004 | Conversation history | ~100 | Fixes ambiguous follow-ups |
| P1 | FA-008 | Multi-intent splitter | ~60 | Fixes dropped intents |
| P2 | FA-003 | Casual input handler | ~30 | Fixes "K" responses |
| P2 | FA-005 | Image pipeline check | ~50 | Fixes image status queries |
| P2 | FA-009 | Missing connector guard | ~40 | Fixes unrelated data returns |
| P2 | FA-010 | Context persistence | ~80 | Fixes conversation resets |

**Total estimated fix: ~530 lines of code**

---

## Certification Result

```
FALSE_ACTION_LEDGER: 10 FALSE ACTIONS IDENTIFIED
├── Critical: 2 (FA-006, FA-007)
├── High: 5 (FA-001, FA-002, FA-004, FA-008, FA-010)
├── Medium: 3 (FA-003, FA-005, FA-009)
├── False action rate: ~56% (target: < 1%)
├── Code paths traced: All 6 execution paths
├── Fix complexity: ~530 LOC total
└── Verdict: NOT CERTIFIED — 56x over threshold

Required for < 1%:
1. P0 fixes (FA-006, FA-007, FA-001) reduce rate to ~20%
2. P1 fixes (FA-002, FA-004, FA-008) reduce rate to ~5%
3. P2 fixes (FA-003, FA-005, FA-009, FA-010) reduce rate to < 1%
```

---

**CERTIFICATION STATUS:** FALSE_ACTION_RATE_NOT_CERTIFIED
**RATE:** ~56% — BLOCKED (56x over 1% threshold)
