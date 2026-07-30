-- Phase 8: Autonomous Operations & Enterprise Scaling
-- Migration: 2026_05_29_phase8_autonomous_operations.sql

-- ============================================================
-- MODULE 1: Operational Command Center - Status Tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS operational_status (
    id INT AUTO_INCREMENT PRIMARY KEY,
    module VARCHAR(50) NOT NULL COMMENT 'stores|incidents|payroll|compliance|audits|releases|training|staffing',
    status ENUM('healthy','warning','critical','offline') NOT NULL DEFAULT 'healthy',
    score DECIMAL(5,2) DEFAULT 100.00,
    details JSON DEFAULT NULL,
    last_checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_module (module),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- MODULE 2: Predictive Incident Engine
-- ============================================================
CREATE TABLE IF NOT EXISTS predictions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    prediction_type VARCHAR(80) NOT NULL COMMENT 'audit_fail|payroll_anomaly|deadline_miss|task_overdue|manager_overload',
    entity_type VARCHAR(50) NOT NULL COMMENT 'store|user|task|bill',
    entity_id INT NOT NULL,
    probability DECIMAL(5,2) NOT NULL COMMENT '0-100 likelihood',
    severity ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium',
    horizon_hours INT NOT NULL DEFAULT 72 COMMENT 'prediction window in hours',
    description TEXT NOT NULL,
    factors JSON DEFAULT NULL COMMENT 'contributing factors',
    recommended_actions JSON DEFAULT NULL,
    status ENUM('active','acknowledged','prevented','occurred','expired') NOT NULL DEFAULT 'active',
    acknowledged_by INT DEFAULT NULL,
    acknowledged_at DATETIME DEFAULT NULL,
    outcome_notes TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME DEFAULT NULL,
    resolved_at DATETIME DEFAULT NULL,
    INDEX idx_type_status (prediction_type, status),
    INDEX idx_entity (entity_type, entity_id),
    INDEX idx_severity (severity),
    INDEX idx_expires (expires_at),
    FOREIGN KEY (acknowledged_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- MODULE 3: Operational Recommendations
-- ============================================================
CREATE TABLE IF NOT EXISTS recommendations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INT NOT NULL,
    category VARCHAR(80) NOT NULL COMMENT 'health_improvement|risk_mitigation|efficiency|compliance',
    priority ENUM('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    actions JSON NOT NULL COMMENT 'array of recommended action steps',
    expected_impact JSON DEFAULT NULL COMMENT 'predicted improvement metrics',
    status ENUM('pending','accepted','rejected','completed','expired') NOT NULL DEFAULT 'pending',
    accepted_by INT DEFAULT NULL,
    accepted_at DATETIME DEFAULT NULL,
    completed_at DATETIME DEFAULT NULL,
    outcome_score DECIMAL(5,2) DEFAULT NULL COMMENT 'actual improvement achieved',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME DEFAULT NULL,
    INDEX idx_entity (entity_type, entity_id),
    INDEX idx_category_status (category, status),
    INDEX idx_priority (priority),
    FOREIGN KEY (accepted_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- MODULE 4: Automated Corrective Actions
-- ============================================================
CREATE TABLE IF NOT EXISTS corrective_actions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    trigger_type VARCHAR(80) NOT NULL COMMENT 'audit_fail|incident|prediction|threshold',
    trigger_id INT DEFAULT NULL,
    trigger_details JSON DEFAULT NULL,
    store_id INT DEFAULT NULL,
    assigned_to INT DEFAULT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT NULL,
    actions JSON NOT NULL COMMENT 'auto-generated action items',
    status ENUM('proposed','approved','in_progress','completed','rejected','cancelled') NOT NULL DEFAULT 'proposed',
    proposed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    approved_by INT DEFAULT NULL,
    approved_at DATETIME DEFAULT NULL,
    completed_at DATETIME DEFAULT NULL,
    outcome TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_trigger (trigger_type, trigger_id),
    INDEX idx_store (store_id),
    INDEX idx_status (status),
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- MODULE 5: Enterprise Workflow Engine
-- ============================================================
CREATE TABLE IF NOT EXISTS workflows (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT NULL,
    trigger_type VARCHAR(80) NOT NULL COMMENT 'event|schedule|threshold|manual',
    trigger_config JSON NOT NULL COMMENT 'trigger conditions',
    steps JSON NOT NULL COMMENT 'ordered workflow steps',
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_by INT NOT NULL,
    store_id INT DEFAULT NULL COMMENT 'NULL = global workflow',
    execution_count INT NOT NULL DEFAULT 0,
    last_executed_at DATETIME DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_trigger (trigger_type),
    INDEX idx_active (is_active),
    INDEX idx_store (store_id),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS workflow_executions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    workflow_id INT NOT NULL,
    trigger_data JSON DEFAULT NULL,
    status ENUM('running','completed','failed','cancelled') NOT NULL DEFAULT 'running',
    current_step INT NOT NULL DEFAULT 0,
    step_results JSON DEFAULT NULL,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME DEFAULT NULL,
    error_message TEXT DEFAULT NULL,
    INDEX idx_workflow (workflow_id),
    INDEX idx_status (status),
    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- MODULE 6: Cross-Module Automation Events
-- ============================================================
CREATE TABLE IF NOT EXISTS automation_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    source_module VARCHAR(50) NOT NULL COMMENT 'payroll|tasks|audits|training|incidents',
    source_event VARCHAR(100) NOT NULL,
    source_id INT DEFAULT NULL,
    target_module VARCHAR(50) NOT NULL,
    target_action VARCHAR(100) NOT NULL,
    target_id INT DEFAULT NULL,
    payload JSON DEFAULT NULL,
    status ENUM('pending','executed','failed','skipped') NOT NULL DEFAULT 'pending',
    executed_at DATETIME DEFAULT NULL,
    error_message TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_source (source_module, source_event),
    INDEX idx_target (target_module, target_action),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- MODULE 7: Digital Operations Twin - Simulations
-- ============================================================
CREATE TABLE IF NOT EXISTS simulations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    scenario VARCHAR(255) NOT NULL,
    scenario_type VARCHAR(80) NOT NULL COMMENT 'staff_loss|demand_change|store_closure|expansion',
    parameters JSON NOT NULL,
    results JSON DEFAULT NULL,
    impact_summary TEXT DEFAULT NULL,
    risk_factors JSON DEFAULT NULL,
    created_by INT NOT NULL,
    store_id INT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_type (scenario_type),
    INDEX idx_store (store_id),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- MODULE 8: Enterprise Notification Center
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_hub (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT DEFAULT NULL COMMENT 'NULL = broadcast',
    store_id INT DEFAULT NULL,
    channel VARCHAR(30) NOT NULL COMMENT 'dashboard|email|sms|slack|teams|push',
    category VARCHAR(80) NOT NULL COMMENT 'incident|prediction|workflow|compliance|payroll|general',
    severity ENUM('info','warning','critical','emergency') NOT NULL DEFAULT 'info',
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    action_url VARCHAR(500) DEFAULT NULL,
    metadata JSON DEFAULT NULL,
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    read_at DATETIME DEFAULT NULL,
    delivered_at DATETIME DEFAULT NULL,
    delivery_status ENUM('pending','sent','delivered','failed','bounced') NOT NULL DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_read (user_id, is_read),
    INDEX idx_channel (channel),
    INDEX idx_category (category),
    INDEX idx_severity (severity),
    INDEX idx_delivery (delivery_status),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- MODULE 10: Executive War Room
-- ============================================================
CREATE TABLE IF NOT EXISTS war_room_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    severity ENUM('high','critical','emergency') NOT NULL DEFAULT 'critical',
    category VARCHAR(80) NOT NULL COMMENT 'incident|payroll_failure|compliance|outage|escalation',
    status ENUM('active','monitoring','resolved','post_mortem') NOT NULL DEFAULT 'active',
    initiated_by INT NOT NULL,
    store_id INT DEFAULT NULL,
    summary TEXT DEFAULT NULL,
    timeline JSON DEFAULT NULL COMMENT 'array of timestamped events',
    participants JSON DEFAULT NULL COMMENT 'array of user_ids involved',
    action_items JSON DEFAULT NULL,
    resolution TEXT DEFAULT NULL,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME DEFAULT NULL,
    INDEX idx_status (status),
    INDEX idx_severity (severity),
    INDEX idx_store (store_id),
    FOREIGN KEY (initiated_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- MODULE 13: Organizational Memory
-- ============================================================
CREATE TABLE IF NOT EXISTS org_memory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    memory_type VARCHAR(80) NOT NULL COMMENT 'incident|fix|playbook|decision|lesson_learned',
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    tags JSON DEFAULT NULL,
    store_id INT DEFAULT NULL,
    related_entity_type VARCHAR(50) DEFAULT NULL,
    related_entity_id INT DEFAULT NULL,
    created_by INT NOT NULL,
    is_archived TINYINT(1) NOT NULL DEFAULT 0,
    usefulness_score DECIMAL(5,2) DEFAULT 0,
    view_count INT NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_type (memory_type),
    INDEX idx_store (store_id),
    INDEX idx_tags ((CAST(tags AS CHAR(500)))),
    INDEX idx_related (related_entity_type, related_entity_id),
    FULLTEXT idx_search (title, content),
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- MODULE 15: Enterprise Score System
-- ============================================================
CREATE TABLE IF NOT EXISTS enterprise_scores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    score_type VARCHAR(50) NOT NULL COMMENT 'store|employee|manager|compliance|payroll|operational|release',
    entity_id INT NOT NULL,
    score DECIMAL(5,2) NOT NULL COMMENT '0-100',
    components JSON NOT NULL COMMENT 'breakdown of score factors',
    trend ENUM('improving','stable','declining') NOT NULL DEFAULT 'stable',
    previous_score DECIMAL(5,2) DEFAULT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_type_entity (score_type, entity_id),
    INDEX idx_score (score),
    INDEX idx_trend (trend),
    INDEX idx_period (period_start, period_end)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- MODULE 14: Franchise Operations Network - Access Levels
-- ============================================================
CREATE TABLE IF NOT EXISTS franchise_access (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    access_level ENUM('franchise_owner','corporate','regional_ops','store_manager') NOT NULL,
    region VARCHAR(100) DEFAULT NULL,
    store_ids JSON DEFAULT NULL COMMENT 'array of accessible store IDs',
    permissions JSON DEFAULT NULL COMMENT 'granular permission overrides',
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    granted_by INT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_level (access_level),
    INDEX idx_region (region),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- Seed operational_status with default modules
-- ============================================================
INSERT IGNORE INTO operational_status (module, status, score) VALUES
('stores', 'healthy', 100.00),
('incidents', 'healthy', 100.00),
('payroll', 'healthy', 100.00),
('compliance', 'healthy', 100.00),
('audits', 'healthy', 100.00),
('releases', 'healthy', 100.00),
('training', 'healthy', 100.00),
('staffing', 'healthy', 100.00);
