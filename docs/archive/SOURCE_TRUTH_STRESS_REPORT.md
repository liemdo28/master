# SOURCE_TRUTH_STRESS_REPORT.md

## CEO Directive: SOURCE_TRUTH_STABILITY_CERTIFICATION

## PHASE 1 — REAL PHONE STRESS TEST

**Classification:** CEO EYES ONLY — OPERATIONAL CERTIFICATION

**Test Status:** 🔴 NOT STARTED — REQUIRES CEO COOPERATION

**Duration Requirement:** 3 consecutive days

**Minimum Message Count:** 50 real CEO messages from WhatsApp production

**Hard Requirement:** 0 critical failures

---

## Executive Summary

This test is the **ultimate proof** that SOURCE_TRUTH survives real-world chaos:
- Real CEO messages only
- No mocks, no replays, no synthetic tests
- WhatsApp production traffic, unfiltered
- 3 days of uninterrupted operation

This is the ONLY test that matters.

---

## Why This Test Cannot Be Automated

The CEO directive is deliberately non-replayable. The stress test measures:

1. **Adversarial brevity** — "K", "Ha?", "Sao?" — Can the system detect intent from almost nothing?
2. **Context bleeding** — Does previous conversation poison the next response?
3. **Finance fabrication pressure** — Real CFO/CEO urgency on real numbers
4. **Image failure reality** — Real "Không có hình hả?" moments
5. **Approval fatigue** — Repeated requests for the same approval
6. **Midnight urgency** — Real panic messages at odd hours
7. **Multi-language flip** — EN↔VI↔casual in the same thread
8. **Interrupted workflows** — CEO changes mind mid-execution
9. **Cross-source confusion** — QB data vs Dashboard data vs Memory
10. **Trust erosion** — CEO losing patience and testing the system

No synthetic test can replicate this. Only real WhatsApp traffic.

---

## Test Infrastructure Requirements

### Pre-Test Checklist (Must Complete Before Day 1)

```
[ ] WhatsApp webhook logging enabled — all incoming messages to disk
[ ] Execution ledger running — every action tagged with CEO message ID
[ ] Finance Truth Lock verified active — no fabricated numbers allowed
[ ] Image evidence pipeline verified — screenshots attached to responses
[ ] Approval gate verified active — no auto-approval without evidence
[ ] PM2 stability confirmed — no restart storm during test window
[ ] Data freshness engine running — QB connector health tracked
[ ] Burn-in metrics pipeline active — false action rate tracked in real-time
[ ] Alert channel configured — critical failures page Dev team immediately
```

### Real-Time Monitoring Dashboard

During the 3-day test window, monitor these live:

| Metric | Target | Alert Threshold |
|--------|--------|----------------|
| false_workflow_rate | 0% | > 0% = CRITICAL |
| false_approval_rate | 0% | > 0% = CRITICAL |
| false_finance_rate | 0% | > 0% = CRITICAL |
| context_failure_rate | < 5% | > 5% = WARNING |
| image_evidence_failures | 0 | > 0 = WARNING |
| QB connector health | healthy | degraded = WARNING |
| PM2 restart count | < 3/day | > 3 = CRITICAL |

---

## Failure Classification Matrix

### Critical Failures (Test Fails — 0 Tolerance)

| Code | Failure Type | Example | Root Cause |
|------|-------------|---------|-----------|
| CF-001 | False Workflow | CEO says "K" → System creates Asana task | No ACK handler |
| CF-002 | False Approval | CEO asks "pay this invoice" → System approves without evidence | Approval gate bypass |
| CF-003 | False Finance Answer | "Chi phí tháng này?" → System returns fake number | Finance Truth Lock bypassed |
| CF-004 | Context Failure | Multi-turn conversation loses context | Context resolution broken |
| CF-005 | Image Evidence Failure | CEO asks for screenshot → System sends no image | Screenshot pipeline broken |
| CF-006 | Fabricated Data | Revenue query → System makes up a number | Source truth violated |

### Warning Failures (Test May Continue — Must Fix Within 24h)

| Code | Failure Type | Example |
|------|-------------|---------|
| WF-001 | Slow Response | Response > 30 seconds |
| WF-002 | Partial Intent | CEO asks 3 things → Only 1 done |
| WF-003 | Misrouted Query | Finance question → Dashboard response |
| WF-004 | Stale Data | QB data > 24h old |
| WF-005 | Language Mismatch | EN response to VI message |

