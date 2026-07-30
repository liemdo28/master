-- ============================================================
-- TaskFlow — DB Verification Script
-- Run against: taskflow_db
-- Purpose: Confirm system state after cron + QA flows
-- ============================================================

-- ── 1. OVERDUE BILLS ─────────────────────────────────────────
-- Expected: 0 rows after test data cleanup (Test 4 deleted)
SELECT
    b.id,
    b.title,
    b.amount,
    b.due_date,
    b.status,
    b.is_test,
    s.name AS store_name,
    DATEDIFF(CURDATE(), b.due_date) AS days_overdue
FROM bills b
LEFT JOIN stores s ON b.store_id = s.id
WHERE b.status NOT IN ('paid')
  AND b.due_date < CURDATE()
  AND (b.is_template IS NULL OR b.is_template = 0)
  AND (b.is_test IS NULL OR b.is_test = 0)
ORDER BY b.amount DESC, days_overdue DESC;

-- ── 2. CURRENT DECISION FEED ─────────────────────────────────
-- Expected: is_active=1 rows reflect real overdue/compliance issues
SELECT
    decision_id,
    type,
    title,
    impact_level,
    impact_score,
    deadline_label,
    ignored_effect,
    business_name,
    is_active,
    generated_at
FROM decision_feed
WHERE is_active = 1
ORDER BY impact_score DESC;

-- ── 3. PENDING APPROVAL QUEUE ────────────────────────────────
-- Expected: items with status='pending' have valid expires_at
SELECT
    approval_id,
    type,
    title,
    impact_score,
    status,
    generated_at,
    expires_at,
    resolved_by,
    resolved_at
FROM approval_queue
WHERE status = 'pending'
  AND (expires_at IS NULL OR expires_at > NOW())
ORDER BY impact_score DESC;

-- ── 4. LATEST RISK SNAPSHOT ──────────────────────────────────
-- Expected: unified_risk_score matches last cron output
SELECT
    id,
    generated_at,
    unified_risk_score,
    finance_risk_score,
    operations_risk_score,
    compliance_risk_score,
    top_business_at_risk,
    top_member_at_risk,
    stale_after,
    CASE WHEN stale_after < NOW() THEN 'STALE' ELSE 'FRESH' END AS freshness
FROM risk_snapshots
ORDER BY generated_at DESC
LIMIT 5;

-- ── 5. ACTIVITY FEED (last 10 cron runs) ─────────────────────
-- Expected: most recent entry is type='cron_run', severity='info'
SELECT
    id,
    type,
    severity,
    title,
    summary,
    created_at
FROM system_activity_feed
ORDER BY created_at DESC
LIMIT 10;

-- ── 6. API TOKEN HEALTH ───────────────────────────────────────
-- Expected: no expired/revoked tokens older than 90 days
SELECT
    COUNT(*) AS total_tokens,
    SUM(CASE WHEN revoked_at IS NOT NULL THEN 1 ELSE 0 END) AS revoked,
    SUM(CASE WHEN revoked_at IS NULL AND access_token_expires_at > NOW() THEN 1 ELSE 0 END) AS active,
    SUM(CASE WHEN revoked_at IS NULL AND access_token_expires_at <= NOW() THEN 1 ELSE 0 END) AS expired_not_revoked,
    SUM(CASE WHEN revoked_at IS NOT NULL AND revoked_at < DATE_SUB(NOW(), INTERVAL 90 DAY) THEN 1 ELSE 0 END) AS stale_revoked
FROM api_tokens;

-- ── 7. DASHBOARD ASSIGNEE CHECK ──────────────────────────────
-- Expected: tasks with assignee_id have a corresponding user name
SELECT
    t.id,
    t.title,
    t.assignee_id,
    u.name AS assignee_name,
    t.due_date,
    t.status
FROM tasks t
LEFT JOIN users u ON t.assignee_id = u.id
WHERE t.assignee_id IS NOT NULL
  AND t.is_completed = 0
ORDER BY t.updated_at DESC
LIMIT 10;

-- ── 8. PROJECT VISIBILITY CHECK (admin) ──────────────────────
-- Expected: all non-archived projects visible
SELECT
    id,
    name,
    status,
    owner_id,
    created_at
FROM projects
WHERE status != 'archived'
ORDER BY created_at DESC;

-- ── 9. i18n SANITY — confirm no Vietnamese in notification titles ──
-- Expected: no Vietnamese diacritics in recent notifications
SELECT
    id,
    type,
    title,
    created_at
FROM notifications
ORDER BY created_at DESC
LIMIT 20;

-- ── 10. BILLS is_test COLUMN ─────────────────────────────────
-- Expected: column exists, Test 4 row deleted
SELECT
    id, title, amount, status, is_test, due_date
FROM bills
ORDER BY id ASC
LIMIT 20;
