# WORKFORCE_REGISTRY.md — 3-Layer Workforce Registry

**Generated:** 2026-06-27  
**Layer 1:** Human Workforce | **Layer 2:** AI Workforce | **Layer 3:** OSS Workforce  
**Governed by:** Mi-Core Workforce Routing Engine

---

## Layer 1 — Human Workforce

| Employee ID | Name | Role | Division | Status | Hire Date |
|------------|------|------|----------|--------|-----------|
| EMP-001 | Liem Do | CEO | Executive | ACTIVE | 2024-01-01 |
| EMP-002 | Store Manager | Store Manager | Operations | ACTIVE | 2024-01-01 |
| EMP-003 | Developer | Developer | Engineering | ACTIVE | 2024-01-01 |
| EMP-004 | Designer | Designer | Creative | ACTIVE | 2024-01-01 |
| EMP-005 | Manager | Manager | Operations | ACTIVE | 2024-01-01 |

---

## Layer 2 — AI Workforce (Agents)

| Agent ID | Name | Division | Role | Status | OSS Tools Used | Tasks Completed |
|----------|------|----------|------|--------|---------------|----------------|
| AGENT-ENG-001 | Engineering Agent | Engineering | Code generation, PR review | ACTIVE | OpenHands, Aider, Continue | 0 |
| AGENT-FIN-001 | Financial Agent | Finance | Revenue tracking, store ranking | ACTIVE | DuckDB, dbt, Metabase | 0 |
| AGENT-MKT-001 | Marketing Agent | Marketing | Campaign, SEO, content | ACTIVE | PostHog, Mautic, Postiz | 0 |
| AGENT-CRE-001 | Creative Agent | Creative | Image, video generation | ACTIVE | ComfyUI, FFmpeg | 0 |
| AGENT-IT-001 | IT Agent | IT | Monitoring, backup | ACTIVE | OpenObserve, Uptime Kuma, Kopia | 0 |
| AGENT-OPS-001 | Operations Agent | Operations | Workflow orchestration | ACTIVE | n8n, Playwright, Browser Use | 0 |

---

## Layer 3 — OSS Workforce (Tools as Strategic Assets)

### Workflow Workers (Operations Division)

| OSS ID | Name | Role | Owner | Status | Lifecycle Stage | Business Value | Cost |
|--------|------|------|-------|--------|----------------|----------------|------|
| OSS-n8n | n8n | Workflow Worker | Operations | ACTIVE | PRODUCTION | SEO automation, Food Safety, Reviews, DoorDash | $0 infra |
| OSS-temporal | Temporal | Workflow Orchestration | Operations | ACTIVE | DISCOVERY | Distributed workflow engine | TBD |

### Browser Workers (IT + Operations)

| OSS ID | Name | Role | Owner | Status | Lifecycle Stage | Business Value | Cost |
|--------|------|------|-------|--------|----------------|----------------|------|
| OSS-playwright | Playwright | Browser Worker | IT | ACTIVE | PRODUCTION | DoorDash automation, Toast verification, GBP | $0 |
| OSS-browser-use | Browser Use | Adaptive Browser Worker | Operations | ACTIVE | PILOT | Dynamic web interaction for n8n workflows | $0 |
| OSS-openclaw | OpenClaw | Computer Operator Research | IT | ACTIVE | AUDIT | Gateway-style browser orchestration | TBD |

### Financial Warehouse Workers (Finance Division)

| OSS ID | Name | Role | Owner | Status | Lifecycle Stage | Business Value | Cost |
|--------|------|------|-------|--------|----------------|----------------|------|
| OSS-duckdb | DuckDB | Warehouse Worker | Finance | ACTIVE | PRODUCTION | In-process OLAP for financial intelligence | $0 |
| OSS-dbt | dbt | Data Transformation | Finance | ACTIVE | PRODUCTION | SQL-based data transformation pipeline | $0 |
| OSS-metabase | Metabase | Reporting Worker | Finance | ACTIVE | DISCOVERY | BI dashboards, CFO question engine | $0 |

### Marketing Workers (Marketing Division)

| OSS ID | Name | Role | Owner | Status | Lifecycle Stage | Business Value | Cost |
|--------|------|------|-------|--------|----------------|----------------|------|
| OSS-posthog | PostHog | Product Analytics | Marketing | ACTIVE | PRODUCTION | Product analytics, funnel tracking | $0 |
| OSS-mautic | Mautic | Marketing Automation | Marketing | ACTIVE | DISCOVERY | Email automation, lead nurturing | $0 |
| OSS-postiz | Postiz | Social Publishing | Marketing | ACTIVE | DISCOVERY | Multi-platform social media publishing | $0 |
| OSS-airbyte | Airbyte | Data Integration | Marketing | ACTIVE | DISCOVERY | Data pipeline to PostHog/warehouse | $0 |

### Creative Workers (Creative Division)

| OSS ID | Name | Role | Owner | Status | Lifecycle Stage | Business Value | Cost |
|--------|------|------|-------|--------|----------------|----------------|------|
| OSS-comfyui | ComfyUI | Image Generation | Creative | ACTIVE | DISCOVERY | AI image generation for brand assets | GPU cost |
| OSS-ffmpeg | FFmpeg | Video Processing | Creative | ACTIVE | DISCOVERY | Video transcoding, thumbnail generation | $0 |
| OSS-penpot | Penpot | Design Platform | Creative | ACTIVE | DISCOVERY | Open design collaboration | $0 |
| OSS-fooocus | Fooocus | Image Generation UI | Creative | ACTIVE | DISCOVERY | Alternative image generation | GPU cost |

### IT Operations Workers (IT Division)

| OSS ID | Name | Role | Owner | Status | Lifecycle Stage | Business Value | Cost |
|--------|------|------|-------|--------|----------------|----------------|------|
| OSS-openobserve | OpenObserve | Logs & Monitoring | IT | ACTIVE | PRODUCTION | Structured logging, traces | $0 |
| OSS-uptime-kuma | Uptime Kuma | Health Monitoring | IT | ACTIVE | PRODUCTION | Uptime monitoring, alerts | $0 |
| OSS-kopia | Kopia | Backup Worker | IT | ACTIVE | DISCOVERY | Incremental backup to S3 | $0 |
| OSS-prometheus | Prometheus | Metrics Monitoring | IT | ACTIVE | DISCOVERY | Time-series metrics | $0 |
| OSS-grafana | Grafana | Observability Dashboards | IT | ACTIVE | DISCOVERY | Metrics visualization | $0 |

---

## Workforce Summary

| Layer | Count | Active | Production | Discovery |
|-------|-------|--------|------------|-----------|
| Human | 5 | 5 | 5 | 0 |
| AI Agents | 6 | 6 | 6 | 0 |
| OSS Workers | 19 | 19 | 7 | 12 |

---

## Next Actions

1. Complete lifecycle audit for all DISCOVERY-stage OSS
2. Scorecard evaluation for all PRODUCTION OSS
3. Duplicate detection run (n8n vs Temporal, Playwright vs OpenClaw)
4. OSS ROI calculation for each production tool
