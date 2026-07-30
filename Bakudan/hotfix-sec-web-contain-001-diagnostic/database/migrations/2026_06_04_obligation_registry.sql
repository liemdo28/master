-- ═══════════════════════════════════════════════════════════════
-- OBLIGATION REGISTRY — CEO Compliance & Payment Operations
-- Date: 2026-06-04
-- Purpose: Master registry of all recurring payment/compliance
--          obligations. Each obligation auto-generates tasks.
-- ═══════════════════════════════════════════════════════════════

-- ============================================================
-- 1. OBLIGATION CATEGORIES
-- Groups obligations by type: Rent, Utility, Insurance, Tax
-- ============================================================
CREATE TABLE IF NOT EXISTS `obligation_categories` (
  `id`          INT             UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  `name`        VARCHAR(100)    NOT NULL  COMMENT 'e.g. Rent, Utility, Insurance, Tax, License',
  `description` VARCHAR(255)    NULL      DEFAULT NULL,
  `sort_order`  INT             NOT NULL  DEFAULT 0,
  `is_active`   TINYINT(1)      NOT NULL  DEFAULT 1,
  `created_at`  DATETIME        NOT NULL  DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME        NOT NULL  DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY `uk_cat_name` (`name`),
  INDEX `idx_cat_active`  (`is_active`),
  INDEX `idx_cat_sort`    (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 2. OBLIGATIONS — Master obligation registry
-- Each row = one recurring obligation (rent, utility, tax, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS `obligations` (
  `id`              INT             UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  `category_id`     INT             UNSIGNED  NULL      DEFAULT NULL  COMMENT 'FK → obligation_categories',
  `name`            VARCHAR(255)    NOT NULL  COMMENT 'e.g. Monthly Rent - Raw Stockton',
  `vendor`          VARCHAR(255)    NULL      DEFAULT NULL  COMMENT 'e.g. Raw Stockton, PG&E, CPS Energy',
  `store_id`        INT             NULL      DEFAULT NULL  COMMENT 'FK → stores (optional, for store-specific)',
  `store_name`      VARCHAR(100)    NULL      DEFAULT NULL  COMMENT 'Denormalised store name for display',
  `frequency`       ENUM('weekly','monthly','quarterly','semi_annual','annual') NOT NULL DEFAULT 'monthly',
  `due_day`         INT             NULL      DEFAULT NULL  COMMENT 'Day of month (1-31) or week (1-7) or quarter (1-4)',
  `due_month`       INT             NULL      DEFAULT NULL  COMMENT 'Month number 1-12 (for semi_annual/annual)',
  `grace_days`      INT             NOT NULL  DEFAULT 3  COMMENT 'Grace period after due date',
  `amount`          DECIMAL(12,2)   NULL      DEFAULT NULL  COMMENT 'Expected amount (optional)',
  `account_info`    TEXT            NULL      DEFAULT NULL  COMMENT 'Payment account details, login, notes',
  `compliance_note` TEXT            NULL      DEFAULT NULL  COMMENT 'Regulatory/compliance notes, links, TABC etc.',
  `reviewer_id`     INT             NULL      DEFAULT NULL  COMMENT 'FK → users (who reviews evidence)',
  `approver_id`     INT             NULL      DEFAULT NULL  COMMENT 'FK → users (who gives final approval)',
  `project_id`      INT             NULL      DEFAULT NULL  COMMENT 'FK → projects (where tasks are created)',
  `section_id`      INT             NULL      DEFAULT NULL  COMMENT 'FK → sections (target section for tasks)',
  `priority`        ENUM('urgent','high','medium','low') NOT NULL DEFAULT 'high',
  `active`          TINYINT(1)      NOT NULL  DEFAULT 1,
  `last_generated`  DATETIME        NULL      DEFAULT NULL  COMMENT 'Last time a task was auto-generated',
  `next_due_date`   DATE            NULL      DEFAULT NULL  COMMENT 'Pre-calculated next due date for cron',
  `created_at`      DATETIME        NOT NULL  DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME        NOT NULL  DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX `idx_obligation_active`    (`active`),
  INDEX `idx_obligation_category`   (`category_id`),
  INDEX `idx_obligation_store`      (`store_id`),
  INDEX `idx_obligation_frequency` (`frequency`),
  INDEX `idx_obligation_next_due`  (`next_due_date`),
  INDEX `idx_obligation_reviewer`   (`reviewer_id`),
  INDEX `idx_obligation_approver`   (`approver_id`),

  CONSTRAINT `fk_obligation_category`
    FOREIGN KEY (`category_id`) REFERENCES `obligation_categories`(`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_obligation_store`
    FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 3. OBLIGATION PAYMENTS — Payment history linked to obligations
-- One row per payment instance, tracks evidence & approval
-- ============================================================
CREATE TABLE IF NOT EXISTS `obligation_payments` (
  `id`                  INT             UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  `obligation_id`       INT             UNSIGNED  NOT NULL,
  `task_id`             INT             NULL      DEFAULT NULL  COMMENT 'FK → tasks (the auto-generated task)',
  `due_date`            DATE            NOT NULL  COMMENT 'Scheduled due date from obligation',
  `amount`              DECIMAL(12,2)   NULL      DEFAULT NULL  COMMENT 'Amount actually paid/owed',
  `status`              ENUM('pending','review','approved','rejected','paid','skipped') NOT NULL DEFAULT 'pending',
  `evidence_invoice`    TINYINT(1)      NOT NULL  DEFAULT 0  COMMENT '1=uploaded',
  `evidence_receipt`    TINYINT(1)      NOT NULL  DEFAULT 0,
  `evidence_bank_proof` TINYINT(1)      NOT NULL  DEFAULT 0,
  `evidence_payment_confirm` TINYINT(1)  NOT NULL  DEFAULT 0,
  `evidence_other`      TINYINT(1)      NOT NULL  DEFAULT 0,
  `reviewer_id`         INT             NULL      DEFAULT NULL  COMMENT 'Assigned reviewer',
  `reviewer_result`     ENUM('approved','rejected','changes_requested') NULL DEFAULT NULL,
  `reviewer_notes`      TEXT            NULL      DEFAULT NULL,
  `reviewer_result_at`  DATETIME        NULL      DEFAULT NULL,
  `approver_id`         INT             NULL      DEFAULT NULL  COMMENT 'Assigned approver',
  `approver_result`     ENUM('approved','rejected','changes_requested') NULL DEFAULT NULL,
  `approver_notes`      TEXT            NULL      DEFAULT NULL,
  `approver_result_at`  DATETIME        NULL      DEFAULT NULL,
  `period_start`        DATE            NULL      DEFAULT NULL  COMMENT 'For quarterly/semi-annual: period start',
  `period_end`          DATE            NULL      DEFAULT NULL  COMMENT 'For quarterly/semi-annual: period end',
  `paid_amount`         DECIMAL(12,2)   NULL      DEFAULT NULL,
  `paid_date`          DATE            NULL      DEFAULT NULL,
  `payment_reference`   VARCHAR(255)    NULL      DEFAULT NULL  COMMENT 'Check #, ACH ref, confirmation #',
  `created_at`          DATETIME        NOT NULL  DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          DATETIME        NOT NULL  DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX `idx_pay_obligation`  (`obligation_id`),
  INDEX `idx_pay_task`        (`task_id`),
  INDEX `idx_pay_status`      (`status`),
  INDEX `idx_pay_due_date`    (`due_date`),
  INDEX `idx_pay_reviewer`    (`reviewer_id`),
  INDEX `idx_pay_approver`    (`approver_id`),
  INDEX `idx_pay_needs_evidence` (`evidence_invoice`, `status`),

  CONSTRAINT `fk_payment_obligation`
    FOREIGN KEY (`obligation_id`) REFERENCES `obligations`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_payment_task`
    FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4. INDEXES for performance on key filter queries
-- ============================================================
-- Additional composite index for dashboard widgets
CREATE INDEX `idx_obligation_dashboard`
  ON `obligations`(`active`, `next_due_date`, `frequency`);

-- For payment queue lookups (reviewer/approver workspace)
CREATE INDEX `idx_payment_queue`
  ON `obligation_payments`(`status`, `reviewer_id`, `approver_id`);