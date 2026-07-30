<?php
/**
 * DecisionFeedBuilder — build ranked decision feed from latest risk data.
 *
 * Reads risk_snapshots + live source data to produce a prioritised list of
 * "what is worth acting on next" for each role (ceo, cfo, manager, staff).
 *
 * Rules:
 *  - max 3 decisions for CEO/CFO home
 *  - max 5 for manager view
 *  - max 3 for staff view
 *  - no low-impact noise
 *  - dedupe same business/issue
 */
class DecisionFeedBuilder {
    private $db;

    private const STALE_MINUTES = 65;

    // Minimum impact score to include in feed
    private const MIN_IMPACT_SCORE = 30;

    // Compliance keywords (mirrors RiskSnapshotBuilder)
    private const COMPLIANCE_CATEGORIES = ['tax', 'payroll'];

    public function __construct() {
        $this->db = Database::getInstance();
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Build and persist the decision feed. Replaces previous active items.
     * Returns count of decisions written.
     */
    public function build(): int {
        $today    = date('Y-m-d');
        $now      = date('Y-m-d H:i:s');
        $staleAt  = date('Y-m-d H:i:s', strtotime('+' . self::STALE_MINUTES . ' minutes'));

        $candidates = array_merge(
            $this->financeDecisions($today),
            $this->complianceDecisions($today),
            $this->operationsDecisions($today),
            $this->penaltyDecisions($today)
        );

        // Sort descending by impact_score
        usort($candidates, fn($a, $b) => $b['impact_score'] <=> $a['impact_score']);

        // Dedupe by decision_id
        $seen    = [];
        $final   = [];
        foreach ($candidates as $c) {
            if (isset($seen[$c['decision_id']])) continue;
            if ($c['impact_score'] < self::MIN_IMPACT_SCORE) continue;
            $seen[$c['decision_id']] = true;
            $final[] = $c;
        }

        // Deactivate old feed
        $this->db->execute("UPDATE decision_feed SET is_active = 0 WHERE is_active = 1");

        // Insert new
        $count = 0;
        foreach ($final as $d) {
            $this->db->insert(
                "INSERT INTO decision_feed
                   (decision_id, role_scope_json, type, title, impact_level, impact_score,
                    confidence_score, deadline_label, ignored_effect, cta_type, cta_target_id,
                    business_name, generated_at, stale_after, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)",
                [
                    $d['decision_id'],
                    json_encode($d['role_scope']),
                    $d['type'],
                    $d['title'],
                    $d['impact_level'],
                    $d['impact_score'],
                    $d['confidence'] ?? null,
                    $d['deadline_label'] ?? null,
                    $d['ignored_effect'] ?? null,
                    $d['cta_type'],
                    $d['cta_target_id'] ?? null,
                    $d['business_name'] ?? null,
                    $now,
                    $staleAt,
                ]
            );
            $count++;
        }

        // Prune rows older than 7 days
        $this->db->execute(
            "DELETE FROM decision_feed WHERE generated_at < DATE_SUB(NOW(), INTERVAL 7 DAY)"
        );

        return $count;
    }

    /**
     * Get active feed for a given role, capped by limit.
     */
    public function getForRole(string $role, int $limit = 5): array {
        $rows = $this->db->fetchAll(
            "SELECT * FROM decision_feed
             WHERE is_active = 1
             ORDER BY impact_score DESC
             LIMIT 50"
        ) ?: [];

        $isSuperRole = in_array($role, ['admin', 'ceo']); // admin/CEO sees everything

        $result = [];
        foreach ($rows as $row) {
            $roles = json_decode($row['role_scope_json'] ?? '[]', true) ?: [];
            if ($isSuperRole || in_array($role, $roles) || in_array('all', $roles)) {
                $row['role_scope'] = $roles;
                unset($row['role_scope_json']);
                $result[] = $row;
            }
            if (count($result) >= $limit) break;
        }

        return $result;
    }

    // ── Finance decisions ─────────────────────────────────────────────────────

    private function financeDecisions(string $today): array {
        if (!$this->db->tableExists('bills')) return [];

        $bills = $this->db->fetchAll(
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
             LIMIT 20",
            [$today, $today]
        ) ?: [];

        $decisions = [];
        foreach ($bills as $b) {
            $days   = max(1, (int)$b['days_overdue']);
            $amount = (float)($b['amount'] ?? 0);
            $store  = $b['store_name'] ?? 'Unknown';
            $title  = $b['title'];

            $score = min(100, 40 + ($days * 3) + ($amount >= 10000 ? 20 : ($amount >= 1000 ? 10 : 5)));

            $decisions[] = [
                'decision_id'   => 'pay_bill_' . $b['id'],
                'role_scope'    => ['ceo', 'cfo'],
                'type'          => 'finance',
                'title'         => "Pay {$title}",
                'impact_level'  => $score >= 80 ? 'critical' : ($score >= 60 ? 'high' : 'medium'),
                'impact_score'  => $score,
                'confidence'    => 0.95,
                'deadline_label'=> $days . ' day' . ($days > 1 ? 's' : '') . ' overdue',
                'ignored_effect'=> $amount > 0 ? '$' . number_format($amount, 0) . ' exposure + penalty risk' : 'Penalty risk',
                'cta_type'      => 'pay_bill',
                'cta_target_id' => (string)$b['id'],
                'business_name' => $store,
            ];
        }

        return $decisions;
    }

    // ── Compliance decisions ──────────────────────────────────────────────────

    private function complianceDecisions(string $today): array {
        if (!$this->db->tableExists('bills')) return [];

        $soon = date('Y-m-d', strtotime('+7 days'));

        $bills = $this->db->fetchAll(
            "SELECT b.id, b.title, b.amount, b.due_date, b.status,
                    DATEDIFF(?, b.due_date) AS days_overdue,
                    s.name AS store_name
             FROM bills b
             LEFT JOIN stores s ON b.store_id = s.id
             WHERE b.status NOT IN ('paid')
               AND (b.is_template IS NULL OR b.is_template = 0)
               AND (b.is_test IS NULL OR b.is_test = 0)
               AND b.due_date <= ?
               AND b.category IN ('tax','payroll')
             ORDER BY b.due_date ASC
             LIMIT 10",
            [$today, $soon]
        ) ?: [];

        $decisions = [];
        foreach ($bills as $b) {
            $days  = (int)$b['days_overdue']; // positive = overdue
            $store = $b['store_name'] ?? 'Unknown';

            if ($days > 0) {
                $score  = min(100, 70 + $days * 3);
                $label  = $days . ' day' . ($days > 1 ? 's' : '') . ' overdue';
                $effect = 'IRS/state penalty risk';
            } else {
                $daysLeft = abs($days);
                $score    = $daysLeft <= 3 ? 75 : 55;
                $label    = 'Due in ' . $daysLeft . ' day' . ($daysLeft != 1 ? 's' : '');
                $effect   = 'Compliance deadline missed → penalty';
            }

            $decisions[] = [
                'decision_id'   => 'compliance_' . $b['id'],
                'role_scope'    => ['ceo', 'cfo'],
                'type'          => 'compliance',
                'title'         => 'File / Pay: ' . $b['title'],
                'impact_level'  => $score >= 80 ? 'critical' : 'high',
                'impact_score'  => $score,
                'confidence'    => 0.98,
                'deadline_label'=> $label,
                'ignored_effect'=> $effect,
                'cta_type'      => 'pay_bill',
                'cta_target_id' => (string)$b['id'],
                'business_name' => $store,
            ];
        }

        return $decisions;
    }

    // ── Operations decisions ──────────────────────────────────────────────────

    private function operationsDecisions(string $today): array {
        if (!$this->db->tableExists('tasks')) return [];

        // Find assignees with 3+ overdue tasks = overload signal
        $overloaded = $this->db->fetchAll(
            "SELECT t.assignee_id,
                    u.name AS assignee_name,
                    COUNT(*) AS overdue_count,
                    MAX(DATEDIFF(?, t.due_date)) AS max_days_overdue
             FROM tasks t
             JOIN users u ON t.assignee_id = u.id
             WHERE t.due_date < ?
               AND t.is_completed = 0
               AND t.status NOT IN ('done')
               AND t.assignee_id IS NOT NULL
             GROUP BY t.assignee_id, u.name
             HAVING overdue_count >= 3
             ORDER BY overdue_count DESC
             LIMIT 5",
            [$today, $today]
        ) ?: [];

        $decisions = [];
        foreach ($overloaded as $member) {
            $count = (int)$member['overdue_count'];
            $name  = $member['assignee_name'];
            $score = min(100, 40 + ($count * 5) + min(20, (int)$member['max_days_overdue']));

            $decisions[] = [
                'decision_id'   => 'rebalance_' . $member['assignee_id'],
                'role_scope'    => ['ceo', 'manager'],
                'type'          => 'operations',
                'title'         => "Rebalance {$name}",
                'impact_level'  => $score >= 70 ? 'high' : 'medium',
                'impact_score'  => $score,
                'confidence'    => 0.80,
                'deadline_label'=> $count . ' overdue tasks',
                'ignored_effect'=> 'Execution delays in 48h',
                'cta_type'      => 'review_plan',
                'cta_target_id' => (string)$member['assignee_id'],
                'business_name' => null,
            ];
        }

        return $decisions;
    }

    // ── Penalty decisions ─────────────────────────────────────────────────────

    private function penaltyDecisions(string $today): array {
        if (!$this->db->tableExists('penalty_log')) return [];
        if (!$this->db->tableExists('users'))       return [];

        $monthStart = date('Y-m-01');

        // Per-user penalty summary for this month
        $rows = $this->db->fetchAll(
            "SELECT pl.user_id,
                    u.name AS user_name,
                    COUNT(pl.id)            AS penalty_count,
                    SUM(pl.penalty_amount)  AS total_amount
             FROM penalty_log pl
             JOIN users u ON u.id = pl.user_id
             WHERE pl.created_at >= ?
             GROUP BY pl.user_id, u.name
             HAVING penalty_count > 0
             ORDER BY penalty_count DESC, total_amount DESC
             LIMIT 10",
            [$monthStart . ' 00:00:00']
        ) ?: [];

        $decisions = [];
        foreach ($rows as $row) {
            $count  = (int)$row['penalty_count'];
            $amount = (float)$row['total_amount'];
            $name   = $row['user_name'];
            $uid    = (int)$row['user_id'];

            // +10 score if any penalty, +20 more if amount > 1,000,000
            $baseScore = 30 + ($count * 10);
            if ($amount > 1000000) $baseScore += 20;
            $score = min(100, $baseScore);

            // Only surface repeated offenders (2+ penalties) as decisions
            if ($count >= 2) {
                $decisions[] = [
                    'decision_id'   => 'penalty_review_' . $uid,
                    'role_scope'    => ['ceo', 'admin', 'manager'],
                    'type'          => 'performance',
                    'title'         => "Review repeated late tasks — {$name}",
                    'impact_level'  => $score >= 70 ? 'high' : 'medium',
                    'impact_score'  => $score,
                    'confidence'    => 0.90,
                    'deadline_label'=> $count . ' penalties this month',
                    'ignored_effect'=> 'Repeated late tasks are creating penalty cost and execution risk',
                    'cta_type'      => 'open_user_performance',
                    'cta_target_id' => (string)$uid,
                    'business_name' => null,
                ];
            }
        }

        return $decisions;
    }
}
