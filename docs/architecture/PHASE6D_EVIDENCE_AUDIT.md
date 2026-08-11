# Phase 6D Evidence/Audit Component Audit

Baseline: `origin/master` at `6b8e37e38c963abc1fa2097523c322ffbfed5944` (Phase 6C frozen).
Audit performed against a clean, isolated worktree — the concurrent, unrelated production
checkout was never used as a source.

## Scope decision

The directive lists exactly these subsystems for the canonical evidence contract:
Personal OS, Knowledge OS, Operating Loop, Controlled Actions, Governance, Orchestration,
Delegation, Task Runtime, Project Registry, Phase 6A authority, Phase 6B legacy adapters,
Phase 6C operator read model, health/self-heal, coding evidence. This audit found four
additional, unrelated evidence-shaped subsystems elsewhere in the monorepo —
`company-os/evidence-store.ts` (`executions`/`pipeline_runs`), `engineering/evidence-engine.ts`,
`gstack/evidence-engine.ts` + `gstack/evidence/evidence-generator.ts`, and
`executive-intelligence`'s SQL-migration tables (`decision_records`, `evidence_packets`,
`qa_gates`). None of these are part of the Mi Personal OS / governance lineage the directive
names, none are reachable from Command Center, and consolidating them would be a large,
unauthorized scope expansion beyond what Phase 6D asked for.

**Decision: these four lineages are explicitly OUT OF SCOPE for Phase 6D.** They are
flagged here for future awareness only. The canonical evidence contract covers exactly the
Personal OS / Mi Assistant governance lineage the directive names.

## No pre-existing canonical evidence abstraction

Confirmed by exact-name search across `server/src`: no `EvidenceRef`, no shared
`EvidenceRecord`/`EvidenceClaim` contract exists anywhere in the in-scope lineage. The
evidence-log *pattern* (`id, ownerId, eventType, summary, metadataJson, actor, createdAt`)
was independently reinvented four times — `action_evidence` (5F), `action_plan_evidence`
(5H), `delegation_events` (5I), and `governance_events` (5G) — with `governance_events`
additionally reused by Phase 6B's legacy adapter rather than a fifth reinvention. This is
the direct precedent Phase 6D follows: reuse an existing sink where the shape already
fits, add one new canonical contract only where none exists, never create a second
evidence database.

## In-scope subsystem classification

