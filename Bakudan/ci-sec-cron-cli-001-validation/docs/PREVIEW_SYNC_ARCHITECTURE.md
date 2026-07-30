# Main → Preview Sync Architecture
**Phase 11.7 — Operational Readiness Sprint**
**Date:** 2026-05-30
**Status:** ARCHITECTURAL DESIGN

---

## Objective

CEO must review realistic production data on preview without ever allowing preview to write back to production.

**Key constraint:** One-way only: `Production → Preview (15-minute lag)`

---

## Architecture Overview

```
┌─────────────────┐       ┌─────────────────┐
│   PRODUCTION    │       │    PREVIEW      │
│  dashboard.     │       │  preview.       │
│  bakudanramen.  │       │  bakudanramen.  │
│  com            │       │  com            │
└────────┬────────┘       └────────▲────────┘
         │  mysqldump / RDS Snapshot / pg_dump
         │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━►
         │           15-minute sync window
         │  One-way: Production → Preview ONLY
         │  Preview DB is READ-ONLY from app code
         └───────────────────────────────────────
                   NEVER: Preview → Production
```

---

## Sync Scope (Allowed)

| Table / Entity | Sync Direction | Rationale |
|---------------|---------------|-----------|
| `stores` | Main → Preview | Real store structure |
| `projects` | Main → Preview | Live project inventory |
| `tasks` | Main → Preview | Active work queue |
| `employees` | Main → Preview | Current workforce |
| `training_modules` | Main → Preview | Training curriculum |
| `calendar_events` | Main → Preview | Company calendar |
| `bills` | Main → Preview | Financial obligations |
| `users` | Main → Preview | Active team roster |
| `shifts` | Main → Preview | Current schedule |

---

## Excluded (Never Sync)

| Table / Entity | Reason |
|---------------|--------|
| `sessions` | Security: preview must never inherit production sessions |
| `release_drafts` | Drafts should not leak to preview |
| `adoption_analytics` | Aggregated metrics are environment-specific |
| `preview_only_data` | Any data flagged `environment = 'preview'` |
| `password_reset_tokens` | Security |
| `api_keys` | Security |
| `notifications` (user-level) | Noise; rebuild on preview |
| `email_queue` | Pending emails must not be sent from preview |

---

## Implementation Options

### Option A — MySQL Replication (Recommended for RDS/MySQL Cloud)

```sql
-- On PRODUCTION (source)
-- Binary log must be enabled
SHOW VARIABLES LIKE 'log_bin';

-- Create replication user on PRODUCTION
CREATE USER 'preview_sync'@'%' IDENTIFIED BY 'REPLACE_WITH_SECURE_PASSWORD';
GRANT SELECT, LOCK TABLES ON dashboard_bakudanramen.* TO 'preview_sync'@'%';

-- On PREVIEW (replica)
CHANGE REPLICATION SOURCE TO
  SOURCE_HOST = 'production.rds.amazonaws.com',
  SOURCE_USER = 'preview_sync',
  SOURCE_PASSWORD = 'REPLACE_WITH_SECURE_PASSWORD',
  SOURCE_LOG_FILE = 'mysql-bin.000001',
  SOURCE_LOG_POS = 4,
  GET_SOURCE_PUBLIC_KEY = 1;

START REPLICA;
```

**Pros:** Near-real-time, automated, no app changes needed
**Cons:** Requires DBA access; replica lag must be monitored

### Option B — Hourly Snapshot Restore (RDS / Cloud SQL)

```bash
#!/bin/bash
# sync_preview.sh — Run via cron every 15 minutes
# Run on PREVIEW server

TIMESTAMP=$(date +%Y%m%d_%H%M)
PREVIEW_DB="dashboard_preview"
PRODUCTION_HOST="production.rds.amazonaws.com"
SNAPSHOT_ID="rds:snapshot-xxxxxxxx"  # Latest automated backup

# 1. Create snapshot from production
aws rds create-db-snapshot \
  --db-instance-identifier prod-bakudanramen \
  --db-snapshot-identifier "preview-sync-${TIMESTAMP}" \
  --tags Key=Environment,Value=Preview Key=Purpose,Value=CEO-Review

# 2. Wait for snapshot (up to 30 min)
aws rds wait db-snapshot-available \
  --db-snapshot-identifier "preview-sync-${TIMESTAMP}"

# 3. Restore to preview instance (creates new instance)
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier preview-restore-temp \
  --db-snapshot-identifier "preview-sync-${TIMESTAMP}" \
  --db-instance-class db.t3.medium

# 4. Rename preview instance (brief outage)
aws rds modify-db-instance \
  --db-instance-identifier preview-bakudanramen \
  --final-db-snapshot-identifier "preview-final-${TIMESTAMP}"

# 5. Promote temp restore
aws rds modify-db-instance \
  --db-instance-identifier preview-restore-temp \
  --new-db-instance-identifier preview-bakudanramen \
  --apply-immediately

# 6. Cleanup old snapshots (keep last 3)
aws rds describe-db-snapshots \
  --query "DBsnapshots[?contains(DBInstanceIdentifier,'bakudanramen')].[DBSnapshotIdentifier,SnapshotCreateTime]" \
  --output table
```

