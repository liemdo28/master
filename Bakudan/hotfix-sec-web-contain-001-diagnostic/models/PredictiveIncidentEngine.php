<?php
/**
 * Phase 8 — Module 2: Predictive Incident Engine
 * 
 * Shifts from reactive (incident → react) to predictive (predict → prevent).
 * Analyzes patterns across stores, tasks, payroll, compliance to forecast issues.
 */
class PredictiveIncidentEngine
{
    private $db;
    private string $today;

    public function __construct($db = null)
    {
        $this->db = $db ?: Database::getInstance();
        $this->today = function_exists('app_today') ? app_today() : date('Y-m-d');
    }

    // ─── PUBLIC API ───────────────────────────────────────────────

    /**
     * Run full prediction scan across all modules
     */
    public function runPredictionScan(): array
    {
        $predictions = [];
        $predictions = array_merge($predictions, $this->predictAuditFailures());
        $predictions = array_merge($predictions, $this->predictPayrollAnomalies());
        $predictions = array_merge($predictions, $this->predictDeadlineMisses());
        $predictions = array_merge($predictions, $this->predictTaskOverdue());
        $predictions = array_merge($predictions, $this->predictManagerOverload());

        // Persist new predictions
        foreach ($predictions as $p) {
            $this->storePrediction($p);
        }

        // Expire old predictions
        $this->expireOldPredictions();

        return $predictions;
    }

    /**
     * Get active predictions, optionally filtered
     */
    public function getActivePredictions(?string $type = null, ?string $severity = null, int $limit = 50): array
    {
        $sql = "SELECT * FROM predictions WHERE status = 'active'";
        $params = [];

        if ($type) {
            $sql .= " AND prediction_type = ?";
            $params[] = $type;
        }
        if ($severity) {
            $sql .= " AND severity = ?";
            $params[] = $severity;
        }

        $sql .= " ORDER BY probability DESC, severity DESC LIMIT ?";
        $params[] = $limit;

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return array_map(function ($row) {
            $row['factors'] = json_decode($row['factors'] ?? '[]', true);
            $row['recommended_actions'] = json_decode($row['recommended_actions'] ?? '[]', true);
            return $row;
        }, $rows);
    }

    /**
     * Acknowledge a prediction (human reviewed it)
     */
    public function acknowledge(int $predictionId, int $userId, ?string $notes = null): bool
    {
        $stmt = $this->db->prepare("UPDATE predictions SET status = 'acknowledged', acknowledged_by = ?, acknowledged_at = NOW(), outcome_notes = ? WHERE id = ?");
        return $stmt->execute([$userId, $notes, $predictionId]);
    }

    /**
     * Mark prediction as prevented (action was taken)
     */
    public function markPrevented(int $predictionId, ?string $notes = null): bool
    {
        $stmt = $this->db->prepare("UPDATE predictions SET status = 'prevented', resolved_at = NOW(), outcome_notes = ? WHERE id = ?");
        return $stmt->execute([$notes, $predictionId]);
    }

    /**
     * Mark prediction as occurred (it happened despite warning)
     */
    public function markOccurred(int $predictionId, ?string $notes = null): bool
    {
        $stmt = $this->db->prepare("UPDATE predictions SET status = 'occurred', resolved_at = NOW(), outcome_notes = ? WHERE id = ?");
        return $stmt->execute([$notes, $predictionId]);
    }

