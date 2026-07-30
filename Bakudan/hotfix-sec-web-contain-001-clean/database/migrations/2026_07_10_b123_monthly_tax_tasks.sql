CREATE TABLE IF NOT EXISTS maintenance_runs (
    run_key VARCHAR(120) PRIMARY KEY,
    ran_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    note VARCHAR(255) NULL
);

SET @b123_tax_tasks = NOT EXISTS (
    SELECT 1 FROM maintenance_runs WHERE run_key = '2026_07_10_b123_monthly_tax_tasks_v2'
);

INSERT INTO maintenance_runs (run_key, note)
SELECT '2026_07_10_b123_monthly_tax_tasks_v2', 'B1/B2/B3 monthly Texas tax tasks due on day 10'
WHERE @b123_tax_tasks = 1;

ALTER TABLE tasks ADD COLUMN task_category VARCHAR(50) NULL;

SET @finance_project_id = (
    SELECT id FROM projects
    WHERE LOWER(name) = 'finance'
    ORDER BY id LIMIT 1
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

UPDATE tasks
SET task_category = 'tax',
    project_id = COALESCE(@finance_project_id, project_id),
    updated_at = NOW()
WHERE @b123_tax_tasks = 1
  AND LOWER(title) LIKE '%tax%';

UPDATE tasks t
SET t.title = CASE
        WHEN t.title LIKE 'B1%' THEN 'B1 - File Texas Sales Tax'
        WHEN t.title LIKE 'B2%' THEN 'B2 - File Texas Sales Tax'
        WHEN t.title LIKE 'B3%' THEN 'B3 - File Texas Sales Tax'
        ELSE t.title
    END,
    t.project_id = COALESCE(@finance_project_id, t.project_id),
    t.assignee_id = COALESCE(@admin_user_id, t.assignee_id),
    t.direct_store_id = CASE
        WHEN t.title LIKE 'B1%' THEN COALESCE(@b1_store_id, t.direct_store_id)
        WHEN t.title LIKE 'B2%' THEN COALESCE(@b2_store_id, t.direct_store_id)
        WHEN t.title LIKE 'B3%' THEN COALESCE(@b3_store_id, t.direct_store_id)
        ELSE t.direct_store_id
    END,
    t.due_date = '2026-07-10',
    t.priority = 'high',
    t.status = 'todo',
    t.is_completed = 0,
    t.repeat_type = 'monthly',
    t.repeat_config = '{"interval":1,"by":"day_of_month","day_of_month":10}',
    t.task_category = 'tax',
    t.description = 'Monthly Texas Comptroller filing. Portal: https://mycpa.cpa.state.tx.us/securitymp1portal/displayLoginUser.do Calculation sheet: https://docs.google.com/spreadsheets/d/1yHTaQab-N4jNamxeCCLFE9gKu8JxCjHtIKgrIYVx1HI/edit?gid=0#gid=0',
    t.updated_at = NOW()
WHERE @b123_tax_tasks = 1
  AND (
      LOWER(t.title) LIKE 'b1%texas%sales%tax%'
      OR LOWER(t.title) LIKE 'b2%texas%sales%tax%'
      OR LOWER(t.title) LIKE 'b3%texas%sales%tax%'
      OR LOWER(t.title) LIKE 'b1%file%texas%sales%tax%'
      OR LOWER(t.title) LIKE 'b2%file%texas%sales%tax%'
      OR LOWER(t.title) LIKE 'b3%file%texas%sales%tax%'
  );

INSERT INTO tasks (
    title, description, project_id, assignee_id, due_date, priority, status,
    is_completed, direct_store_id, task_category, repeat_type, repeat_config,
    created_at, updated_at
)
SELECT x.title,
       'Monthly Texas Comptroller filing. Portal: https://mycpa.cpa.state.tx.us/securitymp1portal/displayLoginUser.do Calculation sheet: https://docs.google.com/spreadsheets/d/1yHTaQab-N4jNamxeCCLFE9gKu8JxCjHtIKgrIYVx1HI/edit?gid=0#gid=0',
       @finance_project_id,
       @admin_user_id,
       '2026-07-10',
       'high',
       'todo',
       0,
       x.store_id,
       'tax',
       'monthly',
       '{"interval":1,"by":"day_of_month","day_of_month":10}',
       NOW(),
       NOW()
FROM (
    SELECT @b1_store_id AS store_id, 'B1 - File Texas Sales Tax' AS title
    UNION ALL SELECT @b2_store_id, 'B2 - File Texas Sales Tax'
    UNION ALL SELECT @b3_store_id, 'B3 - File Texas Sales Tax'
) x
WHERE @b123_tax_tasks = 1
  AND x.store_id IS NOT NULL
  AND @finance_project_id IS NOT NULL
  AND @admin_user_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.direct_store_id = x.store_id
        AND LOWER(t.title) = LOWER(x.title)
  );

UPDATE bills
SET category = 'tax',
    updated_at = NOW()
WHERE @b123_tax_tasks = 1
  AND (LOWER(title) LIKE '%tax%' OR LOWER(vendor) LIKE '%comptroller%' OR LOWER(vendor) LIKE '%cdtfa%' OR LOWER(vendor) LIKE '%irs%' OR LOWER(vendor) LIKE '%edd%');
