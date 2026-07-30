<?php
class DeadlineExtensionController {
    private DeadlineExtension $model;

    public function __construct() {
        $this->model = new DeadlineExtension();
    }

    // ── POST /api/tasks/{id}/extend ───────────────────────────────
    // Self-extension: new_deadline ≤ current + 3 days → auto-approved.
    public function selfExtend(int $taskId): void {
        if (!isLoggedIn()) { json_response(['error' => 'Unauthorized'], 401); return; }
        $this->verifyCsrf();

        $newDeadline = trim($_POST['new_deadline'] ?? '');
        if (!$newDeadline || !$this->validDate($newDeadline)) {
            json_response(['error' => 'Invalid date format (expected YYYY-MM-DD)'], 422);
            return;
        }

        $result = $this->model->selfExtend($taskId, (int)$_SESSION['user_id'], $newDeadline);
        json_response($result, $result['ok'] ? 200 : 422);
    }

    // ── POST /api/tasks/{id}/extend-request ──────────────────────
    // Extension request: new_deadline > current + 3 days → pending approval.
    public function requestExtend(int $taskId): void {
        if (!isLoggedIn()) { json_response(['error' => 'Unauthorized'], 401); return; }
        $this->verifyCsrf();

        $newDeadline = trim($_POST['new_deadline'] ?? '');
        $reason      = trim($_POST['reason'] ?? '');
        if (!$newDeadline || !$this->validDate($newDeadline)) {
            json_response(['error' => 'Invalid date format (expected YYYY-MM-DD)'], 422);
            return;
        }

        $result = $this->model->requestExtend($taskId, (int)$_SESSION['user_id'], $newDeadline, $reason);
        json_response($result, $result['ok'] ? 200 : 422);
    }

    // ── POST /api/extensions/{id}/approve ────────────────────────
    public function approve(int $extensionId): void {
        if (!isManager()) { json_response(['error' => 'Unauthorized'], 403); return; }
        $this->verifyCsrf();

        $result = $this->model->approve($extensionId, (int)$_SESSION['user_id']);
        json_response($result, $result['ok'] ? 200 : 422);
    }

    // ── POST /api/extensions/{id}/reject ─────────────────────────
    public function reject(int $extensionId): void {
        if (!isManager()) { json_response(['error' => 'Unauthorized'], 403); return; }
        $this->verifyCsrf();

        $reason = trim($_POST['reason'] ?? '');
        $result = $this->model->reject($extensionId, (int)$_SESSION['user_id'], $reason);
        json_response($result, $result['ok'] ? 200 : 422);
    }

    // ── GET /api/extensions/pending-count ────────────────────────
    public function pendingCount(): void {
        if (!isManager()) { json_response(['count' => 0]); return; }
        json_response(['count' => $this->model->getPendingCount()]);
    }

    // ── GET /admin/extensions ─────────────────────────────────────
    public function adminIndex(): void {
        if (!isManager()) { redirect('overview'); return; }

        $pending = [];
        $all = [];
        try { $pending = $this->model->getPendingRequests(); } catch (\Throwable $e) { error_log('[Extensions] getPending: ' . $e->getMessage()); }
        try { $all = $this->model->getAllForAdmin(); } catch (\Throwable $e) { error_log('[Extensions] getAll: ' . $e->getMessage()); }
        $unreadCount = 0;
        try {
            $notifications = new Notification();
            $unreadCount   = $notifications->getUnreadCount($_SESSION['user_id']);
        } catch (\Throwable $e) {}
        $projects = [];
        try { $projects = (new Project())->getByUser($_SESSION['user_id'], true); } catch (\Throwable $e) {}

        require __DIR__ . '/../views/admin/extension_requests.php';
    }

    // ── Private helpers ───────────────────────────────────────────
    private function verifyCsrf(): void {
        $token = $_POST['csrf_token'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
        if (!verify_csrf($token)) {
            json_response(['error' => 'Invalid CSRF token'], 403);
            exit;
        }
    }

    private function validDate(string $date): bool {
        $d = \DateTime::createFromFormat('Y-m-d', $date);
        return $d && $d->format('Y-m-d') === $date;
    }
}
