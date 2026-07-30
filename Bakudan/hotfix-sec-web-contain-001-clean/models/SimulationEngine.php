<?php
/**
 * SimulationEngine V4 — Before/After State Comparison
 *
 * Simulates the organizational state before and after applying a Decision or Plan.
 * Reads live DB state for "before" and projects "after" based on plan actions.
 *
 * Usage:
 *   $engine = new SimulationEngine();
 *   $result = $engine->simulate($plan);
 *   // → ['before' => [...], 'after' => [...], 'delta' => [...]]
 */
class SimulationEngine
{
    private $db;
    private string $today;

    public function __construct($db = null)
    {
        $this->db    = $db ?? Database::getInstance();
        $this->today = app_today();
    }

    /**
     * Simulate applying a rebalance plan.
     *
     * @param  array $plan  Output from SmartEngine::rebalancePlan() or buildPlanFromCandidates()
     * @return array{before: array, after: array, delta: array, feasible: bool}
     */
    public function simulate(array $plan): array
    {
        // ── Before: live state ────────────────────────────────────────────
        $before = $this->liveState();

        if (!($plan['has_plan'] ?? false) || empty($plan['actions'])) {
            return [
                'before'   => $before,
                'after'    => $before,
                'delta'    => $this->emptyDelta(),
                'feasible' => false,
                'reason'   => 'No valid plan to simulate',
            ];
        }

        // ── After: projected state ────────────────────────────────────────
        $totalMoving    = (int)($plan['total_moving'] ?? 0);
        $overdueReduced = (int)($plan['overdue_reduced'] ?? 0);

        $afterOverdue = max(0, $before['total_overdue'] - $overdueReduced);
        $afterRisk    = $this->projectRiskLevel($afterOverdue, $before['total_open']);

        // Project member states
        $membersBefore = $before['members'];
        $membersAfter  = $this->projectMemberStates($membersBefore, $plan['actions'] ?? []);

        $after = [
            'total_overdue'    => $afterOverdue,
            'total_open'       => $before['total_open'],
            'risk_level'       => $afterRisk,
            'overloaded_count' => count(array_filter($membersAfter, fn($m) => $m['risk'] === 'critical' || $m['risk'] === 'behind')),
            'members'          => $membersAfter,
            'generated_at'     => date('Y-m-d H:i:s'),
        ];

        // ── Delta ─────────────────────────────────────────────────────────
        $delta = [
            'overdue_change'    => $afterOverdue - $before['total_overdue'],      // negative = improvement
            'overloaded_change' => $after['overloaded_count'] - $before['overloaded_count'],
            'risk_improved'     => $this->riskRank($afterRisk) < $this->riskRank($before['risk_level']),
            'tasks_moved'       => $totalMoving,
            'overdue_reduced'   => $overdueReduced,
            'risk_before'       => $before['risk_level'],
            'risk_after'        => $afterRisk,
        ];

        return [
            'before'   => $before,
            'after'    => $after,
            'delta'    => $delta,
            'feasible' => true,
        ];
    }

