# PHASE 0A — Source Reality Audit

**Status:** SOURCE_REALITY_AUDIT_COMPLETE
**Date:** 2026-06-26
**Scope:** Master repo + mi-core (Audit of existing task/objective/approval/evidence systems)

## 1. Existing Systems Found

### Task Tables / Files
- `mi-core/server/src/auto-task-engine/index.ts` — auto task creation
- `mi-core/server/src/objective-engine/task-decomposer.ts` — task decomposition
- `mi-core/server/src/task-intelligence/` — task intelligence layer
- `mi-core/server/src/execution/execution-queue.ts` — execution queue
- `.mi-harness/coordination/tasks/*.json` — coordination task store (new, Phase 0)

### Objective Endpoints
- `mi-core/server/src/objective-engine/` — goal classifier, intent analyzer, task decomposer, department mapper
- `mi-core/server/src/ceo-command-center/` — CEO objective command center (Phase 25D)
- `mi-core/server/src/routes/ceo-control.ts` — CEO control center routes

### Approval Endpoints
- `mi-core/server/src/approval/gate.ts` — approval gate engine
- `mi-core/server/src/routes/approval.ts` — approval routes
- `mi-core/server/src/execution/approval-orchestrator.ts` — orchestrator
- `mi-core/server/src/execution/persistent-approval-store.ts` — persistent store
- `mi-core/server/src/routes/mi-review-approvals.ts` — review approvals routes

### Evidence Storage
- `mi-core/server/src/evidence-enforcer/index.ts` — evidence enforcement
- `mi-core/server/src/execution/failure-evidence-store.ts` — failure evidence
- `mi-core/.mi-harness/coordination/evidence/*.json` — Phase 0 evidence store

### Dashboard Widgets
- `mi-core/server/src/agenview/` — AgenView dashboard (Phase 19)
- `mi-core/server/src/executive-briefing/` — executive briefing
- `mi-core/server/src/agenview/agenview-router.ts`

### n8n Workflow Logs
- `mi-core/server/src/n8n/` — n8n integration
- `Mi/n8n/workflows/` — workflow definitions

### GitHub PR Tracking
- `mi-core/server/src/routes/engineering.ts` — engineering division
- `mi-core/server/src/agent-engine/autonomous-coding/PatchEvidenceStore.ts` — PR evidence

### Other Domain Integrations
- GSC: `mi-core/server/src/routes/gsc.ts`
- GA4: `mi-core/server/src/routes/ga4-analytics.ts`
- QuickBooks: `mi-core/server/src/routes/qb-agent.ts`, `qb-financial.ts`
- DoorDash: `mi-core/server/src/routes/doordash-agent.ts`
- Reviews: `Bakudan/review-automation-system/`

## 2. Gaps Identified

| Capability | Existing? | Phase 0 Solution |
|------------|-----------|------------------|
| Single Objective Registry | No (scattered) | ✅ New `objective-registry.ts` |
| Single Task Registry | No (multiple) | ✅ New `task-registry.ts` |
| Ownership Engine | No | ✅ New `ownership-engine.ts` |
| Duplicate Detection | No | ✅ New `duplicate-detector.ts` |
| Dependency Graph | Partial (`dependency-intelligence-report.md`) | ✅ New `dependency-graph.ts` |
| Priority Engine | Partial | ✅ New `priority-engine.ts` |
| Conflict Engine | No | ✅ New `conflict-engine.ts` |
| Centralized Approval | Partial (multiple engines) | ✅ New `approval-registry.ts` |
| Evidence Registry | Partial | ✅ New `evidence-registry.ts` |
| Division Router | Implicit only | ✅ New `division-router.ts` |
| State Machine | Ad-hoc | ✅ Built into `task-registry.ts` |
| Executive Dashboard | Partial | ✅ New `executive-dashboard.ts` |

## 3. Duplicated Concepts

- **Task storage**: existed in multiple isolated systems. **Resolution**: wrap & bridge, do not delete.
- **Approval logic**: present in both `approval/gate.ts` and `routes/approval.ts`. **Resolution**: keep both; Phase 0 registry is the central source of truth for *audit trail*, existing `gate.ts` continues to handle live workflows.
- **Evidence**: existed in `evidence-enforcer/` for gating. **Resolution**: Phase 0 `evidence-registry.ts` stores evidence centrally, `evidence-enforcer/` continues to gate task closure.

## 4. Obsolete Implementations

None flagged for removal. All existing engines will be wrapped, not deleted.

## 5. Source of Truth Recommendation

| Layer | Source of Truth |
|-------|-----------------|
| Objectives | `executive-coordination/objective-registry.ts` |
| Tasks | `executive-coordination/task-registry.ts` |
| Approvals | `executive-coordination/approval-registry.ts` |
| Evidence | `executive-coordination/evidence-registry.ts` |
| Decisions/Routing | `executive-coordination/{ownership,priority,conflict}-engine.ts` |

All other systems bridge into these via `runCoordinationPipeline()`.

## 6. Final Status

**SOURCE_REALITY_AUDIT_COMPLETE** — Phase 0 layer ready to be built on top of existing systems.