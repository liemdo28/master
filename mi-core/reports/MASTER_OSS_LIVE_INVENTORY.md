# MASTER_OSS_LIVE_INVENTORY.md

**Version:** 1.0.0
**Date:** 2026-06-28
**Purpose:** Single source of truth for every OSS in the Mi ecosystem

---

## Status Legend

| Status | Meaning |
|--------|---------|
| `LIVE_INSTALLED` | Binary/package installed, verified, health check passes |
| `CONFIGURED_READY` | Module in node_modules, fallback in place |
| `CONFIGURED_NOT_INSTALLED` | Declared but no binary/module |
| `BROKEN_INSTALLED` | Attempted to install but health check fails |
| `BLOCKED_NEEDS_CREDENTIAL` | Requires API key/token to probe |
| `BLOCKED_UNSUPPORTED` | OS or architecture not supported |
| `RETIRED` | Not needed; replaced by fallback |

Not allowed: UNKNOWN, TBD, TODO.

---

## Full Inventory (All 56 OSS)

### Workflow Engines (4)

| OSS | Department | Business Role | Installed | Version | Health | Route/API | Workflow | Owner | Overlap | Replacement | Final Status | Evidence |
|-----|-----------|---------------|-----------|---------|--------|-----------|----------|-------|---------|-------------|-------------|----------|
| n8n | IT | Workflow fabric automation | YES | 2.27.3 | PASS | TCP :5678 | All workflows | IT | LOW | In-engine workflow-registry | LIVE_INSTALLED | Mi/n8n/N8N_ARCHITECTURE_AUDIT.md |
| Temporal | Operations | Durable approval workflow | NO | — | — | TCP :7233 | approval workflow engine | Operations | LOW | In-engine propose/approve/reject | CONFIGURED_NOT_INSTALLED | mi-core/evidence/oss-live-inventory/temporal-not-installed.md |
| Windmill | IT | Workflow engine alternative | NO | — | — | REST API | None | IT | HIGH | n8n primary | RETIRED | RETIRED — n8n is primary workflow engine |
| Activepieces | IT | Workflow engine alternative | NO | — | — | REST API | None | IT | HIGH | n8n primary | RETIRED | RETIRED — n8n is primary workflow engine |

### Browser/Operator (4)

| OSS | Department | Business Role | Installed | Version | Health | Route/API | Workflow | Owner | Overlap | Replacement | Final Status | Evidence |
|-----|-----------|---------------|-----------|---------|--------|-----------|----------|-------|---------|-------------|-------------|----------|
| Playwright | Engineering | Browser automation | YES | latest | PASS | @playwright/test | browser-operator workflows | Engineering | LOW | — | LIVE_INSTALLED | mi-core/reports/BROWSER_AUTOMATION_INSTALL_REPORT.md |
| Browser Use | Engineering | Browser agent orchestration | NO | — | — | npm | None | Engineering | HIGH | Playwright primary | RETIRED | RETIRED — Playwright is primary |
| OpenClaw | Engineering | Browser automation alternative | NO | — | — | npm | None | Engineering | HIGH | Playwright primary | RETIRED | RETIRED — Playwright is primary |
| Stagehand | Engineering | Browser automation alternative | NO | — | — | npm | None | Engineering | HIGH | Playwright primary | RETIRED | RETIRED — Playwright is primary |

### Engineering / Coding (6)

| OSS | Department | Business Role | Installed | Version | Health | Route/API | Workflow | Owner | Overlap | Replacement | Final Status | Evidence |
|-----|-----------|---------------|-----------|---------|--------|-----------|----------|-------|---------|-------------|-------------|----------|
| Qwen Coder | Engineering | AI code generation | NO | — | — | CLI/API | None | Engineering | LOW | Claude Opus 4.6 primary | RETIRED | RETIRED — Claude is primary coding brain |
| Anthropic Coder | Engineering | AI code generation | NO | — | — | CLI/API | None | Engineering | LOW | Claude Opus 4.6 primary | RETIRED | RETIRED — Claude is primary coding brain |
| Kimi | Engineering | AI coding assistant | NO | — | — | CLI/API | None | Engineering | LOW | Claude Opus 4.6 primary | RETIRED | RETIRED — Claude is primary coding brain |
| OpenHands | Engineering | AI coding agent | NO | — | — | CLI/API | None | Engineering | LOW | Claude Opus 4.6 primary | RETIRED | RETIRED — Claude is primary coding brain |
| Aider | Engineering | AI pair programming | NO | — | — | CLI | None | Engineering | LOW | Claude Opus 4.6 primary | RETIRED | RETIRED — Claude is primary coding brain |
| Continue | Engineering | AI IDE extension | NO | — | — | VS Code ext | None | Engineering | LOW | Claude Opus 4.6 + Copilot | RETIRED | RETIRED — Claude is primary coding brain |

