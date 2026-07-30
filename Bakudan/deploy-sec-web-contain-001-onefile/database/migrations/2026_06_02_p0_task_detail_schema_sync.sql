-- P0 Task Detail Schema Sync
-- Restores task detail pages when Reviewer Workspace code is deployed before DB schema.
-- Safe operations only: ADD COLUMN / MODIFY ENUM / CREATE TABLE IF NOT EXISTS / ADD INDEX IF NOT EXISTS.
-- Date: 2026-06-02

-- ============================================================
-- 1. Approval workflow fields required by Task Detail
-- ============================================================
ALTER TABLE `tasks`
  ADD COLUMN IF NOT EXISTS `approval_required`      TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Enable 3-stage approval chain',
  ADD COLUMN IF NOT EXISTS `reviewer_id`            INT        NULL DEFAULT NULL COMMENT 'User who reviews submission (stage 2)',
  ADD COLUMN IF NOT EXISTS `approver_id`            INT        NULL DEFAULT NULL COMMENT 'User who gives final acceptance (stage 3)',
  ADD COLUMN IF NOT EXISTS `submitted_at`           DATETIME   NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `submitted_by`           INT        NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `checked_at`             DATETIME   NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `checked_by`             INT        NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `accepted_workflow_at`   DATETIME   NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `accepted_workflow_by`   INT        NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `final_done_at`          DATETIME   NULL DEFAULT NULL COMMENT 'Timestamp when task officially became DONE via approval',
  ADD COLUMN IF NOT EXISTS `rejected_at`            DATETIME   NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `rejected_by`            INT        NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `rejection_reason`       TEXT       NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `review_note`            TEXT       NULL DEFAULT NULL COMMENT 'Reviewer note on approval/rejection',
  ADD COLUMN IF NOT EXISTS `acceptance_note`        TEXT       NULL DEFAULT NULL COMMENT 'Approver note on acceptance/rejection';

ALTER TABLE `tasks`
  MODIFY COLUMN `status` ENUM(
    'todo',
    'pending',
    'in_progress',
    'review',
    'done',
    'completed',
    'pending_review',
    'review_rejected',
    'pending_acceptance',
    'acceptance_rejected',
    'accepted'
  ) NOT NULL DEFAULT 'todo';

ALTER TABLE `tasks`
  ADD INDEX IF NOT EXISTS `idx_tasks_reviewer` (`reviewer_id`),
  ADD INDEX IF NOT EXISTS `idx_tasks_approver` (`approver_id`),
  ADD INDEX IF NOT EXISTS `idx_tasks_approval_required` (`approval_required`);

