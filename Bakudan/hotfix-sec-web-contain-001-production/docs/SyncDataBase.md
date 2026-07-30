# Database Sync — Production → Preview
**Canonical Deployment Procedure**
**Version:** 1.0
**Date:** 2026-05-30

---

## Overview

One-way sync: Production → Preview every 15 minutes.
Preview is READ ONLY. No write-back allowed.

---

## Step 1 — Dump Production

```bash
#!/bin/bash
# sync_production_to_preview.sh
# Run on production server or CI runner with DB access

TIMESTAMP=$(date +%Y%m%d_%H%M)
DUMP_FILE="/tmp/preview_sync_${TIMESTAMP}.sql.gz"

PROD_HOST="${DB_HOST:-mysql-taskflow.bakudanramen.com}"
PROD_DB="${DB_NAME:-taskflow_db}"
PROD_USER="${DB_USER:-liemdo}"

# Tables to sync (whitelist)
TABLES="stores users projects tasks task_stores comments notifications releases release_reviews release_audit_log release_links bills vendors employees shifts training_modules opening_checklists closing_checklists incidents calendar_events deadline_extensions penalties"

# Excluded tables (never sync)
# sessions, email_queue, release_drafts, adoption_analytics

mysqldump -h "$PROD_HOST" -u "$PROD_USER" \
  --single-transaction \
  --set-gtid-purged=OFF \
  --no-tablespaces \
  --routines=0 \
  --triggers=0 \
  $PROD_DB $TABLES | gzip > "$DUMP_FILE"

echo "[$(date)] Dump complete: $DUMP_FILE ($(du -h $DUMP_FILE | cut -f1))"
```

---

## Step 2 — Restore to Preview

```bash
#!/bin/bash
# restore_preview.sh
# Run on preview server or via SSH from CI

PREVIEW_HOST="${PREVIEW_DB_HOST:-preview-db}"
PREVIEW_DB="${PREVIEW_DB_NAME:-bakudan_preview}"
PREVIEW_USER="${PREVIEW_DB_USER:-bakudan}"
DUMP_FILE="$1"

if [ -z "$DUMP_FILE" ]; then
  echo "Usage: ./restore_preview.sh /path/to/dump.sql.gz"
  exit 1
fi

# Disable foreign key checks during restore
echo "SET FOREIGN_KEY_CHECKS=0;" | mysql -h "$PREVIEW_HOST" -u "$PREVIEW_USER" "$PREVIEW_DB"

# Restore
zcat "$DUMP_FILE" | mysql -h "$PREVIEW_HOST" -u "$PREVIEW_USER" "$PREVIEW_DB"

# Re-enable foreign key checks
echo "SET FOREIGN_KEY_CHECKS=1;" | mysql -h "$PREVIEW_HOST" -u "$PREVIEW_USER" "$PREVIEW_DB"

echo "[$(date)] Restore complete to $PREVIEW_DB"
```

---

## Step 3 — Mask Sensitive Fields

```sql
-- Run on PREVIEW after restore
-- Mask passwords (never copy real passwords)
UPDATE users SET password = '$2y$10$preview.placeholder.hash.000000000000000000000000000000';

-- Mask personal emails (keep structure, anonymize)
-- Skip admin/CEO accounts for testing
UPDATE users SET email = CONCAT('user', id, '@preview.local')
WHERE role NOT IN ('admin', 'ceo');

-- Clear sensitive tokens
UPDATE users SET password_reset_by = NULL, password_reset_at = NULL;

-- Clear telegram tokens
TRUNCATE TABLE telegram_users;

-- Clear email queue (prevent sending)
TRUNCATE TABLE email_queue;
TRUNCATE TABLE email_logs;

-- Clear sessions
DELETE FROM sessions WHERE 1=1;
```

---

## Step 4 — Verify Row Counts

