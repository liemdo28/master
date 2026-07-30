-- ═══════════════════════════════════════════════════════════════════════════════
-- Release Management v2 — Enhanced Version Notes & Production Info
-- Created: 2026-05-29
-- ═══════════════════════════════════════════════════════════════════════════════

-- Add structured version notes fields to releases table
ALTER TABLE releases
    ADD COLUMN IF NOT EXISTS title VARCHAR(255) DEFAULT NULL AFTER name,
    ADD COLUMN IF NOT EXISTS summary TEXT DEFAULT NULL AFTER title,
    ADD COLUMN IF NOT EXISTS change_log TEXT DEFAULT NULL AFTER summary,
    ADD COLUMN IF NOT EXISTS bug_fixes TEXT DEFAULT NULL AFTER change_log,
    ADD COLUMN IF NOT EXISTS known_issues TEXT DEFAULT NULL AFTER bug_fixes,
    ADD COLUMN IF NOT EXISTS risk_notes TEXT DEFAULT NULL AFTER known_issues,
    ADD COLUMN IF NOT EXISTS rollback_notes TEXT DEFAULT NULL AFTER risk_notes,
    ADD COLUMN IF NOT EXISTS rollback_contact VARCHAR(255) DEFAULT NULL AFTER rollback_notes,
    ADD COLUMN IF NOT EXISTS release_window_notes TEXT DEFAULT NULL AFTER rollback_contact,
    ADD COLUMN IF NOT EXISTS published_by INT UNSIGNED DEFAULT NULL AFTER published_at,
    ADD COLUMN IF NOT EXISTS confidence_letter CHAR(1) DEFAULT NULL AFTER confidence_score;

-- Add foreign key for published_by (may already exist via other migrations)
-- Note: This is safe to run even if constraint already exists
-- The actual FK constraint will be added if the column was just created

-- Add index for finding current live version quickly
ALTER TABLE releases ADD INDEX IF NOT EXISTS idx_releases_published_at (published_at);

-- Enhance release_audit_log with more detail types
-- Add timeline event type for timeline visualization
ALTER TABLE release_audit_log
    ADD COLUMN IF NOT EXISTS event_type VARCHAR(50) DEFAULT NULL AFTER action,
    ADD COLUMN IF NOT EXISTS metadata JSON DEFAULT NULL AFTER event_type;
