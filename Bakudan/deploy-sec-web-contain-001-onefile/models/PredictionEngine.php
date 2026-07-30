<?php
/**
 * PredictionEngine V4 — Consequence Forecasting
 *
 * For each Problem/Decision, predicts two scenarios:
 *   if_applied — expected outcomes if the recommended action is taken now
 *   if_ignored — expected consequences if nothing is done
 *
 * Predictions are plain-English operator-readable strings with a
 * time_horizon (hours until materialization) and severity tag.
 *
 * Usage:
 *   $engine = new PredictionEngine($db);
 *   $pred   = $engine->predict($problem);
 *   // → ['if_applied' => [...], 'if_ignored' => [...], 'horizon_hours' => 48]
 */
class PredictionEngine
{
    private $db;
    private string $today;

    public function __construct($db = null)
    {
        $this->db    = $db ?? Database::getInstance();
        $this->today = app_today();
    }

    /**
     * Generate predictions for a single Problem object.
     *
     * @return array{
     *   if_applied: array<string>,
     *   if_ignored: array<string>,
     *   horizon_hours: int,
     *   urgency_label: string
     * }
     */
    public function predict(array $problem): array
    {
        $type = $problem['problem_type'] ?? 'unknown';
        return match($type) {
            'overload'       => $this->predictOverload($problem),
            'store_risk'     => $this->predictStoreRisk($problem),
            'bill_overdue'   => $this->predictBillOverdue($problem),
            'low_throughput' => $this->predictThroughput($problem),
            default          => $this->predictGeneric($problem),
        };
    }

    /** Predict outcomes for a batch of problems. */
    public function predictBatch(array $problems): array
    {
        $out = [];
        foreach ($problems as $p) {
            $out[$p['entity_id'] . '_' . ($p['problem_type'] ?? '')] = array_merge(
                ['problem_id' => ($p['problem_type'] ?? '') . '_' . ($p['entity_id'] ?? 0)],
                $this->predict($p)
            );
        }
        return array_values($out);
    }

    // ── Problem-type prediction handlers ─────────────────────────────────────

    private function predictOverload(array $p): array
    {
        $ov    = (int)($p['overdue_count'] ?? 0);
        $name  = $p['title'] ?? 'This member';
        $hint  = $p['plan_hint'] ?? null;
        $dest  = $hint ? $hint['to_user'] : 'an available team member';
        $move  = $hint ? $hint['task_count'] : min($ov, 3);
        $biz   = (int)($p['businesses_affected'] ?? 1);

        $applied = [
            'Overdue tasks reduced by ~' . (int)round($move / max(1,$ov) * 100) . '% immediately',
            $name . '\'s workload drops to a manageable level',
        ];
        if ($biz > 1) $applied[] = $biz . ' store' . ($biz>1?'s':' ') . ' benefit from faster task resolution';
        if ($hint)    $applied[] = $move . ' task' . ($move>1?'s':'') . ' moved to ' . $dest . ' who has capacity';

        $ignoredExtra = $ov >= 5
            ? $ov . ' overdue tasks will cascade — store risk escalates within 48h'
            : 'Without action, ' . $ov . ' tasks will be further delayed this week';

        $ignored = [
            $ignoredExtra,
            'Team throughput continues to drop — completion rate at risk',
        ];
        if ($biz > 1) $ignored[] = $biz . ' stores affected — customer impact possible';

        return [
            'if_applied'     => $applied,
            'if_ignored'     => $ignored,
            'horizon_hours'  => $ov >= 5 ? 24 : 48,
            'urgency_label'  => $ov >= 5 ? 'Act within 24h' : 'Act within 48h',
        ];
    }

    private function predictStoreRisk(array $p): array
    {
        $ov    = (int)($p['overdue_count'] ?? 0);
        $store = $p['title'] ?? 'This store';
        $prj   = max(1, (int)round($ov / 2));

        return [
            'if_applied' => [
                'Overdue task backlog at ' . $store . ' cleared — operations normalized',
                $prj . ' project' . ($prj>1?'s':'') . ' back on track this week',
                'Store risk level drops from ' . ($p['risk_level'] ?? 'high') . ' → watch',
            ],
            'if_ignored' => [
                $ov . ' overdue tasks compound — ' . $store . ' falls further behind',
                'Risk escalates: additional team members impacted by delayed deliverables',
                'Revenue or vendor obligations may be affected within 72h',
            ],
            'horizon_hours' => $ov >= 5 ? 24 : 72,
            'urgency_label' => $ov >= 5 ? 'Act today' : 'Act this week',
        ];
    }

    private function predictBillOverdue(array $p): array
    {
        $ov     = (int)($p['overdue_count'] ?? 1);
        $amount = 0;
        // Try to extract amount from description
        if (preg_match('/\$([\d,]+)/', $p['description'] ?? '', $m)) {
            $amount = (int)str_replace(',', '', $m[1]);
        }

        $applied = [
            $ov . ' overdue bill' . ($ov>1?'s':'') . ' cleared — financial obligations met',
            'Vendor/service relationships preserved',
        ];
        if ($amount > 0) $applied[] = '$' . number_format($amount) . ' outstanding balance resolved';

        $ignored = [
            'Late fees and penalties may apply after grace period',
            'Vendor relationships at risk — service interruption possible',
        ];
        if ($amount > 500) $ignored[] = '$' . number_format($amount) . ' liability continues to grow';

        return [
            'if_applied'    => $applied,
            'if_ignored'    => $ignored,
            'horizon_hours' => 12,
            'urgency_label' => 'Act immediately',
        ];
    }

    private function predictThroughput(array $p): array
    {
        $pct = (int)preg_replace('/[^0-9]/', '', $p['description'] ?? '50');
        return [
            'if_applied' => [
                'Root cause identified — team process improved within this sprint',
                'On-time rate recovers toward target threshold (≥50%)',
                'Fewer surprises for store managers and CEO each week',
            ],
            'if_ignored' => [
                'On-time rate (' . $pct . '%) continues to decline — more overdue tasks weekly',
                'Stakeholder confidence drops — scheduling becomes unpredictable',
                'Compound effect: lower throughput → more overload → more store risk',
            ],
            'horizon_hours' => 168,  // 7 days
            'urgency_label' => 'Schedule this week',
        ];
    }

    private function predictGeneric(array $p): array
    {
        return [
            'if_applied' => ['Risk reduced — situation normalized'],
            'if_ignored' => ['Problem persists and may worsen'],
            'horizon_hours' => 72,
            'urgency_label' => 'Review soon',
        ];
    }
}
