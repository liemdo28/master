CREATE TABLE IF NOT EXISTS maintenance_runs (
    run_key VARCHAR(120) PRIMARY KEY,
    ran_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    note VARCHAR(255) NULL
);

SET @admin_calendar_finance_cleanup = NOT EXISTS (
    SELECT 1 FROM maintenance_runs WHERE run_key = '2026_07_10_admin_calendar_finance_cleanup_v1'
);

INSERT INTO maintenance_runs (run_key, note)
SELECT '2026_07_10_admin_calendar_finance_cleanup_v1', 'Scope admin calendar and normalize finance bills/tasks'
WHERE @admin_calendar_finance_cleanup = 1;

SET @admin_user_id = COALESCE(
    (SELECT id FROM users WHERE email = 'admin@bakudanramen.com' LIMIT 1),
    (SELECT id FROM users WHERE LOWER(name) = 'admin' ORDER BY id LIMIT 1),
    (SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1),
    (SELECT id FROM users ORDER BY id LIMIT 1)
);

SET @finance_project_id = (
    SELECT id FROM projects WHERE LOWER(name) = 'finance' ORDER BY id LIMIT 1
);

INSERT INTO projects (name, description, color, owner_id, status, created_at, updated_at)
SELECT 'Finance', 'Finance operations and recurring obligations', '#2563eb', @admin_user_id, 'active', NOW(), NOW()
WHERE @admin_calendar_finance_cleanup = 1
  AND @finance_project_id IS NULL
  AND @admin_user_id IS NOT NULL;

SET @finance_project_id = (
    SELECT id FROM projects WHERE LOWER(name) = 'finance' ORDER BY id LIMIT 1
);

INSERT INTO stores (name, address, color, is_active, created_at)
SELECT 'Raw Venture', NULL, '#14b8a6', 1, NOW()
WHERE @admin_calendar_finance_cleanup = 1
  AND NOT EXISTS (SELECT 1 FROM stores WHERE LOWER(name) = 'raw venture');

SET @raw_stockton_store_id = (
    SELECT id FROM stores
    WHERE LOWER(name) IN ('raw stockton', 'stockton')
       OR LOWER(name) LIKE '%raw stockton%'
    ORDER BY CASE WHEN LOWER(name) = 'raw stockton' THEN 0 ELSE 1 END, id
    LIMIT 1
);

