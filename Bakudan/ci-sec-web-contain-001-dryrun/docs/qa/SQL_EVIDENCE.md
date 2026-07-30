# SQL Evidence - Reviewer & Approver Workspace
# Run these queries after QA walkthrough
# Target Database: bakudan_preview

## Table Count Verification

```sql
-- Run at end of walkthrough to verify all tables have data
SELECT 'tasks' as table_name, COUNT(*) as record_count FROM tasks WHERE DATE(created_at) = CURDATE();
SELECT 'task_comments' as table_name, COUNT(*) as record_count FROM task_comments WHERE DATE(created_at) = CURDATE();
SELECT 'task_notifications' as table_name, COUNT(*) as record_count FROM task_notifications WHERE DATE(created_at) = CURDATE();
SELECT 'task_reviewer_notes' as table_name, COUNT(*) as record_count FROM task_reviewer_notes WHERE DATE(created_at) = CURDATE();
SELECT 'task_approval_notes' as table_name, COUNT(*) as record_count FROM task_approval_notes WHERE DATE(created_at) = CURDATE();
SELECT 'attachments' as table_name, COUNT(*) as record_count FROM attachments WHERE DATE(created_at) = CURDATE();
```

---

## tasks table Evidence

```sql
-- Find your test task
SELECT id, title, status, approval_required, reviewer_id, approver_id,
       reviewer_result, approver_result,
       review_instructions, review_checklist, required_evidence, required_files,
       created_at, submitted_at, reviewed_at, approved_at
FROM tasks 
WHERE DATE(created_at) = CURDATE()
ORDER BY created_at DESC;
```

**Expected columns after migration:**
- review_instructions (TEXT)
- review_checklist (JSON)
- required_evidence (JSON)
- required_files (JSON)
- reviewer_result (ENUM: pending, pass, fail, needs_info)
- reviewer_result_at (DATETIME)
- approver_result (ENUM: pending, accepted, rejected)
- approver_result_at (DATETIME)

---

## task_comments table Evidence

```sql
-- Verify comments with @mentions were created
SELECT tc.id, tc.task_id, tc.user_id, u.name as user_name, 
       tc.content, tc.comment_type, tc.created_at
FROM task_comments tc
JOIN users u ON tc.user_id = u.id
WHERE DATE(tc.created_at) = CURDATE()
ORDER BY tc.created_at DESC;
```

**Expected columns:**
- id, task_id, user_id, content, comment_type, parent_id, created_at

---

## task_notifications table Evidence

```sql
-- Verify notifications were sent
SELECT tn.id, tn.user_id, u.name as user_name, tn.type, 
       tn.title, tn.message, tn.is_read, tn.created_at
FROM task_notifications tn
JOIN users u ON tn.user_id = u.id
WHERE DATE(tn.created_at) = CURDATE()
ORDER BY tn.created_at DESC;
```

**Expected notification types:**
- mention (when @mentioned in comment)
- review_requested (when assignee submits)
- review_approved (when reviewer approves)
- acceptance_requested (when reviewer approves)
- task_accepted (when approver accepts)

---

## task_reviewer_notes table Evidence

```sql
-- Verify reviewer notes were saved
SELECT rn.id, rn.task_id, rn.user_id, u.name as reviewer_name,
       rn.note_type, rn.title, rn.content, rn.created_at
FROM task_reviewer_notes rn
JOIN users u ON rn.user_id = u.id
WHERE DATE(rn.created_at) = CURDATE()
ORDER BY rn.created_at DESC;
```

**Expected note_types:**
- instruction
- checklist
- question
- description

---

## task_approval_notes table Evidence

```sql
-- Verify approval notes were saved
SELECT an.id, an.task_id, an.user_id, u.name as approver_name,
       an.action, an.content, an.is_final, an.created_at
FROM task_approval_notes an
JOIN users u ON an.user_id = u.id
WHERE DATE(an.created_at) = CURDATE()
ORDER BY an.created_at DESC;
```