| Subsystem | File(s) | Table(s) | What it records | Classification |
|---|---|---|---|---|
| Controlled Actions evidence (5F) | `personal-os/actions/store.ts`, `types.ts` | `action_evidence` | Append-only event log per proposal (eventType/summary/payloadHash/metadata/actor) | **CANONICAL** — reference shape; later phases link back via `evidenceReferences` rather than duplicating |
| Governance decisions/events/anomalies (5G) | `personal-os/actions/governance/{schema,types,audit}.ts` | `policy_decisions`, `governance_events`, `governance_anomalies`, `action_budgets`, `kill_switches`, `project_action_policies` | Immutable per-decision record; generic append-only audit trail (already reused by 6B); anomaly/health-like findings | **CANONICAL** for decision/audit-trail/anomaly category; `governance_events` is the de-facto shared system-event sink |
| Orchestration plan evidence (5H) | `personal-os/orchestration/{schema,types}.ts` | `action_plan_evidence` (+ plan/step/run tables) | Same evidence-log shape, scoped to planId/stepId; deliberately never redefines Phase 5F/5G shapes | **OVERLAPPING** with `action_evidence` — third re-implementation of the identical evidence-log pattern |
| Delegation events/decisions (5I) | `personal-os/delegation/{schema,types}.ts` | `delegated_authorities`, `delegation_versions`, `delegation_decisions`, `delegation_quota_usage`, `delegation_events` | Eligibility decision record; append-only evidence log (fourth reinvention) | **OVERLAPPING** with `action_evidence`/`action_plan_evidence`; `delegation_decisions` **OVERLAPPING** with `policy_decisions` |
| Knowledge OS / documents (5D-2) | `personal-os/documents/types.ts`, `store.ts` | `knowledge_conflicts`, `knowledge_relations` (+ documents/chunks) | `Citation` = precise pointer-to-source-range; `FactType = FACT\|SYNTHESIS\|SUGGESTION\|UNKNOWN`; `ConflictRecord`; typed `CONTRADICTS`/`SUPERSEDES` relations | **CANONICAL** for citation/fact-provenance and conflict semantics — richest, most precise model in the codebase; the direct template for the new contract's fact/inference/unknown split |
| Operating Loop (5D-3) | `personal-os/operating/{types,health}.ts` | `daily_operating_briefs`, `daily_plans`, `daily_refreshes`, `end_of_day_reviews`, `weekly_operating_reviews`, `operating_loop_runs` | Every read model carries loose `evidenceReferences: string[]` + facts/suggestions/unknowns triads; `TRUTH_PRIORITY` const is documented evidence-source precedence; health computed live, never persisted | **ADAPTER** — aggregates evidence from Task Runtime/Documents/Project Registry/SelfHeal; its loose string refs are exactly what the new `EvidenceRef` should replace |
| Task Runtime | `task-runtime/store.ts`, `types.ts` | `tasks`, `task_events` (+ filesystem `evidence/<taskId>/*.json`) | Generic per-task append-only event log; raw command output stored as path-guarded on-disk blobs | **OVERLAPPING/ADAPTER** — event log duplicates the pattern again; the on-disk blob tier is a distinct storage need the new contract must account for (evidence record with an external blob pointer) |
| Project Registry | `project-registry/store.ts` | `projects`, `project_maps`, `resume_contexts`, `context_packs` | Pure state/config store; `mapStatus` feeds Operating Loop health | **N/A (not evidence)** — a data source other subsystems read, not an evidence store |
| Authority Control Plane (6A) | `authority-control-plane/{types,registry,scanner,generate-manifest}.ts` | none — in-memory manifest regenerated per call | Classifies every route/CLI surface into `AuthorityClass`/`EffectClass`; each surface carries `evidence: string[]` (source-code citations) | **CANONICAL** for surface classification, but evidence-*like* rather than a persisted evidence record — never written to a table |
| Legacy Adapters / Quarantine (6B) | `authority-control-plane/legacy-adapter.ts` | writes into `governance_events` (no new table) | Classifies `phase6bDisposition`; records `legacy.adapter.mapped`/`legacy.quarantine.blocked`/etc. | **ADAPTER** — the one place in the codebase that deliberately reuses an existing sink instead of inventing one; direct precedent for Phase 6D |
| Operator Control Center (6C) | `operator-control/{types,service}.ts` | none — live-computed snapshot | Normalizes six sources into one `OperatorItem` shape (`state`, `urgency`, `blockedReason`, `risk`, `authority`, `evidenceRefs: string[]`) | **CANONICAL read-model/aggregator** — not a new evidence source, but the strongest existing template for the Evidence/Audit UI's read model; currently ephemeral, not persisted |
| Health / Self-Healing | `company-os/self-healing-monitor.ts`, consumed by `personal-os/operating/health.ts` | none — probed live (PM2/HTTP), never persisted | `ServiceHealth`/`ProjectHealth` with `reason`/`evidenceReference` | **CANONICAL** for health category, but ephemeral — no history/trend persisted anywhere |
| Coding / Agentic Coding | `coding/{types,reviewer,validation-runner}.ts` | none dedicated — piggybacks on Task Runtime's `tasks` row (free-text JSON columns) and `evidenceDir` | `ValidationResult`, `ValidationArtifactReport`, untyped `EngineApplyResult.evidence: Record<string,unknown>` | **ADAPTER** — weakest-typed evidence surface found; no typed contract of its own |

## Distinct in-scope SQLite tables carrying evidence-like data

`action_evidence` · `policy_decisions` · `governance_events` · `governance_anomalies` ·
`action_plan_evidence` · `delegation_decisions` · `delegation_quota_usage` ·
`delegation_events` · `knowledge_conflicts` · `knowledge_relations` · `goal_events` ·
`task_events`

Plus three ephemeral, non-persisted evidence-shaped surfaces: `authority-control-plane`'s
in-memory manifest `evidence[]`, `operator-control`'s live `OperatorItem.evidenceRefs[]`,
and Task Runtime's on-disk `evidenceDir` blob tier.

## Design implications carried into 6D.2

1. **No new evidence database.** The canonical `EvidenceRecord` contract is a shared
   TypeScript type + a thin persistence layer that existing tables can be *read through*
   uniformly; it does not replace `action_evidence`/`governance_events`/etc. Each existing
   table becomes a `sourceSystem`-tagged origin the canonical reader normalizes, exactly as
   Phase 6C's `OperatorControlService` already does across six sources.
2. **`evidenceReferences: string[]` becomes a typed `EvidenceRef`** (sourceSystem + sourceId
   + optional locator) everywhere it's currently a loose string, without changing any
   existing table's storage — the reference type is additive tooling around existing IDs.
3. **`Citation`/`FactType` (Knowledge OS) is the direct template for FACT/INFERENCE/
   ASSUMPTION/UNKNOWN** categories in the new contract — lifted up, not reinvented.
4. **Operator Control's live-aggregation pattern is reused** for the new Evidence/Audit
   Command Center surface (6D.10), reading through the canonical contract rather than a
   seventh bespoke store.
5. **No v11 migration is required.** Every category the contract needs already has a home;
   the contract is a read/normalize layer over existing v10 tables, not new storage.
