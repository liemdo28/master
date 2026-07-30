-- Finance TaskFlow upgrade
-- Adds timezone support and recurring-occurrence lineage fields used by the
-- Finance / TaskFlow stabilization pass.

ALTER TABLE users
    ADD COLUMN timezone VARCHAR(64) NULL DEFAULT NULL AFTER preferred_language;

ALTER TABLE tasks
    ADD COLUMN recurring_root_id INT NULL DEFAULT NULL AFTER repeat_config,
    ADD COLUMN occurrence_index INT NOT NULL DEFAULT 0 AFTER recurring_root_id;

CREATE INDEX idx_tasks_recurring_root ON tasks(recurring_root_id);
CREATE INDEX idx_tasks_due_repeat ON tasks(due_date, repeat_type, recurring_root_id);
