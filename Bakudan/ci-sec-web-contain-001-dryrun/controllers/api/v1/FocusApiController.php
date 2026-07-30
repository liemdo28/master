<?php
/**
 * FocusApiController — Phase 3 intelligence feed endpoints.
 *
 * All responses are read from cron-produced snapshot tables (fast, no heavy recompute).
 *
 * Routes:
 *   GET /api/v1/focus                    → compact focus payload for mobile home
 *   GET /api/v1/focus/decisions          → role-filtered decision feed
 *   GET /api/v1/focus/risk               → latest risk snapshot
 *   GET /api/v1/focus/activity           → recent system activity
 *   GET /api/v1/focus/approvals          → pending approvals for current user role
 *   POST /api/v1/focus/approvals/{id}    → resolve approval (approve/reject)
 */
require_once __DIR__ . '/ApiController.php';
require_once __DIR__ . '/../helpers/api_response.php';
require_once __DIR__ . '/../../../models/User.php';
require_once __DIR__ . '/../../../service/DecisionFeedBuilder.php';
require_once __DIR__ . '/../../../service/RiskSnapshotBuilder.php';
require_once __DIR__ . '/../../../service/ActivityFeedBuilder.php';
require_once __DIR__ . '/../../../service/ApprovalQueueBuilder.php';

class FocusApiController extends ApiController {

    // Role caps for decision feed
    private const ROLE_CAPS = [
        'admin' => 5, 'ceo' => 3, 'cfo' => 3,
        'manager' => 5, 'member' => 3,
    ];

    // ── GET /api/v1/focus ────────────────────────────────────────────────────
    /**
     * Single compact payload for mobile home / focus screen.
     * Returns top decisions, risk chips, pending approvals count, recent activity.
     */
    public function index(): void {
        $this->requireAuth();
        $role = $this->user['role'] ?? 'member';
        $cap  = self::ROLE_CAPS[$role] ?? 3;

        $decisionBuilder  = new DecisionFeedBuilder();
        $riskBuilder      = new RiskSnapshotBuilder();
        $activityBuilder  = new ActivityFeedBuilder();
        $approvalBuilder  = new ApprovalQueueBuilder();

        $decisions   = $decisionBuilder->getForRole($role, $cap);
        $riskSnap    = $riskBuilder->latest();
        $activity    = $activityBuilder->recent(5, 'all');
        $approvalsCnt = $approvalBuilder->countPendingForRole($role);

        // Build compact risk chips for mobile UI
        $riskChips = $this->buildRiskChips($riskSnap);

        // Next best action = top decision CTA
        $nextAction = !empty($decisions) ? [
            'title'     => $decisions[0]['title'],
            'cta_type'  => $decisions[0]['cta_type'],
            'target_id' => $decisions[0]['cta_target_id'],
            'priority'  => $decisions[0]['impact_level'],
        ] : null;

        // Format activity
        $recentActivity = array_map(fn($a) => [
            'type'       => $a['type'],
            'severity'   => $a['severity'],
            'title'      => $a['title'],
            'summary'    => $a['summary'],
            'created_at' => $a['created_at'],
        ], $activity);

        $payload = [
            'top_decisions'       => $decisions,
            'risk_chips'          => $riskChips,
            'approvals_pending'   => $approvalsCnt,
            'recent_system_actions' => $recentActivity,
            'next_best_action'    => $nextAction,
            'generated_at'        => $riskSnap['generated_at'] ?? null,
            'stale_after'         => $riskSnap['stale_after']  ?? null,
            'is_stale'            => $riskSnap
                ? (strtotime($riskSnap['stale_after']) < time())
                : true,
        ];

        api_response($payload, 'Focus feed loaded', 200);
    }

    // ── GET /api/v1/focus/decisions ──────────────────────────────────────────
    public function decisions(): void {
        $this->requireAuth();
        $role = $this->user['role'] ?? 'member';
        $cap  = self::ROLE_CAPS[$role] ?? 3;

        $builder   = new DecisionFeedBuilder();
        $decisions = $builder->getForRole($role, $cap);

        api_response([
            'decisions' => $decisions,
            'count'     => count($decisions),
            'role'      => $role,
        ], 'Decision feed loaded', 200);
    }

    // ── GET /api/v1/focus/risk ───────────────────────────────────────────────
    public function risk(): void {
        $this->requireAuth();

        $builder = new RiskSnapshotBuilder();
        $snap    = $builder->latest();

        if (!$snap) {
            api_response([
                'available'  => false,
                'message'    => 'No risk snapshot available yet. Will be generated at next cron run.',
            ], 'No snapshot', 200);
            return;
        }

        $snap['summary']  = json_decode($snap['summary_json'] ?? '{}', true);
        $snap['is_stale'] = strtotime($snap['stale_after']) < time();
        unset($snap['summary_json']);

        api_response($snap, 'Risk snapshot loaded', 200);
    }

    // ── GET /api/v1/focus/activity ───────────────────────────────────────────
    public function activity(): void {
        $this->requireAuth();

        $limit    = min(50, max(1, (int)($_GET['limit'] ?? 20)));
        $severity = $_GET['severity'] ?? 'all';

        $builder  = new ActivityFeedBuilder();
        $events   = $builder->recent($limit, $severity);

        api_response([
            'events' => $events,
            'count'  => count($events),
        ], 'Activity feed loaded', 200);
    }

    // ── GET /api/v1/focus/approvals ──────────────────────────────────────────
    public function approvals(): void {
        $this->requireAuth();
        $role = $this->user['role'] ?? 'member';

        $builder  = new ApprovalQueueBuilder();
        $items    = $builder->getPendingForRole($role);

        api_response([
            'approvals' => $items,
            'count'     => count($items),
            'role'      => $role,
        ], 'Approval queue loaded', 200);
    }

    // ── POST /api/v1/focus/approvals/{id}/resolve ────────────────────────────
    public function resolveApproval(string $approvalId): void {
        $this->requireAuth();

        $input  = $this->getJsonInput();
        $status = $input['status'] ?? '';

        if (!in_array($status, ['approved', 'rejected'])) {
            api_error('status must be "approved" or "rejected"', 422);
        }

        $builder = new ApprovalQueueBuilder();
        $ok      = $builder->resolve($approvalId, $status, $this->userId);

        if (!$ok) {
            api_error('Approval item not found or already resolved', 404);
        }

        $this->auditLog('approval_' . $status, 'approval_queue', $approvalId);

        api_response(['approval_id' => $approvalId, 'status' => $status],
                    'Approval ' . $status);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function buildRiskChips(?array $snap): array {
        if (!$snap) return [];

        return [
            [
                'label'  => 'Unified',
                'score'  => $snap['unified_risk_score'],
                'level'  => $this->riskLevel($snap['unified_risk_score']),
            ],
            [
                'label'  => 'Finance',
                'score'  => $snap['finance_risk_score'],
                'level'  => $this->riskLevel($snap['finance_risk_score']),
            ],
            [
                'label'  => 'Operations',
                'score'  => $snap['operations_risk_score'],
                'level'  => $this->riskLevel($snap['operations_risk_score']),
            ],
            [
                'label'  => 'Compliance',
                'score'  => $snap['compliance_risk_score'],
                'level'  => $this->riskLevel($snap['compliance_risk_score']),
            ],
        ];
    }

    private function riskLevel(float $score): string {
        if ($score >= 80) return 'critical';
        if ($score >= 60) return 'high';
        if ($score >= 40) return 'medium';
        return 'low';
    }
}
