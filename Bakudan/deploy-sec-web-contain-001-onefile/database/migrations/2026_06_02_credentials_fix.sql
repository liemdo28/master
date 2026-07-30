-- Phase 14 Fix: Remove overly-strict UNIQUE KEY on credential_rotation_tasks
-- The original key (credential_id, status) blocks multiple completed tasks per credential
-- Replace with an index that only prevents duplicate PENDING tasks per credential

-- Drop the unique constraint if it exists
ALTER TABLE `credential_rotation_tasks`
    DROP INDEX IF EXISTS `uk_rotation_credential_pending`;

-- Add a partial-style check: only one active (pending/in_progress) task per credential
-- MySQL doesn't support partial indexes, so we use a regular index + app-level enforcement
ALTER TABLE `credential_rotation_tasks`
    ADD INDEX IF NOT EXISTS `idx_rotation_credential_status` (`credential_id`, `status`);
