CREATE TABLE IF NOT EXISTS maintenance_runs (
    run_key VARCHAR(120) PRIMARY KEY,
    ran_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    note VARCHAR(255) NULL
);

SET @guard = NOT EXISTS (
    SELECT 1 FROM maintenance_runs WHERE run_key = '2026_07_10_finance_task_help_instructions_v1'
);

INSERT INTO maintenance_runs (run_key, note)
SELECT '2026_07_10_finance_task_help_instructions_v1', 'Fill task descriptions with portal/login/account info so a helper can act without asking the CEO verbally'
WHERE @guard = 1;

SET @finance_project_id = (
    SELECT id FROM projects WHERE LOWER(name) = 'finance' ORDER BY id LIMIT 1
);

SET @admin_user_id = (
    SELECT id FROM users
    WHERE role IN ('admin','ceo')
    ORDER BY CASE WHEN role = 'admin' THEN 0 ELSE 1 END, id
    LIMIT 1
);

SET @b1_store_id = (
    SELECT id FROM stores
    WHERE LOWER(name) LIKE '%the rim%' OR LOWER(name) LIKE '%(b1)%' OR LOWER(name) LIKE 'b1%'
    ORDER BY id LIMIT 1
);

SET @b2_store_id = (
    SELECT id FROM stores
    WHERE LOWER(name) LIKE '%stone oak%' OR LOWER(name) LIKE '%(b2)%' OR LOWER(name) LIKE 'b2%'
    ORDER BY id LIMIT 1
);

SET @b3_store_id = (
    SELECT id FROM stores
    WHERE LOWER(name) LIKE '%bandera%' OR LOWER(name) LIKE '%(b3)%' OR LOWER(name) LIKE 'b3%'
    ORDER BY id LIMIT 1
);

SET @raw_store_id = (
    SELECT id FROM stores
    WHERE LOWER(name) LIKE '%raw stockton%' OR LOWER(name) LIKE '%stockton%' OR LOWER(name) LIKE '%raw%'
    ORDER BY id LIMIT 1
);

-- ── A. Refresh existing B1/B2/B3 Texas sales tax task descriptions ─────────
-- Portal migrated from mycpa.cpa.state.tx.us to security.app.cpa.state.tx.us on 2026-07-10.
UPDATE tasks
SET description = CASE
        WHEN title = 'B1 - File Texas Sales Tax' THEN 'Monthly Texas Comptroller sales tax filing (due by the 10th). Portal: https://security.app.cpa.state.tx.us/public/login | Username: bakudanramen210 | Password: see Credentials vault entry "Texas Comptroller - B1 Sales Tax" at /security/credentials | Calculation sheet: https://docs.google.com/spreadsheets/d/1yHTaQab-N4jNamxeCCLFE9gKu8JxCjHtIKgrIYVx1HI/edit?gid=0#gid=0'
        WHEN title = 'B2 - File Texas Sales Tax' THEN 'Monthly Texas Comptroller sales tax filing (due by the 10th). Portal: https://security.app.cpa.state.tx.us/public/login | Username: bakudanramen210 | Password: see Credentials vault entry "Texas Comptroller - B2 Sales Tax" at /security/credentials | Calculation sheet: https://docs.google.com/spreadsheets/d/1yHTaQab-N4jNamxeCCLFE9gKu8JxCjHtIKgrIYVx1HI/edit?gid=0#gid=0'
        WHEN title = 'B3 - File Texas Sales Tax' THEN 'Monthly Texas Comptroller sales tax filing (due by the 10th). Portal: https://security.app.cpa.state.tx.us/public/login | Username: bakudanramen210 | Password: see Credentials vault entry "Texas Comptroller - B3 Sales Tax" at /security/credentials | Calculation sheet: https://docs.google.com/spreadsheets/d/1yHTaQab-N4jNamxeCCLFE9gKu8JxCjHtIKgrIYVx1HI/edit?gid=0#gid=0'
        ELSE description
    END,
    updated_at = NOW()
WHERE @guard = 1
  AND title IN ('B1 - File Texas Sales Tax', 'B2 - File Texas Sales Tax', 'B3 - File Texas Sales Tax');

