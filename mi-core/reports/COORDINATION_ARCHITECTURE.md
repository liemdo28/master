# COORDINATION_ARCHITECTURE

## Date: 2026-06-26

## Hierarchy

```
CEO
 ↓
Mi Executive Office (Phase 25A: objective-engine)
 ↓
Executive Coordination Division (Phase 0 — THIS MODULE)
 ↓
├── Engineering (ENG-xxx)
├── Computer Operator (COP-xxx)
├── Finance (FIN-xxx)
├── Marketing (MKT-xxx)
├── IT (IT-xxx)
├── Creative (CRE-xxx)
├── SEO (SEO-xxx)
└── Operations (OPS-xxx)
```

## Module Layout

`mi-core/server/src/executive-coordination/`

| File | Responsibility | Lines |
|---|---|---|
| `types.ts` | Shared types: Division, Priority, CoordinatedTask, DashboardSnapshot | ~100 |
| `task-registry.ts` | Single source of truth for all tasks (JSON storage) | ~150 |
| `objective-registry.ts` | Objective CRUD with OBJ-xxx IDs | ~50 |
| `duplicate-detector.ts` | Jaccard + synonym boost, threshold 0.4 | ~120 |
| `dependency-graph.ts` | Kahn topological sort, cycle detection, chain | ~150 |
| `priority-engine.ts` | P0-P3 auto-classification with regex rules | ~80 |
| `conflict-engine.ts` | Resource, modify-target, cycle conflicts | ~110 |
| `division-router.ts` | Pattern-based division routing | ~50 |
| `evidence-registry.ts` | Per-task evidence JSON store | ~50 |
| `executive-dashboard.ts` | Aggregates all engines into snapshot | ~130 |
| `index.ts` | Main entry, re-exports | ~50 |

**Total: ~1,000 lines across 11 files** (vs. 2,000-line monolith requirement).

## Data Flow

```
CEO objective (text)
    │
    ▼
createRegisteredObjective() → OBJ-001
    │
    ▼
For each required work item:
    routeTask(title) → {division, owner, approvalRequired}
    createTask(params) → ENG-001 / MKT-001 / FIN-001 / IT-001
    │
    ▼
detectDuplicates(allTasks) → similarity scores
detectAllConflicts(allTasks) → conflict pairs
topologicalOrder(allTasks) → execution sequence
    │
    ▼
buildDashboard(allTasks, objective) → snapshot
    │
    ▼
renderAsciiDashboard(snapshot) → CEO-visible output
```

## Storage

- Tasks: `.mi-harness/coordination/tasks/{ID}.json`
- Objectives: `.mi-harness/coordination/objectives/{ID}.json`
- Evidence: `.mi-harness/coordination/evidence/{ID}.json`

Each task file contains full CoordinatedTask object — single source of truth, no DB sync drift.

## Integration Points

| Existing Module | Integration |
|---|---|
| `objective-engine` | Objectives created via both engines — exec-coordination stores its own OBJ-IDs (OBJ-001+) |
| `auto-task-engine` | Signal-driven tasks can be re-classified via `prioritizeTask` and registered via `createTask` |
| `approval/gate.ts` | `task.approvalRequired` references same ApprovalType taxonomy (deploy/merge/financial/payroll/credentials) |
| `evidence-enforcer` | evidence-registry mirrors evidence pattern but groups per-task |
| `graph/ownership-graph.ts` | Advisory layer — exec-coordination tasks have explicit `owner` field |
| `priority-engine` | Standalone — autoClassify() is reused inside task-registry for default priority |

## Why This Design

- **No LLM required** — pure functions + JSON storage. Matches CLAUDE.md rule #4.
- **CommonJS TypeScript** — matches CLAUDE.md rule #5.
- **Storage follows `phase25` convention** — `.mi-harness/coordination/`.
- **Graph layer remains advisory** — no engine blocks execution; matches rule #3.