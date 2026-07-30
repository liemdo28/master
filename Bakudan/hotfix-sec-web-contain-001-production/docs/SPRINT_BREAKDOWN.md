# TaskFlow — Sprint Breakdown (Jira-ready)

> Generated from gap analysis of `dashboard.bakudanramen.com` vs. Phase 1–2 spec.
> Current state audit: see section at bottom. All file refs are relative to repo root.

---

## SPRINT 1 — Stabilize Core Operations

### EPIC 1.1 — Date/Timezone Standardization
**Goal:** Single source of truth for "today", correct month nav, no off-by-one due dates.

#### STORY 1.1.1 — Create central `DateService`
- **Priority:** P0
- **Files:** new `service/DateService.php`; bootstrap in `index.php`
- **AC:**
  - `DateService::today(?string $tz = null): string` returns `Y-m-d` in workspace TZ
  - `DateService::now(?string $tz = null): DateTimeImmutable`
  - `DateService::toUtc(string $localDt, string $tz): string`
  - `DateService::fromUtc(string $utcDt, string $tz): string`
  - `DateService::monthBounds(int $year, int $month, string $tz): [startUtc, endUtc]`
  - `DateService::diffDays(string $a, string $b, string $tz): int`
  - `DateService::resolveTimezone(?int $userId): string` — workspace → user → system
- **Engineering notes:**
  - Use `DateTimeImmutable` + `DateTimeZone` exclusively
  - Default TZ from `config/app.php` constant `APP_TIMEZONE` (fallback `Asia/Ho_Chi_Minh`)
  - NO calls to `date()`, `strtotime()`, `mktime()` inside this service — only DateTimeImmutable

#### STORY 1.1.2 — Add `timezone` column to `users` + `tasks`
- **Priority:** P0
- **Files:** `migrate.php`, `models/Task.php::ensureSchema()`, `models/User.php`
- **AC:**
  - `users.timezone VARCHAR(64) NULL` (IANA name)
  - `tasks.timezone VARCHAR(64) NULL` (optional per-task override)
  - Migration backfills existing rows to workspace default
- **Engineering notes:** use idempotent `columnExists` pattern already in `models/Task.php:14-53`

#### STORY 1.1.3 — Replace scattered date logic
- **Priority:** P1
- **Files:** `views/calendar/index.php:6-49`, `controllers/api/v1/CalendarApiController.php:15-23`, `models/Task.php:200-219`, `index.php:56-62 (dueColor)`
- **AC:**
  - Every `date()`, `strtotime('today')`, `CURDATE()`, `NOW()` audited
  - `CURDATE()` in WHERE clauses replaced with parameterized `:today` bound from `DateService::today()`
  - Frontend `new Date(task.due_date)` treats value as UTC ISO, renders in user TZ
- **AC (verification):** User in a different TZ sees the same "due today" set as workspace TZ

---

### EPIC 1.2 — Recurring Engine Refactor
**Goal:** Completing a recurring task always creates a correct next occurrence; end rules honored.

#### STORY 1.2.1 — Extract `RecurringTaskService`
- **Priority:** P0
- **Files:** new `service/RecurringTaskService.php`; refactor `models/Task.php`
- **AC:**
  - `generateNextOccurrence(int $taskId): ?int` — returns new task id or null
  - `computeNextDueDate(array $task): ?string` — pure function, testable
  - `shouldContinue(array $task): bool` — checks end rules
  - Supports: `none`, `daily`, `weekly`, `monthly`, `yearly`, `custom_interval`, `weekly_multi`
- **Engineering notes:**
  - `repeat_config` JSON schema:
    ```json
    {
      "interval": 1,
      "weekdays": [1,3,5],
      "end_type": "never|date|count",
      "end_date": "2026-12-31",
      "end_count": 10,
      "occurrence_index": 0
    }
    ```
  - Month-end edge case: Jan 31 + 1 month → Feb 28/29 (use last-day-of-month clamp)

#### STORY 1.2.2 — Add end-condition columns
- **Priority:** P0
- **Files:** `models/Task.php::ensureSchema()`
- **AC:**
  - `repeat_end_type ENUM('never','date','count') DEFAULT 'never'`
  - `repeat_end_date DATE NULL`
  - `repeat_end_count INT NULL`
  - `recurring_root_id INT NULL` (points to first occurrence)
  - `occurrence_index INT DEFAULT 0`
  - `next_occurrence_due_at DATETIME NULL` — cached, updated by cron
  - `last_occurrence_generated_at DATETIME NULL`
- **AC:** Migration idempotent, no data loss

#### STORY 1.2.3 — `TaskCompletionService`
- **Priority:** P1
- **Files:** new `service/TaskCompletionService.php`; refactor `models/Task.php:296-316 (toggleComplete)`
- **AC:**
  - `complete(int $taskId, int $userId): array` — returns `{completed:true, next_task_id:?int}`
  - Calls `RecurringTaskService::generateNextOccurrence()` on complete
  - Prevents double-generation (check `last_occurrence_generated_at`)
  - Notifies watchers

#### STORY 1.2.4 — Cron job for recurring backfill
- **Priority:** P1
- **Files:** `cron.php`
- **AC:**
  - Scans tasks where `next_occurrence_due_at <= NOW()` and not generated
  - Batches generation to avoid lockup
  - Logs to `logs/recurring.log`