-- ── B. CPS Energy electric bills (B1/B2/B3) — ensure a linked task with instructions ──
UPDATE tasks t
JOIN bills b ON t.bill_id = b.id
SET t.description = CASE
        WHEN b.title = 'B1 CPS Electric' THEN 'Monthly CPS Energy electric bill payment. Portal: https://secure.cpsenergy.com/mma/wssHome.jsp | Username: Bakudanramen | Password: see Credentials vault entry "CPS Energy - B1" at /security/credentials (shared login across B1/B2/B3).'
        WHEN b.title = 'B2 CPS Electric' THEN 'Monthly CPS Energy electric bill payment. Portal: https://secure.cpsenergy.com/mma/wssHome.jsp | Username: Bakudanramen | Password: see Credentials vault entry "CPS Energy - B2" at /security/credentials (shared login across B1/B2/B3).'
        WHEN b.title = 'B3 CPS Electric' THEN 'Monthly CPS Energy electric bill payment. Portal: https://secure.cpsenergy.com/mma/wssHome.jsp | Username: Bakudanramen | Password: see Credentials vault entry "CPS Energy - B3" at /security/credentials (shared login across B1/B2/B3).'
        ELSE t.description
    END,
    t.updated_at = NOW()
WHERE @guard = 1
  AND b.title IN ('B1 CPS Electric', 'B2 CPS Electric', 'B3 CPS Electric');

INSERT INTO tasks (
    title, description, project_id, assignee_id, due_date, priority, status,
    is_completed, direct_store_id, task_category, repeat_type, repeat_config,
    bill_id, created_by, created_at, updated_at
)
SELECT
    CONCAT(b.title, ' - Pay Bill'),
    CASE
        WHEN b.title = 'B1 CPS Electric' THEN 'Monthly CPS Energy electric bill payment. Portal: https://secure.cpsenergy.com/mma/wssHome.jsp | Username: Bakudanramen | Password: see Credentials vault entry "CPS Energy - B1" at /security/credentials (shared login across B1/B2/B3).'
        WHEN b.title = 'B2 CPS Electric' THEN 'Monthly CPS Energy electric bill payment. Portal: https://secure.cpsenergy.com/mma/wssHome.jsp | Username: Bakudanramen | Password: see Credentials vault entry "CPS Energy - B2" at /security/credentials (shared login across B1/B2/B3).'
        WHEN b.title = 'B3 CPS Electric' THEN 'Monthly CPS Energy electric bill payment. Portal: https://secure.cpsenergy.com/mma/wssHome.jsp | Username: Bakudanramen | Password: see Credentials vault entry "CPS Energy - B3" at /security/credentials (shared login across B1/B2/B3).'
    END,
    @finance_project_id,
    @admin_user_id,
    b.due_date,
    'medium',
    'todo',
    0,
    b.store_id,
    'bill',
    'monthly',
    '{"interval":1,"by":"day_of_month","day_of_month":20}',
    b.id,
    @admin_user_id,
    NOW(),
    NOW()
FROM bills b
WHERE @guard = 1
  AND b.title IN ('B1 CPS Electric', 'B2 CPS Electric', 'B3 CPS Electric')
  AND b.repeat_parent_id IS NULL
  AND @finance_project_id IS NOT NULL
  AND @admin_user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM tasks t2 WHERE t2.bill_id = b.id);

-- ── C. Raw Stockton — CDTFA California sales tax (ensure bill + linked task) ──
INSERT INTO bills (
    store_id, title, vendor, amount, due_date, status, note, color,
    created_by, category, repeat_type, repeat_interval, repeat_day,
    repeat_parent_id, created_at, updated_at
)
SELECT
    @raw_store_id, 'Raw Stockton - CDTFA Sales Tax', 'CDTFA', 0.00, '2026-07-10', 'pending',
    'Confirm actual CDTFA filing frequency (monthly/quarterly) for this account - due day set as placeholder.',
    NULL, NULL, 'tax', 'monthly', 1, 10, NULL, NOW(), NOW()
