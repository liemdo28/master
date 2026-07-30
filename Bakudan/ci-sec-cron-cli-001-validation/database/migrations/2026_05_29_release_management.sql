-- ═══════════════════════════════════════════════════════════════════════════════
-- Release Management System — Draft-First Development Architecture
-- Created: 2026-05-29
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Releases table ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS releases (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    version         VARCHAR(50) NOT NULL,
    branch          VARCHAR(255) DEFAULT NULL,
    commit_hash     VARCHAR(64) DEFAULT NULL,
    build_date      DATETIME DEFAULT NULL,
    owner_id        INT UNSIGNED DEFAULT NULL,
    status          ENUM(
        'draft',
        'ready_for_review',
        'qa_running',
        'qa_passed',
        'approved',
        'scheduled',
        'published',
        'archived',
        'rolled_back',
        'changes_requested'
    ) NOT NULL DEFAULT 'draft',
    preview_url     VARCHAR(500) DEFAULT NULL,
    release_notes   TEXT DEFAULT NULL,
    qa_score        DECIMAL(5,2) DEFAULT NULL,
    confidence_score DECIMAL(5,2) DEFAULT NULL,
    scheduled_at    DATETIME DEFAULT NULL,
    scheduled_timezone VARCHAR(64) DEFAULT 'Asia/Ho_Chi_Minh',
    published_at    DATETIME DEFAULT NULL,
    rolled_back_at  DATETIME DEFAULT NULL,
    rollback_reason TEXT DEFAULT NULL,
    -- Walkthrough statuses
    walkthrough_ceo     ENUM('pass','fail','pending') DEFAULT 'pending',
    walkthrough_manager ENUM('pass','fail','pending') DEFAULT 'pending',
    walkthrough_member  ENUM('pass','fail','pending') DEFAULT 'pending',
    walkthrough_admin   ENUM('pass','fail','pending') DEFAULT 'pending',
    -- Protection flags
    qa_pass         TINYINT(1) NOT NULL DEFAULT 0,
    walkthrough_pass TINYINT(1) NOT NULL DEFAULT 0,
    confidence_pass TINYINT(1) NOT NULL DEFAULT 0,
    no_active_freeze TINYINT(1) NOT NULL DEFAULT 1,
    approval_complete TINYINT(1) NOT NULL DEFAULT 0,
    -- Metadata
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_releases_status (status),
    INDEX idx_releases_owner (owner_id),
    INDEX idx_releases_scheduled (scheduled_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Release Reviews (comments, approvals, change requests) ───────────────────
CREATE TABLE IF NOT EXISTS release_reviews (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    release_id      INT UNSIGNED NOT NULL,
    user_id         INT UNSIGNED NOT NULL,
    type            ENUM('comment','approval','changes_requested','rejection') NOT NULL DEFAULT 'comment',
    body            TEXT DEFAULT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_release_reviews_release (release_id),
    INDEX idx_release_reviews_user (user_id),
    CONSTRAINT fk_release_reviews_release FOREIGN KEY (release_id) REFERENCES releases(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Release Shareable Links ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS release_links (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    release_id      INT UNSIGNED NOT NULL,
    token           VARCHAR(64) NOT NULL UNIQUE,
    type            ENUM('internal_review','view_only') NOT NULL DEFAULT 'view_only',
    label           VARCHAR(255) DEFAULT NULL,
    created_by      INT UNSIGNED NOT NULL,
    expires_at      DATETIME DEFAULT NULL,
    max_uses        INT UNSIGNED DEFAULT NULL,
    use_count       INT UNSIGNED NOT NULL DEFAULT 0,
    is_active       TINYINT(1) NOT NULL DEFAULT 1,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_release_links_release (release_id),
    INDEX idx_release_links_token (token),
    CONSTRAINT fk_release_links_release FOREIGN KEY (release_id) REFERENCES releases(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Release Audit Log ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS release_audit_log (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    release_id      INT UNSIGNED NOT NULL,
    user_id         INT UNSIGNED DEFAULT NULL,
    action          VARCHAR(50) NOT NULL,
    details         JSON DEFAULT NULL,
    reason          TEXT DEFAULT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_release_audit_release (release_id),
    INDEX idx_release_audit_action (action),
    CONSTRAINT fk_release_audit_release FOREIGN KEY (release_id) REFERENCES releases(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Deploy Freeze table (optional — for blocking production during freeze) ───
CREATE TABLE IF NOT EXISTS deploy_freezes (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    reason          VARCHAR(500) NOT NULL,
    started_by      INT UNSIGNED NOT NULL,
    starts_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ends_at         DATETIME DEFAULT NULL,
    is_active       TINYINT(1) NOT NULL DEFAULT 1,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_deploy_freezes_active (is_active, starts_at, ends_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
