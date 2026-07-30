<?php
/**
 * ApprovalEngine V5 — Human Approval Flow
 *
 * Prepares approval payloads, records approval/rejection,
 * and maintains the pending-approval queue.
 *
 * Approval records are stored in DB (autonomy_log table).
 *
 * Usage:
 *   $engine = new ApprovalEngine();
 *   $payload = $engine->prepareApprovalPayload($plan, $decision, $policyResult);
 *   $engine->recordApproval($planId, $userId, 'approved'|'rejected');
 */
class ApprovalEngine
{
    private $db;

    public function __construct($db = null)
    {
        $this->db = $db ?? Database::getInstance();
    }

    /**
     * Build a structured approval payload for the UI.
     *
     * @return array{
     *   plan_id: string,
     *   decision_id: string,
     *   execution_mode: string,
     *   summary: string,
     *   why_recommended: string,
     *   predicted_outcome: array,
     *   why_approval_needed: array,
     *   risk_label: string,
     *   confidence_pct: int,
     *   actions: array,
     *   expires_at: string
     * }
     */
    public function prepareApprovalPayload(array $plan, array $decision, array $policyResult): array
    {
        $planId     = $plan['plan_id']    ?? ('plan_' . date('Ymd_His'));
        $decisionId = $decision['decision_id'] ?? ('dec_' . ($decision['problem_type'] ?? 'unknown') . '_' . ($decision['entity_id'] ?? 0));
        $confPct    = isset($decision['confidence']) ? (int)round($decision['confidence'] * 100) : 0;
        $impScore   = (int)($decision['impact_score'] ?? 0);
        $type       = $decision['problem_type'] ?? 'unknown';

        // Human-readable summary
        $summary = match($type) {
            'overload'     => 'Rebalance ' . ($plan['total_moving'] ?? 0) . ' task' . (($plan['total_moving'] ?? 0) !== 1 ? 's' : '') . ' — reduce overdue by ' . ($plan['overdue_reduced'] ?? 0),
            'bill_overdue' => 'Pay ' . ($decision['overdue_count'] ?? 0) . ' overdue bill' . (($decision['overdue_count'] ?? 0) !== 1 ? 's' : ''),
            'store_risk'   => 'Clear overdue task backlog at ' . ($decision['title'] ?? 'this store'),
            default        => $decision['action_desc'] ?? 'Recommended action pending approval',
        };

        $whyRec = 'Impact score ' . $impScore . ' — ranked #' . ($decision['rank'] ?? 1) . ' across all active problems. '
            . ($decision['recommendation'] ?? 'Reduces highest-priority risk.');

        // Predicted outcome bullets (from V4 prediction)
        $predicted = $decision['if_applied'] ?? ['Risk level will improve if action is applied'];

        // Reasons for requiring approval (from policy result)
        $whyApproval = $policyResult['reasons'] ?? ['Action requires human review'];

        // Risk label
        $impLevel = $decision['impact_level'] ?? 'high';
        $risk = match($impLevel) {
            'critical' => '🔴 Critical Risk',
            'high'     => '🟠 High Impact',
            'medium'   => '🟡 Medium Impact',
            default    => '🔵 Low Impact',
        };

        // Expires 4h from now (approval window)
        $expiresAt = date('Y-m-d H:i:s', time() + 4 * 3600);

        return [
            'plan_id'            => $planId,
            'decision_id'        => $decisionId,
            'execution_mode'     => 'approval',
            'summary'            => $summary,
            'why_recommended'    => $whyRec,
            'predicted_outcome'  => $predicted,
            'why_approval_needed'=> $whyApproval,
            'risk_label'         => $risk,
            'confidence_pct'     => $confPct,
            'impact_score'       => $impScore,
            'actions'            => $plan['actions'] ?? [],
            'expires_at'         => $expiresAt,
        ];
    }

    /**
     * Record an approval or rejection in autonomy_log.
     * @param  string $planId
     * @param  int    $userId  Who approved/rejected
     * @param  string $status  'approved' | 'rejected'
     */
    public function recordApproval(string $planId, int $userId, string $status): bool
    {
        try {
            $this->db->execute(
                "UPDATE autonomy_log SET result_status=?, approved_by=?, executed_at=NOW()
                 WHERE plan_id=? AND result_status='pending_approval'",
                [$status, $userId, $planId]
            );
            return true;
        } catch (Exception $e) {
            return false;
        }
    }

    /**
     * Get pending approval queue (unresolved approval-mode decisions).
     */
    public function getPendingQueue(): array
    {
        try {
            return $this->db->fetchAll(
                "SELECT * FROM autonomy_log
                 WHERE execution_mode='approval' AND result_status='pending_approval'
                   AND (expires_at IS NULL OR expires_at > NOW())
                 ORDER BY created_at DESC
                 LIMIT 10"
            ) ?: [];
        } catch (Exception $e) {
            return [];
        }
    }
}
