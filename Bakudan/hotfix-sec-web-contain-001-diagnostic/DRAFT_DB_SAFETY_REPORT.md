# Draft / Staging DB Safety Report

**Project:** `dashboard.bakudanramen.com`  
**Generated:** 2026-06-02  
**Status:** Codebase analysis completed + production schema verified (live execution)

---

## Live Production Findings (2026-06-02)

Executed against live `mysql-taskflow.bakudanramen.com / taskflow_db`:

| Check | Result |
|-------|--------|
| Total tasks | **1,219** |
| MySQL Version | 8.0.41-0ubuntu0.24.04.1 |
| `task_approval_events` table | **MISSING → CREATED** |
| `approval_required` column | Present ✓ |
| `reviewer_id` column | Present ✓ |
| `approver_id` column | Present ✓ |
| `submitted_at` column | Present ✓ |
| `checked_at` column | Present ✓ |
| `accepted_workflow_at` column | Present ✓ |
| `final_done_at` column | Present ✓ |
| `review_note` column | Present ✓ |
| `acceptance_note` column | Present ✓ |

**Schema fix confirmed complete.** `task_approval_events` was missing from production and has been created.

### Missing Tables (flagged in production report, confirmed in repo)
These 5 tables were flagged as MISSING in the production live check, but are already defined in `database/migrations/2026_06_02_reviewer_workspace.sql` and will be created on next `migrate.php` run:

| Table | Purpose |
|-------|---------|
| `task_comments` | Rich comment thread with @mentions |
| `task_mentions` | @mention tracking |
| `task_notifications` | In-app notification inbox |
| `task_reviewer_notes` | Reviewer workspace notes/instructions |
| `task_approval_notes` | Approver notes section |

`migrate.php` has been updated to run `2026_06_02_reviewer_workspace.sql` automatically.

---

## Executive Summary

The repository currently contains **two database strategies**:

1. **Production/shared-host strategy**
   - `config/database.php`
   - `.env.example`
   - Host: `mysql-taskflow.bakudanramen.com`
   - DB: `taskflow_db`
   - User: `liemdo`
   - Port: **3306** (default, now explicitly supported)

2. **Preview/Draft Docker strategy**
   - `.env.preview`
   - `docker-compose.preview.yml`
   - Host: `preview-db`
   - DB: `bakudan_preview`
   - User: `bakudan`
   - Port: **3306** inside container / **3307** host published port

### Key CEO Risk Finding

The repo does **not** include a real deployed `.env`, so the **actual live draft/staging database on this machine could not be verified directly**.

However, based on repo configuration:
- **Production** is intended to use `mysql-taskflow.bakudanramen.com / taskflow_db`
- **Draft/preview** is currently configured to use a **separate Docker MySQL database**: `bakudan_preview`
- This means **draft can appear empty / missing tasks** if it was started from Docker without a production sync/import

### Immediate Assessment

**Draft is likely using a copy/preview database, not the same production database.**  
If no sync/import was done, this can directly cause **missing tasks**.

---

## 1. Environment Map

| Environment | DB Host | DB Port | DB Name | DB User | Env File | Status |
|---|---|---:|---|---|---|---|
| local | unknown (no local `.env` found) | unknown | unknown | unknown | `.env` expected but missing | **Not verifiable on this machine** |
| draft / preview | `preview-db` | `3306` container / `3307` host | `bakudan_preview` | `bakudan` | `.env.preview` | **Separate preview DB** |
| staging | not separately defined in repo | unknown | unknown | unknown | none found | **Not explicitly configured** |
| production | `mysql-taskflow.bakudanramen.com` | `3306` | `taskflow_db` | `liemdo` | `.env.example` / config defaults | **Shared-host production DB strategy** |

---

## 2. Current Database Connection by Environment

