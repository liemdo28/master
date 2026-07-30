<?php
/**
 * TaskAuditController — admin-only review of tasks completed without
 * evidence, and recurring tasks whose completion never spawned a
 * follow-up occurrence. Admin can flag a task, attach proof, and resolve.
 */
class TaskAuditController {
    private TaskAudit $model;

    public function __construct() {
        $this->model = new TaskAudit();
    }

    public function index(): void {
        if (!isAdmin()) { redirect('overview'); return; }

        $pageTitle    = 'Task Audit';
        $currentPage  = 'task-audit-review';
        $suspicious   = $this->model->getSuspiciousCompletions();
        $brokenChains = $this->model->getBrokenFollowups();
        $flags        = $this->model->getFlags();

        $notifications = new Notification();
        $unreadCount   = $notifications->getUnreadCount($_SESSION['user_id']);
        $projects      = (new Project())->getByUser($_SESSION['user_id'], true);

        require __DIR__ . '/../views/admin/task_audit_flags.php';
    }

    public function flag(): void {
        if (!isAdmin()) { json_response(['error' => 'Unauthorized'], 403); return; }
        if (!verify_csrf($_POST['csrf_token'] ?? '')) { json_response(['error' => 'Invalid CSRF'], 403); return; }

        $taskId = (int)($_POST['task_id'] ?? 0);
        $type   = $_POST['flag_type'] ?? 'other';
        $note   = trim($_POST['note'] ?? '');

        if ($taskId <= 0) { json_response(['error' => 'Invalid task'], 422); return; }

        $flagId = $this->model->flagTask($taskId, $type, $note, (int)$_SESSION['user_id']);
        json_response(['ok' => true, 'flag_id' => $flagId, 'message' => 'Đã tạo flag audit.']);
    }

    public function resolve(): void {
        if (!isAdmin()) { json_response(['error' => 'Unauthorized'], 403); return; }
        if (!verify_csrf($_POST['csrf_token'] ?? '')) { json_response(['error' => 'Invalid CSRF'], 403); return; }

        $flagId = (int)($_POST['flag_id'] ?? 0);
        $note   = trim($_POST['note'] ?? '');
        if ($flagId <= 0) { json_response(['error' => 'Invalid flag'], 422); return; }

        $this->model->resolveFlag($flagId, (int)$_SESSION['user_id'], $note);
        json_response(['ok' => true, 'message' => 'Đã xử lý flag.']);
    }

    public function uploadEvidence(): void {
        if (!isAdmin()) { json_response(['error' => 'Unauthorized'], 403); return; }
        if (!verify_csrf($_POST['csrf_token'] ?? '')) { json_response(['error' => 'Invalid CSRF'], 403); return; }

        $flagId = (int)($_POST['flag_id'] ?? 0);
        $flag   = $flagId > 0 ? $this->model->getFlagById($flagId) : null;
        if (!$flag) { json_response(['error' => 'Flag not found'], 404); return; }

        if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            json_response(['error' => 'Upload thất bại.'], 400);
            return;
        }

        $file = $_FILES['file'];
        [$ok, $mimeOrError] = $this->model->isAllowedUpload($file);
        if (!$ok) { json_response(['error' => $mimeOrError], 400); return; }

        $storedPath = $this->model->storeEvidenceFile($file, $mimeOrError);
        if (!$storedPath) { json_response(['error' => 'Không lưu được file.'], 500); return; }

        $id = $this->model->addEvidence($flagId, [
            'filename'      => $storedPath,
            'original_name' => $file['name'],
            'file_size'     => $file['size'],
            'mime_type'     => $mimeOrError,
        ], (int)$_SESSION['user_id']);

        json_response(['ok' => true, 'id' => $id]);
    }

    public function downloadEvidence(int $id): void {
        if (!isAdmin()) { redirect('overview'); return; }

        $ev = $this->model->findEvidence($id);
        if (!$ev) { redirect('admin/task-audit'); return; }

        $fp = rtrim(UPLOAD_DIR, '/\\') . '/' . $ev['filename'];
        if (!file_exists($fp)) { redirect('admin/task-audit'); return; }

        header('Content-Type: ' . ($ev['mime_type'] ?? 'application/octet-stream'));
        header('Content-Disposition: attachment; filename="' . addslashes($ev['original_name']) . '"');
        header('Content-Length: ' . filesize($fp));
        readfile($fp);
        exit;
    }
}
