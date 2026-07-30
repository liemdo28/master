<?php
/**
 * UnifiedRiskEngine — Single risk score combining Finance + Operations + Compliance
 * Top-level risk signal for CEO + CFO.
 * Score 0-100. Level: low/medium/high/critical
 */
class UnifiedRiskEngine
{
    private $db;
    private string $today;
    private FinanceIntelligenceEngine $finance;
    private ComplianceEngine $compliance;

    public function __construct()
    {
        $this->db         = Database::getInstance();
        $this->today      = app_today();
        $this->finance    = new FinanceIntelligenceEngine();
        $this->compliance = new ComplianceEngine();
    }

    /**
     * Full risk assessment.
     * Weights: finance=40%, operations=35%, compliance=25%
     */
    public function assess(): array
    {
        try {
            $fin  = $this->scoreFinance();
            $ops  = $this->scoreOperations();
            $comp = $this->scoreCompliance();

            $total = (int)round(
                $fin['score']  * 0.40 +
                $ops['score']  * 0.35 +
                $comp['score'] * 0.25
            );
            $total = min(100, max(0, $total));

            // Determine top driver (highest raw score wins)
            $topDriver = '';
            $highest   = -1;
            foreach ([
                'finance'    => $fin,
                'operations' => $ops,
                'compliance' => $comp,
            ] as $key => $section) {
                if ($section['score'] > $highest) {
                    $highest   = $section['score'];
                    $topDriver = !empty($section['drivers']) ? $section['drivers'][0] : ucfirst($key) . ' risk elevated';
                }
            }

            return [
                'total'     => $total,
                'level'     => $this->scoreToLevel($total),
                'breakdown' => [
                    'finance'    => $fin,
                    'operations' => $ops,
                    'compliance' => $comp,
                ],
                'top_driver' => $topDriver,
            ];
        } catch (Exception $e) {
            return [
                'total'     => 0,
                'level'     => 'low',
                'breakdown' => [
                    'finance'    => ['score' => 0, 'level' => 'low', 'drivers' => []],
                    'operations' => ['score' => 0, 'level' => 'low', 'drivers' => []],
                    'compliance' => ['score' => 0, 'level' => 'low', 'drivers' => []],
                ],
                'top_driver' => '',
            ];
        }
    }

    /**
     * Finance risk score 0-100 based on overdue amounts, counts, and due-today pressure.
     */
    private function scoreFinance(): array
    {
        try {
            $timeline = $this->finance->getCashTimeline();
            $vendors  = $this->finance->getVendorIntelligence();
            $drivers  = [];
            $score    = 0;

            // Overdue amount: each $1000 = +5pts, cap 40
            $overdueAmount = (float)$timeline['overdue']['amount'];
            $amountPts     = min(40, (int)floor($overdueAmount / 1000) * 5);
            $score        += $amountPts;
            if ($amountPts > 0) {
                $drivers[] = sprintf('$%s overdue across %d bill(s)',
                    number_format($overdueAmount, 0),
                    $timeline['overdue']['count']
                );
            }

            // Overdue bill count: each = +8pts, cap 30
            $overdueCount = (int)$timeline['overdue']['count'];
            $countPts     = min(30, $overdueCount * 8);
            $score       += $countPts;
            if ($overdueCount > 0 && empty($drivers)) {
                $drivers[] = "{$overdueCount} overdue bill(s) require immediate attention";
            }

            // Due today count: each = +5pts, cap 20
            $todayCount = (int)$timeline['today']['count'];
            $todayPts   = min(20, $todayCount * 5);
            $score     += $todayPts;
            if ($todayCount > 0) {
                $drivers[] = "{$todayCount} bill(s) due today totaling $" . number_format((float)$timeline['today']['amount'], 0);
            }

            // Critical vendor overdue = +10pts
            $hasCriticalVendor = false;
            foreach ($vendors as $v) {
                if ($v['risk_level'] === 'critical') {
                    $hasCriticalVendor = true;
                    break;
                }
            }
            if ($hasCriticalVendor) {
                $score    += 10;
                $drivers[] = 'Critical vendor(s) with overdue balance';
            }

            $score   = min(100, $score);
            $drivers = array_slice($drivers, 0, 3);

            return [
                'score'   => $score,
                'level'   => $this->scoreToLevel($score),
                'drivers' => $drivers,
            ];
        } catch (Exception $e) {
            return ['score' => 0, 'level' => 'low', 'drivers' => []];
        }
    }

