# WORK_ORDER_KNOWLEDGE_ENGINE

Generated: 2026-06-13
Owner: Dev2
Consumer: Dev3 Mi Operating Backend

## Purpose

`WorkOrderKnowledgeService` turns a CEO request or Dev3 work order into an execution-ready knowledge packet.

Before this layer, Knowledge Universe could answer questions. After this layer, it can attach operational context that lets Dev3 decide what to run next.

## Input

```http
GET /api/work-orders/enrich?input=Mi%20oi%20kiem%20tra%20Dashboard
```

Supported query fields:

| Field | Purpose |
|---|---|
| `input` | Natural CEO request |
| `raw_request` | Existing GStack work order text |
| `work_order_type` | Structured work order type such as `dashboard_audit` |
| `target_project` | Optional project override |

## Enrichment Output

The service returns:

| Field | Meaning |
|---|---|
| `target_project` | Resolved project id, name, location, repository, owners |
| `repository` | Best known repo/path for execution |
| `known_issues` | Current project issue hints |
| `active_blockers` | Operational blockers that can stop execution |
| `previous_audits` | Source-backed Knowledge Universe audit/QA evidence |
| `deployment_history` | Known release/deploy context |
| `qa_history` | Known QA context |
| `dependencies` | Systems Dev3 must check before acting |
| `required_skills` | Skill recommendations for the work order |
| `risk_level` | P0-P3 operational risk |
| `recommended_workflow` | Ordered execution guidance |
| `evidence` | Search results backing the enrichment |

## Dashboard Acceptance Path

Input:

```text
Mi oi kiem tra Dashboard
```

Expected enrichment:

| Requirement | Source |
|---|---|
| Target project | Dashboard project seed + intent resolver |
| Repository | Project scanner or `E:/Project/Master/Bakudan/dashboard.bakudanramen.com` fallback |
| Previous audits | Knowledge search for Dashboard audit/QA/report evidence |
| Active blockers | Review Automation dependency check |
| Required skills | Dashboard, Review, GitHub, QA, Report |
| Risk level | P2 for read-only operational audit |
| Recommended workflow | Resolve project, attach evidence, run health/QA, report |

## Service Location

Implementation:

`server/src/operational/work-order-knowledge-service.ts`

API facade:

`server/src/routes/operational-knowledge.ts`

## Dev3 Contract

Dev3 should call enrichment before creating or executing a Work Order. If the response risk is `P0` or `P1` and `requires_approval=true`, Dev3 must route the action through the existing approval gate before mutating production, remote systems, or business-critical data.
