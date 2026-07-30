# Burn-In Daily Report (V2.1 — Source of Truth)
**Date:** 2026-07-14
**Generated:** 2026-07-14T00:59:13.187Z
**Burn-In Score:** 60/100

## System Health (V2.1 — All Metrics Verified)

| Metric | Value | Status |
|--------|-------|--------|
| PM2 Restarts (24h delta) | 0 | ✅ |
| PM2 Restarts (cumulative) | 1 | ℹ️ (informational only) |
| Active Incidents | 4071 | ❌ |
| Incidents (24h total) | 173 | |
| Avg Response Latency | 0ms | ✅ |
| Red Latency Events | 0 | ✅ |

## Connector Live Probes (V2.1 — Actual HTTP/TCP Checks)

| Connector | Status | Latency | Detail |
|-----------|--------|---------|--------|
| Accounting Engine | ❌ | 119ms | Command failed: curl -s -o /dev/null -w "%{http_code}" -X GET --max-time 3 "http://127.0.0.1:8844/st |
| Mi Core Server | ❌ | 5135ms | Command failed: curl -s -o /dev/null -w "%{http_code}" -X GET --max-time 5 "http://127.0.0.1:4001/ap |
| PM2 Process | ✅ | 567ms | PM2 mi-core: status=online, restarts=1, uptime=86411s |
| Qdrant Vector DB | ❌ | 2177ms | Command failed: curl -s -o /dev/null -w "%{http_code}" -X GET --max-time 3 "http://127.0.0.1:6333/co |
| Ollama Embeddings | ❌ | 2191ms | Command failed: curl -s -o /dev/null -w "%{http_code}" -X GET --max-time 3 "http://127.0.0.1:11434/a |
| MinIO Object Storage | ❌ | 2171ms | Command failed: curl -s -o /dev/null -w "%{http_code}" -X GET --max-time 3 "http://127.0.0.1:9000/mi |
| Dashboard (bakudanramen.com) | ❌ | 691ms | Command failed: curl -s --max-time 5 -o /dev/null https://dashboard.bakudanramen.com:443/ |

> **Live probe summary:** 1/7 live | 0 degraded | 6 down

## Memory Architecture (V2.1 — Validated)

| Component | Technology | Status |
|-----------|-----------|--------|
| Session Memory (conversations.db) | SQLite WAL | ✅ Size: 44KB | WAL mode: yes | Modified: 2026-06-30T01:47:21.446Z |
| Knowledge Base Engine | Directory | ✅ 14 files present |
| AI Memory System | Directory | ✅ 1 files present |
| Federated Memory (7 modules) | Directory | ✅ 9 files present |
| Qdrant Vector DB | Qdrant | ⚪ Not running — vector search not available (non-critical) |
| Operations DB (ops.db) | SQLite WAL | ✅ Size: 3080KB | WAL mode: yes | Modified: 2026-07-13T11:10:23.932Z |
| Approval Store (approvals.db) | SQLite | ❌ File not found |
| QB Agent DB | SQLite | ✅ Size: 96KB | WAL mode: unknown | Modified: 2026-07-06T05:49:51.560Z |
| Health DB | SQLite WAL | ✅ Size: 68KB | WAL mode: yes | Modified: 2026-06-13T05:30:54.584Z |

> **Architecture:** 8/9 layers healthy | Overall: HEALTHY

## Approval Source of Truth (V2.1 — Unified)

| Store | Pending | Approved | Rejected | Total |
|-------|---------|----------|----------|-------|
| ops.db (gate.ts) | 5 | 0 | 0 | 5 |
| persistent-store | 0 | 0 | 0 | 0 |
| **Unified Total** | **5** | **0** | **0** | **5** |

> **Consistency:** DEGRADED | Audit log: NOT FOUND | Oldest pending: 355.9h

## Workflow Metrics (Source of Truth: execution ledger)

| Metric | 24h | All-Time |
|--------|-----|----------|
| Total | 15 | 5910 |
| Success | 15 | 928 |
| Failed | 0 | 7 |
| Running | 0 | 206 |
| **Success Rate** | **100%** | **99.25%** |

> **No inferred scoring. No synthetic scoring.** All workflow metrics derived from `workflow_execution_ledger` table.

## Failure Evidence (V2.1 — Structured)

| Severity | Open | In Progress | Resolved |
|----------|------|-------------|----------|
| P0 | 0 | | |
| P1 | 0 | | |
| P2 | 0 | | |
| P3 | 0 | | |
| **Total** | **0** | **0** | **0** |

### Top Failure Reasons
_No failures recorded in 24h._

### By Type
_None_

## Incident Breakdown (Active)

| Severity | Count |
|----------|-------|
| P0 | 0 |
| P1 | 398 |
| P2 | 3674 |
| P3 | 0 |

## Quality Score

| Dimension | Score |
|-----------|-------|
| Overall | **100/100** (EXCELLENT) |
| Context Retention | 100% |
| Action Success | 100% |
| Approval Success | 100% |
| Follow-up Success | 100% |

## Hourly Snapshots (last 24h)

| Time | Restarts | Incidents | Avg Latency | Quality |
|------|----------|-----------|-------------|---------|
| 05:13 | 1 | 3946 | 0ms | 100 |
| 06:13 | 1 | 3958 | 0ms | 100 |
| 07:13 | 1 | 3970 | 0ms | 100 |
| 08:13 | 1 | 3982 | 0ms | 100 |
| 09:25 | 1 | 3993 | 0ms | 100 |
| 10:25 | 1 | 4005 | 0ms | 100 |
| 11:25 | 1 | 4017 | 0ms | 100 |
| 12:25 | 1 | 4029 | 0ms | 100 |
| 13:30 | 1 | 4036 | 0ms | 100 |
| 14:30 | 1 | 4048 | 0ms | 100 |
| 15:30 | 1 | 4060 | 0ms | 100 |
| 00:24 | 1 | 4071 | 0ms | 100 |

## Scoring Breakdown

| Component | Weight | Points |
|-----------|--------|--------|
| Active Incidents | 20 | 0 |
| Latency Red Events | 10 | 10 |
| Quality Score | 15 | 15 |
| Workflow Success Rate | 15 | 15 |
| Connector Live Probes | 15 | 0 |
| Memory Architecture | 10 | 10 |
| Restart Health (24h) | 10 | 10 |
| Approval Consistency | 5 | 0 |
| **TOTAL** | **100** | **60** |

**Verdict:** ⚠️ BURN_IN_DEGRADED
**Monitor Version:** V2.1 — 24h restart delta, connector live probes, memory architecture validation, approval source-of-truth, failure evidence, workflow metrics API
