<?php
/**
 * TaskCommentController — rich comment thread with @mentions
 */
class TaskCommentController {
    private TaskComment $model;
    private TaskNotification $notif;

    public function __construct() {
        $this->model = new TaskComment();
        $this->notif = new TaskNotification();
    }

    // POST /tasks/:id/task-comments
    public function store(int $taskId): void {
        if (!verify_csrf($_POST['csrf'] ?? '')) {
            json_response(['error' => 'Invalid security token.'], 403);
        }

        $taskModel = new Task();
        if (!$taskModel->canView($taskId, (int)$_SESSION['user_id'])) {
            json_response(['error' => 'Forbidden'], 403);
        }

        $content  = trim($_POST['content'] ?? '');
        $type     = $_POST['comment_type'] ?? 'comment';
        $parentId = !empty($_POST['parent_id']) ? (int)$_POST['parent_id'] : null;

        if ($content === '') {
            if (!empty($_SERVER['HTTP_X_REQUESTED_WITH'])) json_response(['error' => 'Content required'], 422);
            flash('error', 'Comment cannot be empty.');
            redirect('tasks/' . $taskId);
        }

        $allowed = ['comment','instruction','question','checklist','note'];
        if (!in_array($type, $allowed)) $type = 'comment';

        $uid    = (int)$_SESSION['user_id'];
        $result = $this->model->create($taskId, $uid, $content, $type, $parentId);
        $cid    = $result['comment_id'];

        // Notify @mentions
        if (!empty($result['mentioned_ids'])) {
            $this->notif->notifyMentions($taskId, $result['mentioned_ids'], $uid, 'task_comment', $content);
        }

        // Notify task participants (not the commenter themselves)
        $task = (new Task())->findById($taskId);
        if ($task) {
            $user = currentUser();
            $name = $user['name'] ?? 'Someone';
            $this->notif->notifyTaskParticipants($taskId, $uid, [
                'type'           => 'task_submitted',
                'title'          => "{$name} commented on task",
                'message'        => mb_substr($content, 0, 120) . ' — ' . ($task['title'] ?? ''),
                'inbox_category' => 'task',
            ]);
        }

        if (!empty($_SERVER['HTTP_X_REQUESTED_WITH'])) {
            $user = currentUser();
            json_response([
                'success'  => true,
                'comment'  => [
                    'id'           => $cid,
                    'content'      => $content,
                    'content_html' => TaskComment::renderMentions($content),
                    'user_name'    => $user['name'] ?? '',
                    'user_avatar'  => $user['avatar'] ?? null,
                    'user_role'    => $user['role'] ?? '',
                    'comment_type' => $type,
                    'parent_id'    => $parentId,
                    'created_at'   => date('Y-m-d H:i:s'),
                    'is_edited'    => false,
                ],
                'mentioned_count' => count($result['mentioned_ids']),
            ]);
        }

        flash('success', 'Comment added.');
        redirect('tasks/' . $taskId);
    }

    // DELETE /task-comments/:id
    public function delete(int $id): void {
        $comment = $this->model->findById($id);
        if (!$comment) {
            json_response(['error' => 'Not found'], 404);
        }
        if ($comment['user_id'] != $_SESSION['user_id'] && !canAdmin()) {
            json_response(['error' => 'Forbidden'], 403);
        }
        $this->model->delete($id);
        if (!empty($_SERVER['HTTP_X_REQUESTED_WITH'])) json_response(['success' => true]);
        redirect($_SERVER['HTTP_REFERER'] ?? 'dashboard');
    }

    // GET /api/tasks/:id/task-comments
    public function getJson(int $taskId): void {
        if (!isLoggedIn()) json_response(['error' => 'Unauthorized'], 401);
        $taskModel = new Task();
        if (!$taskModel->canView($taskId, (int)$_SESSION['user_id'])) {
            json_response(['error' => 'Forbidden'], 403);
        }

        $comments = $this->model->getByTask($taskId);
        $out = [];
        foreach ($comments as $c) {
            $c['content_html'] = TaskComment::renderMentions($c['content']);
            $replies = $this->model->getReplies((int)$c['id']);
            foreach ($replies as &$r) {
                $r['content_html'] = TaskComment::renderMentions($r['content']);
            }
            $c['replies'] = $replies;
            $out[] = $c;
        }

        json_response(['comments' => $out, 'count' => count($out)]);
    }

    // GET /api/users/mention-search?q=
    public function mentionSearch(): void {
        if (!isLoggedIn()) json_response(['error' => 'Unauthorized'], 401);
        $q = trim($_GET['q'] ?? '');
        if (strlen($q) < 1) { json_response(['users' => []]); }

        $db = Database::getInstance();
        $like = '%' . $q . '%';
        $users = $db->fetchAll(
            "SELECT id, name, email, avatar, role FROM users
             WHERE is_active = 1 AND (name LIKE ? OR email LIKE ?)
             ORDER BY name ASC LIMIT 10",
            [$like, $like]
        );
        json_response(['users' => array_map(fn($u) => [
            'id'     => (int)$u['id'],
            'name'   => $u['name'],
            'email'  => $u['email'],
            'avatar' => $u['avatar'],
            'role'   => $u['role'],
        ], $users)]);
    }
}
