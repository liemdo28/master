-- ============================================================
-- TaskFlow v5 — Finance Architecture Upgrade
-- Run AFTER schema.sql + schema_v2/v3/v4.sql
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. BUSINESSES TABLE
--    Canonical entity layer above "stores"
--    type: holding (parent company) | brand (operating brand) | store (single location) | other
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS businesses (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(200) NOT NULL,
    short_name VARCHAR(50)  NULL,
    type       ENUM('holding','brand','store','other') NOT NULL DEFAULT 'store',
    parent_id  INT NULL DEFAULT NULL,
    color      VARCHAR(7)   NOT NULL DEFAULT '#6B7280',
    sort_order INT NOT NULL DEFAULT 0,
    is_active  TINYINT(1)   NOT NULL DEFAULT 1,
    created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES businesses(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- 2. LINK STORES → BUSINESSES
-- ─────────────────────────────────────────────────────────────
ALTER TABLE stores
    ADD COLUMN IF NOT EXISTS business_id INT NULL DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS type        ENUM('store','office','warehouse','virtual') NOT NULL DEFAULT 'store';

-- Add FK only if not already present
SET @fk_exists = (
    SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'stores'
    AND CONSTRAINT_NAME = 'fk_stores_business'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @sql = IF(@fk_exists = 0,
    'ALTER TABLE stores ADD CONSTRAINT fk_stores_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ─────────────────────────────────────────────────────────────
-- 3. VENDOR CATEGORY
-- ─────────────────────────────────────────────────────────────
ALTER TABLE vendors
    ADD COLUMN IF NOT EXISTS category ENUM(
        'utilities','tax','insurance','rent','payroll',
        'subscription','supplies','maintenance','banking','general'
    ) NOT NULL DEFAULT 'general',
    ADD COLUMN IF NOT EXISTS account_number VARCHAR(100) NULL DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS contact_name   VARCHAR(100) NULL DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS contact_phone  VARCHAR(50)  NULL DEFAULT NULL;

-- ─────────────────────────────────────────────────────────────
-- 4. BILLS — is_template FLAG
--    Explicit marker: 1 = this row defines a recurring schedule
--                     0 = this row is an actual bill instance
-- ─────────────────────────────────────────────────────────────
ALTER TABLE bills
    ADD COLUMN IF NOT EXISTS is_template   TINYINT(1)  NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS business_id   INT NULL DEFAULT NULL;

-- Back-fill: recurring parents become templates
UPDATE bills SET is_template = 1
WHERE repeat_parent_id IS NULL
  AND repeat_type IS NOT NULL
  AND repeat_type <> 'none';

-- Add FK to businesses (non-blocking — bills may already have store→business mapping)
SET @fk2_exists = (
    SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bills'
    AND CONSTRAINT_NAME = 'fk_bills_business'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @sql2 = IF(@fk2_exists = 0,
    'ALTER TABLE bills ADD CONSTRAINT fk_bills_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL',
    'SELECT 1'
);
PREPARE stmt2 FROM @sql2; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;

-- ─────────────────────────────────────────────────────────────
-- 5. PAYMENTS TABLE
--    Records each actual payment event; bills.status updated separately.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    bill_id      INT NOT NULL,
    amount       DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    paid_at      DATETIME      NOT NULL,
    method       ENUM('bank_transfer','cash','check','card','zelle','auto','ach','wire','other')
                 NOT NULL DEFAULT 'bank_transfer',
    reference    VARCHAR(200)  NULL DEFAULT NULL COMMENT 'Check #, transaction ID, confirmation',
    note         TEXT          NULL,
    created_by   INT           NULL DEFAULT NULL,
    created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bill_id)    REFERENCES bills(id)  ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)  ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX IF NOT EXISTS idx_payments_bill    ON payments(bill_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(paid_at);

-- ─────────────────────────────────────────────────────────────
-- 6. SEED — BUSINESS HIERARCHY
--    Adjust names to match your actual stores table values.
-- ─────────────────────────────────────────────────────────────

-- Top-level holding companies
INSERT IGNORE INTO businesses (id, name, short_name, type, parent_id, color, sort_order) VALUES
(1,  'Heo Holding',      'Heo',   'holding', NULL, '#7C3AED', 10),
(2,  'Raw Brand',        'Raw',   'holding', NULL, '#DC2626', 20),
(3,  'Other',            NULL,    'other',   NULL, '#6B7280', 99);

-- Operating brands under Heo Holding
INSERT IGNORE INTO businesses (id, name, short_name, type, parent_id, color, sort_order) VALUES
(10, 'Heo Restaurant',   'Heo',   'brand',   1, '#8B5CF6', 11),
(11, 'Bakudan Ramen',    'Baku',  'brand',   1, '#F59E0B', 12);

-- Operating brands under Raw
INSERT IGNORE INTO businesses (id, name, short_name, type, parent_id, color, sort_order) VALUES
(20, 'Raw Stockton',     'Raw ST','brand',   2, '#EF4444', 21),
(21, 'Raw General',      'Raw G', 'brand',   2, '#F97316', 22);

-- ─────────────────────────────────────────────────────────────
-- 7. MAP EXISTING STORES → BUSINESSES
--    Pattern-matches store names; adjust WHERE clauses as needed.
-- ─────────────────────────────────────────────────────────────

-- Heo / Heo Holding stores → business 10
UPDATE stores SET business_id = 10
WHERE (LOWER(name) LIKE '%heo%' OR LOWER(name) LIKE '%bao%')
  AND LOWER(name) NOT LIKE '%holding%'
  AND business_id IS NULL;

-- Heo Holding corporate → business 1
UPDATE stores SET business_id = 1
WHERE LOWER(name) LIKE '%holding%'
  AND business_id IS NULL;

-- Raw Stockton → business 20
UPDATE stores SET business_id = 20
WHERE (LOWER(name) LIKE '%raw%stockton%' OR LOWER(name) LIKE '%stockton%raw%')
  AND business_id IS NULL;

-- Raw PGE, Raw Tax, Raw General, Raw Sale Tax → business 21 (Raw General operations)
UPDATE stores SET business_id = 21
WHERE LOWER(name) LIKE '%raw%'
  AND business_id IS NULL;

-- Bakudan Ramen → business 11
UPDATE stores SET business_id = 11
WHERE LOWER(name) LIKE '%bakudan%' OR LOWER(name) LIKE '%ramen%'
  AND business_id IS NULL;

-- Anything left-over → Other
UPDATE stores SET business_id = 3
WHERE business_id IS NULL AND is_active = 1;

-- ─────────────────────────────────────────────────────────────
-- 8. MAP BILLS → BUSINESSES (inherit from store)
-- ─────────────────────────────────────────────────────────────
UPDATE bills b
JOIN stores s ON s.id = b.store_id
SET b.business_id = s.business_id
WHERE b.business_id IS NULL AND s.business_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- 9. VENDOR CATEGORY SEEDING (best-effort pattern match)
-- ─────────────────────────────────────────────────────────────
UPDATE vendors SET category = 'utilities'    WHERE LOWER(name) LIKE '%pge%'      OR LOWER(name) LIKE '%pg&e%'    OR LOWER(name) LIKE '%electric%' OR LOWER(name) LIKE '%water%' OR LOWER(name) LIKE '%gas%';
UPDATE vendors SET category = 'tax'          WHERE LOWER(name) LIKE '%tax%'      OR LOWER(name) LIKE '%cdtfa%'   OR LOWER(name) LIKE '%irs%'      OR LOWER(name) LIKE '%franchise%';
UPDATE vendors SET category = 'payroll'      WHERE LOWER(name) LIKE '%payroll%'  OR LOWER(name) LIKE '%adp%'     OR LOWER(name) LIKE '%gusto%';
UPDATE vendors SET category = 'insurance'    WHERE LOWER(name) LIKE '%insurance%'OR LOWER(name) LIKE '%amtrust%' OR LOWER(name) LIKE '%liability%';
UPDATE vendors SET category = 'rent'         WHERE LOWER(name) LIKE '%rent%'     OR LOWER(name) LIKE '%lease%'   OR LOWER(name) LIKE '%landlord%';
UPDATE vendors SET category = 'subscription' WHERE LOWER(name) LIKE '%quickbook%'OR LOWER(name) LIKE '%toast%'   OR LOWER(name) LIKE '%square%'   OR LOWER(name) LIKE '%software%';

-- ─────────────────────────────────────────────────────────────
-- 10. PERFORMANCE INDEXES
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bills_business    ON bills(business_id);
CREATE INDEX IF NOT EXISTS idx_bills_is_template ON bills(is_template);
CREATE INDEX IF NOT EXISTS idx_stores_business   ON stores(business_id);
