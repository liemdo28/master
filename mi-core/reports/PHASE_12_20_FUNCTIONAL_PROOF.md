# Phase 12–20 — Functional Proof

Test: `node mi-core/tests/phase12-20-functional-proof-test.mjs` → **38/38 PASS** (aggregates all 207 phase runtime tests + orchestrator surface checks).

| Phase | Name | Objective | Route | Runtime module | Test file | Tests | OSS dependency (governed) | Business value | Status |
|---|---|---|---|---|---|---|---|---|---|
| 12 | Self-Improving Intelligence | Learn from every failure/outcome; recommend, never mutate | `/api/agent-os/12` | `phase-12.../src/orchestrator.js` | `phase-12.../test/runtime-proof.mjs` | 26/26 | Langfuse, Qdrant | Compounding learning loop → fewer repeat failures | READY · OSS PARTIAL |
| 13 | Multi-Agent Workforce | Route work to best-fit agent; review + handoff | `/api/agent-os/13` | `phase-13.../src/orchestrator.js` | `phase-13.../test/runtime-proof.mjs` | 19/19 | LangGraph | Scalable agent labor with quality gates | READY · OSS PARTIAL |
| 14 | HITL Autonomy | Risk-tier gate; human approves before risky acts | `/api/agent-os/14` | `phase-14.../src/orchestrator.js` | `phase-14.../test/runtime-proof.mjs` | 28/28 | Temporal, Keycloak | Safe autonomy with audited human control | READY · OSS PARTIAL |
| 15 | Safe Autonomous Ops | Single safe choke point; guardrails + kill switch + rollback | `/api/agent-os/15` | `phase-15.../src/orchestrator.js` | `phase-15.../test/runtime-proof.mjs` | 26/26 | OPA, Vault, OpenObserve | Execute autonomously without blowing up | READY · scorecard PARTIAL · OSS PARTIAL |
| 16 | Multi-Location OS | Per-location KPIs, permissions, risk, fleet rollup | `/api/agent-os/16` | `phase-16.../src/orchestrator.js` | `phase-16.../test/runtime-proof.mjs` | 24/24 | Metabase | Run many stores from one pane | READY · OSS PARTIAL |
| 17 | Franchise / Multi-Company OS | Tenant isolation, templates, HQ rollup | `/api/agent-os/17` | `phase-17.../src/orchestrator.js` | `phase-17.../test/runtime-proof.mjs` | 23/23 | Postgres RLS | Sell the OS as a franchise product | READY · OSS PARTIAL |
| 18 | Business Knowledge Graph | Entities, dependencies, blast-radius impact | `/api/agent-os/18` | `phase-18.../src/orchestrator.js` | `phase-18.../test/runtime-proof.mjs` | 18/18 | KuzuDB | Know what breaks what before acting | READY · graph-risk PARTIAL · OSS PARTIAL |
| 19 | Executive Simulation | Scenarios, forecast, risk-ranked decisions | `/api/agent-os/19` | `phase-19.../src/orchestrator.js` | `phase-19.../test/runtime-proof.mjs` | 18/18 | StatsForecast, DuckDB | Decide with downside quantified | READY · confidence PARTIAL · OSS PARTIAL |
| 20 | Autonomous Executive OS | Plan, monitor, optimize, halt — one CEO panel | `/api/agent-os/20` | `phase-20.../src/orchestrator.js` | `phase-20.../test/runtime-proof.mjs` | 25/25 | Temporal, OpenFGA | CEO-level autonomy with a kill switch | READY · cert-engine PARTIAL · OSS PARTIAL |

**Aggregate runtime tests:** 207/207 (26+19+28+26+24+23+18+18+25). Verified live (not transcribed) by spawning each phase's runtime-proof as a child process and asserting exit 0 + the exact pass count.

## Capability matrix (directive PART 2)
Every required capability is present and runtime-proven, except the items honestly marked PARTIAL below (capability exists in a reduced form; the named extension is not yet built):

- Phase 13 — **evidence chain**: PARTIAL (records persist; no signed chain).
- Phase 15 — **autonomy scorecard**: PARTIAL (log complete; no aggregate scorecard method).
- Phase 18 — **graph risk engine**: PARTIAL (blast-radius impact present; no separate risk-scoring engine).
- Phase 19 — **confidence engine**: PARTIAL (risk + EV ranking present; no standalone confidence score).
- Phase 20 — **executive certification engine**: PARTIAL (dashboard/posture present; no signed certification verdict engine).

All other listed capabilities (outcome/failure/approval memory, decision replay, RCA, recommendation, playbook, team registry, handoff, conflict, review, scorecard, approval policy, risk tiers, drafts, inbox, rejection learning, audit trail, rollback, action registry, guardrail, executor, rollback engine, autonomy log, kill switch, location/brand registries, permissions, KPI, risk, reports, company registry, tenant isolation, templates, shared ops, cross-company report, entity/relationship/dependency/impact/query, scenario/forecast/assumption/sim-risk/decision-comparison, monitoring, planning, cross-division optimization, CEO panel) = **PROVEN**.
