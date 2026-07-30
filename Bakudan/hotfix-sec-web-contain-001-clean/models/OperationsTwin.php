<?php
/**
 * Phase 8 — Module 7: Digital Operations Twin
 * 
 * Virtual model of the business. Simulates "what if" scenarios
 * before leadership takes action.
 */
class OperationsTwin
{
    private $db;

    public function __construct($db = null)
    {
        $this->db = $db ?: Database::getInstance();
    }

    /**
     * Simulate "What if Store A loses its manager?"
     */
    public function simulateManagerLoss(int $storeId): array
    {
        $stmt = $this->db->prepare("SELECT * FROM stores WHERE id = ?");
        $stmt->execute([$storeId]);
        $store = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$store) return ['error' => 'Store not found'];

        // Count overdue tasks
        $stmt = $this->db->prepare("SELECT COUNT(*) FROM tasks WHERE store_id = ? AND status NOT IN ('done','cancelled')");
        $stmt->execute([$storeId]);
        $activeTasks = (int)$stmt->fetchColumn();

        $stmt = $this->db->prepare("SELECT COUNT(*) FROM tasks WHERE store_id = ? AND due_date < CURDATE() AND status NOT IN ('done','cancelled')");
        $stmt->execute([$storeId]);
        $overdueTasks = (int)$stmt->fetchColumn();

        // Count team members
        $stmt = $this->db->prepare("SELECT COUNT(*) FROM users WHERE store_id = ?");
        $stmt->execute([$storeId]);
        $teamSize = (int)$stmt->fetchColumn();

        // Simulate impact
        $auditRiskIncrease = min(30, $overdueTasks * 2);
        $payrollRiskIncrease = min(20, $activeTasks * 0.5);
        $overdueIncrease = min(50, $activeTasks * 0.3);

        return [
            'scenario' => "Manager loss at {$store['name']}",
            'store' => $store,
            'current_state' => [
                'active_tasks' => $activeTasks,
                'overdue_tasks' => $overdueTasks,
                'team_size' => $teamSize,
            ],
            'predicted_impact' => [
                'overdue_increase_pct' => $overdueIncrease,
                'audit_risk_increase' => $auditRiskIncrease,
                'payroll_risk_increase' => $payrollRiskIncrease,
                'completion_rate_decline' => min(20, ($overdueTasks / max(1, $activeTasks)) * 100),
            ],
            'recommended_actions' => [
                'Immediately reassign critical tasks',
                'Promote interim manager from team',
                'Cross-train team members',
                'Pause non-critical projects',
            ],
            'confidence' => 0.85,
        ];
    }

    /**
     * Simulate "What if demand increases 30%?"
     */
    public function simulateDemandIncrease(int $storeId, float $increasePct): array
    {
        $stmt = $this->db->prepare("SELECT * FROM stores WHERE id = ?");
        $stmt->execute([$storeId]);
        $store = $stmt->fetch(PDO::FETCH_ASSOC);

        $stmt = $this->db->prepare("SELECT COUNT(*) FROM users WHERE store_id = ?");
        $stmt->execute([$storeId]);
        $currentStaff = (int)$stmt->fetchColumn();

        $neededStaff = ceil($currentStaff * ($increasePct / 100));
        $overtimeRisk = $increasePct > 20 ? 'high' : ($increasePct > 10 ? 'medium' : 'low');

        return [
            'scenario' => "{$increasePct}% demand increase at {$store['name']}",
            'predicted_impact' => [
                'staff_needed' => $neededStaff,
                'current_staff' => $currentStaff,
                'overtime_risk' => $overtimeRisk,
                'task_overflow_likelihood' => min(95, $increasePct * 2),
                'customer_impact_score' => min(30, $increasePct * 0.5),
            ],
            'recommended_actions' => [
                'Hire ' . $neededStaff . ' additional staff',
                'Implement shift rotation',
                'Prioritize high-value tasks',
                'Consider temporary labor',
            ],
        ];
    }

    /**
     * Simulate store closure impact
     */
    public function simulateStoreClosure(int $storeId): array
    {
        $stmt = $this->db->prepare("SELECT * FROM stores WHERE id = ?");
        $stmt->execute([$storeId]);
        $store = $stmt->fetch(PDO::FETCH_ASSOC);

        $stmt = $this->db->prepare("SELECT COUNT(*) FROM tasks WHERE store_id = ? AND status NOT IN ('done','cancelled')");
        $stmt->execute([$storeId]);
        $orphanedTasks = (int)$stmt->fetchColumn();

        $stmt = $this->db->prepare("SELECT COUNT(*) FROM users WHERE store_id = ?");
        $stmt->execute([$storeId]);
        $affectedEmployees = (int)$stmt->fetchColumn();

        $stmt = $this->db->prepare("SELECT COUNT(*) FROM bills WHERE store_id = ? AND status = 'pending'");
        $stmt->execute([$storeId]);
        $pendingBills = (int)$stmt->fetchColumn();

        return [
            'scenario' => "Closure of {$store['name']}",
            'affected_resources' => [
                'orphaned_tasks' => $orphanedTasks,
                'affected_employees' => $affectedEmployees,
                'pending_bills' => $pendingBills,
            ],
            'ripple_effect' => [
                'team_morale_impact' => 'high',
                'vendor_relationship_impact' => 'medium',
                'customer_impact' => 'critical',
            ],
            'recommended_actions' => [
                'Reassign tasks to other stores',
                'Process all pending bills',
                'Communicate with affected employees',
                'Notify vendors and partners',
            ],
        ];
    }

    /**
     * Save simulation to history
     */
    public function saveSimulation(int $createdBy, ?int $storeId, string $scenarioType, string $scenario, array $parameters, array $results): int
    {
        $stmt = $this->db->prepare("
            INSERT INTO simulations (created_by, store_id, scenario_type, scenario, parameters, results)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $createdBy,
            $storeId,
            $scenarioType,
            $scenario,
            json_encode($parameters),
            json_encode($results),
        ]);
        return (int)$this->db->lastInsertId();
    }

    /**
     * Get simulation history
     */
    public function getHistory(?int $storeId = null, int $limit = 20): array
    {
        $sql = "SELECT * FROM simulations WHERE 1=1";
        $params = [];
        if ($storeId) { $sql .= " AND store_id = ?"; $params[] = $storeId; }
        $sql .= " ORDER BY created_at DESC LIMIT ?";
        $params[] = $limit;

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
