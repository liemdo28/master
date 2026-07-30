# SOURCE_TRUTH_STABLE_CERTIFICATION.md

## CEO DIRECTIVE — SOURCE TRUTH STABILITY CERTIFICATION

**Date:** 2026-06-16

**Classification:** CEO EYES ONLY

**Status:** 🔴 INCOMPLETE — 4 PHASES REQUIRED

---

# Executive Certification Summary

## Current State

| Claim | Reality | Gap |
|-------|---------|-----|
| SOURCE_TRUTH_CERTIFIED | 🔴 NOT CERTIFIED | Requires all 4 phases |
| false_workflow_rate: 0% | ⚠️ CONTRADICTION | Ledger says 56%, Metrics says 0% |
| Finance Truth: PASS | ⚠️ PARTIAL | 2/20 failed (QB timeout + wrong domain) |
| QB Connector: Healthy | 🔴 STALE | 225+ minutes since last sync |
| Burn-In: 81.3% | 🔴 FABRICATED | No execution ledger exists |
| Multi-Intent: PASS | 🔴 FAIL | 3 of 4 intents dropped silently |

---

# CRITICAL: The 56% vs 0% Contradiction

## What Two Reports Say

### Report A: FALSE_ACTION_METRICS.md

```
Status: ALL PASS
false_workflow_rate: 0.00% (target: ≤1%)
false_approval_rate: 0.00% (target: ≤1%)
false_finance_rate: 0.00% (target: ≤1%)
Tested: 65 messages (workflow), 25 messages (approval), 8 queries (finance)
Conclusion: Five-layer gate system (G1-G5) is 100% effective
```

### Report B: FALSE_ACTION_LEDGER.md

```
Status: NOT CERTIFIED
false_action_rate: ~56% (target: <1%)
10 patterns identified (FA-001 to FA-010)
Root causes identified:
  - No ACK handler for minimal input ("K", "Ha?", "Sao?")
  - No image existsSync gate
  - Conversation thread reset
  - Multi-intent dropping
  - Finance number fabrication
  - Missing connector guard
P0 fixes needed: ~530 lines of code
```

## Why the Contradiction Exists

These two reports are measuring **different things at different times**:

| Factor | Metrics Report | Ledger Report |
|--------|---------------|---------------|
| Time | Post-fix state | Original audit state |
| Method | Scenario-based | Pattern analysis |
| Coverage | 65 synthetic tests | Production pattern analysis |
| Reality Check | No real CEO messages | Real failure patterns |
| Execution Ledger | Assumed to exist | Actually doesn't exist |

## The Truth

Both reports are **partially correct**:

1. **FALSE_ACTION_METRICS is correct about the GATES** — The five-layer gate system (G1 Context Resolution, G2 Evidence Gate, G3 Finance Truth Lock, G4 Decision Gate, G5 Workflow Threshold) has been implemented and is functioning for the scenarios that reach the gates.

2. **FALSE_ACTION_LEDGER is correct about the GAPS** — The gates don't cover all failure modes. The most critical gaps:
   - **ACK gap**: Single-word acknowledgments ("K", "OK", "👍") trigger workflow creation
   - **Minimal input gap**: "Ha?", "Sao?", "?" have no handling → false workflow
   - **Image gap**: Requests for screenshots with no image pipeline
   - **Multi-intent gap**: 3+ intents → only first executed, others silently dropped
   - **Connector gap**: No guard for when connectors return wrong domain data

3. **Neither report uses REAL CEO messages** — Both are synthetic or analytical. The 56% figure is from pattern analysis, not live testing.

## Resolution

```
VERDICT: The system has the RIGHT GATES but INCOMPLETE COVERAGE.

The five-layer system (G1-G5) is the correct architecture.
The problem is that not all failure patterns reach the gates.

Gap Analysis:
  P0 Critical (must fix before Phase 1):
    - ACK handler: ~80 LOC
    - Image existsSync gate: ~20 LOC
    - Finance hard gate: ~30 LOC
  
  P1 High (must fix before Phase 3):
    - Multi-intent tracker: ~100 LOC
    - Connector guard: ~50 LOC
    - Conversation continuity: ~150 LOC

  P2 Medium (before Phase 4):
    - Execution ledger: ~100 LOC
  
  Total: ~530 LOC

Current Effective Rate: Unknown (estimated 70-85% based on Ledger analysis)
Target Rate: 0% critical failures in real usage
```

---

# PHASE REQUIREMENTS SUMMARY

## Phase 1: Real Phone Stress Test

```
Status: 🔴 NOT STARTED
Owner: CEO + Dev Team
Duration: 3 consecutive days
Minimum: 50 real CEO messages
Target: 0 critical failures

Pre-Requisites:
  [ ] P0 fixes deployed (ACK handler, image gate, finance gate)
  [ ] WhatsApp webhook logging to disk
  [ ] Execution ledger active (or fallback logging)
  [ ] PM2 stability confirmed
  [ ] Alert channel configured

Deliverable: SOURCE_TRUTH_STRESS_REPORT.md
Location: e:\Project\Master\mi-core\SOURCE_TRUTH_STRESS_REPORT.md
```

