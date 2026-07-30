<?php
/**
 * Phase 1 — Workflow Execution API
 *
 * Action-first queue system for the CEO/Manager/Member command center.
 *
 * Endpoints (all return JSON; require login):
 *   GET  /api/v1/my-work                  → { assigned_to_me, due_today, overdue_mine, mentioned_me, waiting_on_me, totals }
 *   GET  /api/v1/reviewer-queue           → { needs_review, waiting_evidence, approved, rejected, totals }
 *   GET  /api/v1/approver-queue           → { needs_approval, accepted, rejected, totals }
 *   GET  /api/v1/command-center           → { my_work, review, approve, critical_today, blocked, generated_at }
 *
 *   GET  /api/v1/my-work/list?bucket=…    → task list (max 50)
 *   GET  /api/v1/reviewer-queue/list?bucket=…
 *   GET  /api/v1/approver-queue/list?bucket=…
 *
 * All queries read `tasks.approval_required`, `tasks.reviewer_id`, `tasks.approver_id`,
 * `tasks.submitted_at`, `tasks.checked_at`, `tasks.accepted_workflow_at`,
 * `tasks.final_done_at` — columns added by the Phase 0 schema fix.
 */
require_once __DIR__ . '/../helpers/ApiResponse.php';
require_once __DIR__ . '/api/helpers/api_token.php';

class WorkflowExecutionApiController
{
    private $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    // ────────────────────────────────────────────────────────────────────
    //  Aggregates (single-shot for top-of-dashboard)
    // ────────────────────────────────────────────────────────────────────

    public function myWork(): void
    {
        $this->requireAuth();
        $uid = (int)$_SESSION['user_id'];
        $today = function_exists('app_today') ? app_today() : date('Y-m-d');
        $hasApproval = $this->db->columnExists('tasks', 'approval_required');
        $hasReviewer = $this->db->columnExists('tasks', 'reviewer_id');

        $assigned = $this->count(
            "SELECT COUNT(*) c FROM tasks
             WHERE assignee_id = ?
               AND is_completed = 0
               AND status NOT IN ('completed','cancelled','accepted')",
            [$uid]
        );

        $dueToday = $this->count(
            "SELECT COUNT(*) c FROM tasks
             WHERE assignee_id = ?
               AND is_completed = 0
               AND status NOT IN ('completed','cancelled','accepted')
               AND due_date = ?",
            [$uid, $today]
        );

        $overdue = $this->count(
            "SELECT COUNT(*) c FROM tasks
             WHERE assignee_id = ?
               AND is_completed = 0
               AND status NOT IN ('completed','cancelled','accepted')
               AND due_date < ?",
            [$uid, $today]
        );

        $mentioned = 0;
        try {
            $mentioned = $this->count(
                "SELECT COUNT(DISTINCT tm.task_id) c
                 FROM task_mentions tm
                 JOIN tasks t ON t.id = tm.task_id
                 WHERE tm.mentioned_user_id = ?
                   AND t.is_completed = 0
                   AND t.status NOT IN ('completed','cancelled','accepted')",
                [$uid]
            );
        } catch (\Throwable $e) { /* table may not exist yet */ }

        $waitingOnMe = 0;
        if ($hasApproval && $hasReviewer) {
            $waitingOnMe = $this->count(
                "SELECT COUNT(*) c FROM tasks
                 WHERE approval_required = 1
                   AND status = 'pending_review'
                   AND reviewer_id = ?",
                [$uid]
            );
        }

        ApiResponse::success([
            'assigned_to_me' => $assigned,
            'due_today'      => $dueToday,
            'overdue_mine'   => $overdue,
            'mentioned_me'   => $mentioned,
            'waiting_on_me'  => $waitingOnMe,
            'totals'         => $assigned + $dueToday + $overdue + $mentioned + $waitingOnMe,
        ], ['user_id' => $uid, 'today' => $today]);
    }

