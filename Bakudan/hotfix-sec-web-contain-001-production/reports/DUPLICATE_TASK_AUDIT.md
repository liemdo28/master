# DUPLICATE_TASK_AUDIT.md
**Date:** 2026-06-10  
**Scope:** Task duplicate cleanup and prevention rules

## Summary

On 2026-06-10, 22 duplicate tasks were identified and removed.

### Detection Method
Hash algorithm: `md5(title_lower | store_id | due_date | assignee_id | category)`

### Cleanup Actions
- Canonical record: lowest `id` in each duplicate group
- Non-canonical duplicates: `archived_duplicate = 1`, `duplicate_reason = 'auto_dedup_2026_06'`
- All groups logged to `duplicate_resolution_log`

### Going Forward
1. Pre-create check: `POST /api/tasks/check-duplicate` — blocks creation when score >= 70
2. Daily scanner: `crons/DailyDuplicateTaskBillScanner.php` runs at 02:00
3. Admin UI: `GET /admin/duplicates` — review pending groups
4. Dashboard metrics exclude `archived_duplicate = 1` tasks

### Rules
- Score >= 70: show "Possible Duplicate" modal (Open Existing / Create Anyway / Cancel)
- Score 100 (exact hash match): strong warning
- Auto-archive NOT enabled — human review required
