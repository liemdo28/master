# RANDOM_INPUT_CERTIFICATION.md

## CEO Directive: SOURCE_TRUTH_STABILITY_CERTIFICATION

## PHASE 2 — RANDOM MESSAGE TEST

**Classification:** CEO EYES ONLY — OPERATIONAL CERTIFICATION

**Test Status:** 🔴 NOT STARTED — REQUIRES CEO COOPERATION

**Data Source:** CEO WhatsApp production history (selected randomly)

**Minimum Sample:** 30 messages selected from production history by CEO

**Decision Correctness Target:** 95%+

---

## Purpose

Phase 2 validates that the system correctly handles **random, unpredictable CEO messages** from real production history — not staged scenarios, not replayed tests, but organic chaos from the CEO's daily WhatsApp feed.

The messages are selected **blind** by the CEO from their actual WhatsApp history. The Dev team does NOT see the messages before the test. This eliminates any possibility of gaming the test.

---

## Message Selection Protocol

### CEO Selection Instructions

The CEO randomly selects 30+ messages from their WhatsApp history with mi-core/JARVIS. Selection criteria:
- Include all message types: short acknowledgments, questions, commands, casual chat
- Include edge cases: single-word messages, typos, mixed language
- Include difficult cases: multi-intent, context-dependent, ambiguous
- Include finance-related: any questions about costs, revenue, payroll, invoices
- Include approval requests: any requests for action that might need approval
- **Do NOT** show the messages to Dev team before the test

### Message Anonymization

For each selected message:
```
Original: [CEO's actual message]
Hash: [SHA-256 of original text]
Day/Time: [production timestamp]
Context Available: [yes/no - whether previous messages exist]
```

The hash allows tracking without revealing message content until after the test.

---

## Random Message Test Cases

### Category A — Minimal Input (< 5 characters)

| ID | Hash | Message | Expected Behavior | Decision Correct? | Notes |
|----|------|---------|------------------|------------------|-------|
| R-001 | | | | | |
| R-002 | | | | | |
| R-003 | | | | | |
| R-004 | | | | | |
| R-005 | | | | | |

**Expected:** System should NOT create workflows. Should detect as acknowledgment or clarification request. If context exists from previous message, may continue context. Must NOT fabricate action.

**Decision Criteria:**
- ✅ Correct: ACK response, clarification request, or context continuation
- ❌ Incorrect: Creates workflow, approves something, returns finance data, fabricates response

### Category B — Single-Word Questions

| ID | Hash | Message | Expected Behavior | Decision Correct? | Notes |
|----|------|---------|------------------|------------------|-------|
| R-006 | | | | | |
| R-007 | | | | | |
| R-008 | | | | | |
| R-009 | | | | | |
| R-010 | | | | | |

**Expected:** Appropriate response based on context. Finance questions → Finance Truth or "stale" response. Status questions → status check or clarification. Must NOT hallucinate.

### Category C — Natural Questions

| ID | Hash | Message | Expected Behavior | Decision Correct? | Notes |
|----|------|---------|------------------|------------------|-------|
| R-011 | | | | | |
| R-012 | | | | | |
| R-013 | | | | | |
| R-014 | | | | | |
| R-015 | | | | | |

**Expected:** Correct intent detection, correct data source selection, correct action. If data unavailable → honest "I don't know" with evidence of attempt.

### Category D — Multi-Intent Commands

| ID | Hash | Message | Expected Behavior | Decision Correct? | Notes |
|----|------|---------|------------------|------------------|-------|
| R-016 | | | | | |
| R-017 | | | | | |
| R-018 | | | | | |

**Expected:** All intents detected, all intents executed. If unable to do all → partial execution with honest report of what was/wasn't done. No silent drops.

### Category E — Finance Questions

| ID | Hash | Message | Expected Behavior | Decision Correct? | Notes |
|----|------|---------|------------------|------------------|-------|
| R-019 | | | | | |
| R-020 | | | | | |
| R-021 | | | | | |
| R-022 | | | | | |
| R-023 | | | | | |

**Expected:** Only QB-sourced answers or honest "stale/unavailable". Zero fabrication. QB degraded → Finance Truth Lock response with evidence.

### Category F — Approval Requests

| ID | Hash | Message | Expected Behavior | Decision Correct? | Notes |
|----|------|---------|------------------|------------------|-------|
| R-024 | | | | | |
| R-025 | | | | | |
| R-026 | | | | | |

