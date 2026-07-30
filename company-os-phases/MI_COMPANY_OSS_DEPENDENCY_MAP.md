# MI_COMPANY_OSS_DEPENDENCY_MAP.md — Master OSS Dependency Map

**Generated:** 2026-06-27
**Purpose:** Map all OSS dependencies across phases 11-20

---

## Dependency Graph

### Core Data Flow

```
External Sources (QB, DoorDash, Toast, GBP)
         │
         ▼
   DuckDB (Warehouse) ◄── Airbyte (ingestion)
         │
         ├──────────────────┐
         ▼                  ▼
     dbt (transform)    Postgres pgvector (memory)
         │                  │
         ▼                  ▼
    Financial Reports    Memory Stores (Phase 12)
         │                  │
         └────────┬─────────┘
                  ▼
            CFO Dashboard
```

### Browser Automation Stack

```
Playwright (scraper)
    │
    ├──────────────────┐
    ▼                  ▼
n8n (orchestrate)  Browser Use (adaptive)
    │
    ▼
DuckDB / Reports
```

### Observability Stack

```
Services
    │
    ▼
OpenTelemetry (trace)
    │
    ▼
OpenObserve (logs)
    │
    ▼
Uptime Kuma (uptime)
```

### Authorization Stack

```
Request
    │
    ▼
OpenFGA (authorization)
    │
    ▼
OPA (policy enforcement)
    │
    ▼
Decision
```

---

## OSS Dependencies

| OSS | Upstream Dependencies | Downstream Dependencies |
|-----|---------------------|----------------------|
| n8n | Playwright, DuckDB | Reports, Alerts |
| Playwright | External APIs | n8n, DuckDB |
| DuckDB | QB, DoorDash, Airbyte | dbt, CFO Dashboard |
| dbt | DuckDB | Reports |
| PostHog | Airbyte | Marketing Dashboard |
| OpenObserve | OpenTelemetry | Uptime Kuma |
| OpenTelemetry | All services | OpenObserve |
| Uptime Kuma | OpenObserve | Alerts |
| Langfuse | Mi Core | Memory stores |
| Postgres pgvector | Mi Core | Phase 12 memory |
| OpenFGA | Mi Core | All services |
| OPA | Mi Core | Guardrails |
| Airbyte | External APIs | DuckDB, PostHog |
| Browser Use | Playwright | n8n |

---

## Single Points of Failure

| OSS | SPOF Risk | Mitigation |
|-----|-----------|-----------|
| DuckDB | HIGH | Dual ingestion paths |
| n8n | MEDIUM | Manual fallback workflows |
| OpenFGA | HIGH | Read-only fallback |
| Postgres pgvector | HIGH | Text search fallback |
| OPA | MEDIUM | Disable policies fallback |

---

## Status: ✅ MASTER_OSS_DEPENDENCY_MAP_COMPLETE
