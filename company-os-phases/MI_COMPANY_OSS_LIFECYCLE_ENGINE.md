# MI_COMPANY_OSS_LIFECYCLE_ENGINE.md — Master OSS Lifecycle Engine

**Generated:** 2026-06-27
**Purpose:** Unified lifecycle management for all OSS across phases 11-20

---

## Lifecycle Stages

```
DISCOVERED → AUDIT → PILOT → PRODUCTION → MAINTENANCE → DEPRECATED → RETIRED
```

---

## Stage Definitions

| Stage | Gate Requirement | Evidence Required |
|-------|----------------|-----------------|
| DISCOVERED | None | Source URL, initial description |
| AUDIT | Code quality + license + security | Audit report |
| PILOT | Limited scope deployment | Pilot results |
| PRODUCTION | Full deployment | Production evidence |
| MAINTENANCE | Routine updates | Maintenance log |
| DEPRECATED | Successor identified | Migration plan |
| RETIRED | Decommission complete | Decommission evidence |

---

## OSS Lifecycle Pipeline

| OSS | DISCOVERED | AUDIT | PILOT | PRODUCTION | MAINTENANCE | Status |
|-----|-----------|-------|-------|-----------|------------|--------|
| n8n | — | — | — | 2024-01 | Active | ✅ PRODUCTION |
| Playwright | — | — | — | 2024-06 | Active | ✅ PRODUCTION |
| DuckDB | — | — | — | 2024-09 | Active | ✅ PRODUCTION |
| dbt | — | — | — | 2024-09 | Active | ✅ PRODUCTION |
| PostHog | — | — | — | 2024-09 | Active | ✅ PRODUCTION |
| OpenObserve | — | — | — | 2024-09 | Active | ✅ PRODUCTION |
| Uptime Kuma | — | — | — | 2024-09 | Active | ✅ PRODUCTION |
| Browser Use | 2024-12 | — | 2025-03 | — | — | 🟡 PILOT |
| Aider | 2025-01 | — | — | — | — | 🟡 DISCOVERY |
| OpenHands | 2025-01 | — | — | — | — | 🟡 DISCOVERY |
| Qwen Coder | 2025-03 | 2025-06 | — | — | — | 🟡 AUDIT |
| Langfuse | 2025-01 | — | — | 2025-03 | Active | ✅ PRODUCTION |
| OpenTelemetry | 2024-06 | — | — | 2024-09 | Active | ✅ PRODUCTION |
| Phoenix | 2025-04 | — | — | — | — | 🟡 DISCOVERY |
| Postgres pgvector | 2024-01 | — | — | 2024-06 | Active | ✅ PRODUCTION |
| OpenFGA | 2025-01 | — | — | 2025-04 | Active | ✅ PRODUCTION |
| OPA | 2025-01 | — | — | 2025-04 | Active | ✅ PRODUCTION |
| Airbyte | 2024-10 | — | — | 2024-12 | Active | ✅ PRODUCTION |

---

## Upgrade Cadence

| OSS | Current Version | Cadence | Last Update |
|-----|---------------|---------|------------|
| n8n | 1.x | Bi-weekly | 2026-06-27 |
| Playwright | 1.55.x | Monthly | 2026-06-27 |
| DuckDB | Stable | Quarterly | 2026-06-20 |
| dbt | 1.8.x | Monthly | 2026-06-15 |
| Langfuse | Latest | Monthly | 2026-06-01 |
| OpenTelemetry | Latest | Monthly | 2026-06-01 |
| OpenFGA | Latest | Monthly | 2026-06-01 |
| OPA | Latest | Monthly | 2026-06-01 |

---

## Status: ✅ MASTER_OSS_LIFECYCLE_ENGINE_COMPLETE
