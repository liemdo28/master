# DEV4 — V4 BURN-IN MONITOR V2 REPORT

**Date:** 2026-06-15
**Target:** BURNIN_MONITOR_TRUSTED
**Status:** ✅ ACHIEVED

---

## Executive Summary

The burn-in monitor has been upgraded from V1 (untrusted, inflated metrics) to V2.1 (verified, evidence-based). Every scoring dimension now traces to a real data source — no inferred scoring, no synthetic data, no registry assumptions.

**Key changes:**
1. **Restart metric fixed** — Uses 24h delta instead of cumulative PM2 count
2. **Connector probes are live** — Actual HTTP/TCP/PM2 checks, not registry status
3. **Memory architecture validated** — No phantom stores inflating scores
4. **Approval source unified** — Single authoritative count across all stores
5. **Failure evidence tracked** — Structured, securable, remediation-trackable

---

## M1 — Restart Metric (FIXED)

### Before (V1)
- **Problem:** Cumulative `pm2_restarts` count used — monotonically increasing over entire lifecycle
- **Impact:** 1162 lifetime restarts looked identical to 0 restarts in 24h
- **Score inflation:** Crash-loop days scored as healthy

### After (V2.1)
- **Solution:** `get24hRestartDelta()` computes `currentRestarts - baselineFrom24hAgo`
- **Baseline:** Earliest `burnin_snapshots.pm2_restarts` record in the last 24h window
- **Fallback:** If no baseline exists, uses current cumulative count (conservative)

### Evidence
```
File: server/src/operations/burn-in.ts
Function: get24hRestartDelta()
Table: burnin_snapshots (captures hourly baseline)
```

### Scoring: 10 points
| Restarts (24h) | Score |
|----------------|-------|
| < 5            | 10/10 |
| 5-19           | 5/10  |
| ≥ 20           | 0/10  |

---

## M2 — Connector Live Probes (NEW)

### Before (V1)
- **Problem:** Registry assumed status from `connector-registry.json` — stale data, no live checks
- **Impact:** "Accounting engine down" when engine was always live (connector had wrong route)

### After (V2.1)
- **Solution:** `connector-live-probes.ts` makes actual HTTP/TCP/exec checks
- **Probes:** Accounting engine (port 8844), Mi Core Server (port 4001), PM2 process, Qdrant, Ollama, MinIO, Dashboard TLS

### Probes Implemented
| Connector | Check Type | Target |
|-----------|-----------|--------|
| Accounting Engine | HTTP GET | `http://127.0.0.1:8844/stats` |
| Mi Core Server | HTTP GET | `http://127.0.0.1:4001/api/operations/status` |
| PM2 Process | exec `pm2 jlist` | Process status + uptime |
| Qdrant | HTTP GET | `http://127.0.0.1:6333/collections` |
| Ollama | HTTP GET | `http://127.0.0.1:11434/api/tags` |
| MinIO | HTTP GET | `http://127.0.0.1:9000/minio/health/live` |
| Dashboard | TCP/TLS | `dashboard.bakudanramen.com:443` |

### Evidence
```
File: server/src/operations/connector-live-probes.ts
API: GET /api/workflows/connector-probes
Report: Burn-In Daily Report "Connector Live Probes" section
```

### Scoring: 15 points
| Probes | Score |
|--------|-------|
| All live | 15/15 |
| Degraded (HTTP 4xx) | -2 per probe |
| Down (HTTP 5xx/timeout) | -5 per probe |

---

## M3 — Memory Architecture Validation (NEW)

### Before (V1)
- **Problem:** Monitor assumed memory health based on conversations.db alone — didn't validate the full architecture
- **Impact:** Couldn't detect missing KB, absent federated memory, or phantom Qdrant stores

### After (V2.1)
- **Solution:** `memory-architecture-validator.ts` checks every layer:
  - Session memory (conversations.db + WAL)
  - KB engine (KBDatabase.js, KBQuery.js, KnowledgeBase.js)
  - AI Memory System (AIMemorySystem.js)
  - Federated memory (7 modules verified)
  - Qdrant (optional — reports status whether present or not)
  - Operational stores (ops.db, approvals.db, qb-agent.db, health.db)

