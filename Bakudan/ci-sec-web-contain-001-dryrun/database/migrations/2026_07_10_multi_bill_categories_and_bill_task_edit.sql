CREATE TABLE IF NOT EXISTS maintenance_runs (
    run_key VARCHAR(120) PRIMARY KEY,
    ran_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    note VARCHAR(255) NULL
);

SET @multi_bill_categories = NOT EXISTS (
    SELECT 1 FROM maintenance_runs WHERE run_key = '2026_07_10_multi_bill_categories_and_bill_task_edit_v1'
);

INSERT INTO maintenance_runs (run_key, note)
SELECT '2026_07_10_multi_bill_categories_and_bill_task_edit_v1',
       'Multi bill categories plus CPS dual category backfill'
WHERE @multi_bill_categories = 1;

CREATE TABLE IF NOT EXISTS bill_category_links (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bill_id INT NOT NULL,
    category VARCHAR(50) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_bill_category_links_bill_category (bill_id, category),
    KEY idx_bill_category_links_category (category),
    KEY idx_bill_category_links_bill (bill_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS task_category_links (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_id INT NOT NULL,
    category VARCHAR(50) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_task_category_links_task_category (task_id, category),
    KEY idx_task_category_links_category (category),
    KEY idx_task_category_links_task (task_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO bill_category_links (bill_id, category, created_at)
SELECT id, category, NOW()
FROM bills
WHERE @multi_bill_categories = 1
  AND category IS NOT NULL
  AND category <> '';

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

INSERT IGNORE INTO bill_category_links (bill_id, category, created_at)
SELECT b.id, 'electronic', NOW()
FROM bills b
WHERE @multi_bill_categories = 1
  AND b.store_id IN (@b1_store_id, @b2_store_id, @b3_store_id)
  AND (b.is_archived = 0 OR b.is_archived IS NULL)
  AND (
      LOWER(COALESCE(b.vendor, '')) LIKE '%cps%'
      OR LOWER(COALESCE(b.title, '')) LIKE '%cps%'
      OR LOWER(COALESCE(b.title, '')) LIKE '%electric%'
      OR LOWER(COALESCE(b.title, '')) LIKE '%electronic%'
  );

INSERT IGNORE INTO bill_category_links (bill_id, category, created_at)
SELECT b.id, 'water', NOW()
FROM bills b
WHERE @multi_bill_categories = 1
  AND b.store_id IN (@b1_store_id, @b2_store_id, @b3_store_id)
  AND (b.is_archived = 0 OR b.is_archived IS NULL)
  AND (
      LOWER(COALESCE(b.vendor, '')) LIKE '%cps%'
      OR LOWER(COALESCE(b.title, '')) LIKE '%cps%'
  );

INSERT IGNORE INTO task_category_links (task_id, category, created_at)
SELECT t.id, 'water', NOW()
FROM tasks t
WHERE @multi_bill_categories = 1
  AND t.direct_store_id IN (@b1_store_id, @b2_store_id, @b3_store_id)
  AND (
      LOWER(COALESCE(t.title, '')) LIKE '%cps%'
      OR LOWER(COALESCE(t.description, '')) LIKE '%cps%'
  );