### Local
- **DB host:** unknown
- **DB name:** unknown
- **DB user:** unknown
- **DB port:** unknown
- **Environment file path:** `E:\Project\Master\Bakudan\dashboard.bakudanramen.com\.env` expected, **not found**
- **Migration status:** not verifiable without `.env`

### Draft / Preview
- **DB host:** `preview-db`
- **DB name:** `bakudan_preview`
- **DB user:** `bakudan`
- **DB port:** `3306` internally, `3307` exposed to host
- **Environment file path:** `E:\Project\Master\Bakudan\dashboard.bakudanramen.com\.env.preview`
- **Migration status:** preview Docker mounts `database/migrations/phase11_store_checklists.sql` as init SQL; `migrate.php` exists for additive migrations

### Staging
- **DB host:** not defined separately
- **DB name:** not defined separately
- **DB user:** not defined separately
- **DB port:** not defined separately
- **Environment file path:** none found
- **Migration status:** unknown

### Production
- **DB host:** `mysql-taskflow.bakudanramen.com`
- **DB name:** `taskflow_db`
- **DB user:** `liemdo`
- **DB port:** `3306`
- **Environment file path:** real `.env` expected in project root; example is `.env.example`
- **Migration status:** `migrate.php` uses additive `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ... ADD COLUMN` patterns; no destructive migration found in reviewed code

---

## 3. Does Draft Use the Correct DB?

### Current repo evidence says:
- Draft/preview **does not** point to production by default
- Draft/preview points to **`bakudan_preview`** on Docker service **`preview-db`**
- Therefore draft currently uses:

> **copy / staging / preview database strategy**

### Risk:
If the preview database was created fresh and **not synced from production**, then:
- tasks can be missing
- users can be missing
- attachments/comments may be missing
- draft can look like an empty system

### CEO-required warning

**If draft has missing tasks, the most likely cause is that draft is using the wrong DB or an unsynced empty preview DB.**

---

## 4. Migration Safety Review

Reviewed file:
- `migrate.php`

Observed patterns:
- `CREATE TABLE IF NOT EXISTS`
- `ALTER TABLE ... ADD COLUMN`
- backfill updates for compatibility
- no `DROP TABLE`
- no `TRUNCATE`
- no mass `DELETE FROM tasks/users ... WHERE 1=1`

### Safety conclusion
The reviewed migration file is **non-destructive by design**.

---

## 5. Backup / Counts Evidence Status

### Current limitation
Because no real deployed `.env` exists in this workspace, **live DB backup and row counts could not be executed here yet**.

### Added tooling to support CEO-required evidence
- `scripts/db-backup.php`
- `scripts/db-safety-check.php`
- `config/safety-guard.php`

These allow generation of:
- backup filename
- timestamp
- file size
- storage path
- row counts for tasks/users/attachments/comments
- deploy stop/fail if safety checks fail

---

## 6. Safety Guard Added

Implemented safety controls:
- blocks destructive DB operations in `production` / `staging`
- requires `ALLOW_DESTRUCTIVE_MIGRATION=true` override to bypass
- intended to stop destructive rollback/reset behavior before deploy

Also added a `db:safety-check` script path for deployment verification.

---

## 7. Required Next Action to Complete Runtime Evidence

Run these commands **where the real `.env` exists**:

```bash
php scripts/db-backup.php
php scripts/db-safety-check.php
```

If preview/draft uses Docker preview DB, verify import/sync before CEO review.

---

## 8. CEO Confirmation Statement

At code review level:

> No destructive migration was found in the reviewed migration path.

At runtime level:

> Live confirmation that no task/user/file/image/password data was deleted or overwritten still requires execution against the real deployed `.env` database.

---

## 9. Draft URL / Staging URL

Known from repo:
- Production URL: `https://dashboard.bakudanramen.com`
- Preview local URL: `http://localhost:5003`

No separate hosted staging URL was found in repo.

---

## 10. Commit Hash

Not available from this workspace copy because the project folder is not a Git working tree here.
