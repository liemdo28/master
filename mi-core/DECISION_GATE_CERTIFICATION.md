# DECISION_GATE_CERTIFICATION.md

**Phase:** 2 — Decision Gate
**Generated:** 2026-06-16T08:22:00+07:00
**Audit Method:** Full code trace + scenario simulation
**Target:** DECISION_GATE_ENFORCED
**Verdict:** DECISION_GATE_NOT_ENFORCED — Logic designed but not wired

---

## Decision Gate Schema (As Designed)

Six possible outcomes. Action must never be default.

| Decision | When |
|----------|------|
| ACKNOWLEDGE | Statement of fact, casual update, "xong rồi" |
| REPORT | Status query, "sao rồi" |
| UPDATE | Internal state recording, no approval needed |
| CLARIFY | Ambiguous input, missing entity |
| APPROVAL | Risky action identified, CEO approval required |
| EXECUTE | Explicit order + confirmed evidence + approval obtained |

---

## Execution Paths Audited for Decision Gate

### Path 1: ActionPlanner.planAction() — Decision Logic

```javascript
// Current logic in ActionPlanner.mjs:
if (/tìm file|find file|search file/i.test(message)) → find-file
if (/gửi email|send email/i.test(message)) → send-email
if (/tạo meeting|create meeting/i.test(message)) → create-event
if (/tạo task|create task/i.test(message)) → create-task
if (/lên lịch post|schedule post/i.test(message)) → schedule-post
// else → return null
```

**Finding:** The ActionPlanner has NO concept of ACKNOWLEDGE, REPORT, UPDATE, or CLARIFY. It only knows:
- Action matched → create action draft (with approval gate if WRITE risk)
- No match → return null

**Critical Gap:** When CEO says "QB Report đã hoàn thành rồi mà", the ActionPlanner returns null (no regex match). The system then falls through to the default handler — which may create a workflow or produce an unrelated response.

### Path 2: Decision Gate Matrix (As Designed in DECISION_GATE_REPORT.md)

```
statement × any     → ACKNOWLEDGE  ✅
casual × any        → ACKNOWLEDGE  ✅
question × CONFIRMED → REPORT       ✅
ambiguous × any     → CLARIFY      ✅
command × CONFIRMED → APPROVAL     ✅ (if high risk) or EXECUTE ✅ (if low risk)
command × MISSING   → CLARIFY      ✅
```

**Finding:** The matrix is well-designed. The problem is it exists only as documentation, not as enforceable code in the execution path.

### Path 3: AutonomousDecisionEngine.js

```javascript
// The autonomous decision engine operates on:
// - Goal tracking
// - Decision trees
// - Risk assessment
// - Approval gates
// BUT: It does NOT implement the ACKNOWLEDGE/REPORT/UPDATE decision types
```

**Finding:** The AutonomousDecisionEngine operates at a different level (goal-driven autonomous operations). It does NOT serve as the CEO message decision gate. It handles internal task execution decisions, not CEO intent-to-response decisions.

### Path 4: ApprovalRequiredAction.mjs

```javascript
const ACTION_LEVELS = {
  search: 1, find: 1, read: 1, // auto-allowed
  'send-email': 2, 'create-task': 2, // needs approval
  'delete-file': 3, 'deploy-production': 3, // double approval
};
```

**Finding:** This handles the APPROVAL decision correctly for write actions. But it has no concept of ACKNOWLEDGE (null action) or REPORT (information only). The gate exists for outgoing actions but NOT for blocking unnecessary actions.

---

## Scenario Simulation: 10 CEO Messages

### Scenario 1: "K"
| Step | Required | Actual |
|------|----------|--------|
| Intent | Casual acknowledgment | regex: no match |
| Evidence | N/A | N/A |
| Decision | ACKNOWLEDGE | Falls through to null → unknown handler |
| Action | None | Potentially unrelated response |
| **Result** | **PASS if null = no action** | **UNCERTAIN** |

### Scenario 2: "Ha?"
| Step | Required | Actual |
|------|----------|--------|
| Intent | Ambiguous follow-up | regex: no match |
| Evidence | Context-dependent | ContextResolver resolves store/people only |
| Decision | CLARIFY or ACKNOWLEDGE | Falls through to null |
| Action | Ask for clarification | Unknown |
| **Result** | **DEPENDS on fallback handler** | **UNVERIFIED** |

