-- Phase 11 Modules Migration
-- Generated: 2026-05-29
-- Tables: shifts, employees, training_modules, training_progress, procurements, purchase_order_items,
--          documents, calendar_events, incident_playbooks, opening_checklists, closing_checklists, store_health_scores

-- Shifts
CREATE TABLE IF NOT EXISTS shifts (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    store_id     INT UNSIGNED DEFAULT NULL,
    user_id      INT UNSIGNED DEFAULT NULL,
    shift_date   DATE NOT NULL,
    start_time   TIME NOT NULL,
    end_time     TIME NOT NULL,
    role         VARCHAR(100) DEFAULT NULL,
    status       ENUM('scheduled','confirmed','completed','absent','cancelled') NOT NULL DEFAULT 'scheduled',
    notes        TEXT DEFAULT NULL,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_shifts_store (store_id),
    INDEX idx_shifts_user (user_id),
    INDEX idx_shifts_date (shift_date),
    INDEX idx_shifts_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Employees
CREATE TABLE IF NOT EXISTS employees (
    id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id          INT UNSIGNED DEFAULT NULL,
    store_id         INT UNSIGNED DEFAULT NULL,
    employee_code    VARCHAR(50) DEFAULT NULL,
    position         VARCHAR(100) DEFAULT NULL,
    department       VARCHAR(100) DEFAULT NULL,
    hire_date        DATE DEFAULT NULL,
    termination_date DATE DEFAULT NULL,
    status           ENUM('active','inactive','terminated','on_leave') NOT NULL DEFAULT 'active',
    hourly_rate      DECIMAL(10,2) DEFAULT NULL,
    salary           DECIMAL(12,2) DEFAULT NULL,
    tax_status       VARCHAR(50) DEFAULT NULL,
    emergency_contact VARCHAR(200) DEFAULT NULL,
    emergency_phone  VARCHAR(50) DEFAULT NULL,
    notes            TEXT DEFAULT NULL,
    created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_emp_user (user_id),
    INDEX idx_emp_store (store_id),
    INDEX idx_emp_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Training Modules
CREATE TABLE IF NOT EXISTS training_modules (
    id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title          VARCHAR(255) NOT NULL,
    description    TEXT DEFAULT NULL,
    category       VARCHAR(100) DEFAULT NULL,
    duration_hours DECIMAL(5,1) DEFAULT NULL,
    difficulty     ENUM('beginner','intermediate','advanced') DEFAULT 'beginner',
    content_url    VARCHAR(500) DEFAULT NULL,
    status         ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
    created_by     INT UNSIGNED DEFAULT NULL,
    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tm_status (status),
    INDEX idx_tm_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Training Progress
CREATE TABLE IF NOT EXISTS training_progress (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    module_id    INT UNSIGNED NOT NULL,
    user_id      INT UNSIGNED NOT NULL,
    status       ENUM('not_started','in_progress','completed') NOT NULL DEFAULT 'not_started',
    score        INT DEFAULT NULL,
    completed_at DATETIME DEFAULT NULL,
    deadline     DATE DEFAULT NULL,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tp_module (module_id),
    INDEX idx_tp_user (user_id),
    UNIQUE KEY uk_tp_module_user (module_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Procurements
CREATE TABLE IF NOT EXISTS procurements (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    store_id      INT UNSIGNED DEFAULT NULL,
    title         VARCHAR(255) NOT NULL,
    category      VARCHAR(100) DEFAULT NULL,
    vendor        VARCHAR(200) DEFAULT NULL,
    status        ENUM('draft','pending','approved','ordered','received','cancelled') NOT NULL DEFAULT 'draft',
    requested_by  INT UNSIGNED DEFAULT NULL,
    approved_by   INT UNSIGNED DEFAULT NULL,
    total_amount  DECIMAL(12,2) DEFAULT 0,
    notes         TEXT DEFAULT NULL,
    approved_at   DATETIME DEFAULT NULL,
    received_at   DATETIME DEFAULT NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_proc_store (store_id),
    INDEX idx_proc_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Purchase Order Items
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    procurement_id  INT UNSIGNED NOT NULL,
    item_name       VARCHAR(255) NOT NULL,
    quantity        INT DEFAULT 1,
    unit_price      DECIMAL(10,2) DEFAULT 0,
    total_price     DECIMAL(12,2) DEFAULT 0,
    supplier        VARCHAR(200) DEFAULT NULL,
    delivery_date   DATE DEFAULT NULL,
    received_date   DATE DEFAULT NULL,
    status          ENUM('pending','ordered','shipped','received','cancelled') DEFAULT 'pending',
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_poi_proc (procurement_id),
    CONSTRAINT fk_poi_proc FOREIGN KEY (procurement_id) REFERENCES procurements(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Documents
CREATE TABLE IF NOT EXISTS documents (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title        VARCHAR(255) NOT NULL,
    file_path    VARCHAR(500) DEFAULT NULL,
    file_type    VARCHAR(100) DEFAULT NULL,
    file_size    INT UNSIGNED DEFAULT 0,
    category     VARCHAR(100) DEFAULT NULL,
    store_id     INT UNSIGNED DEFAULT NULL,
    uploaded_by  INT UNSIGNED DEFAULT NULL,
    version      INT DEFAULT 1,
    status       ENUM('active','archived') NOT NULL DEFAULT 'active',
    description  TEXT DEFAULT NULL,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_doc_store (store_id),
    INDEX idx_doc_category (category),
    INDEX idx_doc_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Calendar Events
CREATE TABLE IF NOT EXISTS calendar_events (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title       VARCHAR(255) NOT NULL,
    description TEXT DEFAULT NULL,
    event_type  ENUM('holiday','meeting','deadline','training','other') DEFAULT 'other',
    start_date  DATE NOT NULL,
    end_date    DATE DEFAULT NULL,
    store_id    INT UNSIGNED DEFAULT NULL,
    created_by  INT UNSIGNED DEFAULT NULL,
    is_all_day  TINYINT(1) DEFAULT 1,
    color       VARCHAR(20) DEFAULT '#3b82f6',
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ce_date (start_date),
    INDEX idx_ce_type (event_type),
    INDEX idx_ce_store (store_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Incident Playbooks
CREATE TABLE IF NOT EXISTS incident_playbooks (
    id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name           VARCHAR(255) NOT NULL,
    category       VARCHAR(100) DEFAULT NULL,
    severity       ENUM('low','medium','high','critical') DEFAULT 'medium',
    description    TEXT DEFAULT NULL,
    steps          JSON DEFAULT NULL,
    estimated_time INT DEFAULT NULL COMMENT 'minutes',
    created_by     INT UNSIGNED DEFAULT NULL,
    status         ENUM('active','archived') NOT NULL DEFAULT 'active',
    times_executed INT DEFAULT 0,
    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_pb_category (category),
    INDEX idx_pb_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Opening Checklists
CREATE TABLE IF NOT EXISTS opening_checklists (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    store_id    INT UNSIGNED NOT NULL,
    user_id     INT UNSIGNED NOT NULL,
    shift_date  DATE NOT NULL,
    status      ENUM('pending','in_progress','completed') NOT NULL DEFAULT 'pending',
    open_time   TIME DEFAULT NULL,
    items       JSON DEFAULT NULL,
    notes       TEXT DEFAULT NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_oc_store_date (store_id, shift_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Closing Checklists
CREATE TABLE IF NOT EXISTS closing_checklists (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    store_id    INT UNSIGNED NOT NULL,
    user_id     INT UNSIGNED NOT NULL,
    shift_date  DATE NOT NULL,
    status      ENUM('pending','in_progress','completed') NOT NULL DEFAULT 'pending',
    close_time  TIME DEFAULT NULL,
    items       JSON DEFAULT NULL,
    cash_count  DECIMAL(10,2) DEFAULT NULL,
    notes       TEXT DEFAULT NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_cc_store_date (store_id, shift_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Store Health Scores
CREATE TABLE IF NOT EXISTS store_health_scores (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    store_id      INT UNSIGNED NOT NULL,
    score         DECIMAL(5,2) DEFAULT 100.00,
    metrics       JSON DEFAULT NULL,
    recorded_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_health_store (store_id),
    INDEX idx_health_date (recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
