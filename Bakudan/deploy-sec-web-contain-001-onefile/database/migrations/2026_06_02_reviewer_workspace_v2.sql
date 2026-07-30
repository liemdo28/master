-- Reviewer / Approver Workspace v2
-- Adds creator-defined audit specification fields directly on tasks.

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS review_instructions TEXT NULL AFTER notes,
  ADD COLUMN IF NOT EXISTS review_checklist JSON NULL AFTER review_instructions,
  ADD COLUMN IF NOT EXISTS required_evidence JSON NULL AFTER review_checklist,
  ADD COLUMN IF NOT EXISTS required_files JSON NULL AFTER required_evidence,
  ADD COLUMN IF NOT EXISTS reviewer_result ENUM('pending','pass','fail','needs_info') NOT NULL DEFAULT 'pending' AFTER required_files,
  ADD COLUMN IF NOT EXISTS reviewer_result_note TEXT NULL AFTER reviewer_result,
  ADD COLUMN IF NOT EXISTS reviewer_result_at DATETIME NULL AFTER reviewer_result_note,
  ADD COLUMN IF NOT EXISTS approver_result ENUM('pending','accepted','rejected') NOT NULL DEFAULT 'pending' AFTER reviewer_result_at,
  ADD COLUMN IF NOT EXISTS approver_result_note TEXT NULL AFTER approver_result,
  ADD COLUMN IF NOT EXISTS approver_result_at DATETIME NULL AFTER approver_result_note;
