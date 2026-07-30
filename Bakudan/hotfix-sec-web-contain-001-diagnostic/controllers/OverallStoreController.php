<?php
/**
 * OverallStoreController
 * Handles the Overall Store Dashboard - CEO/Admin/Manager view
 * of all store operational status at a glance.
 */

require_once __DIR__ . '/../models/OverallStore.php';
require_once __DIR__ . '/../models/Store.php';

class OverallStoreController {

    private $model;

    public function __construct() {
        $this->model = new OverallStore();
    }

    /**
     * Main dashboard view - all stores with health status.
     * GET /overall-store
     */
    public function index() {
        $user = currentUser();
        $userId = $user['id'] ?? 0;
        $role = $user['role'] ?? 'member';

        $stores = $this->model->getEnrichedStores($userId, $role);

        // Compute summary KPIs
        $summary = [
            'total_stores' => count($stores),
            'red_count' => 0,
            'yellow_count' => 0,
            'green_count' => 0,
            'gray_count' => 0,
            'total_overdue_tasks' => 0,
            'total_overdue_bills' => 0,
            'total_open_tasks' => 0,
            'total_open_bills' => 0,
        ];
        foreach ($stores as $s) {
            $color = $s['health_color'] ?? 'gray';
            $summary[$color . '_count']++;
            $summary['total_overdue_tasks'] += $s['overdue_tasks'] ?? 0;
            $summary['total_overdue_bills'] += $s['overdue_bills'] ?? 0;
            $summary['total_open_tasks'] += $s['open_tasks'] ?? 0;
            $summary['total_open_bills'] += $s['open_bills'] ?? 0;
        }

        $pageTitle = 'Overall Store';
        $currentPage = 'overall-store';

        ob_start();
        require __DIR__ . '/../views/admin/overall_store/index.php';
        $content = ob_get_clean();

        require __DIR__ . '/../views/layouts/main.php';
    }

    /**
     * Store detail drawer data (AJAX JSON).
     * GET /api/overall-store/{id}
     */
    public function apiStoreDetail($storeId) {
        header('Content-Type: application/json');
        try {
            if (!isLoggedIn() || !canManage()) {
                http_response_code(403);
                echo json_encode(['success' => false, 'error' => 'Access denied']);
                exit;
            }
            $user = currentUser();
            $userId = $user['id'] ?? 0;
            $role = $user['role'] ?? 'member';

            // Permission check: managers can only access assigned stores
            if (strtolower($role) === 'manager') {
                $accessibleIds = $this->model->getAccessibleStoreIds($userId, $role);
                if (!in_array((int)$storeId, $accessibleIds)) {
                    http_response_code(403);
                    echo json_encode(['success' => false, 'error' => 'Access denied to this store']);
                    exit;
                }
            }

            $detail = $this->model->getStoreDetail($storeId, $userId, $role);
            if (!$detail) {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'Store not found']);
                exit;
            }

            echo json_encode(['success' => true, 'data' => $detail]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Server error']);
            error_log('[OverallStoreController] apiStoreDetail: ' . $e->getMessage());
        }
        exit;
    }

    /**
     * Store tasks list for drilldown.
     * GET /api/overall-store/{id}/tasks?filter=overdue|due_today|open|completed
     */
    public function apiStoreTasks($storeId, $filter = 'open') {
        header('Content-Type: application/json');
        try {
            if (!isLoggedIn() || !canManage()) {
                http_response_code(403);
                echo json_encode(['success' => false, 'error' => 'Access denied']);
                exit;
            }
            $user = currentUser();
            $userId = $user['id'] ?? 0;
            $role = $user['role'] ?? 'member';

            // Permission check
            if (strtolower($role) === 'manager') {
                $accessibleIds = $this->model->getAccessibleStoreIds($userId, $role);
                if (!in_array((int)$storeId, $accessibleIds)) {
                    http_response_code(403);
                    echo json_encode(['success' => false, 'error' => 'Access denied']);
                    exit;
                }
            }

            $today = date('Y-m-d');
            $tasks = $this->model->getStoreTasks($storeId, $today);
            
            // Filter based on request
            switch ($filter) {
                case 'overdue':
                    $tasks = array_filter($tasks, function($t) use ($today) {
                        return $t['is_completed'] == 0 && $t['due_date'] < $today;
                    });
                    break;
                case 'due_today':
                    $tasks = array_filter($tasks, function($t) use ($today) {
                        return $t['is_completed'] == 0 && $t['due_date'] == $today;
                    });
                    break;
                case 'completed':
                    $tasks = $this->model->getStoreCompletedTasks($storeId);
                    break;
                case 'open':
                default:
                    $tasks = array_filter($tasks, function($t) {
                        return $t['is_completed'] == 0;
                    });
                    break;
            }

            echo json_encode(['success' => true, 'data' => array_values($tasks)]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Server error']);
        }
        exit;
    }

    /**
     * Store bills list for drilldown.
     * GET /api/overall-store/{id}/bills?filter=overdue|unpaid|all
     */
    public function apiStoreBills($storeId, $filter = 'all') {
        header('Content-Type: application/json');
        try {
            if (!isLoggedIn() || !canManage()) {
                http_response_code(403);
                echo json_encode(['success' => false, 'error' => 'Access denied']);
                exit;
            }
            $user = currentUser();
            $userId = $user['id'] ?? 0;
            $role = $user['role'] ?? 'member';

            if (strtolower($role) === 'manager') {
                $accessibleIds = $this->model->getAccessibleStoreIds($userId, $role);
                if (!in_array((int)$storeId, $accessibleIds)) {
                    http_response_code(403);
                    echo json_encode(['success' => false, 'error' => 'Access denied']);
                    exit;
                }
            }

            $bills = $this->model->getStoreBills($storeId);

            switch ($filter) {
                case 'overdue':
                    $bills = array_filter($bills, function($b) { return ($b['status'] ?? '') === 'overdue'; });
                    break;
                case 'unpaid':
                    $bills = array_filter($bills, function($b) { return in_array($b['status'] ?? '', ['pending', 'overdue', 'unpaid']); });
                    break;
                case 'all':
                default:
                    break;
            }

            echo json_encode(['success' => true, 'data' => array_values($bills)]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Server error']);
        }
        exit;
    }

    /**
     * Store month calendar data for drawer.
     * GET /api/overall-store/{id}/calendar?month=7&year=2026
     */
    public function apiStoreCalendar($storeId) {
        header('Content-Type: application/json');
        try {
            if (!isLoggedIn() || !canManage()) {
                http_response_code(403);
                echo json_encode(['success' => false, 'error' => 'Access denied']);
                exit;
            }
            $user = currentUser();
            $userId = $user['id'] ?? 0;
            $role = $user['role'] ?? 'member';

            if (strtolower($role) === 'manager') {
                $accessibleIds = $this->model->getAccessibleStoreIds($userId, $role);
                if (!in_array((int)$storeId, $accessibleIds)) {
                    http_response_code(403);
                    echo json_encode(['success' => false, 'error' => 'Access denied']);
                    exit;
                }
            }

            $month = (int)($_GET['month'] ?? date('n'));
            $year = (int)($_GET['year'] ?? date('Y'));
            echo json_encode(['success' => true, 'data' => $this->model->getStoreCalendarItems($storeId, $month, $year)]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Server error']);
            error_log('[OverallStoreController] apiStoreCalendar: ' . $e->getMessage());
        }
        exit;
    }
}
