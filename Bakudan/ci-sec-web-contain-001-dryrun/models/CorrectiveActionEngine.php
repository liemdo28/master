<?php
/**
 * Phase 8 — Module 4: Automated Corrective Actions Engine
 * 
 * System proposes corrective actions automatically when triggers fire.
 * Admin approves. Actions include training tasks, manager reviews, follow-up audits.
 */
class CorrectiveActionEngine
{
    private $db;

    public function __construct($db = null)
    {
        $this->db = $db ?: Database::getInstance();
    }

    /**
     * Propose corrective actions based on a trigger event
     */
    public function propose(string $triggerType, ?int $triggerId, array $context): array
    {
        $config = P8_CORRECTIVE_ACTIONS['triggers'][$triggerType] ?? [];
        if (empty($config)) return [];

        $actions = $this->buildActions($triggerType, $config, $context);
        $storeId = $context['store_id'] ?? null;
        $assignedTo = $context['assigned_to'] ?? $context['manager_id'] ?? null;

        $title = $this->generateTitle($triggerType, $context);
        $description = $this->generateDescription($triggerType, $context);

        $stmt = $this->db->prepare("
            INSERT INTO corrective_actions (trigger_type, trigger_id, trigger_details, store_id, assigned_to, title, description, actions)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $triggerType,
            $triggerId,
            json_encode($context),
            $storeId,
            $assignedTo,
            $title,
            $description,
            json_encode($actions),
        ]);

        $id = $this->db->lastInsertId();

