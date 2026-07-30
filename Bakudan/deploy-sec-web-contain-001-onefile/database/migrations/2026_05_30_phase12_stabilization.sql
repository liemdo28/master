-- Phase 12: Executive Stabilization & Pre-Production Alignment
-- Date: 2026-05-30
-- Purpose: Add missing tables for multi-store, permissions, library, vault, verification

-- ═══════════════════════════════════════════════════
-- WORKSTREAM 4: Multi-Store Model
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_stores (
    id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id    INT UNSIGNED NOT NULL,
    store_id   INT UNSIGNED NOT NULL,
    role       VARCHAR(50) DEFAULT 'member',
    is_primary TINYINT(1) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_store (user_id, store_id),
    INDEX idx_us_store (store_id),
    INDEX idx_us_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed from existing users.store_id
INSERT IGNORE INTO user_stores (user_id, store_id, is_primary)
SELECT id, store_id, 1 FROM users WHERE store_id IS NOT NULL;

-- ═══════════════════════════════════════════════════
-- WORKSTREAM 3: Permission Engine
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS permissions (
    id      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    module  VARCHAR(50) NOT NULL,
    action  VARCHAR(20) NOT NULL DEFAULT 'read',
    UNIQUE KEY uk_perm (module, action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_permissions (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         INT UNSIGNED NOT NULL,
    permission_id   INT UNSIGNED NOT NULL,
    granted_by      INT UNSIGNED DEFAULT NULL,
    granted_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_perm (user_id, permission_id),
    INDEX idx_up_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS role_permissions (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    role            VARCHAR(50) NOT NULL,
    permission_id   INT UNSIGNED NOT NULL,
    UNIQUE KEY uk_role_perm (role, permission_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed permissions for all modules
INSERT IGNORE INTO permissions (module, action) VALUES
('overview','read'),('overview','edit'),
('control_tower','read'),('control_tower','edit'),
('operations_today','read'),('operations_today','edit'),
('manager_command','read'),('manager_command','edit'),
('action_center','read'),('action_center','edit'),
('company_calendar','read'),('company_calendar','edit'),
('tasks','read'),('tasks','comment'),('tasks','edit'),('tasks','admin'),
('projects','read'),('projects','comment'),('projects','edit'),('projects','admin'),
('workspace','read'),
('notifications','read'),
('activity','read'),
('search','read'),
('team','read'),('team','edit'),
('stores','read'),('stores','edit'),('stores','admin'),
('store_command','read'),('store_command','edit'),
('checklists','read'),('checklists','edit'),
('releases','read'),('releases','edit'),('releases','approve'),('releases','publish'),
('walkthrough_library','read'),
('adoption_metrics','read'),
('health','read'),
('bills','read'),('bills','edit'),('bills','admin'),
('vendors','read'),('vendors','edit'),
('budget','read'),('budget','edit'),('budget','approve'),
('playbooks','read'),('playbooks','edit'),
('scorecard','read'),
('boardroom','read'),
('users','read'),('users','edit'),('users','admin'),
('data_hygiene','admin'),
('integrations','admin'),
('penalties','read'),('penalties','edit'),
('extensions','read'),('extensions','approve'),
('library','read'),('library','edit'),('library','admin'),
('vault','read'),('vault','edit'),('vault','admin');

-- ═══════════════════════════════════════════════════
-- WORKSTREAM 5: Shared Library
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS library_categories (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    slug        VARCHAR(100) NOT NULL,
    parent_id   INT UNSIGNED DEFAULT NULL,
    store_id    INT UNSIGNED DEFAULT NULL,
    sort_order  INT DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_cat_slug (slug, store_id),
    INDEX idx_lc_store (store_id),
    INDEX idx_lc_parent (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS library_files (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    category_id     INT UNSIGNED DEFAULT NULL,
    store_id        INT UNSIGNED DEFAULT NULL,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    file_path       VARCHAR(500) NOT NULL,
    file_type       VARCHAR(20) DEFAULT 'document',
    file_size       INT UNSIGNED DEFAULT 0,
    mime_type       VARCHAR(100) DEFAULT NULL,
    uploaded_by     INT UNSIGNED NOT NULL,
    is_archived     TINYINT(1) DEFAULT 0,
    download_count  INT UNSIGNED DEFAULT 0,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_lf_cat (category_id),
    INDEX idx_lf_store (store_id),
    INDEX idx_lf_type (file_type),
    FULLTEXT idx_lf_search (title, description)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS library_access_log (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    file_id     INT UNSIGNED NOT NULL,
    user_id     INT UNSIGNED NOT NULL,
    action      ENUM('view','download','upload','delete','move') NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_lal_file (file_id),
    INDEX idx_lal_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed default categories
INSERT IGNORE INTO library_categories (name, slug, store_id, sort_order) VALUES
('Finance', 'finance', NULL, 1),
('HR', 'hr', NULL, 2),
('Legal', 'legal', NULL, 3),
('Tax', 'tax', NULL, 4),
('Marketing', 'marketing', NULL, 5),
('Operations', 'operations', NULL, 6);

-- ═══════════════════════════════════════════════════
-- WORKSTREAM 6: Secure Vault
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS vault_items (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    store_id        INT UNSIGNED DEFAULT NULL,
    category        VARCHAR(50) NOT NULL DEFAULT 'other',
    title           VARCHAR(255) NOT NULL,
    encrypted_data  BLOB NOT NULL,
    encryption_iv   VARCHAR(64) NOT NULL,
    created_by      INT UNSIGNED NOT NULL,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_vault_store (store_id),
    INDEX idx_vault_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vault_access_log (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    vault_id    INT UNSIGNED NOT NULL,
    user_id     INT UNSIGNED NOT NULL,
    action      VARCHAR(20) NOT NULL,
    ip_address  VARCHAR(45) DEFAULT NULL,
    user_agent  VARCHAR(255) DEFAULT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_val_vault (vault_id),
    INDEX idx_val_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vault_permissions (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    vault_id    INT UNSIGNED NOT NULL,
    user_id     INT UNSIGNED DEFAULT NULL,
    role        VARCHAR(50) DEFAULT NULL,
    can_view    TINYINT(1) DEFAULT 0,
    can_edit    TINYINT(1) DEFAULT 0,
    UNIQUE KEY uk_vault_user (vault_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ═══════════════════════════════════════════════════
-- WORKSTREAM 7: Task Verification Workflow
-- ═══════════════════════════════════════════════════

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS verification_type ENUM('none','simple','multi_step') DEFAULT 'none';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS verification_status VARCHAR(30) DEFAULT NULL;

CREATE TABLE IF NOT EXISTS task_verification_steps (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    task_id         INT UNSIGNED NOT NULL,
    step_order      TINYINT NOT NULL,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    status          ENUM('pending','completed','skipped') DEFAULT 'pending',
    completed_by    INT UNSIGNED DEFAULT NULL,
    completed_at    DATETIME DEFAULT NULL,
    evidence_url    VARCHAR(500) DEFAULT NULL,
    notes           TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tvs_task (task_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS task_verification_log (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    task_id     INT UNSIGNED NOT NULL,
    step_id     INT UNSIGNED DEFAULT NULL,
    user_id     INT UNSIGNED NOT NULL,
    action      VARCHAR(50) NOT NULL,
    notes       TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tvl_task (task_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ═══════════════════════════════════════════════════
-- WORKSTREAM 1: Missing columns for stores
-- ═══════════════════════════════════════════════════

ALTER TABLE stores ADD COLUMN IF NOT EXISTS manager_id INT UNSIGNED DEFAULT NULL AFTER email;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS opened_at DATE DEFAULT NULL AFTER manager_id;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS region VARCHAR(100) DEFAULT NULL;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS city VARCHAR(100) DEFAULT NULL;