    /**
     * Simulate clearing overdue bills — projects financial state.
     */
    public function simulateBillPayment(int $billCount = 0): array
    {
        $bills = $this->db->fetchAll(
            "SELECT id, title, amount, due_date FROM bills
             WHERE status = 'overdue' OR (status = 'pending' AND due_date < ?)
             ORDER BY due_date ASC",
            [$this->today]
        );
        $total = count($bills);
        $amount = array_sum(array_column($bills, 'amount'));

        $before = ['overdue_bills' => $total, 'overdue_amount' => $amount, 'risk' => $total >= 3 ? 'critical' : 'high'];
        $paying = $billCount > 0 ? min($billCount, $total) : $total;
        $paidAmount = 0;
        foreach (array_slice($bills, 0, $paying) as $b) { $paidAmount += (float)$b['amount']; }

        $afterTotal  = $total - $paying;
        $afterAmount = $amount - $paidAmount;
        $after = ['overdue_bills' => $afterTotal, 'overdue_amount' => $afterAmount, 'risk' => $afterTotal >= 3 ? 'critical' : ($afterTotal > 0 ? 'high' : 'clear')];

        return [
            'before'          => $before,
            'after'           => $after,
            'bills_paying'    => $paying,
            'amount_clearing' => $paidAmount,
            'delta'           => ['bills_cleared' => $paying, 'amount_cleared' => $paidAmount, 'risk_improved' => $afterTotal < $total],
            'feasible'        => $paying > 0,
        ];
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /** Read current live organizational state from DB. */
    private function liveState(): array
    {
        $agg = $this->db->fetch(
            "SELECT
                SUM(CASE WHEN t.is_completed=0 AND t.due_date < ? THEN 1 ELSE 0 END) AS overdue,
                SUM(CASE WHEN t.is_completed=0 THEN 1 ELSE 0 END) AS open
             FROM tasks t",
            [$this->today]
        );
        $totalOverdue = (int)($agg['overdue'] ?? 0);
        $totalOpen    = (int)($agg['open'] ?? 0);

        $members = $this->db->fetchAll(
            "SELECT u.id, u.name,
                    SUM(CASE WHEN t.is_completed=0 AND t.due_date < ? THEN 1 ELSE 0 END) AS overdue,
                    SUM(CASE WHEN t.is_completed=0 THEN 1 ELSE 0 END) AS open
             FROM users u
             LEFT JOIN tasks t ON t.assignee_id = u.id
             WHERE u.is_active = 1
             GROUP BY u.id, u.name",
            [$this->today]
        );

        $memberStates = [];
        $overloadedCount = 0;
        foreach ($members as $m) {
            $ov   = (int)$m['overdue'];
            $risk = $ov >= 5 ? 'critical' : ($ov >= 3 ? 'behind' : ($ov >= 1 ? 'watch' : 'stable'));
            if (in_array($risk, ['critical','behind'])) $overloadedCount++;
            $memberStates[] = ['id'=>(int)$m['id'], 'name'=>$m['name'], 'overdue'=>$ov, 'open'=>(int)$m['open'], 'risk'=>$risk];
        }

        return [
            'total_overdue'    => $totalOverdue,
            'total_open'       => $totalOpen,
            'risk_level'       => $this->projectRiskLevel($totalOverdue, $totalOpen),
            'overloaded_count' => $overloadedCount,
            'members'          => $memberStates,
            'generated_at'     => date('Y-m-d H:i:s'),
        ];
    }

    /** Project member states after plan actions are applied. */
    private function projectMemberStates(array $members, array $actions): array
    {
        // Build index by user_id
        $idx = [];
        foreach ($members as $m) { $idx[$m['id']] = $m; }

        foreach ($actions as $action) {
            $fromId = (int)($action['from_user_id'] ?? 0);
            $toId   = (int)($action['to_user_id']   ?? 0);
            $count  = (int)($action['task_count']    ?? 0);
            $ov     = (int)($action['overdue_count'] ?? 0);

            if (isset($idx[$fromId])) {
                $idx[$fromId]['overdue'] = max(0, $idx[$fromId]['overdue'] - $ov);
                $idx[$fromId]['open']    = max(0, $idx[$fromId]['open']    - $count);
            }
            if (isset($idx[$toId])) {
                $idx[$toId]['open'] = $idx[$toId]['open'] + $count;
            }
        }

        // Recalculate risk
        foreach ($idx as &$m) {
            $ov = $m['overdue'];
            $m['risk'] = $ov >= 5 ? 'critical' : ($ov >= 3 ? 'behind' : ($ov >= 1 ? 'watch' : 'stable'));
        }
        unset($m);

        return array_values($idx);
    }

    private function projectRiskLevel(int $overdue, int $open): string
    {
        if ($overdue >= 10) return 'critical';
        if ($overdue >= 5)  return 'high';
        if ($overdue >= 2)  return 'watch';
        return 'stable';
    }

    private function riskRank(string $level): int
    {
        return match($level) { 'critical'=>4, 'high'=>3, 'watch'=>2, 'stable'=>1, default=>0 };
    }

    private function emptyDelta(): array
    {
        return ['overdue_change'=>0,'overloaded_change'=>0,'risk_improved'=>false,'tasks_moved'=>0,'overdue_reduced'=>0,'risk_before'=>'unknown','risk_after'=>'unknown'];
    }
}