### Finance / Data (8)

| OSS | Department | Business Role | Installed | Version | Health | Route/API | Workflow | Owner | Overlap | Replacement | Final Status | Evidence |
|-----|-----------|---------------|-----------|---------|--------|-----------|----------|-------|---------|-------------|-------------|----------|
| DuckDB | Data Platform | Multi-location KPI analytics | YES | 1.2.2 | PASS | npm module | CFO dashboard, financial analytics | Finance | LOW | — | LIVE_INSTALLED | computer-operator-foundation/FINANCIAL_WAREHOUSE_RUNTIME_PROOF.md |
| dbt | Data Platform | Data transformation | NO | — | — | CLI | None | Data Platform | LOW | DuckDB + in-engine | CONFIGURED_NOT_INSTALLED | mi-core/evidence/oss-live-inventory/dbt-not-installed.md |
| Metabase | Data Platform | BI dashboards | NO | — | — | REST API | None | Data Platform | LOW | In-engine CFO dashboard | CONFIGURED_NOT_INSTALLED | mi-core/evidence/oss-live-inventory/metabase-not-installed.md |
| Superset | Data Platform | BI dashboards alternative | NO | — | — | REST API | None | Data Platform | LOW | Metabase primary | RETIRED | RETIRED — Metabase is primary BI |
| Postgres | Data Platform | Relational data store | NO | — | — | TCP :5432 | None | Data Platform | LOW | DuckDB fallback | CONFIGURED_NOT_INSTALLED | mi-core/evidence/oss-live-inventory/postgresql-not-installed.md |
| Airbyte | Data Platform | ETL pipeline | NO | — | — | npm module | None | Data Platform | LOW | DuckDB + in-engine ETL | CONFIGURED_NOT_INSTALLED | mi-core/evidence/oss-live-inventory/airbyte-not-installed.md |
| Meltano | Data Platform | ELT for data analytics | NO | — | — | CLI | None | Data Platform | HIGH | Airbyte primary | RETIRED | RETIRED — Airbyte is primary ETL |
| NetworkX | Data Platform | Knowledge graph traversal | YES | 3.3 | PASS | Python | graph/dependency intelligence | Data Platform | LOW | — | LIVE_INSTALLED | mi-core/evidence/oss-live-inventory/networkx-installed.md |

### Marketing / CX (6)

| OSS | Department | Business Role | Installed | Version | Health | Route/API | Workflow | Owner | Overlap | Replacement | Final Status | Evidence |
|-----|-----------|---------------|-----------|---------|--------|-----------|----------|-------|---------|-------------|-------------|----------|
| PostHog | Marketing | Channel/revenue analytics | NO | — | — | REST API | None | Marketing | LOW | In-engine analytics | CONFIGURED_NOT_INSTALLED | mi-core/evidence/oss-live-inventory/posthog-not-installed.md |
| Mautic | Marketing | Marketing automation | NO | — | — | REST API | None | Marketing | LOW | In-engine MA | CONFIGURED_NOT_INSTALLED | mi-core/evidence/oss-live-inventory/mautic-not-installed.md |
| Postiz | Marketing | Social media scheduling | NO | — | — | REST API | None | Marketing | LOW | In-engine social signals | BLOCKED_NEEDS_CREDENTIAL | BLOCKED — requires Postiz API key |
| Chatwoot | Customer Experience | Customer conversation/feedback | NO | — | — | REST API | None | CX | LOW | In-engine feedback pipeline | CONFIGURED_NOT_INSTALLED | mi-core/evidence/oss-live-inventory/chatwoot-not-installed.md |
| Fider | Customer Experience | Feature request board | NO | — | — | REST API | None | CX | LOW | In-engine feedback | RETIRED | RETIRED — handled via Chatwoot pipeline |
| OpenSearch | Marketing/CX | Search/analytics | NO | — | — | REST API | None | Marketing | LOW | In-engine search | RETIRED | RETIRED — not needed for current use cases |

### Creative (5)

