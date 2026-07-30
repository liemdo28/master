<?php
/**
 * Phase 8 — Module 15: Enterprise Score System
 * 
 * Everything receives a score: Store, Employee, Manager, Compliance, Payroll, Operational, Release.
 */
class EnterpriseScoreEngine
{
    private $db;
    private string $today;

    public function __construct($db = null)
    {
        $this->db = $db ?: Database::getInstance();
        $this->today = function_exists('app_today') ? app_today() : date('Y-m-d');
    }

    // ─── SCORE CALCULATIONS ──────────────────────────────────────

    /**
     * Calculate all scores for a store
     */
    public function calculateStoreScore(int $storeId): array
    {
        $components = [];

        // Task performance (25%)
        $taskScore = $this->getTaskScore($storeId);
        $components['tasks'] = $taskScore;

        // Compliance (20%)
        $complianceScore = $this->getComplianceScore($storeId);
        $components['compliance'] = $complianceScore;

        // Payroll (15%)
        $payrollScore = $this->getPayrollScore($storeId);
        $components['payroll'] = $payrollScore;

        // Incidents (15%)
        $incidentScore = $this->getIncidentScore($storeId);
        $components['incidents'] = $incidentScore;

        // Training (10%)
        $trainingScore = $this->getTrainingScore($storeId);
        $components['training'] = $trainingScore;

        // Audits (15%)
        $auditScore = $this->getAuditScore($storeId);
        $components['audits'] = $auditScore;

        $overall = (
            $components['tasks'] * 0.25 +
            $components['compliance'] * 0.20 +
            $components['payroll'] * 0.15 +
            $components['incidents'] * 0.15 +
            $components['training'] * 0.10 +
            $components['audits'] * 0.15
        );

        return [
            'score' => round($overall, 2),
            'components' => $components,
        ];
    }