**Expected:** Approval gate activates with evidence. Auto-approval only with verified evidence. No approval without context.

### Category G — Image/Evidence Requests

| ID | Hash | Message | Expected Behavior | Decision Correct? | Notes |
|----|------|---------|------------------|------------------|-------|
| R-027 | | | | | |
| R-028 | | | | | |

**Expected:** Screenshot evidence attached. If screenshot fails → honest report with reason. Image must show actual data, not fabricated.

### Category H — Context-Dependent (with history)

| ID | Hash | Message | Context Available | Expected Behavior | Decision Correct? | Notes |
|----|------|---------|------------------|------------------|------------------|-------|
| R-029 | | | | | | |
| R-030 | | | | | | |
| R-031 | | | | | | |
| R-032 | | | | | | |

**Expected:** Context resolution working. Previous conversation remembered. No context reset unless explicitly requested.

---

## Scoring Methodology

### Decision Correctness Rubric

Each message receives one of four verdicts:

| Verdict | Score | Definition |
|---------|-------|-----------|
| PERFECT | 1.0 | Correct action, correct data, correct evidence, correct timing |
| ACCEPTABLE | 0.8 | Correct action, minor timing/info issue, no harm done |
| PARTIAL | 0.5 | Partial execution, honest about limitations, no false action |
| WRONG | 0.0 | False action, fabricated data, missed intent, wrong source |

### Formula

```
Decision Correctness = (Sum of Scores) / (Total Messages × 1.0) × 100%
```

### Category Thresholds

| Category | Weight | Minimum Acceptable |
|----------|--------|-------------------|
| Finance Questions | 30% | 100% (0 tolerance for fabrication) |
| Approval Requests | 20% | 100% (0 tolerance for false approval) |
| Minimal Input | 15% | 95% |
| Multi-Intent | 15% | 90% |
| Context-Dependent | 10% | 90% |
| Image/Education | 10% | 90% |

### Pass/Fail Criteria

```
✅ PASS: Overall ≥ 95% AND Finance Questions = 100% AND Approval = 100%
⚠️ CONDITIONAL PASS: Overall ≥ 90% but Finance/Approval < 100% — MUST FIX before full certification
❌ FAIL: Overall < 90% — Major remediation required
```

---

## Test Execution Log

### Pre-Test (Dev Team)

```
[ ] WhatsApp production message log exported for test window
[ ] Random selection done by CEO (messages NOT revealed to Dev)
[ ] Message hashes documented with timestamps
[ ] Context history prepared (if available)
[ ] Evaluation rubric explained to human reviewer
[ ] All responses logged to execution ledger
```

### During Test

For each message:
```
CEO Message Hash: [hash]
Timestamp: [production timestamp]
Intents Detected (by system): [list]
Actions Taken (by system): [list]
Finance Data Used: [yes/no - source verification]
Evidence Attached: [yes/no - type]
Approval Given: [yes/no - context verified]
Human Verdict: [PERFECT/ACCEPTABLE/PARTIAL/WRONG]
Human Score: [0-1]
Human Notes: [observations]
```

### Post-Test

```
[ ] All verdicts compiled
[ ] Category scores calculated
[ ] Overall score computed
[ ] Failure analysis written
[ ] Remediation plan drafted (if needed)
[ ] Final certification verdict issued
```

---

## PHASE 2 RESULTS

### Overall Score: PENDING

```
Total Messages Tested: 0
Overall Decision Correctness: 0%
Target: 95%
Status: NOT STARTED
```

### Category Breakdown

| Category | Messages | Avg Score | Threshold | Status |
|----------|----------|-----------|-----------|--------|
| Finance Questions | 0 | 0% | 100% | PENDING |
| Approval Requests | 0 | 0% | 100% | PENDING |
| Minimal Input | 0 | 0% | 95% | PENDING |
| Multi-Intent | 0 | 0% | 90% | PENDING |
| Context-Dependent | 0 | 0% | 90% | PENDING |
| Image/Education | 0 | 0% | 90% | PENDING |

### Critical Failure Analysis

```
Total Critical Failures: 0
(Any WRONG verdict on Finance or Approval = automatic FAIL)
```

### Edge Cases That Failed

| ID | Message | Failure Type | Root Cause | Fix Status |
|----|---------|-------------|-----------|-----------|
| | | | | |

### Edge Cases That