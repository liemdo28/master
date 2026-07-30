<?php
/**
 * TaskApprovalController — Handles the 3-stage approval workflow for tasks.
 *
 * Flow: Assignee submits → Reviewer approves/rejects → Approver accepts/rejects → DONE
 */
class TaskApprovalController {
    private Task $taskModel;

    public function __construct() {
        $this->taskModel = new Task();
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private function uid(): int {
        return (int)($_SESSION['user_id'] ?? 0);
    }

    private function requireLogin(): void {
        if (!isLoggedIn()) redirect('login');
    }

    private function csrf(): void {
        if (!verify_csrf($_POST['csrf'] ?? '')) {
            flash('error', 'Security token invalid. Please try again.');
            redirect('dashboard');
        }
    }

    private function loadTask(int $id): array {
        $task = $this->taskModel->findById($id);
        if (!$task) {
            flash('error', 'Task not found.');
            redirect('dashboard');
            exit;
        }
        return $task;
    }

    private function notifyUser(int $userId, string $title, string $message, int $taskId): void {
        try {
            notifyUser([
                'user_id'    => $userId,
                'type'       => 'task_approval',
                'title'      => $title,
                'message'    => $message,
                'link'       => APP_URL . '/tasks/' . $taskId,
                'created_by' => $this->uid(),
            ]);
        } catch (\Throwable $e) {
            // Notification failure must never block workflow
        }
    }

    // ── Actions ────────────────────────────────────────────────────────────────

    /**
     * POST /tasks/:id/submit
     * Assignee submits task for review.
     */
    public function submit(int $id): void {
        $this->requireLogin();
        $this->csrf();

        $task    = $this->loadTask($id);
        $uid     = $this->uid();
        $note    = trim($_POST['note'] ?? '');
        $isAdmin = canAdmin();

        // Permission: only assignee or CEO/Admin
        if (!$isAdmin && (int)$task['assignee_id'] !== $uid) {
            flash('error', 'Only the task assignee can submit for review.');
            redirect('tasks/' . $id);
        }

        // Approval must be enabled OR task must have a reviewer assigned
        if (empty($task['approval_required']) && empty($task['reviewer_id'])) {
            flash('error', 'This task does not require approval workflow.');
            redirect('tasks/' . $id);
        }

        $ok = $this->taskModel->submitTask($id, $uid, $note ?: null, $isAdmin && (int)$task['assignee_id'] !== $uid);

        if ($ok) {
            flash('success', 'Task submitted for review.');
            // Notify reviewer
            if (!empty($task['reviewer_id'])) {
                $this->notifyUser(
                    (int)$task['reviewer_id'],
                    '📋 Task needs your review',
                    '"' . ($task['title'] ?? '') . '" has been submitted for your review.',
                    $id
                );
            }
        } else {
            flash('error', 'Could not submit task. Check status and try again.');
        }

        redirect('tasks/' . $id);
    }

    /**
     * POST /tasks/:id/review-approve
     * Reviewer approves the submission.
     */
    public function reviewApprove(int $id): void {
        $this->requireLogin();
        $this->csrf();

        $task    = $this->loadTask($id);
        $uid     = $this->uid();
        $note    = trim($_POST['note'] ?? '');
        $isAdmin = canAdmin();

        if (!$isAdmin && (int)$task['reviewer_id'] !== $uid) {
            flash('error', 'Only the designated reviewer can approve this review.');
            redirect('tasks/' . $id);
        }

        $ok = $this->taskModel->reviewApprove($id, $uid, $note ?: null, $isAdmin && (int)$task['reviewer_id'] !== $uid);

        if ($ok) {
            flash('success', 'Review approved. Task sent for final acceptance.');
            if (!empty($task['approver_id'])) {
                $this->notifyUser(
                    (int)$task['approver_id'],
                    '✅ Task ready for your acceptance',
                    '"' . ($task['title'] ?? '') . '" passed review and needs your acceptance.',
                    $id
                );
            }
        } else {
            flash('error', 'Could not approve review. Task must be in "Pending Review" status.');
        }

        redirect('tasks/' . $id);
    }

    /**
     * POST /tasks/:id/review-reject
     * Reviewer rejects the submission.
     */
    public function reviewReject(int $id): void {
        $this->requireLogin();
        $this->csrf();

        $task   = $this->loadTask($id);
        $uid    = $this->uid();
        $reason = trim($_POST['reason'] ?? '');
        $isAdmin = canAdmin();

        if (!$isAdmin && (int)$task['reviewer_id'] !== $uid) {
            flash('error', 'Only the designated reviewer can reject this review.');
            redirect('tasks/' . $id);
        }

        if (empty($reason)) {
            flash('error', 'A rejection reason is required.');
            redirect('tasks/' . $id);
        }

        $ok = $this->taskModel->reviewReject($id, $uid, $reason, $isAdmin && (int)$task['reviewer_id'] !== $uid);

        if ($ok) {
            flash('error', 'Review rejected. Task returned to assignee.');
            if (!empty($task['assignee_id'])) {
                $this->notifyUser(
                    (int)$task['assignee_id'],
                    '❌ Task review rejected',
                    '"' . ($task['title'] ?? '') . '" was rejected by the reviewer: ' . $reason,
                    $id
                );
            }
        } else {
            flash('error', 'Could not reject review. Task must be in "Pending Review" status.');
        }

        redirect('tasks/' . $id);
    }

    /**
     * POST /tasks/:id/accept
     * Approver accepts the task (final DONE).
     */
    public function accept(int $id): void {
        $this->requireLogin();
        $this->csrf();

        $task    = $this->loadTask($id);
        $uid     = $this->uid();
        $note    = trim($_POST['note'] ?? '');
        $isAdmin = canAdmin();

        if (!$isAdmin && (int)$task['approver_id'] !== $uid) {
            flash('error', 'Only the designated approver can accept this task.');
            redirect('tasks/' . $id);
        }

        $ok = $this->taskModel->acceptTask($id, $uid, $note ?: null, $isAdmin && (int)$task['approver_id'] !== $uid);

        if ($ok) {
            flash('success', '🎉 Task accepted and marked DONE.');
            // Notify assignee and reviewer
            foreach (array_filter([(int)($task['assignee_id'] ?? 0), (int)($task['reviewer_id'] ?? 0)]) as $notify) {
                $this->notifyUser(
                    $notify,
                    '🎉 Task accepted!',
                    '"' . ($task['title'] ?? '') . '" has been accepted and is now DONE.',
                    $id
                );
            }
        } else {
            flash('error', 'Could not accept task. Task must be in "Pending Acceptance" status.');
        }

        redirect('tasks/' . $id);
    }

    /**
     * POST /tasks/:id/accept-reject
     * Approver rejects the acceptance.
     */
    public function acceptReject(int $id): void {
        $this->requireLogin();
        $this->csrf();

        $task    = $this->loadTask($id);
        $uid     = $this->uid();
        $reason  = trim($_POST['reason'] ?? '');
        $isAdmin = canAdmin();

        if (!$isAdmin && (int)$task['approver_id'] !== $uid) {
            flash('error', 'Only the designated approver can reject acceptance.');
            redirect('tasks/' . $id);
        }

        if (empty($reason)) {
            flash('error', 'A rejection reason is required.');
            redirect('tasks/' . $id);
        }

        $ok = $this->taskModel->acceptReject($id, $uid, $reason, $isAdmin && (int)$task['approver_id'] !== $uid);

        if ($ok) {
            flash('error', 'Acceptance rejected. Task returned to assignee.');
            if (!empty($task['assignee_id'])) {
                $this->notifyUser(
                    (int)$task['assignee_id'],
                    '❌ Task acceptance rejected',
                    '"' . ($task['title'] ?? '') . '" acceptance was rejected: ' . $reason,
                    $id
                );
            }
        } else {
            flash('error', 'Could not reject acceptance. Task must be in "Pending Acceptance" status.');
        }

        redirect('tasks/' . $id);
    }

    /**
     * POST /tasks/:id/reopen-approval
     * CEO/Admin reopen any approval-stage task.
     */
    public function reopenApproval(int $id): void {
        $this->requireLogin();
        $this->csrf();

        if (!canAdmin()) {
            flash('error', 'Only CEO/Admin can reopen approval-stage tasks.');
            redirect('tasks/' . $id);
        }

        $task   = $this->loadTask($id);
        $reason = trim($_POST['reason'] ?? '');
        $ok     = $this->taskModel->reopenApproval($id, $this->uid(), $reason ?: null);

        if ($ok) {
            flash('success', 'Task reopened and returned to in-progress.');
        } else {
            flash('error', 'Could not reopen task.');
        }

        redirect('tasks/' . $id);
    }
}
