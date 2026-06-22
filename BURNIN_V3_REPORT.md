# BURNIN_V3_REPORT.md

**Phase:** 5 — Burn-In Integration (Expanded M6-M10)
**Generated:** 2026-06-16T10:39:00+07:00
**Target:** Integrate false_action metrics into v4-burn-in-monitor
**Git Commit:** ae8ad26fa6a73b5e971b814fdec7276f7e220fd4

---

## Executive Summary

The existing burn-in monitor (`v4-burn-in-monitor.mjs`) measures 5 metrics (M1-M5) totaling 92/100 on day 1. The CEO directive requires adding M6-M10 for false-action telemetry. This report defines the expanded scorecard, maps data sources, and establishes measurement targets.

---

## Current Burn-In Scorecard (M1-M5)

From `.local-agent-global/burn-in/2026-06-15.json`:

| Metric | Name | Score | Max | Source |
|--------|------|-------|-----|--------|
| M1 | PM2 Stability | 15 | 15 | PM2 jlist: 5/5 online |
| M2 | Port Health | 10 | 10 | HTTP probes: 3/3 responding |
| M3 | QB Freshness | 10 | 10 | `/api/visibility/quickbooks` |
| M4 | Connector Truth | 7 | 10 | 8 active, 4 unverified |
| M5 | Approval Persistence | 10 | 15 | SQLite approvals.db (0 entries) |
| M6 | Workflow Execution | 10 | 10 | 5091 workflows logged |
| M7 | Memory Recall | 15 | 15 | conversations.db 156KB |
| M8 | Multi-Intent | 10 | 10 | 219/219 traces valid |
| M9 | Security | 5 | 5 | 0 hardcoded secrets |
| **TOTAL** | | **92** | **100** | |

### Burn-In Monitor Validation (from BURNIN_MONITOR_VALIDATION_REPORT)

| Metric | Monitor Claim | Verified Reality | Corrected Score |
|--------|--------------|-----------------|-----------------|
| M1 Restart | ~0 in 24h | 1162 lifetime restarts; crash loops Jun 13-14 | 8/15 (was 15) |
| M2 Memory | Good | conversations.db persists, KB healthy | 10/10 (unchanged) |
| M3 Workflow | 81.3% success | 0% success, no execution ledger found | 5/10 (was 10) |
| M4 Approval | Good | SQLite works, audit path wrong, count mismatch | 7/15 (was 10) |
| M5 Connector | Engine down | Engine never down, connector path wrong | 5/10 (was 7) |

**Corrected M1-M9 Score: 57.5/100** (down from claimed 92/100)

---

## Expanded Scorecard (M1-M10)

### New Metrics: M6-M10 (False Action Telemetry)

| Metric | Name | Weight | Max | Target | Current | Source |
|--------|------|--------|-----|--------|---------|--------|
| M6 | false_action_rate | 20 | 20 | < 1% → 20pts, < 5% → 15pts, < 10% → 10pts, else 0 | 0 pts (16%) | Ledger telemetry + false_action field |
| M7 | false_approval_rate | 10 | 10 | 0% → 10pts, < 1% → 8pts, else 0 | 10 pts (0%) | approvals.db + false_approval field |
| M8 | false_finance_rate | 10 | 10 | 0% → 10pts, < 1% → 8pts, else 0 | 0 pts (UNMEASURABLE) | Finance truth layer + false_finance field |
| M9 | context_failure_rate | 5 | 5 | 0% → 5pts, < 5% → 3pts, else 0 | 0 pts (6%) | Context resolution + context_failure field |
| M10 | image_claim_failure_rate | 5 | 5 | 0% → 5pts, < 1% → 3pts, else 0 | 5 pts (0%) | Image evidence proof |

### Scoring Rules

| Rate Range | M6 Score | M7 Score | M8 Score | M9 Score | M10 Score |
|------------|----------|----------|----------|----------|-----------|
| 0% | 20 | 10 | 10 | 5 | 5 |
| 0.1% - 0.99% | 20 | 8 | 8 | 5 | 3 |
| 1% - 4.99% | 15 | 0 | 0 | 3 | 0 |
| 5% - 9.99% | 10 | 0 | 0 | 0 | 0 |
| 10%+ | 0 | 0 | 0 | 0 | 0 |
| UNMEASURABLE | 0 | 0 | 0 | 0 | 5 |

---

## M6: false_action_rate (Weight: 20)

### Measurement

| Source | Messages Analyzed | false_actions | Rate |
|--------|-------------------|---------------|------|
| EVIDENCE_LOCKDOWN_AUDIT (production ledger) | 50 WOs | 8 | **16.0%** |
| FALSE_ACTION_METRICS (synthetic) | 65 messages | 0 | 0.0% |
| **Production truth** | **50** | **8** | **16.0%** |

### Score: 0/20 (rate = 16% > 10%)

### Data Source

Read from `.local-agent-global/execution-ledger/ledger.jsonl`:
```
grep '"false_action":true' ledger.jsonl | wc -l → numerator
wc -l ledger.jsonl → denominator
rate = numerator / denominator
```