    public function reviewerQueue(): void
    {
        $this->requireAuth();
        $uid = (int)$_SESSION['user_id'];
        $hasApproval = $this->db->columnExists('tasks', 'approval_required');
        $hasReviewer = $this->db->columnExists('tasks', 'reviewer_id');
        $hasEvidence  = $this->db->columnExists('tasks', 'reviewed_with_evidence_at');
        $hasAccepted  = $this->db->columnExists('tasks', 'accepted_workflow_at');

        $needsReview = 0; $waitingEvidence = 0; $approved = 0; $rejected = 0;
        if ($hasApproval && $hasReviewer) {
            $needsReview = $this->count(
                "SELECT COUNT(*) c FROM tasks
                 WHERE approval_required = 1
                   AND status = 'pending_review'
                   AND reviewer_id = ?",
                [$uid]
            );
            $waitingEvidence = $this->count(
                "SELECT COUNT(*) c FROM tasks
                 WHERE approval_required = 1
                   AND status = 'pending_review'
                   AND reviewer_id = ?
                   AND (SELECT COUNT(*) FROM task_attachments WHERE task_id = tasks.id) = 0",
                [$uid]
            );
            $approved = $this->count(
                "SELECT COUNT(*) c FROM tasks
                 WHERE approval_required = 1
                   AND status IN ('pending_acceptance','accepted')
                   AND reviewer_id = ?",
                [$uid]
            );
            $rejected = $this->count(
                "SELECT COUNT(*) c FROM tasks
                 WHERE approval_required = 1
                   AND status = 'review_rejected'
                   AND reviewer_id = ?",
                [$uid]
            );
        }

        ApiResponse::success([
            'needs_review'      => $needsReview,
            'waiting_evidence'  => $waitingEvidence,
            'approved'          => $approved,
            'rejected'          => $rejected,
            'totals'            => $needsReview + $waitingEvidence + $approved + $rejected,
        ], ['user_id' => $uid]);
    }

    public function approverQueue(): void
    {
        $this->requireAuth();
        $uid = (int)$_SESSION['user_id'];
        $hasApproval = $this->db->columnExists('tasks', 'approval_required');
        $hasApprover = $this->db->columnExists('tasks', 'approver_id');

        $needsApproval = 0; $accepted = 0; $rejected = 0;
        if ($hasApproval && $hasApprover) {
            $needsApproval = $this->count(
                "SELECT COUNT(*) c FROM tasks
                 WHERE approval_required = 1
                   AND status = 'pending_acceptance'
                   AND approver_id = ?",
                [$uid]
            );
            $accepted = $this->count(
                "SELECT COUNT(*) c FROM tasks
                 WHERE approval_required = 1
                   AND status IN ('accepted','done','completed')
                   AND approver_id = ?",
                [$uid]
            );
            $rejected = $this->count(
                "SELECT COUNT(*) c FROM tasks
                 WHERE approval_required = 1
                   AND status = 'acceptance_rejected'
                   AND approver_id = ?",
                [$uid]
            );
        }

        ApiResponse::success([
            'needs_approval' => $needsApproval,
            'accepted'       => $accepted,
            'rejected'       => $rejected,
            'totals'         => $needsApproval + $accepted + $rejected,
        ], ['user_id' => $uid]);
    }

    public function commandCenter(): void
    {
        $this->requireAuth();
        $uid = (int)$_SESSION['user_id'];
        $today = function_exists('app_today') ? app_today() : date('Y-m-d');
        $hasApproval = $this->db->columnExists('tasks', 'approval_required');
        $hasReviewer = $this->db->columnExists('tasks', 'reviewer_id');
        $hasApprover = $this->db->columnExists('tasks', 'approver_id');

        // Critical Today: assigned to me, due today, not completed.
        $criticalToday = $this->count(
            "SELECT COUNT(*) c FROM tasks
             WHERE assignee_id = ?
               AND is_completed = 0
               AND status NOT IN ('completed','cancelled','accepted')
               AND due_date = ?
               AND priority IN ('high','urgent','critical')",
            [$uid, $today]
        );

        // Blocked: tasks in review_rejected or acceptance_rejected for this user
        $blocked = 0;
        if ($hasApproval) {
            $blocked = $this->count(
                "SELECT COUNT(*) c FROM tasks
                 WHERE (
                    (reviewer_id = ? AND status = 'review_rejected')
                    OR (approver_id = ? AND status = 'acceptance_rejected')
                 )",
                [$uid, $uid]
            );
        }

        // My Work totals
        $myWork = [
            'assigned_to_me' => $this->count("SELECT COUNT(*) c FROM tasks WHERE assignee_id = ? AND is_completed = 0 AND status NOT IN ('completed','cancelled','accepted')", [$uid]),
            'due_today'      => $this->count("SELECT COUNT(*) c FROM tasks WHERE assignee_id = ? AND is_completed = 0 AND status NOT IN ('completed','cancelled','accepted') AND due_date = ?", [$uid, $today]),
            'overdue_mine'   => $this->count("SELECT COUNT(*) c FROM tasks WHERE assignee_id = ? AND is_completed = 0 AND status NOT IN ('completed','cancelled','accepted') AND due_date < ?", [$uid, $today]),
            'mentioned_me'   => $this->tryCount("SELECT COUNT(DISTINCT tm.task_id) c FROM task_mentions tm JOIN tasks t ON t.id = tm.task_id WHERE tm.mentioned_user_id = ? AND t.is_completed = 0 AND t.status NOT IN ('completed','cancelled','accepted')", [$uid]),
            'waiting_on_me'  => $hasApproval && $hasReviewer
                ? $this->count("SELECT COUNT(*) c FROM tasks WHERE approval_required = 1 AND status = 'pending_review' AND reviewer_id = ?", [$uid])
                : 0,
        ];

        $review = $hasApproval && $hasReviewer ? [
            'needs_review' => $this->count("SELECT COUNT(*) c FROM tasks WHERE approval_required = 1 AND status = 'pending_review' AND reviewer_id = ?", [$uid]),
        ] : ['needs_review' => 0];

        $approve = $hasApproval && $hasApprover ? [
            'needs_approval' => $this->count("SELECT COUNT(*) c FROM tasks WHERE approval_required = 1 AND status = 'pending_acceptance' AND approver_id = ?", [$uid]),
        ] : ['needs_approval' => 0];

        ApiResponse::success([
            'my_work'        => $myWork,
            'review'         => $review,
            'approve'        => $approve,
            'critical_today' => $criticalToday,
            'blocked'        => $blocked,
            'generated_at'   => gmdate('c'),
        ], ['user_id' => $uid, 'today' => $today]);
    }

