-- ═══════════════════════════════════════════════════════════════
-- P0 EMERGENCY MIGRATION — 2026-06-10
-- Missing reviewer/approval tables causing task detail crashes.
-- All statements use IF NOT EXISTS — safe to run multiple times.
-- ═══════════════════════════════════════════════════════════════

-- ============================================================
-- 1. task_comments
-- ============================================================
CREATE TABLE IF NOT EXISTS `task_comments` (
  `id`           BIGINT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  `task_id`      INT              NOT NULL,
  `user_id`      INT              NOT NULL,
  `content`      TEXT             NOT NULL,
  `comment_type` ENUM('comment','reviewer_note','approval_note','system') NOT NULL DEFAULT 'comment',
  `parent_id`    BIGINT UNSIGNED  NULL DEFAULT NULL,
  `is_deleted`   TINYINT(1)       NOT NULL DEFAULT 0,
  `created_at`   DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_tc_task`    (`task_id`),
  INDEX `idx_tc_user`    (`user_id`),
  INDEX `idx_tc_parent`  (`parent_id`),
  INDEX `idx_tc_created` (`created_at`),
  FOREIGN KEY (`task_id`)   REFERENCES `tasks`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`parent_id`) REFERENCES `task_comments`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 2. task_mentions
-- ============================================================
CREATE TABLE IF NOT EXISTS `task_mentions` (
  `id`                BIGINT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  `task_id`           INT              NOT NULL,
  `comment_id`        BIGINT UNSIGNED  NOT NULL,
  `mentioned_user_id` INT              NOT NULL,
  `mentioned_by`      INT              NOT NULL,
  `mention_context`   VARCHAR(64)      NOT NULL DEFAULT 'comment',
  `created_at`        DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_mention` (`comment_id`, `mentioned_user_id`, `mention_context`),
  INDEX `idx_tm_task`    (`task_id`),
  INDEX `idx_tm_user`    (`mentioned_user_id`),
  INDEX `idx_tm_by`      (`mentioned_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 3. task_notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS `task_notifications` (
  `id`                BIGINT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  `user_id`           INT              NOT NULL,
  `task_id`           INT              NULL DEFAULT NULL,
  `notification_type` VARCHAR(64)      NOT NULL DEFAULT 'mention',
  `title`             VARCHAR(255)     NOT NULL,
  `message`           TEXT             NULL,
  `from_user_id`      INT              NULL DEFAULT NULL,
  `is_read`           TINYINT(1)       NOT NULL DEFAULT 0,
  `metadata`          JSON             NULL DEFAULT NULL,
  `inbox_category`    ENUM('task','review','approval','mention','system') NOT NULL DEFAULT 'task',
  `created_at`        DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_tn_user`    (`user_id`),
  INDEX `idx_tn_task`    (`task_id`),
  INDEX `idx_tn_read`    (`user_id`, `is_read`),
  INDEX `idx_tn_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4. task_reviewer_notes
-- ============================================================
CREATE TABLE IF NOT EXISTS `task_reviewer_notes` (
  `id`               BIGINT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  `task_id`          INT              NOT NULL,
  `user_id`          INT              NOT NULL,
  `note_type`        ENUM('checklist','comment','request','info') NOT NULL DEFAULT 'comment',
  `title`            VARCHAR(255)     NULL DEFAULT NULL,
  `content`          TEXT             NULL DEFAULT NULL,
  `checklist_items`  JSON             NULL DEFAULT NULL,
  `is_completed`     TINYINT(1)       NOT NULL DEFAULT 0,
  `is_acknowledged`  TINYINT(1)       NOT NULL DEFAULT 0,
  `created_at`       DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_trn_task`  (`task_id`),
  INDEX `idx_trn_user`  (`user_id`),
  FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 5. task_approval_notes  ← PRIMARY BLOCKER
-- ============================================================
CREATE TABLE IF NOT EXISTS `task_approval_notes` (
  `id`         BIGINT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  `task_id`    INT              NOT NULL,
  `user_id`    INT              NOT NULL,
  `action`     ENUM('approved','rejected','requested_changes','info_requested') NOT NULL,
  `content`    TEXT             NOT NULL,
  `is_final`   TINYINT(1)       NOT NULL DEFAULT 0,
  `created_at` DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_tan_task`    (`task_id`),
  INDEX `idx_tan_user`    (`user_id`),
  INDEX `idx_tan_action`  (`action`),
  INDEX `idx_tan_created` (`created_at`),
  FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 6. inbox_category column on task_notifications (if missing)
-- ============================================================
ALTER TABLE `task_notifications`
  ADD COLUMN IF NOT EXISTS `inbox_category`
    ENUM('task','review','approval','mention','system') NOT NULL DEFAULT 'task';
