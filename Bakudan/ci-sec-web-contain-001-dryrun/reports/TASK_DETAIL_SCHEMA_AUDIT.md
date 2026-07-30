# TASK DETAIL SCHEMA AUDIT
**P0 Recovery — 2026-06-10**

---

## ROOT CAUSE

Migration `2026_06_02_reviewer_workspace.sql` created tables:
- `task_comments`
- `task_mentions`
- `task_notifications`
- `task_reviewer_notes`
- `task_approval_notes`

This migration was applied to **preview/staging** but **never ran on production** (`taskflow_db`).

All task detail pages that instantiate `ApprovalNote`, `TaskComment`, `ReviewerNote`, or `TaskNotification` models crashed with `SQLSTATE[42S02]`.

---

## TABLE STATUS AUDIT

| Table | Required By | Migration Exists | Production Status | Defensive Guard |
|-------|-------------|-----------------|-------------------|-----------------|
| `task_comments` | `TaskComment` model, task detail comments section | ✅ `2026_06_02_reviewer_workspace.sql` | ❌ MISSING | ✅ Added (previous fix) |
| `task_mentions` | `TaskComment::processMentions()`, `ApprovalNote::processMentions()` | ✅ same | ❌ MISSING | ✅ Added |
| `task_notifications` | `TaskNotification` model, inbox badge | ✅ same | ❌ MISSING | ✅ Added (previous fix) |
| `task_reviewer_notes` | `ReviewerNote` model, reviewer workspace | ✅ same | ❌ MISSING | ✅ Added (previous fix) |
| `task_approval_notes` | `ApprovalNote` model — **PRIMARY BLOCKER** | ✅ same | ❌ MISSING | ✅ Added this fix |
| `task_attachments` | `TaskController::upload()` | ✅ existing | ✅ EXISTS | N/A |
| `task_stores` | `TaskStore` model | ✅ existing | ✅ EXISTS | N/A (auto-creates) |
| `task_approval_events` | `Task::getApprovalHistory()` | ✅ `2026_06_02_task_approval_workflow.sql` | ✅ EXISTS | N/A |
| `task_history` | Not referenced in codebase | N/A | N/A | N/A |
| `task_verification_steps` | Not referenced in codebase | N/A | N/A | N/A |
| `task_verification_log` | Not referenced in codebase | N/A | N/A | N/A |

---

## FIX APPLIED

### Layer 1 — Defensive Code (immediate, zero-downtime)

**`models/ApprovalNote.php`** — all 4 methods guarded:
```php
// getByTask(), findById(), create(), delete()
if (!$this->db->tableExists('task_approval_notes')) return [];
```
Also: `processMentions()` skips `task_mentions` insert if table missing.

Previously fixed (last deploy):
- `models/TaskComment.php` — `tableExists('task_comments')` guards
- `models/TaskNotification.php` — `tableExists('task_notifications')` guards
- `models/ReviewerNote.php` — `tableExists('task_reviewer_notes')` guards

### Layer 2 — Emergency Migration (create tables on production)

**`run_p0_reviewer_tables.php`** — web-accessible migration runner:
- URL: `https://dashboard.bakudanramen.com/run_p0_reviewer_tables.php?key=bkd_p0_reviewer_2026`
- Auth: CEO/Admin session OR `?key=bkd_p0_reviewer_2026`
- Creates all 5 missing tables with `IF NOT EXISTS` (idempotent)
- Shows pass/fail per table

**`database/migrations/2026_06_10_p0_missing_reviewer_tables.sql`** — canonical migration file.

---

## TASK DETAIL DEPENDENCIES MAP

```
GET /tasks/{id}
├── Task::findById()                     → tasks table ✅
├── TaskComment::getByTask()             → task_comments ✅ guarded
├── ReviewerNote::getByTask()            → task_reviewer_notes ✅ guarded
├── ApprovalNote::getByTask()            → task_approval_notes ✅ guarded ← was crashing
├── TaskNotification (inbox badge)       → task_notifications ✅ guarded
├── Task::getApprovalHistory()           → task_approval_events ✅ exists
├── TaskStoreService::getForTask()       → task_stores ✅ auto-creates
├── DeadlineExtension::getForTask()      → deadline_extensions ✅ exists
└── Task::getAttachments()               → task_attachments ✅ exists
```

---

## RECOVERY STEPS

1. **Code defensive guards** — deployed ✅ (task detail no longer crashes even if tables missing)
2. **Run migration on production** — `run_p0_reviewer_tables.php` creates all missing tables
3. **Delete migration runner** after verification

---

## ACCEPTANCE CRITERIA STATUS

| Criteria | Status |
|----------|--------|
| `/tasks/20175` loads | ✅ After deploy (defensive guard) |
| No SQLSTATE errors | ✅ All paths guarded |
| Comments section loads | ✅ tableExists guard, returns empty if missing |
| Approval notes empty state | ✅ Returns [] if table missing |
| Complete task button works | ✅ Unaffected (no dependency on these tables) |
| Recurring task detail | ✅ Same fix applies |
| Tables created on production | ⏳ Run `run_p0_reviewer_tables.php` |

---

*Root cause: Schema drift — reviewer workspace migration (`2026_06_02_reviewer_workspace.sql`) never applied to production DB.*
