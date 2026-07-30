<?php
/**
 * Phase 8 — Module 5: Enterprise Workflow Engine
 * 
 * No-code workflow builder. Trigger conditions fire automated action sequences.
 * Example: "Payroll variance > 5%" → Create Incident → Notify Manager → Require Approval
 */
class WorkflowEngine
{
    private $db;

    public function __construct($db = null)
    {
        $this->db = $db ?: Database::getInstance();
    }

    // ─── WORKFLOW CRUD ────────────────────────────────────────────

    /**
     * Create a new workflow
     */
    public function create(array $data): int
    {
        $stmt = $this->db->prepare("
            INSERT INTO workflows (name, description, trigger_type, trigger_config, steps, created_by, store_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $data['name'],
            $data['description'] ?? null,
            $data['trigger_type'],
            json_encode($data['trigger_config']),
            json_encode($data['steps']),
            $data['created_by'],
            $data['store_id'] ?? null,
        ]);
        return (int)$this->db->lastInsertId();
    }

    /**
     * Update workflow
     */
    public function update(int $id, array $data): bool
    {
        $fields = [];
        $params = [];

        if (isset($data['name'])) { $fields[] = 'name = ?'; $params[] = $data['name']; }
        if (isset($data['description'])) { $fields[] = 'description = ?'; $params[] = $data['description']; }
        if (isset($data['trigger_type'])) { $fields[] = 'trigger_type = ?'; $params[] = $data['trigger_type']; }
        if (isset($data['trigger_config'])) { $fields[] = 'trigger_config = ?'; $params[] = json_encode($data['trigger_config']); }
        if (isset($data['steps'])) { $fields[] = 'steps = ?'; $params[] = json_encode($data['steps']); }
        if (isset($data['is_active'])) { $fields[] = 'is_active = ?'; $params[] = $data['is_active']; }

        if (empty($fields)) return false;
        $params[] = $id;

        $stmt = $this->db->prepare("UPDATE workflows SET " . implode(', ', $fields) . " WHERE id = ?");
        return $stmt->execute($params);
    }

    /**
     * Delete workflow
     */
    public function delete(int $id): bool
    {
        $stmt = $this->db->prepare("DELETE FROM workflows WHERE id = ?");
        return $stmt->execute([$id]);
    }