        return [
            'id' => $id,
            'trigger_type' => $triggerType,
            'title' => $title,
            'actions' => $actions,
            'status' => 'proposed',
        ];
    }

    /**
     * Auto-propose from audit failure
     */
    public function proposeFromAuditFail(int $storeId, array $auditDetails): array
    {
        return $this->propose('audit_fail', null, [
            'store_id' => $storeId,
            'audit_details' => $auditDetails,
            'failure_areas' => $auditDetails['failure_areas'] ?? [],
        ]);
    }

    /**
     * Auto-propose from prediction
     */
    public function proposeFromPrediction(array $prediction): array
    {
        return $this->propose('prediction', $prediction['id'] ?? null, [
            'store_id' => $prediction['entity_type'] === 'store' ? $prediction['entity_id'] : null,
            'prediction_type' => $prediction['prediction_type'],
            'severity' => $prediction['severity'],
            'description' => $prediction['description'],
        ]);
    }

    /**
     * Approve a corrective action
     */
    public function approve(int $id, int $approvedBy): bool
    {
        $stmt = $this->db->prepare("
            UPDATE corrective_actions 
            SET status = 'approved', approved_by = ?, approved_at = NOW() 
            WHERE id = ? AND status = 'proposed'
        ");
        return $stmt->execute([$approvedBy, $id]);
    }

    /**
     * Reject a corrective action
     */
    public function reject(int $id, int $rejectedBy): bool
    {
        $stmt = $this->db->prepare("UPDATE corrective_actions SET status = 'rejected' WHERE id = ? AND status = 'proposed'");
        return $stmt->execute([$id]);
    }

    /**
     * Execute approved corrective action (create tasks, notifications, etc.)
     */
    public function execute(int $id): array
    {
        $stmt = $this->db->prepare("SELECT * FROM corrective_actions WHERE id = ? AND status = 'approved'");
        $stmt->execute([$id]);
        $ca = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$ca) return ['error' => 'Not found or not approved'];

        $actions = json_decode($ca['actions'], true);
        $results = [];

        foreach ($actions as $action) {
            $results[] = $this->executeAction($action, $ca);
        }

        $this->db->prepare("UPDATE corrective_actions SET status = 'in_progress' WHERE id = ?")->execute([$id]);

        return ['id' => $id, 'status' => 'in_progress', 'results' => $results];
    }

    /**
     * Mark corrective action as completed
     */
    public function complete(int $id, ?string $outcome = null): bool
    {
        $stmt = $this->db->prepare("UPDATE corrective_actions SET status = 'completed', completed_at = NOW(), outcome = ? WHERE id = ?");
        return $stmt->execute([$outcome, $id]);
    }

    /**
     * Get corrective actions by status
     */
    public function getByStatus(string $status = 'proposed', ?int $storeId = null, int $limit = 50): array
    {
        $sql = "SELECT * FROM corrective_actions WHERE status = ?";
        $params = [$status];

        if ($storeId) { $sql .= " AND store_id = ?"; $params[] = $storeId; }
        $sql .= " ORDER BY created_at DESC LIMIT ?";
        $params[] = $limit;

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return array_map(function ($row) {
            $row['actions'] = json_decode($row['actions'] ?? '[]', true);
            $row['trigger_details'] = json_decode($row['trigger_details'] ?? '{}', true);
            return $row;
        }, $rows);
    }

    /**
     * Get dashboard summary
     */
    public function getSummary(): array
    {
        $stmt = $this->db->prepare("
            SELECT status, COUNT(*) as count FROM corrective_actions GROUP BY status
        ");
        $stmt->execute();
        $counts = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $counts[$row['status']] = (int)$row['count'];
        }
        return $counts;
    }

    // ─── PRIVATE ──────────────────────────────────────────────────

    private function buildActions(string $triggerType, array $config, array $context): array
    {
        $actions = [];
        foreach ($config as $actionType) {
            switch ($actionType) {
                case 'create_training':
                    $actions[] = ['type' => 'create_task', 'category' => 'training', 'title' => 'Complete corrective training', 'priority' => 'high'];
                    break;
                case 'manager_review':
                    $actions[] = ['type' => 'create_task', 'category' => 'review', 'title' => 'Manager review required', 'priority' => 'high'];
                    break;
                case 'schedule_reaudit':
                    $actions[] = ['type' => 'create_task', 'category' => 'audit', 'title' => 'Schedule follow-up audit', 'priority' => 'medium', 'due_offset_days' => 14];
                    break;
                case 'assign_manager':
                    $actions[] = ['type' => 'assign', 'target' => 'manager', 'title' => 'Assign responsible manager'];
                    break;
                case 'create_task':
                    $actions[] = ['type' => 'create_task', 'category' => 'corrective', 'title' => 'Corrective action task', 'priority' => 'high'];
                    break;
                case 'notify_leadership':
                    $actions[] = ['type' => 'notify', 'target' => 'leadership', 'title' => 'Leadership notification sent'];
                    break;
                case 'preventive_task':
                    $actions[] = ['type' => 'create_task', 'category' => 'preventive', 'title' => 'Preventive action required', 'priority' => 'high'];
                    break;
                case 'escalate':
                    $actions[] = ['type' => 'escalate', 'title' => 'Escalated to senior management'];
                    break;
                case 'corrective_task':
                    $actions[] = ['type' => 'create_task', 'category' => 'corrective', 'title' => 'Address threshold breach', 'priority' => 'urgent'];
                    break;
                case 'notify':
                    $actions[] = ['type' => 'notify', 'target' => 'manager', 'title' => 'Manager notified'];
                    break;
            }
        }
        return $actions;
    }

    private function executeAction(array $action, array $ca): array
    {
        // In production, this would create actual tasks/notifications
        // For now, log the execution intent
        return [
            'action_type' => $action['type'],
            'title' => $action['title'] ?? 'Action executed',
            'status' => 'executed',
            'executed_at' => date('Y-m-d H:i:s'),
        ];
    }

    private function generateTitle(string $triggerType, array $context): string
    {
        $titles = [
            'audit_fail' => 'Corrective Actions: Audit Failure',
            'incident' => 'Corrective Actions: Incident Response',
            'prediction' => 'Preventive Actions: Predicted Issue',
            'threshold' => 'Corrective Actions: Threshold Breach',
        ];
        return $titles[$triggerType] ?? "Corrective Actions: {$triggerType}";
    }

    private function generateDescription(string $triggerType, array $context): string
    {
        $desc = $context['description'] ?? '';
        return "Auto-generated corrective action plan for {$triggerType}. {$desc}";
    }
}