**Expected actions:**
- approved
- rejected
- requested_changes
- info_requested

---

## attachments table Evidence

```sql
-- Verify file attachments were uploaded
SELECT a.id, a.task_id, a.uploaded_by, u.name as uploaded_by_name,
       a.original_name, a.file_type, a.file_size, a.created_at
FROM attachments a
JOIN users u ON a.uploaded_by = u.id
WHERE DATE(a.created_at) = CURDATE()
ORDER BY a.created_at DESC;
```

**Expected file types:**
- png, jpg, jpeg, gif, pdf, doc, docx, xls, xlsx, etc.

---

## Workflow Status Evidence

```sql
-- Tasks by current status
SELECT status, COUNT(*) as count
FROM tasks 
WHERE DATE(created_at) = CURDATE()
GROUP BY status;

-- Reviewer decisions made
SELECT reviewer_result, COUNT(*) as count
FROM tasks 
WHERE DATE(created_at) = CURDATE() 
  AND reviewer_result IS NOT NULL
GROUP BY reviewer_result;

-- Approver decisions made
SELECT approver_result, COUNT(*) as count
FROM tasks 
WHERE DATE(created_at) = CURDATE() 
  AND approver_result IS NOT NULL
GROUP BY approver_result;

-- Tasks that reached DONE
SELECT COUNT(*) as done_count
FROM tasks 
WHERE DATE(created_at) = CURDATE() 
  AND status IN ('done', 'accepted');
```

---

## Error Check

```sql
-- Check for any NULL values where they shouldn't be
SELECT 'Missing review_instructions' as issue, COUNT(*) as count 
FROM tasks 
WHERE review_instructions IS NULL AND approval_required = 1;

SELECT 'Missing reviewer_result' as issue, COUNT(*) as count 
FROM tasks 
WHERE status = 'pending_acceptance' AND reviewer_result IS NULL;

SELECT 'Missing approver_result' as issue, COUNT(*) as count 
FROM tasks 
WHERE status = 'done' AND approver_result IS NULL;
```

---

## Database Schema Verification

```sql
-- Verify all required tables exist
SHOW TABLES LIKE 'task_comments';
SHOW TABLES LIKE 'task_reviewer_notes';
SHOW TABLES LIKE 'task_approval_notes';
SHOW TABLES LIKE 'task_notifications';
SHOW TABLES LIKE 'task_mentions';
SHOW TABLES LIKE 'attachments';

-- Verify tasks table has required columns
SHOW COLUMNS FROM tasks WHERE Field IN (
  'review_instructions',
  'review_checklist', 
  'required_evidence',
  'required_files',
  'reviewer_result',
  'reviewer_result_at',
  'reviewer_result_note',
  'approver_result',
  'approver_result_at',
  'approver_result_note'
);
```

---

## Evidence Collection

| Table | Records | Evidence (Screenshot) |
|-------|---------|---------------------|
| tasks | [TODO] | [TODO] |
| task_comments | [TODO] | [TODO] |
| task_notifications | [TODO] | [TODO] |
| task_reviewer_notes | [TODO] | [TODO] |
| task_approval_notes | [TODO] | [TODO] |
| attachments | [TODO] | [TODO] |

## Sign-off

| Criterion | Pass | Fail |
|-----------|------|------|
| tasks table populated | ☐ | ☐ |
| task_comments table populated | ☐ | ☐ |
| task_notifications table populated | ☐ | ☐ |
| task_reviewer_notes table populated | ☐ | ☐ |
| task_approval_notes table populated | ☐ | ☐ |
| attachments table populated | ☐ | ☐ |
| Task reached DONE status | ☐ | ☐ |
| No SQL errors | ☐ | ☐ |

**Database QA Status:** PASS / FAIL

**Verified by:** _________________  
**Date:** _________________
