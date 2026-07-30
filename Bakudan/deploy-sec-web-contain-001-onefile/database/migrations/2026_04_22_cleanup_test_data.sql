-- ============================================================
-- Migration: cleanup test data + add is_test flag to bills
-- Run once via phpMyAdmin or MySQL CLI
-- ============================================================

-- 1. Add is_test flag to bills table (safe to run multiple times)
ALTER TABLE bills
    ADD COLUMN IF NOT EXISTS is_test TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'Exclude from risk scoring and decision feed';

-- 2. Remove known test bills from production data
--    Targeting: id=4, title='Test 4', amount=0, store=JHT (45 days overdue as of 2026-04-22)
DELETE FROM bills
WHERE id = 4
  AND title = 'Test 4';

-- 3. (Optional) Mark any remaining zero-amount bills with suspicious titles as test data
--    Review these before uncommenting:
-- UPDATE bills SET is_test = 1
-- WHERE amount = 0 AND title LIKE '%test%' AND status NOT IN ('paid');

-- 4. Add index to speed up is_test filter in risk/decision queries
ALTER TABLE bills
    ADD INDEX IF NOT EXISTS idx_bills_is_test (is_test);
