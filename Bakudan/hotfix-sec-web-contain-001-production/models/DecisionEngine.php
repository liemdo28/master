<?php
/**
 * DecisionEngine V4 — Global Decision Ranking
 *
 * The top-level orchestrator of the Decision Operating System.
 * Combines SmartEngine (problem detection), ImpactEngine (scoring),
 * PredictionEngine (forecasting), and comparePlans (cross-comparison)
 * into a single ranked decision list that answers:
 *
 *   "What is the most important action right now — and why?"
 *
 * Architecture:
 *   1. Detect all current problems  (SmartEngine::detectProblems)
 *   2. Score each with 4-factor impact formula  (ImpactEngine::scoreBatch)
 *   3. Rank globally by impact_score  (ImpactEngine-sorted)
 *   4. Attach predictions (if_applied / if_ignored)  (PredictionEngine)
 *   5. Attach cross-comparison scores  (SmartEngine::comparePlans)
 *   6. Return Decision objects ready for exec zone + API
 *
 * Usage:
 *   $engine = new DecisionEngine($userId, $role);
 *   $result = $engine->rankDecisions();
 *   // → ['decisions' => [...], 'top' => Decision, 'quick_win' => Decision|null]
 */
class DecisionEngine
{
    private SmartEngine      $smart;
    private ImpactEngine     $impact;
    private PredictionEngine $prediction;
    private $db;
    private string $today;

    public function __construct(int $userId, string $role = 'manager')
    {
        $this->db         = Database::getInstance();
        $this->today      = app_today();
        $this->smart      = new SmartEngine($userId, $role);
        $this->impact     = new ImpactEngine();
        $this->prediction = new PredictionEngine($this->db);
    }

    /**
     * Main entry point — produce the full ranked decision list.
     *
     * @return array{
     *   decisions: array,
     *   top: array|null,
     *   quick_win: array|null,
     *   total: int,
     *   generated_at: string
     * }
     */
    public function rankDecisions(): array
    {
        // 1. Detect problems (V3 base)
        $problems = $this->smart->detectProblems();
        if (empty($problems)) {
            return [
                'decisions'    => [],
                'top'          => null,
                'quick_win'    => null,
                'total'        => 0,
                'all_clear'    => true,
                'generated_at' => date('Y-m-d H:i:s'),
            ];
        }

        // 2. Score with ImpactEngine 4-factor formula
        $scored = $this->impact->scoreBatch($problems);

        // 3. Sort by V4 impact_score descending
        usort($scored, fn($a, $b) => ($b['impact_score'] ?? 0) - ($a['impact_score'] ?? 0));

        // 4. Attach cross-comparison scores (comparePlans gives priority_order + dimensions)
        $compared = $this->smart->comparePlans($scored);
        // Index by problem_type + entity_id for fast lookup
        $compareIdx = [];
        foreach ($compared as $c) {
            $key = ($c['problem_type'] ?? '') . '_' . ($c['entity_id'] ?? 0);
            $compareIdx[$key] = $c;
        }

        // 5. Build Decision objects
        $decisions = [];
        foreach ($scored as $rank => $p) {
            $key       = ($p['problem_type'] ?? '') . '_' . ($p['entity_id'] ?? 0);
            $cmp       = $compareIdx[$key] ?? [];
            $pred      = $this->prediction->predict($p);

            $decisions[] = $this->buildDecision($p, $rank + 1, $pred, $cmp);
        }

        $top      = $decisions[0] ?? null;
        $quickWin = $this->smart->quickWin();

        return [
            'decisions'    => $decisions,
            'top'          => $top,
            'quick_win'    => $quickWin,
            'total'        => count($decisions),
            'all_clear'    => false,
            'generated_at' => date('Y-m-d H:i:s'),
        ];
    }

    /**
     * Get the single next best action across all problems.
     * Returns the top ranked decision.
     */
    public function nextDecision(): ?array
    {
        $result = $this->rankDecisions();
        return $result['top'];
    }

    /**
     * Simulate what happens if the top decision is applied.
     * Returns before/after state.
     */
    public function simulateTop(): array
    {
        $result = $this->rankDecisions();
        $top    = $result['top'];
        if (!$top) return ['error' => 'No decisions to simulate'];

        $sim = new SimulationEngine($this->db);

        // Route simulation by problem type
        if ($top['problem_type'] === 'bill_overdue') {
            return $sim->simulateBillPayment($top['overdue_count'] ?? 0);
        }

        // For overload/store_risk — simulate via rebalance plan
        $plan = $this->smart->rebalancePlan('safe');
        return $sim->simulate($plan);
    }

    // ── Private: build normalized Decision object ─────────────────────────────

    private function buildDecision(array $p, int $rank, array $pred, array $cmp): array
    {
        $impactLevel  = $p['impact_level'] ?? $p['risk_level'] ?? 'high';
        $impactScore  = (int)($p['impact_score'] ?? 0);
        $confPct      = isset($p['confidence']) ? (int)round($p['confidence'] * 100) : null;
        $breakdown    = $p['impact_breakdown'] ?? null;

        // Color encoding by impact level
        $color = match($impactLevel) {
            'critical' => '#EF4444',
            'high'     => '#F97316',
            'medium'   => '#F59E0B',
            default    => '#60A5FA',
        };

        // Recommendation label from comparison
        $recLabel = $cmp['recommendation']       ?? 'Review';
        $recColor = $cmp['recommendation_color'] ?? $color;

        return [
            // Identity
            'decision_id'      => ($p['problem_type'] ?? 'unknown') . '_' . ($p['entity_id'] ?? 0),
            'rank'             => $rank,
            'problem_type'     => $p['problem_type'] ?? 'unknown',
            'entity_type'      => $p['entity_type']  ?? 'unknown',
            'entity_id'        => (int)($p['entity_id'] ?? 0),

            // Display
            'icon'             => $p['icon']        ?? 'alert-triangle',
            'title'            => $p['title']        ?? 'Unknown Issue',
            'description'      => $p['description']  ?? '',
            'color'            => $color,

            // Scoring
            'impact_score'     => $impactScore,
            'impact_level'     => $impactLevel,
            'impact_breakdown' => $breakdown,
            'confidence'       => $p['confidence']   ?? null,
            'confidence_pct'   => $confPct,
            'urgency'          => $p['urgency']      ?? 'week',
            'businesses_affected' => (int)($p['businesses_affected'] ?? 0),

            // Prediction
            'if_ignored'       => $pred['if_ignored']    ?? [],
            'if_applied'       => $pred['if_applied']    ?? [],
            'horizon_hours'    => $pred['horizon_hours'] ?? 72,
            'urgency_label'    => $pred['urgency_label'] ?? 'Review soon',

            // Comparison dimensions
            'priority_order'        => $cmp['priority_order']        ?? $rank,
            'total_score'           => $cmp['total_score']           ?? 0,
            'dimensions'            => $cmp['dimensions']            ?? null,
            'recommendation'        => $recLabel,
            'recommendation_color'  => $recColor,
            'action_desc'           => $cmp['action_desc']           ?? ($p['action_label'] ?? 'Take action'),

            // Action
            'action_label'     => $p['action_label'] ?? 'Act Now',
            'action_url'       => $p['action_url']   ?? '#',
            'plan_hint'        => $p['plan_hint']     ?? null,
            'recommended_action' => $p['recommended_action'] ?? 'review',

            // Overdue data
            'overdue_count'    => (int)($p['overdue_count'] ?? 0),
        ];
    }
}
