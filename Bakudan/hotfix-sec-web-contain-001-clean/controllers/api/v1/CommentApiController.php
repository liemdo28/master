<?php
/**
 * API v1 - Comments Endpoint
 * DELETE /api/v1/comments/{id}
 */
require_once __DIR__ . '/ApiController.php';
require_once __DIR__ . '/../../../models/Task.php';

class CommentApiController extends ApiController {

    // ── DELETE /api/v1/comments/{id} ────────────────────────────
    public function destroy($id) {
        $this->requireAuth();

        $comment = $this->db->fetch(
            "SELECT * FROM comments WHERE id = ?",
            [(int)$id]
        );

        if (!$comment) api_error('Comment not found', 404);

        $taskModel = new Task();
        if (!$taskModel->canView((int)$comment['task_id'], $this->userId)) {
            api_error('Access denied', 403);
        }

        // Chỉ người tạo hoặc admin mới xóa được
        if ((int)$comment['user_id'] !== $this->userId && ($this->user['role'] ?? '') !== 'admin') {
            api_error('Access denied', 403);
        }

        $this->db->delete("DELETE FROM comments WHERE id = ?", [(int)$id]);
        $this->auditLog('comment_deleted', 'comment', $id);

        api_response([], 'Comment deleted');
    }

    // ── PUT /api/v1/comments/{id} ───────────────────────────────
    public function update($id) {
        $this->requireAuth();

        $comment = $this->db->fetch(
            "SELECT * FROM comments WHERE id = ?",
            [(int)$id]
        );

        if (!$comment) api_error('Comment not found', 404);

        $taskModel = new Task();
        if (!$taskModel->canView((int)$comment['task_id'], $this->userId)) {
            api_error('Access denied', 403);
        }

        if ((int)$comment['user_id'] !== $this->userId) {
            api_error('Access denied', 403);
        }

        $body = $this->getJsonInput();
        $content = trim($body['content'] ?? '');

        if (!$content) api_error('Content is required', 400);

        $this->db->update(
            "UPDATE comments SET content = ?, updated_at = NOW() WHERE id = ?",
            [$content, (int)$id]
        );

        $updated = $this->db->fetch("SELECT * FROM comments WHERE id = ?", [(int)$id]);

        api_response([
            'comment' => [
                'id'         => (int)$updated['id'],
                'task_id'    => (int)$updated['task_id'],
                'user_id'    => (int)$updated['user_id'],
                'content'    => $updated['content'],
                'created_at' => $updated['created_at'],
                'updated_at' => $updated['updated_at'],
            ]
        ], 'Comment updated');
    }
}
