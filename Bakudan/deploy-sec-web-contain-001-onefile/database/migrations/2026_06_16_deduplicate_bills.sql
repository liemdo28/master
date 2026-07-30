-- ============================================================
-- 2026_06_16_deduplicate_bills.sql
-- Deduplicate bills: templates + child instances
-- Root cause: convertProjectsToBills / ensureRecurring ran
-- multiple times creating N copies per (store, title).
-- ============================================================

-- 1. For each (store_id, title, repeat_type) template group,
--    find the ONE id to keep (prefer paid, else oldest id).
-- ============================================================

-- Identify keeper IDs for templates (repeat_parent_id IS NULL)
CREATE TEMPORARY TABLE _keep_templates AS
SELECT
    MIN(CASE WHEN status = 'paid' THEN id ELSE NULL END) AS paid_id,
    MIN(id) AS oldest_id,
    store_id,
    title,
    repeat_type
FROM bills
WHERE (repeat_parent_id IS NULL OR repeat_parent_id = 0)
  AND repeat_type IS NOT NULL
  AND repeat_type <> 'none'
GROUP BY store_id, title, repeat_type;

CREATE TEMPORARY TABLE _keepers AS
SELECT COALESCE(paid_id, oldest_id) AS keep_id
FROM _keep_templates;

-- 2. Reassign children of doomed templates to their keeper
-- ============================================================
UPDATE bills child
JOIN bills parent ON child.repeat_parent_id = parent.id
JOIN _keep_templates kt ON kt.store_id = parent.store_id
                        AND kt.title = parent.title
                        AND kt.repeat_type = parent.repeat_type
SET child.repeat_parent_id = COALESCE(kt.paid_id, kt.oldest_id)
WHERE parent.id <> COALESCE(kt.paid_id, kt.oldest_id)
  AND (parent.repeat_parent_id IS NULL OR parent.repeat_parent_id = 0);

-- 3. Delete duplicate templates (keep only the keeper per group)
-- ============================================================
DELETE FROM bills
WHERE (repeat_parent_id IS NULL OR repeat_parent_id = 0)
  AND repeat_type IS NOT NULL
  AND repeat_type <> 'none'
  AND id NOT IN (SELECT keep_id FROM _keepers);

-- 4. Deduplicate child instances: for each (repeat_parent_id, due_date)
--    keep one — prefer paid, else oldest
-- ============================================================
CREATE TEMPORARY TABLE _keep_children AS
SELECT
    COALESCE(MIN(CASE WHEN status = 'paid' THEN id ELSE NULL END), MIN(id)) AS keep_id
FROM bills
WHERE repeat_parent_id IS NOT NULL
  AND repeat_parent_id > 0
GROUP BY repeat_parent_id, due_date;

DELETE FROM bills
WHERE repeat_parent_id IS NOT NULL
  AND repeat_parent_id > 0
  AND id NOT IN (SELECT keep_id FROM _keep_children);

-- 5. Cleanup orphaned children (parent was deleted above)
-- ============================================================
DELETE FROM bills
WHERE repeat_parent_id IS NOT NULL
  AND repeat_parent_id > 0
  AND repeat_parent_id NOT IN (
      SELECT id FROM bills WHERE repeat_parent_id IS NULL OR repeat_parent_id = 0
  );

-- 6. Also deduplicate one-time (non-recurring) bills with exact same
--    store_id + title + due_date (keep oldest, prefer paid)
-- ============================================================
CREATE TEMPORARY TABLE _keep_onetime AS
SELECT
    COALESCE(MIN(CASE WHEN status = 'paid' THEN id ELSE NULL END), MIN(id)) AS keep_id
FROM bills
WHERE (repeat_type = 'none' OR repeat_type IS NULL)
  AND (repeat_parent_id IS NULL OR repeat_parent_id = 0)
  AND due_date IS NOT NULL
GROUP BY store_id, title, due_date;

DELETE FROM bills
WHERE (repeat_type = 'none' OR repeat_type IS NULL)
  AND (repeat_parent_id IS NULL OR repeat_parent_id = 0)
  AND due_date IS NOT NULL
  AND id NOT IN (SELECT keep_id FROM _keep_onetime);

DROP TEMPORARY TABLE IF EXISTS _keep_templates;
DROP TEMPORARY TABLE IF EXISTS _keepers;
DROP TEMPORARY TABLE IF EXISTS _keep_children;
DROP TEMPORARY TABLE IF EXISTS _keep_onetime;
