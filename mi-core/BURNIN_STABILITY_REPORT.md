# BURNIN_STABILITY_REPORT.md

**Git Commit:** ae8ad26fa6a73b5e971b814fdec7276f7e220fd4
**Generated:** YYYY-MM-DDT00:00:00+07:00
**Phase:** 5 - Burn-In (P0-4 False Action Telemetry)
**Status:** TEMPLATE

---

## Executive Summary

<!-- Summarize overall burn-in status -->

| Field | Value |
|-------|-------|
| Burn-In Day | Day N of 30 |
| Combined Score | NN/110 (NN.N%) |
| Target Score | 110/110 (100%) |
| P0 Events | N |
| P1 Events | N |
| Consecutive Clean Days | N/7 |
| Verdict | PASS / WARN / FAIL |

---

## Stability Scorecard (M1-M5: Infrastructure)

| Metric | Name | Score | Max | Status | Source |
|--------|------|-------|-----|--------|--------|
| M1 | PM2 Stability | - | 15 | | PM2 jlist |
| M2 | Port Health | - | 10 | | HTTP probes |
| M3 | QB Freshness | - | 10 | | /api/visibility/quickbooks |
| M4 | Connector Truth | - | 10 | | Registry vs cache |
| M5 | Approval Persistence | - | 15 | | SQLite approvals.db |
| TOTAL | | - | 60 | | |
### M1: PM2 Stability

```
PM2 Status:
  mi-core              : online  | restarts: N | uptime: Ns
  whatsapp-ai-gateway  : online  | restarts: N | uptime: Ns
  ollama               : online  | restarts: N | uptime: Ns
```

| Check | Result | Details |
|-------|--------|--------|
| All processes online | TBD | |
| No crash loops (>3x/min) | TBD | |
| 24h restart delta <= 0 | TBD | baseline=N current=N delta=N |
| Uptime >= 1h per process | TBD | |

### M2: Port Health

| Service | Port | HTTP Status | Latency | Check |
|---------|------|-------------|---------|-------|
| mi-core | 3000 | | | GET /api/health |
| ollama | 11434 | | | GET /api/tags |
| whatsapp-ai-gateway | 3001 | | | GET /health |

### M3: QB Freshness

| Field | Value |
|-------|-------|
| Last sync timestamp | |
| Data age | |
| Threshold | < 48h |
| Status | FRESH / STALE |

### M4: Connector Truth

| Connector | Health Status | Freshness | Last Probe |
|-----------|--------------|-----------|------------|
| quickbooks | | | |
| gmail | | | |
| asana | | | |
| dashboard-bakudan | | | |
| food-safety | | | |
| accounting | | | |

### M5: Approval Persistence

| Check | Result | Details |
|-------|--------|--------|
| approvals.db exists | TBD | Path: .local-agent-global/approvals/approvals.db |
| DB is readable | TBD | |
| Approval count | N entries | |

---

## Telemetry Scorecard (M6-M10: False Action)

| Metric | Name | Score | Max | Rate | Target | Status |
|--------|------|-------|-----|------|--------|--------|
| M6 | false_action_rate | - | 20 | N% | < 1% | |
| M7 | false_approval_rate | - | 10 | N% | 0% | |
| M8 | false_finance_rate | - | 10 | N% | 0% | |
| M9 | context_failure_rate | - | 5 | N% | < 5% | |
| M10 | image_claim_failure_rate | - | 5 | N% | 0% | |
| TOTAL | | - | 50 | | | |
### M6: false_action_rate

Data Source: .local-agent-global/execution-ledger/ledger.jsonl

```
grep "false_action":true ledger.jsonl | wc -l  -> numerator (N)
wc -l ledger.jsonl                                -> denominator (N)
rate = numerator / denominator * 100              -> N%
```

| Scoring Band | Points |
|-------------|--------|
| 0% | 20 |
| 0.1% - 0.99% | 20 |
| 1% - 4.99% | 15 |
| 5% - 9.99% | 10 |
| 10%+ | 0 |

**Top False Actions (last 24h):**

| # | Work Order | Action | false_action_reason | Fix Applied |
|---|-----------|--------|--------------------|-------------|
| 1 | | | | |
| 2 | | | | |

### M7: false_approval_rate

```
Data Source: approvals.db + ledger approval entries
Approvals checked: N
False approvals: N
Rate: N%
```

### M8: false_finance_rate

```
Data Source: finance-truth-layer + ledger finance_query entries
Finance queries: N
False finance responses: N
Rate: N%
```

<!-- Note: UNMEASURABLE if no finance query entries exist in ledger -->

### M9: context_failure_rate

```
Data Source: context-resolution.ts + ledger context events
Context events: N
Context failures: N
Rate: N%
```

