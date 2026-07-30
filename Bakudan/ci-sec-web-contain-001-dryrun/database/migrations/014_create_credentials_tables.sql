-- Credential Management System Migration
-- Phase 14: Secure Credentials & Password Governance
-- Date: 2026-06-02

-- ============================================
-- Table 1: credentials
-- ============================================
CREATE TABLE IF NOT EXISTS `credentials` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `service_name` VARCHAR(255) NOT NULL COMMENT 'Service/website name',
    `website` VARCHAR(512) NULL COMMENT 'Website URL',
    `login_url` VARCHAR(512) NULL COMMENT 'Direct login URL',
    `username` VARCHAR(255) NULL COMMENT 'Login username',
    `email` VARCHAR(255) NULL COMMENT 'Login email',
    `encrypted_password` TEXT NULL COMMENT 'AES-256-GCM encrypted password',
    `encryption_iv` VARCHAR(64) NULL COMMENT 'Initialization vector (base64)',
    `encryption_tag` VARCHAR(64) NULL COMMENT 'Authentication tag (base64)',
    `password_change_instructions` TEXT NULL COMMENT 'How to change password',
    `rotation_frequency_days` INT UNSIGNED NULL COMMENT 'Days between rotations: 30, 60, 90, 180, 365',
    `last_changed_at` DATETIME NULL COMMENT 'Last password change timestamp',
    `next_rotation_due_at` DATETIME NULL COMMENT 'Next scheduled rotation',
    `owner_user_id` INT UNSIGNED NULL COMMENT 'Primary owner user_id',
    `store_id` INT UNSIGNED NULL COMMENT 'Associated store',
    `department` VARCHAR(128) NULL COMMENT 'Department name',
    `status` ENUM('active', 'inactive', 'compromised', 'deleted') DEFAULT 'active',
    `notes` TEXT NULL COMMENT 'Additional notes',
    `created_by` INT UNSIGNED NOT NULL COMMENT 'Creator user_id',
    `updated_by` INT UNSIGNED NULL COMMENT 'Last updater user_id',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at` DATETIME NULL COMMENT 'Soft delete timestamp',
    
    INDEX `idx_credentials_service` (`service_name`(100)),
    INDEX `idx_credentials_status` (`status`),
    INDEX `idx_credentials_owner` (`owner_user_id`),
    INDEX `idx_credentials_store` (`store_id`),
    INDEX `idx_credentials_rotation_due` (`next_rotation_due_at`),
    INDEX `idx_credentials_deleted` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Table 2: credential_permissions
-- ============================================
CREATE TABLE IF NOT EXISTS `credential_permissions` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `credential_id` INT UNSIGNED NOT NULL COMMENT 'FK to credentials.id',
    `user_id` INT UNSIGNED NOT NULL COMMENT 'FK to users.id',
    `can_view_metadata` BOOLEAN DEFAULT FALSE COMMENT 'View service name, URL, username',
    `can_view_password` BOOLEAN DEFAULT FALSE COMMENT 'Decrypt and view password',
    `can_edit` BOOLEAN DEFAULT FALSE COMMENT 'Edit credential details',
    `can_rotate_password` BOOLEAN DEFAULT FALSE COMMENT 'Change password',
    `can_grant_access` BOOLEAN DEFAULT FALSE COMMENT 'Grant permissions to others',
    `can_delete` BOOLEAN DEFAULT FALSE COMMENT 'Delete credential',
    `granted_by` INT UNSIGNED NOT NULL COMMENT 'Who granted this permission',
    `granted_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `revoked_at` DATETIME NULL COMMENT 'Revocation timestamp',
    
    UNIQUE KEY `uk_credential_user` (`credential_id`, `user_id`),
    INDEX `idx_permissions_user` (`user_id`),
    INDEX `idx_permissions_credential` (`credential_id`),
    
    FOREIGN KEY (`credential_id`) REFERENCES `credentials`(`id`) ON DELETE CASCADE
    -- No FK on user_id/granted_by -> users(id): users.id's column type is
    -- incompatible with INT UNSIGNED here (MySQL 8 rejects the mismatch).
    -- User references are enforced at the application layer, same as
    -- tasks.assignee_id-style columns elsewhere that don't use a DB FK.
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Table 3: credential_audit_logs
-- ============================================
CREATE TABLE IF NOT EXISTS `credential_audit_logs` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `credential_id` INT UNSIGNED NULL COMMENT 'FK to credentials.id (null for bulk actions)',
    `actor_user_id` INT UNSIGNED NOT NULL COMMENT 'Who performed action',
    `action` VARCHAR(64) NOT NULL COMMENT 'Action type',
    `details_json` JSON NULL COMMENT 'Additional action details',
    `ip_address` VARCHAR(45) NULL COMMENT 'Client IP address',
    `user_agent` VARCHAR(512) NULL COMMENT 'Client user agent',
    `success` BOOLEAN DEFAULT TRUE COMMENT 'Action success status',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    INDEX `idx_audit_credential` (`credential_id`),
    INDEX `idx_audit_actor` (`actor_user_id`),
    INDEX `idx_audit_action` (`action`),
    INDEX `idx_audit_created` (`created_at`)
    -- No FK on actor_user_id -> users(id): same type incompatibility as
    -- credential_permissions above.
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Table 4: credential_rotation_tasks
-- ============================================
CREATE TABLE IF NOT EXISTS `credential_rotation_tasks` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `credential_id` INT UNSIGNED NOT NULL COMMENT 'FK to credentials.id',
    `task_id` INT UNSIGNED NULL COMMENT 'FK to tasks.id (if integrated)',
    `status` ENUM('pending', 'in_progress', 'completed', 'cancelled', 'failed') DEFAULT 'pending',
    `due_at` DATETIME NOT NULL COMMENT 'Rotation due date',
    `completed_at` DATETIME NULL COMMENT 'Completion timestamp',
    `password_was_updated` BOOLEAN DEFAULT FALSE COMMENT 'Was vault updated?',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY `uk_rotation_credential_pending` (`credential_id`, `status`),
    INDEX `idx_rotation_due` (`due_at`),
    INDEX `idx_rotation_status` (`status`),
    
    FOREIGN KEY (`credential_id`) REFERENCES `credentials`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Valid action types for audit
-- ============================================
-- credential_created
-- credential_updated
-- password_viewed
-- password_copied
-- password_changed
-- access_granted
-- access_revoked
-- access_updated
-- credential_deleted
-- rotation_task_created
-- rotation_completed
-- rotation_task_cancelled

-- ============================================
-- Add indexes for rotation alerts
-- ============================================
-- Credentials needing rotation soon
-- SELECT * FROM credentials WHERE status = 'active' AND next_rotation_due_at < DATE_ADD(NOW(), INTERVAL 7 DAY);

-- Overdue credentials
-- SELECT * FROM credentials WHERE status = 'active' AND next_rotation_due_at < NOW();
