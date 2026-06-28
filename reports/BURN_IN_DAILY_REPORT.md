# Burn-In Daily Report (V2.1 — Source of Truth)
**Date:** 2026-06-28
**Generated:** 2026-06-28T12:29:23.500Z
**Burn-In Score:** 40/100

## System Health (V2.1 — All Metrics Verified)

| Metric | Value | Status |
|--------|-------|--------|
| PM2 Restarts (24h delta) | 0 | ✅ |
| PM2 Restarts (cumulative) | 37 | ℹ️ (informational only) |
| Active Incidents | 944 | ❌ |
| Incidents (24h total) | 545 | |
| Avg Response Latency | 0ms | ✅ |
| Red Latency Events | 0 | ✅ |

## Connector Live Probes (V2.1 — Actual HTTP/TCP Checks)

| Connector | Status | Latency | Detail |
|-----------|--------|---------|--------|
| Accounting Engine | ❌ | 2145ms | Command failed: curl -s -o /dev/null -w "%{http_code}" -X GET --max-time 3 "http://127.0.0.1:8844/st |
| Mi Core Server | ❌ | 5112ms | Command failed: curl -s -o /dev/null -w "%{http_code}" -X GET --max-time 5 "http://127.0.0.1:4001/ap |
| PM2 Process | ✅ | 503ms | PM2 mi-core: status=online, restarts=37, uptime=86415s |
| Qdrant Vector DB | ❌ | 2114ms | Command failed: curl -s -o /dev/null -w "%{http_code}" -X GET --max-time 3 "http://127.0.0.1:6333/co |
| Ollama Embeddings | ❌ | 111ms | Command failed: curl -s -o /dev/null -w "%{http_code}" -X GET --max-time 3 "http://127.0.0.1:11434/a |
| MinIO Object Storage | ❌ | 2246ms | Command failed: curl -s -o /dev/null -w "%{http_code}" -X GET --max-time 3 "http://127.0.0.1:9000/mi |
| Dashboard (bakudanramen.com) | ❌ | 1888ms | Command failed: curl -s --max-time 5 -o /dev/null https://dashboard.bakudanramen.com:443/ |

> **Live probe summary:** 1/7 live | 0 degraded | 6 down

## Memory Architecture (V2.1 — Validated)

| Component | Technology | Status |
|-----------|-----------|--------|
| Session Memory (conversations.db) | SQLite | ❌ File not found |
| Knowledge Base Engine | Directory | ✅ 14 files present |
| AI Memory System | Directory | ✅ 1 files present |
| Federated Memory (7 modules) | Directory | ✅ 9 files present |
| Qdrant Vector DB | Qdrant | ⚪ Not running — vector search not available (non-critical) |
| Operations DB (ops.db) | SQLite WAL | ✅ Size: 2212KB | WAL mode: yes | Modified: 2026-06-28T12:29:06.726Z |
| Approval Store (approvals.db) | SQLite | ❌ File not found |
| QB Agent DB | SQLite | ❌ File not found |
| Health DB | SQLite WAL | ✅ Size: 68KB | WAL mode: yes | Modified: 2026-06-13T05:30:54.584Z |

> **Architecture:** 6/9 layers healthy | Overall: CRITICAL

## Approval Source of Truth (V2.1 — Unified)

| Store | Pending | Approved | Rejected | Total |
|-------|---------|----------|----------|-------|
| ops.db (gate.ts) | 0 | 0 | 0 | 0 |
| persistent-store | 0 | 0 | 0 | 0 |
| **Unified Total** | **0** | **0** | **0** | **0** |

> **Consistency:** CONSISTENT | Audit log: NOT FOUND | Oldest pending: none

## Workflow Metrics (Source of Truth: execution ledger)

| Metric | 24h | All-Time |
|--------|-----|----------|
| Total | 0 | 5670 |
| Success | 0 | 690 |
| Failed | 0 | 7 |
| Running | 0 | 206 |
| **Success Rate** | **0%** | **99%** |

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
| P1 | 0 |
| P2 | 953 |
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
| 00:42 | 37 | 690 | 0ms | 100 |
| 01:42 | 37 | 714 | 0ms | 100 |
| 02:42 | 37 | 738 | 0ms | 100 |
| 03:42 | 37 | 762 | 0ms | 100 |
| 04:45 | 37 | 782 | 0ms | 100 |
| 05:45 | 37 | 806 | 0ms | 100 |
| 06:45 | 37 | 830 | 0ms | 100 |
| 07:45 | 37 | 854 | 0ms | 100 |
| 08:47 | 37 | 872 | 0ms | 100 |
| 09:47 | 37 | 896 | 0ms | 100 |
| 10:47 | 37 | 920 | 0ms | 100 |
| 11:47 | 37 | 944 | 0ms | 100 |

## Scoring Breakdown

| Component | Weight | Points |
|-----------|--------|--------|
| Active Incidents | 20 | 0 |
| Latency Red Events | 10 | 10 |
| Quality Score | 15 | 15 |
| Workflow Success Rate | 15 | 0 |
| Connector Live Probes | 15 | 0 |
| Memory Architecture | 10 | 0 |
| Restart Health (24h) | 10 | 10 |
| Approval Consistency | 5 | 5 |
| **TOTAL** | **100** | **40** |

**Verdict:** ❌ BURN_IN_CRITICAL
**Monitor Version:** V2.1 — 24h restart delta, connector live probes, memory architecture validation, approval source-of-truth, failure evidence, workflow metrics API
