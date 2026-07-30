<?php
/**
 * ApprovalNoteController — Approver adds notes to a task
 */
class ApprovalNoteController {
    private ApprovalNote $model;
    private TaskNotification $notif;

    public function __construct() {
        $this->model = new ApprovalNote();
        $this->notif = new TaskNotification();
    }

    private function uid(): int { return (int)($_SESSION['user_id'] ?? 0); }

    // POST /tasks/:id/approval-notes
    public function store(int $taskId): void {
        if (!verify_csrf($_POST['csrf'] ?? '')) {
            json_response(['error' => 'Invalid security token.'], 403);
        }

        $task = (new Task())->findById($taskId);
        if (!$task) {
            if (!empty($_SERVER['HTTP_X_REQUESTED_WITH'])) json_response(['error' => 'Task not found'], 404);
            flash('error', 'Task not found.');
            redirect('dashboard');
        }

        $uid = $this->uid();

        // Only reviewer or approver can add approval notes
        if (!canAdmin()
            && (int)($task['reviewer_id'] ?? 0) !== $uid
            && (int)($task['approver_id'] ?? 0) !== $uid) {
            if (!empty($_SERVER['HTTP_X_REQUESTED_WITH'])) json_response(['error' => 'Forbidden'], 403);
            flash('error', 'Only the reviewer or approver can add approval notes.');
            redirect('tasks/' . $taskId);
        }

        $action = $_POST['action'] ?? '';
        $allowed = ['approved', 'rejected', 'requested_changes', 'info_requested'];
        if (!in_array($action, $allowed)) {
            if (!empty($_SERVER['HTTP_X_REQUESTED_WITH'])) json_response(['error' => 'Invalid action'], 422);
            flash('error', 'Please select an action.');
            redirect('tasks/' . $taskId);
        }

        $content = trim($_POST['content'] ?? '');
        if ($content === '') {
            if (!empty($_SERVER['HTTP_X_REQUESTED_WITH'])) json_response(['error' => 'Content required'], 422);
            flash('error', 'Please enter a note or reason.');
            redirect('tasks/' . $taskId);
        }

        $isFinal = !empty($_POST['is_final']);

        $noteId = $this->model->create($taskId, $uid, $action, $content, $isFinal);

        // Process @mentions in approval notes
        $mentionedIds = $this->model->processMentions($taskId, $noteId, $uid, $content, 'approval_note');
        if (!empty($mentionedIds)) {
            $this->notif->notifyMentions($taskId, $mentionedIds, $uid, 'approval_note', $content);
        }

        // Notify relevant people
        $fromUser = currentUser();
        $fromName = $fromUser['name'] ?? 'Approver';
        $taskTitle = $task['title'] ?? '';

        // Notify assignee
        if (!empty($task['assignee_id']) && (int)$task['assignee_id'] !== $uid) {
            $typeMap = [
                'approved' => 'approval_approved',
                'rejected' => 'approval_rejected',
                'requested_changes' => 'approval_requested',
                'info_requested' => 'approval_requested',
            ];
            $this->notif->notify([
                'user_id'        => (int)$task['assignee_id'],
                'task_id'        => $taskId,
                'type'           => $typeMap[$action] ?? 'approval_requested',
                'title'          => "{$fromName} " . ($action === 'approved' ? 'approved' : ($action === 'rejected' ? 'rejected' : 'commented on')) . " task",
                'message'        => mb_substr($content, 0, 150) . ' — ' . $taskTitle,
                'from_user_id'   => $uid,
                'inbox_category' => 'approval',
            ]);
        }

        // Notify reviewer (if approver is acting)
        if ($action === 'approved' && !empty($task['reviewer_id']) && (int)$task['reviewer_id'] !== $uid) {
            $this->notif->notify([
                'user_id'        => (int)$task['reviewer_id'],
                'task_id'        => $taskId,
                'type'           => 'approval_approved',
                'title'          => "{$fromName} accepted task after review",
                'message'        => mb_substr($content, 0, 150) . ' — ' . $taskTitle,
                'from_user_id'   => $uid,
                'inbox_category' => 'approval',
            ]);
        }

        if (!empty($_SERVER['HTTP_X_REQUESTED_WITH'])) {
            json_response(['success' => true, 'note_id' => $noteId]);
        }
        flash('success', 'Approval note added.');
        redirect('tasks/' . $taskId);
    }

    // DELETE /approval-notes/:id
    public function delete(int $id): void {
        $note = $this->model->findById($id);
        if (!$note) {
            json_response(['error' => 'Not found'], 404);
        }
        if ((int)$note['user_id'] !== $this->uid() && !canAdmin()) {
            json_response(['error' => 'Forbidden'], 403);
        }
        $this->model->delete($id);
        if (!empty($_SERVER['HTTP_X_REQUESTED_WITH'])) json_response(['success' => true]);
        redirect($_SERVER['HTTP_REFERER'] ?? 'dashboard');
    }
}
