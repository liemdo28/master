-- ============================================================
-- TaskFlow — Task Bill Finance Upgrade
-- Run via: dl-migrations.php or mysql < this_file.sql
-- ============================================================

-- 1. TASKS: task_category
ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS task_category
        ENUM('payroll','tax','sale_receipt','bill','payment','store_operation','admin','other')
        DEFAULT 'store_operation'
        AFTER visibility;

-- 2. TASKS: bill_id link
ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS bill_id INT NULL DEFAULT NULL
    AFTER task_category;

-- 3. TASKS: direct store_id (for tasks without project)
ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS direct_store_id INT NULL DEFAULT NULL
    AFTER bill_id;

-- 4. TASKS: workflow tracking columns
ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS submitted_at DATETIME NULL DEFAULT NULL AFTER accepted_at,
    ADD COLUMN IF NOT EXISTS submitted_by INT NULL DEFAULT NULL AFTER submitted_at,
    ADD COLUMN IF NOT EXISTS checked_at DATETIME NULL DEFAULT NULL AFTER submitted_by,
    ADD COLUMN IF NOT EXISTS checked_by INT NULL DEFAULT NULL AFTER checked_at,
    ADD COLUMN IF NOT EXISTS accepted_workflow_at DATETIME NULL DEFAULT NULL AFTER checked_by,
    ADD COLUMN IF NOT EXISTS accepted_workflow_by INT NULL DEFAULT NULL AFTER accepted_workflow_at,
    ADD COLUMN IF NOT EXISTS rejected_at DATETIME NULL DEFAULT NULL AFTER accepted_workflow_by,
    ADD COLUMN IF NOT EXISTS rejected_by INT NULL DEFAULT NULL AFTER rejected_at,
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT NULL DEFAULT NULL AFTER rejected_by,
    ADD COLUMN IF NOT EXISTS approved_by INT NULL DEFAULT NULL AFTER rejection_reason,
    ADD COLUMN IF NOT EXISTS approved_at DATETIME NULL DEFAULT NULL AFTER approved_by,
    ADD COLUMN IF NOT EXISTS approved_note TEXT NULL DEFAULT NULL AFTER approved_at;

-- 5. BILLS: finance_category
ALTER TABLE bills
    ADD COLUMN IF NOT EXISTS finance_category
        ENUM('payroll','tax','rent','utility','vendor','insurance','other')
        DEFAULT 'other'
        AFTER vendor_id;

-- 6. BILLS: workflow_status
ALTER TABLE bills
    ADD COLUMN IF NOT EXISTS workflow_status
        ENUM('draft','submitting','checking','accepted','rejected','paid')
        DEFAULT 'draft'
        AFTER status;

-- Back-fill bills workflow_status
UPDATE bills SET workflow_status = 'paid' WHERE status = 'paid';
UPDATE bills SET workflow_status = 'checking' WHERE status IN ('pending','overdue');
UPDATE bills SET workflow_status = 'rejected' WHERE status = 'cancelled';
UPDATE bills SET workflow_status = 'draft' WHERE workflow_status IS NULL;

-- 7. PAYMENTS: store_id
ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS store_id INT NULL DEFAULT NULL AFTER bill_id;

-- 8. TASK_BILL_AUDIT_LOG
CREATE TABLE IF NOT EXISTS task_bill_audit_log (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    task_id         INT NOT NULL,
    action          ENUM('submit','check','accept','reject','reopen') NOT NULL,
    actor_id        INT NOT NULL,
    note            TEXT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id)  REFERENCES tasks(id)  ON DELETE CASCADE,
    FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_task_audit_task (task_id),
    INDEX idx_task_audit_actor (actor_id),
    INDEX idx_task_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. TASK_DUPLICATE_AUDIT
CREATE TABLE IF NOT EXISTS task_duplicate_audit (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    task_id         INT NOT NULL,
    duplicate_of    INT NULL DEFAULT NULL,
    match_type      ENUM('exact','likely','possible') NOT NULL DEFAULT 'possible',
    match_fields    JSON NULL,
    status          ENUM('pending','merged','archived','ignored') NOT NULL DEFAULT 'pending',
    audited_by      INT NULL DEFAULT NULL,
    audited_at      DATETIME NULL DEFAULT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id)     REFERENCES tasks(id)         ON DELETE CASCADE,
    FOREIGN KEY (duplicate_of) REFERENCES tasks(id)        ON DELETE SET NULL,
    FOREIGN KEY (audited_by)  REFERENCES users(id)          ON DELETE SET NULL,
    INDEX idx_duplicate_task (task_id),
    INDEX idx_duplicate_canonical (duplicate_of),
    INDEX idx_duplicate_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. INDEXES
CREATE INDEX IF NOT EXISTS idx_tasks_category      ON tasks(task_category);
CREATE INDEX IF NOT EXISTS idx_tasks_bill_id       ON tasks(bill_id);
CREATE INDEX IF NOT EXISTS idx_tasks_direct_store  ON tasks(direct_store_id);
CREATE INDEX IF NOT EXISTS idx_tasks_submitted_at  ON tasks(submitted_at);
CREATE INDEX IF NOT EXISTS idx_tasks_workflow_stages ON tasks(submitted_at, checked_at, accepted_workflow_at, rejected_at);
CREATE INDEX IF NOT EXISTS idx_bills_finance_cat    ON bills(finance_category);
CREATE INDEX IF NOT EXISTS idx_bills_workflow      ON bills(workflow_status);
CREATE INDEX IF NOT EXISTS idx_payments_store_id    ON payments(store_id);

-- 11. FK for approved_by
SET @fk_approved = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks'
    AND CONSTRAINT_NAME = 'fk_tasks_approved_by' AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql_approved = IF(@fk_approved = 0,
    'ALTER TABLE tasks ADD CONSTRAINT fk_tasks_approved_by FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL',
    'SELECT 1');
PREPARE stmt_approved FROM @sql_approved; EXECUTE stmt_approved; DEALLOCATE PREPARE stmt_approved;
