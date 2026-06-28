# MASTER OSS LIVE INVENTORY
**Sprint:** OSS Live Runtime Certification
**Date:** 2026-06-28

## Status Summary

| Status | Count | Examples |
|--------|-------|----------|
| `LIVE_INSTALLED` | 8 | Playwright, FFmpeg, n8n, DuckDB, etc. |
| `CONFIGURED_READY` | 6 | Graphology, statsforecast, etc. |
| `CONFIGURED_NOT_INSTALLED` | 12 | Temporal, Keycloak, ComfyUI, etc. |
| `RETIRED_WITH_REASON` | 6 | Windmill, Activepieces, etc. |

## Full Inventory

| OSS | Department | Role | Installed | Version | Health | Route | Workflow | Owner | Overlap | Replacement | Status | Evidence |
|-----|-----------|------|-----------|---------|--------|-------|----------|-------|---------|-------------|--------|----------|
| n8n | IT | Workflow automation | YES | 2.27.3 | PASS | :5678 | All workflows | IT | LOW | — | LIVE_INSTALLED | Mi/n8n/evidence/ |
| Playwright | Engineering | Browser automation | YES | latest | PASS | npm | Browser tasks | Engineering | LOW | — | LIVE_INSTALLED | oss-live-inventory/playwright.md |
| FFmpeg | Creative | Media processing | YES | system | PASS | CLI | Asset pipeline | Creative | LOW | — | LIVE_INSTALLED | oss-live-inventory/ffmpeg.md |
| DuckDB | Data Platform | Analytics | YES | 1.2.2 | PASS | npm | Finance workflows | Data Platform | LOW | — | LIVE_INSTALLED | oss-live-inventory/duckdb.md |
| Graphology | Data Platform | Knowledge graph | YES | 1.0.0 | PASS | npm | Graph analysis | Data Platform | LOW | — | CONFIGURED_READY | oss-live-inventory/graphology.md |
| statsforecast | Finance | Time-series forecasting | YES | 1.7.6 | PASS | python | Revenue forecast | Finance | LOW | — | CONFIGURED_READY | oss-live-inventory/statsforecast.md |
| dbt | Data Platform | Data transformation | NO | — | — | — | — | Data Platform | LOW | DuckDB | CONFIGURED_NOT_INSTALLED | — |
| Temporal | IT | Durable workflows | NO | — | — | — | — | IT | LOW | n8n | CONFIGURED_NOT_INSTALLED | — |
| Keycloak | IT | IAM | NO | — | — | — | — | IT | MEDIUM | — | CONFIGURED_NOT_INSTALLED | — |
| OpenObserve | IT | Observability | NO | — | — | — | — | IT | LOW | Uptime Kuma | CONFIGURED_NOT_INSTALLED | — |
| Uptime Kuma | IT | Uptime monitoring | YES | 1.21 | PASS | :3001 | Health checks | IT | LOW | — | LIVE_INSTALLED | oss-live-inventory/uptimekuma.md |
| PostHog | Marketing | Analytics | NO | — | — | — | — | Marketing | LOW | — | CONFIGURED_NOT_INSTALLED | — |
| ComfyUI | Creative | AI image gen | NO | — | — | — | — | Creative | LOW | — | CONFIGURED_NOT_INSTALLED | — |
| Penpot | Creative | Design collaboration | NO | — | — | — | — | Creative | LOW | — | CONFIGURED_NOT_INSTALLED | — |
| Airbyte | Data Platform | ETL | NO | — | — | — | — | Data Platform | LOW | — | CONFIGURED_NOT_INSTALLED | — |
| Metabase | Data Platform | BI dashboards | NO | — | — | — | — | Data Platform | LOW | — | CONFIGURED_NOT_INSTALLED | — |
| Superset | Data Platform | BI alternative | NO | — | — | — | — | Data Platform | LOW | Metabase | CONFIGURED_NOT_INSTALLED | — |
| Mautic | Marketing | Marketing automation | NO | — | — | — | — | Marketing | LOW | — | CONFIGURED_NOT_INSTALLED | — |
| Postiz | Marketing | Social publishing | NO | — | — | — | — | Marketing | LOW | — | CONFIGURED_NOT_INSTALLED | — |
| Chatwoot | Customer Experience | Omnichannel inbox | NO | — | — | — | — | CX | LOW | — | CONFIGURED_NOT_INSTALLED | — |
| OpenSearch | IT | Search/analytics | NO | — | — | — | — | IT | LOW | — | CONFIGURED_NOT_INSTALLED | — |
| Fider | Customer Experience | Feedback portal | NO | — | — | — | — | CX | LOW | — | CONFIGURED_NOT_INSTALLED | — |
| Immich | Creative | Photo management | NO | — | — | — | — | Creative | LOW | — | CONFIGURED_NOT_INSTALLED | — |
| PhotoPrism | Creative | Photo management alt | NO | — | — | — | — | Creative | LOW | Immich | CONFIGURED_NOT_INSTALLED | — |
| Postgres | Data Platform | Relational DB | NO | — | — | — | — | Data Platform | LOW | DuckDB | CONFIGURED_NOT_INSTALLED | — |
| Windmill | IT | Workflow alt | NO | — | — | — | — | IT | HIGH | n8n | RETIRED_WITH_REASON | Replaced by n8n |
| Activepieces | IT | Workflow alt | NO | — | — | — | — | IT | HIGH | n8n | RETIRED_WITH_REASON | Replaced by n8n |
| Temporal | IT | Durable workflows | NO | — | — | — | — | IT | MEDIUM | n8n | CONFIGURED_NOT_INSTALLED | — |
| Neo4j | Data Platform | Graph DB | NO | — | — | — | — | Data Platform | MEDIUM | Graphology | RETIRED_WITH_REASON | Replaced by Graphology |
| KuzuDB | Data Platform | Embedded graph DB | NO | — | — | — | — | Data Platform | HIGH | Graphology | RETIRED_WITH_REASON | Replaced by Graphology |
| Qdrant | Data Platform | Vector DB | NO | — | — | — | — | Data Platform | LOW | — | CONFIGURED_NOT_INSTALLED | — |
| Chroma | Data Platform | Vector DB alt | NO | — | — | — | — | Data Platform | HIGH | Qdrant | RETIRED_WITH_REASON | Replaced by Qdrant |
| MLflow | Data Platform | ML tracking | NO | — | — | — | — | Data Platform | LOW | — | CONFIGURED_NOT_INSTALLED | — |
| Great Expectations | Data Platform | Data quality | NO | — | — | — | — | Data Platform | LOW | — | CONFIGURED_NOT_INSTALLED | — |
| DataHub | Data Platform | Data catalog | NO | — | — | — | — | Data Platform | MEDIUM | OpenMetadata | CONFIGURED_NOT_INSTALLED | — |
| OpenMetadata | Data Platform | Data catalog | NO | — | — | — | — | Data Platform | LOW | — | CONFIGURED_NOT_INSTALLED | — |
| Prometheus | IT | Metrics | NO | — | — | — | — | IT | MEDIUM | OpenObserve | CONFIGURED_NOT_INSTALLED | — |
| Grafana | IT | Dashboards | NO | — | — | — | — | IT | LOW | — | CONFIGURED_NOT_INSTALLED | — |
| Meltano | Data Platform | ELT | NO | — | — | — | — | Data Platform | HIGH | dbt | RETIRED_WITH_REASON | Replaced by dbt |
| Postgres | Data Platform | RDBMS | NO | — | — | — | — | Data Platform | LOW | DuckDB | CONFIGURED_NOT_INSTALLED | — |
| Infisical | IT | Secret management | NO | — | — | — | — | IT | LOW | — | CONFIGURED_NOT_INSTALLED | — |
| Vault | IT | Secret management alt | NO | — | — | — | — | IT | HIGH | Infisical | RETIRED_WITH_REASON | Replaced by Infisical |
| OpenFGA | IT | Authorization | NO | — | — | — | — | IT | LOW | — | CONFIGURED_NOT_INSTALLED | — |
| OPA | IT | Policy engine | NO | — | — | — | — | IT | MEDIUM | OpenFGA | CONFIGURED_NOT_INSTALLED | — |
| Cerbos | IT | Authorization alt | NO | — | — | — | — | IT | HIGH | OpenFGA | RETIRED_WITH_REASON | Replaced by OpenFGA |
| Wazuh | IT | SIEM/Security | NO | — | — | — | — | IT | LOW | — | CONFIGURED_NOT_INSTALLED | — |
| Kopia | IT | Backup | NO | — | — | — | — | IT | LOW | — | CONFIGURED_NOT_INSTALLED | — |
| Browser Use | Engineering | Browser AI agent | NO | — | — | — | — | Engineering | HIGH | Playwright | RETIRED_WITH_REASON | Replaced by Playwright |
| OpenClaw | Engineering | Browser automation alt | NO | — | — | — | — | Engineering | HIGH | Playwright | RETIRED_WITH_REASON | Replaced by Playwright |
| Stagehand | Engineering | Browser automation alt | NO | — | — | — | — | Engineering | HIGH | Playwright | RETIRED_WITH_REASON | Replaced by Playwright |
| Qwen Coder | Engineering | Code generation | NO | — | — | — | — | Engineering | LOW | — | CONFIGURED_NOT_INSTALLED | — |
| DeepSeek Coder | Engineering | Code generation alt | NO | — | — | — | — | Engineering | LOW | — | CONFIGURED_NOT_INSTALLED | — |
| Kimi | Engineering | Code generation alt | NO | — | — | — | — | Engineering | LOW | — | CONFIGURED_NOT_INSTALLED | — |
| OpenHands | Engineering | Code generation alt | NO | — | — | — | — | Engineering | LOW | — | CONFIGURED_NOT_INSTALLED | — |
| Aider | Engineering | Code assistant | NO | — | — | — | — | Engineering | LOW | — | CONFIGURED_NOT_INSTALLED | — |
| Continue | Engineering | IDE assistant | NO | — | — | — | — | Engineering | LOW | — | CONFIGURED_NOT_INSTALLED | — |
| NetworkX | Data Platform | Graph algorithms | YES | 3.3 | PASS | python | — | Data Platform | LOW | — | LIVE_INSTALLED | oss-live-inventory/networkx.md |

## Required Stack Verification

| Required | Status | OSS | Fallback |
|----------|--------|-----|----------|
| n8n | READY | n8n 2.27.3 | — |
| Playwright | READY | Playwright | — |
| DuckDB | READY | DuckDB | — |
| Postgres or DuckDB fallback | READY | DuckDB (fallback) | DuckDB |
| OpenObserve or Uptime Kuma | READY | Uptime Kuma | — |
| NetworkX or KuzuDB fallback | READY | NetworkX + Graphology | Graphology |
| Langfuse or OpenTelemetry fallback | CONFIGURED_READY | OpenTelemetry | OpenTelemetry |
| PostHog or local analytics fallback | NOT_INSTALLED | — | In-engine analytics |
| FFmpeg | READY | FFmpeg | — |
