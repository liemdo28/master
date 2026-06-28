# OSS Coverage Audit — Phase 12–20

Manifest: `mi-core/reports/data/phase-12-20-oss-manifest.json`
Test: `node mi-core/tests/oss-coverage-audit-test.mjs` → **16/16 PASS**

## CTO truth statement (read first)
The Phase 12–20 engines import **only Node builtins + a local JSON store** — every `package.json` has `dependencies: {}` (verified by `grep`). Therefore:

> **OSS is GOVERNED and MAPPED for Phase 12–20, but NOT INTEGRATED into the engine source.**
> Integration reality flag: `EVALUATED_SELECTED_NOT_INTEGRATED`.

This audit certifies **governance** (evaluation, selection, licensing, ownership, lifecycle, rollback) — the Phase 11 "OSS as Strategic Asset" discipline — not runtime integration. We do **not** claim "OSS complete / integrated."

## Governance table

| OSS | Phase | Business role | Owner division | License | License risk | Lifecycle | Status | Integration | Used by | Rejected alternative | Reason |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Langfuse | 12 | observability + trace/approval memory | intelligence | MIT (core) | low | evaluation | SELECTED | NOT_INTEGRATED | outcome/failure/approval memory | OpenTelemetry-only | Langfuse adds eval/memory atop OTel |
| Qdrant | 12 | vector store for decision-replay | intelligence | Apache-2.0 | low | evaluation | SELECTED | NOT_INTEGRATED | DecisionReplayEngine | pgvector / Chroma / LanceDB | standalone + scale; pgvector only if PG mandatory |
| LangGraph | 13 | multi-agent orchestration | engineering | MIT | low | evaluation | SELECTED | NOT_INTEGRATED | dispatch/handoff/review | AutoGen / CrewAI / Dify / Flowise | deterministic, code-first handoffs |
| Temporal | 14 | durable approval workflow | operations | MIT | low | evaluation | SELECTED | NOT_INTEGRATED | propose/approve/reject | n8n / Windmill / Activepieces | durable long-running human signals |
| Keycloak | 14 | approver identity + RBAC | it | Apache-2.0 | low | evaluation | SELECTED | NOT_INTEGRATED | ApprovalPolicy | Ory / Casdoor | mature realms/RBAC |
| OPA | 15 | guardrail policy engine | it | Apache-2.0 | low | evaluation | SELECTED | NOT_INTEGRATED | GuardrailEngine + registry | Cerbos / OpenFGA | general Rego policy |
| Vault | 15 | secrets for action handlers | it | BUSL-1.1 | **medium** | evaluation | SELECTED | NOT_INTEGRATED | SafeActionExecutor | Infisical | Infisical (MIT) is the rollback if BUSL blocks |
| OpenObserve | 15 | autonomy log + telemetry | it | AGPL-3.0 | **medium** | evaluation | SELECTED | NOT_INTEGRATED | AutonomyLog | Uptime Kuma | AGPL flagged; Kuma lighter rollback |
| Metabase | 16 | location KPI dashboards | operations | AGPL-3.0 | **medium** | evaluation | SELECTED | NOT_INTEGRATED | LocationKPILayer | Superset / dbt+DuckDB | fast value; Superset is Apache-2.0 rollback |
| Postgres RLS | 17 | tenant isolation (RLS) | it | PostgreSQL | low | evaluation | SELECTED | NOT_INTEGRATED | TenantIsolation | Hasura / Directus / OpenFGA | isolation at data layer |
| KuzuDB | 18 | embedded property graph | data-platform | MIT | low | evaluation | SELECTED | NOT_INTEGRATED | KnowledgeGraph impact/path | Neo4j / Apache AGE / NetworkX | embedded, no server, Cypher |
| StatsForecast | 19 | time-series forecasting | finance | Apache-2.0 | low | evaluation | SELECTED | NOT_INTEGRATED | ForecastEngine | Prophet / Darts / sktime | fast, well-licensed |
| DuckDB | 19 | in-process analytics | finance | MIT | low | evaluation | SELECTED | NOT_INTEGRATED | ScenarioEngine prep | Polars / Pandas | SQL + parquet zero-copy |
| Temporal | 20 | continuous monitoring orchestration | executive | MIT | low | evaluation | SELECTED | NOT_INTEGRATED | CEOControlPanel runCycle | n8n | durable cross-division schedules |
| OpenFGA | 20 | cross-division authz | executive | Apache-2.0 | low | evaluation | SELECTED | NOT_INTEGRATED | ExecutiveRiskEngine | OPA | relationship-based authority |

## Governance gates (all pass)
- OSS evaluated ✅ · selected ✅ · rejected alternative named ✅
- license recorded ✅ · license risk scored (3 flagged medium: Vault BUSL, OpenObserve/Metabase AGPL) ✅
- owner division assigned ✅ · lifecycle stage assigned (all `evaluation`) ✅
- rollback/replacement defined ✅

## What "complete" requires next (not claimed here)
Per-phase integration PRs that actually import the selected OSS, plus a runtime proof that the engine uses it. Until then OSS for Phase 12–20 = **GOVERNED, NOT INTEGRATED**.