| # | Message | Failure Type | Root Cause | Fix |
|---|---------|-------------|------------|-----|
| 1 | | | | |

### M10: image_claim_failure_rate

```
Data Source: .local-agent-global/seo-images/ existsSync checks
Image claims: N
Verified: N
False claims: N
Rate: N%
```

---

## Combined Score Summary

| Category | Score | Max | Percentage |
|----------|-------|-----|------------|
| Infrastructure (M1-M5) | - | 60 | - |
| Telemetry (M6-M10) | - | 50 | - |
| TOTAL | - | 110 | -% |

### Score Interpretation

| Range | Verdict | Action |
|-------|---------|--------|
| 100+/110 | PASS | Continue burn-in |
| 90-99/110 | WARN | Investigate, fix within 24h |
| <90/110 | FAIL | Immediate remediation required |

---

## 30-Day Burn-In Trajectory

| Day | M1-M5 | M6-M10 | Combined | Gate | Notes |
|-----|-------|--------|----------|------|-------|
| Day 1 | -/60 | -/50 | -/110 | BASELINE | |
| Day 7 | -/60 | -/50 | -/110 | GATE_90 | |
| Day 14 | -/60 | -/50 | -/110 | GATE_100 | |
| Day 21 | -/60 | -/50 | -/110 | STABILITY | |
| Day 30 | -/60 | -/50 | -/110 | SOURCE_TRUTH | |

### 30-Day Requirements

| Requirement | Target | Current | Status |
|-------------|--------|---------|--------|
| false_action_rate < 1% | < 1% | N% | TBD |
| Real messages collected | 500 | N | TBD |
| No crash loops (7-day streak) | 7 days | N days | TBD |
| QB connector healthy | STABLE | | TBD |
| All M6-M10 wired | 10/10 code paths | N/10 | TBD |
| Production evidence only | 100% | N% | TBD |

---

## Escalation Events

### P0 Events (Immediate Stop and Fix)

| # | Timestamp | Trigger | Metric | Action Taken | Resolution |
|---|-----------|---------|--------|-------------|------------|
| 1 | | | | | |

### P1 Events (Fix Same Day)

| # | Timestamp | Trigger | Metric | Action Taken | Resolution |
|---|-----------|---------|--------|-------------|------------|
| 1 | | | | | |

---

## Evidence Sources

| Source | Path | Last Updated |
|--------|------|-------------|
| PM2 jlist | pm2 jlist (runtime) | |
| Execution ledger | .local-agent-global/execution-ledger/ledger.jsonl | |
| Approvals DB | .local-agent-global/approvals/approvals.db | |
| Conversations DB | .local-agent-global/conversations.db | |
| Burn-in history | .local-agent-global/burn-in/history.json | |
| Daily scan | .local-agent-global/burn-in/YYYY-MM-DD.json | |
| Telemetry DB | server/telemetry/ceo-telemetry.db | |
| Connector registry | server/src/connectors/connector-registry.ts | |

---

## Remediation Tracking

| # | Metric | Issue | Fix | Owner | Status | ETA |
|---|--------|-------|-----|-------|--------|-----|
| 1 | M6 | false_action_rate > 1% | Wire idempotency + ACKNOWLEDGE handler | Dev Team | TODO | |
| 2 | M9 | context_failure_rate > 5% | Wire context-resolution.ts into pipeline | Dev Team | TODO | |
| 3 | M8 | UNMEASURABLE | Add finance query logging to ledger | Dev Team | TODO | |

---

## Certification Block

```
BURNIN_P04_STABILITY_REPORT: [VERDICT]
  Combined M1-M10 score:    NN/110 (NN.N%)
  Infrastructure (M1-M5):   NN/60
  Telemetry (M6-M10):       NN/50
  Consecutive clean days:   N/7
  P0 events today:          N
  P1 events today:          N
  false_action_rate:        N%
  context_failure_rate:     N%
  Verdict:                  PASS / WARN / FAIL
  Next review:              YYYY-MM-DD
```

---

## Success Criteria (7-Day Streak to CEO_READY_V4_STABLE)

- [ ] No security incidents (0 hardcoded secrets, 0 injection)
- [ ] No workflow loss (ledger integrity maintained)
- [ ] No approval loss (SQLite persistence verified)
- [ ] No memory loss (conversations.db alive and queryable)
- [ ] No silent task drop (multi-intent execution traced)
- [ ] No WhatsApp crash loop (gateway stable)
- [ ] false_action_rate < 1% for 7 consecutive days
- [ ] All M6-M10 telemetry code paths wired and producing data

**Target Status:** CEO_READY_V4_STABLE

---

*Report generated from P0-4 burn-in monitoring template. Update daily via `node v4-burn-in-monitor.mjs`.*