CREATE TABLE IF NOT EXISTS `task_approval_events` (
  `id`            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `task_id`       INT             NOT NULL,
  `actor_user_id` INT             NOT NULL,
  `action_type`   ENUM(
                    'started',
                    'submitted',
                    'review_approved',
                    'review_rejected',
                    'acceptance_approved',
                    'acceptance_rejected',
                    'marked_done',
                    'reopened',
                    'override'
                  ) NOT NULL,
  `from_status`   VARCHAR(64)     NULL,
  `to_status`     VARCHAR(64)     NULL,
  `comment`       TEXT            NULL,
  `evidence_url`  VARCHAR(512)    NULL,
  `is_override`   TINYINT(1)      NOT NULL DEFAULT 0 COMMENT 'CEO/Admin override flag',
  `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX `idx_tae_task` (`task_id`),
  INDEX `idx_tae_actor` (`actor_user_id`),
  INDEX `idx_tae_action` (`action_type`),
  INDEX `idx_tae_created` (`created_at`),

  FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 2. Reviewer Workspace: comments, mentions, notifications, notes
-- ============================================================
CREATE TABLE IF NOT EXISTS `task_comments` (
  `id`              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `task_id`         INT             NOT NULL,
  `user_id`         INT             NOT NULL,
  `content`         TEXT            NOT NULL,
  `comment_type`    ENUM('comment','instruction','question','checklist','note') NOT NULL DEFAULT 'comment',
  `parent_id`       BIGINT UNSIGNED NULL DEFAULT NULL COMMENT 'For threaded replies',
  `is_edited`       TINYINT(1)      NOT NULL DEFAULT 0,
  `created_at`      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX `idx_tc_task` (`task_id`),
  INDEX `idx_tc_user` (`user_id`),
  INDEX `idx_tc_parent` (`parent_id`),
  INDEX `idx_tc_created` (`created_at`),

  FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
  FOREIGN KEY (`parent_id`) REFERENCES `task_comments`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `task_mentions` (
  `id`                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `task_id`           INT             NOT NULL,
  `comment_id`        BIGINT UNSIGNED NULL DEFAULT NULL COMMENT 'Null for reviewer note mentions',
  `mentioned_user_id` INT             NOT NULL,
  `mentioned_by`      INT             NOT NULL,
  `mention_context`   VARCHAR(100)    NULL DEFAULT NULL COMMENT 'e.g. reviewer_note, task_comment, approval_note',
  `is_notified`       TINYINT(1)      NOT NULL DEFAULT 0,
  `created_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX `idx_tm_task` (`task_id`),
  INDEX `idx_tm_user` (`mentioned_user_id`),
  INDEX `idx_tm_comment` (`comment_id`),
  INDEX `idx_tm_created` (`created_at`),

  FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`comment_id`) REFERENCES `task_comments`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`mentioned_user_id`) REFERENCES `users`(`id`),
  FOREIGN KEY (`mentioned_by`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `task_notifications` (
  `id`                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id`           INT             NOT NULL,
  `task_id`           INT             NULL DEFAULT NULL,
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
  `title`             VARCHAR(255)    NOT NULL,
  `message`           TEXT            NULL DEFAULT NULL,
  `from_user_id`      INT             NULL DEFAULT NULL,
  `is_read`           TINYINT(1)      NOT NULL DEFAULT 0,
  `read_at`           DATETIME        NULL DEFAULT NULL,
  `action_url`        VARCHAR(512)    NULL DEFAULT NULL,
  `metadata`          JSON            NULL DEFAULT NULL COMMENT 'Extra data: comment_id, reviewer_note_id, etc.',
  `inbox_category`    ENUM('task','review','approval','mention','system') NOT NULL DEFAULT 'task',
  `created_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX `idx_tn_user` (`user_id`),
  INDEX `idx_tn_task` (`task_id`),
  INDEX `idx_tn_type` (`notification_type`),
  INDEX `idx_tn_read` (`user_id`, `is_read`),
  INDEX `idx_tn_created` (`created_at`),

  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`from_user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `task_reviewer_notes` (
  `id`               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `task_id`          INT             NOT NULL,
  `user_id`          INT             NOT NULL,
  `note_type`        ENUM('description','instruction','checklist','question','general') NOT NULL DEFAULT 'instruction',
  `title`            VARCHAR(255)    NULL DEFAULT NULL,
  `content`          TEXT            NOT NULL,
  `checklist_items`  JSON            NULL DEFAULT NULL COMMENT '[{"text":"...","done":false},...]',
  `attachments`      JSON            NULL DEFAULT NULL COMMENT '[{"name":"...","url":"..."},...]',
  `is_completed`     TINYINT(1)      NOT NULL DEFAULT 0,
  `is_acknowledged`  TINYINT(1)      NOT NULL DEFAULT 0,
  `acknowledged_by`  INT             NULL DEFAULT NULL,
  `acknowledged_at`  DATETIME        NULL DEFAULT NULL,
  `created_at`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX `idx_trn_task` (`task_id`),
  INDEX `idx_trn_user` (`user_id`),
  INDEX `idx_trn_type` (`note_type`),
  INDEX `idx_trn_done` (`is_completed`),

  FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
  FOREIGN KEY (`acknowledged_by`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `task_approval_notes` (
  `id`         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `task_id`    INT             NOT NULL,
  `user_id`    INT             NOT NULL,
  `action`     ENUM('approved','rejected','requested_changes','info_requested') NOT NULL,
  `content`    TEXT            NOT NULL,
  `is_final`   TINYINT(1)      NOT NULL DEFAULT 0,
  `created_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX `idx_tan_task` (`task_id`),
  INDEX `idx_tan_user` (`user_id`),
  INDEX `idx_tan_action` (`action`),
  INDEX `idx_tan_created` (`created_at`),

  FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
