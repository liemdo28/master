# Preview Synchronization Validation
**Phase 11.8 — Pre-Production Certification**
**Date:** 2026-05-30
**Status:** READY FOR VALIDATION

---

## Objective

Verify:
1. Production → Preview sync works every 15 minutes
2. Preview CANNOT write back to production

---

## Architecture Reference

See: `docs/PREVIEW_SYNC_ARCHITECTURE.md`

```
Production → (15 min) → Preview (one-way only)
Preview → Production: BLOCKED
```

---

## Validation 1 — Sync Direction (Production → Preview)

### Test Steps

| Step | Action | Expected | Result |
|------|--------|----------|--------|
| 1.1 | Create task on Production | Task exists in production DB | [PENDING] |
| 1.2 | Wait 15 minutes | Sync cycle runs | [PENDING] |
| 1.3 | Check Preview DB for task | Task appears on Preview | [PENDING] |
| 1.4 | Verify task data matches | Title, due_date, assignee match | [PENDING] |

### Verification Query (on Preview)

```sql
-- After sync, verify the test task arrived
SELECT id, title, due_date, created_at
FROM tasks
WHERE title = 'Sync Validation Test Task'
ORDER BY created_at DESC LIMIT 1;
```

---

## Validation 2 — Write Block (Preview → Production)

### Test Steps

| Step | Action | Expected | Result |
|------|--------|----------|--------|
| 2.1 | Attempt POST on Preview | HTTP 403 or redirect | [PENDING] |
| 2.2 | Attempt task creation on Preview | Blocked by APP_ENV check | [PENDING] |
| 2.3 | Check production DB | No new records from Preview | [PENDING] |
| 2.4 | Check error log on Preview | Write attempt logged | [PENDING] |

### Verification (on Production)

```sql
-- Verify no records created from Preview
SELECT COUNT(*) FROM tasks
WHERE title LIKE '%Preview Write Test%';
-- Expected: 0
```

---

## Validation 3 — Excluded Tables

### Verify these tables are NOT synced to Preview

| Table | Check Method | Expected on Preview | Result |
|-------|-------------|--------------------|----|
| `sessions` | `SELECT COUNT(*) FROM sessions` | 0 (empty) | [PENDING] |
| `email_queue` | `SELECT COUNT(*) FROM email_queue` | 0 (empty) | [PENDING] |
| `release_drafts` | Check if table exists / is empty | Empty or absent | [PENDING] |

---

## Validation 4 — Sync Freshness

### Check sync_metadata table (if implemented)

```sql
SELECT table_name, last_synced_at,
       TIMESTAMPDIFF(MINUTE, last_synced_at, NOW()) AS minutes_ago
FROM sync_metadata
ORDER BY last_synced_at ASC;
```

**Certification Criteria:** All tables synced within last 20 minutes.

---

## Validation 5 — Data Realism

### Verify Preview has realistic production data

```sql
-- On Preview: Check data volume matches production (approximately)
SELECT
    (SELECT COUNT(*) FROM stores) AS stores,
    (SELECT COUNT(*) FROM projects WHERE is_archived = 0) AS active_projects,
    (SELECT COUNT(*) FROM tasks WHERE is_completed = 0) AS active_tasks,
    (SELECT COUNT(*) FROM users WHERE is_active = 1) AS active_users,
    (SELECT COUNT(*) FROM bills) AS bills;
```

**Certification Criteria:**
- Stores ≥ 2 (Bandera + Stone Oak minimum)
- Active projects ≥ 5
- Active tasks ≥ 10
- Active users ≥ 3
- Bills ≥ 10

---

## Validation 6 — Environment Isolation

| Check | Method | Expected | Result |
|-------|--------|----------|--------|
| APP_ENV on Preview | `getenv('APP_ENV')` | `'staging'` or `'preview'` | [PENDING] |
| Preview host | `$_SERVER['HTTP_HOST']` | `preview.dashboard.bakudanramen.com` | [PENDING] |
| DB connection | Check config | Different DB from production | [PENDING] |
| No shared sessions | Login on Preview | Does NOT affect production session | [PENDING] |

---

## Validation 7 — QA Bypass (Preview Only)

| Check | Expected | Result |
|-------|----------|--------|
| `PREVIEW_QA_BYPASS=1` on Preview | Auto-login works | [PENDING] |
| `PREVIEW_QA_BYPASS` on Production | Not set / disabled | [PENDING] |
| QA user can browse all pages | No auth errors | [PENDING] |

---

## Certification Matrix

| Validation | Status |
|-----------|--------|
| 1. Sync Direction | [PENDING] |
| 2. Write Block | [PENDING] |
| 3. Excluded Tables | [PENDING] |
| 4. Sync Freshness | [PENDING] |
| 5. Data Realism | [PENDING] |
| 6. Environment Isolation | [PENDING] |
| 7. QA Bypass | [PENDING] |

---

## Prerequisites

Before running this validation:
1. Preview environment must be deployed
2. Sync script (`sync_preview_selective.sh`) must be running on cron
3. `.env.preview` must be configured with correct DB credentials
4. `PREVIEW_QA_BYPASS=1` must be set on Preview server

---

**Overall: PENDING — Requires deployed Preview environment**
