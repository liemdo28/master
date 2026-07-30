<?php
/**
 * PolicyEngine V5 — Autonomy Rule Evaluator
 *
 * Evaluates whether a given plan or decision satisfies the autonomy policy.
 * Returns a structured policy result used by AutonomyEngine to classify actions.
 *
 * Usage:
 *   $policy = new PolicyEngine();
 *   $result = $policy->evaluate($plan, $decision);
 *   // → ['allowed' => bool, 'mode' => 'auto'|'approval'|'blocked', 'reasons' => [...]]
 */
class PolicyEngine
{
    private array $cfg;

    public function __construct()
    {
        $path = __DIR__ . '/../config/autonomy_engine.php';
        $this->cfg = file_exists($path) ? require $path : [];
    }

    /**
     * Evaluate a plan + decision against all autonomy policies.
     *
     * @param  array $plan      Output from SmartEngine::rebalancePlan() or similar
     * @param  array $decision  Output from DecisionEngine — ranked decision object
     * @return array{allowed: bool, mode: string, reasons: array, policy_flags: array}
     */
    public function evaluate(array $plan, array $decision): array
    {
        $th    = $this->cfg['thresholds'] ?? [];
        $rules = $this->cfg['rules']      ?? [];
        $type  = $decision['problem_type'] ?? 'unknown';
        $conf  = (float)($decision['confidence'] ?? 0.0);
        $tasks = (int)($plan['total_moving']    ?? 0);
        $ov    = (int)($plan['overdue_reduced'] ?? 0);

        $reasons = [];
        $flags   = [];
        $blocked = false;
        $needApproval = false;

        // ── Hard block categories ─────────────────────────────────────────────
        $hardBlocks = $this->cfg['hard_blocks'] ?? [];
        if (in_array($type, ['bill_overdue', 'finance'])) {
            if (!empty($rules['require_approval_all_finance'])) {
                $blocked    = false;
                $needApproval = true;
                $reasons[] = 'Finance actions always require human approval';
                $flags['finance_gate'] = true;
            }
            if (empty($rules['allow_auto_finance'])) {
                $needApproval = true;
                $flags['finance_no_auto'] = true;
            }
        }

        // ── Confidence gate ───────────────────────────────────────────────────
        $autoMin     = (float)($th['auto_confidence_min']     ?? 0.85);
        $approvalMin = (float)($th['approval_confidence_min'] ?? 0.60);

        if ($conf < $approvalMin) {
            $blocked   = true;
            $reasons[] = 'Confidence too low (' . round($conf * 100) . '% < ' . round($approvalMin * 100) . '% minimum)';
            $flags['low_confidence'] = true;
        } elseif ($conf < $autoMin) {
            $needApproval = true;
            $reasons[] = 'Confidence (' . round($conf * 100) . '%) below auto threshold (' . round($autoMin * 100) . '%) — approval required';
            $flags['medium_confidence'] = true;
        }

        // ── Task count gate ───────────────────────────────────────────────────
        $maxAutoTasks = (int)($th['max_auto_tasks_moved'] ?? 2);
        if ($tasks > $maxAutoTasks && !$blocked) {
            $needApproval = true;
            $reasons[] = $tasks . ' tasks exceed auto-execute limit (' . $maxAutoTasks . ') — approval required';
            $flags['task_count_approval'] = true;
        }

        // ── Cross-business gate ───────────────────────────────────────────────
        if (empty($rules['allow_auto_cross_business'])) {
            $actions = $plan['actions'] ?? [];
            $bizSet  = [];
            foreach ($actions as $a) {
                if (!empty($a['store_names'])) {
                    foreach ($a['store_names'] as $s) { $bizSet[$s] = 1; }
                }
            }
            if (count($bizSet) > 1 && !$blocked) {
                $needApproval = true;
                $reasons[] = 'Cross-business task movement requires approval';
                $flags['cross_business'] = true;
            }
        }

        // ── Destination risk gate ─────────────────────────────────────────────
        $destMaxRisk   = $th['destination_max_risk_for_auto'] ?? 'stable';
        $riskRank      = ['stable'=>0, 'watch'=>1, 'behind'=>2, 'critical'=>3];
        $destRisk      = $plan['risk_reduction']['destinations_safe'] ?? true;
        if (!$destRisk && !$blocked) {
            $needApproval = true;
            $reasons[] = 'Destination user not confirmed stable — approval required';
            $flags['destination_risk'] = true;
        }

        // ── Missing prediction data ───────────────────────────────────────────
        if (!empty($rules['block_if_prediction_missing'])) {
            if (empty($decision['if_ignored']) && empty($decision['if_applied'])) {
                $needApproval = true;
                $reasons[] = 'Prediction data missing — manual review recommended';
                $flags['missing_prediction'] = true;
            }
        }

        // ── No safe destination ───────────────────────────────────────────────
        if (!empty($rules['block_if_no_safe_destination'])) {
            $hasDest = !empty($plan['actions']);
            if (!$hasDest && $type === 'overload' && !$blocked) {
                $blocked   = true;
                $reasons[] = 'No safe destination available for task reassignment';
                $flags['no_destination'] = true;
            }
        }

        // ── Business hours gate ───────────────────────────────────────────────
        $bhCfg = $this->cfg['business_hours'] ?? [];
        if (!empty($bhCfg['enabled']) && !$blocked) {
            $tz   = $bhCfg['timezone'] ?? 'UTC';
            $hour = (int)(new DateTime('now', new DateTimeZone($tz)))->format('G');
            $start = (int)($bhCfg['start_hour'] ?? 8);
            $end   = (int)($bhCfg['end_hour']   ?? 18);
            if ($hour < $start || $hour >= $end) {
                $needApproval = true;
                $reasons[]    = 'Auto-execution restricted to business hours (' . $start . ':00–' . $end . ':00)';
                $flags['outside_hours'] = true;
            }
        }

        // ── Resolve final mode ────────────────────────────────────────────────
        if ($blocked) {
            $mode = 'blocked';
        } elseif ($needApproval) {
            $mode = 'approval';
        } else {
            $mode = 'auto';
            $reasons[] = 'All safety gates passed — safe to auto-execute';
        }

        return [
            'allowed'      => !$blocked,
            'mode'         => $mode,
            'reasons'      => $reasons,
            'policy_flags' => $flags,
        ];
    }

    /** Quick check: is auto-execution allowed right now for this category? */
    public function categoryAllowsAuto(string $problemType): bool
    {
        $rules = $this->cfg['rules'] ?? [];
        return match($problemType) {
            'overload'       => !empty($rules['allow_auto_rebalance']),
            'bill_overdue'   => !empty($rules['allow_auto_finance']),
            'store_risk'     => !empty($rules['allow_auto_rebalance']),
            'low_throughput' => false,  // always requires human
            default          => false,
        };
    }
}
