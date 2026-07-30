# Dashboard 4 — Preview Migration Runbook
# Target: https://preview.dashboard.bakudanramen.com
# DB: bakudan_preview (isolated from production taskflow_db)
# Commit: 36604fd3db26776cc4238b3f3dab83bfa8dcc763
# Date: 2026-06-02

## Pre-flight: Verify Preview Isolation
```bash
# Confirm preview DB name in docker-compose
docker compose -f docker-compose.preview.yml config | findstr DB_NAME
# Expected: DB_NAME: bakudan_preview

# Confirm env.preview DB_HOST
grep DB_NAME .env.preview
# Expected: DB_NAME=bakudan_preview
```

## Step 1: Start Preview Docker
```bash
docker compose -f docker-compose.preview.yml up -d
docker compose -f docker-compose.preview.yml ps
```

## Step 2: Run Preview-Only Migrations (IDEMPOTENT — safe to re-run)
```bash
# Option A: via docker exec (recommended)
docker exec bakudan-preview-db mysql -ubakudan -ppreview_pass bakudan_preview < database/migrations/2026_04_12_task_schema_columns.sql
docker exec bakudan-preview-db mysql -ubakudan -ppreview_pass bakudan_preview < database/migrations/2026_05_28_recurrence_completion_mode.sql
docker exec bakudan-preview-db mysql -ubakudan -ppreview_pass bakudan_preview < database/migrations/2026_05_29_task_bill_finance_upgrade.sql
docker exec bakudan-preview-db mysql -ubakudan -ppreview_pass bakudan_preview < database/migrations/2026_05_30_phase12_stabilization.sql
docker exec bakudan-preview-db mysql -ubakudan -ppreview_pass bakudan_preview < database/migrations/2026_06_02_task_approval_workflow.sql
docker exec bakudan-preview-db mysql -ubakudan -ppreview_pass bakudan_preview < database/migrations/2026_06_02_release_governance.sql
docker exec bakudan-preview-db mysql -ubakudan -ppreview_pass bakudan_preview < database/migrations/2026_06_02_preview_missing_columns.sql

# Option B: via dl-migrations.php on the preview web container
# curl -s https://preview.dashboard.bakudanramen.com/dl-migrations.php
```

## Step 3: Verify Columns Added
```sql
-- Connect to preview DB
docker exec -it bakudan-preview-db mysql -ubakudan -ppreview_pass bakudan_preview

-- Verify tasks table columns
SHOW COLUMNS FROM tasks WHERE Field IN (
  'visibility', 'private_by_user_id', 'repeat_type', 'repeat_config',
  'repeat_from_mode', 'repeat_end_type', 'repeat_end_date', 'repeat_end_count',
  'estimated_time', 'approval_required', 'reviewer_id', 'approver_id'
);

-- Verify releases table columns
SHOW COLUMNS FROM releases WHERE Field IN (
  'published_by', 'scheduled_timezone'
);

-- Verify new tables
SHOW TABLES LIKE 'task_approval_events';
SHOW TABLES LIKE 'task_watchers';
SHOW TABLES LIKE 'release_versions';
SHOW TABLES LIKE 'release_approvals';
```

## Step 4: Test Functional Requirements
```bash
# Test 1: Load /tasks page
curl -s -o /dev/null -w "%{http_code}" https://preview.dashboard.bakudanramen.com/tasks
# Expected: 200

# Test 2: Create a task (requires login — use browser)
# Navigate to: https://preview.dashboard.bakudanramen.com/tasks
# Click "New Task"
# Fill: Title = "Test CEO UI Fix", Due = today + 3 days
# Save — expected: task created without error

# Test 3: Edit task — verify repeat and approval fields
# Open the task detail
# Add repeat: Daily
# Add approval: Select any reviewer
# Save — expected: repeat persists after reload

# Test 4: Repeat persists
# Re-open the task — verify repeat_type is set

# Test 5: Approval fields persist
# Re-open the task — verify reviewer_id is set
```

## Step 5: Check Error Log is Clean
```bash
# On preview container
docker exec bakudan-preview tail -20 /var/www/html/logs/errors/php-errors.log
# Expected: NO "Column not found" errors for visibility, reviewer_id, published_by

# On local log
type logs\errors\php-errors.log
# Expected: NO new errors after migration
```

## Step 6: Clear Application Cache (if applicable)
```bash
# If opcache is enabled on preview
docker exec bakudan-preview php -r "opcache_reset();"
```

## Verification Checklist
- [ ] DB_NAME = bakudan_preview (not taskflow_db) ✓
- [ ] All tasks columns present (visibility, repeat_type, approval_required, reviewer_id, approver_id) ✓
- [ ] All releases columns present (published_by, scheduled_timezone) ✓
- [ ] task_approval_events table exists ✓
- [ ] task_watchers table exists ✓
- [ ] /tasks page loads with HTTP 200 ✓
- [ ] Create task works without error ✓
- [ ] Repeat field persists after save ✓
- [ ] Approval reviewer field persists after save ✓
- [ ] PHP error log is clean (no "Column not found") ✓
- [ ] Screenshots captured: sidebar before/after ✓
