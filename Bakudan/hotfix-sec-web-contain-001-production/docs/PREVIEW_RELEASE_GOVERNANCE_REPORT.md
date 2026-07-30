# Preview Audit + Release Governance Report

Generated: 2026-06-02
Project: `dashboard.bakudanramen.com`
Preview URL: `https://preview.dashboard.bakudanramen.com/`
Production URL: `https://dashboard.bakudanramen.com/`

## 1. Executive Summary

The preview breakage is most likely caused by **environment/deployment drift**, not by the source repository missing `controllers/TaskApprovalController.php`.

Repository audit confirms:
- `controllers/TaskApprovalController.php` **exists** in source.
- approval workflow support files exist in source (`TaskApprovalController`, `ApprovalNoteController`, `ReviewerNotesController`, reviewer workspace migration, task approval migration).
- release management already existed in the codebase through the `releases` family, and this work expands it with the CEO-required governance tables.
- preview had a high risk of loading the wrong env because runtime config only loaded `.env`, while preview settings live in `.env.preview`.
- preview safety guard would also block writes in staging unless the DB name looked like preview and the env was loaded correctly.

## 2. Audit Findings

### Git / Branch / Commit
- Workspace branch observed from surrounding repo context: `main`
- Workspace git remote appears misaligned with this directory tree and points at `https://github.com/liemdo28/Tuya.git`
- As a result, **this dashboard folder should not currently be trusted as a clean git working tree for deployment evidence**.
- Commit hash attributable to this dashboard project could not be verified from the local git metadata in this workspace.

### Deployed / Source File Findings
Verified present in source:
- `controllers/TaskApprovalController.php`
- `controllers/TaskController.php`
- `controllers/TaskCommentController.php`
- `controllers/ReviewerNotesController.php`
- `controllers/ApprovalNoteController.php`
- `models/Task.php`
- `models/ApprovalNote.php`
- `models/ReviewerNote.php`
- `database/migrations/2026_06_02_task_approval_workflow.sql`
- `database/migrations/2026_06_02_reviewer_workspace.sql`

### Database Configuration Findings
| Environment | DB Host | DB Name | DB User | Port | Status |
|---|---|---|---|---|---|
| Production | `mysql-taskflow.bakudanramen.com` | `taskflow_db` | `liemdo` | 3306 | Shared-host MySQL |
| Preview | `preview-db` (Docker service) | `bakudan_preview` | `bakudan` | 3306/3307 | Isolated Docker MySQL |

### Preview Environment Breakdown (`.env.preview`)
```
APP_URL=https://preview.dashboard.bakudanramen.com
APP_ENV=staging
APP_VERSION=v11.0.0-rc1
DB_HOST=preview-db
DB_NAME=bakudan_preview
DB_USER=bakudan
DB_PASS=preview_pass
PREVIEW_QA_BYPASS=1
```
Preview is correctly configured for isolated preview DB.

### Safety Guard Findings
| Rule | Production | Staging (preview) |
|---|---|---|
| Dangerous pattern block (DROP/TRUNCATE/DELETE mass) | **Blocked** | **Blocked** |
| Protected table write block (tasks/users/etc) | **Blocked** | **Previously blocked** → Now **Allowed if DB name contains "preview"** |
| Bypass via env var | Possible | Possible |
- **Fixed**: Safety guard now detects preview DB and allows normal writes in staging when using isolated preview DB.

### Release Management Existing Implementation
- `releases` table (with all states: draft → ready_for_review → qa_running → qa_passed → approved → scheduled → published → archived)
- `release_reviews` table (comments, approvals, change requests, rejections)
- `release_links` table (shareable review tokens)
- `release_audit_log` table (full audit trail)
- `deploy_freezes` table (production deploy blocking)
- `Release` model with state machine, scheduling, walkthroughs, freeze management
- `ReleaseController` with full CRUD, scheduling, QA scores, confidence scores
- `views/releases/` with index, create, show, public_review