SET @raw_venture_store_id = (
    SELECT id FROM stores WHERE LOWER(name) = 'raw venture' ORDER BY id LIMIT 1
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

SET @modesto_store_id = (
    SELECT id FROM stores
    WHERE LOWER(name) LIKE '%modesto%'
    ORDER BY id LIMIT 1
);

UPDATE tasks
SET direct_store_id = @raw_venture_store_id,
    updated_at = NOW()
WHERE @admin_calendar_finance_cleanup = 1
  AND @raw_venture_store_id IS NOT NULL
  AND LOWER(title) LIKE 'raw venture%'
  AND COALESCE(direct_store_id, 0) <> @raw_venture_store_id;

UPDATE bills
SET store_id = @raw_venture_store_id,
    updated_at = NOW()
WHERE @admin_calendar_finance_cleanup = 1
  AND @raw_venture_store_id IS NOT NULL
  AND LOWER(title) LIKE 'raw venture%'
  AND COALESCE(store_id, 0) <> @raw_venture_store_id;

UPDATE tasks
SET title = 'Pre-Payment Sale Tax',
    direct_store_id = @raw_stockton_store_id,
    priority = 'high',
    updated_at = NOW()
WHERE @admin_calendar_finance_cleanup = 1
  AND @raw_stockton_store_id IS NOT NULL
  AND (LOWER(title) LIKE '%prepayment%' OR LOWER(title) LIKE '%pre-payment%');

UPDATE tasks
SET is_completed = 1,
    status = 'done',
    completed_at = COALESCE(completed_at, NOW()),
    due_date = NULL,
    updated_at = NOW()
WHERE @admin_calendar_finance_cleanup = 1
  AND title = 'Pre-Payment Sale Tax'
  AND due_date IS NOT NULL
  AND MONTH(due_date) NOT IN (2, 3, 5, 6, 8, 9, 11, 12);

UPDATE tasks
SET title = 'Return Sale Tax',
    direct_store_id = @raw_stockton_store_id,
    priority = 'high',
    updated_at = NOW()
WHERE @admin_calendar_finance_cleanup = 1
  AND @raw_stockton_store_id IS NOT NULL
  AND (LOWER(title) LIKE '%return sale tax%' OR LOWER(title) LIKE '%stockton - sale report%');

UPDATE tasks
SET is_completed = 1,
    status = 'done',
    completed_at = COALESCE(completed_at, NOW()),
    due_date = NULL,
    updated_at = NOW()
WHERE @admin_calendar_finance_cleanup = 1
  AND title = 'Return Sale Tax'
  AND due_date IS NOT NULL
  AND MONTH(due_date) NOT IN (1, 4, 7, 10);

INSERT INTO tasks (
    project_id, section_id, title, description, notes, assignee_id, priority, status,
    visibility, private_by_user_id, due_date, start_date, position, created_by,
    accepted_at, parent_task_id, reschedule_count, repeat_type, repeat_config,
    repeat_from_mode, repeat_end_type, repeat_end_date, repeat_end_count,
    estimated_time, recurring_root_id, occurrence_index, direct_store_id,
    created_at, updated_at
)
SELECT
    @finance_project_id, NULL, 'Pre-Payment Sale Tax',
    'Raw Stockton sale-tax pre-payment. Due on day 3 for months 2, 3, 5, 6, 8, 9, 11, 12.',
    NULL, @admin_user_id, 'high', 'todo',
    'private', @admin_user_id, d.due_date, NULL, 0, @admin_user_id,
    NOW(), NULL, 0, 'none', NULL,
    'due_date', 'never', NULL, NULL,
    NULL, NULL, 0, @raw_stockton_store_id,
    NOW(), NOW()
FROM (
    SELECT '2026-02-03' AS due_date UNION ALL
    SELECT '2026-03-03' UNION ALL
    SELECT '2026-05-03' UNION ALL
    SELECT '2026-06-03' UNION ALL
    SELECT '2026-08-03' UNION ALL
    SELECT '2026-09-03' UNION ALL
    SELECT '2026-11-03' UNION ALL
    SELECT '2026-12-03'
) d
WHERE @admin_calendar_finance_cleanup = 1
  AND @finance_project_id IS NOT NULL
  AND @admin_user_id IS NOT NULL
  AND @raw_stockton_store_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.title = 'Pre-Payment Sale Tax'
        AND t.direct_store_id = @raw_stockton_store_id
        AND t.due_date = d.due_date
  );

INSERT INTO tasks (
    project_id, section_id, title, description, notes, assignee_id, priority, status,
    visibility, private_by_user_id, due_date, start_date, position, created_by,
    accepted_at, parent_task_id, reschedule_count, repeat_type, repeat_config,
    repeat_from_mode, repeat_end_type, repeat_end_date, repeat_end_count,
    estimated_time, recurring_root_id, occurrence_index, direct_store_id,
    created_at, updated_at
)
SELECT
    @finance_project_id, NULL, 'Return Sale Tax',
    'Raw Stockton sale-tax return. Due on day 15 for months 1, 4, 7, 10.',
    NULL, @admin_user_id, 'high', 'todo',
    'private', @admin_user_id, d.due_date, NULL, 0, @admin_user_id,
    NOW(), NULL, 0, 'none', NULL,
    'due_date', 'never', NULL, NULL,
    NULL, NULL, 0, @raw_stockton_store_id,
    NOW(), NOW()
FROM (
    SELECT '2026-01-15' AS due_date UNION ALL
    SELECT '2026-04-15' UNION ALL
    SELECT '2026-07-15' UNION ALL
    SELECT '2026-10-15'
) d
WHERE @admin_calendar_finance_cleanup = 1
  AND @finance_project_id IS NOT NULL
  AND @admin_user_id IS NOT NULL
  AND @raw_stockton_store_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.title = 'Return Sale Tax'
        AND t.direct_store_id = @raw_stockton_store_id
        AND t.due_date = d.due_date
  );

