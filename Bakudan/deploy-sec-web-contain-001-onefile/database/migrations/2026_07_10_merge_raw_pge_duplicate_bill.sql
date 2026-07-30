CREATE TABLE IF NOT EXISTS maintenance_runs (
    run_key VARCHAR(120) PRIMARY KEY,
    ran_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    note VARCHAR(255) NULL
);

SET @merge_raw_pge_duplicate_bill = NOT EXISTS (
    SELECT 1 FROM maintenance_runs WHERE run_key = '2026_07_10_merge_raw_pge_duplicate_bill'
);

INSERT INTO maintenance_runs (run_key, note)
SELECT '2026_07_10_merge_raw_pge_duplicate_bill', 'Merged Raw Stockton duplicate PG&E bill labels'
WHERE @merge_raw_pge_duplicate_bill = 1;

CREATE TEMPORARY TABLE _raw_pge_candidates AS
SELECT b.id,
       b.title,
       b.store_id,
       b.due_date,
       b.status,
       b.amount,
       CASE
           WHEN LOWER(TRIM(b.title)) = 'raw pge' THEN 0
           WHEN b.status = 'paid' THEN 1
           ELSE 2
       END AS keep_rank
FROM bills b
JOIN stores s ON s.id = b.store_id
WHERE @merge_raw_pge_duplicate_bill = 1
  AND LOWER(TRIM(s.name)) = 'raw stockton'
  AND DATE(b.due_date) = '2026-07-20'
  AND LOWER(REPLACE(REPLACE(TRIM(b.title), '&', ''), ' ', '')) IN ('rawpge', 'rawstocktonpge')
  AND (b.is_archived = 0 OR b.is_archived IS NULL);

SET @raw_pge_keep_id = (
    SELECT id
    FROM _raw_pge_candidates
    ORDER BY keep_rank ASC, id ASC
    LIMIT 1
);

UPDATE bills
SET title = 'Raw PGE',
    vendor = 'PG&E',
    category = 'utilities',
    updated_at = NOW()
WHERE @merge_raw_pge_duplicate_bill = 1
  AND id = @raw_pge_keep_id;

UPDATE bills
SET is_archived = 1,
    archived_at = NOW(),
    archived_reason = 'duplicate_raw_pge_2026_07',
    updated_at = NOW()
WHERE @merge_raw_pge_duplicate_bill = 1
  AND id IN (SELECT id FROM _raw_pge_candidates WHERE id <> @raw_pge_keep_id);

DROP TEMPORARY TABLE IF EXISTS _raw_pge_candidates;