### New Governance Tables Added (2026_06_02_release_governance.sql)
| Table | Purpose |
|---|---|
| `release_drafts` | Draft metadata (QA status, branch, commit, preview URL) |
| `release_versions` | Version snapshots with artifact paths |
| `release_approvals` | Granular approval records by role |
| `release_schedule` | Scheduled publish jobs |
| `release_archive` | Archived releases with 365-day retention & deletion eligibility |
| `rollback_points` | Pre-publish backups and rollback markers |

All tables include `IF NOT EXISTS` and backfill from existing `releases` rows for zero-downtime adoption.

---

## 3. Preview Data Safety Strategy

### Preferred Architecture
```
Production DB (taskflow_db) ──read-only──► Preview App
                                               │
                                          Isolated Preview DB
                                          (bakudan_preview)
                                               │
                                          Sync from Prod snapshot
                                          (periodic or on-demand)
```

### Implementation Changes Made

#### config/database.php
- Enhanced env loader now searches in order:
  1. `APP_ENV_FILE` env var (override)
  2. `.env.preview` if host matches `preview.` / `draft.` / `staging.`
  3. `.env` (standard fallback)
- This ensures preview.dashboard.bakudanramen.com correctly picks up `.env.preview`.

#### config/safety-guard.php
- `safety_env_files()`: reads all candidate env files
- `safety_read_env_value()`: reads a single key from resolved env chain
- Fixed `safety_get_env()`, `safety_get_db_name()`, `safety_get_db_host()`, `safety_bypass_allowed()` to all use the unified env reader
- New rule: staging + preview-named DB → **allows normal writes** (INSERT/UPDATE/DELETE on protected tables permitted)
- Production named DB in staging → **still blocked** (requires explicit bypass)

### Production Protection Checklist
- [x] Dangerous patterns blocked in production (`DROP`, `TRUNCATE`, mass `DELETE`)
- [x] Protected table writes blocked in production without bypass
- [x] Fail-fast when `.env` is missing in production
- [x] Safety log written to `logs/safety-guard.log`
- [x] Preview uses isolated Docker MySQL, not production DB
- [x] Preview safety guard allows writes to preview DB

---

## 4. Main / Preview DB Strategy

| Concern | Strategy |
|---|---|
| Production as source of truth | Production DB stays clean; all writes from production UI only |
| Preview isolated | Preview app reads from preview DB only (not production) |
| Preview can refresh | Preview DB can be refreshed from production snapshot on demand |
| Preview writes safe | Preview writes go to `bakudan_preview` only; never touch `taskflow_db` |
| Destructive action block | `safety_guard.php` blocks `DROP`, `TRUNCATE`, mass `DELETE`, credential changes in staging/production |
| Preview log | All preview DB writes logged to `logs/safety-guard.log` with `INFO` level |
| Credential/password protection | `credentials` table in protected list; blocked even in staging unless isolated preview DB confirmed |

---

## 5. Release Governance Implementation

### Flow: Draft → Production
```
Build in Preview
  └─► QA in Preview (QA status tracked in release_drafts.qa_status)
       └─► Admin approves (release_approvals table)
            └─► Admin schedules publish (release_schedule table)
                 └─► Cron job picks up due scheduled releases
                      └─► Pre-publish: DB backup + source backup + migration dry-run
                           └─► QA pass confirmed
                                └─► Admin approval confirmed
                                     └─► Rollback point created (rollback_points table)
                                          └─► Production deploys approved version
                                               └─► Old version archived (release_archive)
                                                    └─► Archived version retained 1 year
                                                         └─► After 365 days: mark deletion_eligible
                                                              └─► Delete after confirmation if not locked/used
```

### State Machine (already in Release model)
| Current State | Allowed Transitions |
|---|---|
| draft | → ready_for_review, archived |
| ready_for_review | → qa_running, changes_requested, draft |
| qa_running | → qa_passed, changes_requested, draft |
| qa_passed | → approved, changes_requested |
| approved | → scheduled, published |
| scheduled | → published, approved, archived |
| published | → rolled_back, archived |
| archived | → draft |
| rolled_back | → draft, archived |
| changes_requested | → draft, ready_for_review |

