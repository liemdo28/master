-- Task Approval Workflow Migration
-- Phase: Task Approval Chain (Assignee → Reviewer → Approver)
-- Date: 2026-06-02

-- ============================================================
-- 1. Add approval workflow fields to tasks table
-- ============================================================
ALTER TABLE `tasks`
  ADD COLUMN IF NOT EXISTS `approval_required`      TINYINT(1)   NOT NULL DEFAULT 0          COMMENT 'Enable 3-stage approval chain',
  ADD COLUMN IF NOT EXISTS `reviewer_id`            INT          NULL DEFAULT NULL            COMMENT 'User who reviews submission (stage 2)',
  ADD COLUMN IF NOT EXISTS `approver_id`            INT          NULL DEFAULT NULL            COMMENT 'User who gives final acceptance (stage 3)',
  ADD COLUMN IF NOT EXISTS `final_done_at`          DATETIME     NULL DEFAULT NULL            COMMENT 'Timestamp when task officially became DONE via approval',
  ADD COLUMN IF NOT EXISTS `review_note`            TEXT         NULL DEFAULT NULL            COMMENT 'Reviewer note on approval/rejection',
  ADD COLUMN IF NOT EXISTS `acceptance_note`        TEXT         NULL DEFAULT NULL            COMMENT 'Approver note on acceptance/rejection';

-- ============================================================
-- 2. Extend status ENUM to support full approval status flow
--    Keeps all existing values + adds new approval statuses
-- ============================================================
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

-- ============================================================
-- 3. Indexes for approval queries
-- ============================================================
ALTER TABLE `tasks`
  ADD INDEX IF NOT EXISTS `idx_tasks_reviewer`         (`reviewer_id`),
  ADD INDEX IF NOT EXISTS `idx_tasks_approver`         (`approver_id`),
  ADD INDEX IF NOT EXISTS `idx_tasks_approval_required`(`approval_required`);

-- ============================================================
-- 4. Create task_approval_events audit table
-- ============================================================
CREATE TABLE IF NOT EXISTS `task_approval_events` (
  `id`            BIGINT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  `task_id`       INT              NOT NULL,
  `actor_user_id` INT              NOT NULL,
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
  `from_status`   VARCHAR(64)      NULL,
  `to_status`     VARCHAR(64)      NULL,
  `comment`       TEXT             NULL,
  `evidence_url`  VARCHAR(512)     NULL,
  `is_override`   TINYINT(1)       NOT NULL DEFAULT 0  COMMENT 'CEO/Admin override flag',
  `created_at`    DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX `idx_tae_task`    (`task_id`),
  INDEX `idx_tae_actor`   (`actor_user_id`),
  INDEX `idx_tae_action`  (`action_type`),
  INDEX `idx_tae_created` (`created_at`),

  FOREIGN KEY (`task_id`)       REFERENCES `tasks`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
