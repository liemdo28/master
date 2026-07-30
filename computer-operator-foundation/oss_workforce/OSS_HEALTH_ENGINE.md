# OSS_HEALTH_ENGINE.md — OSS Health & Maintenance Tracking

**Generated:** 2026-06-27  
**Purpose:** Track version, security risk, update cadence, and production health  
**Governed by:** Mi-Core Health Engine

---

## Health Metrics Schema

Each OSS tracks:

| Metric | Description | Update Cadence |
|--------|-------------|---------------|
| current_version | Latest stable version | Weekly |
| last_audit | Date of last security/code audit | Quarterly |
| security_risk | CVEs, known vulnerabilities | Monthly |
| release_cadence | Releases per month | Monthly |
| community_activity | Stars growth, commits | Monthly |
| production_usage | Number of active projects using it | Weekly |
| uptime | Service uptime % | Daily |
| last_update | Date of last version bump | Weekly |

---

## Production OSS Health Status

| OSS | Version | Last Audit | Security Risk | Last Update | Production Usage | Health |
|-----|---------|-----------|--------------|-------------|----------------|--------|
| n8n | 1.x | 2026-06-01 | LOW | 2026-06-25 | SEO, Food Safety, Reviews, DoorDash | ✅ HEALTHY |
| Playwright | 1.55.x | 2026-06-27 | LOW | 2026-06-27 | DoorDash, Toast, GBP | ✅ HEALTHY |
| DuckDB | Stable | 2026-06-01 | LOW | 2026-06-20 | Financial Warehouse | ✅ HEALTHY |
| dbt | 1.8.x | 2026-06-01 | LOW | 2026-06-15 | Data Transformation | ✅ HEALTHY |
| PostHog | Latest | 2026-06-01 | LOW | 2026-06-20 | Product Analytics | ✅ HEALTHY |
| OpenObserve | Latest | 2026-06-01 | LOW | 2026-06-25 | IT Observability | ✅ HEALTHY |
| Uptime Kuma | Latest | 2026-06-01 | LOW | 2026-06-15 | IT Monitoring | ✅ HEALTHY |

---

## PILOT OSS Health Status

| OSS | Version | Last Audit | Security Risk | Pilot Projects | Health |
|-----|---------|-----------|--------------|---------------|--------|
| Browser Use | Latest | PENDING | MEDIUM | n8n adaptive workflows | 🟡 NEEDS AUDIT |
| OpenClaw | Latest | IN_PROGRESS | MEDIUM | Research only | 🟡 IN REVIEW |

---

## DISCOVERY OSS Health Status

| OSS | License Risk | Release Cadence | Community | Health |
|-----|------------|----------------|-----------|--------|
| Skyvern | HIGH (AGPL-3.0) | Monthly | Active | 🔴 HIGH RISK |
| Metabase | HIGH (AGPL-3.0) | Monthly | Active | 🟡 REVIEW LICENSE |
| Grafana | HIGH (AGPL-3.0) | Monthly | Very Active | 🟡 REVIEW LICENSE |
| OpenObserve | HIGH (AGPL-3.0) | Monthly | Growing | 🟡 PRODUCTION — REVIEW |
| Mautic | MEDIUM (GPL-3.0) | Monthly | Active | 🟡 OK |
| ERPNext | MEDIUM (GPL-3.0) | Monthly | Active | 🟡 OK |
| ComfyUI | MEDIUM (GPL-3.0) | Weekly | Very Active | 🟢 OK |
| Fooocus | MEDIUM (GPL-3.0) | Weekly | Growing | 🟢 OK |
| Temporal | LOW (MIT) | Monthly | Growing | 🟢 OK |
| Airbyte | LOW (MIT) | Weekly | Very Active | 🟢 OK |
| Postiz | LOW (MIT) | Monthly | Growing | 🟢 OK |
| Superset | LOW (Apache-2.0) | Monthly | Very Active | 🟢 OK |
| Kopia | LOW (Apache-2.0) | Monthly | Active | 🟢 OK |
| Prometheus | LOW (Apache-2.0) | Monthly | Very Active | 🟢 OK |
| Qwen Coder | LOW (Apache-2.0) | Monthly | Active | 🟢 OK |
| Aider | LOW (Apache-2.0) | Monthly | Active | 🟢 OK |
| Continue | LOW (Apache-2.0) | Monthly | Growing | 🟢 OK |
| OpenHands | LOW (MIT) | Weekly | Growing | 🟢 OK |
| Stagehand | LOW (MIT) | Monthly | Growing | 🟢 OK |
| Penpot | LOW (MPL-2.0) | Monthly | Active | 🟢 OK |
| FFmpeg | LOW (LGPL-2.1) | Monthly | Very Active | 🟢 OK |
| Plausible | LOW (MIT) | Monthly | Active | 🟢 OK |

---

## Security Alerts

| OSS | Alert | Severity | Action | Status |
|-----|-------|---------|--------|--------|
| Skyvern | AGPL-3.0 license — commercial use restrictions | P1 | Retire from registry | PENDING |
| Metabase | AGPL-3.0 license — evaluate commercial license | P2 | Evaluate Apache Superset alternative | PENDING |
| OpenObserve | AGPL-3.0 — in production | P2 | Monitor; evaluate future migration | MONITORING |
| Grafana | AGPL-3.0 — if used for dashboards | P2 | Limit to metrics only | PENDING |

---

## Health Check Schedule

| Cadence | Checks |
|---------|--------|
| Daily | Uptime Kuma ping, OpenObserve log volume |
| Weekly | n8n workflow runs, Playwright test passes |
| Monthly | Version updates, CVE scan, release cadence review |
| Quarterly | Full security audit, community health report, ROI recalculation |

---

## Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Version age | > 60 days | > 90 days |
| CVE count | 1 MEDIUM CVE | 1 HIGH CVE |
| Community activity drop | > 30% stars decrease | > 50% decrease |
| Uptime | < 99.5% | < 99% |

---

## Next Actions

1. Complete security audit for Browser Use (PILOT) and OpenClaw (AUDIT)
2. Resolve Skyvern AGPL-3.0 — retire from registry (P1)
3. Evaluate Superset vs Metabase — choose one before promotion (P2)
4. Establish version tracking for all PRODUCTION OSS
5. Set up CVE monitoring for all OSS