    // ────────────────────────────────────────────────────────────────────
    //  Task-list drill-downs
    // ────────────────────────────────────────────────────────────────────

    public function myWorkList(): void
    {
        $this->requireAuth();
        $uid = (int)$_SESSION['user_id'];
        $bucket = $_GET['bucket'] ?? 'assigned_to_me';
        $today = function_exists('app_today') ? app_today() : date('Y-m-d');

        switch ($bucket) {
            case 'overdue_mine':
                $sql = "SELECT id, title, status, priority, due_date, project_id, assignee_id, created_at
                        FROM tasks
                        WHERE assignee_id = ? AND is_completed = 0
                          AND status NOT IN ('completed','cancelled','accepted')
                          AND due_date < ?
                        ORDER BY due_date ASC LIMIT 50";
                $rows = $this->db->fetchAll($sql, [$uid, $today]);
                break;
            case 'due_today':
                $sql = "SELECT id, title, status, priority, due_date, project_id, assignee_id, created_at
                        FROM tasks
                        WHERE assignee_id = ? AND is_completed = 0
                          AND status NOT IN ('completed','cancelled','accepted')
                          AND due_date = ?
                        ORDER BY priority DESC, due_date ASC LIMIT 50";
                $rows = $this->db->fetchAll($sql, [$uid, $today]);
                break;
            case 'mentioned_me':
                try {
                    $rows = $this->db->fetchAll(
                        "SELECT DISTINCT t.id, t.title, t.status, t.priority, t.due_date, t.project_id, t.assignee_id, t.created_at
                         FROM tasks t
                         JOIN task_mentions tm ON tm.task_id = t.id
                         WHERE tm.mentioned_user_id = ?
                           AND t.is_completed = 0
                           AND t.status NOT IN ('completed','cancelled','accepted')
                         ORDER BY t.created_at DESC LIMIT 50",
                        [$uid]
                    );
                } catch (\Throwable $e) { $rows = []; }
                break;
            case 'waiting_on_me':
                $sql = "SELECT id, title, status, priority, due_date, project_id, assignee_id, created_at
                        FROM tasks
                        WHERE approval_required = 1
                          AND status = 'pending_review'
                          AND reviewer_id = ?
                        ORDER BY created_at ASC LIMIT 50";
                $rows = $this->db->fetchAll($sql, [$uid]);
                break;
            case 'assigned_to_me':
            default:
                $sql = "SELECT id, title, status, priority, due_date, project_id, assignee_id, created_at
                        FROM tasks
                        WHERE assignee_id = ? AND is_completed = 0
                          AND status NOT IN ('completed','cancelled','accepted')
                        ORDER BY priority DESC, due_date ASC LIMIT 50";
                $rows = $this->db->fetchAll($sql, [$uid]);
                break;
        }
        ApiResponse::success(['bucket' => $bucket, 'tasks' => $rows, 'count' => count($rows)]);
    }

