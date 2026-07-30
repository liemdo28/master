# DRAWER TASK CERTIFICATION

**Date:** 2026-06-15  
**Status:** PASS  
**Reviewed by:** Cline (automated audit)

---

## Data Loading Path

**Route:** `GET /tasks/{id}` → `TaskController::show($id)`

**Database Tables Queried:**
| Table | Join Type | Purpose |
|---|---|---|
| `tasks` | Primary | Task record (SELECT t.*) |
| `users` (×4) | LEFT JOINs | Assignee, creator, reviewer, approver names |
| `sections` | LEFT JOIN | Board column name |
| `projects` | LEFT JOIN | Project name |
| `stores` | LEFT JOIN | Store name, color |
| `comments` | Separate query | Task comments |
| `attachments` | Separate query | File attachments |
| `task_watchers` | Separate query | Watcher list |
| `task_comments` | Separate query | Rich comments with @mentions |
| `task_reviewer_notes` | Separate query | Reviewer workspace notes |
| `task_approval_notes` | Separate query | Approval workflow notes |
| `task_stores` + `stores` | Many-to-many | Task↔store associations |
| `deadline_extensions` | Separate query | Extension history |
| `approval_history` | Separate query | Workflow state transitions |

**Variables Passed to `views/tasks/detail.php`:**
- `$task` — full task with joined user/store/project names
- `$users` — all users for dropdowns
- `$sections` — board columns for the task's project
- `$attachments` — file attachments array
- `$taskComments` — rich comments
- `$reviewerNotes` — reviewer notes
- `$approvalNotes` — approval notes
- `$approvalHistory` — workflow events
- `$extensionHistory` — deadline extensions
- `$allStores` — stores for multi-store picker
- `$taskStores` — stores assigned to this task
- `$taskStoreIds` — store IDs for checkbox state
- `$children` — rescheduled child tasks
- `$watchers` — task watchers
- `$parentTask` — parent task if rescheduled

## SQL Verification

- **No raw SQL errors detected.** All queries use parameterized placeholders (`?`)
- **No missing columns.** Task schema matches migration `2026_04_08_task_overhaul.sql` plus later additions
- **No broken foreign keys.** All JOIN targets (`users.id`, `stores.id`, `projects.id`, `sections.id`) are established tables
- **INNER JOIN on stores in bills query** could fail if `store_id` is NULL, but tasks use LEFT JOIN — no issue

## Data Fields Verified

| Field | Source | Status |
|---|---|---|
| title | `tasks.title` | PASS |
| description | `tasks.description` | PASS |
| assignee | `users.id` via `assignee_id` | PASS |
| store | `task_stores` ↔ `stores` | PASS |
| comments | `task_comments` table | PASS |
| attachments | `attachments` table | PASS |
| activity | `approval_history` table | PASS |
| review notes | `task_reviewer_notes` table | PASS |
| approval notes | `task_approval_notes` table | PASS |
| priority | `tasks.priority` | PASS |
| due_date | `tasks.due_date` | PASS |
| status | `tasks.status` | PASS |
| repeat config | `tasks.repeat_config` (JSON) | PASS |
| visibility | `tasks.visibility` | PASS |

## Drawer Integration

- `data-detail-drawer` on task links in: `my_tasks.php`, `exception_queue.php`, `workspace/index.php`, `command-center.php`, `penalties/index.php`
- Drawer fetches `/tasks/{id}` via AJAX with `X-Requested-With: XMLHttpRequest`
- Server renders full page; `extractContent()` isolates `.td-wrap` content
- CSS hides page chrome (topbar, sidebar tabs, KPI strips) inside drawer

## Issues Found

| # | Severity | Issue | Status |
|---|---|---|---|
| 1 | MEDIUM | Stale content possible if rapid clicks (old response overwrites new) | FIXED — added `activeUrl` guard in `renderFetched()` |
| 2 | LOW | Inline event handlers (`onclick`) in fetched HTML survive script stripping | ACCEPTED — all drawer-rendered content is server-generated, no user-controlled inline handlers |
| 3 | LOW | Task edit form inside drawer submits but page context is the list, not task | ACCEPTED — edit form redirects back to task page; drawer can be closed |

## Verdict

**PASS** — Task drawer loads all required data correctly with no SQL errors, no missing tables, and no broken relationships.