WHERE @guard = 1
  AND @raw_store_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM bills
      WHERE store_id = @raw_store_id
        AND (LOWER(vendor) LIKE '%cdtfa%' OR LOWER(title) LIKE '%cdtfa%' OR LOWER(title) LIKE '%sales tax%')
        AND (is_archived = 0 OR is_archived IS NULL)
  );

INSERT INTO tasks (
    title, description, project_id, assignee_id, due_date, priority, status,
    is_completed, direct_store_id, task_category, repeat_type, repeat_config,
    bill_id, created_by, created_at, updated_at
)
SELECT
    'Raw Stockton - File CDTFA Sales Tax',
    'California CDTFA sales tax filing for Raw Stockton (confirm actual filing frequency - monthly/quarterly). Portal: https://onlineservices.cdtfa.ca.gov/_/ | Username: rawstockton | Password: see Credentials vault entry "CDTFA - Raw Stockton Sales Tax" at /security/credentials',
    @finance_project_id,
    @admin_user_id,
    b.due_date,
    'high',
    'todo',
    0,
    @raw_store_id,
    'tax',
    'monthly',
    '{"interval":1,"by":"day_of_month","day_of_month":10}',
    b.id,
    @admin_user_id,
    NOW(),
    NOW()
FROM bills b
WHERE @guard = 1
  AND @raw_store_id IS NOT NULL
  AND @finance_project_id IS NOT NULL
  AND @admin_user_id IS NOT NULL
  AND b.store_id = @raw_store_id
  AND (LOWER(b.vendor) LIKE '%cdtfa%' OR LOWER(b.title) LIKE '%cdtfa%' OR LOWER(b.title) LIKE '%sales tax%')
  AND (b.is_archived = 0 OR b.is_archived IS NULL)
  AND b.repeat_parent_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM tasks t2 WHERE t2.bill_id = b.id);

-- ── D. Raw Stockton — AT&T phone FastPay (ensure bill + linked task) ────────
INSERT INTO bills (
    store_id, title, vendor, amount, due_date, status, note, color,
    created_by, category, repeat_type, repeat_interval, repeat_day,
    repeat_parent_id, created_at, updated_at
)
SELECT
    @raw_store_id, 'Raw Stockton - AT&T Phone', 'AT&T', 0.00, '2026-07-15', 'pending',
    'Confirm exact due date from the AT&T bill cycle - day 15 is a placeholder.',
    NULL, NULL, 'phone', 'monthly', 1, 15, NULL, NOW(), NOW()
WHERE @guard = 1
  AND @raw_store_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM bills
      WHERE store_id = @raw_store_id
        AND (LOWER(vendor) LIKE '%at&t%' OR LOWER(title) LIKE '%at&t%' OR LOWER(title) LIKE '%phone%')
        AND (is_archived = 0 OR is_archived IS NULL)
  );

INSERT INTO tasks (
    title, description, project_id, assignee_id, due_date, priority, status,
    is_completed, direct_store_id, task_category, repeat_type, repeat_config,
    bill_id, created_by, created_at, updated_at
)
SELECT
    'Raw Stockton - Pay AT&T Phone Bill',
    'AT&T Wireless FastPay for Raw Stockton phone line (select AT&T Wireless, NOT AT&T PREPAID). No login required. Portal: https://www.att.com/acctsvcs/fastpay | Account: 2096093886 | ZIP: 95219',
    @finance_project_id,
    @admin_user_id,
    b.due_date,
    'medium',
    'todo',
    0,
    @raw_store_id,
    'bill',
    'monthly',
    '{"interval":1,"by":"day_of_month","day_of_month":15}',
    b.id,
    @admin_user_id,
    NOW(),
    NOW()
FROM bills b
WHERE @guard = 1
  AND @raw_store_id IS NOT NULL
  AND @finance_project_id IS NOT NULL
  AND @admin_user_id IS NOT NULL
  AND b.store_id = @raw_store_id
  AND (LOWER(b.vendor) LIKE '%at&t%' OR LOWER(b.title) LIKE '%at&t%' OR LOWER(b.title) LIKE '%phone%')
  AND (b.is_archived = 0 OR b.is_archived IS NULL)
  AND b.repeat_parent_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM tasks t2 WHERE t2.bill_id = b.id);