    public function reviewerQueueList(): void
    {
        $this->requireAuth();
        $uid = (int)$_SESSION['user_id'];
        $bucket = $_GET['bucket'] ?? 'needs_review';

        switch ($bucket) {
            case 'waiting_evidence':
                $sql = "SELECT id, title, status, priority, due_date, project_id, assignee_id, created_at
                        FROM tasks
                        WHERE approval_required = 1 AND status = 'pending_review'
                          AND reviewer_id = ?
                          AND (SELECT COUNT(*) FROM task_attachments WHERE task_id = tasks.id) = 0
                        ORDER BY submitted_at ASC LIMIT 50";
                break;
            case 'approved':
                $sql = "SELECT id, title, status, priority, due_date, project_id, assignee_id, created_at
                        FROM tasks
                        WHERE approval_required = 1
                          AND status IN ('pending_acceptance','accepted')
                          AND reviewer_id = ?
                        ORDER BY checked_at DESC LIMIT 50";
                break;
            case 'rejected':
                $sql = "SELECT id, title, status, priority, due_date, project_id, assignee_id, created_at
                        FROM tasks
                        WHERE approval_required = 1 AND status = 'review_rejected'
                          AND reviewer_id = ?
                        ORDER BY updated_at DESC LIMIT 50";
                break;
            case 'needs_review':
            default:
                $sql = "SELECT id, title, status, priority, due_date, project_id, assignee_id, created_at
                        FROM tasks
                        WHERE approval_required = 1 AND status = 'pending_review'
                          AND reviewer_id = ?
                        ORDER BY submitted_at ASC LIMIT 50";
                break;
        }
        $rows = $this->db->fetchAll($sql, [$uid]);
        ApiResponse::success(['bucket' => $bucket, 'tasks' => $rows, 'count' => count($rows)]);
    }

    public function approverQueueList(): void
    {
        $this->requireAuth();
        $uid = (int)$_SESSION['user_id'];
        $bucket = $_GET['bucket'] ?? 'needs_approval';

        switch ($bucket) {
            case 'accepted':
                $sql = "SELECT id, title, status, priority, due_date, project_id, assignee_id, created_at
                        FROM tasks
                        WHERE approval_required = 1
                          AND status IN ('accepted','done','completed')
                          AND approver_id = ?
                        ORDER BY accepted_workflow_at DESC LIMIT 50";
                break;
            case 'rejected':
                $sql = "SELECT id, title, status, priority, due_date, project_id, assignee_id, created_at
                        FROM tasks
                        WHERE approval_required = 1 AND status = 'acceptance_rejected'
                          AND approver_id = ?
                        ORDER BY updated_at DESC LIMIT 50";
                break;
            case 'needs_approval':
            default:
                $sql = "SELECT id, title, status, priority, due_date, project_id, assignee_id, created_at
                        FROM tasks
                        WHERE approval_required = 1 AND status = 'pending_acceptance'
                          AND approver_id = ?
                        ORDER BY checked_at ASC LIMIT 50";
                break;
        }
        $rows = $this->db->fetchAll($sql, [$uid]);
        ApiResponse::success(['bucket' => $bucket, 'tasks' => $rows, 'count' => count($rows)]);
    }

    // ────────────────────────────────────────────────────────────────────
    //  Helpers
    // ────────────────────────────────────────────────────────────────────

    private function requireAuth(): void
    {
        if (!empty($_SESSION['user_id'])) {
            return;
        }

        $token = $this->bearerToken();
        if ($token) {
            $tokenData = ApiToken::validate($token);
            if ($tokenData && !empty($tokenData['user_id'])) {
                $_SESSION['user_id'] = (int)$tokenData['user_id'];
                return;
            }
        }

        ApiResponse::error('Unauthorized', 401);
    }

    private function bearerToken(): ?string
    {
        $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
        if (!$header && function_exists('getallheaders')) {
            $headers = getallheaders();
            $header = $headers['Authorization'] ?? $headers['authorization'] ?? '';
        }
        if ($header && preg_match('/^Bearer\s+(.+)$/i', $header, $m)) {
            return trim($m[1]);
        }
        return null;
    }

    private function count(string $sql, array $params = []): int
    {
        try {
            $row = $this->db->fetch($sql, $params);
            return (int)($row['c'] ?? 0);
        } catch (\Throwable $e) {
            return 0;
        }
    }

    /**
     * Same as count() but returns 0 silently on any DB error (used for
     * optional tables such as task_mentions that may not exist on legacy
     * installs).
     */
    private function tryCount(string $sql, array $params = []): int
    {
        try {
            $row = $this->db->fetch($sql, $params);
            return (int)($row['c'] ?? 0);
        } catch (\Throwable $e) {
            return 0;
        }
    }
}