### Evidence
```
File: server/src/operations/memory-architecture-validator.ts
API: GET /api/workflows/memory-arch
Report: Burn-In Daily Report "Memory Architecture" section
```

### Scoring: 10 points
| Status | Score |
|--------|-------|
| HEALTHY | 10/10 |
| DEGRADED | 5/10 |
| CRITICAL (>1 absent) | 0/10 |

---

## M4 — Approval Source of Truth (FIXED)

### Before (V1)
- **Problem:** Three surfaces queried different stores → counts diverged (WhatsApp=0, Briefing=0, Status=19)
- **Impact:** P1 failure — approval count mismatch across surfaces

### After (V2.1)
- **Solution:** `approval-source-of-truth.ts` reads BOTH:
  - `ops.db` approval_queue (gate.ts)
  - `approval-store/approvals.db` (persistent-approval-store.ts)
- **Unified counts:** `pending_total`, `approved_total`, `rejected_total`
- **Consistency check:** Detects divergence between stores
- **Audit log verification:** Checks if action audit log exists and has entries

### Evidence
```
File: server/src/operations/approval-source-of-truth.ts
API: GET /api/workflows/approval-truth
Report: Burn-In Daily Report "Approval Source of Truth" section
```

### Scoring: 5 points
| Consistency | Score |
|-------------|-------|
| CONSISTENT | 5/5 |
| DIVERGENT | 0/5 |

---

## Scoring Model (V2.1)

| Component | Weight | Source |
|-----------|--------|--------|
| Active Incidents | 20 pts | incident-center.ts |
| Latency Red Events | 10 pts | latency-monitor.ts |
| Quality Score | 15 pts | quality-metrics.ts |
| Workflow Success Rate | 15 pts | workflow-execution-ledger (V2) |
| **Connector Live Probes** | **15 pts** | **connector-live-probes.ts (NEW)** |
| **Memory Architecture** | **10 pts** | **memory-architecture-validator.ts (NEW)** |
| Restart Health (24h) | 10 pts | burn-in.ts get24hRestartDelta() (FIXED) |
| **Approval Consistency** | **5 pts** | **approval-source-of-truth.ts (NEW)** |
| **TOTAL** | **100 pts** | |

---

## Files Created/Modified

### New Files (DEV4)
| File | Purpose |
|------|---------|
| `server/src/operations/connector-live-probes.ts` | Live HTTP/TCP/exec probes for all connectors |
| `server/src/operations/memory-architecture-validator.ts` | Validates all memory layers exist and function |
| `server/src/operations/approval-source-of-truth.ts` | Unified approval counts across both stores |

### Modified Files (DEV4)
| File | Change |
|------|--------|
| `server/src/operations/burn-in.ts` | V2.1 — integrated all new modules, new scoring model |
| `server/src/operations/self-healing.ts` | Fixed `detectRestartStorm()` to use 24h delta |

---

## API Endpoints (New in V2.1)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/workflows/connector-probes` | GET | Live connector probe results |
| `/api/workflows/memory-arch` | GET | Memory architecture validation report |
| `/api/workflows/approval-truth` | GET | Unified approval state across all stores |

---

## How the Monitor Is Now Trustworthy

| V1 Problem | V2.1 Fix | Verification |
|-----------|----------|-------------|
| Cumulative restart count | 24h delta via burnin_snapshots baseline | `get24hRestartDelta()` |
| Registry assumptions for connectors | Live HTTP/TCP probes | `probeAllConnectors()` |
| No memory validation | 9-component architecture check | `validateMemoryArchitecture()` |
| Approval count mismatch | Dual-store unified reader | `getApprovalSourceOfTruth()` |
| No failure tracking | Structured evidence store with remediation | `failure-evidence-store.ts` |

**Target: BURNIN_MONITOR_TRUSTED ✅**
