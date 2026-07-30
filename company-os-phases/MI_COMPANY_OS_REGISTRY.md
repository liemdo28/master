# MI_COMPANY_OS_REGISTRY.md — Master OSS Registry

**Generated:** 2026-06-27
**Purpose:** Master registry of all OSS used across all phases (11-20)

---

## Master OSS Registry

Every OSS has: name, category, business role, owner division, license status, security status, maintenance status, deployment status, projects using it, risk, rollback plan, replacement option.

---

## Phase 11 — Workforce OSS

| Name | Category | Business Role | Owner Division | License | Security | Maintenance | Deployment | Projects | Risk | Rollback | Replacement |
|------|----------|-------------|--------------|---------|---------|-----------|-----------|---------|------|---------|------------|
| n8n | Workflow | Workflow Worker | Operations | Apache-2.0 | LOW | ACTIVE | PRODUCTION | SEO, Food Safety, Reviews, DoorDash | LOW | Disable workflows | Temporal |
| Playwright | Browser | Browser Worker | IT | Apache-2.0 | LOW | ACTIVE | PRODUCTION | DoorDash, Toast, GBP | LOW | Stop scripts | Browser Use |
| DuckDB | Data | Warehouse Worker | Finance | MIT | LOW | ACTIVE | PRODUCTION | Financial Warehouse | LOW | Halt queries | Cloud warehouse |
| dbt | Transform | Data Transformation | Finance | Apache-2.0 | LOW | ACTIVE | PRODUCTION | Data pipeline | LOW | Disable models | — |
| PostHog | Analytics | Analytics Worker | Marketing | AGPL-3.0 | MEDIUM | ACTIVE | PRODUCTION | Product analytics | LOW | Disable tracking | Plausible |
| OpenObserve | Observability | Monitoring Worker | IT | AGPL-3.0 | MEDIUM | ACTIVE | PRODUCTION | IT observability | MEDIUM | Switch to Grafana | Grafana |
| Uptime Kuma | Monitoring | Health Worker | IT | MIT | LOW | ACTIVE | PRODUCTION | IT monitoring | LOW | Disable monitors | — |
| Browser Use | Adaptive Browser | Adaptive Worker | Operations | MIT | MEDIUM | PILOT | PILOT | n8n adaptive | MEDIUM | Disable workflow | Playwright |
| Aider | AI Coding | Coding Assistant | Engineering | Apache-2.0 | LOW | DISCOVERY | — | Engineering Agent | LOW | Disable | Continue |
| OpenHands | AI Coding | Coding Agent | Engineering | MIT | LOW | DISCOVERY | — | Engineering Agent | LOW | Disable | Aider |
| Qwen Coder | AI Coding | Coding Model | Engineering | Apache-2.0 | LOW | AUDIT | AUDIT | Engineering Agent | LOW | Switch model | Claude |

---

## Phase 12 — Memory OSS

| Name | Category | Business Role | Owner Division | License | Security | Maintenance | Deployment | Projects | Risk | Rollback | Replacement |
|------|----------|-------------|--------------|---------|---------|-----------|-----------|---------|------|---------|------------|
| Langfuse | Tracing | LLM Tracing | Engineering | MIT | LOW | ACTIVE | PRODUCTION | Mi Core | LOW | Disable tracing | — |
| OpenTelemetry | Telemetry | Telemetry Standard | Engineering | Apache-2.0 | LOW | ACTIVE | PRODUCTION | All services | LOW | Use legacy logs | — |
| Phoenix | Evaluation | Model Evaluation | Engineering | Apache-2.0 | LOW | DISCOVERY | — | None | LOW | — | — |
| Postgres pgvector | Vector | Vector Storage | Engineering | PostgreSQL | LOW | ACTIVE | PRODUCTION | Memory stores | LOW | Use text search | Qdrant |

---

## Phase 15 — Autonomy OSS

| Name | Category | Business Role | Owner Division | License | Security | Maintenance | Deployment | Projects | Risk | Rollback | Replacement |
|------|----------|-------------|--------------|---------|---------|-----------|-----------|---------|------|---------|------------|
| OpenFGA | Authorization | Policy Engine | IT | Apache-2.0 | LOW | ACTIVE | PRODUCTION | All services | LOW | Use RBAC | Casbin |
| OPA | Policy | Policy Enforcement | IT | Apache-2.0 | LOW | ACTIVE | PRODUCTION | Guardrails | LOW | Disable policies | Cerbos |

---

## Phase 16 — Multi-Location OSS

| Name | Category | Business Role | Owner Division | License | Security | Maintenance | Deployment | Projects | Risk | Rollback | Replacement |
|------|----------|-------------|--------------|---------|---------|-----------|-----------|---------|------|---------|------------|
| Airbyte | Integration | Data Pipeline | Marketing | MIT | LOW | ACTIVE | PRODUCTION | PostHog pipeline | LOW | Manual sync | n8n |

---

## OSS Summary

| Metric | Count |
|--------|-------|
| Total OSS | 20 |
| PRODUCTION | 13 |
| PILOT | 1 |
| AUDIT | 1 |
| DISCOVERY | 5 |
| AGPL-3.0 (license risk) | 2 |
| Rejected | 6 |

---

## OSS Rejected

| Name | Reason |
|------|--------|
| Skyvern | AGPL-3.0 HIGH license risk |
| ElasticSearch | Elastic license concerns |
| LangChain | Too complex |
| CrewAI | Overkill |
| Weaviate/Chroma/LanceDB | pgvector sufficient |
| MLflow | No ML training pipeline |

---

## Status: ✅ MASTER_OSS_REGISTRY_COMPLETE
