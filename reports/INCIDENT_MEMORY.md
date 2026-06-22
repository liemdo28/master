# Incident Memory
**Phase 15.2 — IncidentMemory**
**Status: PRODUCTION**

---

## Purpose

Answers the question: *"Has this happened before?"* — with full context on who fixed it, when, whether it recurred, and whether it's still open.

---

## Questions Answered

| Question | Function |
|----------|----------|
| Has project X ever had incidents? | `getIncidentHistory(target)` |
| How many are resolved vs open? | `getIncidentHistory(target).resolved_count / unresolved_count` |
| Did any incident recur? | `getIncidentHistory(target).recurrence_count` |
| Who typically fixes incidents for X? | `getResolvers(target)` |
| Which projects have most incidents in 90 days? | `getTopIncidentProjects(90)` |

---

## Acceptance Test Result — Q1

> "Review Automation đã từng lỗi chưa?"

**Mi's answer:** *"Có. Review Automation đã có 5 incident(s). 3 đã xử lý, 2 còn mở. 2 incident tái diễn."*

**Detail breakdown:**
- 85 days ago — Regression suite: PR reviewer API timeout (resolved, recurred 2x)
- 60 days ago — Deploy failed: missing env var REVIEW_API_TOKEN (resolved)
- 45 days ago — TypeScript null check failure (resolved, recurred 1x)
- 20 days ago — Regression webhook 502 (open)
- 10 days ago — Port 4005 not responding (open)

---

## Incident Resolution Tracking

Incidents are created with `resolved = 0`. When a subsequent work order for the same target succeeds, the system can mark related incidents as `resolved = 1` and add `resolution_notes`.

**Recurrence detection:** `recur_count > 0` flags incidents that have been seen more than once. The fingerprint is based on `(target, action_type, error_summary pattern)`.

---

## API

```
GET /api/memory/incidents                    — list all incidents (with top projects)
GET /api/memory/incidents?target=dashboard   — history for a specific project
GET /api/memory/incidents/:target            — same via path param
```

**Filter params:** `target`, `role`, `from` (ISO date), `limit`
