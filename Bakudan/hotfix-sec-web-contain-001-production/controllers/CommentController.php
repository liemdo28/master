<?php
class CommentController {
    private $commentModel;
    public function __construct() { $this->commentModel = new Comment(); }

    public function store($taskId) {
        if (!verify_csrf($_POST['csrf'] ?? '')) {
            if (!empty($_SERVER['HTTP_X_REQUESTED_WITH'])) json_response(['error' => 'Invalid security token.'], 403);
            redirect($_SERVER['HTTP_REFERER'] ?? 'dashboard');
        }
        $taskModel = new Task();
        if (!$taskModel->canView((int)$taskId, (int)$_SESSION['user_id'])) {
            if (!empty($_SERVER['HTTP_X_REQUESTED_WITH'])) json_response(['error' => 'Forbidden'], 403);
            $_SESSION['flash_error'] = 'Bạn không có quyền bình luận task này.';
            redirect($_SERVER['HTTP_REFERER'] ?? 'dashboard');
        }
        $content = trim($_POST['content'] ?? '');
        if (empty($content)) {
            if (!empty($_SERVER['HTTP_X_REQUESTED_WITH'])) json_response(['error' => 'Nội dung trống'], 400);
            redirect($_SERVER['HTTP_REFERER'] ?? 'dashboard');
        }

        $id = $this->commentModel->create($taskId, $_SESSION['user_id'], $content);

        // Notify all watchers about new comment
        $task = (new Task())->findById($taskId);
        if ($task) {
            $user = currentUser();
            $notif = new Notification();
            $notif->notifyWatchers($taskId, $_SESSION['user_id'], 'task_commented',
                ($user['name'] ?? 'Someone') . ' commented',
                mb_substr($content, 0, 100) . ' — ' . $task['title'],
                $_SESSION['user_id']
            );
        }

        if (!empty($_SERVER['HTTP_X_REQUESTED_WITH'])) {
            $user = currentUser();
            json_response(['success'=>true, 'comment'=>['id'=>$id, 'content'=>$content, 'user_name'=>$user['name'], 'created_at'=>date('Y-m-d H:i:s')]]);
        }
        redirect($_SERVER['HTTP_REFERER'] ?? 'dashboard');
    }

    public function delete($id) {
        $comment = $this->commentModel->findById($id);
        if ($comment && ($comment['user_id'] == $_SESSION['user_id'] || canAdmin())) {
            $this->commentModel->delete($id);
        }
        if (!empty($_SERVER['HTTP_X_REQUESTED_WITH'])) json_response(['success' => true]);
        redirect($_SERVER['HTTP_REFERER'] ?? 'dashboard');
    }
}