---

### EPIC 1.3 — Calendar Drawer Upgrade
**Goal:** Manager resolves daily ops from the drawer without page nav.

#### STORY 1.3.1 — Drawer data endpoint
- **Priority:** P0
- **Files:** `controllers/api/v1/CalendarApiController.php`
- **AC:**
  - `GET /api/v1/calendar/day/{date}` returns tasks with: title, status, priority, due_at, assignee, store, recurrence label, overdue/today badge
  - Respects user ACL

#### STORY 1.3.2 — Drawer UI component
- **Priority:** P0
- **Files:** `views/calendar/index.php`, new `assets/js/calendar-drawer.js`
- **AC:**
  - Click day → drawer slides in (desktop: right panel sticky; mobile: full-sheet)
  - Task row shows all fields from 1.3.1
  - Quick actions: Complete, Reassign, Move date, Snooze, Open
  - Keyboard: Esc closes, ↑↓ navigates task

#### STORY 1.3.3 — Quick action endpoints
- **Priority:** P1
- **Files:** `controllers/api/v1/TaskApiController.php`
- **AC:**
  - `POST /api/v1/tasks/{id}/complete`
  - `POST /api/v1/tasks/{id}/reassign` `{assignee_id}`
  - `POST /api/v1/tasks/{id}/move-date` `{due_date}`
  - `POST /api/v1/tasks/{id}/snooze` `{days}`
  - All return updated task JSON; all emit notifications

---

### EPIC 1.4 — List/Board Operational Sorting
**Goal:** Overdue and active work visually outrank completed.

#### STORY 1.4.1 — Group-by-urgency query helper
- **Priority:** P1
- **Files:** `models/Task.php`
- **AC:**
  - `getForUserGrouped(int $userId): array` returns `[overdue, in_progress, due_today, upcoming, no_date, completed]`
  - Single query with computed `urgency_bucket` column

#### STORY 1.4.2 — Filter bar
- **Priority:** P1
- **Files:** `controllers/api/v1/TaskApiController.php::buildFilters()` (line 278-309), `views/tasks/list.php`
- **AC:**
  - Add filters: `store_id`, `is_recurring`, `due_range` (today/week/month/custom)
  - Preserve filters in URL query string
  - "Saved views" (localStorage for MVP)

#### STORY 1.4.3 — Sort dropdown
- **Priority:** P2
- **AC:** due-soonest, overdue-first, priority-high-first, assignee, store, recent

---

## SPRINT 2 — Decision-Driven UI

### EPIC 2.1 — Overview redesign (command-center layout)
- **STORY 2.1.1** — Row-1 Critical KPIs (clickable → filtered queue)
- **STORY 2.1.2** — Row-2 AI focus panel + Urgent queue (uses scoring from 3.2)
- **STORY 2.1.3** — Row-3 Store health matrix + team workload matrix
- **STORY 2.1.4** — Row-4 Recurring failures + financial exceptions

### EPIC 2.2 — Role-based dashboard config
- **STORY 2.2.1** — `dashboard_modules` per-role JSON config
- **STORY 2.2.2** — CEO/Manager/Staff default views (spec §2.2)

### EPIC 2.3 — Calendar views (week agenda, my schedule, team schedule)

### EPIC 2.4 — Board card redesign + list grouping

---

## SPRINT 3 — AI Action Engine

### EPIC 3.1 — Scoring services
- **STORY 3.1.1** — `TaskUrgencyScorer` (spec §3.2 formula)
- **STORY 3.1.2** — `StoreRiskScorer` (spec §3.3)
- **STORY 3.1.3** — `WorkloadScorer` (spec §3.4)
- **DB:** cached score columns on task/store/user

### EPIC 3.2 — AI insight endpoint + card components
- Insight / Recommendation / Action card types
- `GET /api/v1/ai/insights?scope=overview|store|user`

---

## SPRINT 4 — NL Filter & Predictive

### EPIC 4.1 — Natural-language filter bar (OpenAI function-call → filter JSON)
### EPIC 4.2 — Recurring anomaly dashboard
### EPIC 4.3 — Smart rebalance suggestions

---

## Current-State Audit Summary

| Area | Status | Key refs |
|---|---|---|
| Date/TZ | ❌ No central service; mixed `date()`/`CURDATE()`/JS local | `models/Task.php:163`, `views/calendar/index.php:6-49` |
| Recurring | ⚠️ Columns exist, no engine | `models/Task.php:40-52`; no `service/RecurringTaskService.php` |
| Calendar drawer | ⚠️ Grid only, no drawer | `views/calendar/index.php` |
| List sort | ✅ Basic; missing store+recurring filters | `models/Task.php:154`, `TaskApiController.php:278` |
| Overview | ⚠️ Report-style, not action-first | `views/dashboard/overview.php` |
| Services | ❌ Only `OpenAIService.php` | `service/` |
| Schema gaps | `repeat_end_*`, `recurring_root_id`, `occurrence_index`, `next_occurrence_due_at`, `timezone`, `completed_by` |

### Top 5 to fix first
1. Recurring generation engine (no cron, no next-occurrence)
2. Timezone support (columns + DateService)
3. Calendar day-drawer
4. Extract services from `Task.php` god-model
5. Store + recurring filters in list/board
