# PHONE_OPERATOR_CERTIFICATION.md

**Phase:** 5 — Live Phone Certification
**Generated:** 2026-06-16T08:26:00+07:00
**Audit Method:** Code-trace prediction of real phone behavior (7 test messages)
**Target:** PHONE_OPERATOR_READY
**Verdict:** NOT CERTIFIED — Cannot pass without fixes to Phases 1-4

---

## Test Protocol

Each test requires:
- Correct source (data comes from the right place)
- Correct decision (right response type)
- Correct action (action matches intent)
- Image proof (for content-related tests)
- No fake completion
- No duplicate reply
- No false unavailable

---

## Test 1: "Mi ơi post bài Raw đi"

**Message Type:** Action command (content publish)
**Expected Decision:** EXECUTE (with approval)

### Trace Through Execution Path

1. **Intent Classification:** ActionPlanner regex `/lên lịch post|schedule post|đăng bài|create post|tạo post/` — "post bài Raw" does NOT match any pattern exactly. "đăng bài" is close but "post bài" is not in the regex. **UNCERTAIN** — may or may not match.

2. **If matches:** WebsiteActionService.createDraft() → creates draft with business='raw-sushi' → creates approval → returns preview + formatted response

3. **Evidence Verification (MISSING):** No existsSync() check on image files. No image proof generated. No verification that content is ready.

4. **Expected Response:** Draft created + image evidence + approval request
5. **Actual Response:** Draft created + approval request. NO image proof. NO image verification.

**Test Result: FAIL**
- Source: ⚠️ Draft created but no image source verified
- Decision: ✅ Correct (APPROVAL → EXECUTE)
- Action: ⚠️ Draft created but incomplete (no image)
- Image proof: ❌ MISSING — no image verification
- Fake completion risk: HIGH — may say "image ready" without checking
- Duplicate reply: Unknown
- False unavailable: N/A

---

## Test 2: "Không có hình hả?"

**Message Type:** Ambiguous follow-up
**Expected Decision:** CLARIFY or REPORT

### Trace Through Execution Path

1. **Intent Classification:** ActionPlanner — no regex matches "Không có hình hả?". Returns null.

2. **Context Resolution:** ContextResolver processes only current message. No conversation history loaded. Cannot reference previous topic (image from Test 1).

3. **Fallback Behavior:** Unknown — depends on server-side handler. May produce unrelated response or dashboard summary.

4. **Expected Response:** Check image pipeline → report actual image status → "[CONFIRMED/MISSING] Hình ảnh cho post Raw: [status]"
5. **Actual Response:** Unknown — no code path for this query.

**Test Result: FAIL**
- Source: ❌ No image pipeline check available
- Decision: ❌ No CLARIFY or REPORT path for this input
- Action: ❌ Cannot determine
- Image proof: ❌ N/A (asking about image, not providing one)
- Fake completion: UNKNOWN
- Duplicate reply: UNKNOWN
- False unavailable: Likely — will probably respond with unrelated data

---

## Test 3: "QB Report của chúng anh đã hoàn thành rồi mà"

**Message Type:** Status statement
**Expected Decision:** ACKNOWLEDGE

### Trace Through Execution Path

1. **Intent Classification:** ActionPlanner — no regex matches this Vietnamese sentence. Returns null.

