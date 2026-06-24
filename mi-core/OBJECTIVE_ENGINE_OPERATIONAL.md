# OBJECTIVE_ENGINE_OPERATIONAL.md

**Phase:** 25A — Objective Engine  
**Status:** ✅ OPERATIONAL  
**Date:** 2026-06-24  

---

## Pipeline

```
CEO Objective
    ↓
Intent Analysis          (intent-analyzer.ts)
    ↓
Goal Classification      (goal-classifier.ts)
    ↓
Department Mapping       (department-mapper.ts)
    ↓
Task Decomposition       (task-decomposer.ts)
    ↓
Execution Plan           (index.ts)
    ↓
Approval Gates           (risk-based auto-approve / manual)
    ↓
Execute                  (via Execution Orchestrator)
    ↓
Verify                   (via Evidence Enforcer)
    ↓
Report                   (ObjectiveReport)
```

## Components

| File | Purpose |
|------|---------|
| `types.ts` | 255 lines — All TypeScript interfaces for the full pipeline |
| `intent-analyzer.ts` | 130 lines — NLP-lite intent classification from natural language |
| `goal-classifier.ts` | Quantitative / qualitative / binary goal extraction |
| `department-mapper.ts` | Maps intent category → department assignments |
| `task-decomposer.ts` | Template-based decomposition into 5-12 executable tasks |
| `index.ts` | 226 lines — Main orchestrator: create, approve, query, report |

## CEO Test Input → Mi Output

**Input:** `"Mi, increase Bakudan traffic by 20%"`

**Intent Analysis:**
- Category: `traffic-growth`
- Entity: `Bakudan`
- Metric: `organic-traffic`
- Target: `20%`
- Timeframe: `30 days` (default)
- Confidence: `0.9`

**Task Decomposition:** 12 tasks auto-generated across 8 departments:
1. Run full SEO technical audit
2. Identify content opportunities
3. Check 404 spike and broken links
4. Validate schema markup across all pages
5. Audit review signals (GBP, Yelp, TripAdvisor)
6. Generate landing pages for top-converting terms
7. Strengthen internal linking
8. Pull and analyze GSC data
9. Check local-map pack performance
10. Configure weekly monitoring & alerting
11. QA review of all SEO deliverables
12. Generate executive weekly report

**Risk Assessment:** `low` (traffic/content/seo objective)

## Risk Levels

| Risk Level | Behavior |
|------------|----------|
| `auto-approve` | No human approval needed; executes immediately |
| `low` | Requires CEO approval before execution |
| `medium` | Requires CEO approval; elevated monitoring |
| `high` | Requires CEO approval; escalation policy |
| `critical` | Blocks execution; requires explicit CTO sign-off |

## Storage

Objectives persisted to: `.mi-harness/phase25/objectives/{id}.json`

## API Access

Via CEO Command Center (`/api/ceo/objective`):
- `POST /api/ceo/objective` — Create objective
- `GET /api/ceo/objectives` — List all objectives
- `GET /api/ceo/objectives/:id` — Get objective detail
- `POST /api/ceo/objectives/:id/approve` — Approve plan
- `GET /api/ceo/objectives/:id/report` — Generate report

## Verification

```
objective_id: obj-1782298040573-g0j0j0
tasks: 12
departments: 8
plan_status: completed
verification: { completed: true, evidenceCount: 24, overallScore: 100 }
```

**VERDICT: OBJECTIVE ENGINE OPERATIONAL**