### Scenario 3: "Sao?"
| Step | Required | Actual |
|------|----------|--------|
| Intent | Status query | regex: no match |
| Evidence | Should check last topic | No conversation history loaded |
| Decision | REPORT | Falls through to null |
| Action | Report status | Unknown |
| **Result** | **DEPENDS on fallback handler** | **UNVERIFIED** |

### Scenario 4: "Không có hình hả?"
| Step | Required | Actual |
|------|----------|--------|
| Intent | Follow-up about image | regex: no match for image query |
| Evidence | Should check content pipeline | No pipeline status check |
| Decision | REPORT (image status) | Falls through to null |
| Action | Report image status | Unknown |
| **Result** | **DEPENDS on fallback handler** | **UNVERIFIED** |

### Scenario 5: "QB Report đã hoàn thành rồi mà"
| Step | Required | Actual |
|------|----------|--------|
| Intent | Status update (statement) | regex: no match |
| Evidence | Should verify task state in qb-agent.db | No verification |
| Decision | ACKNOWLEDGE (+ optional VERIFY) | Falls through to null |
| Action | None (acknowledgment only) | Unknown — may create workflow |
| **Result** | **HIGH RISK of false action** | **FAIL** |

### Scenario 6: "Payroll Raw là tuần rồi"
| Step | Required | Actual |
|------|----------|--------|
| Intent | Context update | regex: no match |
| Evidence | N/A (informational) | N/A |
| Decision | ACKNOWLEDGE + UPDATE context | Falls through to null |
| Action | Store context, acknowledge | Unknown — may start workflow |
| **Result** | **HIGH RISK of false workflow** | **FAIL** |

### Scenario 7: "Nay anh có task gì?"
| Step | Required | Actual |
|------|----------|--------|
| Intent | Status query | regex: `/task.*nào|who.*task/` matches → check-tasks |
| Evidence | Dashboard task data | DashboardVisibilityConnector |
| Decision | REPORT | Returns task data |
| Action | Present task list | ✅ Correct path exists |
| **Result** | **PASS** | **CONFIRMED** |

### Scenario 8: "Raw doanh thu sao rồi?"
| Step | Required | Actual |
|------|----------|--------|
| Intent | Finance query | regex: no specific finance match in ActionPlanner |
| Evidence | QB finance data | Finance layer returns degraded/missing |
| Decision | REPORT + STALE/MISSING warning | Depends on server-side handler |
| Action | Report with evidence tag | Finance truth handles this correctly |
| **Result** | **PASS via server-side finance truth layer** | **CONFIRMED** |

### Scenario 9: "Post bài lên Raw"
| Step | Required | Actual |
|------|----------|--------|
| Intent | Content publish | regex: `/lên lịch post|schedule post/` matches |
| Evidence | Should verify image exists | NO image verification |
| Decision | Should be: CREATE DRAFT → VERIFY IMAGE → REQUEST APPROVAL | Creates draft, skips verification |
| Action | Creates draft (correct) + requests approval (correct) but SKIPS image verification | PARTIAL |
| **Result** | **PARTIAL — missing image evidence gate** | **PARTIAL FAIL** |

### Scenario 10: "Mi ơi post bài Raw đi"
| Step | Required | Actual |
|------|----------|--------|
| Intent | Content publish command | regex: `/lên lịch post|schedule post/` may not match "post bài Raw đi" |
| Evidence | Should verify image exists | NO image verification |
| Decision | EXECUTE (with approval) | Creates draft if regex matches |
| Action | Draft + approval request | PARTIAL |
| **Result** | **PARTIAL** | **PARTIAL FAIL** |

---

## Decision Gate Enforcement Map

