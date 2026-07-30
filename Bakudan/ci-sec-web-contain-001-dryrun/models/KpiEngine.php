<?php
/**
 * KPI Engine — Store Performance Scoring, Benchmarking & Executive Scorecard
 */
class KpiEngine
{
    private $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    // ── Daily KPI Snapshot (called by cron) ──────────────────────────────────

    public function calculateDailySnapshot(?int $storeId = null): array
    {
        if (!$this->db->tableExists('store_kpis')) {
            return [];
        }

        $today = function_exists('app_today') ? app_today() : date('Y-m-d');
        $stores = $storeId
            ? [$this->db->fetch("SELECT id FROM stores WHERE id = ? AND is_active = 1", [$storeId])]
            : $this->db->fetchAll("SELECT id FROM stores WHERE is_active = 1");

        $results = [];
        foreach ($stores as $store) {
            if (!$store) continue;
            $sid = (int)$store['id'];
            $kpi = $this->computeStoreKpi($sid, $today);

            // Upsert
            $existing = $this->db->fetch(
                "SELECT id FROM store_kpis WHERE store_id = ? AND date = ?",
                [$sid, $today]
            );
            if ($existing) {
                $this->db->update('store_kpis', $kpi, 'id = ?', [$existing['id']]);
            } else {
                $kpi['store_id'] = $sid;
                $kpi['date'] = $today;
                $this->db->insert('store_kpis', $kpi);
            }
            $results[$sid] = $kpi;
        }
        return $results;
    }

    private function computeStoreKpi(int $storeId, string $date): array
    {
        // Task metrics — tasks linked to projects in this store
        $taskRow = $this->db->fetch(
            "SELECT
                COUNT(*) AS total,
                SUM(t.is_completed = 1) AS completed,
                SUM(t.is_completed = 0 AND t.due_date < ?) AS overdue
             FROM tasks t
             JOIN projects p ON t.project_id = p.id
             WHERE p.store_id = ?",
            [$date, $storeId]
        );

        $total = (int)($taskRow['total'] ?? 0);
        $completed = (int)($taskRow['completed'] ?? 0);
        $overdue = (int)($taskRow['overdue'] ?? 0);
        $completionPct = $total > 0 ? round(($completed / $total) * 100, 2) : null;
        $overduePct = $total > 0 ? round(($overdue / $total) * 100, 2) : null;

        // Incident count (last 30 days)
        $incidentCount = 0;
        if ($this->db->tableExists('incidents')) {
            $ic = $this->db->fetch(
                "SELECT COUNT(*) AS c FROM incidents WHERE store_id = ? AND created_at >= DATE_SUB(?, INTERVAL 30 DAY)",
                [$storeId, $date]
            );
            $incidentCount = (int)($ic['c'] ?? 0);
        }

        // Compliance score
        $auditScore = null;
        $trainingPct = null;
        if ($this->db->tableExists('compliance_items')) {
            $compRow = $this->db->fetch(
                "SELECT
                    COUNT(*) AS total,
                    SUM(status = 'compliant') AS compliant
                 FROM compliance_items WHERE store_id = ?",
                [$storeId]
            );
            $compTotal = (int)($compRow['total'] ?? 0);
            if ($compTotal > 0) {
                $auditScore = round(((int)($compRow['compliant'] ?? 0) / $compTotal) * 100, 2);
            }
        }

        // Composite health score (weighted average)
        $healthScore = $this->computeHealthScore($completionPct, $overduePct, $auditScore, $incidentCount);

        return [
            'task_completion_pct'     => $completionPct,
            'overdue_pct'             => $overduePct,
            'tasks_total'             => $total,
            'tasks_completed'         => $completed,
            'tasks_overdue'           => $overdue,
            'payroll_accuracy_pct'    => null, // Future integration
            'audit_score'             => $auditScore,
            'training_compliance_pct' => $trainingPct,
            'incident_count'          => $incidentCount,
            'store_health_score'      => $healthScore,
        ];
    }

    private function computeHealthScore(?float $completion, ?float $overdue, ?float $audit, int $incidents): ?float
    {
        $scores = [];
        $weights = [];

        if ($completion !== null) { $scores[] = $completion; $weights[] = 0.35; }
        if ($overdue !== null) { $scores[] = max(0, 100 - $overdue * 2); $weights[] = 0.25; }
        if ($audit !== null) { $scores[] = $audit; $weights[] = 0.25; }

        // Incident penalty (max 15 points deduction)
        $incidentScore = max(0, 100 - ($incidents * 5));
        $scores[] = $incidentScore;
        $weights[] = 0.15;

        if (empty($scores)) return null;

        $totalWeight = array_sum($weights);
        $weighted = 0;
        for ($i = 0; $i < count($scores); $i++) {
            $weighted += $scores[$i] * ($weights[$i] / $totalWeight);
        }
        return round($weighted, 2);
    }

    // ── Executive Scorecard ──────────────────────────────────────────────────

