<?php
/**
 * StoreCommandController — Store Command Center
 *
 * /admin/store-command           → index (all stores)
 * /admin/stores/{id}             → show (single store)
 * /admin/stores/{id}/edit        → edit form
 * /admin/store-command/{id}/health → API: health score JSON
 * /admin/store-command/{id}/stats  → API: stats JSON
 */
require_once __DIR__ . '/../models/StoreCommand.php';
require_once __DIR__ . '/../models/User.php';

class StoreCommandController
{
    private $storeCommand;
    private $userModel;

    public function __construct()
    {
        $this->storeCommand = new StoreCommand();
        $this->userModel = new User();
    }

    private function requireManager(): void
    {
        if (!canManage()) {
            header('Location: /dashboard');
            exit;
        }
    }

    /**
     * GET /admin/store-command — All stores with health scores + enriched data
     */
    public function index(): void
    {
        $this->requireManager();

        $user = currentUser();
        $userId   = $user ? (int)$user['id'] : null;
        $userRole = $user ? $user['role'] : null;

        // Permission: managers see only their assigned stores; admin/CEO see all
        try {
            $stores = $this->storeCommand->getEnrichedStores($userId, $userRole);
        } catch (\Throwable $e) {
            error_log('[STORE-COMMAND] getEnrichedStores failed: ' . $e->getMessage());
            $stores = [];
        }

        // Pre-calculate health scores — defensive per-store
        foreach ($stores as &$store) {
            try {
                $health = $this->storeCommand->calculateHealthScore((int)$store['id']);
                $store['health_score'] = $health['score'];
                $store['health_grade'] = $health['grade'];
            } catch (\Throwable $e) {
                error_log('[STORE-COMMAND] calculateHealthScore failed for store ' . $store['id'] . ': ' . $e->getMessage());
                $store['health_score'] = 0;
                $store['health_grade'] = 'F';
            }
        }
        unset($store);

        $pageTitle   = 'Store Command Center';
        $currentPage = 'store-command';
        ob_start();
        require __DIR__ . '/../views/admin/store_command/index.php';
        $content = ob_get_clean();
        require __DIR__ . '/../views/layouts/main.php';
    }

    /**
     * GET /admin/stores/{id} — Store detail page
     */
    public function show(int $storeId): void
    {
        $this->requireManager();

        $store = $this->storeCommand->find($storeId);
        if (!$store) {
            $_SESSION['flash'] = ['type' => 'error', 'message' => 'Store not found'];
            header('Location: /admin/store-command');
            exit;
        }

        $defaults = ['total' => 0, 'overdue' => 0, 'due_today' => 0, 'critical' => 0, 'active_employees' => 0];
        try { $taskStats = $this->storeCommand->getTaskStats($storeId); } catch (\Throwable $e) { error_log('[STORE-COMMAND] getTaskStats failed: ' . $e->getMessage()); $taskStats = $defaults; }
        try { $billStats = $this->storeCommand->getBillStats($storeId); } catch (\Throwable $e) { error_log('[STORE-COMMAND] getBillStats failed: ' . $e->getMessage()); $billStats = ['total_bills' => 0, 'overdue_bills' => 0, 'total_due' => 0]; }
        try { $incidentStats = $this->storeCommand->getIncidentStats($storeId); } catch (\Throwable $e) { error_log('[STORE-COMMAND] getIncidentStats failed: ' . $e->getMessage()); $incidentStats = ['total' => 0, 'open' => 0, 'critical' => 0]; }
        try { $recentActivity = $this->storeCommand->getRecentActivity($storeId, 15); } catch (\Throwable $e) { error_log('[STORE-COMMAND] getRecentActivity failed: ' . $e->getMessage()); $recentActivity = []; }
        try { $health = $this->storeCommand->calculateHealthScore($storeId); } catch (\Throwable $e) { error_log('[STORE-COMMAND] calculateHealthScore failed: ' . $e->getMessage()); $health = ['score' => 0, 'grade' => 'F', 'metrics' => []]; }

        // Get team members for this store
        $db = Database::getInstance();
        $teamMembers = $db->fetchAll(
            "SELECT u.id, u.name, u.email, u.avatar, u.role
             FROM users u
             WHERE u.store_id = ? AND u.is_active = 1
             ORDER BY u.name ASC",
            [$storeId]
        );

        // Get today's tasks
        $todayTasks = $db->fetchAll(
            "SELECT t.id, t.title, t.status, t.priority, t.due_date, t.is_completed,
                    u.name as assignee_name, u.avatar as assignee_avatar
             FROM tasks t
             JOIN projects p ON t.project_id = p.id
             LEFT JOIN users u ON t.assignee_id = u.id
             WHERE p.store_id = ? AND t.due_date = CURDATE() AND t.is_completed = 0
             ORDER BY t.priority DESC, t.due_date ASC
             LIMIT 20",
            [$storeId]
        );

        $pageTitle   = 'Store: ' . ($store['name'] ?? 'Unknown');
        $currentPage = 'store-command';
        ob_start();
        require __DIR__ . '/../views/admin/store_command/show.php';
        $content = ob_get_clean();
        require __DIR__ . '/../views/layouts/main.php';
    }

    /**
     * GET /admin/stores/{id}/edit — Edit store form (admin only)
     */
    public function edit(int $storeId): void
    {
        if (!isAdmin()) { redirect('dashboard'); return; }

        $store = $this->storeCommand->find($storeId);
        if (!$store) { flash('error', 'Store not found'); redirect('admin/store-command'); return; }

        // Get all users for manager assignment
        $db = Database::getInstance();
        $users = $db->fetchAll("SELECT id, name FROM users WHERE is_active = 1 ORDER BY name ASC");

        $pageTitle   = 'Edit Store: ' . ($store['name'] ?? '');
        $currentPage = 'store-command';
        ob_start();
        require __DIR__ . '/../views/admin/store_command/edit.php';
        $content = ob_get_clean();
        require __DIR__ . '/../views/layouts/main.php';
    }

    /**
     * API: GET /admin/store-command/{id}/health — Health score JSON
     */
    public function apiHealthScore(int $storeId): void
    {
        header('Content-Type: application/json');
        try {
            $health = $this->storeCommand->calculateHealthScore($storeId);
            echo json_encode(['success' => true, 'data' => $health]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
    }

    /**
     * API: GET /admin/store-command/{id}/stats — Stats JSON
     */
    public function apiStats(int $storeId): void
    {
        header('Content-Type: application/json');
        try {
            $taskStats     = $this->storeCommand->getTaskStats($storeId);
            $billStats     = $this->storeCommand->getBillStats($storeId);
            $incidentStats = $this->storeCommand->getIncidentStats($storeId);
            echo json_encode([
                'success' => true,
                'data' => [
                    'tasks'     => $taskStats,
                    'bills'     => $billStats,
                    'incidents' => $incidentStats,
                ]
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
    }
}
