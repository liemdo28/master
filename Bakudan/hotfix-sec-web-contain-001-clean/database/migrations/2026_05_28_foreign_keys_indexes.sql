-- Production Hardening: Foreign Keys & Indexes
-- Run: May 2026
-- Adds missing indexes for query performance and foreign key constraints for referential integrity.
-- Idempotent: safe to run multiple times (uses IF NOT EXISTS checks via procedure).

-- ============================================================
-- PART 1: INDEXES
-- ============================================================

DROP PROCEDURE IF EXISTS taskflow_add_indexes;
DELIMITER $$
CREATE PROCEDURE taskflow_add_indexes()
BEGIN
    -- tasks.due_date (calendar queries)
    IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'tasks' AND index_name = 'idx_tasks_due_date') THEN
        CREATE INDEX idx_tasks_due_date ON tasks(due_date);
    END IF;

    -- tasks.assignee_id (user task queries)
    IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'tasks' AND index_name = 'idx_tasks_assignee_id') THEN
        CREATE INDEX idx_tasks_assignee_id ON tasks(assignee_id);
    END IF;

    -- tasks.project_id (project task queries)
    IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'tasks' AND index_name = 'idx_tasks_project_id') THEN
        CREATE INDEX idx_tasks_project_id ON tasks(project_id);
    END IF;

    -- tasks.recurring_root_id (recurrence lookups)
    IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'tasks' AND index_name = 'idx_tasks_recurring_root_id') THEN
        CREATE INDEX idx_tasks_recurring_root_id ON tasks(recurring_root_id);
    END IF;

    -- tasks.parent_task_id (children lookups)
    IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'tasks' AND index_name = 'idx_tasks_parent_task_id') THEN
        CREATE INDEX idx_tasks_parent_task_id ON tasks(parent_task_id);
    END IF;

    -- tasks.is_completed (status filters)
    IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'tasks' AND index_name = 'idx_tasks_is_completed') THEN
        CREATE INDEX idx_tasks_is_completed ON tasks(is_completed);
    END IF;

    -- tasks.status (status filters)
    IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'tasks' AND index_name = 'idx_tasks_status') THEN
        CREATE INDEX idx_tasks_status ON tasks(status);
    END IF;

    -- tasks.created_by (creator queries)
    IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'tasks' AND index_name = 'idx_tasks_created_by') THEN
        CREATE INDEX idx_tasks_created_by ON tasks(created_by);
    END IF;

    -- task_watchers (task_id, user_id) UNIQUE
    IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'task_watchers' AND index_name = 'idx_task_watchers_unique') THEN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'task_watchers') THEN
            CREATE UNIQUE INDEX idx_task_watchers_unique ON task_watchers(task_id, user_id);
        END IF;
    END IF;

    -- comments.task_id (comment lookups)
    IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'comments' AND index_name = 'idx_comments_task_id') THEN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'comments') THEN
            CREATE INDEX idx_comments_task_id ON comments(task_id);
        END IF;
    END IF;

    -- attachments.task_id (attachment lookups)
    IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'attachments' AND index_name = 'idx_attachments_task_id') THEN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'attachments') THEN
            CREATE INDEX idx_attachments_task_id ON attachments(task_id);
        END IF;
    END IF;
END$$
DELIMITER ;

CALL taskflow_add_indexes();
DROP PROCEDURE IF EXISTS taskflow_add_indexes;


-- ============================================================
-- PART 2: FOREIGN KEYS
-- ============================================================

DROP PROCEDURE IF EXISTS taskflow_add_foreign_keys;
DELIMITER $$
CREATE PROCEDURE taskflow_add_foreign_keys()
BEGIN
    -- tasks.project_id -> projects.id (SET NULL on delete - don't lose tasks)
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND table_name = 'tasks' AND constraint_name = 'fk_tasks_project_id') THEN
        ALTER TABLE tasks ADD CONSTRAINT fk_tasks_project_id
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
    END IF;

    -- tasks.assignee_id -> users.id (SET NULL on delete - unassign)
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND table_name = 'tasks' AND constraint_name = 'fk_tasks_assignee_id') THEN
        ALTER TABLE tasks ADD CONSTRAINT fk_tasks_assignee_id
            FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;

    -- tasks.created_by -> users.id (SET NULL on delete)
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND table_name = 'tasks' AND constraint_name = 'fk_tasks_created_by') THEN
        ALTER TABLE tasks ADD CONSTRAINT fk_tasks_created_by
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;

    -- tasks.parent_task_id -> tasks.id (SET NULL on delete)
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND table_name = 'tasks' AND constraint_name = 'fk_tasks_parent_task_id') THEN
        ALTER TABLE tasks ADD CONSTRAINT fk_tasks_parent_task_id
            FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE SET NULL;
    END IF;

    -- task_watchers.task_id -> tasks.id (CASCADE delete)
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND table_name = 'task_watchers' AND constraint_name = 'fk_task_watchers_task_id') THEN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'task_watchers') THEN
            ALTER TABLE task_watchers ADD CONSTRAINT fk_task_watchers_task_id
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
        END IF;
    END IF;

    -- task_watchers.user_id -> users.id (CASCADE delete)
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND table_name = 'task_watchers' AND constraint_name = 'fk_task_watchers_user_id') THEN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'task_watchers') THEN
            ALTER TABLE task_watchers ADD CONSTRAINT fk_task_watchers_user_id
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
        END IF;
    END IF;

    -- comments.task_id -> tasks.id (CASCADE delete)
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND table_name = 'comments' AND constraint_name = 'fk_comments_task_id') THEN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'comments') THEN
            ALTER TABLE comments ADD CONSTRAINT fk_comments_task_id
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
        END IF;
    END IF;

    -- attachments.task_id -> tasks.id (CASCADE delete)
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND table_name = 'attachments' AND constraint_name = 'fk_attachments_task_id') THEN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'attachments') THEN
            ALTER TABLE attachments ADD CONSTRAINT fk_attachments_task_id
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
        END IF;
    END IF;
END$$
DELIMITER ;

CALL taskflow_add_foreign_keys();
DROP PROCEDURE IF EXISTS taskflow_add_foreign_keys;


-- ============================================================
-- PART 3: UNIQUE RECURRENCE OCCURRENCE GUARD
-- ============================================================
-- Prevent duplicate generated occurrences for the same recurring root + due_date.
-- MySQL UNIQUE allows multiple NULL recurring_root_id values, so non-recurring
-- tasks are unaffected.
DROP PROCEDURE IF EXISTS taskflow_add_unique_recurrence_guard;
DELIMITER $$
CREATE PROCEDURE taskflow_add_unique_recurrence_guard()
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = 'tasks'
          AND index_name = 'idx_unique_recurrence_occurrence'
    ) THEN
        CREATE UNIQUE INDEX idx_unique_recurrence_occurrence ON tasks(recurring_root_id, due_date);
    END IF;
END$$
DELIMITER ;

CALL taskflow_add_unique_recurrence_guard();
DROP PROCEDURE IF EXISTS taskflow_add_unique_recurrence_guard;