UPDATE bills
SET category = 'rent',
    vendor = CASE
        WHEN store_id = @b3_store_id THEN 'RentPayment'
        WHEN store_id IN (@b1_store_id, @b2_store_id) THEN 'SecureCafe'
        ELSE vendor
    END,
    repeat_type = 'monthly',
    repeat_interval = 1,
    repeat_day = DAY(due_date),
    frequency = 'monthly',
    note = CASE
        WHEN store_id = @b3_store_id THEN 'Rent portal: https://rentpayment.com/pay/login.html'
        WHEN store_id IN (@b1_store_id, @b2_store_id) THEN 'Rent portal: https://www.securecafe3.com/newtenantportal/content2/login/?companyID=776&propertyID=139106'
        ELSE note
    END,
    updated_at = NOW()
WHERE @admin_calendar_finance_cleanup = 1
  AND (LOWER(title) LIKE '%rent%' OR LOWER(title) LIKE '%lease%')
  AND (store_id IN (@b1_store_id, @b2_store_id, @b3_store_id) OR store_id IS NULL);

INSERT INTO bills (
    store_id, title, vendor, amount, due_date, status, note, color, created_by,
    category, repeat_type, repeat_interval, repeat_day, repeat_parent_id, created_at, updated_at
)
SELECT
    x.store_id, x.title, x.vendor, 0.00, x.due_date, 'pending', x.note, s.color, NULL,
    'rent', 'monthly', 1, DAY(x.due_date), NULL, NOW(), NOW()
FROM (
    SELECT @b1_store_id AS store_id, 'B1 Rent Payment' AS title, 'SecureCafe' AS vendor, '2026-07-01' AS due_date,
           'Rent portal: https://www.securecafe3.com/newtenantportal/content2/login/?companyID=776&propertyID=139106' AS note
    UNION ALL
    SELECT @b2_store_id, 'B2 Rent Payment', 'SecureCafe', '2026-07-01',
           'Rent portal: https://www.securecafe3.com/newtenantportal/content2/login/?companyID=776&propertyID=139106'
    UNION ALL
    SELECT @b3_store_id, 'B3 Rent Payment', 'RentPayment', '2026-07-27',
           'Rent portal: https://rentpayment.com/pay/login.html'
) x
JOIN stores s ON s.id = x.store_id
WHERE @admin_calendar_finance_cleanup = 1
  AND x.store_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM bills b
      WHERE b.store_id = x.store_id
        AND DATE(b.due_date) = x.due_date
        AND (LOWER(b.title) LIKE '%rent%' OR LOWER(b.title) LIKE '%lease%')
        AND (b.is_archived = 0 OR b.is_archived IS NULL)
  );

UPDATE bills
SET category = 'insurance',
    vendor = 'AmTrust',
    repeat_type = 'monthly',
    repeat_interval = 1,
    repeat_day = 2,
    frequency = 'monthly',
    note = 'Insurance portal: https://auth.amtrustgroup.com/AuthServer/account/login',
    updated_at = NOW()
WHERE @admin_calendar_finance_cleanup = 1
  AND LOWER(title) LIKE '%amtrust%'
  AND store_id IN (@raw_stockton_store_id, @modesto_store_id);

INSERT INTO bills (
    store_id, title, vendor, amount, due_date, status, note, color, created_by,
    category, repeat_type, repeat_interval, repeat_day, repeat_parent_id, created_at, updated_at
)
SELECT
    x.store_id, x.title, 'AmTrust', 0.00, '2026-08-02', 'pending',
    'Insurance portal: https://auth.amtrustgroup.com/AuthServer/account/login',
    s.color, NULL, 'insurance', 'monthly', 1, 2, NULL, NOW(), NOW()
FROM (
    SELECT @raw_stockton_store_id AS store_id, 'Raw Stockton - Pay AmTrust insurance' AS title
    UNION ALL
    SELECT @modesto_store_id, 'Raw Modesto - Pay AmTrust insurance'
) x
JOIN stores s ON s.id = x.store_id
WHERE @admin_calendar_finance_cleanup = 1
  AND x.store_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM bills b
      WHERE b.store_id = x.store_id
        AND DATE(b.due_date) = '2026-08-02'
        AND (LOWER(b.vendor) LIKE '%amtrust%' OR LOWER(b.title) LIKE '%amtrust%')
        AND (b.is_archived = 0 OR b.is_archived IS NULL)
  );

