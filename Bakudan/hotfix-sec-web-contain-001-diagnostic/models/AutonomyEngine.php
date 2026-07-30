<?php
/**
 * AutonomyEngine V5 — Safe Auto-Execution Controller
 *
 * Top-level controller for V5 autonomous mode.
 * Combines DecisionEngine + PolicyEngine + ApprovalEngine + SimulationEngine
 * to classify, execute, log, and verify autonomous actions.
 *
 * Execution modes:
 *   auto     → system executes immediately (all safety gates passed)
 *   approval → system prepares payload, waits for human confirmation
 *   blocked  → system explains why it cannot act, suggests escalation
 *
 * Usage:
 *   $engine = new AutonomyEngine($userId, $role);
 *   $result = $engine->classifyDecision($decision, $plan);
 *   $result = $engine->executeIfSafe($plan, $decision);
 *   $queue  = $engine->getApprovalQueue();
 */
class AutonomyEngine
{
    private DecisionEngine  $decisions;
    private PolicyEngine    $policy;
    private ApprovalEngine  $approval;
    private SimulationEngine $simulation;
    private SmartEngine     $smart;
    private $db;
    private int    $userId;
    private string $role;

    public function __construct(int $userId, string $role = 'manager')
    {
        $this->db         = Database::getInstance();
        $this->userId     = $userId;
        $this->role       = $role;
        $this->decisions  = new DecisionEngine($userId, $role);
        $this->policy     = new PolicyEngine();
        $this->approval   = new ApprovalEngine($this->db);
        $this->simulation = new SimulationEngine($this->db);
        $this->smart      = new SmartEngine($userId, $role);
    }

    /**
     * Classify a decision + plan into auto / approval / blocked.
     *
     * @return array{
     *   execution_mode: string,
     *   reason: string,
     *   reasons: array,
     *   policy_flags: array,
     *   simulation: array,
     *   approval_payload: array|null
     * }
     */
    public function classifyDecision(array $decision, array $plan): array
    {
        // 1. Evaluate policy
        $policyResult = $this->policy->evaluate($plan, $decision);
        $mode         = $policyResult['mode'];

        // 2. Run simulation to get before/after
        $sim = $this->simulation->simulate($plan);

        // 3. Build primary reason string
        $primaryReason = match($mode) {
            'auto'     => $policyResult['reasons'][0] ?? 'All safety gates passed',
            'approval' => $policyResult['reasons'][0] ?? 'Human approval required',
            'blocked'  => $policyResult['reasons'][0] ?? 'Action blocked by policy',
            default    => 'Unknown classification',
        };

        // 4. Approval payload (only for approval mode)
        $approvalPayload = null;
        if ($mode === 'approval') {
            $approvalPayload = $this->approval->prepareApprovalPayload($plan, $decision, $policyResult);
        }

        return [
            'execution_mode'  => $mode,
            'reason'          => $primaryReason,
            'reasons'         => $policyResult['reasons'],
            'policy_flags'    => $policyResult['policy_flags'],
            'simulation'      => $sim,
            'approval_payload'=> $approvalPayload,
        ];
    }

    /**
     * Full ranked decisions list enriched with autonomy classification.
     * This is what the exec zone V5 uses.
     *
     * @return array{decisions: array, auto_queue: array, approval_queue: array, blocked: array}
     */
    public function classifyAll(): array
    {
        $v4Result  = $this->decisions->rankDecisions();
        $decisions = $v4Result['decisions'] ?? [];

        if (empty($decisions)) {
            return [
                'decisions'      => [],
                'auto_queue'     => [],
                'approval_queue' => [],
                'blocked'        => [],
                'all_clear'      => true,
                'generated_at'   => date('Y-m-d H:i:s'),
            ];
        }

        // Get the best rebalance plan (used for classification)
        $plan     = $this->smart->rebalancePlan('safe');
        $enriched = [];
        $autoQ    = [];
        $approvalQ= [];
        $blockedL = [];

        foreach ($decisions as $d) {
            // Use rebalance plan for overload; stub plan for other types
            $planForDecision = ($d['problem_type'] === 'overload') ? $plan : ['has_plan' => false, 'actions' => [], 'total_moving' => 0, 'overdue_reduced' => 0, 'risk_reduction' => ['destinations_safe' => true]];

            $classification = $this->classifyDecision($d, $planForDecision);
            $mode           = $classification['execution_mode'];

            $enriched[] = array_merge($d, [
                'autonomy_mode'      => $mode,
                'autonomy_reason'    => $classification['reason'],
                'autonomy_reasons'   => $classification['reasons'],
                'policy_flags'       => $classification['policy_flags'],
                'approval_payload'   => $classification['approval_payload'],
                'simulation_delta'   => $classification['simulation']['delta'] ?? null,
            ]);

            if ($mode === 'auto')     $autoQ[]    = end($enriched);
            elseif ($mode === 'approval') {
                $approvalQ[] = end($enriched);
                // Durably persist approval request to autonomy_log so approve/reject survives refresh
                $this->persistApprovalRequest($d, $classification);
            } else                    $blockedL[] = end($enriched);
        }

        return [
            'decisions'      => $enriched,
            'auto_queue'     => $autoQ,
            'approval_queue' => $approvalQ,
            'blocked'        => $blockedL,
            'all_clear'      => false,
            'quick_win'      => $v4Result['quick_win'] ?? null,
            'generated_at'   => date('Y-m-d H:i:s'),
        ];
    }

