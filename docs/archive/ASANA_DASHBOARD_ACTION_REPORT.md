# ASANA_DASHBOARD_ACTION_REPORT
**Generated:** 2026-06-09

## Test: T5 — "Tạo task cho Nguyên kiểm tra Dashboard"

```
Input: "Tao task cho Nguyen kiem tra Dashboard"
Mode: visibility_dashboard
Route: chat.ts visibility_dashboard handler → action pattern detected → pipeline
Action: DashboardActionService.createTask()

NLP Extraction:
  title: "Kiểm tra Dashboard"
  assignee: "Nguyên" → resolvePerson("Nguyên") → { role: "staff", email: "nguyen@..." }
  due_date: null (not specified)
  priority: normal

Approval Draft:
  type: create-task
  risk: L2 (WRITE)
  target: http://dashboard.bakudanramen.com/api/tasks
  description: "Create task: Kiểm tra Dashboard — assigned to Nguyên"
  rollback: "Delete task from Dashboard"

Response: "✅ Tạo task: Kiểm tra Dashboard
  👤 Assign: Nguyên
  📅 Due: Chưa đặt
  🏷️ Priority: Normal
  [Approve] [Edit] [Reject]"

Model: pipeline response (not built-in dashboard stub)
✅ PASS
```

## Key Fix Applied: Intent Pre-routing (Dashboard)

Same pattern as calendar fix:
```typescript
if (intent === 'visibility_dashboard') {
  const msg = message.toLowerCase();
  if (/task|t.o|create|assign|giao|update|check/.test(msg)) {
    const pipelineOut = await runPipeline({ message, mode, history, intent: 'action' });
    return { reply: pipelineOut.reply, intent: 'action', ... };
  }
}
```

## Asana Action Service

| Method | Level | Connector Required |
|---|---|---|
| `searchTasks(query)` | L1 | ✅ ASANA_TOKEN |
| `getOverdue()` | L1 | ✅ ASANA_TOKEN |
| `getTasksForPerson(name)` | L1 | ✅ ASANA_TOKEN |
| `createTask(params)` | L2 | ✅ ASANA_TOKEN |
| `updateTask(id, updates)` | L2 | ✅ ASANA_TOKEN |
| `completeTask(id)` | L2 | ✅ ASANA_TOKEN |
| `assignTask(id, email)` | L2 | ✅ ASANA_TOKEN |

Returns `CONNECTOR_NOT_CONFIGURED` if ASANA_TOKEN missing.

## Dashboard Action Service

| Method | Level | Target |
|---|---|---|
| `getTasks()` | L1 | HTTP GET /api/tasks |
| `getSummary()` | L1 | HTTP GET /api/summary |
| `createTask(params)` | L2 | HTTP POST /api/tasks |
| `updateTask(id, updates)` | L2 | HTTP PUT /api/tasks/:id |
| `completeTask(id)` | L2 | HTTP PATCH /api/tasks/:id |
| `pullReport(type)` | L2 | HTTP GET /api/reports/:type |

Dashboard is always available (HTTP-based, no OAuth token required).

## People Resolution for Task Assignment
```
"Giao task cho Nguyên"
→ resolvePerson("Nguyên") → { name: "Nguyên", role: "staff", stores: ["raw-sushi", "bakudan"] }
→ ContactResolver.resolve("Nguyên") → { email: "nguyen@...", source: "people_memory" }
→ Assigned to: nguyen@... in task payload
```

---
ASANA_DASHBOARD_ACTION_COMPLETE
