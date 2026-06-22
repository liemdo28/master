# Execution Memory
**Phase 15.3 — ExecutionMemory**
**Status: PRODUCTION**

---

## Purpose

Tracks every work order execution per project — how often, with what intent, with what outcome. Identifies which workflows (agent role chains) succeed most reliably.

---

## Questions Answered

| Question | Function |
|----------|----------|
| How many times was Dashboard audited? | `getProjectExecutionStats('dashboard')` |
| What is Dashboard's success rate? | `stats.success_rate` |
| Which workflow works best? | `getBestWorkflows()` |
| Which intent is most common for a project? | `stats.most_common_intent` |

---

## Project Execution Stats

```typescript
interface ProjectExecutionStats {
  total_executions: number;
  pass_count: number;
  fail_count: number;
  success_rate: number;         // 0-100
  avg_duration_ms: number;
  most_common_intent: string;
  last_execution: string;
  executions: ExecutionSummary[];
}
```

---

## Best Workflow Detection

`getBestWorkflows()` groups executions by `(agent_roles JSON, intent)` and ranks by:
1. Most `PASS` verdicts
2. Highest total count (tie-breaker)

This identifies which role chain has proven most effective for a given task type.

---

## Example — Dashboard Stats (from acceptance test)

| Metric | Value |
|--------|-------|
| Total executions | 20 |
| Pass | 16 (80%) |
| Fail | 4 (20%) |
| Most common intent | `audit_project` |
| Avg duration | ~45s |

---

## API

```
GET /api/memory/executions                   — all executions + by-project summary + best workflows
GET /api/memory/executions?project=dashboard — filter to one project
GET /api/memory/executions/:project          — full stats for a project
```

**Filter params:** `project`, `intent`, `verdict`, `from` (ISO date), `limit`