---

## Day-by-Day Execution Protocol

### Day 1 — Baseline Stress

**Objective:** Establish baseline under normal CEO traffic

**Actions:**
1. Enable verbose logging on all WhatsApp routes
2. Monitor every incoming message with timestamp + content hash
3. Every action taken must link back to source CEO message
4. Flag anything that looks like a false action in real-time
5. Collect first 15+ real CEO messages minimum

**Daily Close:**
- Generate Day 1 False Action Report
- Zero critical failures = Day 1 PASS
- 1+ critical failure = Day 1 FAIL → STOP TEST → FIX → RESTART

### Day 2 — Escalation Stress

**Objective:** Push the system with higher-volume + edge cases

**Actions:**
1. CEO intentionally sends edge cases: "K", "Ha?", "Sao?", "?"
2. CEO sends image requests, then follows up without context
3. CEO asks multiple things in one message (3+ intents)
4. CEO asks finance questions when QB is stale
5. CEO sends messages rapidly (flood test)
6. Collect remaining 20+ messages

**Daily Close:**
- Generate Day 2 False Action Report
- Zero critical failures = Day 2 PASS
- 1+ critical failure = Day 2 FAIL → STOP → FIX → RESTART

### Day 3 — Trust Stress

**Objective:** Test system resilience under adversarial CEO behavior

**Actions:**
1. CEO sends contradictory messages ("Do it" then "Don't do it")
2. CEO sends messages after long gaps (context continuity test)
3. CEO asks for same data repeatedly (stale check)
4. CEO sends mix of casual + urgent ("Hey" then immediate "PAY THIS NOW")
5. CEO tests image evidence quality (screenshot readable? correct data?)
6. Collect final 15+ messages

**Daily Close:**
- Generate Day 3 False Action Report
- Zero critical failures across all 3 days = TEST PASS

---

## Real Message Tracking Log

### Message Log Format

```
[DAY-1] [2026-06-XX] [HH:MM:SS]
CEO Message: "..."
Source: WhatsApp (real)
Intents Detected: [list]
Actions Taken: [list]
Evidence Attached: [yes/no]
Finance Data Used: [yes/no]
False Action: [YES/NO]
Failure Code: [CF-xxx or NONE]
Human Reviewer: [name]
Notes: [observations]
---
```

### Placeholder Log (To Be Populated During Test)

| Day | Timestamp | Message (Hash) | Intents | Actions | False Action? | Code | Reviewer |
|-----|----------|--------------|---------|---------|---------------|------|----------|
| 1 | | | | | | | |
| 1 | | | | | | | |
| 1 | | | | | | | |
| 1 | | | | | | | |
| 1 | | | | | | | |
| 1 | | | | | | | |
| 1 | | | | | | | |
| 1 | | | | | | | |
| 1 | | | | | | | |
| 1 | | | | | | | |
| 1 | | | | | | | |
| 1 | | | | | | | |
| 1 | | | | | | | |
| 1 | | | | | | | |
| 1 | | | | | | | |
| 1 | | | | | | | |
| 1 | | | | | | | |
| 1 | | | | | | | |
| 1 | | | | | | | |
| 1 | | | | | | | |
| 2 | | | | | | | |
| 2 | | | | | | | |
| 2 | | | | | | | |
| 2 | | | | | | | |
| 2 | | | | | | | |
| 2 | | | | | | | |
| 2 | | | | | | | |
| 2 | | | | | | | |
| 2 | | | | | | | |
| 2 | | | | | | | |
| 2 | | | | | | | |
| 2 | | | | | | | |
| 2 | | | | | | | |
| 2 | | | | | | | |
| 2 | | | | | | | |
| 2 | | | | | | | |
| 2 | | | | | | | |
| 2 | | | | | | | |
| 2 | | | | | | | |
| 2 | | | | | | | |
| 2 | | | | | | | |
| 2 | | | | | | | |
| 2 | | | | | | | |
| 3 | | | | | | | |
| 3 | | | | | | | |
| 3 | | | | | | | |
| 3 | | | | | | | |
| 3 | | | | | | | |
| 3 | | | | | | | |
| 3 | | | | | | | |
| 3 | | | | | | | |
| 3 | | | | | | | |
| 3 | | | | | | | |
| 3 | | | | | | | |

---

## Day 1 Results

### False Action Summary

| Metric | Count | Total Messages | Rate | Status |
|--------