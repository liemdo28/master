<?php
/**
 * ImpactEngine V4 — Unified 4-Factor Impact Scoring
 *
 * Converts any Problem object into a single normalized impact_score (0–100)
 * using a weighted composite of four independent risk dimensions:
 *
 *   financial_risk   0.40 — unpaid obligations, vendor risk, penalty exposure
 *   deadline_urgency 0.30 — overdue count, due-today pressure, escalation speed
 *   team_blocking    0.20 — overload severity, downstream task risk, throughput
 *   trend_risk       0.10 — repeated delays, worsening pattern, historical signal
 *
 * Usage:
 *   $engine = new ImpactEngine();
 *   $scored = $engine->score($problem);   // adds impact_score, impact_level
 *   $batch  = $engine->scoreBatch($problems); // score array of problems
 */
class ImpactEngine
{
    // Dimension weights — sum to 1.0
    private array $weights = [
        'financial_risk'   => 0.40,
        'deadline_urgency' => 0.30,
        'team_blocking'    => 0.20,
        'trend_risk'       => 0.10,
    ];

    public function __construct(array $weightOverrides = [])
    {
        foreach ($weightOverrides as $k => $v) {
            if (isset($this->weights[$k])) {
                $this->weights[$k] = (float)$v;
            }
        }
    }

    /**
     * Score a single Problem object.
     * Adds: impact_score (0–100), impact_level (critical|high|medium|low),
     *        impact_breakdown (per-dimension scores).
     */
    public function score(array $problem): array
    {
        $type = $problem['problem_type'] ?? 'unknown';

        // ── 1. Financial Risk (0–100) ─────────────────────────────────────
        // How much financial/legal exposure does this problem carry?
        $financial = match($type) {
            'bill_overdue'   => min(100, 40 + ($problem['overdue_count'] ?? 0) * 15 + ($problem['impact_score'] ?? 0) * 0.05),
            'store_risk'     => min(100, 20 + ($problem['overdue_count'] ?? 0) * 8),
            'overload'       => min(100, 10 + ($problem['businesses_affected'] ?? 0) * 10),
            'low_throughput' => 15,
            default          => 10,
        };

        // ── 2. Deadline Urgency (0–100) ───────────────────────────────────
        // How time-critical is this problem right now?
        $urgencyMap = ['immediate' => 100, 'today' => 70, 'week' => 40, 'monitor' => 10];
        $baseUrgency = (int)($urgencyMap[$problem['urgency'] ?? 'monitor'] ?? 40);
        $overdueBoost = min(30, ($problem['overdue_count'] ?? 0) * 5);
        $deadline = min(100, $baseUrgency + $overdueBoost);

        // ── 3. Team Blocking (0–100) ──────────────────────────────────────
        // How much is this slowing the team's output capacity?
        $blocking = match($type) {
            'overload'       => min(100, 20 + ($problem['overdue_count'] ?? 0) * 10 + ($problem['businesses_affected'] ?? 0) * 8),
            'low_throughput' => min(100, 50 + ($problem['impact_score'] ?? 0) * 0.5),
            'store_risk'     => min(100, 15 + ($problem['overdue_count'] ?? 0) * 6),
            'bill_overdue'   => 5,    // bills don't block tasks directly
            default          => 10,
        };

        // ── 4. Trend Risk (0–100) ─────────────────────────────────────────
        // How likely is this to get significantly worse in the next 48–72h?
        // (V4 Phase 3 will read decision_history; for now, use heuristics)
        $trend = match($type) {
            'overload'       => ($problem['overdue_count'] ?? 0) >= 5 ? 80 : 45,
            'bill_overdue'   => 70,   // bills compound with late fees
            'store_risk'     => ($problem['overdue_count'] ?? 0) >= 5 ? 65 : 35,
            'low_throughput' => 30,   // throughput changes slowly
            default          => 20,
        };

        // ── Weighted composite ────────────────────────────────────────────
        $score = (int)round(
            $financial * $this->weights['financial_risk']
          + $deadline  * $this->weights['deadline_urgency']
          + $blocking  * $this->weights['team_blocking']
          + $trend     * $this->weights['trend_risk']
        );

        $level = match(true) {
            $score >= 75 => 'critical',
            $score >= 50 => 'high',
            $score >= 30 => 'medium',
            default      => 'low',
        };

        return array_merge($problem, [
            'impact_score'     => $score,
            'impact_level'     => $level,
            'impact_breakdown' => [
                'financial_risk'   => (int)round($financial),
                'deadline_urgency' => (int)round($deadline),
                'team_blocking'    => (int)round($blocking),
                'trend_risk'       => (int)round($trend),
            ],
        ]);
    }

    /** Score an array of problems in batch. */
    public function scoreBatch(array $problems): array
    {
        return array_map([$this, 'score'], $problems);
    }
}
