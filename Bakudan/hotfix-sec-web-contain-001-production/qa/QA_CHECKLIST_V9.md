# QA Checklist — Task/Bill Finance V9

## Migration
- [ ] Run: `php dl-migrations.php` or `mysql < database/migrations/2026_05_29_task_bill_finance_upgrade.sql`
- [ ] Verify `tasks` table has: `task_category`, `bill_id`, `direct_store_id`, `submitted_at`, `checked_at`, `accepted_workflow_at`, `rejected_at`, `approved_by`
- [ ] Verify `bills` table has: `finance_category`, `workflow_status`
- [ ] Verify `payments` table has: `store_id`
- [ ] Verify `task_bill_audit_log` table exists
- [ ] Verify `task_duplicate_audit` table exists

## Duplicate Prevention (Req #1)
- [ ] Complete a recurring task 3 times — verify only 1 next occurrence generated each time
- [ ] Reopen a completed recurring task, then complete it again — verify no duplicate
- [ ] Check `RecurringTaskService` and `TaskCompletionService` for open-child guard
- [ ] Visit `/admin/tasks/duplicates` — verify duplicate groups show correctly
- [ ] Archive a duplicate via admin UI — verify it still exists (soft delete)
- [ ] Merge duplicates — verify canonical task kept, others archived

## Bill + Payment Module (Req #2)
- [ ] Bills have `finance_category`: Payroll, Tax, Rent, Utility, Vendor, Insurance, Other
- [ ] Bills have `workflow_status`: draft, submitting, checking, accepted, rejected, paid
- [ ] Payment records link to bills (`payments.bill_id`)
- [ ] Bills → Payments → Bills flow works (create payment, bill auto-updates)
- [ ] Bill list UI filters by: Store, Category, Status, Due Date
- [ ] Old bill status mapped correctly: `pending` → `checking`, `paid` → `paid`

## Task Category (Req #3)
- [ ] Task has `task_category`: Payroll, Tax, Sale Receipt, Bill, Payment, Store Operation, Admin, Other
- [ ] Task list/calendar/dashboard filter by category
- [ ] Task linked to bill via `bill_id` field
- [ ] Task linked to store via `direct_store_id` or project store

## Nguyên / Sale Receipt Schedule (Req #4)
- [ ] Find existing "Nhập Sale Receipt" tasks for Nguyên
- [ ] Verify recurrence is weekly (7 days) or bi-weekly (14 days), not both
- [ ] Verify no parallel recurrence rules exist

## CEO Permission (Req #5)
- [ ] CEO/Admin visits `/admin/tasks/all` — sees all tasks across all members
- [ ] CEO can filter by: Member, Store, Category, Status, Date range
- [ ] CEO visits `/admin/tasks/by-store` — sees tasks grouped by store
- [ ] CEO visits `/admin/tasks/workflow` — sees tasks in verification stages
- [ ] Regular member visits `/admin/tasks` — redirected to dashboard (forbidden)
- [ ] Regular member does NOT see tasks of other members (visibility scoping)

## Verification Workflow (Req #6)
- [ ] Submit a task — `submitted_at` and `submitted_by` set, status = `review`
- [ ] Submitting an already-submitted task — rejected (guard)
- [ ] Checker marks task checked — `checked_at` and `checked_by` set
- [ ] Checker cannot accept — accept requires both `submitted_at` AND `checked_at`
- [ ] Manager accepts task — `accepted_workflow_at` set, status = `done`, `is_completed` = 1
- [ ] Manager rejects task — `rejected_at`, `rejected_by`, `rejection_reason` set, status = `todo`
- [ ] Rejected task can be reopened — all workflow columns cleared
- [ ] Audit log shows: submit → check → accept/reject chain with timestamps and actor names
- [ ] Task NOT marked done just because it was submitted — requires explicit accept
- [ ] Task NOT marked done just because it was checked — requires explicit accept

## Store Classification (Req #7)
- [ ] Every task resolves to a `store_id` (via project.store_id or direct_store_id or bill.store_id)
- [ ] Tasks without project have `direct_store_id` field available
- [ ] All Tasks view groups tasks by Store
- [ ] Calendar filters by Store
- [ ] Dashboard CEO shows Store summary:
  - [ ] Open tasks per store
  - [ ] Overdue tasks per store
  - [ ] Submitted (waiting check) per store
  - [ ] Accepted per store
  - [ ] Completed per store

## Seed Data (Req #8)
- [ ] Run: `php seed_v9_data.php` (CLI) or visit `/seed_v9_data.php` (as admin)
- [ ] Verify bills created in all categories
- [ ] Verify payments created for paid bills
- [ ] Verify tasks created with all categories
- [ ] Verify workflow tasks have correct stage flags
- [ ] Verify duplicate tasks created

## Regression Tests
- [ ] Existing task CRUD still works
- [ ] Task completion toggle still works
- [ ] Recurring task generation still works
- [ ] Dashboard member view still works
- [ ] Calendar view still works

## Screenshots Before/After
- [ ] Before: Task list without category filter
- [ ] After: Task list with category filter bar
- [ ] Before: Bill list without category
- [ ] After: Bill list with category badges + workflow status
- [ ] Before: CEO dashboard store summary
- [ ] After: CEO dashboard with Store breakdown (open, overdue, submitted, accepted)
- [ ] Workflow queue: submitted → checking → accepted/rejected stages
- [ ] Duplicate audit report page
- [ ] All Tasks CEO view with filters
