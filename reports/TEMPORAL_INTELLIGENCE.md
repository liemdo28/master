# Temporal Intelligence Runtime
**Phase 15.5 — TemporalIntelligence**
**Status: PRODUCTION**

---

## Purpose

Answers time-bounded operational questions: *"last week"*, *"last month"*, *"last quarter"*. Computes trends by comparing success rates across periods.

---

## Time Windows

| Period | Days |
|--------|------|
| `week` | 7 |
| `month` | 30 |
| `quarter` | 90 |

---

## Questions Answered

| Question | Function |
|----------|----------|
| Which project had most blockers last 3 months? | `getTopBlockerProjectsRaw(90)` |
| How is Dashboard trending? | `getTrend('dashboard')` |
| System health this week vs month? | `getSystemHealthSnapshot()` |
| Stats for all projects last month? | `getPeriodStats('month')` |

---

## Trend Analysis

`getTrend(project)` compares week success rate vs month success rate:

| Condition | Trend |
|-----------|-------|
| Week rate ≥ Month rate + 10% | IMPROVING |
| Week rate ≤ Month rate − 10% | DEGRADING |
| Within ±10% | STABLE |
| Only one period has data | INSUFFICIENT_DATA |

**Incident spike alert:** If this week's incident count > 50% of the whole month's incident count, a warning note is appended.

---

## Acceptance Test Result — Q2

> "3 tháng gần đây project nào có nhiều blocker nhất?"

**Mi's answer:** *"Trong 3 tháng qua, 'review-automation' có nhiều blocker nhất (10 blockers — 5 lần fail + 5 incidents)."*

**Blocker ranking (90 days):**

| Rank | Project | Blockers | Success Rate |
|------|---------|----------|-------------|
| 1 | review-automation | 10 | 50% |
| 2 | dashboard | 6 | 80% |
| 3 | mi-core | 5 | 80% |
| 4 | whatsapp-gateway | 1 | 88% |
| 5 | jarvis | 0 | 100% |

---

## Period Summaries

Pre-aggregated table `period_summaries` stores one row per `(period, project)`:
- `total_execs`, `pass_count`, `fail_count`, `incident_count`, `avg_duration_ms`
- Rebuilt on every `syncMemory()` call

---

## API

```
GET /api/memory/trends                      — system snapshot + top blockers + period stats
GET /api/memory/trends?period=week          — filter to a specific period
GET /api/memory/trends/:project             — trend for a specific project
```
