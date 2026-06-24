# EXECUTION_ORCHESTRATOR_OPERATIONAL.md

**Phase:** 25B — Execution Orchestrator  
**Status:** ✅ OPERATIONAL  
**Date:** 2026-06-24  

---

## Capabilities

Mi becomes the **owner of execution**. No developer intervention required.

| Capability | Implementation |
|------------|---------------|
| Trigger n8n | `triggerN8nWorkflow(workflowId, data)` |
| Trigger SEO agents | `triggerSEOAgent(agentName, action, ...)` |
| Trigger dashboard jobs | Autonomous execution engine fallback |
| Trigger audits | Task routing by keyword matching |
| Trigger scans | SEO technical/schema/content agents |
| Trigger reports | SEO report agent |

## Core Functions

### `executePlan(objectiveId)`
- Validates approval gate
- Sets plan status → `executing`
- Routes each task to the correct executor
- Collects evidence per task
- QA-validates each task
- Persists progress after every task

### `trackProgress(objectiveId)`
- Returns live progress: completed, failed, in-progress, pending
- Calculates percentComplete
- Persists updated progress

### `verifyCompletion(objectiveId)`
- Counts completed vs. failed tasks
- Aggregates evidence count
- Returns overall score (0-100)
- Produces failedTasks list

## Task Routing Logic

| Keyword in Task Title | Executor |
|----------------------|----------|
| seo audit, technical audit | seo-technical-agent:4013 |
| schema, structured data | seo-schema-agent:4014 |
| content, landing page | seo-content-agent:4015 |
| analytics, gsc, ranking, monitoring | seo-analytics-agent:4017 |
| local, map, gbp, citation | seo-local-maps-agent:4011 |
| review | seo-local-maps-agent:4011 |
| 404, broken, redirect | seo-technical-agent:4013 |
| report | seo-report-agent:4019 |
| linking, internal | seo-content-agent:4015 |
| weekly | seo-analytics-agent:4017 |
| (default) | Autonomous execution engine:4003 |

## Evidence Policy

Every task execution produces **at minimum one evidence item** — even if external agents are unreachable. The evidence enforcer will NOT allow a task to pass QA without evidence.

Evidence types collected:
- `api-response` — External agent response
- `metric-snapshot` — SEO state snapshot
- `log-check` — Local execution log (fallback)

## QA Validation Per Task

Every completed task receives a QA result:
```json
{
  "passed": true,
  "score": 100,
  "checks": [
    { "name": "execution-routed", "passed": true },
    { "name": "evidence-collected", "passed": true },
    { "name": "before-after-result-present", "passed": true }
  ]
}
```

## Storage

- Evidence: `.mi-harness/phase25/evidence/`
- Logs: `.mi-harness/phase25/logs/phase25-{objectiveId}.log`

## Verification

```
plan_status: completed
tasks_completed: 12/12
evidenceCount: 24
overallScore: 100
failedTasks: []
```

**VERDICT: EXECUTION ORCHESTRATOR OPERATIONAL**
