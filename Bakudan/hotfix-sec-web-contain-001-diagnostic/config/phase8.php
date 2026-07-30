<?php
/**
 * Phase 8 — Autonomous Operations & Enterprise Scaling Configuration
 */

if (!defined('PHASE8_ENABLED')) define('PHASE8_ENABLED', true);

// Module 1: Operational Command Center
define('P8_COMMAND_CENTER', [
    'modules' => ['stores', 'incidents', 'payroll', 'compliance', 'audits', 'releases', 'training', 'staffing'],
    'refresh_interval' => 30, // seconds
    'health_threshold_warning' => 70,
    'health_threshold_critical' => 40,
]);

// Module 2: Predictive Incident Engine
define('P8_PREDICTIONS', [
    'enabled' => true,
    'min_probability' => 60, // minimum % to surface a prediction
    'horizons' => [
        'audit_fail' => 168,       // 7 days
        'payroll_anomaly' => 48,   // 2 days
        'deadline_miss' => 24,     // 1 day
        'task_overdue' => 72,      // 3 days
        'manager_overload' => 120, // 5 days
    ],
    'max_active_per_entity' => 5,
    'auto_expire_hours' => 168,
]);

// Module 3: Recommendation Engine
define('P8_RECOMMENDATIONS', [
    'enabled' => true,
    'max_per_entity' => 10,
    'auto_expire_days' => 14,
    'categories' => ['health_improvement', 'risk_mitigation', 'efficiency', 'compliance'],
]);

// Module 4: Corrective Actions
define('P8_CORRECTIVE_ACTIONS', [
    'auto_propose' => true,
    'require_approval' => true,
    'triggers' => [
        'audit_fail' => ['create_training', 'manager_review', 'schedule_reaudit'],
        'incident' => ['assign_manager', 'create_task', 'notify_leadership'],
        'prediction_critical' => ['preventive_task', 'escalate'],
        'threshold_breach' => ['corrective_task', 'notify'],
    ],
]);

// Module 5: Workflow Engine
define('P8_WORKFLOWS', [
    'max_steps' => 20,
    'max_active_workflows' => 100,
    'execution_timeout_minutes' => 60,
    'trigger_types' => ['event', 'schedule', 'threshold', 'manual'],
    'action_types' => ['create_incident', 'notify', 'create_task', 'require_approval', 'send_email', 'update_status', 'escalate'],
]);

// Module 6: Cross-Module Automation
define('P8_CROSS_MODULE', [
    'enabled' => true,
    'modules' => ['payroll', 'tasks', 'audits', 'training', 'incidents', 'releases', 'compliance'],
    'event_retention_days' => 90,
]);

// Module 7: Digital Operations Twin
define('P8_OPERATIONS_TWIN', [
    'enabled' => true,
    'scenario_types' => ['staff_loss', 'demand_change', 'store_closure', 'expansion', 'manager_transfer'],
    'max_simulations_per_day' => 50,
]);

// Module 8: Notification Center
define('P8_NOTIFICATIONS', [
    'channels' => ['dashboard', 'email', 'sms', 'slack', 'teams', 'push'],
    'default_channel' => 'dashboard',
    'batch_interval_minutes' => 5,
    'max_per_hour' => 100,
    'severity_escalation' => [
        'critical' => ['dashboard', 'email', 'push'],
        'emergency' => ['dashboard', 'email', 'sms', 'push'],
    ],
]);

// Module 10: War Room
define('P8_WAR_ROOM', [
    'auto_activate_on' => ['critical_incident', 'payroll_failure', 'multi_store_outage'],
    'max_active_sessions' => 5,
]);

// Module 12: AI Decision Support
define('P8_AI_DECISION', [
    'enabled' => true,
    'factors' => ['performance', 'staffing', 'incidents', 'training', 'audit_history', 'financials'],
    'confidence_threshold' => 0.7,
]);

// Module 13: Organizational Memory
define('P8_ORG_MEMORY', [
    'types' => ['incident', 'fix', 'playbook', 'decision', 'lesson_learned'],
    'max_per_store' => 500,
    'search_enabled' => true,
]);

// Module 14: Franchise Network
define('P8_FRANCHISE', [
    'enabled' => true,
    'levels' => ['franchise_owner', 'corporate', 'regional_ops', 'store_manager'],
    'data_isolation' => true,
]);

// Module 15: Enterprise Scores
define('P8_SCORES', [
    'types' => ['store', 'employee', 'manager', 'compliance', 'payroll', 'operational', 'release'],
    'calculation_interval' => 'daily',
    'weights' => [
        'store' => ['tasks' => 0.25, 'compliance' => 0.20, 'payroll' => 0.15, 'incidents' => 0.15, 'training' => 0.10, 'audits' => 0.15],
        'employee' => ['tasks_completed' => 0.30, 'on_time' => 0.25, 'quality' => 0.20, 'training' => 0.15, 'penalties' => 0.10],
        'manager' => ['team_performance' => 0.25, 'store_health' => 0.20, 'compliance' => 0.20, 'incidents_resolved' => 0.15, 'training' => 0.10, 'audit_pass' => 0.10],
    ],
]);
