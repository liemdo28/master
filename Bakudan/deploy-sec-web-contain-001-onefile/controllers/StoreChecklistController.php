<?php
/**
 * Phase 11 — Module 5 & 6: Store Opening / Closing System
 * 
 * Standardized checklists for store opening and closing.
 * /store/checklist/open, /store/checklist/close
 */
require_once __DIR__ . '/../models/Task.php';
require_once __DIR__ . '/../models/Store.php';

class StoreChecklistController
{
    private $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    /**
     * GET /store/checklist/open
     */
    public function open(): void
    {
        $stores = (new Store())->allActive();
        $today = DateService::today();

        // Check if any store was opened today
        $openedToday = $this->db->fetchAll(
            "SELECT * FROM store_checklists WHERE type = 'open' AND DATE(opened_at) = CURDATE()"
        );

        $content = $this->renderView('open', [
            'stores' => $stores,
            'openedToday' => $openedToday,
            'today' => $today,
        ]);

        $pageTitle = 'Open Store';
        $currentPage = 'store-checklist';
        require __DIR__ . '/../views/layouts/main.php';
    }

    /**
     * POST /store/checklist/open — Submit opening checklist
     */
    public function submitOpen(): void
    {
        if (!canManage()) json_response(['error' => 'Unauthorized'], 403);

        $storeId = (int)($_POST['store_id'] ?? 0);
        if (!$storeId) json_response(['error' => 'Store required'], 422);

        $checklist = $_POST['checklist'] ?? [];
        $notes = trim($_POST['notes'] ?? '');
        $openedBy = (int)$_SESSION['user_id'];

        $items = [
            'lights' => !empty($checklist['lights']),
            'pos' => !empty($checklist['pos']),
            'inventory' => !empty($checklist['inventory']),
            'cash_drawer' => !empty($checklist['cash_drawer']),
            'cleaning' => !empty($checklist['cleaning']),
            'temperature' => !empty($checklist['temperature']),
            'staffing' => !empty($checklist['staffing']),
            'supplies' => !empty($checklist['supplies']),
        ];

        $allChecked = count(array_filter($items)) === count($items);

        $this->db->query(
            "INSERT INTO store_checklists (store_id, type, items, notes, opened_by, opened_at)
             VALUES (?, 'open', ?, ?, ?, NOW())",
            [$storeId, json_encode($items), $notes, $openedBy]
        );

        // Log as task if requested
        if (!empty($_POST['create_task'])) {
            $store = $this->db->fetch("SELECT name FROM stores WHERE id = ?", [$storeId]);
            (new Task())->create([
                'title' => 'Opening Checklist: ' . ($store['name'] ?? 'Store'),
                'due_date' => DateService::today(),
                'status' => $allChecked ? 'done' : 'todo',
                'priority' => 'high',
                'project_id' => null,
                'assignee_id' => $openedBy,
                'description' => 'Opening checklist completed. All items: ' . ($allChecked ? 'YES' : 'NO'),
            ]);
        }

        flash('success', 'Opening checklist submitted successfully');
        redirect('/store/checklist/open');
    }

    /**
     * GET /store/checklist/close
     */
    public function close(): void
    {
        $stores = (new Store())->allActive();
        $today = DateService::today();

        $closedToday = $this->db->fetchAll(
            "SELECT * FROM store_checklists WHERE type = 'close' AND DATE(closed_at) = CURDATE()"
        );

        $content = $this->renderView('close', [
            'stores' => $stores,
            'closedToday' => $closedToday,
            'today' => $today,
        ]);

        $pageTitle = 'Close Store';
        $currentPage = 'store-checklist';
        require __DIR__ . '/../views/layouts/main.php';
    }

    /**
     * POST /store/checklist/close — Submit closing checklist
     */
    public function submitClose(): void
    {
        if (!canManage()) json_response(['error' => 'Unauthorized'], 403);

        $storeId = (int)($_POST['store_id'] ?? 0);
        if (!$storeId) json_response(['error' => 'Store required'], 422);

        $checklist = $_POST['checklist'] ?? [];
        $notes = trim($_POST['notes'] ?? '');
        $cashCount = (float)($_POST['cash_count'] ?? 0);
        $closedBy = (int)$_SESSION['user_id'];

        $items = [
            'cleaning' => !empty($checklist['cleaning']),
            'cash_count' => !empty($checklist['cash_count']),
            'inventory' => !empty($checklist['inventory']),
            'security' => !empty($checklist['security']),
            'equipment_off' => !empty($checklist['equipment_off']),
            'trash' => !empty($checklist['trash']),
            'alarms' => !empty($checklist['alarms']),
            'last_check' => !empty($checklist['last_check']),
        ];

        $allChecked = count(array_filter($items)) === count($items);

        $this->db->query(
            "INSERT INTO store_checklists (store_id, type, items, notes, cash_count, closed_by, closed_at)
             VALUES (?, 'close', ?, ?, ?, ?, NOW())",
            [$storeId, json_encode($items), $notes, $cashCount, $closedBy]
        );

        flash('success', 'Closing checklist submitted. Cash count: $' . number_format($cashCount, 2));
        redirect('/store/checklist/close');
    }

    /**
     * GET /store/checklist/history
     */
    public function history(): void
    {
        if (!canManage()) {
            header('Location: /dashboard');
            exit;
        }

        $storeId = (int)($_GET['store_id'] ?? 0);
        $type = $_GET['type'] ?? '';

        $query = "SELECT sc.*, s.name as store_name, u.name as opened_by_name, u2.name as closed_by_name
                  FROM store_checklists sc
                  LEFT JOIN stores s ON sc.store_id = s.id
                  LEFT JOIN users u ON sc.opened_by = u.id
                  LEFT JOIN users u2 ON sc.closed_by = u2.id
                  WHERE 1=1";

        $params = [];
        if ($storeId) { $query .= " AND sc.store_id = ?"; $params[] = $storeId; }
        if ($type) { $query .= " AND sc.type = ?"; $params[] = $type; }
        $query .= " ORDER BY sc.opened_at DESC LIMIT 100";

        $history = $this->db->fetchAll($query, $params);
        $stores = (new Store())->allActive();

        $content = $this->renderView('history', [
            'history' => $history,
            'stores' => $stores,
            'selectedStore' => $storeId,
            'selectedType' => $type,
        ]);

        $pageTitle = 'Checklist History';
        $currentPage = 'store-checklist';
        require __DIR__ . '/../views/layouts/main.php';
    }

    private function renderView(string $template, array $vars = []): string
    {
        extract($vars);
        ob_start();
        include __DIR__ . '/../views/store/checklist/' . $template . '.php';
        return ob_get_clean();
    }
}
