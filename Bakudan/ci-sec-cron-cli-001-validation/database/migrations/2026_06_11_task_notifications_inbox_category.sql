-- Fix: add inbox_category column to task_notifications if missing
-- SQLSTATE[42S22] Unknown column 'inbox_category' in 'field list'

ALTER TABLE `task_notifications`
  ADD COLUMN `inbox_category`
    ENUM('task','review','approval','mention','system') NOT NULL DEFAULT 'task';

-- Backfill existing rows using notification_type to infer category
UPDATE `task_notifications`
SET `inbox_category` = CASE
    WHEN `notification_type` IN ('review_requested','review_completed','review_rejected') THEN 'review'
    WHEN `notification_type` IN ('approval_requested','approved','approval_rejected')      THEN 'approval'
    WHEN `notification_type` = 'mention'                                                   THEN 'mention'
    WHEN `notification_type` = 'system'                                                    THEN 'system'
    ELSE 'task'
  END
WHERE `inbox_category` = 'task';