    /**
     * Calculate employee score
     */
    public function calculateEmployeeScore(int $userId): array
    {
        $components = [];

        // Tasks completed (30%)
        $stmt = $this->db->prepare("
            SELECT COUNT(*) FROM tasks WHERE assigned_to = ? AND status = 'done'
        ");
        $stmt->execute([$userId]);
        $completed = (int)$stmt->fetchColumn();
        $components['tasks_completed'] = min(100, $completed * 10);

        // On-time completion (25%)
        $stmt = $this->db->prepare("
            SELECT COUNT(*) FROM tasks WHERE assigned_to = ? AND status = 'done'
            AND completed_at <= due_date
        ");
        $stmt->execute([$userId]);
        $onTime = (int)$stmt->fetchColumn();
        $components['on_time'] = $completed > 0 ? ($onTime / $completed) * 100 : 100;

        // Quality (placeholder) (20%)
        $components['quality'] = 80; // Would integrate with review data

        // Training (15%)
        $stmt = $this->db->prepare("
            SELECT COUNT(*) FROM tasks WHERE assigned_to = ? AND title LIKE '%training%' AND status = 'done'
        ");
        $stmt->execute([$userId]);
        $training = (int)$stmt->fetchColumn();
        $components['training'] = min(100, $training * 20);

        // Penalties (10% - inverse)
        $stmt = $this->db->prepare("SELECT SUM(penalty_amount) FROM penalty_log WHERE user_id = ?");
        $stmt->execute([$userId]);
        $penalties = (float)($stmt->fetchColumn() ?: 0);
        $components['penalties'] = max(0, 100 - ($penalties * 10));

        $overall = (
            $components['tasks_completed'] * 0.30 +
            $components['on_time'] * 0.25 +
            $components['quality'] * 0.20 +
            $components['training'] * 0.15 +
            $components['penalties'] * 0.10
        );

        return ['score' => round($overall, 2), 'components' => $components];
    }

    /**
     * Calculate manager score (store health + team performance)
     */
    public function calculateManagerScore(int $userId): array
    {
        $stmt = $this->db->prepare("SELECT store_id FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $storeId = (int)$stmt->fetchColumn();

        if (!$storeId) return ['score' => 0, 'components' => []];

        $storeScore = $this->calculateStoreScore($storeId);

        // Team performance (25%)
        $stmt = $this->db->prepare("
            SELECT AVG(percentage) FROM (
                SELECT COUNT(*) / NULLIF((SELECT COUNT(*) FROM tasks t2 WHERE t2.assigned_to = t.assigned_to AND t2.status = 'done'), 0) * 100 as percentage
                FROM tasks t WHERE t.assigned_to IN (SELECT id FROM users WHERE store_id = ?) AND t.status = 'done'
                GROUP BY t.assigned_to
            ) as subq
        ");
        $stmt->execute([$storeId]);
        $teamPerf = (float)($stmt->fetchColumn() ?: 0);

        return [
            'score' => round($storeScore['score'] * 0.75 + $teamPerf * 0.25, 2),
            'components' => array_merge($storeScore['components'], ['team_performance' => $teamPerf]),
        ];
    }

    /**
     * Get all scores for a store
     */
    public function getStoreScores(int $storeId): array
    {
        $score = $this->calculateStoreScore($storeId);

        // Get previous score to determine trend
        $stmt = $this->db->prepare("
            SELECT score FROM enterprise_scores
            WHERE score_type = 'store' AND entity_id = ?
            ORDER BY calculated_at DESC LIMIT 1
        ");
        $stmt->execute([$storeId]);
        $prevScore = (float)($stmt->fetchColumn() ?: 0);

        $trend = $score['score'] > $prevScore ? 'improving' : ($score['score'] < $prevScore ? 'declining' : 'stable');

        return [
            'store_id' => $storeId,
            'score' => $score['score'],
            'components' => $score['components'],
            'trend' => $trend,
            'previous_score' => $prevScore ?: null,
            'period_start' => date('Y-m-01'),
            'period_end' => date('Y-m-t'),
        ];
    }

    /**
     * Save score to database
     */
    public function saveScore(string $type, int $entityId, array $scoreData): void
    {
        $stmt = $this->db->prepare("
            INSERT INTO enterprise_scores (score_type, entity_id, score, components, trend, previous_score, period_start, period_end)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $type,
            $entityId,
            $scoreData['score'],
            json_encode($scoreData['components']),
            $scoreData['trend'] ?? 'stable',
            $scoreData['previous_score'] ?? null,
            $scoreData['period_start'] ?? date('Y-m-01'),
            $scoreData['period_end'] ?? date('Y-m-t'),
        ]);
    }

    /**
     * Get score history
     */
    public function getScoreHistory(string $type, int $entityId, int $days = 30): array
    {
        $since = date('Y-m-d', strtotime("-{$days} days"));
        $stmt = $this->db->prepare("
            SELECT * FROM enterprise_scores
            WHERE score_type = ? AND entity_id = ? AND calculated_at >= ?
            ORDER BY calculated_at ASC
        ");
        $stmt->execute([$type, $entityId, $since]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Get leaderboard
     */
    public function getLeaderboard(string $type, int $limit = 10): array
    {
        $stmt = $this->db->prepare("
            SELECT es.*, s.name as entity_name
            FROM enterprise_scores es
            JOIN stores s ON s.id = es.entity_id
            WHERE es.score_type = ? AND es.period_end >= ?
            ORDER BY es.score DESC LIMIT ?
        ");
        $stmt->execute([$type, date('Y-m-01'), $limit]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // ─── COMPONENT SCORES ─────────────────────────────────────────

    private function getTaskScore(int $storeId): float
    {
        $stmt = $this->db->prepare("
            SELECT 
                COUNT(*) as total,
                SUM(status = 'done') as done,
                SUM(due_date < ? AND status NOT IN ('done','cancelled')) as overdue
            FROM tasks WHERE store_id = ?
        ");
        $stmt->execute([$this->today, $storeId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        $total = max(1, (int)$row['total']);
        $done = (int)$row['done'];
        $overdue = (int)$row['overdue'];

        $completionRate = ($done / $total) * 100;
        $penalty = ($overdue / $total) * 50;

        return max(0, min(100, $completionRate - $penalty));
    }

    private function getComplianceScore(int $storeId): float
    {
        $stmt = $this->db->prepare("
            SELECT COUNT(*) FROM bills WHERE store_id = ? AND status = 'pending' AND due_date < ?
        ");
        $stmt->execute([$storeId, $this->today]);
        $overdueBills = (int)$stmt->fetchColumn();

        return max(0, 100 - ($overdueBills * 15));
    }

    private function getPayrollScore(int $storeId): float
    {
        // Check for bills categorized as payroll/HR
        $stmt = $this->db->prepare("
            SELECT COUNT(*) FROM bills WHERE store_id = ? AND category = 'payroll' AND status = 'pending'
        ");
        $stmt->execute([$storeId]);
        $pendingPayroll = (int)$stmt->fetchColumn();

        return max(0, 100 - ($pendingPayroll * 10));
    }

    private function getIncidentScore(int $storeId): float
    {
        $stmt = $this->db->prepare("
            SELECT COUNT(*) FROM automation_events WHERE source_module = 'incidents' AND source_id = ? AND created_at >= ?
        ");
        $stmt->execute([$storeId, date('Y-m-01')]);
        $incidents = (int)$stmt->fetchColumn();

        return max(0, 100 - ($incidents * 10));
    }

    private function getTrainingScore(int $storeId): float
    {
        $stmt = $this->db->prepare("
            SELECT COUNT(*) FROM tasks WHERE store_id = ? AND title LIKE '%training%'
        ");
        $stmt->execute([$storeId]);
        $trainingTasks = (int)$stmt->fetchColumn();

        return min(100, $trainingTasks * 20);
    }

    private function getAuditScore(int $storeId): float
    {
        // Assume passing audits means healthy score
        return 80; // Would integrate with audit data
    }
}