    /**
     * Get prediction accuracy stats
     */
    public function getAccuracyStats(int $days = 30): array
    {
        $since = date('Y-m-d', strtotime("-{$days} days"));
        $stmt = $this->db->prepare("
            SELECT 
                prediction_type,
                COUNT(*) as total,
                SUM(status = 'prevented') as prevented,
                SUM(status = 'occurred') as occurred,
                SUM(status = 'expired') as expired,
                AVG(probability) as avg_probability
            FROM predictions 
            WHERE created_at >= ? AND status IN ('prevented','occurred','expired')
            GROUP BY prediction_type
        ");
        $stmt->execute([$since]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Get summary dashboard data
     */
    public function getDashboardSummary(): array
    {
        $stmt = $this->db->prepare("
            SELECT 
                COUNT(*) as total_active,
                SUM(severity = 'critical') as critical,
                SUM(severity = 'high') as high,
                SUM(severity = 'medium') as medium,
                SUM(severity = 'low') as low
            FROM predictions WHERE status = 'active'
        ");
        $stmt->execute();
        $summary = $stmt->fetch(PDO::FETCH_ASSOC);

        $summary['by_type'] = [];
        $stmt2 = $this->db->prepare("
            SELECT prediction_type, COUNT(*) as count 
            FROM predictions WHERE status = 'active' 
            GROUP BY prediction_type ORDER BY count DESC
        ");
        $stmt2->execute();
        $summary['by_type'] = $stmt2->fetchAll(PDO::FETCH_ASSOC);

        return $summary;
    }

    // ─── PREDICTION ALGORITHMS ────────────────────────────────────

    /**
     * Predict stores likely to fail audit based on overdue tasks, compliance gaps
     */
    private function predictAuditFailures(): array
    {
        $predictions = [];
        $horizon = P8_PREDICTIONS['horizons']['audit_fail'] ?? 168;

        // Stores with high overdue ratio + low compliance
        $stmt = $this->db->prepare("
            SELECT s.id, s.name,
                COUNT(t.id) as total_tasks,
                SUM(t.status = 'overdue' OR (t.due_date < ? AND t.status NOT IN ('done','cancelled'))) as overdue_count,
                SUM(t.status = 'done') as done_count
            FROM stores s
            LEFT JOIN tasks t ON t.store_id = s.id
            WHERE t.created_at >= DATE_SUB(?, INTERVAL 30 DAY)
            GROUP BY s.id
            HAVING overdue_count > 3 AND (overdue_count / GREATEST(total_tasks, 1)) > 0.3
        ");
        $stmt->execute([$this->today, $this->today]);
        $stores = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($stores as $store) {
            $overdueRatio = $store['total_tasks'] > 0 ? ($store['overdue_count'] / $store['total_tasks']) * 100 : 0;
            $probability = min(95, $overdueRatio + 20);

            if ($probability >= P8_PREDICTIONS['min_probability']) {
                $predictions[] = [
                    'prediction_type' => 'audit_fail',
                    'entity_type' => 'store',
                    'entity_id' => $store['id'],
                    'probability' => $probability,
                    'severity' => $probability >= 80 ? 'critical' : ($probability >= 70 ? 'high' : 'medium'),
                    'horizon_hours' => $horizon,
                    'description' => 'Store "' . $store['name'] . '" has ' . $store['overdue_count'] . ' overdue tasks (' . round($overdueRatio) . '% overdue rate). Likely to fail next audit.',
                    'factors' => [
                        'overdue_tasks' => (int)$store['overdue_count'],
                        'overdue_ratio' => round($overdueRatio, 1),
                        'total_tasks' => (int)$store['total_tasks'],
                    ],
                    'recommended_actions' => [
                        'Complete overdue tasks immediately',
                        'Schedule pre-audit review',
                        'Assign additional resources',
                    ],
                ];
            }
        }

        return $predictions;
    }

    /**
     * Predict payroll anomalies based on bill patterns
     */
    private function predictPayrollAnomalies(): array
    {
        $predictions = [];
        $horizon = P8_PREDICTIONS['horizons']['payroll_anomaly'] ?? 48;

        // Look for bills with unusual amounts compared to historical average
        $stmt = $this->db->prepare("
            SELECT b.id, b.store_id, b.amount, b.due_date, s.name as store_name,
                (SELECT AVG(b2.amount) FROM bills b2 WHERE b2.store_id = b.store_id AND b2.category = b.category) as avg_amount
            FROM bills b
            JOIN stores s ON s.id = b.store_id
            WHERE b.status = 'pending' AND b.due_date BETWEEN ? AND DATE_ADD(?, INTERVAL 7 DAY)
            HAVING b.amount > avg_amount * 1.5 AND avg_amount > 0
        ");
        $stmt->execute([$this->today, $this->today]);
        $bills = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($bills as $bill) {
            $variance = $bill['avg_amount'] > 0 ? (($bill['amount'] - $bill['avg_amount']) / $bill['avg_amount']) * 100 : 0;
            $probability = min(90, 50 + ($variance / 5));

            if ($probability >= P8_PREDICTIONS['min_probability']) {
                $predictions[] = [
                    'prediction_type' => 'payroll_anomaly',
                    'entity_type' => 'bill',
                    'entity_id' => $bill['id'],
                    'probability' => $probability,
                    'severity' => $variance > 100 ? 'critical' : 'high',
                    'horizon_hours' => $horizon,
                    'description' => "Bill for store \"{$bill['store_name']}\" is " . round($variance) . "% above average. Possible payroll anomaly.",
                    'factors' => [
                        'current_amount' => (float)$bill['amount'],
                        'average_amount' => round((float)$bill['avg_amount'], 2),
                        'variance_pct' => round($variance, 1),
                    ],
                    'recommended_actions' => [
                        'Review bill details for accuracy',
                        'Compare with previous pay periods',
                        'Verify staffing changes',
                    ],
                ];
            }
        }

        return $predictions;
    }

    /**
     * Predict employees likely to miss deadlines
     */
    private function predictDeadlineMisses(): array
    {
        $predictions = [];
        $horizon = P8_PREDICTIONS['horizons']['deadline_miss'] ?? 24;

        // Users with tasks due tomorrow who have high historical miss rate
        $tomorrow = date('Y-m-d', strtotime($this->today . ' +1 day'));
        $stmt = $this->db->prepare("
            SELECT u.id, u.name, 
                COUNT(t.id) as due_tomorrow,
                (SELECT COUNT(*) FROM tasks t2 WHERE t2.assigned_to = u.id AND t2.status = 'done' AND t2.completed_at > t2.due_date) as late_completions,
                (SELECT COUNT(*) FROM tasks t3 WHERE t3.assigned_to = u.id AND t3.status = 'done') as total_completions
            FROM users u
            JOIN tasks t ON t.assigned_to = u.id
            WHERE t.due_date = ? AND t.status NOT IN ('done','cancelled')
            GROUP BY u.id
            HAVING due_tomorrow > 0
        ");
        $stmt->execute([$tomorrow]);
        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($users as $user) {
            $lateRate = $user['total_completions'] > 0 ? ($user['late_completions'] / $user['total_completions']) * 100 : 0;
            $probability = min(90, $lateRate + ($user['due_tomorrow'] * 10));

            if ($probability >= P8_PREDICTIONS['min_probability']) {
                $predictions[] = [
                    'prediction_type' => 'deadline_miss',
                    'entity_type' => 'user',
                    'entity_id' => $user['id'],
                    'probability' => $probability,
                    'severity' => $user['due_tomorrow'] > 3 ? 'high' : 'medium',
                    'horizon_hours' => $horizon,
                    'description' => $user['name'] . ' has ' . $user['due_tomorrow'] . ' tasks due tomorrow with a ' . round($lateRate) . '% historical late rate.',
                    'factors' => [
                        'tasks_due_tomorrow' => (int)$user['due_tomorrow'],
                        'historical_late_rate' => round($lateRate, 1),
                        'late_completions' => (int)$user['late_completions'],
                    ],
                    'recommended_actions' => [
                        'Send early reminder',
                        'Offer assistance or redistribute',
                        'Check for blockers',
                    ],
                ];
            }
        }

        return $predictions;
    }

    /**
     * Predict recurring tasks likely to become overdue
     */
    private function predictTaskOverdue(): array
    {
        $predictions = [];
        $horizon = P8_PREDICTIONS['horizons']['task_overdue'] ?? 72;

        // Tasks due in next 3 days with no progress and assigned to overloaded users
        $threeDays = date('Y-m-d', strtotime($this->today . ' +3 days'));
        $stmt = $this->db->prepare("
            SELECT t.id, t.title, t.due_date, t.assigned_to, u.name as assignee_name,
                (SELECT COUNT(*) FROM tasks t2 WHERE t2.assigned_to = t.assigned_to AND t2.status NOT IN ('done','cancelled') AND t2.due_date <= ?) as active_load
            FROM tasks t
            JOIN users u ON u.id = t.assigned_to
            WHERE t.due_date BETWEEN ? AND ? 
                AND t.status IN ('pending','in_progress')
                AND t.progress_pct < 20
            HAVING active_load > 5
        ");
        $stmt->execute([$threeDays, $this->today, $threeDays]);
        $tasks = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($tasks as $task) {
            $probability = min(85, 50 + ($task['active_load'] * 5));

            if ($probability >= P8_PREDICTIONS['min_probability']) {
                $predictions[] = [
                    'prediction_type' => 'task_overdue',
                    'entity_type' => 'task',
                    'entity_id' => $task['id'],
                    'probability' => $probability,
                    'severity' => 'medium',
                    'horizon_hours' => $horizon,
                    'description' => "Task \"{$task['title']}\" assigned to {$task['assignee_name']} likely overdue — low progress with {$task['active_load']} active tasks.",
                    'factors' => [
                        'progress' => 0,
                        'active_load' => (int)$task['active_load'],
                        'days_until_due' => max(0, (strtotime($task['due_date']) - strtotime($this->today)) / 86400),
                    ],
                    'recommended_actions' => [
                        'Reassign or split task',
                        'Extend deadline if possible',
                        'Reduce assignee workload',
                    ],
                ];
            }
        }

        return $predictions;
    }

    /**
     * Predict manager overload risk
     */
    private function predictManagerOverload(): array
    {
        $predictions = [];
        $horizon = P8_PREDICTIONS['horizons']['manager_overload'] ?? 120;

        // Managers with too many direct reports having issues
        $stmt = $this->db->prepare("
            SELECT u.id, u.name, u.store_id, s.name as store_name,
                (SELECT COUNT(*) FROM tasks t WHERE t.store_id = u.store_id AND t.status NOT IN ('done','cancelled') AND t.due_date < ?) as store_overdue,
                (SELECT COUNT(DISTINCT t2.assigned_to) FROM tasks t2 WHERE t2.store_id = u.store_id AND t2.status NOT IN ('done','cancelled')) as active_members
            FROM users u
            JOIN stores s ON s.id = u.store_id
            WHERE u.role IN ('admin','manager')
            HAVING store_overdue > 10 AND active_members > 3
        ");
        $stmt->execute([$this->today]);
        $managers = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($managers as $mgr) {
            $probability = min(90, 40 + ($mgr['store_overdue'] * 3));

            if ($probability >= P8_PREDICTIONS['min_probability']) {
                $predictions[] = [
                    'prediction_type' => 'manager_overload',
                    'entity_type' => 'user',
                    'entity_id' => $mgr['id'],
                    'probability' => $probability,
                    'severity' => $mgr['store_overdue'] > 20 ? 'critical' : 'high',
                    'horizon_hours' => $horizon,
                    'description' => "Manager {$mgr['name']} at \"{$mgr['store_name']}\" overloaded: {$mgr['store_overdue']} overdue tasks across {$mgr['active_members']} team members.",
                    'factors' => [
                        'store_overdue_tasks' => (int)$mgr['store_overdue'],
                        'active_team_members' => (int)$mgr['active_members'],
                        'overdue_per_member' => round($mgr['store_overdue'] / max(1, $mgr['active_members']), 1),
                    ],
                    'recommended_actions' => [
                        'Redistribute tasks across team',
                        'Provide temporary support staff',
                        'Review and prioritize critical tasks only',
                        'Consider deadline extensions for low-priority items',
                    ],
                ];
            }
        }

        return $predictions;
    }

    // ─── PERSISTENCE ──────────────────────────────────────────────

    private function storePrediction(array $p): void
    {
        // Check for duplicate active prediction
        $stmt = $this->db->prepare("
            SELECT id FROM predictions 
            WHERE prediction_type = ? AND entity_type = ? AND entity_id = ? AND status = 'active'
            LIMIT 1
        ");
        $stmt->execute([$p['prediction_type'], $p['entity_type'], $p['entity_id']]);
        if ($stmt->fetch()) return; // Already exists

        $expiresAt = date('Y-m-d H:i:s', strtotime("+{$p['horizon_hours']} hours"));

        $stmt = $this->db->prepare("
            INSERT INTO predictions (prediction_type, entity_type, entity_id, probability, severity, horizon_hours, description, factors, recommended_actions, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $p['prediction_type'],
            $p['entity_type'],
            $p['entity_id'],
            $p['probability'],
            $p['severity'],
            $p['horizon_hours'],
            $p['description'],
            json_encode($p['factors']),
            json_encode($p['recommended_actions']),
            $expiresAt,
        ]);
    }

    private function expireOldPredictions(): void
    {
        $this->db->prepare("UPDATE predictions SET status = 'expired' WHERE status = 'active' AND expires_at < NOW()")->execute();
    }
}