    /**
     * Operations risk score 0-100 based on task overdue counts, overloaded members, at-risk stores.
     */
    private function scoreOperations(): array
    {
        try {
            $score   = 0;
            $drivers = [];

            // Overdue tasks: each = +2pts, cap 40
            $overdueTasks = $this->db->fetch(
                "SELECT COUNT(*) AS cnt
                 FROM tasks
                 WHERE is_completed = 0
                   AND status != 'completed'
                   AND due_date < ?",
                [$this->today]
            );
            $overdueTaskCount = (int)($overdueTasks['cnt'] ?? 0);
            $overduePts       = min(40, $overdueTaskCount * 2);
            $score           += $overduePts;
            if ($overdueTaskCount > 0) {
                $drivers[] = "{$overdueTaskCount} overdue task(s) across the organization";
            }

            // Overloaded members (>5 open tasks): each = +10pts, cap 30
            $overloaded = $this->db->fetchAll(
                "SELECT assignee_id, COUNT(*) AS open_count
                 FROM tasks
                 WHERE is_completed = 0
                   AND status != 'completed'
                   AND assignee_id IS NOT NULL
                 GROUP BY assignee_id
                 HAVING open_count > 5"
            );
            $overloadedCount = count($overloaded);
            $overloadPts     = min(30, $overloadedCount * 10);
            $score          += $overloadPts;
            if ($overloadedCount > 0) {
                $drivers[] = "{$overloadedCount} team member(s) overloaded (>5 open tasks)";
            }

            // Stores with 3+ overdue tasks: each = +10pts, cap 20
            $storeOverdue = $this->db->fetchAll(
                "SELECT t.project_id, COUNT(*) AS overdue_cnt
                 FROM tasks t
                 WHERE t.is_completed = 0
                   AND t.status != 'completed'
                   AND t.due_date < ?
                   AND t.project_id IS NOT NULL
                 GROUP BY t.project_id
                 HAVING overdue_cnt >= 3",
                [$this->today]
            );
            $atRiskStoreCount = count($storeOverdue);
            $storeOverduePts  = min(20, $atRiskStoreCount * 10);
            $score           += $storeOverduePts;
            if ($atRiskStoreCount > 0) {
                $drivers[] = "{$atRiskStoreCount} project(s) with 3+ overdue tasks";
            }

            // Stores with completion rate < 50%: each = +5pts, cap 10
            $completionStats = $this->db->fetchAll(
                "SELECT project_id,
                        SUM(is_completed) AS completed_cnt,
                        COUNT(*) AS total_cnt
                 FROM tasks
                 WHERE project_id IS NOT NULL
                 GROUP BY project_id
                 HAVING total_cnt >= 5 AND (completed_cnt / total_cnt) < 0.5"
            );
            $lowCompletionCount = count($completionStats);
            $completionPts      = min(10, $lowCompletionCount * 5);
            $score             += $completionPts;
            if ($lowCompletionCount > 0) {
                $drivers[] = "{$lowCompletionCount} project(s) with completion rate below 50%";
            }

            $score   = min(100, $score);
            $drivers = array_slice($drivers, 0, 3);

            return [
                'score'   => $score,
                'level'   => $this->scoreToLevel($score),
                'drivers' => $drivers,
            ];
        } catch (Exception $e) {
            return ['score' => 0, 'level' => 'low', 'drivers' => []];
        }
    }

    /**
     * Compliance risk delegated to ComplianceEngine.
     */
    private function scoreCompliance(): array
    {
        try {
            $risk    = $this->compliance->getComplianceRisk();
            $overdue = $this->compliance->getOverdueFilings();
            $drivers = [];

            if ($risk['overdue_count'] > 0) {
                $drivers[] = "{$risk['overdue_count']} overdue compliance filing(s)";
            }
            if ($risk['due_soon_count'] > 0) {
                $drivers[] = "{$risk['due_soon_count']} compliance filing(s) due within 7 days";
            }
            if (!empty($overdue)) {
                $topOverdue = $overdue[0];
                $daysAgo    = abs($topOverdue['days_until']);
                $drivers[]  = "'{$topOverdue['title']}' is {$daysAgo} day(s) overdue";
            }

            return [
                'score'   => $risk['score'],
                'level'   => $risk['level'],
                'drivers' => array_slice($drivers, 0, 3),
            ];
        } catch (Exception $e) {
            return ['score' => 0, 'level' => 'low', 'drivers' => []];
        }
    }

    /**
     * Convert numeric score to level string.
     */
    private function scoreToLevel(int $score): string
    {
        return match(true) {
            $score >= 81 => 'critical',
            $score >= 61 => 'high',
            $score >= 31 => 'medium',
            default      => 'low',
        };
    }
}
