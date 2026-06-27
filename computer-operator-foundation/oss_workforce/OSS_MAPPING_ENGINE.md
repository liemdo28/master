# OSS_MAPPING_ENGINE.md — Business Capability → OSS Chain

**Generated:** 2026-06-27  
**Purpose:** Map business capabilities to their OSS tool chains  
**Governed by:** Mi-Core Mapping Engine

---

## Business Capability → OSS Stack Mapping

### DoorDash Revenue Automation

```
Business Goal: Automate DoorDash menu monitoring and data ingestion
Capability: Browser Automation → Data Pipeline → Workflow Orchestration

OSS Chain:
  Playwright (Browser Worker)
       ↓  (scrapes, verifies)
  Browser Use (Adaptive Browser Worker)
       ↓  (routes, decides)
  n8n (Workflow Worker)
       ↓  (orchestrates, alerts)
  DuckDB (Warehouse Worker)
       ↓  (stores, analyzes)
  Metabase (Reporting Worker)
       ↓  (visualizes, reports)
  PostHog (Product Analytics)
       ↓  (tracks engagement)
  → CEO Dashboard
```

### Financial Warehouse Intelligence

```
Business Goal: Revenue tracking, store ranking, CFO question answering
Capability: Data Ingestion → Transformation → Analytics → Reporting

OSS Chain:
  Data Sources (QB, Toast, DoorDash, GBP)
       ↓  (ingest)
  DuckDB (Warehouse Worker)
       ↓  (OLAP queries)
  dbt (Data Transformation)
       ↓  (models, joins)
  Metabase (Reporting Worker)
       ↓  (dashboards)
  PostHog (Product Analytics)
       ↓  (product KPIs)
  → CFO Dashboard → CEO
```

### Creative Studio Pipeline

```
Business Goal: AI-generated brand assets for all platforms
Capability: Image Generation → Video Processing → Design Collaboration

OSS Chain:
  ComfyUI (Image Generation)
       ↓  (generates)
  Fooocus (Image Generation UI)
       ↓  (alternative generation)
  FFmpeg (Video Processing)
       ↓  (transcodes, clips)
  Penpot (Design Platform)
       ↓  (collaborative design)
  → Creative Asset Library
```

### IT Operations Observability

```
Business Goal: Full-stack monitoring, logging, backup, alerting
Capability: Monitoring → Logging → Backup → Alerting

OSS Chain:
  OpenObserve (Logs & Monitoring)
       ↓  (structured logs)
  Prometheus (Metrics Monitoring)
       ↓  (time-series metrics)
  Grafana (Observability Dashboards)
       ↓  (visualizes)
  Uptime Kuma (Health Monitoring)
       ↓  (uptime alerts)
  Kopia (Backup Worker)
       ↓  (incremental S3 backup)
  → IT Dashboard
```

### Marketing Intelligence

```
Business Goal: Multi-channel marketing automation and analytics
Capability: Automation → Publishing → Analytics → Integration

OSS Chain:
  Mautic (Marketing Automation)
       ↓  (email automation)
  Postiz (Social Publishing)
       ↓  (multi-platform posts)
  Airbyte (Data Integration)
       ↓  (pipelines)
  PostHog (Product Analytics)
       ↓  (product analytics)
  Plausible (Web Analytics)
       ↓  (privacy-friendly web stats)
  → Marketing Dashboard
```

---

## OSS Dependency Graph

```
                    ┌──────────────┐
                    │  Data Sources │
                    │QB/Toast/DD/GBP│
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │    DuckDB    │
                    │  Warehouse   │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
       ┌──────▼──┐   ┌─────▼────┐ ┌───▼────┐
       │   dbt   │   │Metabase  │ │PostHog │
       │Transform│   │Reporting │ │Analytics│
       └─────────┘   └──────────┘ └────────┘
                           │
                    ┌──────▼───────┐
                    │ CEO Dashboard │
                    └──────────────┘

Browser Stack:
  Playwright ──→ Browser Use ──→ n8n ──→ Actions

Creative Stack:
  ComfyUI ──→ FFmpeg ──→ Penpot ──→ Asset Library

IT Stack:
  OpenObserve ──→ Prometheus ──→ Grafana
       │                           │
  Uptime Kuma                 Uptime Alerts
       │
  Kopia ──→ S3 Backup
```

---

## OSS Usage by Project

| Project | Primary OSS | Supporting OSS | Pipeline Health |
|---------|------------|----------------|----------------|
| DoorDash | Playwright | Browser Use, n8n | ✅ Healthy |
| Financial Warehouse | DuckDB | dbt, Metabase | ✅ Healthy |
| SEO Automation | n8n | Playwright | ✅ Healthy |
| Product Analytics | PostHog | Airbyte | 🟡 Needs scorecard |
| Creative Studio | ComfyUI | FFmpeg, Penpot | 🔴 No scorecard |
| IT Ops | OpenObserve | Prometheus, Grafana | 🟡 Partial |
