CREATE TABLE IF NOT EXISTS maintenance_runs (
    run_key VARCHAR(120) PRIMARY KEY,
    ran_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    note VARCHAR(255) NULL
);

SET @multi_task_categories_cleanup = NOT EXISTS (
    SELECT 1 FROM maintenance_runs WHERE run_key = '2026_07_10_multi_task_categories_and_utility_vendor_cleanup_v1'
);

INSERT INTO maintenance_runs (run_key, note)
SELECT '2026_07_10_multi_task_categories_and_utility_vendor_cleanup_v1',
       'Multi task categories plus CPS, water, and rent vendor cleanup'
WHERE @multi_task_categories_cleanup = 1;

CREATE TABLE IF NOT EXISTS task_category_links (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_id INT NOT NULL,
    category VARCHAR(50) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_task_category_links_task_category (task_id, category),
    KEY idx_task_category_links_category (category),
    KEY idx_task_category_links_task (task_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO task_category_links (task_id, category, created_at)
SELECT id, task_category, NOW()
FROM tasks
WHERE @multi_task_categories_cleanup = 1
  AND task_category IS NOT NULL
  AND task_category <> '';

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

-- CPS is Electronic for Bakudan B1/B2/B3.
UPDATE bills b
SET b.vendor = 'CPS Energy',
    b.category = 'electronic',
    b.repeat_type = 'monthly',
    b.repeat_interval = 1,
    b.repeat_day = 20,
    b.frequency = 'monthly',
    b.updated_at = NOW()
WHERE @multi_task_categories_cleanup = 1
  AND b.store_id IN (@b1_store_id, @b2_store_id, @b3_store_id)
  AND (b.is_archived = 0 OR b.is_archived IS NULL)
  AND (
      LOWER(COALESCE(b.vendor, '')) LIKE '%cps%'
      OR LOWER(COALESCE(b.title, '')) LIKE '%cps%'
      OR LOWER(COALESCE(b.title, '')) LIKE '%electric%'
      OR LOWER(COALESCE(b.title, '')) LIKE '%electronic%'
  );

UPDATE tasks
SET task_category = 'electronic',
    updated_at = NOW()
WHERE @multi_task_categories_cleanup = 1
  AND direct_store_id IN (@b1_store_id, @b2_store_id, @b3_store_id)
  AND (
      LOWER(title) LIKE '%cps%'
      OR LOWER(title) LIKE '%electric%'
      OR LOWER(title) LIKE '%electronic%'
  );

INSERT IGNORE INTO task_category_links (task_id, category, created_at)
SELECT id, 'electronic', NOW()
FROM tasks
WHERE @multi_task_categories_cleanup = 1
  AND direct_store_id IN (@b1_store_id, @b2_store_id, @b3_store_id)
  AND (
      LOWER(title) LIKE '%cps%'
      OR LOWER(title) LIKE '%electric%'
      OR LOWER(title) LIKE '%electronic%'
  );

-- Water utility for Bakudan stores should be Water, not General.
UPDATE bills b
SET b.category = 'water',
    b.updated_at = NOW()
WHERE @multi_task_categories_cleanup = 1
  AND b.store_id IN (@b1_store_id, @b2_store_id, @b3_store_id)
  AND (b.is_archived = 0 OR b.is_archived IS NULL)
  AND (
      LOWER(COALESCE(b.title, '')) LIKE '%water%'
      OR LOWER(COALESCE(b.vendor, '')) LIKE '%water%'
      OR LOWER(COALESCE(b.vendor, '')) LIKE '%city of%'
  );

UPDATE tasks
SET task_category = 'water',
    updated_at = NOW()
WHERE @multi_task_categories_cleanup = 1
  AND direct_store_id IN (@b1_store_id, @b2_store_id, @b3_store_id)
  AND LOWER(title) LIKE '%water%';

INSERT IGNORE INTO task_category_links (task_id, category, created_at)
SELECT id, 'water', NOW()
FROM tasks
WHERE @multi_task_categories_cleanup = 1
  AND direct_store_id IN (@b1_store_id, @b2_store_id, @b3_store_id)
  AND LOWER(title) LIKE '%water%';

-- Rent vendors from provided portal/account evidence:
-- B1/B2 use SecureCafe, B3 uses RentPayment.
UPDATE bills b
SET b.vendor = 'SecureCafe',
    b.category = 'rent',
    b.note = 'Rent portal: https://www.securecafe3.com/newtenantportal/content2/login/?companyID=776&propertyID=139106',
    b.updated_at = NOW()
WHERE @multi_task_categories_cleanup = 1
  AND b.store_id IN (@b1_store_id, @b2_store_id)
  AND (b.is_archived = 0 OR b.is_archived IS NULL)
  AND (
      LOWER(COALESCE(b.title, '')) LIKE '%rent%'
      OR LOWER(COALESCE(b.title, '')) LIKE '%lease%'
      OR LOWER(COALESCE(b.vendor, '')) IN ('landlord', 'securecafe')
  );

UPDATE bills b
SET b.vendor = 'RentPayment',
    b.category = 'rent',
    b.note = 'Rent portal: https://rentpayment.com/pay/login.html',
    b.updated_at = NOW()
WHERE @multi_task_categories_cleanup = 1
  AND b.store_id = @b3_store_id
  AND (b.is_archived = 0 OR b.is_archived IS NULL)
  AND (
      LOWER(COALESCE(b.title, '')) LIKE '%rent%'
      OR LOWER(COALESCE(b.title, '')) LIKE '%lease%'
      OR LOWER(COALESCE(b.vendor, '')) IN ('landlord', 'rentpayment')
  );

UPDATE tasks
SET task_category = 'rent',
    updated_at = NOW()
WHERE @multi_task_categories_cleanup = 1
  AND direct_store_id IN (@b1_store_id, @b2_store_id, @b3_store_id)
  AND LOWER(title) LIKE '%rent%';

INSERT IGNORE INTO task_category_links (task_id, category, created_at)
SELECT id, 'rent', NOW()
FROM tasks
WHERE @multi_task_categories_cleanup = 1
  AND direct_store_id IN (@b1_store_id, @b2_store_id, @b3_store_id)
  AND LOWER(title) LIKE '%rent%';