| CEO Message Pattern | Correct Decision | Code Path Exists? | Correctly Routed? |
|---------------------|-----------------|-------------------|-------------------|
| Statement ("xong rồi") | ACKNOWLEDGE | ❌ No null-action path | NO |
| Casual ("K", "Ha?") | ACKNOWLEDGE | ❌ No null-action path | NO |
| Status query ("sao rồi?") | REPORT | ⚠️ Only via ActionPlanner regex | PARTIAL |
| Context update ("tuần rồi") | ACKNOWLEDGE + UPDATE | ❌ No context update path | NO |
| Ambiguous follow-up | CLARIFY | ❌ No conversation history | NO |
| Action command ("gửi email") | APPROVAL → EXECUTE | ✅ ActionPlanner + ApprovalGate | YES |
| Task query ("có task gì?") | REPORT | ✅ ActionPlanner regex | YES |
| Finance query | REPORT | ✅ Server-side finance truth | YES |
| Content publish | APPROVAL → EXECUTE | ⚠️ Draft created, image not verified | PARTIAL |
| File operations | REPORT/APPROVAL | ✅ ActionPlanner regex | YES |

---

## Decision Gate Gap Analysis

### GAP 1: No ACKNOWLEDGE Path (CRITICAL)
**Current:** Every CEO message that matches a regex → creates an action. No match → null → falls through.
**Required:** A dedicated `ACKNOWLEDGE_ONLY` handler that:
1. Recognizes statements ("xong rồi", "tuần rồi", "K", "Ha?")
2. Produces a simple acknowledgment
3. Creates NO workflow, NO approval, NO action
4. Logs the context update in DecisionMemory

**Impact:** 4 of 10 scenarios fail because of this gap.

### GAP 2: No Conversation History for Follow-ups (HIGH)
**Current:** ContextResolver resolves store/people/contacts from current message only.
**Required:** Load last 3-5 messages to resolve ambiguous references.

### GAP 3: No Image Evidence Gate in Content Path (CRITICAL)
**Current:** WebsiteActionService creates draft → requests approval. No `existsSync()` on output images.
**Required:** Before returning "image ready," verify all required files exist.

### GAP 4: Decision Gate Not in Response Pipeline (HIGH)
**Current:** Evidence Gate → Decision Gate pipeline is documented but not verified in code.
**Required:** Every response must pass through `classifyDecision()` before sending.

---

## Acceptance Criteria Audit

| Criterion | Required | Actual | Pass? |
|-----------|----------|--------|-------|
| ACKNOWLEDGE handles all statement inputs | Yes | No code path | ❌ |
| REPORT handles all status queries | Yes | Partial (regex-based) | ⚠️ |
| CLARIFY handles ambiguous input | Yes | No code path | ❌ |
| APPROVAL required for all risky actions | Yes | Yes (ApprovalRequiredAction) | ✅ |
| EXECUTE only with all conditions met | Yes | Partially enforced | ⚠️ |
| Action never the default | Yes | Action IS the default (regex → action) | ❌ |
| All 6 decision types implementable | Yes | Only 2 of 6 (APPROVAL, EXECUTE-like) | ❌ |
| Audit trail for every decision | Yes | ActionAuditLog exists, no decision class logged | ❌ |

---

## Certification Result

```
DECISION_GATE_CERT: NOT ENFORCED
├── Decision matrix: DESIGNED ✅
├── ACKNOWLEDGE path: NOT IMPLEMENTED ❌
├── REPORT path: PARTIAL ⚠️ (regex-based only)
├── CLARIFY path: NOT IMPLEMENTED ❌
├── APPROVAL path: IMPLEMENTED ✅
├── UPDATE path: NOT IMPLEMENTED ❌
├── EXECUTE path: PARTIAL ⚠️
├── Action-not-default: VIOLATED ❌
├── Audit trail: INCOMPLETE ⚠️
└── Verdict: NOT ENFORCED

Required for ENFORCED:
1. Add ACKNOWLEDGE_ONLY handler in ActionPlanner (or new DecisionGate module)
2. Classify all CEO messages before action planning
3. Route statements/casual → ACKNOWLEDGE (no action)
4. Route status queries → REPORT (information only)
5. Route ambiguous → CLARIFY (ask CEO)
6. Log decision type in every response
7. Never default to action creation
```

---

**CERTIFICATION STATUS:** DECISION_GATE_NOT_ENFORCED
**GATE STATUS:** BLOCKED — 4 of 6 decision types missing, action is still default
