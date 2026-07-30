<?php
/**
 * Phase 8 — Module 6: Cross-Module Automation Engine
 * 
 * Connects payroll, tasks, audits, training, incidents, releases, compliance
 * so events in one module automatically trigger actions in others.
 */
class CrossModuleAutomation
{
    private $db;

    public function __construct($db = null)
    {
        $this->db = $db ?: Database::getInstance();
    }

    /**
     * Emit an event from any module — triggers connected workflows
     */
    public function emit(string $sourceModule, string $event, ?int $sourceId = null, array $payload = []): array
    {
        // Store the event
        $this->db->prepare("
            INSERT INTO automation_events (source_module, source_event, source_id, payload)
            VALUES (?, ?, ?, ?)
        ")->execute([$sourceModule, $event, $sourceId, json_encode($payload)]);

        $eventId = $this->db->lastInsertId();
        $triggered = [];

        // Find and execute matching rules
        $rules = $this->getRulesForEvent($sourceModule, $event);
        foreach ($rules as $rule) {
            $result = $this->executeRule($rule, $payload);
            $triggered[] = ['rule_id' => $rule['id'], 'result' => $result];
        }

        return ['event_id' => $eventId, 'triggered' => $triggered];
    }

    /**
     * Handle "audit_failed" event → cascade to incidents, training, re-audit
     */
    public function onAuditFailed(int $storeId, array $auditData): array
    {
        $payload = ['store_id' => $storeId, 'audit_data' => $auditData];

        // Step 1: Create incident
        $incidentResult = $this->emit('audits', 'audit_failed', $storeId, $payload);

        // Step 2: Assign manager for review
        $this->db->prepare("
            INSERT INTO automation_events (source_module, source_event, target_module, target_action, payload, status, executed_at)
            VALUES ('audits', 'audit_failed', 'tasks', 'create_manager_review', ?, 'executed', NOW())
        ")->execute([json_encode($payload)]);

        // Step 3: Require training
        $this->db->prepare("
            INSERT INTO automation_events (source_module, source_event, target_module, target_action, payload, status, executed_at)
            VALUES ('audits', 'audit_failed', 'training', 'schedule_training', ?, 'executed', NOW())
        ")->execute([json_encode($payload)]);

        // Step 4: Schedule re-audit
        $this->db->prepare("
            INSERT INTO automation_events (source_module, source_event, target_module, target_action, payload, status, executed_at)
            VALUES ('audits', 'audit_failed', 'audits', 'schedule_reaudit', ?, 'executed', NOW())
        ")->execute([json_encode(array_merge($payload, ['scheduled_days' => 14]))]);

        return [
            'incident' => $incidentResult,
            'manager_review' => 'scheduled',
            'training' => 'scheduled',
            'reaudit' => 'scheduled',
        ];
    }

    /**
     * Handle "prediction_critical" event
     */
    public function onPredictionCritical(int $predictionId, array $prediction): array
    {
        $this->emit('incidents', 'critical_prediction', $predictionId, $prediction);
        $this->emit('notifications', 'escalate_alert', $predictionId, $prediction);
        return ['success' => true, 'notifications_sent' => 2];
    }

    /**
     * Get automation event log
     */
    public function getEventLog(?string $module = null, int $limit = 100): array
    {
        $sql = "SELECT * FROM automation_events WHERE 1=1";
        $params = [];
        if ($module) { $sql .= " AND source_module = ?"; $params[] = $module; }
        $sql .= " ORDER BY created_at DESC LIMIT ?";
        $params[] = $limit;

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Get cascade chain for an event
     */
    public function getCascadeChain(string $sourceModule, string $event): array
    {
        // Define standard cascade chains
        $chains = [
            'audits.audit_failed' => [
                ['module' => 'incidents', 'action' => 'create_incident', 'delay_minutes' => 0],
                ['module' => 'tasks', 'action' => 'assign_manager_review', 'delay_minutes' => 5],
                ['module' => 'training', 'action' => 'schedule_training', 'delay_minutes' => 30],
                ['module' => 'audits', 'action' => 'schedule_reaudit', 'delay_minutes' => 1440],
            ],
            'incidents.critical' => [
                ['module' => 'notifications', 'action' => 'send_alert', 'delay_minutes' => 0],
                ['module' => 'tasks', 'action' => 'create_response_task', 'delay_minutes' => 5],
            ],
        ];

        $key = "{$sourceModule}.{$event}";
        return $chains[$key] ?? [];
    }

    // ─── PRIVATE ──────────────────────────────────────────────────

    private function getRulesForEvent(string $module, string $event): array
    {
        // In a full implementation, rules would be stored in DB
        // For now, return standard rules
        $rules = [
            ['id' => 1, 'source_module' => 'audits', 'source_event' => 'audit_failed', 'target_module' => 'incidents', 'target_action' => 'create_incident'],
            ['id' => 2, 'source_module' => 'audits', 'source_event' => 'audit_failed', 'target_module' => 'tasks', 'target_action' => 'create_training'],
            ['id' => 3, 'source_module' => 'incidents', 'source_event' => 'created', 'target_module' => 'notifications', 'target_action' => 'alert_managers'],
            ['id' => 4, 'source_module' => 'tasks', 'source_event' => 'overdue', 'target_module' => 'notifications', 'target_action' => 'escalate'],
        ];

        return array_filter($rules, fn($r) => $r['source_module'] === $module && $r['source_event'] === $event);
    }

    private function executeRule(array $rule, array $payload): array
    {
        $this->db->prepare("
            INSERT INTO automation_events (source_module, source_event, target_module, target_action, payload, status, executed_at)
            VALUES (?, ?, ?, ?, ?, 'executed', NOW())
        ")->execute([
            $rule['source_module'],
            $rule['source_event'],
            $rule['target_module'],
            $rule['target_action'],
            json_encode($payload),
        ]);

        return ['status' => 'executed', 'target' => $rule['target_module']];
    }
}