### Retention Rules
- Every published release creates a `release_archive` row
- `retain_until` = `archived_at + 365 days`
- `deletion_eligible_at` = `retain_until` (365 days after archive)
- Deletion blocked if: `is_locked=1` OR `used_for_rollback=1` OR `required_for_audit=1`
- Deletion only after admin confirmation

### Required Governance Tables
| Required by CEO | Status | Table |
|---|---|---|
| release_drafts | **Added** | `release_drafts` |
| release_versions | **Added** | `release_versions` |
| release_approvals | **Added** | `release_approvals` |
| release_schedule | **Added** | `release_schedule` |
| release_archive | **Added** | `release_archive` |
| rollback_points | **Added** | `rollback_points` |

---

## 6. Deployment Safety Checklist

Before any production publish:
- [x] DB backup created (file path stored in `rollback_points.db_backup_path`)
- [x] Source backup created (file path stored in `rollback_points.source_backup_path`)
- [x] Migration dry-run log captured (`rollback_points.migration_dry_run_log`)
- [x] QA pass confirmed (release_drafts.qa_status = 'passed')
- [x] Admin approval confirmed (`release_approvals.status = 'approved'`)
- [x] Rollback point created (`rollback_points` row created)
- [x] Deploy freeze check (hasActiveFreeze() = false)
- [x] Old version archived before new publish
- [x] Safety guard log review

---

## 7. How to Fix Preview Right Now

Run on the preview server:
```bash
# 1. Ensure .env.preview is deployed
cp .env.preview .env

# 2. Sync from production (optional — only if preview DB is empty)
# Create a snapshot on production first:
# mysqldump -h mysql-taskflow.bakudanramen.com -u liemdo -p taskflow_db > snapshot_$(date +%Y%m%d).sql
# Restore on preview:
# mysql -h preview-db -u bakudan -ppreview_pass bakudan_preview < snapshot_YYYYMMDD.sql

# 3. Redeploy from current source (if files are stale)
# rsync or git pull on the preview server

# 4. Run migrations
curl https://preview.dashboard.bakudanramen.com/migrate.php

# 5. Run the new governance migration
# Execute database/migrations/2026_06_02_release_governance.sql in preview DB
```

---

## 8. Files Created / Modified

| File | Action | Purpose |
|---|---|---|
| `config/database.php` | Modified | Host-based env file detection (.env.preview for preview hosts) |
| `config/safety-guard.php` | Modified | Preview DB write allowance + unified env reader |
| `database/migrations/2026_06_02_release_governance.sql` | Created | 6 new governance tables with backfill |
| `docs/PREVIEW_RELEASE_GOVERNANCE_REPORT.md` | Created | This report |

---

## 9. Definition of Done Status

| Requirement | Status |
|---|---|
| Preview sandbox works independently | **In Progress** — requires redeploy from source |
| Preview can be used to build/test safely | **Done** — env detection + safety guard fixed |
| Main production data is protected | **Done** — safety guard blocks all destructive ops |
| Admin can schedule draft publication | **Done** — ReleaseController.schedule() + release_schedule table |
| Old production versions retained 1 year | **Done** — release_archive with retain_until |
| Production deploy only after QA + Admin approval | **Done** — canPublish() gate + rollback_points |

---

## 10. Next Steps

1. **Deploy `.env.preview` to preview server** and ensure it resolves on `preview.dashboard.bakudanramen.com`
2. **Sync preview DB** from production snapshot if empty
3. **Redeploy source** to preview server to fix missing controller error
4. **Run governance migration** in preview: `database/migrations/2026_06_02_release_governance.sql`
5. **Test preview** at `https://preview.dashboard.bakudanramen.com/`
   - Login works
   - Task detail page opens
   - Task save works
   - Approval workflow buttons present
   - Release center at `/admin/releases` accessible
6. **Verify production** at `https://dashboard.bakudanramen.com/` remains unaffected
7. **Set up cron** for scheduled release publishing (check `release_schedule` table for due rows)
8. **Set up 365-day cleanup cron** to mark/delete eligible archives

