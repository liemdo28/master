<?php
/**
 * RiskSnapshotBuilder — compute and persist system-wide risk scores.
 *
 * Called by cron every cycle. Produces one row in risk_snapshots that
 * the web/mobile layer can read cheaply without re-running heavy queries.
 *
 * Score ranges: 0 (no risk) → 100 (critical).
 * Unified = finance*0.40 + operations*0.35 + compliance*0.25
 */
class RiskSnapshotBuilder {
    private $db;

    // Compliance vendor keywords (mirrors ComplianceEngine)
    private const COMPLIANCE_VENDORS = [
        'cdtfa','ftb','irs','edd','boe','sec',
        'ca tax','sales tax','payroll tax','state tax','federal',
    ];
    private const COMPLIANCE_CATEGORIES = ['tax', 'payroll'];

    // Snapshot stays fresh for 65 minutes (slightly longer than cron interval)
    private const STALE_MINUTES = 65;

    public function __construct() {
        $this->db = Database::getInstance();
        $this->ensureTables();
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Build snapshot and persist. Returns the snapshot array.
     */
    public function build(): array {
        $today = date('Y-m-d');

        $finance     = $this->calcFinanceRisk($today);
        $operations  = $this->calcOperationsRisk($today);
        $compliance  = $this->calcComplianceRisk($today);

        $unified = round(
            $finance['score']    * 0.40 +
            $operations['score'] * 0.35 +
            $compliance['score'] * 0.25,
            2
        );

        $now        = date('Y-m-d H:i:s');
        $staleAfter = date('Y-m-d H:i:s', strtotime('+' . self::STALE_MINUTES . ' minutes'));

        $snapshot = [
            'generated_at'          => $now,
            'unified_risk_score'    => $unified,
            'finance_risk_score'    => $finance['score'],
            'operations_risk_score' => $operations['score'],
            'compliance_risk_score' => $compliance['score'],
            'top_business_at_risk'  => $finance['top_business'] ?? $operations['top_business'] ?? null,
            'top_member_at_risk'    => $operations['top_member'] ?? null,
            'top_finance_risk'      => $finance['top_item'] ?? null,
            'summary_json'          => json_encode([
                'finance'    => $finance,
                'operations' => $operations,
                'compliance' => $compliance,
            ], JSON_UNESCAPED_UNICODE),
            'stale_after'           => $staleAfter,
        ];

        $this->db->insert(
            "INSERT INTO risk_snapshots
               (generated_at, unified_risk_score, finance_risk_score, operations_risk_score,
                compliance_risk_score, top_business_at_risk, top_member_at_risk,
                top_finance_risk, summary_json, stale_after)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                $snapshot['generated_at'],
                $snapshot['unified_risk_score'],
                $snapshot['finance_risk_score'],
                $snapshot['operations_risk_score'],
                $snapshot['compliance_risk_score'],
                $snapshot['top_business_at_risk'],
                $snapshot['top_member_at_risk'],
                $snapshot['top_finance_risk'],
                $snapshot['summary_json'],
                $snapshot['stale_after'],
            ]
        );

        // Prune old snapshots — keep last 48 rows (2 days at hourly)
        $this->db->execute(
            "DELETE FROM risk_snapshots WHERE id NOT IN (
               SELECT id FROM (SELECT id FROM risk_snapshots ORDER BY generated_at DESC LIMIT 48) t
             )"
        );

