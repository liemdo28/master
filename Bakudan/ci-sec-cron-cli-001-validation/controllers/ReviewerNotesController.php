<?php
/**
 * ReviewerNotesController — Reviewer workspace: create/manage reviewer instructions
 */
class ReviewerNotesController {
    private ReviewerNote $model;
    private TaskNotification $notif;
    private TaskComment $commentModel;

    public function __construct() {
        $this->model        = new ReviewerNote();
        $this->notif        = new TaskNotification();
        $this->commentModel = new TaskComment();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function uid(): int { return (int)($_SESSION['user_id'] ?? 0); }

    private function canManageNote(int $taskId): bool {
        if (canAdmin()) return true;
        $task = (new Task())->findById($taskId);
        if (!$task) return false;
        // Reviewer or approver can create notes
        return $this->uid() === (int)($task['reviewer_id'] ?? 0)
            || $this->uid() === (int)($task['approver_id'] ?? 0);
    }

    private function loadTask(int $taskId): array {
        $task = (new Task())->findById($taskId);
        if (!$task) {
            json_response(['error' => 'Task not found'], 404);
        }
        return $task;
    }

    // ── Actions ───────────────────────────────────────────────────────────────

    // POST /tasks/:id/reviewer-notes
    public function store(int $taskId): void {
        if (!verify_csrf($_POST['csrf'] ?? '')) {
            json_response(['error' => 'Security token invalid.'], 403);
        }
        if (!$this->canManageNote($taskId)) {
            if (!empty($_SERVER['HTTP_X_REQUESTED_WITH'])) json_response(['error' => 'Only the reviewer can add notes.'], 403);
            flash('error', 'Only the reviewer can add reviewer notes.');
            redirect('tasks/' . $taskId);
        }

        $content = trim($_POST['content'] ?? '');
        if ($content === '') {
            if (!empty($_SERVER['HTTP_X_REQUESTED_WITH'])) json_response(['error' => 'Content required'], 422);
            flash('error', 'Note content is required.');
            redirect('tasks/' . $taskId);
        }

        $task   = $this->loadTask($taskId);
        $uid    = $this->uid();
        $noteId = $this->model->create($taskId, $uid, [
            'note_type'       => $_POST['note_type'] ?? 'instruction',
            'title'           => trim($_POST['title'] ?? ''),
            'content'         => $content,
            'checklist_items' => $this->parseChecklist($_POST['checklist'] ?? ''),
        ]);

        // Process @mentions in the note
        $mentionedIds = $this->commentModel->processMentions($taskId, $noteId, $uid, $content, 'reviewer_note');
        if (!empty($mentionedIds)) {
            $this->notif->notifyMentions($taskId, $mentionedIds, $uid, 'reviewer_note', $content);
        }

        // Notify assignee that reviewer added a note
        if (!empty($task['assignee_id']) && (int)$task['assignee_id'] !== $uid) {
            $fromUser = currentUser();
            $this->notif->notify([
                'user_id'        => (int)$task['assignee_id'],
                'task_id'        => $taskId,
                'type'           => 'review_requested',
                'title'          => ($fromUser['name'] ?? 'Reviewer') . ' added reviewer instructions',
                'message'        => mb_substr($content, 0, 150) . ' — ' . ($task['title'] ?? ''),
                'from_user_id'   => $uid,
                'inbox_category' => 'review',
            ]);
        }

        if (!empty($_SERVER['HTTP_X_REQUESTED_WITH'])) {
            json_response(['success' => true, 'note_id' => $noteId]);
        }
        flash('success', 'Reviewer note added.');
        redirect('tasks/' . $taskId);
    }

    // POST /tasks/:id/reviewer-notes/:noteId/acknowledge
    public function acknowledge(int $taskId, int $noteId): void {
        $note = $this->model->findById($noteId);
        if (!$note || (int)$note['task_id'] !== $taskId) {
            json_response(['error' => 'Not found'], 404);
        }

        // Only assignee or admin can acknowledge
        $task = $this->loadTask($taskId);
        $uid  = $this->uid();
        if (!canAdmin() && (int)($task['assignee_id'] ?? 0) !== $uid) {
            json_response(['error' => 'Forbidden'], 403);
        }

        $ok = $this->model->acknowledge($noteId, $uid);
        json_response(['success' => $ok]);
    }

    // POST /tasks/:id/reviewer-notes/:noteId/checklist-item
    public function toggleChecklistItem(int $taskId, int $noteId): void {
        $note = $this->model->findById($noteId);
        if (!$note || (int)$note['task_id'] !== $taskId) {
            json_response(['error' => 'Not found'], 404);
        }
        $index = (int)($_POST['index'] ?? -1);
        $done  = !empty($_POST['done']);
        $ok    = $this->model->updateChecklistItem($noteId, $index, $done);
        json_response(['success' => $ok]);
    }

    // DELETE /reviewer-notes/:id
    public function delete(int $id): void {
        $note = $this->model->findById($id);
        if (!$note) { json_response(['error' => 'Not found'], 404); }

        $uid = $this->uid();
        if ((int)$note['user_id'] !== $uid && !canAdmin()) {
            json_response(['error' => 'Forbidden'], 403);
        }
        $this->model->delete($id);
        if (!empty($_SERVER['HTTP_X_REQUESTED_WITH'])) json_response(['success' => true]);
        redirect($_SERVER['HTTP_REFERER'] ?? 'dashboard');
    }

    // POST /tasks/:id/request-changes
    public function requestChanges(int $taskId): void {
        if (!verify_csrf($_POST['csrf'] ?? '')) json_response(['error' => 'Invalid token'], 403);

        $task = $this->loadTask($taskId);
        $uid  = $this->uid();

        // Only reviewer or admin
        if (!canAdmin() && (int)($task['reviewer_id'] ?? 0) !== $uid) {
            if (!empty($_SERVER['HTTP_X_REQUESTED_WITH'])) json_response(['error' => 'Only the reviewer can request changes.'], 403);
            flash('error', 'Only the reviewer can request changes.');
            redirect('tasks/' . $taskId);
        }

        $comment = trim($_POST['comment'] ?? '');
        if ($comment === '') {
            if (!empty($_SERVER['HTTP_X_REQUESTED_WITH'])) json_response(['error' => 'A comment is required.'], 422);
            flash('error', 'Please provide a comment explaining what changes are needed.');
            redirect('tasks/' . $taskId);
        }

        // Add reviewer note for tracking
        $this->model->create($taskId, $uid, [
            'note_type' => 'instruction',
            'title'     => '🔁 Changes Requested',
            'content'   => $comment,
        ]);

        // Notify assignee
        if (!empty($task['assignee_id'])) {
            $fromUser = currentUser();
            $this->notif->notify([
                'user_id'        => (int)$task['assignee_id'],
                'task_id'        => $taskId,
                'type'           => 'request_changes',
                'title'          => ($fromUser['name'] ?? 'Reviewer') . ' requested changes',
                'message'        => mb_substr($comment, 0, 150) . ' — ' . ($task['title'] ?? ''),
                'from_user_id'   => $uid,
                'inbox_category' => 'review',
            ]);
        }

        if (!empty($_SERVER['HTTP_X_REQUESTED_WITH'])) json_response(['success' => true]);
        flash('error', 'Changes requested. Assignee has been notified.');
        redirect('tasks/' . $taskId);
    }

    // POST /tasks/:id/request-info
    public function requestInfo(int $taskId): void {
        if (!verify_csrf($_POST['csrf'] ?? '')) json_response(['error' => 'Invalid token'], 403);

        $task = $this->loadTask($taskId);
        $uid  = $this->uid();

        if (!canAdmin() && (int)($task['reviewer_id'] ?? 0) !== $uid && (int)($task['approver_id'] ?? 0) !== $uid) {
            if (!empty($_SERVER['HTTP_X_REQUESTED_WITH'])) json_response(['error' => 'Forbidden'], 403);
            flash('error', 'Forbidden.');
            redirect('tasks/' . $taskId);
        }

        $question = trim($_POST['question'] ?? '');
        if ($question === '') {
            if (!empty($_SERVER['HTTP_X_REQUESTED_WITH'])) json_response(['error' => 'Question required'], 422);
            flash('error', 'Please provide your question.');
            redirect('tasks/' . $taskId);
        }

        // Add as question-type reviewer note
        $this->model->create($taskId, $uid, [
            'note_type' => 'question',
            'title'     => '❓ Information Requested',
            'content'   => $question,
        ]);

        // Notify assignee
        if (!empty($task['assignee_id'])) {
            $fromUser = currentUser();
            $this->notif->notify([
                'user_id'        => (int)$task['assignee_id'],
                'task_id'        => $taskId,
                'type'           => 'review_requested',
                'title'          => ($fromUser['name'] ?? 'Reviewer') . ' is requesting information',
                'message'        => mb_substr($question, 0, 150) . ' — ' . ($task['title'] ?? ''),
                'from_user_id'   => $uid,
                'inbox_category' => 'review',
            ]);
        }

        if (!empty($_SERVER['HTTP_X_REQUESTED_WITH'])) json_response(['success' => true]);
        flash('success', 'Information request sent.');
        redirect('tasks/' . $taskId);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private function parseChecklist(string $raw): array {
        if (empty($raw)) return [];
        $lines = array_filter(array_map('trim', explode("\n", $raw)));
        return array_values(array_map(fn($l) => ['text' => $l, 'done' => false], $lines));
    }
}
