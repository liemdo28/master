# Reviewer Workspace Schema Audit

**Date:** 2026-06-02  
**Severity:** P0  
**Issue:** Production task detail can fail with `SQLSTATE[42S02] Table taskflow_db.task_comments doesn't exist`.

## Conclusion

This is a schema drift / partial deployment issue:

```text
Code Version > Database Version
```

Reviewer Workspace code is already referenced by the task detail flow, but the matching database tables were not guaranteed to exist in production.

## Feature Matrix

| Feature | Code Exists | Migration Exists | Validated Create | Status |
|---------|-------------|------------------|------------------|--------|
| Approval Workflow columns | Yes | Yes | Yes | PASS |
| Approval Events | Yes | Yes | Yes | PASS |
| Comments | Yes | Yes | Yes | PASS after fix |
| Mentions | Yes | Yes | Yes | PASS after fix |
| Task Notifications | Yes | Yes | Yes | PASS after fix |
| Reviewer Notes | Yes | Yes | Yes | PASS after fix |
| Approval Notes | Yes | Yes | Yes | PASS after fix |

## Code References

| Table | Referenced By |
|-------|---------------|
| `task_comments` | `models/TaskComment.php`, task detail comments tab |
| `task_mentions` | `models/TaskComment.php` mention parsing |
| `task_notifications` | `models/TaskNotification.php`, inbox counts |
| `task_reviewer_notes` | `models/ReviewerNote.php`, reviewer notes tab |
| `task_approval_notes` | `models/ApprovalNote.php`, approval notes tab |
| `task_approval_events` | `models/Task.php`, approval history |

## Root Causes Found

1. `migrate.php` parsed SQL by splitting on `;` and skipping statements that started with `--`.
   Because the migration file has comment headers before each `CREATE TABLE`, the parser skipped whole table creation blocks.

2. `database/migrations/2026_06_02_reviewer_workspace.sql` used `INT UNSIGNED` for FK columns referencing `users.id` and `tasks.id`.
   The baseline schema defines those IDs as signed `INT`, so MariaDB rejected the FK with `errno: 150`.

3. `fix_schema.php` checked Reviewer Workspace tables but did not create them during confirm mode.

## Fixes Applied

- `database/migrations/2026_06_02_p0_task_detail_schema_sync.sql`
  - One safe schema package for restoring Task Detail first.
  - Includes approval columns/events and all Reviewer Workspace tables.
  - Uses only idempotent schema operations.

- `scripts/schema-feature-audit.php`
  - Generates a JSON feature/schema matrix from source references, migration files, and the active DB.

- `migrate.php`
  - Strips SQL comments before splitting statements.
  - Verifies all expected Reviewer Workspace tables after running migration.

- `database/migrations/2026_06_02_reviewer_workspace.sql`
  - Changed FK columns referencing `users.id` and `tasks.id` from `INT UNSIGNED` to `INT`.

- `database/migrations/2026_06_02_task_approval_workflow.sql`
  - Changed `task_approval_events.task_id` and `actor_user_id` to signed `INT`.

- `fix_schema.php`
  - Confirm mode now runs the Reviewer Workspace migration when those tables are missing.
  - Final verification includes all Reviewer Workspace tables.
  - Fixed undefined `REQUIRED_TOKEN` in confirm URL generation.

## Local Validation

Validation was run against a temporary MariaDB datastore using the baseline schema.

```text
task_approval_events
task_approval_notes
task_comments
task_mentions
task_notifications
task_reviewer_notes
```

`SHOW CREATE TABLE task_comments` confirmed FK-compatible columns:

```text
task_id int(11) NOT NULL
user_id int(11) NOT NULL
FOREIGN KEY (task_id) REFERENCES tasks(id)
FOREIGN KEY (user_id) REFERENCES users(id)
```

## Production Action Required

Generate the feature/schema matrix:

```bash
php scripts/schema-feature-audit.php
```

Run the schema fix in dry-run first:

```text
/fix_schema.php?token=APPROVAL_FIX_2026
```

Then run confirm only after dry-run shows the expected missing Reviewer Workspace tables:

```text
/fix_schema.php?token=APPROVAL_FIX_2026&confirm=1
```

Alternatively, run the single P0 SQL package through phpMyAdmin / MySQL admin tooling:

```text
database/migrations/2026_06_02_p0_task_detail_schema_sync.sql
```

Acceptance is not "dev says done". Acceptance is:

- `/tasks/19737` opens without `SQLSTATE[42S02]`
- `task_comments` exists
- `task_mentions` exists
- `task_notifications` exists
- `task_reviewer_notes` exists
- `task_approval_notes` exists
- `task_approval_events` exists