        return $snapshot;
    }

    /**
     * Get the latest snapshot (read-only, no recompute).
     */
    public function latest(): ?array {
        return $this->db->fetch(
            "SELECT * FROM risk_snapshots ORDER BY generated_at DESC LIMIT 1"
        ) ?: null;
    }

    // ── Finance risk ──────────────────────────────────────────────────────────

    private function calcFinanceRisk(string $today): array {
        if (!$this->db->tableExists('bills')) {
            return ['score' => 0, 'overdue_count' => 0, 'top_business' => null, 'top_item' => null];
        }

        $overdueBills = $this->db->fetchAll(
            "SELECT b.id, b.title, b.amount, b.due_date, b.status,
                    DATEDIFF(?, b.due_date) AS days_overdue,
                    s.name AS store_name
             FROM bills b
             LEFT JOIN stores s ON b.store_id = s.id
             WHERE b.due_date < ?
               AND b.status NOT IN ('paid')
               AND (b.is_template IS NULL OR b.is_template = 0)
               AND (b.is_test IS NULL OR b.is_test = 0)
             ORDER BY b.amount DESC, days_overdue DESC
             LIMIT 50",
            [$today, $today]
        );

        if (empty($overdueBills)) {
            return ['score' => 0, 'overdue_count' => 0, 'top_business' => null, 'top_item' => null];
        }

        $score = 0;
        foreach ($overdueBills as $bill) {
            $days   = max(1, (int)$bill['days_overdue']);
            $amount = (float)($bill['amount'] ?? 0);

            // Base: days overdue (up to 30 pts)
            $pts = min(30, $days * 3);
            // Amount factor (+5 to +20)
            if ($amount >= 10000) $pts += 20;
            elseif ($amount >= 1000) $pts += 10;
            elseif ($amount > 0) $pts += 5;

            $score += $pts;
        }

        $score = min(100, $score);

        // Top business = store with most overdue bill value
        $topBusiness = null;
        $topItem     = null;
        $byStore     = [];
        foreach ($overdueBills as $b) {
            $name = $b['store_name'] ?? 'Unknown';
            $byStore[$name] = ($byStore[$name] ?? 0) + (float)$b['amount'];
            if (!$topItem) $topItem = $b['title'] . ($b['days_overdue'] > 1 ? ' (' . $b['days_overdue'] . 'd overdue)' : ' (overdue)');
        }
        if ($byStore) {
            arsort($byStore);
            $topBusiness = array_key_first($byStore);
        }

        return [
            'score'        => round($score, 2),
            'overdue_count'=> count($overdueBills),
            'top_business' => $topBusiness,
            'top_item'     => $topItem,
            'items'        => array_slice($overdueBills, 0, 5),
        ];
    }

    // ── Operations risk ───────────────────────────────────────────────────────

    private function calcOperationsRisk(string $today): array {
        if (!$this->db->tableExists('tasks')) {
            return ['score' => 0, 'overdue_count' => 0, 'top_member' => null, 'top_business' => null];
        }

        $overdueTasks = $this->db->fetchAll(
            "SELECT t.id, t.title, t.priority, t.due_date, t.assignee_id,
                    DATEDIFF(?, t.due_date) AS days_overdue,
                    u.name AS assignee_name,
                    p.name AS project_name
             FROM tasks t
             LEFT JOIN users u ON t.assignee_id = u.id
             LEFT JOIN projects p ON t.project_id = p.id
             WHERE t.due_date < ?
               AND t.is_completed = 0
               AND t.status NOT IN ('done')
             ORDER BY days_overdue DESC, t.priority DESC
             LIMIT 100",
            [$today, $today]
        );

        if (empty($overdueTasks)) {
            return ['score' => 0, 'overdue_count' => 0, 'top_member' => null, 'top_business' => null];
        }

        // Per-assignee overload
        $byAssignee = [];
        foreach ($overdueTasks as $t) {
            $name = $t['assignee_name'] ?? 'Unassigned';
            $byAssignee[$name] = ($byAssignee[$name] ?? 0) + 1;
        }
        arsort($byAssignee);
        $topMember = array_key_first($byAssignee);

        // Score: each overdue task contributes based on priority + days
        $priorityWeight = ['urgent' => 5, 'high' => 3, 'medium' => 2, 'low' => 1];
        $score = 0;
        foreach ($overdueTasks as $t) {
            $pw   = $priorityWeight[$t['priority'] ?? 'medium'] ?? 2;
            $days = max(1, (int)$t['days_overdue']);
            $score += $pw + min(10, $days);
        }
        $score = min(100, round($score / 3, 2)); // normalize

        return [
            'score'         => $score,
            'overdue_count' => count($overdueTasks),
            'top_member'    => $topMember,
            'top_business'  => null, // tasks not always mapped to business
            'by_assignee'   => array_slice($byAssignee, 0, 5, true),
        ];
    }

    // ── Compliance risk ───────────────────────────────────────────────────────

    private function calcComplianceRisk(string $today): array {
        if (!$this->db->tableExists('bills')) {
            return ['score' => 0, 'overdue_count' => 0, 'due_soon_count' => 0];
        }

        $catPlaceholders = implode(',', array_fill(0, count(self::COMPLIANCE_CATEGORIES), '?'));
        $vendorLikes     = implode(' OR ', array_map(fn($v) => "b.vendor LIKE ?", self::COMPLIANCE_VENDORS));

        $params = array_merge(
            [$today, date('Y-m-d', strtotime('+7 days'))],
            self::COMPLIANCE_CATEGORIES,
            array_map(fn($v) => "%{$v}%", self::COMPLIANCE_VENDORS)
        );

        $complianceBills = $this->db->fetchAll(
            "SELECT b.id, b.title, b.due_date, b.amount, b.status,
                    DATEDIFF(?, b.due_date) AS days_overdue,
                    s.name AS store_name
             FROM bills b
             LEFT JOIN stores s ON b.store_id = s.id
             WHERE b.status NOT IN ('paid')
               AND (b.is_template IS NULL OR b.is_template = 0)
               AND (b.is_test IS NULL OR b.is_test = 0)
               AND (
                 b.due_date <= ?
                 AND (
                   b.category IN ({$catPlaceholders})
                   OR ({$vendorLikes})
                 )
               )
             ORDER BY b.due_date ASC
             LIMIT 30",
            array_merge([$today, date('Y-m-d', strtotime('+7 days'))], self::COMPLIANCE_CATEGORIES,
                        array_map(fn($v) => "%{$v}%", self::COMPLIANCE_VENDORS))
        );

        // Simpler query if the above fails due to complex binding
        if ($complianceBills === false || $complianceBills === null) {
            $complianceBills = $this->db->fetchAll(
                "SELECT b.id, b.title, b.due_date, b.amount, b.status,
                        DATEDIFF(?, b.due_date) AS days_overdue,
                        s.name AS store_name
                 FROM bills b
                 LEFT JOIN stores s ON b.store_id = s.id
                 WHERE b.status NOT IN ('paid')
                   AND (b.is_template IS NULL OR b.is_template = 0)
                   AND (b.is_test IS NULL OR b.is_test = 0)
                   AND b.category IN ('tax','payroll')
                   AND b.due_date <= ?
                 ORDER BY b.due_date ASC
                 LIMIT 30",
                [$today, date('Y-m-d', strtotime('+7 days'))]
            ) ?: [];
        }

        $score       = 0;
        $overdueCount = 0;
        $dueSoonCount = 0;

        foreach ($complianceBills as $b) {
            $days = (int)$b['days_overdue']; // positive = overdue, negative = future
            if ($days > 0) {
                $overdueCount++;
                $score += 30 + min(20, $days * 3);
            } elseif ($days >= -3) {
                $dueSoonCount++;
                $score += 15;
            } else {
                $dueSoonCount++;
                $score += 5;
            }
        }

        return [
            'score'          => min(100, round($score, 2)),
            'overdue_count'  => $overdueCount,
            'due_soon_count' => $dueSoonCount,
            'items'          => array_slice($complianceBills, 0, 5),
        ];
    }

    // ── Schema ────────────────────────────────────────────────────────────────

    private function ensureTables(): void {
        if ($this->db->tableExists('risk_snapshots')) return;
        try {
            $sql = file_get_contents(__DIR__ . '/../database/migrations/phase3_intelligence.sql');
            foreach (array_filter(array_map('trim', explode(';', $sql))) as $stmt) {
                $this->db->execute($stmt);
            }
            $this->db->invalidateSchemaCache();
        } catch (\Throwable $e) {
            error_log('[RiskSnapshotBuilder::ensureTables] ' . $e->getMessage());
        }
    }
}