```bash
#!/bin/bash
# verify_sync.sh

PROD_HOST="$DB_HOST"
PROD_DB="$DB_NAME"
PREVIEW_HOST="$PREVIEW_DB_HOST"
PREVIEW_DB="$PREVIEW_DB_NAME"

TABLES="stores users projects tasks task_stores comments notifications releases bills employees shifts"

echo "Table           | Production | Preview | Match"
echo "----------------|-----------|---------|------"

for TABLE in $TABLES; do
  PROD_COUNT=$(mysql -h "$PROD_HOST" -u "$DB_USER" -N -e "SELECT COUNT(*) FROM $TABLE" "$PROD_DB" 2>/dev/null)
  PREV_COUNT=$(mysql -h "$PREVIEW_HOST" -u "$PREVIEW_DB_USER" -N -e "SELECT COUNT(*) FROM $TABLE" "$PREVIEW_DB" 2>/dev/null)
  
  if [ "$PROD_COUNT" = "$PREV_COUNT" ]; then
    MATCH="✓"
  else
    MATCH="✗ DRIFT"
  fi
  
  printf "%-15s | %9s | %7s | %s\n" "$TABLE" "$PROD_COUNT" "$PREV_COUNT" "$MATCH"
done
```

---

## Step 5 — Schedule 15-Minute Sync

```bash
# Add to crontab on production server or CI runner
# crontab -e

*/15 * * * * /opt/scripts/sync_production_to_preview.sh >> /var/log/preview-sync.log 2>&1
```

### Monitoring

```bash
# Check last sync time
tail -1 /var/log/preview-sync.log

# Alert if sync older than 20 minutes
LAST_SYNC=$(stat -c %Y /tmp/preview_sync_*.sql.gz 2>/dev/null | sort -n | tail -1)
NOW=$(date +%s)
AGE=$(( (NOW - LAST_SYNC) / 60 ))
if [ "$AGE" -gt 20 ]; then
  echo "ALERT: Preview sync is ${AGE} minutes old"
fi
```

---

## Step 6 — Rollback Procedure

If preview becomes corrupted:

```bash
# Option A: Re-run full sync
./sync_production_to_preview.sh
./restore_preview.sh /tmp/preview_sync_latest.sql.gz

# Option B: Reset preview DB entirely
mysql -h "$PREVIEW_HOST" -u root -e "DROP DATABASE IF EXISTS bakudan_preview; CREATE DATABASE bakudan_preview;"
./restore_preview.sh /tmp/preview_sync_latest.sql.gz

# Option C: Docker reset (if using docker-compose.preview.yml)
cd /path/to/project
docker-compose -f docker-compose.preview.yml down -v
docker-compose -f docker-compose.preview.yml up -d
# Wait for DB init, then restore
```

---

## Safety Rules

| Rule | Enforcement |
|------|-------------|
| Preview NEVER writes to Production | Network firewall + DB user permissions |
| Passwords never copied | Masked in Step 3 |
| Email queue always empty on Preview | Truncated in Step 3 |
| Sessions cleared | Deleted in Step 3 |
| Sync is one-way only | Script only reads from Prod, writes to Preview |

---

## Docker Quick Start (Local Preview)

```bash
cd /path/to/project
docker-compose -f docker-compose.preview.yml up -d

# Wait for MySQL to initialize (~10s)
sleep 10

# Run migrations
docker exec bakudan-preview php migrate.php

# Import production dump
docker exec -i bakudan-preview-db mysql -u bakudan -ppreview_pass bakudan_preview < dump.sql

# Mask sensitive data
docker exec -i bakudan-preview-db mysql -u bakudan -ppreview_pass bakudan_preview < scripts/mask_preview_data.sql

# Access at http://localhost:5003
```

---

## Verification Checklist

After each sync:

- [ ] Row counts match (within 1% tolerance for active tables)
- [ ] No SQLSTATE errors on preview pages
- [ ] CEO can login and browse
- [ ] Email queue is empty
- [ ] Sessions table is empty
- [ ] Passwords are masked
