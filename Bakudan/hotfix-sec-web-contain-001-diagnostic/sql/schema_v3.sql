-- Weekly email report tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_weekly_report_at TIMESTAMP NULL DEFAULT NULL;