    public function getExecutiveScorecard(): array
    {
        if (!$this->db->tableExists('store_kpis')) {
            return $this->emptyExecutiveScorecard();
        }

        // Latest KPIs across all stores
        $avgKpi = $this->db->fetch(
            "SELECT
                AVG(store_health_score) AS avg_health,
                AVG(task_completion_pct) AS avg_completion,
                AVG(audit_score) AS avg_audit,
                AVG(training_compliance_pct) AS avg_training,
                SUM(incident_count) AS total_incidents,
                AVG(payroll_accuracy_pct) AS avg_payroll
             FROM store_kpis
             WHERE date = (SELECT MAX(date) FROM store_kpis)"
        );

        // High risk stores (health < 70)
        $highRisk = $this->db->fetchAll(
            "SELECT sk.store_id, s.name AS store_name, sk.store_health_score
             FROM store_kpis sk
             JOIN stores s ON s.id = sk.store_id
             WHERE sk.date = (SELECT MAX(date) FROM store_kpis)
               AND sk.store_health_score < 70
             ORDER BY sk.store_health_score ASC
             LIMIT 10"
        );

        // Open risks
        $openRisks = 0;
        $criticalRisks = 0;
        if ($this->db->tableExists('risks')) {
            $riskRow = $this->db->fetch(
                "SELECT COUNT(*) AS total, SUM(severity = 'critical') AS critical FROM risks WHERE status IN ('open','mitigating')"
            );
            $openRisks = (int)($riskRow['total'] ?? 0);
            $criticalRisks = (int)($riskRow['critical'] ?? 0);
        }

        // Company stats
        $storeCount = (int)($this->db->fetch("SELECT COUNT(*) AS c FROM stores WHERE is_active = 1")['c'] ?? 0);

        return [
            'store_health'          => round((float)($avgKpi['avg_health'] ?? 0), 1),
            'task_completion'       => round((float)($avgKpi['avg_completion'] ?? 0), 1),
            'audit_score'           => round((float)($avgKpi['avg_audit'] ?? 0), 1),
            'training_compliance'   => round((float)($avgKpi['avg_training'] ?? 0), 1),
            'payroll_accuracy'      => round((float)($avgKpi['avg_payroll'] ?? 0), 1),
            'total_incidents'       => (int)($avgKpi['total_incidents'] ?? 0),
            'open_risks'            => $openRisks,
            'critical_risks'        => $criticalRisks,
            'high_risk_stores'      => $highRisk,
            'total_stores'          => $storeCount,
        ];
    }

    private function emptyExecutiveScorecard(): array
    {
        $storeCount = 0;
        if ($this->db->tableExists('stores')) {
            $storeCount = (int)($this->db->fetch("SELECT COUNT(*) AS c FROM stores WHERE is_active = 1")['c'] ?? 0);
        }

        return [
            'store_health'          => 0,
            'task_completion'       => 0,
            'audit_score'           => 0,
            'training_compliance'   => 0,
            'payroll_accuracy'      => 0,
            'total_incidents'       => 0,
            'open_risks'            => 0,
            'critical_risks'        => 0,
            'high_risk_stores'      => [],
            'total_stores'          => $storeCount,
        ];
    }

    // ── Store Benchmarking ───────────────────────────────────────────────────

    public function getBenchmarks(): array
    {
        if (!$this->db->tableExists('store_kpis')) {
            return ['top' => [], 'bottom' => [], 'most_improved' => [], 'highest_incidents' => []];
        }

        $latestDate = $this->db->fetch("SELECT MAX(date) AS d FROM store_kpis")['d'] ?? null;
        if (!$latestDate) return ['top' => [], 'bottom' => [], 'most_improved' => []];

        // Top stores
        $top = $this->db->fetchAll(
            "SELECT sk.store_id, s.name AS store_name, sk.store_health_score, sk.task_completion_pct, sk.audit_score
             FROM store_kpis sk JOIN stores s ON s.id = sk.store_id
             WHERE sk.date = ? ORDER BY sk.store_health_score DESC LIMIT 10",
            [$latestDate]
        );

        // Bottom stores
        $bottom = $this->db->fetchAll(
            "SELECT sk.store_id, s.name AS store_name, sk.store_health_score, sk.task_completion_pct, sk.overdue_pct
             FROM store_kpis sk JOIN stores s ON s.id = sk.store_id
             WHERE sk.date = ? AND sk.store_health_score IS NOT NULL
             ORDER BY sk.store_health_score ASC LIMIT 10",
            [$latestDate]
        );

        // Most improved (compare to 7 days ago)
        $weekAgo = date('Y-m-d', strtotime($latestDate . ' -7 days'));
        $improved = $this->db->fetchAll(
            "SELECT cur.store_id, s.name AS store_name,
                    cur.store_health_score AS current_score,
                    prev.store_health_score AS prev_score,
                    (cur.store_health_score - prev.store_health_score) AS improvement
             FROM store_kpis cur
             JOIN store_kpis prev ON prev.store_id = cur.store_id AND prev.date = ?
             JOIN stores s ON s.id = cur.store_id
             WHERE cur.date = ?
             ORDER BY improvement DESC LIMIT 10",
            [$weekAgo, $latestDate]
        );

        // Highest incident rate
        $incidents = $this->db->fetchAll(
            "SELECT sk.store_id, s.name AS store_name, sk.incident_count
             FROM store_kpis sk JOIN stores s ON s.id = sk.store_id
             WHERE sk.date = ? ORDER BY sk.incident_count DESC LIMIT 10",
            [$latestDate]
        );

        return [
            'date'           => $latestDate,
            'top'            => $top,
            'bottom'         => $bottom,
            'most_improved'  => $improved,
            'highest_incidents' => $incidents,
        ];
    }

