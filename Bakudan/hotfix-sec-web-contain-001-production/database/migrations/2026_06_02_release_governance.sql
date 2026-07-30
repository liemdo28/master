-- Release Governance Expansion for CEO directive
-- Adds explicit governance tables required by specification while preserving
-- the existing releases/release_reviews/release_audit_log implementation.

CREATE TABLE IF NOT EXISTS release_drafts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    release_id INT UNSIGNED NOT NULL,
    draft_key VARCHAR(100) NOT NULL,
    preview_url VARCHAR(500) DEFAULT NULL,
    qa_status ENUM('pending','running','passed','failed') NOT NULL DEFAULT 'pending',
    source_branch VARCHAR(255) DEFAULT NULL,
    source_commit VARCHAR(64) DEFAULT NULL,
    created_by INT UNSIGNED DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_release_drafts_release (release_id),
    UNIQUE KEY uk_release_drafts_key (draft_key),
    KEY idx_release_drafts_qa (qa_status),
    CONSTRAINT fk_release_drafts_release FOREIGN KEY (release_id) REFERENCES releases(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS release_versions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    release_id INT UNSIGNED NOT NULL,
    version_label VARCHAR(100) NOT NULL,
    commit_hash VARCHAR(64) DEFAULT NULL,
    artifact_path VARCHAR(500) DEFAULT NULL,
    source_snapshot_path VARCHAR(500) DEFAULT NULL,
    db_snapshot_path VARCHAR(500) DEFAULT NULL,
    is_live TINYINT(1) NOT NULL DEFAULT 0,
    published_at DATETIME DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_release_versions_release (release_id),
    KEY idx_release_versions_live (is_live, published_at),
    CONSTRAINT fk_release_versions_release FOREIGN KEY (release_id) REFERENCES releases(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS release_approvals (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    release_id INT UNSIGNED NOT NULL,
    approver_id INT UNSIGNED DEFAULT NULL,
    approval_role VARCHAR(50) NOT NULL DEFAULT 'admin',
    status ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
    note TEXT DEFAULT NULL,
    approved_at DATETIME DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_release_approvals_release (release_id, status),
    CONSTRAINT fk_release_approvals_release FOREIGN KEY (release_id) REFERENCES releases(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS release_schedule (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    release_id INT UNSIGNED NOT NULL,
    scheduled_for DATETIME NOT NULL,
    timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    scheduled_by INT UNSIGNED DEFAULT NULL,
    status ENUM('scheduled','running','published','cancelled','failed') NOT NULL DEFAULT 'scheduled',
    publish_started_at DATETIME DEFAULT NULL,
    publish_finished_at DATETIME DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_release_schedule_release (release_id, status),
    KEY idx_release_schedule_due (status, scheduled_for),
    CONSTRAINT fk_release_schedule_release FOREIGN KEY (release_id) REFERENCES releases(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS release_archive (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    release_id INT UNSIGNED NOT NULL,
    release_version_id BIGINT UNSIGNED DEFAULT NULL,
    archived_from_release_id INT UNSIGNED DEFAULT NULL,
    archived_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    retain_until DATETIME NOT NULL,
    is_locked TINYINT(1) NOT NULL DEFAULT 0,
    used_for_rollback TINYINT(1) NOT NULL DEFAULT 0,
    required_for_audit TINYINT(1) NOT NULL DEFAULT 0,
    deletion_eligible_at DATETIME DEFAULT NULL,
    deleted_at DATETIME DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    KEY idx_release_archive_release (release_id),
    KEY idx_release_archive_retain (retain_until, deleted_at),
    CONSTRAINT fk_release_archive_release FOREIGN KEY (release_id) REFERENCES releases(id) ON DELETE CASCADE,
    CONSTRAINT fk_release_archive_version FOREIGN KEY (release_version_id) REFERENCES release_versions(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rollback_points (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    release_id INT UNSIGNED NOT NULL,
    release_version_id BIGINT UNSIGNED DEFAULT NULL,
    source_backup_path VARCHAR(500) DEFAULT NULL,
    db_backup_path VARCHAR(500) DEFAULT NULL,
    migration_dry_run_log TEXT DEFAULT NULL,
    qa_status ENUM('pending','passed','failed') NOT NULL DEFAULT 'pending',
    approval_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    created_by INT UNSIGNED DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    used_at DATETIME DEFAULT NULL,
    KEY idx_rollback_points_release (release_id),
    KEY idx_rollback_points_used (used_at),
    CONSTRAINT fk_rollback_points_release FOREIGN KEY (release_id) REFERENCES releases(id) ON DELETE CASCADE,
    CONSTRAINT fk_rollback_points_version FOREIGN KEY (release_version_id) REFERENCES release_versions(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Backfill mirror rows from existing releases table for smoother adoption.
INSERT INTO release_drafts (release_id, draft_key, preview_url, qa_status, source_branch, source_commit, created_by, created_at, updated_at)
SELECT r.id,
       CONCAT('draft-', r.id),
       r.preview_url,
       CASE
           WHEN r.status = 'qa_running' THEN 'running'
           WHEN r.status IN ('qa_passed','approved','scheduled','published','archived','rolled_back') THEN 'passed'
           WHEN r.status = 'changes_requested' THEN 'failed'
           ELSE 'pending'
       END,
       r.branch,
       r.commit_hash,
       COALESCE(r.owner_id, r.created_by),
       r.created_at,
       r.updated_at
FROM releases r
LEFT JOIN release_drafts d ON d.release_id = r.id
WHERE d.id IS NULL;

INSERT INTO release_versions (release_id, version_label, commit_hash, is_live, published_at, created_at)
SELECT r.id,
       r.version,
       r.commit_hash,
       CASE WHEN r.status = 'published' THEN 1 ELSE 0 END,
       r.published_at,
       r.created_at
FROM releases r
LEFT JOIN release_versions v ON v.release_id = r.id AND v.version_label = r.version
WHERE v.id IS NULL;

INSERT INTO release_approvals (release_id, approver_id, approval_role, status, note, approved_at, created_at, updated_at)
SELECT r.id,
       r.published_by,
       'admin',
       CASE WHEN r.approval_complete = 1 THEN 'approved' ELSE 'pending' END,
       'Backfilled from releases.approval_complete',
       CASE WHEN r.approval_complete = 1 THEN COALESCE(r.published_at, r.updated_at) ELSE NULL END,
       r.created_at,
       r.updated_at
FROM releases r
LEFT JOIN release_approvals a ON a.release_id = r.id
WHERE a.id IS NULL;

INSERT INTO release_schedule (release_id, scheduled_for, timezone, scheduled_by, status, publish_started_at, publish_finished_at, created_at, updated_at)
SELECT r.id,
       r.scheduled_at,
       COALESCE(r.scheduled_timezone, 'Asia/Ho_Chi_Minh'),
       COALESCE(r.published_by, r.owner_id),
       CASE
           WHEN r.status = 'published' THEN 'published'
           WHEN r.status = 'scheduled' THEN 'scheduled'
           ELSE 'cancelled'
       END,
       CASE WHEN r.status = 'published' THEN r.published_at ELSE NULL END,
       CASE WHEN r.status = 'published' THEN r.published_at ELSE NULL END,
       r.created_at,
       r.updated_at
FROM releases r
LEFT JOIN release_schedule s ON s.release_id = r.id
WHERE r.scheduled_at IS NOT NULL AND s.id IS NULL;

INSERT INTO release_archive (release_id, release_version_id, archived_from_release_id, archived_at, retain_until, deletion_eligible_at, notes)
SELECT r.id,
       v.id,
       NULL,
       COALESCE(r.updated_at, r.created_at),
       DATE_ADD(COALESCE(r.updated_at, r.created_at), INTERVAL 365 DAY),
       DATE_ADD(COALESCE(r.updated_at, r.created_at), INTERVAL 365 DAY),
       'Backfilled archive retention record'
FROM releases r
LEFT JOIN release_versions v ON v.release_id = r.id AND v.version_label = r.version
LEFT JOIN release_archive a ON a.release_id = r.id
WHERE r.status IN ('archived','rolled_back','published') AND a.id IS NULL;

INSERT INTO rollback_points (release_id, release_version_id, qa_status, approval_status, created_by, created_at)
SELECT r.id,
       v.id,
       CASE WHEN r.qa_pass = 1 THEN 'passed' ELSE 'pending' END,
       CASE WHEN r.approval_complete = 1 THEN 'approved' ELSE 'pending' END,
       COALESCE(r.published_by, r.owner_id),
       COALESCE(r.published_at, r.updated_at, r.created_at)
FROM releases r
LEFT JOIN release_versions v ON v.release_id = r.id AND v.version_label = r.version
LEFT JOIN rollback_points rp ON rp.release_id = r.id
WHERE r.status IN ('approved','scheduled','published','rolled_back','archived') AND rp.id IS NULL;
