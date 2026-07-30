-- ============================================
-- TaskFlow v2.0 - Database Schema
-- Run this AFTER the original schema
-- ============================================

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type VARCHAR(50) NOT NULL COMMENT 'task_assigned, task_commented, task_due_soon, task_overdue, task_completed',
    title VARCHAR(300) NOT NULL,
    message TEXT,
    task_id INT DEFAULT NULL,
    project_id INT DEFAULT NULL,
    from_user_id INT DEFAULT NULL,
    is_read TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Email queue for async email sending
CREATE TABLE IF NOT EXISTS email_queue (
    id INT AUTO_INCREMENT PRIMARY KEY,
    to_email VARCHAR(150) NOT NULL,
    to_name VARCHAR(100) DEFAULT '',
    subject VARCHAR(300) NOT NULL,
    body TEXT NOT NULL,
    status ENUM('pending', 'sent', 'failed') DEFAULT 'pending',
    attempts INT DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP NULL
) ENGINE=InnoDB;

-- Add email_notifications preference to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_notifications TINYINT(1) DEFAULT 1;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notif_created ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_email_status ON email_queue(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date, is_completed);