    // ── Store Detail KPI History ─────────────────────────────────────────────

    public function getStoreHistory(int $storeId, int $days = 30): array
    {
        if (!$this->db->tableExists('store_kpis')) {
            return [];
        }

        return $this->db->fetchAll(
            "SELECT * FROM store_kpis WHERE store_id = ? ORDER BY date DESC LIMIT ?",
            [$storeId, $days]
        );
    }

    // ── Goals ────────────────────────────────────────────────────────────────

    public function getGoals(array $filters = []): array
    {
        if (!$this->db->tableExists('goals')) {
            return [];
        }

        $where = ['1=1'];
        $params = [];

        if (!empty($filters['type'])) { $where[] = 'type = ?'; $params[] = $filters['type']; }
        if (!empty($filters['status'])) { $where[] = 'status = ?'; $params[] = $filters['status']; }
        if (!empty($filters['quarter'])) { $where[] = 'quarter = ?'; $params[] = $filters['quarter']; }
        if (!empty($filters['owner_id'])) { $where[] = 'owner_id = ?'; $params[] = $filters['owner_id']; }

        return $this->db->fetchAll(
            "SELECT g.*, u.name AS owner_name
             FROM goals g LEFT JOIN users u ON u.id = g.owner_id
             WHERE " . implode(' AND ', $where) . "
             ORDER BY g.status = 'active' DESC, g.ends_at ASC",
            $params
        );
    }

    public function createGoal(array $data): int
    {
        if (!$this->db->tableExists('goals')) {
            return 0;
        }

        return $this->db->insert('goals', [
            'title'        => $data['title'],
            'description'  => $data['description'] ?? null,
            'type'         => $data['type'] ?? 'company',
            'scope_id'     => $data['scope_id'] ?? null,
            'owner_id'     => $data['owner_id'] ?? null,
            'metric_key'   => $data['metric_key'] ?? null,
            'target_value' => $data['target_value'] ?? null,
            'quarter'      => $data['quarter'] ?? null,
            'starts_at'    => $data['starts_at'] ?? null,
            'ends_at'      => $data['ends_at'] ?? null,
        ]);
    }

    public function updateGoalProgress(int $goalId): void
    {
        if (!$this->db->tableExists('goals') || !$this->db->tableExists('store_kpis')) {
            return;
        }

        $goal = $this->db->fetch("SELECT * FROM goals WHERE id = ?", [$goalId]);
        if (!$goal || !$goal['metric_key'] || !$goal['target_value']) return;

        // Auto-calculate current value based on metric_key
        $current = $this->resolveMetricValue($goal['metric_key'], $goal['type'], $goal['scope_id']);
        if ($current === null) return;

        $progress = min(100, round(($current / (float)$goal['target_value']) * 100, 2));
        $status = $progress >= 100 ? 'completed' : $goal['status'];

        $this->db->update('goals', [
            'current_value' => $current,
            'progress_pct'  => $progress,
            'status'        => $status,
        ], 'id = ?', [$goalId]);
    }

    private function resolveMetricValue(string $key, string $type, ?int $scopeId): ?float
    {
        if (!$this->db->tableExists('store_kpis')) {
            return null;
        }

        $latestDate = $this->db->fetch("SELECT MAX(date) AS d FROM store_kpis")['d'] ?? null;
        if (!$latestDate) return null;

        $storeFilter = '';
        $params = [$latestDate];

        if ($type === 'store' && $scopeId) {
            $storeFilter = 'AND store_id = ?';
            $params[] = $scopeId;
        } elseif ($type === 'region' && $scopeId) {
            $storeFilter = 'AND store_id IN (SELECT id FROM stores WHERE region_id = ?)';
            $params[] = $scopeId;
        }

        $validKeys = ['task_completion_pct', 'overdue_pct', 'audit_score', 'store_health_score', 'incident_count', 'training_compliance_pct'];
        if (!in_array($key, $validKeys)) return null;

        $row = $this->db->fetch(
            "SELECT AVG({$key}) AS val FROM store_kpis WHERE date = ? {$storeFilter}",
            $params
        );
        return $row['val'] !== null ? round((float)$row['val'], 2) : null;
    }
}
