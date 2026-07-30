-- Phase 11.6: Adoption Analytics — Usage Event Tracking
-- Lightweight event logging to measure real feature adoption

CREATE TABLE IF NOT EXISTS `usage_events` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `event` VARCHAR(100) NOT NULL COMMENT 'Event name: search, workspace_view, fab_create_task, etc.',
    `page` VARCHAR(200) NULL COMMENT 'Page URL where event occurred',
    `metadata` JSON NULL COMMENT 'Optional context: search query, item type, etc.',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_usage_user_event` (`user_id`, `event`),
    INDEX `idx_usage_event_date` (`event`, `created_at`),
    INDEX `idx_usage_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
