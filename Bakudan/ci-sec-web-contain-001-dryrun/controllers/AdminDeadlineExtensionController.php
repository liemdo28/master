<?php
class AdminDeadlineExtensionController {
    private DeadlineExtensionService $service;

    public function __construct() {
        if (!isAdmin() && !isManager()) {
            json_response(['error' => 'Forbidden'], 403);
        }
        $this->service = new DeadlineExtensionService();
    }

    /**
     * GET /admin/deadline-extensions
     * Admin list page
     */
    public function index(): void {
        $model        = new DeadlineExtension();
        $statusFilter = $_GET['status'] ?? '';
        $extensions   = $model->getAll(50, 0, $statusFilter);
        $pending      = $model->getPendingForAdmin();
        require __DIR__ . '/../views/deadline_extensions/admin_list.php';
    }

    /**
     * POST /api/admin/deadline-extensions/{id}/approve
     */
    public function apiApprove(int $id): void {
        $validator = new ApproveDeadlineExtensionValidator();
        $errors    = $validator->validate(['extension_id' => $id]);
        if ($errors) { json_response(['error' => implode(' ', $errors)], 422); }

        if (!verify_csrf($_POST['csrf_token'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) {
            json_response(['error' => 'Invalid CSRF token'], 403);
        }

        try {
            $result = $this->service->approve($id, (int)$_SESSION['user_id'], trim($_POST['note'] ?? ''));
            json_response($result);
        } catch (\RuntimeException $e) {
            json_response(['error' => $e->getMessage()], 422);
        }
    }

    /**
     * POST /api/admin/deadline-extensions/{id}/reject
     */
    public function apiReject(int $id): void {
        $validator = new RejectDeadlineExtensionValidator();
        $errors    = $validator->validate(['extension_id' => $id, 'note' => $_POST['note'] ?? '']);
        if ($errors) { json_response(['error' => implode(' ', $errors)], 422); }

        if (!verify_csrf($_POST['csrf_token'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) {
            json_response(['error' => 'Invalid CSRF token'], 403);
        }

        try {
            $result = $this->service->reject($id, (int)$_SESSION['user_id'], trim($_POST['note'] ?? ''));
            json_response($result);
        } catch (\RuntimeException $e) {
            json_response(['error' => $e->getMessage()], 422);
        }
    }

    /**
     * GET /api/admin/deadline-extensions/pending
     */
    public function apiPending(): void {
        $model = new DeadlineExtension();
        json_response(['extensions' => $model->getPendingForAdmin(), 'count' => $model->countPending()]);
    }
}
