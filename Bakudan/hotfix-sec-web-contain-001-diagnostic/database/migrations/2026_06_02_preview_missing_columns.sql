-- ============================================================
-- TaskFlow — Preview Missing Columns Fix (Dashboard 4)
-- Fixes schema drift in preview (bakudan_preview) database.
-- These columns were referenced in code but not present in the preview DB
-- because earlier migration files were not applied to the preview.
-- ============================================================

-- 1. TASKS: visibility column (added by phase11_5 but may not have run on preview)
ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS `visibility`
        ENUM('private', 'public')
        DEFAULT 'private'
        COMMENT 'private=only assignee/creator/admin, public=project members'
        AFTER status;

-- 2. TASKS: visibility tracking
ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS `private_by_user_id`
        INT NULL DEFAULT NULL
        COMMENT 'User who marked task private (for private tasks)'
        AFTER visibility;

-- 3. TASKS: repeat extension columns (may not have run on preview)
ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS `repeat_from_mode`
        ENUM('due_date', 'completion_date')
        DEFAULT 'due_date'
        COMMENT 'Recurrence base: from due date or from completion date'
        AFTER repeat_config;

ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS `repeat_end_type`
        ENUM('never', 'on_date', 'after_count')
        DEFAULT 'never'
        COMMENT 'When recurrence ends'
        AFTER repeat_from_mode;

ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS `repeat_end_date`
        DATE NULL DEFAULT NULL
        COMMENT 'End date for recurrence'
        AFTER repeat_end_type;

ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS `repeat_end_count`
        INT NULL DEFAULT NULL
        COMMENT 'Max number of occurrences before stopping'
        AFTER repeat_end_date;

-- 4. TASKS: estimated_time (may not have been added)
ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS `estimated_time`
        INT NULL DEFAULT NULL
        COMMENT 'Estimated time in minutes'
        AFTER repeat_end_count;

-- 5. Indexes for repeat queries
CREATE INDEX IF NOT EXISTS idx_tasks_visibility ON tasks(visibility);
CREATE INDEX IF NOT EXISTS idx_tasks_repeat_end ON tasks(repeat_end_type, repeat_end_date, repeat_end_count);

-- 6. RELEASES: published_by column (needed by Release.getCurrentLiveVersion)
-- Check if the column exists first (MySQL doesn't support ADD COLUMN IF NOT EXISTS across all versions)
SET @col_exists = (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'releases'
      AND column_name = 'published_by'
);
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE releases ADD COLUMN published_by INT UNSIGNED NULL DEFAULT NULL AFTER approval_complete',
    'SELECT 1 AS already_exists');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 7. RELEASES: scheduled_timezone (needed by release governance)
SET @col_exists2 = (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'releases'
      AND column_name = 'scheduled_timezone'
);
SET @sql2 = IF(@col_exists2 = 0,
    'ALTER TABLE releases ADD COLUMN scheduled_timezone VARCHAR(64) DEFAULT NULL AFTER scheduled_at',
    'SELECT 1 AS already_exists');
PREPARE stmt2 FROM @sql2; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;

-- 8. RELEASES: add index on published_at
CREATE INDEX IF NOT EXISTS idx_releases_published ON releases(published_at);

-- 9. TASK_WATCHERS: ensure table exists (needed for task visibility)
CREATE TABLE IF NOT EXISTS task_watchers (
    task_id INT NOT NULL,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (task_id, user_id),
    INDEX idx_watcher_user (user_id),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SELECT 'Preview migration 2026_06_02_preview_missing_columns.sql completed' AS status;
