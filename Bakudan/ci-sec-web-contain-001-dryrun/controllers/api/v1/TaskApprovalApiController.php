<?php
/**
 * TaskApprovalApiController — REST API for task approval workflow.
 *
 * Routes (registered in api_bootstrap.php):
 *   POST /api/v1/tasks/:id/submit
 *   POST /api/v1/tasks/:id/review-approve
 *   POST /api/v1/tasks/:id/review-reject
 *   POST /api/v1/tasks/:id/accept
 *   POST /api/v1/tasks/:id/accept-reject
 *   POST /api/v1/tasks/:id/reopen-approval
 *   GET  /api/v1/tasks/:id/approval-history
 */
class TaskApprovalApiController {
    private Task $taskModel;

    public function __construct() {
        $this->taskModel = new Task();
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private function ok(array $data = [], string $message = 'Success', int $code = 200): void {
        http_response_code($code);
        header('Content-Type: application/json');
        echo json_encode(['success' => true, 'message' => $message] + $data);
        exit;
    }

    private function fail(string $error, int $code = 400): void {
        http_response_code($code);
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'error' => $error]);
        exit;
    }

    private function requireAuth(): array {
        if (!function_exists('isLoggedIn') || !isLoggedIn()) {
            $this->fail('Unauthorized', 401);
        }
        return currentUser();
    }

    private function loadTask(int $id): array {
        $task = $this->taskModel->findById($id);
        if (!$task) $this->fail('Task not found', 404);
        return $task;
    }

    private function body(): array {
        $raw = file_get_contents('php://input');
        return $raw ? (json_decode($raw, true) ?? []) : [];
    }

    // ── Endpoints ──────────────────────────────────────────────────────────────

    /**
     * POST /api/v1/tasks/:id/submit
     */
    public function submit(int $id): void {
        $user = $this->requireAuth();
        $task = $this->loadTask($id);
        $body = $this->body();
        $note = trim($body['note'] ?? '');

        if (empty($task['approval_required'])) {
            $this->fail('Approval workflow not enabled for this task');
        }

        $isAdmin = in_array($user['role'], ['ceo', 'admin']);
        if (!$isAdmin && (int)$task['assignee_id'] !== (int)$user['id']) {
            $this->fail('Only the assignee can submit this task', 403);
        }

        $ok = $this->taskModel->submitTask($id, (int)$user['id'], $note ?: null, $isAdmin && (int)$task['assignee_id'] !== (int)$user['id']);
        if (!$ok) $this->fail('Cannot submit — check current task status');

        $this->ok(['status' => 'pending_review'], 'Task submitted for review');
    }

    /**
     * POST /api/v1/tasks/:id/review-approve
     */
    public function reviewApprove(int $id): void {
        $user = $this->requireAuth();
        $task = $this->loadTask($id);
        $body = $this->body();
        $note = trim($body['note'] ?? '');

        $isAdmin = in_array($user['role'], ['ceo', 'admin']);
        if (!$isAdmin && (int)$task['reviewer_id'] !== (int)$user['id']) {
            $this->fail('Only the reviewer can approve this task', 403);
        }

        $ok = $this->taskModel->reviewApprove($id, (int)$user['id'], $note ?: null, $isAdmin && (int)$task['reviewer_id'] !== (int)$user['id']);
        if (!$ok) $this->fail('Cannot approve review — task must be in pending_review status');

        $this->ok(['status' => 'pending_acceptance'], 'Review approved');
    }

    /**
     * POST /api/v1/tasks/:id/review-reject
     */
    public function reviewReject(int $id): void {
        $user   = $this->requireAuth();
        $task   = $this->loadTask($id);
        $body   = $this->body();
        $reason = trim($body['reason'] ?? '');

        if (empty($reason)) $this->fail('A rejection reason is required');

        $isAdmin = in_array($user['role'], ['ceo', 'admin']);
        if (!$isAdmin && (int)$task['reviewer_id'] !== (int)$user['id']) {
            $this->fail('Only the reviewer can reject this task', 403);
        }

        $ok = $this->taskModel->reviewReject($id, (int)$user['id'], $reason, $isAdmin && (int)$task['reviewer_id'] !== (int)$user['id']);
        if (!$ok) $this->fail('Cannot reject — task must be in pending_review status');

        $this->ok(['status' => 'review_rejected'], 'Review rejected');
    }

    /**
     * POST /api/v1/tasks/:id/accept
     */
    public function accept(int $id): void {
        $user = $this->requireAuth();
        $task = $this->loadTask($id);
        $body = $this->body();
        $note = trim($body['note'] ?? '');

        $isAdmin = in_array($user['role'], ['ceo', 'admin']);
        if (!$isAdmin && (int)$task['approver_id'] !== (int)$user['id']) {
            $this->fail('Only the approver can accept this task', 403);
        }

        $ok = $this->taskModel->acceptTask($id, (int)$user['id'], $note ?: null, $isAdmin && (int)$task['approver_id'] !== (int)$user['id']);
        if (!$ok) $this->fail('Cannot accept — task must be in pending_acceptance status');

        $this->ok(['status' => 'done'], 'Task accepted and marked done');
    }

    /**
     * POST /api/v1/tasks/:id/accept-reject
     */
    public function acceptReject(int $id): void {
        $user   = $this->requireAuth();
        $task   = $this->loadTask($id);
        $body   = $this->body();
        $reason = trim($body['reason'] ?? '');

        if (empty($reason)) $this->fail('A rejection reason is required');

        $isAdmin = in_array($user['role'], ['ceo', 'admin']);
        if (!$isAdmin && (int)$task['approver_id'] !== (int)$user['id']) {
            $this->fail('Only the approver can reject acceptance', 403);
        }

        $ok = $this->taskModel->acceptReject($id, (int)$user['id'], $reason, $isAdmin && (int)$task['approver_id'] !== (int)$user['id']);
        if (!$ok) $this->fail('Cannot reject — task must be in pending_acceptance status');

        $this->ok(['status' => 'acceptance_rejected'], 'Acceptance rejected');
    }

    /**
     * POST /api/v1/tasks/:id/reopen-approval
     */
    public function reopenApproval(int $id): void {
        $user = $this->requireAuth();
        if (!in_array($user['role'], ['ceo', 'admin'])) {
            $this->fail('Only CEO/Admin can reopen approval-stage tasks', 403);
        }

        $body   = $this->body();
        $reason = trim($body['reason'] ?? '');
        $task   = $this->loadTask($id);

        $ok = $this->taskModel->reopenApproval($id, (int)$user['id'], $reason ?: null);
        if (!$ok) $this->fail('Could not reopen task');

        $this->ok(['status' => 'in_progress'], 'Task reopened');
    }

    /**
     * GET /api/v1/tasks/:id/approval-history
     */
    public function approvalHistory(int $id): void {
        $user = $this->requireAuth();
        $task = $this->loadTask($id);

        // Permission: assignee, reviewer, approver, or admin
        $isAdmin     = in_array($user['role'], ['ceo', 'admin']);
        $isInvolved  = in_array((int)$user['id'], array_filter([
            (int)($task['assignee_id'] ?? 0),
            (int)($task['reviewer_id'] ?? 0),
            (int)($task['approver_id'] ?? 0),
        ]));

        if (!$isAdmin && !$isInvolved) {
            $this->fail('Access denied', 403);
        }

        $history    = $this->taskModel->getApprovalHistory($id);
        $stageInfo  = $this->taskModel->getApprovalStageInfo($task);

        $this->ok([
            'task_id'    => $id,
            'status'     => $task['status'],
            'stage'      => $stageInfo,
            'history'    => $history,
        ], 'OK');
    }
}
