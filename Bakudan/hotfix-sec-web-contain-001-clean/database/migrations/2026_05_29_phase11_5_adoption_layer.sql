-- Phase 11.5: Operational Adoption Layer Migration
-- Creates tables for favorites, dashboard layouts, notifications enhancements

-- User Favorites / Pinned Items (Module 4)
CREATE TABLE IF NOT EXISTS `user_favorites` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `type` VARCHAR(50) NOT NULL COMMENT 'store, report, release, employee, page',
    `ref_id` BIGINT UNSIGNED NULL COMMENT 'Reference ID for the entity',
    `title` VARCHAR(255) NOT NULL,
    `url` VARCHAR(500) NOT NULL,
    `sort_order` INT UNSIGNED NOT NULL DEFAULT 0,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_user_favorites_user` (`user_id`),
    INDEX `idx_user_favorites_type` (`user_id`, `type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dashboard Customization Layouts (Module 8)
CREATE TABLE IF NOT EXISTS `user_dashboard_layouts` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `user_id` BIGINT UNSIGNED NOT NULL UNIQUE,
    `layout_json` JSON NOT NULL COMMENT 'Widget order, visibility, sizes',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_dashboard_layouts_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add snoozed_until column to notifications if not exists
-- (Module 3: Notification Center snooze feature)
ALTER TABLE `notifications` ADD COLUMN IF NOT EXISTS `snoozed_until` DATETIME NULL DEFAULT NULL AFTER `is_read`;

-- Release Artifacts (Module 9)
CREATE TABLE IF NOT EXISTS `release_artifacts` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `release_id` BIGINT UNSIGNED NOT NULL,
    `type` VARCHAR(50) NOT NULL COMMENT 'video, qa_report, screenshot, release_notes, rollback_plan',
    `title` VARCHAR(255) NOT NULL,
    `file_path` VARCHAR(500) NULL,
    `url` VARCHAR(500) NULL,
    `description` TEXT NULL,
    `uploaded_by` BIGINT UNSIGNED NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_release_artifacts_release` (`release_id`),
    INDEX `idx_release_artifacts_type` (`release_id`, `type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