| OSS | Department | Business Role | Installed | Version | Health | Route/API | Workflow | Owner | Overlap | Replacement | Final Status | Evidence |
|-----|-----------|---------------|-----------|---------|--------|-----------|----------|-------|---------|-------------|-------------|----------|
| ComfyUI | Creative | AI image generation workflow | NO | — | — | REST API | None | Creative | LOW | In-engine creative-brief | CONFIGURED_NOT_INSTALLED | mi-core/evidence/oss-live-inventory/comfyui-not-installed.md |
| FFmpeg | Creative | Media processing | YES | system | PASS | CLI | asset pipeline | Creative | LOW | — | LIVE_INSTALLED | mi-core/evidence/oss-live-inventory/ffmpeg-system-installed.md |
| Penpot | Creative | Design collaboration | NO | — | — | REST API | None | Creative | LOW | Figma / manual design | RETIRED | RETIRED — handled via external tools |
| Immich | Creative | Media asset management | NO | — | — | REST API | None | Creative | LOW | In-engine asset registry | RETIRED | RETIRED — handled via creative-preview |
| PhotoPrism | Creative | Photo organization | NO | — | — | REST API | None | Creative | LOW | In-engine asset registry | RETIRED | RETIRED — handled via file system |

### IT / Security (13)

| OSS | Department | Business Role | Installed | Version | Health | Route/API | Workflow | Owner | Overlap | Replacement | Final Status | Evidence |
|-----|-----------|---------------|-----------|---------|--------|-----------|----------|-------|---------|-------------|-------------|----------|
| OpenObserve | Executive | Continuous monitoring | NO | — | — | TCP :5080 | autonomy log | Executive | LOW | Uptime-Kuma + AutonomyLog | CONFIGURED_NOT_INSTALLED | mi-core/evidence/oss-live-inventory/openobserve-not-installed.md |
| Uptime Kuma | IT | Store-ops uptime monitoring | YES | 1.21 | PASS | TCP :3001 | health-check | IT | LOW | — | LIVE_INSTALLED | mi-core/evidence/oss-live-inventory/uptime-kuma-installed.md |
| Kopia | IT | Backup/restore | NO | — | — | CLI | None | IT | LOW | Cloud snapshots | RETIRED | RETIRED — handled via cloud provider snapshots |
| Grafana | Executive | Executive dashboards | NO | — | — | TCP :3030 | command center | Executive | LOW | In-engine renderer | CONFIGURED_NOT_INSTALLED | mi-core/evidence/oss-live-inventory/grafana-not-installed.md |
| Prometheus | IT | Metrics collection | NO | — | — | TCP :9090 | None | IT | MEDIUM | OpenTelemetry module | RETIRED | RETIRED — metrics via Uptime Kuma + OpenTelemetry |
| Keycloak | IT | Access control / identity | NO | — | — | TCP :8443 | None | IT | LOW | In-engine access-control | CONFIGURED_NOT_INSTALLED | mi-core/evidence/oss-live-inventory/keycloak-not-installed.md |
| Ory | IT | Identity/authorization | NO | — | — | TCP :4000 | None | IT | HIGH | Keycloak primary | RETIRED | RETIRED — Keycloak is primary identity |
| OpenFGA | IT | Tenant/relationship authorization | NO | — | — | TCP :8080 | None | IT | LOW | In-engine TenantIsolation | CONFIGURED_NOT_INSTALLED | mi-core/evidence/oss-live-inventory/openfga-not-installed.md |
| OPA | IT | Guardrail policy decisions | NO | — | — | TCP :8181 | None | IT | MEDIUM | In-engine GuardrailEngine | CONFIGURED_NOT_INSTALLED | mi-core/evidence/oss-live-inventory/opa-not-installed.md |
| Cerbos | IT | Authorization policy engine | NO | — | — | TCP :3592 | None | IT | HIGH | OpenFGA + OPA primary | RETIRED | RETIRED — duplicate capability |
| Infisical | IT | Secret management | NO | — | — | CLI | None | IT | LOW | Env vars + .env.example | CONFIGURED_NOT_INSTALLED | — |
| Vault | IT | Secret management alternative | NO | — | — | TCP :8200 | None | IT | HIGH | Infisical primary | RETIRED | RETIRED — handled via env vars |
| Wazuh | IT | Security monitoring SIEM | NO | — | — | TCP :1514 | None | IT | LOW | In-engine audit-log | RETIRED | RETIRED — handled via in-engine audit-log |