**Pros:** Clean, complete data restore; no partial sync issues
**Cons:** 15-30 min downtime every sync cycle; heavy on I/O

### Option C — Selective Dump (Application-Layer Sync)

```bash
#!/bin/bash
# sync_preview_selective.sh
# Run on MAIN server, pushes to PREVIEW server via SSH

TABLES="stores projects tasks employees training_modules calendar_events bills users shifts"
DUMP_FILE="/tmp/preview_sync_$(date +%Y%m%d_%H%M).sql.gz"

mysqldump -h localhost -u app \
  --single-transaction \
  --ignore-table=dashboard_bakudanramen.sessions \
  --ignore-table=dashboard_bakudanramen.email_queue \
  --ignore-table=dashboard_bakudanramen.release_drafts \
  $TABLES | gzip > $DUMP_FILE

# Push to preview server
scp -i ~/.ssh/preview_key $DUMP_FILE \
  deploy@preview.bakudanramen.com:/tmp/

# Apply on preview
ssh -i ~/.ssh/preview_key deploy@preview.bakudanramen.com \
  "zcat /tmp/$(basename $DUMP_FILE) | mysql -h localhost -u preview_app preview_dashboard"
```

**Pros:** No downtime; selective; fast
**Cons:** Custom script maintenance; eventual consistency

---

## Recommended: Option C (Selective Dump)

Rationale:
- 15-minute cron is sufficient for CEO review
- No app code changes required
- Full control over excluded tables
- Easy to audit/explain to stakeholders

---

## Preview Environment Isolation

### 1. Database User Permissions (Preview)

```sql
-- Preview DB: app user has SELECT only (no INSERT/UPDATE/DELETE from PHP)
-- Separate admin user for migrations only

GRANT SELECT, INSERT, UPDATE, DELETE
ON dashboard_preview.*
TO 'app_preview'@'%';  -- Only used by app

-- For admin scripts / migrations:
GRANT ALL PRIVILEGES
ON dashboard_preview.*
TO 'admin_preview'@'localhost'
REQUIRE SSL;
```

### 2. Application Firewall Rule

```php
// In config/database.php
// Detect preview environment and enforce read-only
if (getenv('APP_ENV') === 'preview') {
    // Block all write operations from app code
    // Only migrations and sync scripts can write
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        // Log attempted write
        error_log('[PREVIEW-WRITE-BLOCK] '
            . ($_SESSION['user_name'] ?? 'unknown') . ' attempted '
            . $_SERVER['REQUEST_METHOD'] . ' '
            . $_SERVER['REQUEST_URI']);
        // Return 403 for non-GET requests from app
        http_response_code(403);
        die('Preview environment: write operations are disabled.');
    }
}
```

### 3. Environment Variables

```bash
# .env.preview
APP_ENV=preview
PREVIEW_MODE=1
PREVIEW_SYNC_HOST=production.rds.amazonaws.com
PREVIEW_SYNC_USER=preview_sync
PREVIEW_SYNC_PASS=... (from secrets manager)
PREVIEW_READ_ONLY=true
```

---

## Sync Schedule

| Time | Action |
|------|--------|
| `*/15 * * * *` | Selective dump from Main → restore on Preview |
| `0 2 * * *` | Full schema validation (table/column check) |
| `0 3 * * 0` | Full DB comparison report (row counts, delta) |

---

## Monitoring

```sql
-- On Preview: Log last sync time
CREATE TABLE IF NOT EXISTS sync_metadata (
    id INT PRIMARY KEY AUTO_INCREMENT,
    table_name VARCHAR(128),
    last_synced_at DATETIME,
    row_count INT,
    UNIQUE KEY (table_name)
);

-- Verification query (run after each sync)
SELECT table_name, last_synced_at, row_count,
       TIMESTAMPDIFF(MINUTE, last_synced_at, NOW()) AS minutes_ago
FROM sync_metadata
ORDER BY last_synced_at ASC;
```

---

## Validation Checklist

- [ ] Preview DB is confirmed read-only from app code
- [ ] Sync runs every 15 minutes
- [ ] Excluded tables confirmed (sessions, drafts, queues)
- [ ] Sync lag < 15 minutes (confirmed via `sync_metadata`)
- [ ] No preview server IP can write to production DB
- [ ] CEO review: data looks like production (stores, tasks, users present)
- [ ] Email queue: confirmed empty on preview (no test emails sent)
- [ ] Session table: confirmed empty on preview