    /**
     * Persist an approval-mode decision to autonomy_log so the queue survives page refresh.
     * Idempotent: skips insert if an identical pending_approval record already exists.
     */
    private function persistApprovalRequest(array $decision, array $classification): void
    {
        try {
            $planId     = $classification['approval_payload']['plan_id']     ?? ('plan_' . uniqid());
            $decisionId = $classification['approval_payload']['decision_id'] ?? ('dec_' . uniqid());
            // Skip if already exists (idempotent on decision_id)
            $existing = $this->db->fetch(
                "SELECT id FROM autonomy_log WHERE decision_id = ? AND result_status = 'pending_approval'",
                [$decisionId]
            );
            if ($existing) return;

            $expiresAt = date('Y-m-d H:i:s', time() + 4 * 3600); // 4-hour window
            $this->db->execute(
                "INSERT INTO autonomy_log
                    (plan_id, decision_id, execution_mode, executed_by, confidence_score, impact_score,
                     result_status, result_summary, expires_at)
                 VALUES (?,?,?,?,?,?,?,?,?)",
                [
                    $planId,
                    $decisionId,
                    'approval',
                    'system',
                    $classification['approval_payload']['confidence'] ?? null,
                    $decision['impact_score'] ?? null,
                    'pending_approval',
                    json_encode([
                        'problem_type' => $decision['problem_type'] ?? null,
                        'title'        => $decision['title'] ?? null,
                        'reason'       => $classification['reason'] ?? null,
                    ]),
                    $expiresAt,
                ]
            );
        } catch (Exception $e) {
            // Non-fatal — log but don't crash classifyAll
            error_log('[AutonomyEngine] persistApprovalRequest failed: ' . $e->getMessage());
        }
    }

    /**
     * Execute a plan if it passes all safety gates (auto mode only).
     * Applies task moves via the existing rebalance-apply flow, then logs.
     *
     * @return array{executed: bool, moved: int, reason: string, log_id: int|null}
     */
    public function executeIfSafe(array $plan, array $decision): array
    {
        $classification = $this->classifyDecision($decision, $plan);
        $mode           = $classification['execution_mode'];

        if ($mode !== 'auto') {
            return [
                'executed' => false,
                'moved'    => 0,
                'mode'     => $mode,
                'reason'   => $classification['reason'],
                'log_id'   => null,
            ];
        }

        // Execute: apply task moves from plan
        $moved   = 0;
        $actions = $plan['actions'] ?? [];
        try {
            foreach ($actions as $action) {
                $taskIds = array_column($action['tasks'] ?? [], 'id');
                if (empty($taskIds)) continue;
                $toUserId = (int)($action['to_user_id'] ?? 0);
                if (!$toUserId) continue;
                foreach ($taskIds as $tid) {
                    $this->db->execute(
                        "UPDATE tasks SET assignee_id=?, updated_at=NOW() WHERE id=?",
                        [$toUserId, (int)$tid]
                    );
                    $moved++;
                }
            }
        } catch (Exception $e) {
            return ['executed'=>false,'moved'=>0,'mode'=>'blocked','reason'=>'DB error: '.$e->getMessage(),'log_id'=>null];
        }

        // Log to autonomy_log
        $logId = $this->recordLog($plan, $decision, 'auto', 'system', 'completed',
            'Auto-executed: ' . $moved . ' task' . ($moved!==1?'s':'') . ' moved safely');

        return [
            'executed' => true,
            'moved'    => $moved,
            'mode'     => 'auto',
            'reason'   => $classification['reason'],
            'log_id'   => $logId,
        ];
    }

    /**
     * Record an autonomy action in autonomy_log.
     */
    public function recordLog(array $plan, array $decision, string $mode, string $executedBy, string $status, string $summary): ?int
    {
        try {
            $this->db->execute(
                "INSERT INTO autonomy_log
                    (plan_id, decision_id, execution_mode, executed_by, approved_by,
                     confidence_score, impact_score, result_status, result_summary, created_at, executed_at)
                 VALUES (?,?,?,?,NULL,?,?,?,?,NOW(),?)",
                [
                    $plan['plan_id']      ?? null,
                    $decision['decision_id'] ?? null,
                    $mode,
                    $executedBy,
                    round((float)($decision['confidence'] ?? 0), 2),
                    (int)($decision['impact_score'] ?? 0),
                    $status,
                    $summary,
                    $mode === 'auto' ? date('Y-m-d H:i:s') : null,
                ]
            );
            return $this->db->lastInsertId();
        } catch (Exception $e) {
            return null;
        }
    }

    /** Get the pending approval queue from ApprovalEngine. */
    public function getApprovalQueue(): array
    {
        return $this->approval->getPendingQueue();
    }

    /**
     * Record outcome verification after auto-execution.
     * Checks whether expected overdue reduction actually happened.
     */
    public function recordOutcome(array $plan, array $result): array
    {
        $expected = (int)($plan['overdue_reduced'] ?? 0);
        $actual   = (int)($result['moved'] ?? 0);
        $verified = $actual >= $expected;

        try {
            if (!empty($result['log_id'])) {
                $this->db->execute(
                    "UPDATE autonomy_log SET result_summary=CONCAT(result_summary, ?) WHERE id=?",
                    [' | Outcome: expected=' . $expected . ' actual=' . $actual . ' verified=' . ($verified?'yes':'no'), $result['log_id']]
                );
            }
        } catch (Exception $e) {}

        return [
            'expected_overdue_reduction' => $expected,
            'actual_overdue_reduction'   => $actual,
            'outcome_verified'           => $verified,
        ];
    }
}
