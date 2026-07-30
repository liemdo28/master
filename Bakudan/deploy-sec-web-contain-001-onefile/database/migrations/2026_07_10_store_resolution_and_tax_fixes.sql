CREATE TABLE IF NOT EXISTS maintenance_runs (
    run_key VARCHAR(120) PRIMARY KEY,
    ran_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    note VARCHAR(255) NULL
);

SET @store_resolution_fix = NOT EXISTS (
    SELECT 1 FROM maintenance_runs WHERE run_key = '2026_07_10_store_resolution_and_tax_fixes_v1'
);

INSERT INTO maintenance_runs (run_key, note)
SELECT '2026_07_10_store_resolution_and_tax_fixes_v1', 'Backfill direct_store_id, add Modesto rent + B1/B2/B3 TX Comptroller tax bills'
WHERE @store_resolution_fix = 1;

-- ── Backfill tasks.direct_store_id ──────────────────────────────────────────
-- Task::setDirectStore() was dead code (never called), so direct_store_id was
-- always NULL even for tasks whose store was picked via the task_stores pivot.
-- Task::resolveStoreId() and every COALESCE(direct_store_id, project.store_id)
-- dashboard query silently fell back to the project's store instead. Going
-- forward TaskStoreService::sync() keeps this column in sync; this is a
-- one-time backfill for tasks that already have exactly one linked store.
UPDATE tasks t
JOIN (
    SELECT task_id, MIN(store_id) AS sid, COUNT(*) AS cnt
    FROM task_stores
    GROUP BY task_id
    HAVING cnt = 1
) x ON x.task_id = t.id
SET t.direct_store_id = x.sid,
    t.updated_at = NOW()
WHERE @store_resolution_fix = 1
  AND t.direct_store_id IS NULL;

-- ── Resolve store IDs by name (portable across environments) ───────────────
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

SET @raw_stockton_store_id = (
    SELECT id FROM stores
    WHERE LOWER(name) IN ('raw stockton', 'stockton')
       OR LOWER(name) LIKE '%raw stockton%'
    ORDER BY CASE WHEN LOWER(name) = 'raw stockton' THEN 0 ELSE 1 END, id
    LIMIT 1
);

SET @copper_store_id = (
    SELECT id FROM stores WHERE LOWER(name) LIKE '%copper%' ORDER BY id LIMIT 1
);

SET @heo_store_id = (
    SELECT id FROM stores WHERE LOWER(name) LIKE '%heo%' ORDER BY id LIMIT 1
);

SET @ift_store_id = (
    SELECT id FROM stores WHERE LOWER(name) = 'ift' ORDER BY id LIMIT 1
);

-- ── Fix generic "Rent" / "Landlord" placeholder bills (all stores) ─────────
-- The monthly recurring-bill generator's fallback (db_query.php) stamps every
-- store missing a rent bill with a generic title 'Rent' and vendor 'Landlord'
-- — even for B1/B2/B3, where the real vendor is known (SecureCafe/RentPayment).
-- Prefix the title with the store's short code and correct vendor where known;
-- stores with no known landlord/portal keep vendor='Landlord' rather than
-- guessing.
UPDATE bills b
JOIN (
    SELECT @b1_store_id           AS store_id, 'B1'      AS code, 'SecureCafe'  AS vendor_override
    UNION ALL SELECT @b2_store_id,               'B2',      'SecureCafe'
    UNION ALL SELECT @b3_store_id,               'B3',      'RentPayment'
    UNION ALL SELECT @modesto_store_id,          'Modesto', NULL
    UNION ALL SELECT @raw_stockton_store_id,     'Raw',     NULL
    UNION ALL SELECT @copper_store_id,           'Copper',  NULL
    UNION ALL SELECT @heo_store_id,              'Heo',     NULL
    UNION ALL SELECT @ift_store_id,              'IFT',     NULL
) x ON x.store_id = b.store_id
SET b.title    = CONCAT(x.code, ' Rent'),
    b.vendor   = COALESCE(x.vendor_override, b.vendor),
    b.category = 'rent',
    b.updated_at = NOW()
WHERE @store_resolution_fix = 1
  AND x.store_id IS NOT NULL
  AND (LOWER(b.title) = 'rent' OR LOWER(b.title) LIKE '%rent%' OR LOWER(b.title) LIKE '%lease%')
  AND (b.is_archived = 0 OR b.is_archived IS NULL);

-- ── Modesto rent bill (missing — B1/B2/B3/Stockton already covered) ────────
-- No rent portal credential was provided for Modesto, so this is a
-- placeholder (amount/vendor TBD) — same pattern db_query.php already uses
-- as a fallback for any store missing a rent bill.
INSERT INTO bills (
    store_id, title, vendor, amount, due_date, status, note, color, created_by,
    category, repeat_type, repeat_interval, repeat_day, repeat_parent_id, created_at, updated_at
)
SELECT
    @modesto_store_id, 'Modesto Rent Payment', 'Landlord', 0.00, '2026-08-01', 'pending',
    'Monthly rent placeholder — vendor portal/amount needs CEO confirmation.',
    s.color, NULL, 'rent', 'monthly', 1, 1, NULL, NOW(), NOW()
FROM stores s
WHERE @store_resolution_fix = 1
  AND s.id = @modesto_store_id
  AND NOT EXISTS (
      SELECT 1 FROM bills b
      WHERE b.store_id = @modesto_store_id
        AND (LOWER(b.title) LIKE '%rent%' OR LOWER(b.title) LIKE '%lease%')
        AND (b.is_archived = 0 OR b.is_archived IS NULL)
  );

-- ── Texas Comptroller quarterly sales-tax bills for B1/B2/B3 ───────────────
-- Mirrors the existing IFT/Heo Holding pattern (quarterly, due 20th of the
-- month after quarter end). Same shared Comptroller login for all three
-- (per CEO instruction), tracked as three separate per-store bills.
INSERT INTO bills (
    store_id, title, vendor, amount, due_date, status, note, color, created_by,
    category, repeat_type, repeat_interval, repeat_day, repeat_parent_id, created_at, updated_at
)
SELECT
    x.store_id, x.title, 'Texas Comptroller', 0.00, '2026-10-20', 'pending',
    'Texas Comptroller sales tax portal: https://mycpa.cpa.state.tx.us/securitymp1portal/displayLoginUser.do',
    s.color, NULL, 'tax', 'quarterly', 3, 20, NULL, NOW(), NOW()
FROM (
    SELECT @b1_store_id AS store_id, 'B1 Texas Sales Tax (Quarterly)' AS title
    UNION ALL
    SELECT @b2_store_id, 'B2 Texas Sales Tax (Quarterly)'
    UNION ALL
    SELECT @b3_store_id, 'B3 Texas Sales Tax (Quarterly)'
) x
JOIN stores s ON s.id = x.store_id
WHERE @store_resolution_fix = 1
  AND x.store_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM bills b
      WHERE b.store_id = x.store_id
        AND (LOWER(b.vendor) LIKE '%comptroller%' OR LOWER(b.title) LIKE '%texas sales tax%' OR LOWER(b.title) LIKE '%comptroller%')
        AND (b.is_archived = 0 OR b.is_archived IS NULL)
  );
