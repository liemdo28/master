-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 7 — Franchise & Multi-Store Operating Platform
-- Created: 2026-05-29
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Regions ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS regions (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    code            VARCHAR(20) DEFAULT NULL,
    country         VARCHAR(100) DEFAULT 'US',
    timezone        VARCHAR(64) DEFAULT 'America/Los_Angeles',
    manager_id      INT UNSIGNED DEFAULT NULL,
    is_active       TINYINT(1) NOT NULL DEFAULT 1,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_regions_manager (manager_id),
    INDEX idx_regions_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Districts ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS districts (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    code            VARCHAR(20) DEFAULT NULL,
    region_id       INT UNSIGNED DEFAULT NULL,
    manager_id      INT UNSIGNED DEFAULT NULL,
    is_active       TINYINT(1) NOT NULL DEFAULT 1,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_districts_region (region_id),
    INDEX idx_districts_manager (manager_id),
    CONSTRAINT fk_districts_region FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Extend stores with hierarchy fields ──────────────────────────────────────
ALTER TABLE stores ADD COLUMN IF NOT EXISTS region_id INT UNSIGNED DEFAULT NULL AFTER business_id;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS district_id INT UNSIGNED DEFAULT NULL AFTER region_id;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS store_code VARCHAR(20) DEFAULT NULL AFTER district_id;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS phone VARCHAR(30) DEFAULT NULL AFTER address;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS email VARCHAR(255) DEFAULT NULL AFTER phone;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS manager_id INT UNSIGNED DEFAULT NULL AFTER email;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS opened_at DATE DEFAULT NULL AFTER manager_id;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS store_type ENUM('corporate','franchise') NOT NULL DEFAULT 'corporate' AFTER opened_at;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS brand VARCHAR(100) DEFAULT 'Bakudan Ramen' AFTER store_type;

-- ── Extend users with org hierarchy ──────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS region_id INT UNSIGNED DEFAULT NULL AFTER store_id;
ALTER TABLE users ADD COLUMN IF NOT EXISTS district_id INT UNSIGNED DEFAULT NULL AFTER region_id;
ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title VARCHAR(100) DEFAULT NULL AFTER district_id;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reports_to INT UNSIGNED DEFAULT NULL AFTER job_title;
ALTER TABLE users ADD COLUMN IF NOT EXISTS hire_date DATE DEFAULT NULL AFTER reports_to;

-- ── KPI Scores (daily snapshots per store) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS store_kpis (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    store_id        INT UNSIGNED NOT NULL,
    date            DATE NOT NULL,
    -- Task metrics
    task_completion_pct     DECIMAL(5,2) DEFAULT NULL,
    overdue_pct             DECIMAL(5,2) DEFAULT NULL,
    tasks_total             INT UNSIGNED DEFAULT 0,
    tasks_completed         INT UNSIGNED DEFAULT 0,
    tasks_overdue           INT UNSIGNED DEFAULT 0,
    -- Payroll metrics
    payroll_accuracy_pct    DECIMAL(5,2) DEFAULT NULL,
    -- Audit & compliance
    audit_score             DECIMAL(5,2) DEFAULT NULL,
    training_compliance_pct DECIMAL(5,2) DEFAULT NULL,
    incident_count          INT UNSIGNED DEFAULT 0,
    -- Composite
    store_health_score      DECIMAL(5,2) DEFAULT NULL,
    -- Metadata
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_store_kpis_date (store_id, date),
    INDEX idx_store_kpis_store (store_id),
    INDEX idx_store_kpis_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Goals & OKRs ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS goals (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title           VARCHAR(500) NOT NULL,
    description     TEXT DEFAULT NULL,
    type            ENUM('company','region','district','store','personal') NOT NULL DEFAULT 'company',
    scope_id        INT UNSIGNED DEFAULT NULL COMMENT 'ID of region/district/store/user depending on type',
    owner_id        INT UNSIGNED DEFAULT NULL,
    metric_key      VARCHAR(100) DEFAULT NULL COMMENT 'e.g. task_completion_pct, overdue_pct',
    target_value    DECIMAL(10,2) DEFAULT NULL,
    current_value   DECIMAL(10,2) DEFAULT NULL,
    progress_pct    DECIMAL(5,2) DEFAULT 0,
    status          ENUM('active','completed','cancelled','paused') NOT NULL DEFAULT 'active',
    quarter         VARCHAR(10) DEFAULT NULL COMMENT 'e.g. 2026-Q2',
    starts_at       DATE DEFAULT NULL,
    ends_at         DATE DEFAULT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_goals_type (type, scope_id),
    INDEX idx_goals_owner (owner_id),
    INDEX idx_goals_status (status),
    INDEX idx_goals_quarter (quarter)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Budget Requests ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS budget_requests (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    store_id        INT UNSIGNED DEFAULT NULL,
    requester_id    INT UNSIGNED NOT NULL,
    category        ENUM('equipment','repairs','supplies','training','marketing','other') NOT NULL DEFAULT 'other',
    title           VARCHAR(500) NOT NULL,
    description     TEXT DEFAULT NULL,
    amount          DECIMAL(12,2) NOT NULL,
    currency        VARCHAR(3) NOT NULL DEFAULT 'USD',
    vendor_name     VARCHAR(255) DEFAULT NULL,
    status          ENUM('draft','submitted','under_review','approved','rejected','purchased','completed') NOT NULL DEFAULT 'draft',
    priority        ENUM('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
    approved_by     INT UNSIGNED DEFAULT NULL,
    approved_at     DATETIME DEFAULT NULL,
    rejection_reason TEXT DEFAULT NULL,
    purchased_at    DATETIME DEFAULT NULL,
    completed_at    DATETIME DEFAULT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_budget_store (store_id),
    INDEX idx_budget_requester (requester_id),
    INDEX idx_budget_status (status),
    INDEX idx_budget_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Documents Center ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title           VARCHAR(500) NOT NULL,
    category        ENUM('sop','policy','training','hr','release_notes','audit_report','other') NOT NULL DEFAULT 'other',
    scope           ENUM('company','region','district','store') NOT NULL DEFAULT 'company',
    scope_id        INT UNSIGNED DEFAULT NULL,
    version         VARCHAR(20) DEFAULT '1.0',
    file_path       VARCHAR(500) DEFAULT NULL,
    content         LONGTEXT DEFAULT NULL,
    owner_id        INT UNSIGNED DEFAULT NULL,
    review_date     DATE DEFAULT NULL,
    is_published    TINYINT(1) NOT NULL DEFAULT 0,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_documents_category (category),
    INDEX idx_documents_scope (scope, scope_id),
    INDEX idx_documents_owner (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Compliance Tracking ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS compliance_items (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    store_id        INT UNSIGNED NOT NULL,
    category        ENUM('food_safety','labor','payroll','operational','health','fire','other') NOT NULL,
    title           VARCHAR(500) NOT NULL,
    description     TEXT DEFAULT NULL,
    status          ENUM('compliant','non_compliant','pending','expired','waived') NOT NULL DEFAULT 'pending',
    due_date        DATE DEFAULT NULL,
    completed_date  DATE DEFAULT NULL,
    assigned_to     INT UNSIGNED DEFAULT NULL,
    evidence_path   VARCHAR(500) DEFAULT NULL,
    score           DECIMAL(5,2) DEFAULT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_compliance_store (store_id),
    INDEX idx_compliance_category (category),
    INDEX idx_compliance_status (status),
    INDEX idx_compliance_due (due_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Risk Register ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS risks (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    store_id        INT UNSIGNED DEFAULT NULL,
    category        ENUM('payroll','store','operational','security','compliance','financial','reputational') NOT NULL,
    title           VARCHAR(500) NOT NULL,
    description     TEXT DEFAULT NULL,
    severity        ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium',
    likelihood      ENUM('rare','unlikely','possible','likely','certain') NOT NULL DEFAULT 'possible',
    risk_score      DECIMAL(5,2) DEFAULT NULL,
    status          ENUM('open','mitigating','resolved','accepted') NOT NULL DEFAULT 'open',
    owner_id        INT UNSIGNED DEFAULT NULL,
    mitigation_plan TEXT DEFAULT NULL,
    resolved_at     DATETIME DEFAULT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_risks_store (store_id),
    INDEX idx_risks_category (category),
    INDEX idx_risks_severity (severity),
    INDEX idx_risks_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Incidents ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS incidents (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    store_id        INT UNSIGNED NOT NULL,
    reported_by     INT UNSIGNED NOT NULL,
    category        ENUM('safety','equipment','customer','employee','theft','other') NOT NULL DEFAULT 'other',
    severity        ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium',
    title           VARCHAR(500) NOT NULL,
    description     TEXT DEFAULT NULL,
    occurred_at     DATETIME DEFAULT NULL,
    status          ENUM('reported','investigating','resolved','closed') NOT NULL DEFAULT 'reported',
    resolution      TEXT DEFAULT NULL,
    resolved_by     INT UNSIGNED DEFAULT NULL,
    resolved_at     DATETIME DEFAULT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_incidents_store (store_id),
    INDEX idx_incidents_category (category),
    INDEX idx_incidents_status (status),
    INDEX idx_incidents_severity (severity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
