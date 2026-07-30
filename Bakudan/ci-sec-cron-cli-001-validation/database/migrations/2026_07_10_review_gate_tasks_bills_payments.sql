CREATE TABLE IF NOT EXISTS maintenance_runs (
    run_key VARCHAR(120) PRIMARY KEY,
    ran_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    note VARCHAR(255) NULL
);

SET @review_gate_migration = NOT EXISTS (
    SELECT 1 FROM maintenance_runs WHERE run_key = '2026_07_10_review_gate_tasks_bills_payments_v2'
);

INSERT INTO maintenance_runs (run_key, note)
SELECT '2026_07_10_review_gate_tasks_bills_payments_v2', 'Add reviewer gates for tasks, bills, and payments'
WHERE @review_gate_migration = 1;

ALTER TABLE bills ADD COLUMN reviewer_id INT NULL DEFAULT NULL;
ALTER TABLE bills ADD COLUMN reviewer_due_date DATE NULL DEFAULT NULL;
ALTER TABLE bills ADD COLUMN review_instructions TEXT NULL;
ALTER TABLE bills ADD COLUMN review_status VARCHAR(30) NOT NULL DEFAULT 'not_required';
ALTER TABLE bills ADD COLUMN reviewed_at DATETIME NULL DEFAULT NULL;
ALTER TABLE bills ADD COLUMN reviewed_by INT NULL DEFAULT NULL;

ALTER TABLE payments ADD COLUMN reviewer_id INT NULL DEFAULT NULL;
ALTER TABLE payments ADD COLUMN reviewer_due_date DATE NULL DEFAULT NULL;
ALTER TABLE payments ADD COLUMN review_instructions TEXT NULL;
ALTER TABLE payments ADD COLUMN review_status VARCHAR(30) NOT NULL DEFAULT 'not_required';
ALTER TABLE payments ADD COLUMN reviewed_at DATETIME NULL DEFAULT NULL;
ALTER TABLE payments ADD COLUMN reviewed_by INT NULL DEFAULT NULL;

UPDATE bills
SET review_status = CASE WHEN reviewer_id IS NULL THEN 'not_required' ELSE 'pending_review' END
WHERE review_status IS NULL OR review_status = '';

UPDATE payments
SET review_status = CASE WHEN reviewer_id IS NULL THEN 'not_required' ELSE 'pending_review' END
WHERE review_status IS NULL OR review_status = '';

SET @finance_project_id = (
    SELECT id FROM projects WHERE LOWER(name) = 'finance' ORDER BY id LIMIT 1
);

SET @raw_stockton_store_id = (
    SELECT id FROM stores
    WHERE LOWER(name) IN ('raw stockton', 'stockton')
       OR LOWER(name) LIKE '%raw stockton%'
    ORDER BY CASE WHEN LOWER(name) = 'raw stockton' THEN 0 ELSE 1 END, id
    LIMIT 1
);

SET @modesto_store_id = (
    SELECT id FROM stores WHERE LOWER(name) LIKE '%modesto%' ORDER BY id LIMIT 1
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

UPDATE tasks
SET task_category = 'tax',
    direct_store_id = @b1_store_id,
    project_id = COALESCE(project_id, @finance_project_id),
    updated_at = NOW()
WHERE @review_gate_migration = 1
  AND @b1_store_id IS NOT NULL
  AND (LOWER(title) LIKE 'b1 -%tax%' OR LOWER(title) LIKE 'b1 %tax%');

UPDATE tasks
SET task_category = 'tax',
    direct_store_id = @b2_store_id,
    project_id = COALESCE(project_id, @finance_project_id),
    updated_at = NOW()
WHERE @review_gate_migration = 1
  AND @b2_store_id IS NOT NULL
  AND (LOWER(title) LIKE 'b2 -%tax%' OR LOWER(title) LIKE 'b2 %tax%');

UPDATE tasks
SET task_category = 'tax',
    direct_store_id = @b3_store_id,
    project_id = COALESCE(project_id, @finance_project_id),
    updated_at = NOW()
WHERE @review_gate_migration = 1
  AND @b3_store_id IS NOT NULL
  AND (LOWER(title) LIKE 'b3 -%tax%' OR LOWER(title) LIKE 'b3 %tax%');

UPDATE tasks
SET task_category = 'tax',
    direct_store_id = @raw_stockton_store_id,
    project_id = COALESCE(project_id, @finance_project_id),
    updated_at = NOW()
WHERE @review_gate_migration = 1
  AND @raw_stockton_store_id IS NOT NULL
  AND (
      LOWER(title) IN ('return sale tax', 'pre-payment sale tax')
      OR LOWER(title) LIKE 'raw stockton - ift tax%'
      OR LOWER(title) LIKE '%stockton%tax%'
      OR LOWER(title) LIKE '%prepayment%'
      OR LOWER(title) LIKE '%pre-payment%'
  );

UPDATE tasks
SET task_category = 'payment',
    direct_store_id = @raw_stockton_store_id,
    project_id = COALESCE(project_id, @finance_project_id),
    updated_at = NOW()
WHERE @review_gate_migration = 1
  AND @raw_stockton_store_id IS NOT NULL
  AND LOWER(title) LIKE '%stockton%amtrust%';

UPDATE tasks
SET task_category = 'payment',
    direct_store_id = @modesto_store_id,
    project_id = COALESCE(project_id, @finance_project_id),
    updated_at = NOW()
WHERE @review_gate_migration = 1
  AND @modesto_store_id IS NOT NULL
  AND LOWER(title) LIKE '%modesto%amtrust%';

UPDATE tasks
SET task_category = 'review'
WHERE @review_gate_migration = 1
  AND LOWER(title) LIKE 'review:%'
  AND COALESCE(task_category, '') <> 'review';
