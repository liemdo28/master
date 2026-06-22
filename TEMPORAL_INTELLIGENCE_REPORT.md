# TEMPORAL_INTELLIGENCE_REPORT

Generated: 2026-06-13
Status: DESIGN_ONLY

## Objective

Evaluate Graphiti for temporal intelligence so Mi can answer:

- Tuan truoc Dev1 lam gi?
- Thang truoc Dashboard co bao nhieu blocker?
- Du an nao giam chat luong trong 90 ngay?

## Graphiti Fit

Graphiti is designed for temporal context graphs for agents. Its useful properties for Mi:

| Capability | Relevance |
|---|---|
| Temporal facts | Store what was true and when it changed |
| Provenance | Link facts to reports, logs, messages, work orders |
| Hybrid retrieval | Combine vector, full-text, and graph traversal |
| Agent orientation | Designed for evolving operational context |

## Temporal Data Model

Temporal edge example:

```text
(Dev1)-[:OWNED {valid_from, valid_to, source}]->(Project)
(Project)-[:HAD_BLOCKER {opened_at, closed_at, severity}]->(Blocker)
(Project)-[:QUALITY_SCORE {date, score, source}]->(Certification)
```

## Required Queries

What did Dev1 do last week?

```text
Find operations where owner=Dev1 and completed_at within last week.
Return work order, project, action, result, evidence.
```

Dashboard blockers last month:

```text
Find blockers linked to Dashboard where opened_at or closed_at intersects previous month.
Group by severity and status.
```

Projects degrading over 90 days:

```text
Compare quality/readiness/incident counts over rolling 30-day windows.
Return projects with downward trend.
```

## Proposed Temporal Answer Shape

```json
{
  "question": "Thang truoc Dashboard co bao nhieu blocker?",
  "time_window": {
    "from": "2026-05-01",
    "to": "2026-05-31"
  },
  "answer": {
    "blocker_count": 4,
    "open_at_end": 1,
    "closed": 3
  },
  "evidence": ["work_orders", "qa_reports", "certification_reports"]
}
```

## Recommendation

Graphiti should be the V2 temporal layer candidate, not a replacement for the current Knowledge Search or locked execution package. Use it to track fact changes over time, especially ownership, blockers, incidents, deployment status, and workflow outcomes.

## Risks

| Risk | Mitigation |
|---|---|
| Temporal extraction noise | Require source evidence and confidence |
| Duplicate facts | Use project/entity ids and recurrence keys |
| Performance drift | Retain summaries and archive raw logs |
| Overwriting history | Use valid-time intervals instead of destructive updates |