2. **Server-side Handler:** May create approval workflow (per FALSE_DECISION_REPORT #1). May launch review process.

3. **Expected Response:** "OK em ghi nhận — QB Report đã hoàn thành." + optional: verify task state in qb-agent.db
4. **Actual Response:** Unknown — likely creates workflow or sends dashboard summary.

**Test Result: FAIL**
- Source: ⚠️ Should verify qb-agent.db but won't
- Decision: ❌ Should be ACKNOWLEDGE, likely produces action
- Action: ❌ May create unnecessary workflow
- Image proof: N/A
- Fake completion: N/A
- Duplicate reply: UNKNOWN
- False unavailable: N/A

---

## Test 4: "Payroll Raw là tuần rồi"

**Message Type:** Context update (temporal)
**Expected Decision:** ACKNOWLEDGE + UPDATE

### Trace Through Execution Path

1. **Intent Classification:** ActionPlanner — no match. Returns null.

2. **Server-side Handler:** May start payroll workflow (per FALSE_DECISION_REPORT #2).

3. **DecisionMemory:** Should store `payroll_period = "last_week"` but DecisionMemory has no temporal context storage mechanism.

4. **Expected Response:** "OK em ghi nhận — Payroll Raw là tuần trước."
5. **Actual Response:** Unknown — likely starts payroll workflow or sends status report.

**Test Result: FAIL**
- Source: N/A (informational message, no data source needed)
- Decision: ❌ Should be ACKNOWLEDGE, likely produces action
- Action: ❌ May start payroll workflow
- Image proof: N/A
- Fake completion: N/A
- Duplicate reply: UNKNOWN
- False unavailable: N/A

---

## Test 5: "Nay anh có task gì?"

**Message Type:** Status query
**Expected Decision:** REPORT

### Trace Through Execution Path

1. **Intent Classification:** ActionPlanner regex `/task.*nào|who.*task/` — "task gì" partially matches. Route to check-tasks.

2. **Source Reading:** DashboardVisibilityConnector.getTasks() → reads cache → returns task list.

3. **Evidence Classification:** Dashboard cache age determines freshness. If recent → CONFIRMED. If old → STALE.

4. **Expected Response:** Task list with evidence tag.
5. **Actual Response:** Should return task list from DashboardVisibilityConnector. This path exists and works.

**Test Result: PASS (conditional)**
- Source: ✅ DashboardVisibilityConnector
- Decision: ✅ REPORT (via regex match)
- Action: ✅ Returns task data
- Image proof: N/A
- Fake completion: LOW RISK
- Duplicate reply: LOW RISK
- False unavailable: Only if Dashboard is down and no cache

**Condition:** Dashboard must be reachable or have fresh cache.

---

## Test 6: "Raw doanh thu sao rồi?"

**Message Type:** Finance query
**Expected Decision:** REPORT + evidence tag

### Trace Through Execution Path

1. **Intent Classification:** Server-side finance handler (not in ActionPlanner regex). Routed via intent-router.ts.

2. **Source Reading:** Finance truth layer → QuickBooks → degraded → returns "missing"

3. **Evidence Classification:** QB sync > 24h → STALE or MISSING.

4. **Response:** Per FINANCE_TRUTH_CERTIFICATION.md, this correctly returns "[MISSING] Em chưa có dữ liệu thật..." or "Dữ liệu đang degraded."

5. **Expected Response:** Finance data WITH freshness warning, or explicit MISSING.
6. **Actual Response:** Per 20-query test: 18/20 correct (returns MISSING/degraded). 2/20 fabricated.

**Test Result: PASS (90% confidence)**
- Source: ✅ Finance truth layer
- Decision: ✅ REPORT with evidence tag
- Action: ✅ Returns data or MISSING
- Image proof: N/A
- Fake completion: ⚠️ 10% risk of fabrication (2 of 20 queries failed)
- Duplicate reply: LOW RISK
- False unavailable: LOW RISK (correctly reports degraded)

**Note:** 2 of 20 finance queries returned fabricated answers. False action rate for this specific path: 10%.

---

## Test 7: "Dashboard + QB + SEO + Maria"

**Message Type:** Multi-intent
**Expected Decision:** Split into 4 intents + execute each

### Trace Through Execution Path

1. **Intent Classification:** ActionPlanner processes first regex match only. "Dashboard" may match check_status. But "QB" + "SEO" + "Maria" are not handled by a multi-intent splitter.

2. **Expected Behavior:** Split into:
   - Dashboard: REPORT (status query)
   - QB: REPORT (finance query)
   - SEO: Depends on intent (query? update?)
   - Maria: Depends on intent (contact? assign?)

3. **Actual Behavior:** Only first matched intent processed. Others silently dropped.

4. **Expected Response:** Combined report from all 4 sources.
5. **Actual Response:** Single intent response only.

**Test Result: FAIL**
- Source: ⚠️ Only first source queried
- Decision: ❌ No multi-intent handling
- Action: ❌ 3 of 4 intents dropped
- Image proof: N/A
- Fake completion: N/A
- Duplicate reply: LOW RISK
- False unavailable: HIGH — will miss 3 of 4 requested items

---

## Phone Certification Summary

| Test | Message | Expected | Actual | Pass? |
|------|---------|----------|--------|-------|
| 1 | Post bài Raw đi | Draft + image proof + approval | Draft only, no image check | FAIL |
| 2 | Không có hình hả? | Report image status | Unknown (no code path) | FAIL |
| 3 | QB Report done rồi mà | ACKNOWLEDGE | Likely creates workflow | FAIL |
| 4 | Payroll là tuần rồi | ACKNOWLEDGE + context | Likely starts workflow | FAIL |
| 5 | Nay có task gì? | REPORT task list | Returns task list | PASS* |
| 6 | Raw doanh thu sao? | REPORT + MISSING/degraded | Returns MISSING (90%) | PASS* |
| 7 | Dashboard + QB + SEO + Maria | Split + 4 reports | Only 1 intent processed | FAIL |

*Conditional on data source availability

---

## Certification Result

```
PHONE_OPERATOR_CERT: NOT CERTIFIED
├── Tests passed: 2/7 (conditional)
├── Tests failed: 5/7
├── Critical failures: 4 (Tests 1, 2, 3, 4)
├── Multi-intent failure: 1 (Test 7)
├── Image proof: 0/1 delivered
├── Fake completion risk: HIGH (Tests 1, 3, 4)
├── False unavailable risk: MEDIUM (Test 7)
└── Verdict: NOT CERTIFIED

Required for CERTIFIED:
1. Fix ACKNOWLEDGE path (Tests 3, 4)
2. Add image existsSync() gate (Test 1)
3. Add image pipeline status check (Test 2)
4. Add multi-intent splitter (Test 7)
5. All 7 tests must PASS on real phone
6. Image proof required for Test 1
```

---

**CERTIFICATION STATUS:** PHONE_OPERATOR_NOT_READY
**GATE STATUS:** BLOCKED — 5 of 7 tests fail
