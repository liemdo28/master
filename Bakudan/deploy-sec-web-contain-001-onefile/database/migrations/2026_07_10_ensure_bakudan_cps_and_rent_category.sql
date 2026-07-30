CREATE TABLE IF NOT EXISTS maintenance_runs (
    run_key VARCHAR(120) PRIMARY KEY,
    ran_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    note VARCHAR(255) NULL
);

SET @ensure_bakudan_cps = NOT EXISTS (
    SELECT 1 FROM maintenance_runs WHERE run_key = '2026_07_10_ensure_bakudan_cps_and_rent_category_v3'
);

INSERT INTO maintenance_runs (run_key, note)
SELECT '2026_07_10_ensure_bakudan_cps_and_rent_category_v3', 'Ensured B1/B2/B3 CPS electric bills and rent category support'
WHERE @ensure_bakudan_cps = 1;

UPDATE bills b
JOIN stores s ON s.id = b.store_id
SET b.title = CASE
        WHEN s.name LIKE '%The Rim%' THEN 'B1 CPS Electric'
        WHEN s.name LIKE '%Stone Oak%' THEN 'B2 CPS Electric'
        WHEN s.name LIKE '%Bandera%' THEN 'B3 CPS Electric'
        ELSE b.title
    END,
    b.vendor = 'CPS Energy',
    b.category = 'electronic',
    b.repeat_type = 'monthly',
    b.repeat_interval = 1,
    b.repeat_day = 20,
    b.frequency = 'monthly',
    b.updated_at = NOW()
WHERE @ensure_bakudan_cps = 1
  AND DATE(b.due_date) = '2026-07-20'
  AND (b.is_archived = 0 OR b.is_archived IS NULL)
  AND (
      s.name LIKE '%The Rim%'
      OR s.name LIKE '%Stone Oak%'
      OR s.name LIKE '%Bandera%'
  )
  AND (
      LOWER(COALESCE(b.vendor, '')) LIKE '%cps%'
      OR LOWER(COALESCE(b.title, '')) LIKE '%cps%'
      OR LOWER(COALESCE(b.title, '')) LIKE '%electric%'
  );

INSERT INTO bills (
    store_id,
    title,
    vendor,
    amount,
    due_date,
    status,
    note,
    color,
    created_by,
    category,
    repeat_type,
    repeat_interval,
    repeat_day,
    repeat_parent_id,
    created_at,
    updated_at
)
SELECT
    s.id,
    CASE
        WHEN s.name LIKE '%The Rim%' THEN 'B1 CPS Electric'
        WHEN s.name LIKE '%Stone Oak%' THEN 'B2 CPS Electric'
        WHEN s.name LIKE '%Bandera%' THEN 'B3 CPS Electric'
        ELSE CONCAT(s.name, ' CPS Electric')
    END,
    'CPS Energy',
    0.00,
    '2026-07-20',
    'pending',
    'Monthly CPS electric bill',
    s.color,
    NULL,
    'electronic',
    'monthly',
    1,
    20,
    NULL,
    NOW(),
    NOW()
FROM stores s
WHERE @ensure_bakudan_cps = 1
  AND (
      s.name LIKE '%The Rim%'
      OR s.name LIKE '%Stone Oak%'
      OR s.name LIKE '%Bandera%'
  )
  AND NOT EXISTS (
      SELECT 1
      FROM bills b
      WHERE b.store_id = s.id
        AND DATE(b.due_date) = '2026-07-20'
        AND (b.is_archived = 0 OR b.is_archived IS NULL)
        AND (
            LOWER(COALESCE(b.vendor, '')) LIKE '%cps%'
            OR LOWER(COALESCE(b.title, '')) LIKE '%cps%'
            OR LOWER(COALESCE(b.title, '')) LIKE '%electric%'
        )
  );
