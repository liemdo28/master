-- Reviewer Workspace Migration
-- CEO UPDATE — REVIEWER WORKSPACE + MENTIONS + NOTIFICATIONS
-- Date: 2026-06-02

-- ============================================================
-- 1. task_comments table (replaces/extends basic comments)
-- ============================================================
CREATE TABLE IF NOT EXISTS `task_comments` (
  `id`              BIGINT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  `task_id`         INT              NOT NULL,
  `user_id`         INT              NOT NULL,
  `content`         TEXT             NOT NULL,
  `comment_type`    ENUM('comment','instruction','question','checklist','note') NOT NULL DEFAULT 'comment',
  `parent_id`       BIGINT UNSIGNED  NULL DEFAULT NULL  COMMENT 'For threaded replies',
  `is_edited`       TINYINT(1)       NOT NULL DEFAULT 0,
  `created_at`       DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX `idx_tc_task`    (`task_id`),
  INDEX `idx_tc_user`    (`user_id`),
  INDEX `idx_tc_parent`  (`parent_id`),
  INDEX `idx_tc_created`  (`created_at`),

  FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
  FOREIGN KEY (`parent_id`) REFERENCES `task_comments`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 2. task_mentions table — who was @mentioned where
-- ============================================================
CREATE TABLE IF NOT EXISTS `task_mentions` (
  `id`               BIGINT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  `task_id`         INT              NOT NULL,
  `comment_id`      BIGINT UNSIGNED  NULL DEFAULT NULL  COMMENT 'Null for reviewer note mentions',
  `mentioned_user_id` INT             NOT NULL,
  `mentioned_by`    INT              NOT NULL,
  `mention_context` VARCHAR(100)     NULL DEFAULT NULL  COMMENT 'e.g. reviewer_note, task_comment, approval_note',
  `is_notified`     TINYINT(1)       NOT NULL DEFAULT 0,
  `created_at`       DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX `idx_tm_task`    (`task_id`),
  INDEX `idx_tm_user`    (`mentioned_user_id`),
  INDEX `idx_tm_comment` (`comment_id`),
  INDEX `idx_tm_created` (`created_at`),

  FOREIGN KEY (`task_id`)         REFERENCES `tasks`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`comment_id`)       REFERENCES `task_comments`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`mentioned_user_id`) REFERENCES `users`(`id`),
  FOREIGN KEY (`mentioned_by`)      REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 3. task_notifications table — in-app notification center
-- ============================================================
CREATE TABLE IF NOT EXISTS `task_notifications` (
  `id`               BIGINT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  `user_id`         INT              NOT NULL,
  `task_id`         INT              NULL DEFAULT NULL,
  `notification_type` ENUM(
                          'task_assigned',
                          'task_submitted',
                          'task_completed',
                          'review_requested',
                          'review_approved',
                          'review_rejected',
                          'approval_requested',
                          'approval_approved',
                          'approval_rejected',
                          'mentioned_in_comment',
                          'mentioned_in_reviewer_note',
                          'mentioned_in_approval_note',
                          'request_changes',
                          'task_completed_final'
                        ) NOT NULL,
  `title`            VARCHAR(255)     NOT NULL,
  `message`          TEXT             NULL DEFAULT NULL,
  `from_user_id`    INT              NULL DEFAULT NULL,
  `is_read`          TINYINT(1)       NOT NULL DEFAULT 0,
  `read_at`          DATETIME         NULL DEFAULT NULL,
  `action_url`       VARCHAR(512)     NULL DEFAULT NULL,
  `metadata`         JSON             NULL DEFAULT NULL  COMMENT 'Extra data: comment_id, reviewer_note_id, etc.',
  `created_at`       DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX `idx_tn_user`    (`user_id`),
  INDEX `idx_tn_task`    (`task_id`),
  INDEX `idx_tn_type`    (`notification_type`),
  INDEX `idx_tn_read`    (`user_id`, `is_read`),
  INDEX `idx_tn_created` (`created_at`),

  FOREIGN KEY (`user_id`)     REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`task_id`)      REFERENCES `tasks`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`from_user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4. reviewer_notes table — reviewer can guide assignee
-- ============================================================
CREATE TABLE IF NOT EXISTS `task_reviewer_notes` (
  `id`               BIGINT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  `task_id`         INT              NOT NULL,
  `user_id`         INT              NOT NULL,
  `note_type`       ENUM('description','instruction','checklist','question','general') NOT NULL DEFAULT 'instruction',
  `title`           VARCHAR(255)     NULL DEFAULT NULL,
  `content`          TEXT             NOT NULL,
  `checklist_items` JSON             NULL DEFAULT NULL  COMMENT '[{"text":"...","done":false},...]',
  `attachments`      JSON             NULL DEFAULT NULL  COMMENT '[{"name":"...","url":"..."},...]',
  `is_completed`     TINYINT(1)       NOT NULL DEFAULT 0,
  `is_acknowledged`  TINYINT(1)       NOT NULL DEFAULT 0,
  `acknowledged_by`  INT              NULL DEFAULT NULL,
  `acknowledged_at`  DATETIME         NULL DEFAULT NULL,
  `created_at`       DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX `idx_trn_task`  (`task_id`),
  INDEX `idx_trn_user`  (`user_id`),
  INDEX `idx_trn_type`  (`note_type`),
  INDEX `idx_trn_done`  (`is_completed`),

  FOREIGN KEY (`task_id`)        REFERENCES `tasks`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`)        REFERENCES `users`(`id`),
  FOREIGN KEY (`acknowledged_by`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 5. approval_notes table — approver notes section
-- ============================================================
CREATE TABLE IF NOT EXISTS `task_approval_notes` (
  `id`               BIGINT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  `task_id`         INT              NOT NULL,
  `user_id`         INT              NOT NULL,
  `action`           ENUM('approved','rejected','requested_changes','info_requested') NOT NULL,
  `content`          TEXT             NOT NULL,
  `is_final`         TINYINT(1)       NOT NULL DEFAULT 0,
  `created_at`       DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX `idx_tan_task` (`task_id`),
  INDEX `idx_tan_user` (`user_id`),
  INDEX `idx_tan_action` (`action`),
  INDEX `idx_tan_created` (`created_at`),

  FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 6. Inbox / Notification badge helpers
-- ============================================================
ALTER TABLE `task_notifications`
  ADD COLUMN IF NOT EXISTS `inbox_category` ENUM('task','review','approval','mention','system') NOT NULL DEFAULT 'task'
  AFTER `metadata`;
