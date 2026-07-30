-- Phase 3 Intelligence Layer — 5 tables
-- Run once. All statements are idempotent (CREATE TABLE IF NOT EXISTS).

-- ── 1. risk_snapshots ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS risk_snapshots (
  id                      INT AUTO_INCREMENT PRIMARY KEY,
  generated_at            DATETIME NOT NULL,
  unified_risk_score      DECIMAL(6,2) NOT NULL DEFAULT 0,
  finance_risk_score      DECIMAL(6,2) NOT NULL DEFAULT 0,
  operations_risk_score   DECIMAL(6,2) NOT NULL DEFAULT 0,
  compliance_risk_score   DECIMAL(6,2) NOT NULL DEFAULT 0,
  top_business_at_risk    VARCHAR(120) NULL,
  top_member_at_risk      VARCHAR(120) NULL,
  top_finance_risk        VARCHAR(255) NULL,
  summary_json            LONGTEXT NOT NULL,
  stale_after             DATETIME NOT NULL,
  INDEX idx_rs_generated (generated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 2. decision_feed ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS decision_feed (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  decision_id       VARCHAR(120) NOT NULL,
  role_scope_json   LONGTEXT NOT NULL,
  type              VARCHAR(50)  NOT NULL,
  title             VARCHAR(255) NOT NULL,
  impact_level      VARCHAR(20)  NOT NULL,
  impact_score      DECIMAL(6,2) NOT NULL DEFAULT 0,
  confidence_score  DECIMAL(6,2) NULL,
  deadline_label    VARCHAR(120) NULL,
  ignored_effect    VARCHAR(255) NULL,
  cta_type          VARCHAR(50)  NOT NULL,
  cta_target_id     VARCHAR(120) NULL,
  business_name     VARCHAR(120) NULL,
  generated_at      DATETIME NOT NULL,
  stale_after       DATETIME NOT NULL,
  is_active         TINYINT(1) NOT NULL DEFAULT 1,
  INDEX idx_df_active    (is_active, impact_score),
  INDEX idx_df_generated (generated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 3. approval_queue ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS approval_queue (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  approval_id         VARCHAR(120) NOT NULL UNIQUE,
  type                VARCHAR(50)  NOT NULL,
  title               VARCHAR(255) NOT NULL,
  summary             TEXT NULL,
  impact_score        DECIMAL(6,2) NOT NULL DEFAULT 0,
  confidence_score    DECIMAL(6,2) NULL,
  risk_reduction_pct  DECIMAL(6,2) NULL,
  role_scope_json     LONGTEXT NOT NULL,
  status              VARCHAR(20)  NOT NULL DEFAULT 'pending',
  payload_json        LONGTEXT NOT NULL,
  generated_at        DATETIME NOT NULL,
  expires_at          DATETIME NULL,
  resolved_by         INT NULL,
  resolved_at         DATETIME NULL,
  INDEX idx_aq_status    (status, expires_at),
  INDEX idx_aq_generated (generated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 4. system_activity_feed ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_activity_feed (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  type         VARCHAR(50)  NOT NULL,
  severity     VARCHAR(20)  NOT NULL DEFAULT 'info',
  title        VARCHAR(255) NOT NULL,
  summary      TEXT NULL,
  payload_json LONGTEXT NULL,
  created_at   DATETIME NOT NULL,
  INDEX idx_saf_created  (created_at),
  INDEX idx_saf_severity (severity, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 5. mobile_push_queue ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mobile_push_queue (
  id                     INT AUTO_INCREMENT PRIMARY KEY,
  push_key               VARCHAR(120) NOT NULL,
  role_scope_json        LONGTEXT NOT NULL,
  title                  VARCHAR(255) NOT NULL,
  body                   TEXT NOT NULL,
  action_type            VARCHAR(50)  NOT NULL,
  action_target_id       VARCHAR(120) NULL,
  priority               VARCHAR(20)  NOT NULL DEFAULT 'normal',
  status                 VARCHAR(20)  NOT NULL DEFAULT 'pending',
  dedupe_window_minutes  INT NOT NULL DEFAULT 60,
  created_at             DATETIME NOT NULL,
  sent_at                DATETIME NULL,
  INDEX idx_mpq_status   (status, priority),
  INDEX idx_mpq_push_key (push_key, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