UPDATE bills
SET title = 'Finance - Pay AT&T Phone',
    category = 'phone',
    vendor = 'AT&T Wireless',
    repeat_type = 'monthly',
    repeat_interval = 1,
    repeat_day = 7,
    frequency = 'monthly',
    note = 'AT&T Wireless fast pay: https://www.att.com/acctsvcs/fastpay. Account 2096093886, ZIP 95219. Pay monthly with Amex card provided by owner.',
    updated_at = NOW()
WHERE @admin_calendar_finance_cleanup = 1
  AND (LOWER(title) LIKE '%at&t%' OR LOWER(title) LIKE '%att %' OR LOWER(vendor) LIKE '%at&t%' OR LOWER(vendor) LIKE '%att%');

INSERT INTO bills (
    store_id, title, vendor, amount, due_date, status, note, color, created_by,
    category, repeat_type, repeat_interval, repeat_day, repeat_parent_id, created_at, updated_at
)
SELECT
    @raw_stockton_store_id, 'Finance - Pay AT&T Phone', 'AT&T Wireless', 0.00, '2026-08-07', 'pending',
    'AT&T Wireless fast pay: https://www.att.com/acctsvcs/fastpay. Account 2096093886, ZIP 95219. Pay monthly with Amex card provided by owner.',
    s.color, NULL, 'phone', 'monthly', 1, 7, NULL, NOW(), NOW()
FROM stores s
WHERE @admin_calendar_finance_cleanup = 1
  AND s.id = @raw_stockton_store_id
  AND NOT EXISTS (
      SELECT 1 FROM bills b
      WHERE DATE(b.due_date) = '2026-08-07'
        AND (LOWER(b.title) LIKE '%at&t%' OR LOWER(b.title) LIKE '%att %' OR LOWER(b.vendor) LIKE '%at&t%' OR LOWER(b.vendor) LIKE '%att%')
        AND (b.is_archived = 0 OR b.is_archived IS NULL)
  );

UPDATE bills b
JOIN stores s ON s.id = b.store_id
SET b.title = CASE
        WHEN s.id = @b1_store_id THEN 'B1 CPS Electric'
        WHEN s.id = @b2_store_id THEN 'B2 CPS Electric'
        WHEN s.id = @b3_store_id THEN 'B3 CPS Electric'
        ELSE b.title
    END,
    b.vendor = 'CPS Energy',
    b.category = 'electronic',
    b.repeat_type = 'monthly',
    b.repeat_interval = 1,
    b.repeat_day = 20,
    b.frequency = 'monthly',
    b.note = 'CPS electric bill',
    b.updated_at = NOW()
WHERE @admin_calendar_finance_cleanup = 1
  AND b.store_id IN (@b1_store_id, @b2_store_id, @b3_store_id)
  AND (LOWER(COALESCE(b.vendor, '')) LIKE '%cps%'
       OR LOWER(COALESCE(b.title, '')) LIKE '%cps%'
       OR LOWER(COALESCE(b.title, '')) LIKE '%electric%')
  AND (b.is_archived = 0 OR b.is_archived IS NULL);

INSERT INTO bills (
    store_id, title, vendor, amount, due_date, status, note, color, created_by,
    category, repeat_type, repeat_interval, repeat_day, repeat_parent_id, created_at, updated_at
)
SELECT
    x.store_id, x.title, 'CPS Energy', 0.00, '2026-07-20', 'pending',
    'CPS electric bill', s.color, NULL,
    'electronic', 'monthly', 1, 20, NULL, NOW(), NOW()
FROM (
    SELECT @b1_store_id AS store_id, 'B1 CPS Electric' AS title
    UNION ALL
    SELECT @b2_store_id, 'B2 CPS Electric'
    UNION ALL
    SELECT @b3_store_id, 'B3 CPS Electric'
) x
JOIN stores s ON s.id = x.store_id
WHERE @admin_calendar_finance_cleanup = 1
  AND x.store_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM bills b
      WHERE b.store_id = x.store_id
        AND DATE(b.due_date) = '2026-07-20'
        AND (LOWER(COALESCE(b.vendor, '')) LIKE '%cps%'
             OR LOWER(COALESCE(b.title, '')) LIKE '%cps%'
             OR LOWER(COALESCE(b.title, '')) LIKE '%electric%')
        AND (b.is_archived = 0 OR b.is_archived IS NULL)
  );
