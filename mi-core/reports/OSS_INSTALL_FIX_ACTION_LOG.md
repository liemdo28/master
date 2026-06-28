# OSS INSTALL / FIX ACTION LOG

**Version:** 1.0.0
**Date:** 2026-06-28
**Purpose:** Track all OSS install, fix, retire, or fallback decisions

---

## Action Log Table

| # | OSS | Before Status | Action | Command/Decision | After Status | Health Result | Owner | Rollback | Evidence |
|---|-----|-------------|--------|-----------------|-------------|-------------|-------|---------|---------|
| 1 | n8n | N/A | Verified existing install | PM2 list / n8n version | `LIVE_INSTALLED` | PM2 TCP 5678 OK | IT | PM2 restart | `Mi/n8n/N8N_ARCHITECTURE_AUDIT.md` |
| 2 | Playwright | N/A | Verified existing install | npm list @playwright/test | `LIVE_INSTALLED` | module probe OK | Engineering | npm uninstall | `mi-core/reports/BROWSER_AUTOMATION_INSTALL_REPORT.md` |
| 3 | DuckDB | N/A | Verified existing install | npm list duckdb | `LIVE_INSTALLED` | module probe OK | Finance | npm uninstall | `computer-operator-foundation/FINANCIAL_WAREHOUSE_RUNTIME_PROOF.md` |
| 4 | Graphology | N/A | Verified existing install | npm list graphology | `LIVE_INSTALLED` | module probe OK | Data Platform | npm uninstall | `mi-core/server/src/oss-runtime/oss-worker-registry.ts` |
| 5 | FFmpeg | N/A | Verified system install | ffmpeg -version | `LIVE_INSTALLED` | CLI probe OK | Creative | N/A | `mi-core/evidence/oss-live-inventory/ffmpeg-system-installed.md` |
| 6 | Uptime Kuma | N/A | Verified Docker install | Docker container list | `LIVE_INSTALLED` | TCP 3001 OK | IT | docker stop | `mi-core/evidence/oss-live-inventory/uptime-kuma-installed.md` |
| 7 | OpenTelemetry | N/A | Verified npm install | npm list @opentelemetry/api | `LIVE_INSTALLED` | module probe OK | Intelligence | npm uninstall | `mi-core/server/src/oss-runtime/oss-worker-registry.ts` |
| 8 | dbt | `CONFIGURED_NOT_INSTALLED` | Retire with fallback | dbt not in PATH, no install needed | `CONFIGURED_NOT_INSTALLED` | FALLBACK_READY | Data Platform | N/A | `mi-core/evidence/oss-live-inventory/dbt-not-installed.md` |
| 9 | Postgres | `CONFIGURED_NOT_INSTALLED` | Retire with fallback | No TCP 5432, DuckDB fallback | `CONFIGURED_NOT_INSTALLED` | FALLBACK_READY | Data Platform | N/A | `mi-core/evidence/oss-live-inventory/postgresql-not-installed.md` |
| 10 | Temporal | `CONFIGURED_NOT_INSTALLED` | Retire with fallback | No TCP 7233, in-engine approval | `CONFIGURED_NOT_INSTALLED` | FALLBACK_READY | Operations | N/A | `mi-core/evidence/oss-live-inventory/temporal-not-installed.md` |
| 11 | Airbyte | `CONFIGURED_NOT_INSTALLED` | Retire with fallback | airbyte-sdk not installed, DuckDB fallback | `CONFIGURED_NOT_INSTALLED` | FALLBACK_READY | Data Platform | N/A | `mi-core/evidence/oss-live-inventory/airbyte-not-installed.md` |
| 12 | Metabase | `CONFIGURED_NOT_INSTALLED` | Retire with fallback | No TCP 3000, in-engine CFO dashboard | `CONFIGURED_NOT_INSTALLED` | FALLBACK_READY | Data Platform | N/A | `mi-core/evidence/oss-live-inventory/metabase-not-installed.md` |
| 13 | PostHog | `CONFIGURED_NOT_INSTALLED` | Retire with fallback | No TCP 8000, in-engine analytics | `CONFIGURED_NOT_INSTALLED` | FALLBACK_READY | Marketing | N/A | `mi-core/evidence/oss-live-inventory/posthog-not-installed.md` |
| 14 | Mautic | `CONFIGURED_NOT_INSTALLED` | Retire with fallback | No TCP 8000, in-engine MA | `CONFIGURED_NOT_INSTALLED` | FALLBACK_READY | Marketing | N/A | `mi-core/evidence/oss-live-inventory/mautic-not-installed.md` |
| 15 | Chatwoot | `CONFIGURED_NOT_INSTALLED` | Retire with fallback | No TCP 3000, WhatsApp pipeline | `CONFIGURED_NOT_INSTALLED` | FALLBACK_READY | CX | N/A | `mi-core/evidence/oss-live-inventory/chatwoot-not-installed.md` |
| 16 | ComfyUI | `CONFIGURED_NOT_INSTALLED` | Retire with fallback | No TCP 8188, in-engine creative | `CONFIGURED_NOT_INSTALLED` | FALLBACK_READY | Creative | N/A | `mi-core/evidence/oss-live-inventory/comfyui-not-installed.md` |
| 17 | OpenObserve | `CONFIGURED_NOT_INSTALLED` | Retire with fallback | No TCP 5080, AutonomyLog+UptimeKuma | `CONFIGURED_NOT_INSTALLED` | FALLBACK_READY | Executive | N/A | `mi-core/evidence/oss-live-inventory/openobserve-not-installed.md` |
| 18 | Grafana | `CONFIGURED_NOT_INSTALLED` | Retire with fallback | No TCP 3030, in-engine command center | `CONFIGURED_NOT_INSTALLED` | FALLBACK_READY | Executive | N/A | `mi-core/evidence/oss-live-inventory/grafana-not-installed.md` |
| 19 | Keycloak | `CONFIGURED_NOT_INSTALLED` | Retire with fallback | No TCP 8443, in-engine access-control | `CONFIGURED_NOT_INSTALLED` | FALLBACK_READY | IT | N/A | `mi-core/evidence/oss-live-inventory/keycloak-not-installed.md` |
| 20 | OpenFGA | `CONFIGURED_NOT_INSTALLED` | Retire with fallback | No TCP 8080, in-engine TenantIsolation | `CONFIGURED_NOT_INSTALLED` | FALLBACK_READY | IT | N/A | `mi-core/evidence/oss-live-inventory/openfga-not-installed.md` |
| 21 | OPA | `CONFIGURED_NOT_INSTALLED` | Retire with fallback | No TCP 8181, in-engine GuardrailEngine | `CONFIGURED_NOT_INSTALLED` | FALLBACK_READY | IT | N/A | `mi-core/evidence/oss-live-inventory/opa-not-installed.md` |
| 22 | Qdrant | `CONFIGURED_NOT_INSTALLED` | Retire with fallback | No TCP 6333, in-engine vector search | `CONFIGURED_NOT_INSTALLED` | FALLBACK_READY | Data Platform | N/A | `mi-core/evidence/oss-live-inventory/qdrant-not-installed.md` |
| 23 | Langfuse | `CONFIGURED_NOT_INSTALLED` | Retire with fallback | No TCP 3000, OpenTelemetry+Otel | `CONFIGURED_NOT_INSTALLED` | FALLBACK_READY | Data Platform | N/A | `mi-core/evidence/oss-live-inventory/langfuse-not-installed.md` |
| 24 | Great Expectations || 24 | Great Expectations | `CONFIGURED_NOT_INSTALLED` | Retire with fallback | Python package not installed, in-engine QA | `CONFIGURED_NOT_INSTALLED` | FALLBACK_READY | QA | N/A | `mi-core/evidence/oss-live-inventory/great-expectations-not-installed.md` |
| 25 | DataHub | `CONFIGURED_NOT_INSTALLED` | Retire with fallback | No TCP 9002, in-engine catalog | `CONFIGURED_NOT_INSTALLED` | FALLBACK_READY | Data Platform | N/A | `mi-core/evidence/oss-live-inventory/datahub-not-installed.md` |
| 26 | OpenMetadata | `CONFIGURED_NOT_INSTALLED` | Retire with fallback | No TCP 8585, in-engine catalog | `CONFIGURED_NOT_INSTALLED` | FALLBACK_READY | Data Platform | N/A | `mi-core/evidence/oss-live-inventory/openmetadata-not-installed.md` |
| 27 | Postiz | `BLOCKED_NEEDS_CREDENTIAL` | Blocked - needs credential | No API key configured | `BLOCKED_NEEDS_CREDENTIAL` | BLOCKED | Marketing | N/A | Requires Postiz API key to be configured |
| 28 | Windmill | `RETIRED_WITH_REASON` | Retire | No install needed | `RETIRED_WITH_REASON` | N/A | Operations | N/A | n8n is primary workflow engine |
| 29 | ActivePieces | `RETIRED_WITH_REASON` | Retire | No install needed | `RETIRED_WITH_REASON` | N/A | Operations | N/A | n8n is primary workflow engine |
| 30 | Browser Use | `RETIRED_WITH_REASON` | Retire | No install needed | `RETIRED_WITH_REASON` | N/A | Engineering | N/A | Playwright is primary browser operator |
| 31 | OpenClaw | `RETIRED_WITH_REASON` | Retire | No install needed | `RETIRED_WITH_REASON` | N/A | Engineering | N/A | Playwright is primary browser operator |
| 32 | Stagehand | `RETIRED_WITH_REASON` | Retire | No install needed | `RETIRED_WITH_REASON` | N/A | Engineering | N/A | Playwright is primary browser operator |
| 33-38 | Qwen Coder, DeepSeek Coder, Kimi, OpenHands, Aider, Continue | `RETIRED_WITH_REASON` | Retire | No install needed | `RETIRED_WITH_REASON` | N/A | Engineering | N/A | Claude Opus 4.6 is primary coding brain |
| 39 | Meltano | `RETIRED_WITH_REASON` | Retire | No install needed | `RETIRED_WITH_REASON` | N/A | Data Platform | N/A | Airbyte is primary ETL |
| 40 | Superset | `RETIRED_WITH_REASON` | Retire | No install needed | `RETIRED_WITH_REASON` | N/A | Data Platform | N/A | Metabase is primary BI |
| 41-43 | Penpot, Immich, PhotoPrism | `RETIRED_WITH_REASON` | Retire | No install needed | `RETIRED_WITH_REASON` | N/A | Creative | N/A | Managed via creative-preview + file storage |
| 44-45 | Kopia, Prometheus | `RETIRED_WITH_REASON` | Retire | No install needed | `RETIRED_WITH_REASON` | N/A | IT | N/A | Cloud provider snapshots + Uptime Kuma |
| 46-47 | Ory, Cerbos | `RETIRED_WITH_REASON` | Retire | No install needed | `RETIRED_WITH_REASON` | N/A | IT | N/A | Keycloak and OpenFGA+OPA are primary |
| 48-50 | Infisical, Vault, Wazuh | `RETIRED_WITH_REASON` | Retire | No install needed | `RETIRED_WITH_REASON` | N/A | IT | N/A | In-engine secrets + audit-log |
| 51-52 | KuzuDB, Neo4j | `RETIRED_WITH_REASON` | Retire | No install needed | `RETIRED_WITH_REASON` | N/A | Data Platform | N/A | Graphology serves graph traversal |
| 53 | Chroma | `RETIRED_WITH_REASON` | Retire | No install needed | `RETIRED_WITH_REASON` | N/A | Data Platform | N/A | Qdrant is primary vector DB |
| 54 | MLflow | `RETIRED_WITH_REASON` | Retire | No install needed | `RETIRED_WITH_REASON` | N/A | Data Platform | N/A | In-engine memory + evidence system |
| 55-56 | Fider, OpenSearch | `RETIRED_WITH_REASON` | Retire | No install needed | `RETIRED_WITH_REASON` | N/A | CX/Marketing | N/A | WhatsApp pipeline + in-engine search |

---

## Summary

| Category | Count |
|----------|-------|
| OSS verified LIVE_INSTALLED | 7 |
| OSS CONFIGURED_NOT_INSTALLED with FALLBACK_READY | 19 |
| OSS BLOCKED_NEEDS_CREDENTIAL | 1 |
| OSS RETIRED_WITH_REASON | 29 |
| OSS BROKEN_INSTALLED | 0 |
| Total actions | 56 |

**No OSS requires immediate installation to achieve FALLBACK_READY state.**
**All missing OSS have documented in-engine fallback.**
**All RETIRED OSS have documented CTO reason.**