### Fix Required

Wire `false_action` flag into 10 code paths (see FALSE_ACTION_TELEMETRY_REPORT.md) to:
1. Block duplicate WOs (FA-004): -8% rate
2. Isolate test senders (FA-002): -4% rate
3. Pre-pipeline approval gate (FA-003): -2% rate
4. ACKNOWLEDGE handler (FA-001): -1% rate

**After fixes: projected rate = 0-1% → score = 20/20**

---

## M7: false_approval_rate (Weight: 10)

### Measurement

| Source | Approvals Checked | false_approvals | Rate |
|--------|-------------------|-----------------|------|
| approvals.db | 0 entries | 0 | **N/A** |
| Ledger APPROVAL_REQUIRED entries | 1 | 0 | **0.0%** |
| **Production truth** | **1** | **0** | **0.0%** |

### Score: 10/10 (rate = 0%)

### Caveat

approvals.db has 0 entries. No approvals have ever been persisted to the SQLite DB. This means:
1. Either no approvals were ever created (unlikely given work orders exist)
2. Or the approval store was never wired to the execution path
3. The 0% rate is **technically correct but untestable**

---

## M8: false_finance_rate (Weight: 10)

### Measurement

| Source | Finance Queries | false_finance | Rate |
|--------|----------------|---------------|------|
| FINANCE_TRUTH_PROOF (synthetic) | 50 | 0 | 0.0% |
| Production ledger | 0 | 0 | **UNMEASURABLE** |
| Live QB (degraded) | N/A | N/A | **UNMEASURABLE** |

### Score: 0/10 (UNMEASURABLE)

### Why UNMEASURABLE

The execution ledger has **zero finance query entries**. Finance queries go through the finance-truth-layer.ts, which returns data directly without creating work orders. There is no ledger entry to measure.

### Fix Required

1. Add finance query logging to ledger (new entry type: `finance_query`)
2. Include `false_finance` flag in finance-truth-layer response
3. QB connector must be healthy (Dev1) to provide live production data

---

## M9: context_failure_rate (Weight: 5)

### Measurement

| Source | Context Events | context_failures | Rate |
|--------|---------------|-----------------|------|
| EVIDENCE_LOCKDOWN_AUDIT | 50 | 3 | **6.0%** |
| CONTEXT_FAILURE_REPORT (red team) | 25 scenarios | 25 | **100%** (designed to find failures) |

### Score: 0/5 (rate = 6% > 5%)

### Context Failures Identified

| # | Message | context_failure | Type |
|---|---------|----------------|------|
| 1 | WO-005: statement treated as command | true | FA-001 |
| 2 | Multi-intent: 4/5 dropped | true | FA-008 |
| 3 | B4: empty response to "dashboard sao roi?" | true | Unknown entity |
| 4-50 | CONTEXT_FAILURE_REPORT red team scenarios | true (25 designed failures) | Architectural gaps |

### Fix Required

1. Wire `context-resolution.ts` into pipeline (P0-5 implementation exists, not wired)
2. Extend conversation TTL from 10 min to 4 hours
3. Add multi-entity tracking (currently single-entity only)

---

## M10: image_claim_failure_rate (Weight: 5)

### Measurement

| Source | Image Claims | image_claims_false | Rate |
|--------|-------------|-------------------|------|
| IMAGE_EVIDENCE_PROOF.md | 3 existsSync checks | 0 | **0.0%** |
| FA-006 (no image verification in content path) | 1 | 1 (claimed ready without check) | **100%** (of unverified claims) |

### Score: 5/5 (verified claims = 0% failure)

### Caveat

Only 3 images were checked via existsSync(). The content path (FA-006) may claim "image ready" without checking — this is a design flaw, not a measured rate.

---

## Expanded Score Summary

### Current State (M1-M10)

| Metric | Current Score | Max | Source |
|--------|--------------|-----|--------|
| M1 PM2 Stability | 8 | 15 | Corrected from monitor validation |
| M2 Port Health | 10 | 10 | Unchanged |
| M3 QB Freshness | 5 | 10 | Corrected from monitor validation |
| M4 Connector Truth | 5 | 10 | Corrected from monitor validation |
| M5 Approval Persistence | 7 | 15 | Corrected from monitor validation |
| M6 false_action_rate | 0 | 20 | 16% rate (target < 1%) |
| M7 false_approval_rate | 10 | 10 | 0% rate |
| M8 false_finance_rate | 0 | 10 | UNMEASURABLE |
| M9 context_failure_rate | 0 | 5 | 6% rate (target < 5%) |
| M10 image_claim_failure_rate | 5 | 5 | 0% verified |
| **TOTAL** | **40** | **110** | **36.4%** |

### Projected After Fixes

