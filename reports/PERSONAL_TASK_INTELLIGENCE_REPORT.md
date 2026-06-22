# Personal Task Intelligence — Integration Report
**Phase 16 v2 Final Report**
**Date: 2026-06-13**
**Status: PERSONAL_TASK_INTELLIGENCE_READY**

---

## Problem Solved

CEO asks *"Hôm nay anh có task gì?"* and previously falls through the AI engine, getting a generic response. Phase 16 intercepts this class of questions before they reach the LLM and returns precise, real-time operational data.

---

## Architecture

```
CEO: "Hôm nay anh có task gì?"
         ↓
  processGStackRequest()
         ↓
  [Phase 16 fast-path] ← injected at top, before work order creation
  dispatchTaskQuery()
         ↓ match
  TaskQueryEngine          →  answer_vi (Vietnamese, WhatsApp-ready)
  TaskDataCollector        →  reads: work-orders/, ledger.jsonl, memory.db, graph.db
         ↓ no match
  [existing pipeline continues — PM Agent → execution]
```

**No LLM call. No work order created. Response in <50ms.**

---

## Data Sources (v2)

| Source | Reader | Purpose |
|--------|--------|---------|
| `work-orders/*.json` | `readOpenWorkOrders()` | Open/in-progress work |
| `execution-ledger/ledger.jsonl` | `readRecentTeamActivity()` | 24h team actions |
| `operational-memory/memory.db` | `readOpenBlockers()` | Unresolved incidents |
| `approval gate` (in-memory) | `readPendingApprovals()` | CEO approvals pending |
| `skills/certifications.json` | `readCertificationsPending()` | BETA skills awaiting review |
| `reminders store` | `readActiveReminders()` | Active reminders |
| **`graph/graph.db`** | **`readGraphRisks()`** | **Phase 14 SPOF + criticality** |

---

## Query Dispatch Table (v2)

| Intent | Pattern | Handler |
|--------|---------|---------|
| Q1 | `hom nay.*task`, `co task`, `anh co task` | `queryTodayTasks()` |
| Q2 (approvals) | `can anh duyet`, `co gi.*duyet`, `phe duyet` | `queryPendingApprovals()` |
| Q2b (waiting) | `dang cho`, `cho.*anh`, `co gi.*cho` | `queryWaitingForCeo()` |
| Q3 | `team.*dang`, `dang lam gi`, `ai dang` | `queryTeamActivity()` |
| Q4 | `blocker`, `co blocker`, `bi block` | `queryBlockers()` |
| Q5 | `dang lo`, `lo khong`, `co gi.*lo`, `rui ro` | `queryConcerns()` |

**Priority order**: Q1 → Q2 → Q2b → Q3 → Q4 → Q5 → null (falls through to AI)

---

## Key Functions

### `queryPendingApprovals()` (NEW in v2)
Dedicated approval query: reads `approval_gate.getPending()` + `certifications.json` BETA skills ready for promotion. Returns Vietnamese answer with ✋ approval items and 📋 certification items.

### `queryConcerns()` (ENRICHED in v2)
Now reads `graph_risks` from snapshot:
1. **Operational section** — P0/P1 work orders and stuck blockers
2. **SPOF section** — entities with ≥2 high-weight inbound `depends_on` edges (from Phase 14 SPOF formula)
3. **High-risk section** — entities with criticality_score ≥ 50 but not SPOF

### `readGraphRisks()` (NEW in v2)
```sql
SELECT e.id, e.name,
       COUNT(ed.id) as in_degree,
       AVG(ed.weight) as avg_weight,
       (COUNT(CASE WHEN ed.weight >= 8 THEN 1 END) >= 2) as is_spof
FROM entities e
LEFT JOIN edges ed ON ed.to_id = e.id AND ed.relationship = 'depends_on'
WHERE e.type NOT IN ('owner', 'team', 'repository')
GROUP BY e.id HAVING in_degree > 0
ORDER BY in_degree DESC, avg_weight DESC LIMIT 10
```

Returns gracefully empty if `graph.db` doesn't exist.

---

## REST API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tasks/snapshot` | Full operational snapshot |
| GET | `/api/tasks/today` | Q1: today's tasks |
| GET | `/api/tasks/approvals` | Q2: pending approvals (NEW) |
| GET | `/api/tasks/waiting` | Q2b: anything waiting for CEO |
| GET | `/api/tasks/blockers` | Q4: open blockers |
| GET | `/api/tasks/concerns` | Q5: concerns + graph SPOF |
| GET | `/api/tasks/team` | Q3: team activity |
| POST | `/api/tasks/query` | Natural language dispatch |

---

## Files

| File | Role |
|------|------|
| `server/src/task-intelligence/task-data-collector.ts` | Data sources + `OperationalSnapshot` builder |
| `server/src/task-intelligence/task-query-engine.ts` | 6 query functions + dispatcher |
| `server/src/task-intelligence/task-intelligence-router.ts` | Express router, 8 routes |
| `server/src/gstack/task-intelligence/task-query-engine-shim.ts` | Lazy-require shim |
| `server/src/gstack/gstack-orchestrator.ts` | Fast-path injection |
| `server/src/gstack/intent-router.ts` | `query_personal_tasks` intent + 10 patterns |
| `tests/phase16b-acceptance-test.mjs` | v2 acceptance test — 22/22 gates |

---

## Critical Constraints (unchanged from v1)

- **Advisory only** — graph layer is read-only intelligence, never modifies execution
- **No LLM required** — entire phase runs synchronously on SQLite + JSON reads
- **No modification** to: `/api/execution-package`, Dev3 Role Engine, Dev3 Skill Engine, Dev3 Approval Engine
- **Circular import prevention** — gstack-orchestrator uses lazy `require()` via shim

---

## Acceptance Test Results (v2)

```
Test: tests/phase16b-acceptance-test.mjs
Date: 2026-06-13
Result: 22/22 PASS

Q1 "Hôm nay anh có task gì?"
  → Returns real work orders + blockers, Vietnamese format, priority ranking ✅

Q2 "Có gì cần anh duyệt không?"
  → Returns approval gate items + BETA certifications ready for promotion ✅

Q3 "Có gì đáng lo không?"
  → Returns operational concerns + Graph Intelligence SPOF warnings ✅
  → Mi-Core identified as SPOF (5 dependents, criticality 100/100) ✅
  → PM2 Process Manager identified as SPOF (criticality 80/100) ✅

Routing: 8/8 — non-task queries NOT intercepted ✅
```

---

## Integration with Phase 14 (Graph Intelligence)

Phase 16 v2 consumes Phase 14's graph adjacency data at query time:

```
Phase 14 output: graph.db (entities + edges)
                      ↓
Phase 16 reader: readGraphRisks()
                      ↓
Phase 16 query:  queryConcerns() → CEO sees SPOF warnings in context
```

This delivers the "Graph Intelligence as advisory layer" goal from Phase 14 — the CEO OS surfaces structural risk without any dedicated graph query.

---

**PERSONAL_TASK_INTELLIGENCE_READY — Phase 16 v2 certified 2026-06-13**
