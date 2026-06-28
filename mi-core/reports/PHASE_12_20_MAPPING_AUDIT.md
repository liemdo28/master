# Phase 12–20 — Mapping Audit

Verifies, per phase: Division · Agent · OSS · Workflow · Evidence · Approval policy · Business object. Mappings match the CEO directive's required Phase→Division assignments.

| Phase | Division(s) | Agent / orchestrator | OSS (governed) | Workflow trigger | Evidence store | Approval policy | Business object |
|---|---|---|---|---|---|---|---|
| 12 | Intelligence · IT · Engineering | `SelfImprovingIntelligence` | Langfuse, Qdrant | failure/outcome observed | `failure-memory`, `learning-scorecard` | advisory (learn-only, no mutation) | Failure / Recommendation / Playbook |
| 13 | Engineering · Operations · Marketing · Creative | `MultiAgentWorkforce` | LangGraph | task dispatch | team / review / handoff stores | n/a (assignment only) | Agent / Task / Review / Handoff |
| 14 | Executive · Operations · Finance | `HITLAutonomy` | Temporal, Keycloak | action proposed | drafts / audit-trail / rejection-learning | **risk-tier gate** (TRIVIAL→auto … SEVERE→approval+rollback) | Action draft / Approval / Rollback plan |
| 15 | IT · Operations · Executive | `AutonomousOps` | OPA, Vault, OpenObserve | approved action to execute | `autonomy-log`, action registry | whitelist + guardrails + kill switch | Autonomous action / Guardrail / Rollback |
| 16 | Operations · Finance · Marketing | `MultiLocationOS` | Metabase | KPI observation | brands / locations / kpi / permissions | location-scoped permission | Brand / Location / KPI / Risk |
| 17 | Executive · IT · Finance | `FranchiseOS` | Postgres RLS | franchisee onboard / metric ingest | companies / template / metrics / isolation-log | company-scoped permission + tenant isolation | Company / Template / Tenant metrics |
| 18 | Data Platform · Intelligence · Executive | `KnowledgeGraph` | KuzuDB | entity/relationship add | entities / relationships / impact | advisory (read/impact only) | Entity / Relationship / Impact set |
| 19 | Finance · Marketing · Executive | `ExecutiveSimulation` | StatsForecast, DuckDB | run decision | assumptions / scenarios / forecasts | advisory (simulation only) | Assumption / Scenario / Decision ranking |
| 20 | Executive · **All Divisions** | `CEOControlPanel` | Temporal, OpenFGA | objective set / cycle run | exec-objective/plan/risk/monitor/optimizer | kill-switch authority + posture | Objective / Plan / Posture / Escalation |

## Required mapping check (directive)
| Required | Result |
|---|---|
| Phase 12 → Intelligence / IT / Engineering | ✅ match |
| Phase 13 → Engineering / Operations / Marketing / Creative | ✅ match |
| Phase 14 → Executive / Operations / Finance | ✅ match |
| Phase 15 → IT / Operations / Executive | ✅ match |
| Phase 16 → Operations / Finance / Marketing | ✅ match |
| Phase 17 → Executive / IT / Finance | ✅ match |
| Phase 18 → Data Platform / Intelligence / Executive | ✅ match |
| Phase 19 → Finance / Marketing / Executive | ✅ match |
| Phase 20 → Executive / All Divisions | ✅ match |

## Cross-reference integrity
- **Phase → Agent**: every phase has exactly one default-export orchestrator class (verified in `phase12-20-functional-proof-test.mjs`).
- **Phase → OSS**: every phase has ≥1 SELECTED OSS in the manifest (verified in `oss-coverage-audit-test.mjs`). Integration = NOT_INTEGRATED (honest).
- **Phase → Evidence**: every phase persists to named JSON stores that survive restart (proven in each runtime-proof).
- **Phase → Approval policy**: write-capable phases (14, 15, 17, 20) carry an explicit gate; read/learn-only phases (12, 18, 19) are advisory by design — consistent with the "Graph layer is ADVISORY" rule.

**Mapping status: COMPLETE and CONSISTENT.**