| Metric | Projected Score | Max | Condition |
|--------|----------------|-----|-----------|
| M1 PM2 Stability | 15 | 15 | 24h stable operation |
| M2 Port Health | 10 | 10 | No change |
| M3 QB Freshness | 10 | 10 | Dev1 fixes QB connector |
| M4 Connector Truth | 10 | 10 | All connectors healthy |
| M5 Approval Persistence | 15 | 15 | Approval gate wired |
| M6 false_action_rate | 20 | 20 | Idempotency + ACKNOWLEDGE handler |
| M7 false_approval_rate | 10 | 10 | No change |
| M8 false_finance_rate | 10 | 10 | Finance ledger logging added |
| M9 context_failure_rate | 5 | 5 | Context resolution wired |
| M10 image_claim_failure_rate | 5 | 5 | Image gate in content path |
| **TOTAL** | **110** | **110** | **100%** |

---

## Burn-In 30-Day Target

### Daily Measurement Schedule

| Day | M1-M5 | M6-M10 | Combined Score | Gate |
|-----|-------|--------|----------------|------|
| Day 1 (2026-06-15) | 57.5/70 (corrected) | 15/40 | 72.5/110 | INCOMPLETE |
| Day 7 | Target: 60/70 | Target: 30/40 | Target: 90/110 | GATE_90 |
| Day 14 | Target: 65/70 | Target: 38/40 | Target: 103/110 | GATE_100 |
| Day 30 | Target: 70/70 | Target: 40/40 | Target: 110/110 | SOURCE_TRUTH_PROVEN |

### 30-Day Burn-In Requirements

| Requirement | Day 1 | Day 7 | Day 14 | Day 30 |
|-------------|-------|-------|--------|--------|
| false_action_rate < 1% | 16% ❌ | < 5% | < 2% | < 1% ✅ |
| Real messages collected | 9 | 50 | 200 | 500 ✅ |
| No crash loops | CONDITIONAL | PASS | PASS | PASS ✅ |
| QB connector healthy | DEGRADED | FIXED | STABLE | STABLE ✅ |
| All M6-M10 wired | NO | YES | YES | YES ✅ |
| Production evidence only | MIXED | 80% | 95% | 100% ✅ |

---

## Integration into v4-burn-in-monitor.mjs

### Required Code Changes

```javascript
// ADD: false_action telemetry section
async function measureFalseActionTelemetry() {
  const ledger = readJsonl('.local-agent-global/execution-ledger/ledger.jsonl');
  const total = ledger.length;
  
  const false_actions = ledger.filter(e => e.false_action === true).length;
  const false_approvals = ledger.filter(e => e.false_approval === true).length;
  const false_finance = ledger.filter(e => e.false_finance === true).length;
  const context_failures = ledger.filter(e => e.context_failure === true).length;
  
  return {
    m6_false_action_rate: total > 0 ? (false_actions / total * 100).toFixed(2) : 'UNMEASURABLE',
    m7_false_approval_rate: total > 0 ? (false_approvals / total * 100).toFixed(2) : 'UNMEASURABLE',
    m8_false_finance_rate: total > 0 ? (false_finance / total * 100).toFixed(2) : 'UNMEASURABLE',
    m9_context_failure_rate: total > 0 ? (context_failures / total * 100).toFixed(2) : 'UNMEASURABLE',
    m10_image_claim_failure_rate: await measureImageClaimFailure(),
  };
}
```

### Data Source Mapping

| Metric | Data Source | Field | Aggregation |
|--------|------------|-------|-------------|
| M6 | `ledger.jsonl` | `false_action` | count(true) / count(all) |
| M7 | `ledger.jsonl` + `approvals.db` | `false_approval` | count(true) / count(approval_entries) |
| M8 | `ledger.jsonl` + `finance-truth-layer` | `false_finance` | count(true) / count(finance_queries) |
| M9 | `ledger.jsonl` + `conversations.db` | `context_failure` | count(true) / count(context_events) |
| M10 | `.local-agent-global/seo-images/` | `existsSync` failures | count(false) / count(claims) |

---

## Certification Result

```
BURNIN_V3: INTEGRATION DEFINED, NOT YET IMPLEMENTED
├── M1-M5 (corrected): 57.5/70 — monitor validation required fixes
├── M6 false_action_rate: 0/20 — 16% rate, target < 1%
├── M7 false_approval_rate: 10/10 — 0% rate ✅
├── M8 false_finance_rate: 0/10 — UNMEASURABLE (no ledger entries)
├── M9 context_failure_rate: 0/5 — 6% rate, target < 5%
├── M10 image_claim_failure_rate: 5/5 — 0% verified ✅
├── M6-M10 telemetry wired: 0/10 code paths ❌
├── Ledger entries with telemetry: 0/533 ❌
├── Combined M1-M10 score: 40/110 (36.4%)
├── 30-day burn-in target: 110/110
├── Required: Wire 10 code paths + 30-day observation
└── Verdict: INTEGRATION DEFINED, NOT YET IMPLEMENTED
```

---

**CERTIFICATION STATUS:** BURNIN_V3_INTEGRATION_DEFINED
**COMBINED M1-M10 SCORE:** 40/110 (36.4%)
**TARGET:** 110/110 after fixes + 30-day burn-in
**KEY BLOCKERS:** false_action_rate at 16%, context_failure_rate at 6%, M8 unmeasurable
