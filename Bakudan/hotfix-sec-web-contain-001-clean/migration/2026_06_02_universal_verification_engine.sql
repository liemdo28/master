-- Universal Verification Workflow Engine — PREVIEW VERSION
-- Platform-level, object-agnostic schema. Do not add task-specific tables here.
-- Do not apply to production until CEO approves preview and rollout plan.
-- Runtime enforcement is disabled by default and requires VERIFICATION_ENGINE_ENFORCE=1.

ALTER TABLE users
  MODIFY COLUMN role ENUM('ceo','admin','manager','accounting','member') DEFAULT 'member';

CREATE TABLE IF NOT EXISTS verification_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  object_type ENUM('task','bill','payment','payroll','form','audit','checklist') NULL,
  require_verification TINYINT(1) NOT NULL DEFAULT 0,
  owner_role VARCHAR(60) NULL,
  store_id INT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_vt_object_type (object_type),
  INDEX idx_vt_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS record_verifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  object_type ENUM('task','bill','payment','payroll','form','audit','checklist') NOT NULL,
  object_id INT NOT NULL,
  template_id INT NULL,
  template_name VARCHAR(160) NULL,
  owner_id INT NOT NULL,
  backup_owner_id INT NULL,
  store_id INT NULL,
  priority ENUM('urgent','high','medium','low') NOT NULL DEFAULT 'medium',
  due_at DATETIME NOT NULL,
  status ENUM(
    'open',
    'in_progress',
    'submitted',
    'pending_verification',
    'verification_in_progress',
    'verification_rejected',
    'verified',
    'completed',
    'escalated',
    'cancelled',
    'overdue'
  ) NOT NULL DEFAULT 'pending_verification',
  escalation_rules_json JSON NULL,
  reminder_rules_json JSON NULL,
  created_by INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_record_active (object_type, object_id, status),
  INDEX idx_rv_object (object_type, object_id),
  INDEX idx_rv_status_due (status, due_at),
  INDEX idx_rv_owner (owner_id),
  INDEX idx_rv_store (store_id),
  CONSTRAINT fk_rv_template FOREIGN KEY (template_id) REFERENCES verification_templates(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS verification_steps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  template_id INT NULL,
  record_verification_id INT NULL,
  step_order TINYINT NOT NULL,
  title VARCHAR(160) NULL,
  assigned_user_id INT NULL,
  assigned_role VARCHAR(60) NULL,
  due_at DATETIME NULL,
  required_comment TINYINT(1) NOT NULL DEFAULT 0,
  required_evidence TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('pending','in_progress','approved','rejected','skipped') NOT NULL DEFAULT 'pending',
  completed_by INT NULL,
  completed_at DATETIME NULL,
  comment TEXT NULL,
  evidence_url VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_vs_template (template_id, step_order),
  INDEX idx_vs_record (record_verification_id, step_order),
  INDEX idx_vs_assigned_user (assigned_user_id),
  INDEX idx_vs_assigned_role (assigned_role),
  INDEX idx_vs_status_due (status, due_at),
  CONSTRAINT fk_vs_template FOREIGN KEY (template_id) REFERENCES verification_templates(id) ON DELETE CASCADE,
  CONSTRAINT fk_vs_record FOREIGN KEY (record_verification_id) REFERENCES record_verifications(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS verification_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  record_verification_id INT NOT NULL,
  verification_step_id INT NULL,
  actor_id INT NULL,
  action VARCHAR(80) NOT NULL,
  comment TEXT NULL,
  metadata_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_vh_record (record_verification_id, created_at),
  INDEX idx_vh_actor (actor_id),
  CONSTRAINT fk_vh_record FOREIGN KEY (record_verification_id) REFERENCES record_verifications(id) ON DELETE CASCADE,
  CONSTRAINT fk_vh_step FOREIGN KEY (verification_step_id) REFERENCES verification_steps(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS verification_comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  record_verification_id INT NOT NULL,
  verification_step_id INT NULL,
  user_id INT NOT NULL,
  comment TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_vc_record (record_verification_id),
  CONSTRAINT fk_vc_record FOREIGN KEY (record_verification_id) REFERENCES record_verifications(id) ON DELETE CASCADE,
  CONSTRAINT fk_vc_step FOREIGN KEY (verification_step_id) REFERENCES verification_steps(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS verification_evidence (
  id INT AUTO_INCREMENT PRIMARY KEY,
  record_verification_id INT NOT NULL,
  verification_step_id INT NULL,
  uploaded_by INT NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  file_name VARCHAR(255) NULL,
  mime_type VARCHAR(120) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ve_record (record_verification_id),
  CONSTRAINT fk_ve_record FOREIGN KEY (record_verification_id) REFERENCES record_verifications(id) ON DELETE CASCADE,
  CONSTRAINT fk_ve_step FOREIGN KEY (verification_step_id) REFERENCES verification_steps(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS verification_reminders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  record_verification_id INT NOT NULL,
  verification_step_id INT NULL,
  reminder_stage ENUM('24h_before_due','3h_before_due','at_due_time','24h_overdue','3_days_overdue','7_days_overdue') NOT NULL,
  channel ENUM('notification','email','mobile_push','audit_log') NOT NULL DEFAULT 'notification',
  sent_to_user_id INT NULL,
  sent_to_role VARCHAR(60) NULL,
  sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata_json JSON NULL,
  UNIQUE KEY uq_reminder_stage (record_verification_id, verification_step_id, reminder_stage, channel),
  INDEX idx_vr_record (record_verification_id),
  CONSTRAINT fk_vr_record FOREIGN KEY (record_verification_id) REFERENCES record_verifications(id) ON DELETE CASCADE,
  CONSTRAINT fk_vr_step FOREIGN KEY (verification_step_id) REFERENCES verification_steps(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS verification_escalations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  record_verification_id INT NOT NULL,
  verification_step_id INT NULL,
  escalation_stage ENUM('owner_backup_notification','manager_notification','admin_notification','ceo_risk_dashboard') NOT NULL,
  notify_roles_json JSON NULL,
  suggested_penalty TINYINT(1) NOT NULL DEFAULT 0,
  penalty_category VARCHAR(120) NULL,
  penalty_approved_by INT NULL,
  penalty_approved_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_escalation_stage (record_verification_id, verification_step_id, escalation_stage),
  INDEX idx_vesc_record (record_verification_id),
  INDEX idx_vesc_penalty (suggested_penalty, penalty_approved_at),
  CONSTRAINT fk_vesc_record FOREIGN KEY (record_verification_id) REFERENCES record_verifications(id) ON DELETE CASCADE,
  CONSTRAINT fk_vesc_step FOREIGN KEY (verification_step_id) REFERENCES verification_steps(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS verification_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  object_type ENUM('task','bill','payment','payroll','form','audit','checklist') NULL,
  require_verification TINYINT(1) NOT NULL DEFAULT 0,
  rule_json JSON NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_vrules_object (object_type, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
