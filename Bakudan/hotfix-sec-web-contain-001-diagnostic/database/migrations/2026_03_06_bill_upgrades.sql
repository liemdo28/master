-- Bill system upgrades: paid_at tracking, status index
-- Run this migration on the database

-- Add paid_at column to track when a bill was paid
ALTER TABLE bills ADD COLUMN paid_at DATETIME NULL DEFAULT NULL AFTER status;

-- Add index on status for faster filtering
CREATE INDEX idx_bills_status ON bills(status);

-- Update existing paid bills to have paid_at = updated_at (best guess)
UPDATE bills SET paid_at = COALESCE(updated_at, created_at) WHERE status = 'paid' AND paid_at IS NULL;