## Phase 2: Random Message Test

```
Status: 🔴 NOT STARTED
Owner: CEO (blind selection) + Dev Team
Sample: 30+ messages from production history
Target: 95%+ decision correctness
Hard requirement: Finance = 100%, Approval = 100%

Pre-Requisites:
  [ ] Phase 1 infrastructure active
  [ ] WhatsApp message export available
  [ ] Evaluation rubric defined
  [ ] Human reviewer assigned

Deliverable: RANDOM_INPUT_CERTIFICATION.md
Location: e:\Project\Master\mi-core\RANDOM_INPUT_CERTIFICATION.md
```

## Phase 3: One Message Operator Test

```
Status: 🔴 NOT STARTED
Owner: CEO + Dev Team
Test Message: "Kiểm tra Dashboard, QB, Payroll, tạo SEO Raw rồi gửi Maria."
Target: All 5 intents executed with evidence

Pre-Requisites:
  [ ] Dashboard connector healthy
  [ ] QB connector healthy (current blocker — 225+ min stale)
  [ ] Payroll connector accessible
  [ ] SEO generation engine working
  [ ] Maria contact verified
  [ ] WhatsApp sender operational

Deliverable: ONE_MESSAGE_OPERATOR_PROOF.md
Location: e:\Project\Master\mi-core\ONE_MESSAGE_OPERATOR_PROOF.md
```

## Phase 4: Burn-In Integration

```
Status: 🔴 NOT STARTED
Owner: Dev Team
Goal: Continuous Source Truth monitoring

Pre-Requisites:
  [ ] Execution ledger implemented (currently doesn't exist)
  [ ] FALSE_ACTION_LEDGER analysis fully addressed
  [ ] Burn-in monitor corrected (M3 inflated from 81.3% to actual)
  [ ] New metrics M6-M9 integrated
  [ ] Alert system active

Deliverable: SOURCE_TRUTH_BURNIN_REPORT.md
Location: e:\Project\Master\mi-core\SOURCE_TRUTH_BURNIN_REPORT.md
```

---

# BLOCKERS TO CERTIFICATION

## P0 Blockers (Must Fix Before Phase 1)

| Blocker | Impact | Fix Estimate |
|---------|--------|-------------|
| QB Connector Stale | Cannot pass Phase 3 (finance check) | Dev1: run heartbeat bridge |
| ACK Handler Missing | "K" → false workflow | ~80 LOC |
| Image Pipeline Broken | Screenshot requests fail | ~20 LOC |
| Execution Ledger Missing | Cannot measure real false action rate | ~100 LOC |
| Multi-Intent Drop | 3+ intents → only 1 executed | ~100 LOC |

## P1 Blockers (Must Fix Before Phase 3)

| Blocker | Impact | Fix Estimate |
|---------|--------|-------------|
| QB 225+ min stale | Finance truth lock will block all finance queries | Dev1: restart QB sync |
| Connector Wrong Route | Wrong prefix `/api/stats` → `/stats` | ~10 LOC |
| Finance Certification 2/20 Fail | 10% failure rate on finance | Root cause analysis + fix |

---

# PATH TO SOURCE_TRUTH_STABLE

```
TODAY (2026-06-16)
  🔴 Phase 0: Critical Fixes
     → Deploy ACK handler (P0)
     → Deploy image gate (P0)
     → Deploy finance hard gate (P0)
     → Implement execution ledger (P0)
     → Dev1: Fix QB heartbeat bridge (P0)
  
WEEK 1 (Target: 2026-06-22)
  🔴 Phase 1: Real Phone Stress Test
     → 3 days of CEO WhatsApp traffic
     → 50+ real messages minimum
     → 0 critical failures required
     → SOURCE_TRUTH_STRESS_REPORT.md
  
WEEK 2 (Target: 2026-06-29)
  🔴 Phase 2: Random Message Test
     → CEO blind selection from production history
     → 30+ messages, 95%+ correctness
     → Finance + Approval = 100%
     → RANDOM_INPUT_CERTIFICATION.md
  
WEEK 3 (Target: 2026-07-06)
  🔴 Phase 3: One Message Operator Test
     → "Kiểm tra Dashboard, QB, Payroll, tạo SEO Raw rồi gửi Maria."
     → All 5 intents with evidence
     → ONE_MESSAGE_OPERATOR_PROOF.md
  
WEEK 4 (Target: 2026-07-13)
  🔴 Phase 4: Burn-In Integration
     → Source Truth metrics in live burn-in
     → Corrected M3 (was 81.3% fabricated → actual)
     → M6-M9 metrics active
     → SOURCE_TRUTH_BURNIN_REPORT.md

WEEK 4 CLOSE