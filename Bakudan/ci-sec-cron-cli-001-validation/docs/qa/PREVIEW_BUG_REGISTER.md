# Preview Bug Register
# Dashboard: https://preview.dashboard.bakudanramen.com
# Source: E:\Project\Master\Bakudan\dashboard.bakudanramen.com
# Date: 2026-06-03

## BUG P0-001: Foreign Key Failure - tasks.section_id — RESOLVED

### Bug Details
| Field | Value |
|-------|-------|
| Priority | P0 |
| Status | **RESOLVED** |
| Component | Tasks |
| URL | /tasks, /tasks/{id} |
| Database | bakudan_preview |
| Resolved | 2026-06-03 |

### Symptoms
```
SQLSTATE[23000]: Integrity constraint violation: 1452 Cannot add or update a child row: 
a foreign key constraint fails (`bakudan_preview`.`tasks`, CONSTRAINT `tasks_ibfk_section`) 
```

### Root Cause
Tasks have `section_id` pointing to non-existent `sections.id`

### Fix Applied
- Script: `fix_preview_section_fk.php`
- Sets orphaned section_ids to NULL
- Creates default "To Do" sections for projects without sections

### Verification
```sql
-- Before fix
SELECT COUNT(*) FROM tasks t 
JOIN sections s ON t.section_id = s.id 
WHERE s.id IS NULL;

-- After fix
SELECT COUNT(*) FROM tasks WHERE section_id IS NOT NULL 
AND section_id NOT IN (SELECT id FROM sections);
```

### Evidence
[TODO: Add screenshot of fix execution]

---

## BUG P1-001: Task Create Modal Overlay — Pointer Events Block (NEW)
**File:** `docs/qa/P1_TASK_CREATE_MODAL_OVERLAY.md`
**Detected:** 2026-06-03 13:12 ICT

### Bug Details
| Field | Value |
|-------|-------|
| Priority | P1 |
| Status | OPEN |
| Component | Task Create Modal |
| URL | /tasks (modal: #createTaskModal) |
| Test file | `qa/playwright/02-task-create.spec.ts:93` |

### Symptoms
```
TimeoutError: locator.click: Timeout 15000ms exceeded.
<div id="createTaskModal" class="modal-overlay ct-modal open">…</div> intercepts pointer events
```
Submit button inside modal is unreachable — modal overlay div captures all clicks.

### Impact
Cascades to tests 03–09, 11 (7 skipped downstream).

### Fix Required
See `docs/qa/P1_TASK_CREATE_MODAL_OVERLAY.md` — Options A (selector fix), B (CSS z-index), C (JS click workaround).

### QA Artifacts
- `qa/artifacts/test-results/02-task-create-02---Task-Create-create-a-new-task-workflow/test-failed-1.png`
- `qa/artifacts/test-results/02-task-create-02---Task-Create-create-a-new-task-workflow/video.webm`
- `qa/artifacts/test-results/02-task-create-02---Task-Create-create-a-new-task-workflow/trace.zip`

---

## BUG P1-002: Dashboard networkidle Timeout — Test Infrastructure
**File:** `docs/qa/P1_DASHBOARD_NETWORKIDLE_TIMEOUT.md`
**Status:** OPEN (test issue, not app issue)

### Summary
Dashboard/overview pages use continuous polling — `networkidle` wait strategy never resolves. Test uses wrong load strategy.

---

## BUG P1-003: Session Lost Before Task Create — Test Infrastructure
**File:** `docs/qa/P1_SESSION_LOST_TASK_CREATE.md`
**Status:** OPEN (test issue, not app issue)

### Summary
`01-login#logout` test destroys server-side PHP session, causing subsequent tests to land on login page.

---

## BUG P0-002: Schema Drift - Missing Tables/Columns

### Bug Details
| Priority | Status |
|----------|--------|
| P0 | INVESTIGATING |

### Reported Issues
- [ ] task_comments table missing
- [ ] task_approval_events table missing
- [ ] visibility column missing
- [ ] access denied errors

### Required Migrations
```bash
# Run via migration script
curl -s https://preview.dashboard.bakudanramen.com/dl-migrations.php

# Or manually via docker
docker exec bakudan-preview-db mysql -ubakudan -ppreview_pass bakudan_preview < database/migrations/2026_04_12_task_schema_columns.sql
docker exec bakudan-preview-db mysql -ubakudan -ppreview_pass bakudan_preview < database/migrations/2026_06_02_task_approval_workflow.sql
docker exec bakudan-preview-db mysql -ubakudan -ppreview_pass bakudan_preview < database/migrations/2026_06_02_preview_missing_columns.sql
docker exec bakudan-preview-db mysql -ubakudan -ppreview_pass bakudan_preview < database/migrations/2026_06_02_reviewer_workspace.sql
docker exec bakudan-preview-db mysql -ubakudan -ppreview_pass bakudan_preview < database/migrations/2026_06_02_reviewer_workspace_v2.sql
```

### Verification
```sql
-- Check required tables exist
SHOW TABLES LIKE 'task_comments';
SHOW TABLES LIKE 'task_approval_events';
SHOW TABLES LIKE 'task_reviewer_notes';
SHOW TABLES LIKE 'task_approval_notes';
SHOW TABLES LIKE 'task_notifications';
SHOW TABLES LIKE 'task_mentions';

-- Check required columns
SHOW COLUMNS FROM tasks WHERE Field IN ('visibility', 'review_instructions', 'review_checklist');
```

---

## Verification Checklist

### P0 Issues
| Issue | Status | Evidence |
|-------|--------|----------|
| Section FK | [ ] | [TODO] |
| task_comments | [ ] | [TODO] |
| task_approval_events | [ ] | [TODO] |
| visibility column | [ ] | [TODO] |

### Core Pages
| Page | Status | Evidence |
|------|--------|----------|
| Preview Home | [ ] | [TODO] |
| Preview Tasks | [ ] | [TODO] |
| Preview Task Detail | [ ] | [TODO] |
| Preview Task Create | [ ] | [TODO] |

### Reviewer Workspace
| Feature | Status | Evidence |
|---------|--------|----------|
| Create task with review spec | [ ] | [TODO] |
| Task reload persistence | [ ] | [TODO] |
| Attachments upload | [ ] | [TODO] |
| Comments with @mentions | [ ] | [TODO] |
| Submit for review | [ ] | [TODO] |
| Reviewer workspace | [ ] | [TODO] |
| Review approve/reject | [ ] | [TODO] |
| Approver workspace | [ ] | [TODO] |
| Final accept | [ ] | [TODO] |

---

## Error Log Summary
```
[TODO: Paste PHP errors here]
```

## Console Errors
```
[TODO: Paste browser console errors here]
```

## SQL Errors
```
[TODO: Paste SQL errors here]
```

---

## Sign-off

| Check | Pass | Fail | Notes |
|-------|------|------|-------|
| Preview Home | ☐ | ☐ | |
| Preview Tasks | ☐ | ☐ | |
| Preview Task Detail | ☐ | ☐ | |
| Preview Task Create | ☐ | ☐ | |
| No PHP errors | ☐ | ☐ | |
| No SQL errors | ☐ | ☐ | |
| No console errors | ☐ | ☐ | |

**Overall Preview Status:** READY / NOT READY

**Inspected by:** _________________  
**Date:** _________________
