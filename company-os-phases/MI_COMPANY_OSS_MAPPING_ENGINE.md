# MI_COMPANY_OSS_MAPPING_ENGINE.md — Master OSS Mapping Engine

**Generated:** 2026-06-27
**Purpose:** Map OSS to business capabilities across phases 11-20

---

## Business Capability → OSS Chain Mapping

### Revenue Operations

```
Business Goal: Track restaurant revenue across all locations
OSS Chain:
  DoorDash (external) → Playwright (scrape) → n8n (orchestrate) → DuckDB (warehouse) → dbt (transform) → CFO Dashboard
```

### Marketing Operations

```
Business Goal: Multi-channel marketing automation
OSS Chain:
  Google Business Profile → Playwright (scrape) → n8n (workflow) → PostHog (analytics) → Marketing Dashboard
```

### IT Operations

```
Business Goal: Full-stack monitoring and alerting
OSS Chain:
  Services → OpenTelemetry (trace) → OpenObserve (logs) → Uptime Kuma (uptime) → IT Dashboard
```

### AI/ML Operations

```
Business Goal: LLM tracing and memory
OSS Chain:
  Mi Core → Langfuse (traces) → Postgres pgvector (memory) → Memory Stores
```

### Authorization & Policy

```
Business Goal: Fine-grained authorization
OSS Chain:
  Request → OpenFGA (authorization) → OPA (policy) → Decision
```

### Data Integration

```
Business Goal: Multi-source data pipeline
OSS Chain:
  Sources (QB, DoorDash, Toast) → Airbyte (ingest) → DuckDB (warehouse) → dbt (transform) → Reports
```

---

## OSS → Division Mapping

| Division | OSS Stack |
|----------|-----------|
| Operations | n8n, Playwright, Browser Use, Uptime Kuma |
| Finance | DuckDB, dbt, Postgres pgvector |
| Marketing | PostHog, Airbyte, Playwright |
| IT | OpenObserve, OpenTelemetry, Uptime Kuma, OpenFGA, OPA |
| Engineering | Langfuse, Playwright, Aider, OpenHands |
| Executive | All OSS (read access) |

---

## Status: ✅ MASTER_OSS_MAPPING_ENGINE_COMPLETE