### Knowledge / Memory (10)

| OSS | Department | Business Role | Installed | Version | Health | Route/API | Workflow | Owner | Overlap | Replacement | Final Status | Evidence |
|-----|-----------|---------------|-----------|---------|--------|-----------|----------|-------|---------|-------------|-------------|----------|
| KuzuDB | Data Platform | Graph database alternative | NO | — | — | npm module | None | Data Platform | HIGH | NetworkX/Graphology | RETIRED | RETIRED — Graphology serves graph needs |
| Neo4j | Data Platform | Graph database | NO | — | — | TCP :7687 | None | Data Platform | MEDIUM | NetworkX/Graphology | RETIRED | RETIRED — handled by graph module |
| Qdrant | Data Platform | Vector database | NO | — | — | TCP :6333 | None | Data Platform | LOW | In-engine vector search | CONFIGURED_NOT_INSTALLED | mi-core/evidence/oss-live-inventory/qdrant-not-installed.md |
| Chroma | Data Platform | Vector database alternative | NO | — | — | REST API | None | Data Platform | HIGH | Qdrant primary | RETIRED | RETIRED — Qdrant is primary vector DB |
| Langfuse | Data Platform | LLM observability | NO | — | — | REST API | None | Data Platform | LOW | OpenTelemetry | CONFIGURED_NOT_INSTALLED | mi-core/evidence/oss-live-inventory/langfuse-not-installed.md |
| OpenTelemetry | Intelligence | Trace/outcome memory export | YES | latest | PASS | npm module | All LLM traces | Intelligence | LOW | — | LIVE_INSTALLED | mi-core/server/src/oss-runtime/oss-worker-registry.ts |
| MLflow | Data Platform | ML experiment tracking | NO | — | — | REST API | None | Data Platform | LOW | In-engine memory + evidence | RETIRED | RETIRED — handled via in-engine system |
| Great Expectations | QA | Food/service quality audits | NO | — | — | Python CLI | None | QA | LOW | In-engine QA signals | CONFIGURED_NOT_INSTALLED | mi-core/evidence/oss-live-inventory/great-expectations-not-installed.md |
| DataHub | Data Platform | Data catalog | NO | — | — | REST API | None | Data Platform | MEDIUM | OpenMetadata primary | CONFIGURED_NOT_INSTALLED | mi-core/evidence/oss-live-inventory/datahub-not-installed.md |
| OpenMetadata | Data Platform | Data catalog alternative | NO | — | — | REST API | None | Data Platform | LOW | In-engine catalog | CONFIGURED_NOT_INSTALLED | mi-core/evidence/oss-live-inventory/openmetadata-not-installed.md |

---

## Summary by Status

| Status | Count |
|--------|-------|
| LIVE_INSTALLED | 6 |
| CONFIGURED_NOT_INSTALLED | 18 |
| BLOCKED_NEEDS_CREDENTIAL | 1 |
| RETIRED | 31 |
| BROKEN_INSTALLED | 0 |
| BLOCKED_UNSUPPORTED | 0 |
| **TOTAL** | **56** |

**No UNKNOWN / TBD / TODO allowed. Every OSS has explicit status.**

---

## Minimum Required Stack

| # | Required | Status | OSS | Fallback |
|---|----------|--------|-----|----------|
| 1 | n8n | READY | n8n 2.27.3 | — |
| 2 | Playwright | READY | Playwright | — |
| 3 | DuckDB | READY | DuckDB | — |
| 4 | dbt | PRIMARY_NOT_INSTALLED | — | FALLBACK_READY (DuckDB) |
| 5 | Postgres or DuckDB fallback | READY | DuckDB | DuckDB serves as fallback |
| 6 | OpenObserve or local log fallback | PRIMARY_NOT_INSTALLED | — | FALLBACK_READY (Uptime Kuma + AutonomyLog) |
| 7 | Uptime Kuma or local health fallback | READY | Uptime Kuma | — |
| 8 | NetworkX or KuzuDB fallback | READY | NetworkX + Graphology | Graphology serves as fallback |
| 9 | Langfuse or OpenTelemetry fallback | READY | OpenTelemetry | OpenTelemetry serves as fallback |
| 10 | PostHog or local analytics fallback | PRIMARY_NOT_INSTALLED | — | FALLBACK_READY (In-engine channel-performance) |
| 11 | FFmpeg | READY | FFmpeg | — |