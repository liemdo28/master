-- Phase 11: Store Checklists Migration
-- Creates the store_checklists table for opening/closing procedures

CREATE TABLE IF NOT EXISTS `store_checklists` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `store_id` BIGINT UNSIGNED NOT NULL,
    `type` ENUM('open', 'close') NOT NULL,
    `items` JSON NOT NULL COMMENT 'JSON object of checklist items',
    `notes` TEXT NULL,
    `cash_count` DECIMAL(12,2) NULL COMMENT 'Only for close checklists',
    `opened_by` BIGINT UNSIGNED NULL,
    `opened_at` DATETIME NULL,
    `closed_by` BIGINT UNSIGNED NULL,
    `closed_at` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_store_type` (`store_id`, `type`),
    INDEX `idx_opened_at` (`opened_at`),
    INDEX `idx_closed_at` (`closed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