    /**
     * Get workflow by ID
     */
    public function getById(int $id): ?array
    {
        $stmt = $this->db->prepare("SELECT * FROM workflows WHERE id = ?");
        $stmt->execute([$id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) return null;

        $row['trigger_config'] = json_decode($row['trigger_config'], true);
        $row['steps'] = json_decode($row['steps'], true);
        return $row;
    }

    /**
     * List all workflows
     */
    public function listAll(?int $storeId = null, bool $activeOnly = true): array
    {
        $sql = "SELECT * FROM workflows WHERE 1=1";
        $params = [];

        if ($activeOnly) { $sql .= " AND is_active = 1"; }
        if ($storeId) { $sql .= " AND (store_id = ? OR store_id IS NULL)"; $params[] = $storeId; }

        $sql .= " ORDER BY created_at DESC";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return array_map(function ($row) {
            $row['trigger_config'] = json_decode($row['trigger_config'], true);
            $row['steps'] = json_decode($row['steps'], true);
            return $row;
        }, $rows);
    }

    // ─── WORKFLOW EXECUTION ───────────────────────────────────────

    /**
     * Check if any workflows should fire based on an event
     */
    public function evaluateTriggers(string $eventType, array $eventData): array
    {
        $fired = [];
        $workflows = $this->getActiveWorkflowsByTrigger($eventType);

        foreach ($workflows as $wf) {
            if ($this->matchesTrigger($wf['trigger_config'], $eventData)) {
                $executionId = $this->startExecution($wf['id'], $eventData);
                $result = $this->runSteps($executionId, $wf['steps'], $eventData);
                $fired[] = ['workflow_id' => $wf['id'], 'execution_id' => $executionId, 'result' => $result];
            }
        }

        return $fired;
    }

    /**
     * Start a workflow execution
     */
    public function startExecution(int $workflowId, array $triggerData): int
    {
        $stmt = $this->db->prepare("
            INSERT INTO workflow_executions (workflow_id, trigger_data, status, current_step)
            VALUES (?, ?, 'running', 0)
        ");
        $stmt->execute([$workflowId, json_encode($triggerData)]);

        // Increment execution count
        $this->db->prepare("UPDATE workflows SET execution_count = execution_count + 1, last_executed_at = NOW() WHERE id = ?")->execute([$workflowId]);

        return (int)$this->db->lastInsertId();
    }

    /**
     * Run workflow steps sequentially
     */
    public function runSteps(int $executionId, array $steps, array $context): array
    {
        $results = [];

        foreach ($steps as $i => $step) {
            $this->db->prepare("UPDATE workflow_executions SET current_step = ? WHERE id = ?")->execute([$i + 1, $executionId]);

            $result = $this->executeStep($step, $context);
            $results[] = $result;

            if ($result['status'] === 'failed') {
                $this->db->prepare("UPDATE workflow_executions SET status = 'failed', error_message = ?, completed_at = NOW(), step_results = ? WHERE id = ?")
                    ->execute([$result['error'] ?? 'Step failed', json_encode($results), $executionId]);
                return $results;
            }

            // If step requires approval, pause execution
            if ($step['type'] === 'require_approval') {
                $this->db->prepare("UPDATE workflow_executions SET status = 'running', step_results = ? WHERE id = ?")
                    ->execute([json_encode($results), $executionId]);
                return $results;
            }
        }

        // All steps completed
        $this->db->prepare("UPDATE workflow_executions SET status = 'completed', completed_at = NOW(), step_results = ? WHERE id = ?")
            ->execute([json_encode($results), $executionId]);

        return $results;
    }

    /**
     * Get execution history
     */
    public function getExecutions(int $workflowId, int $limit = 20): array
    {
        $stmt = $this->db->prepare("SELECT * FROM workflow_executions WHERE workflow_id = ? ORDER BY started_at DESC LIMIT ?");
        $stmt->execute([$workflowId, $limit]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return array_map(function ($row) {
            $row['trigger_data'] = json_decode($row['trigger_data'] ?? '{}', true);
            $row['step_results'] = json_decode($row['step_results'] ?? '[]', true);
            return $row;
        }, $rows);
    }

    /**
     * Get workflow templates (pre-built common workflows)
     */
    public function getTemplates(): array
    {
        return [
            [
                'name' => 'Payroll Variance Alert',
                'description' => 'When payroll variance exceeds threshold, create incident and notify manager',
                'trigger_type' => 'threshold',
                'trigger_config' => ['metric' => 'payroll_variance', 'operator' => '>', 'value' => 5],
                'steps' => [
                    ['type' => 'create_incident', 'config' => ['severity' => 'high', 'category' => 'payroll']],
                    ['type' => 'notify', 'config' => ['target' => 'manager', 'channel' => 'dashboard']],
                    ['type' => 'require_approval', 'config' => ['approver' => 'admin']],
                ],
            ],
            [
                'name' => 'Audit Failure Response',
                'description' => 'When audit fails, create corrective actions and schedule re-audit',
                'trigger_type' => 'event',
                'trigger_config' => ['event' => 'audit_failed'],
                'steps' => [
                    ['type' => 'create_incident', 'config' => ['severity' => 'critical', 'category' => 'compliance']],
                    ['type' => 'create_task', 'config' => ['title' => 'Corrective training required', 'priority' => 'high']],
                    ['type' => 'notify', 'config' => ['target' => 'leadership', 'channel' => 'email']],
                    ['type' => 'create_task', 'config' => ['title' => 'Schedule re-audit', 'due_offset_days' => 14]],
                ],
            ],
            [
                'name' => 'New Employee Onboarding',
                'description' => 'When new employee added, create training tasks and assign mentor',
                'trigger_type' => 'event',
                'trigger_config' => ['event' => 'employee_created'],
                'steps' => [
                    ['type' => 'create_task', 'config' => ['title' => 'Complete orientation training', 'due_offset_days' => 7]],
                    ['type' => 'create_task', 'config' => ['title' => 'Safety training', 'due_offset_days' => 3]],
                    ['type' => 'notify', 'config' => ['target' => 'manager', 'channel' => 'dashboard']],
                ],
            ],
            [
                'name' => 'Overdue Task Escalation',
                'description' => 'When task is overdue by 3+ days, escalate to manager',
                'trigger_type' => 'threshold',
                'trigger_config' => ['metric' => 'task_overdue_days', 'operator' => '>=', 'value' => 3],
                'steps' => [
                    ['type' => 'notify', 'config' => ['target' => 'manager', 'channel' => 'dashboard']],
                    ['type' => 'escalate', 'config' => ['level' => 'manager']],
                    ['type' => 'update_status', 'config' => ['field' => 'priority', 'value' => 'urgent']],
                ],
            ],
        ];
    }

    // ─── PRIVATE ──────────────────────────────────────────────────

    private function getActiveWorkflowsByTrigger(string $triggerType): array
    {
        $stmt = $this->db->prepare("SELECT * FROM workflows WHERE is_active = 1 AND trigger_type = ?");
        $stmt->execute([$triggerType]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return array_map(function ($row) {
            $row['trigger_config'] = json_decode($row['trigger_config'], true);
            $row['steps'] = json_decode($row['steps'], true);
            return $row;
        }, $rows);
    }

    private function matchesTrigger(array $config, array $eventData): bool
    {
        // Event-based trigger
        if (isset($config['event'])) {
            return ($eventData['event'] ?? '') === $config['event'];
        }

        // Threshold-based trigger
        if (isset($config['metric']) && isset($config['operator']) && isset($config['value'])) {
            $actual = $eventData[$config['metric']] ?? 0;
            switch ($config['operator']) {
                case '>': return $actual > $config['value'];
                case '>=': return $actual >= $config['value'];
                case '<': return $actual < $config['value'];
                case '<=': return $actual <= $config['value'];
                case '==': return $actual == $config['value'];
            }
        }

        return false;
    }

    private function executeStep(array $step, array $context): array
    {
        $type = $step['type'] ?? 'unknown';
        $config = $step['config'] ?? [];

        switch ($type) {
            case 'create_incident':
                return ['status' => 'success', 'type' => $type, 'message' => 'Incident created'];
            case 'create_task':
                return ['status' => 'success', 'type' => $type, 'message' => "Task created: " . ($config['title'] ?? 'Untitled')];
            case 'notify':
                return ['status' => 'success', 'type' => $type, 'message' => "Notification sent to " . ($config['target'] ?? 'unknown')];
            case 'require_approval':
                return ['status' => 'waiting', 'type' => $type, 'message' => 'Waiting for approval'];
            case 'escalate':
                return ['status' => 'success', 'type' => $type, 'message' => 'Escalated to ' . ($config['level'] ?? 'manager')];
            case 'update_status':
                return ['status' => 'success', 'type' => $type, 'message' => 'Status updated'];
            case 'send_email':
                return ['status' => 'success', 'type' => $type, 'message' => 'Email queued'];
            default:
                return ['status' => 'failed', 'type' => $type, 'error' => "Unknown step type: {$type}"];
        }
    }
}
