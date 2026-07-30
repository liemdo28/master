# OSS_DUPLICATE_DETECTION.md — Detecting Redundancy Across All Layers

**Generated:** 2026-06-27  
**Purpose:** Prevent wasted resources from duplicate OSS, Agents, and Workflows  
**Governed by:** Mi-Core Duplicate Detection Engine

---

## Detection Rules

| Rule ID | Layer | Detection Type | Severity |
|---------|-------|---------------|----------|
| DD-OSS-001 | OSS | Same category + same capability | HIGH |
| DD-OSS-002 | OSS | Same upstream + same downstream | MEDIUM |
| DD-AGENT-001 | Agent | Same division + same role | HIGH |
| DD-WORKFLOW-001 | Workflow | Same trigger + same action | HIGH |
| DD-DEV-001 | Human | Same task assignment overlap | MEDIUM |

---

## Detected Duplicates

### OSS Layer

| Pair | Category | Overlap Score | Action |
|------|----------|--------------|--------|
| n8n ↔ Temporal | Workflow Orchestration | HIGH (80%) | Temporal remains DISCOVERY; n8n is production. No consolidation needed yet. |
| Playwright ↔ OpenClaw | Browser Automation | MEDIUM (60%) | Playwright is PRODUCTION. OpenClaw stays AUDIT. Monitor overlap. |
| Playwright ↔ Browser Use | Browser Automation | MEDIUM (50%) | Browser Use is PILOT for adaptive use cases. Complementary, not duplicate. |
| Playwright ↔ Skyvern | Browser Automation | LOW (30%) | Skyvern uses AGPL-3.0 (HIGH license risk). Do not promote. |
| Playwright ↔ Stagehand | Browser Automation | LOW (30%) | Stagehand is research. No action needed. |
| ComfyUI ↔ Fooocus | Image Generation | MEDIUM (60%) | Both DISCOVERY. Evaluate consolidation to one. |
| OpenObserve ↔ Prometheus | Observability | MEDIUM (50%) | OpenObserve covers logs/traces. Prometheus covers metrics. Complementary stack. |
| Metabase ↔ Superset | BI Reporting | MEDIUM (70%) | Both DISCOVERY. Choose one before promotion. |
| Grafana ↔ Metabase | Dashboards | LOW (40%) | Grafana is visualization layer. Metabase is BI query layer. Complementary. |
| DuckDB ↔ ERPNext | Data Storage | LOW (20%) | DuckDB is OLAP. ERPNext is ERP system. No overlap. |
| Mautic ↔ Postiz | Marketing Automation | MEDIUM (50%) | Mautic = email automation. Postiz = social publishing. Different channels — not duplicate. |
| PostHog ↔ Plausible | Web Analytics | MEDIUM (40%) | PostHog = product analytics. Plausible = privacy-first web analytics. Complementary. |
| Airbyte ↔ n8n | Data Pipelines | LOW (30%) | Airbyte = structured ETL. n8n = general workflow. Different abstraction levels. |
| FFmpeg ↔ ComfyUI | Media Processing | LOW (20%) | FFmpeg = video/audio. ComfyUI = image. No overlap. |

### Agent Layer

| Pair | Division | Overlap Score | Action |
|------|----------|--------------|--------|
| Engineering Agent ↔ OpenHands | Engineering | HIGH (80%) | Engineering Agent uses OpenHands internally. Not duplicate. |
| IT Agent ↔ Operations Agent | IT/Ops | LOW (30%) | Different divisions. IT = monitoring/infra. Ops = workflow. |

### Workflow Layer

| Pair | Trigger | Overlap Score | Action |
|------|---------|--------------|--------|
| DoorDash Scrape Workflow ↔ SEO Cron Workflow | Scheduled | LOW (20%) | Different data sources and destinations. |
| n8n DoorDash Workflow ↔ n8n SEO Workflow | Cron + Webhook | LOW (30%) | Separate workflows. No merge needed. |

---

## Duplicate Resolution Actions

| ID | Action | Owner | Priority | Status |
|----|--------|-------|---------|--------|
| DUP-001 | Consolidate ComfyUI + Fooocus to single DISCOVERY entry | Creative Lead | MEDIUM | PENDING |
| DUP-002 | Decide between Metabase vs Superset for BI reporting | Finance | MEDIUM | PENDING |
| DUP-003 | Retire Skyvern (AGPL-3.0 HIGH license risk) | IT Lead | HIGH | PENDING |
| DUP-004 | Consolidate IT observability: OpenObserve + Prometheus + Grafana into unified stack | IT Lead | LOW | BACKLOG |
| DUP-005 | Monitor n8n vs Temporal — decide at Temporal PILOT promotion | Operations | LOW | MONITORING |

---

## Automated Detection Queries

```sql
-- Find OSS with same category but different lifecycle stages
SELECT name, category, lifecycle_stage, owner_division
FROM oss_registry
WHERE category IN (
  SELECT category FROM oss_registry GROUP BY category HAVING COUNT(*) > 1
)
ORDER BY category, lifecycle_stage;

-- Find browser automation stack overlap
SELECT name, category, owner_division, lifecycle_stage
FROM oss_registry
WHERE category = 'Operator'
ORDER BY lifecycle_stage DESC;
```

---

## Summary

| Detection Type | Total Found | High Priority | Resolved |
|---------------|------------|--------------|---------|
| OSS duplicates | 14 | 4 | 0 |
| Agent duplicates | 2 | 0 | 0 |
| Workflow duplicates | 3 | 0 | 0 |
| Task overlaps | 0 | 0 | 0 |
| **Total** | **19** | **4** | **0** |

---

## Next Actions

1. **DUP-003**: Retire Skyvern (AGPL-3.0 HIGH license risk) — P1
2. **DUP-001**: Evaluate ComfyUI vs Fooocus consolidation — P2
3. **DUP-002**: Choose between Metabase vs Superset — P2
4. **DUP-005**: Monitor Temporal progression as n8n alternative — ongoing
