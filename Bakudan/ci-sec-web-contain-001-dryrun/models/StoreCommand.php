<?php
/**
 * StoreCommand Model — Store Command Center
 *
 * Single source of truth for store health, metrics, and quick actions.
 * Health Score Formula:
 *   Start at 100
 *   - Task Overdue Rate   (max -30): overdue_rate * 30
 *   - Overdue Bills        (max -25): overdue_bills * 5
 *   - Open Incidents       (max -20): open_incidents * 5
 *   - Critical Incidents   (-10 each): critical * 10
 *   - Penalty Score        (max -10): penalty_deductions
 *   - Inspection Failures  (max -5):  inspection_failures
 *   Floor: 0, Ceiling: 100
 */
class StoreCommand
{
    private $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
        $this->ensureSchema();
    }

    private function ensureSchema(): void
    {
        try {
            if (!$this->db->tableExists('store_health_scores')) {
                $this->db->execute("
                    CREATE TABLE IF NOT EXISTS store_health_scores (
                        id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                        store_id      INT NOT NULL,
                        score         DECIMAL(5,2) DEFAULT 100.00,
                        grade         CHAR(1) DEFAULT 'A',
                        metrics       JSON DEFAULT NULL,
                        recorded_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        INDEX idx_health_store (store_id),
                        INDEX idx_health_date (recorded_at)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                ");
            }
        } catch (\Throwable $e) {
            error_log('[STORE-HEALTH] ensureSchema failed: ' . $e->getMessage());
        }
    }

    // ── Helpers ──────────────────────────────────────────────────

    private function hasCol(string $table, string $col): bool
    {
        return $this->db->columnExists($table, $col);
    }

    // ── Store lookups ────────────────────────────────────────────

    public function find(int $storeId): ?array
    {
        $hasManagerId = $this->hasCol('stores', 'manager_id');
        $hasPhone     = $this->hasCol('stores', 'phone');
        $hasRegion    = $this->hasCol('stores', 'region');
        $hasStatus    = $this->hasCol('stores', 'status');
        $hasStoreCode = $this->hasCol('stores', 'store_code');
        $hasOpenedAt  = $this->hasCol('stores', 'opened_at');

        $extras = '';
        if ($hasManagerId)  $extras .= ", u.name AS manager_name, u.email AS manager_email";
        if ($hasPhone)      $extras .= ", s.phone";
        if ($hasRegion)     $extras .= ", s.region";
        if ($hasStatus)     $extras .= ", s.status";
        if ($hasStoreCode)  $extras .= ", s.store_code";
        if ($hasOpenedAt)   $extras .= ", s.opened_at";

        $managerJoin = $hasManagerId
            ? "LEFT JOIN users u ON s.manager_id = u.id"
            : "";

        $store = $this->db->fetch(
            "SELECT s.* {$extras}
             FROM stores s
             {$managerJoin}
             WHERE s.id = ?",
            [$storeId]
        );
        return $store ?: null;
    }

    public function getAllStores(?int $currentUserId = null, ?string $currentUserRole = null): array
    {
        $hasManagerId = $this->hasCol('stores', 'manager_id');
        $hasPhone     = $this->hasCol('stores', 'phone');
        $hasRegion    = $this->hasCol('stores', 'region');
        $hasStatus    = $this->hasCol('stores', 'status');
        $hasStoreCode = $this->hasCol('stores', 'store_code');

        $extras = '';
        if ($hasManagerId) $extras .= ", u.name AS manager_name";
        if ($hasPhone)     $extras .= ", s.phone";
        if ($hasRegion)    $extras .= ", s.region";
        if ($hasStatus)    $extras .= ", s.status";
        if ($hasStoreCode) $extras .= ", s.store_code";

        $managerJoin = $hasManagerId
            ? "LEFT JOIN users u ON s.manager_id = u.id"
            : "";

        // Manager role: only see assigned stores
        $whereExtra = '';
        $params = [];
        if ($currentUserRole === 'manager' && $currentUserId !== null) {
            $whereExtra = " AND (
                EXISTS (SELECT 1 FROM store_manager_assignments sma WHERE sma.store_id = s.id AND sma.user_id = ?)
                OR s.manager_id = ?
            )";
            $params[] = $currentUserId;
            $params[] = $currentUserId;
        }

        return $this->db->fetchAll(
            "SELECT s.* {$extras}
             FROM stores s
             {$managerJoin}
             WHERE 1=1 {$whereExtra}
             ORDER BY s.name ASC",
            $params
        );
    }

    public function getStoreCount(): int
    {
        $row = $this->db->fetch("SELECT COUNT(*) AS cnt FROM stores WHERE is_active = 1");
        return (int)($row['cnt'] ?? 0);
    }

    // ── Task Stats ───────────────────────────────────────────────

    public function getTaskStats(int $storeId): array
    {
        $today   = date('Y-m-d');
        $weekAgo = date('Y-m-d', strtotime('-7 days'));

        $total = $this->db->fetch(
            "SELECT COUNT(*) as cnt FROM tasks t
             JOIN projects p ON t.project_id = p.id
             WHERE p.store_id = ?",
            [$storeId]
        );

        $overdue = $this->db->fetch(
            "SELECT COUNT(*) as cnt FROM tasks t
             JOIN projects p ON t.project_id = p.id
             WHERE p.store_id = ? AND t.due_date < ? AND t.is_completed = 0",
            [$storeId, $today]
        );

        $dueToday = $this->db->fetch(
            "SELECT COUNT(*) as cnt FROM tasks t
             JOIN projects p ON t.project_id = p.id
             WHERE p.store_id = ? AND t.due_date = ? AND t.is_completed = 0",
            [$storeId, $today]
        );

        $completed = $this->db->fetch(
            "SELECT COUNT(*) as cnt FROM tasks t
             JOIN projects p ON t.project_id = p.id
             WHERE p.store_id = ? AND t.is_completed = 1 AND t.updated_at >= ?",
            [$storeId, $weekAgo]
        );

        $critical = $this->db->fetch(
            "SELECT COUNT(*) as cnt FROM tasks t
             JOIN projects p ON t.project_id = p.id
             WHERE p.store_id = ? AND t.is_completed = 0 AND t.priority = 'urgent' AND (t.due_date <= ? OR t.due_date IS NULL)",
            [$storeId, $today]
        );

        $activeEmployees = $this->db->fetch(
            "SELECT COUNT(DISTINCT t.assignee_id) as cnt FROM tasks t
             JOIN projects p ON t.project_id = p.id
             WHERE p.store_id = ? AND t.is_completed = 0 AND t.assignee_id IS NOT NULL",
            [$storeId]
        );

        return [
            'total'               => (int)($total['cnt'] ?? 0),
            'overdue'             => (int)($overdue['cnt'] ?? 0),
            'due_today'           => (int)($dueToday['cnt'] ?? 0),
            'completed_this_week' => (int)($completed['cnt'] ?? 0),
            'critical'            => (int)($critical['cnt'] ?? 0),
            'active_employees'    => (int)($activeEmployees['cnt'] ?? 0),
        ];
    }

    // ── Bill Stats ───────────────────────────────────────────────

    public function getBillStats(int $storeId): array
    {
        $today = date('Y-m-d');

        $total = $this->db->fetch(
            "SELECT COUNT(*) as cnt FROM bills WHERE store_id = ?",
            [$storeId]
        );

        $overdue = $this->db->fetch(
            "SELECT COUNT(*) as cnt FROM bills WHERE store_id = ? AND (status = 'overdue' OR (due_date < ? AND status = 'pending'))",
            [$storeId, $today]
        );

        $totalDue = $this->db->fetch(
            "SELECT COALESCE(SUM(amount), 0) as total FROM bills
             WHERE store_id = ? AND status IN ('pending', 'overdue')",
            [$storeId]
        );

        return [
            'total_bills'  => (int)($total['cnt'] ?? 0),
            'overdue_bills' => (int)($overdue['cnt'] ?? 0),
            'total_due'    => (float)($totalDue['total'] ?? 0),
        ];
    }

    // ── Incident Stats ───────────────────────────────────────────

    public function getIncidentStats(int $storeId): array
    {
        if (!$this->db->tableExists('incidents')) {
            return ['total' => 0, 'open' => 0, 'critical' => 0];
        }

        $total = $this->db->fetch(
            "SELECT COUNT(*) as cnt FROM incidents WHERE store_id = ?",
            [$storeId]
        );

        $open = $this->db->fetch(
            "SELECT COUNT(*) as cnt FROM incidents WHERE store_id = ? AND status NOT IN ('resolved', 'closed', 'cancelled')",
            [$storeId]
        );

        $critical = $this->db->fetch(
            "SELECT COUNT(*) as cnt FROM incidents WHERE store_id = ? AND severity = 'critical' AND status NOT IN ('resolved', 'closed', 'cancelled')",
            [$storeId]
        );

        return [
            'total'    => (int)($total['cnt'] ?? 0),
            'open'     => (int)($open['cnt'] ?? 0),
            'critical' => (int)($critical['cnt'] ?? 0),
        ];
    }

    // ── Penalty Stats ────────────────────────────────────────────

    public function getPenaltyStats(int $storeId): array
    {
        if (!$this->db->tableExists('penalties')) {
            return ['total' => 0, 'unresolved' => 0];
        }

        // Penalties scoped by store through task assignees
        $total = $this->db->fetch(
            "SELECT COUNT(DISTINCT p.id) as cnt
             FROM penalties p
             JOIN tasks t ON p.task_id = t.id
             JOIN projects pr ON t.project_id = pr.id
             WHERE pr.store_id = ?",
            [$storeId]
        );

        return [
            'total'      => (int)($total['cnt'] ?? 0),
            'unresolved' => (int)($total['cnt'] ?? 0),
        ];
    }

    // ── Recent Activity ──────────────────────────────────────────

    public function getRecentActivity(int $storeId, int $limit = 10): array
    {
        return $this->db->fetchAll(
            "SELECT t.id, t.title, t.status, t.priority, t.due_date, t.is_completed, t.updated_at,
                    p.name as project_name, p.color as project_color,
                    u.name as assignee_name, u.avatar as assignee_avatar
             FROM tasks t
             JOIN projects p ON t.project_id = p.id
             LEFT JOIN users u ON t.assignee_id = u.id
             WHERE p.store_id = ?
             ORDER BY t.updated_at DESC
             LIMIT ?",
            [$storeId, $limit]
        );
    }

    // ── Health Score ─────────────────────────────────────────────

    public function getHealthScore(int $storeId): ?array
    {
        return $this->db->fetch(
            "SELECT * FROM store_health_scores WHERE store_id = ? ORDER BY recorded_at DESC LIMIT 1",
            [$storeId]
        );
    }

    public function recordHealthScore(int $storeId, float $score, array $metrics): void
    {
        $grade = $this->scoreToGrade($score);
        $this->db->execute(
            "INSERT INTO store_health_scores (store_id, score, grade, metrics) VALUES (?, ?, ?, ?)",
            [$storeId, $score, $grade, json_encode($metrics)]
        );
    }

    /**
     * Health Score Formula (documented):
     * ─────────────────────────────────────────
     * Start: 100
     * - Task Overdue Rate × 30          (max -30)
     * - Overdue Bills × 5              (max -25)
     * - Open Incidents × 5             (max -20)
     * - Critical Incidents × 10        (no cap)
     * - Penalty Deductions              (max -10)
     * - Inspection Failures × 5         (max -5)
     * Floor: 0, Ceiling: 100
     */
    public function calculateHealthScore(int $storeId): array
    {
        $taskStats     = $this->getTaskStats($storeId);
        $billStats     = $this->getBillStats($storeId);
        $incidentStats = $this->getIncidentStats($storeId);
        $penaltyStats  = $this->getPenaltyStats($storeId);

        $score = 100.0;

        // Task deductions (max -30)
        if ($taskStats['total'] > 0) {
            $overdueRate = $taskStats['overdue'] / max(1, $taskStats['total']);
            $score -= $overdueRate * 30;
        }

        // Bill deductions (max -25)
        $score -= min(25, $billStats['overdue_bills'] * 5);

        // Incident deductions (max -20)
        $score -= min(20, $incidentStats['open'] * 5);
        $score -= $incidentStats['critical'] * 10;

        // Penalty deductions (max -10)
        $score -= min(10, $penaltyStats['total'] * 2);

        $score = max(0, min(100, $score));

        $metrics = [
            'task_overdue_rate' => $taskStats['total'] > 0
                ? round($taskStats['overdue'] / $taskStats['total'] * 100, 1)
                : 0,
            'task_due_today'      => $taskStats['due_today'],
            'task_critical'       => $taskStats['critical'],
            'task_total'          => $taskStats['total'],
            'task_completed_week' => $taskStats['completed_this_week'],
            'active_employees'    => $taskStats['active_employees'],
            'bill_overdue'        => $billStats['overdue_bills'],
            'total_due'           => $billStats['total_due'],
            'bill_total'          => $billStats['total_bills'],
            'incident_open'       => $incidentStats['open'],
            'incident_critical'   => $incidentStats['critical'],
            'penalty_total'       => $penaltyStats['total'],
        ];

        // Record historical score — non-fatal, log and continue
        try {
            $this->recordHealthScore($storeId, $score, $metrics);
        } catch (\Throwable $e) {
            error_log('[STORE-HEALTH] recordHealthScore failed for store ' . $storeId . ': ' . $e->getMessage());
        }

        return [
            'score'   => round($score, 1),
            'grade'   => $this->scoreToGrade($score),
            'metrics' => $metrics,
        ];
    }

    private function scoreToGrade(float $score): string
    {
        if ($score >= 90) return 'A';
        if ($score >= 80) return 'B';
        if ($score >= 70) return 'C';
        if ($score >= 60) return 'D';
        return 'F';
    }

    // ── Enriched store list for Command Center ───────────────────

    /**
     * Get all stores enriched with task/bill/health data.
     * Used by the Command Center index page.
     */
    public function getEnrichedStores(?int $currentUserId = null, ?string $currentUserRole = null): array
    {
        $stores = $this->getAllStores($currentUserId, $currentUserRole);
        $today = date('Y-m-d');

        foreach ($stores as &$store) {
            $id = (int)$store['id'];

            // Task stats
            $taskRow = $this->db->fetch(
                "SELECT
                    COUNT(*) AS total,
                    SUM(t.is_completed = 0 AND t.due_date < ?) AS overdue,
                    SUM(t.is_completed = 0 AND t.priority = 'urgent' AND (t.due_date <= ? OR t.due_date IS NULL)) AS critical,
                    SUM(t.is_completed = 0) AS open_tasks
                 FROM tasks t
                 JOIN projects p ON t.project_id = p.id
                 WHERE p.store_id = ?",
                [$today, $today, $id]
            );
            $store['task_total']   = (int)($taskRow['total'] ?? 0);
            $store['task_overdue'] = (int)($taskRow['overdue'] ?? 0);
            $store['task_critical'] = (int)($taskRow['critical'] ?? 0);
            $store['task_open']    = (int)($taskRow['open_tasks'] ?? 0);

            // Bill stats
            $billRow = $this->db->fetch(
                "SELECT
                    COUNT(*) AS total,
                    SUM(status = 'overdue' OR (due_date < ? AND status = 'pending')) AS unpaid
                 FROM bills WHERE store_id = ?",
                [$today, $id]
            );
            $store['bill_total']  = (int)($billRow['total'] ?? 0);
            $store['bill_unpaid'] = (int)($billRow['unpaid'] ?? 0);

            // Active employees
            $empRow = $this->db->fetch(
                "SELECT COUNT(DISTINCT t.assignee_id) AS cnt
                 FROM tasks t
                 JOIN projects p ON t.project_id = p.id
                 WHERE p.store_id = ? AND t.is_completed = 0 AND t.assignee_id IS NOT NULL",
                [$id]
            );
            $store['employee_count'] = (int)($empRow['cnt'] ?? 0);
        }
        unset($store);

        return $stores;
    }
}
