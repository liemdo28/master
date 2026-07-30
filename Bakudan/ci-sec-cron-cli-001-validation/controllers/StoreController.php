<?php
class StoreController {
    private $storeModel;
    private $billModel;

    public function __construct() {
        $this->storeModel = new Store();
        $this->billModel = new Bill();
    }

    public function index() {
        try {
            $stores = $this->storeModel->allActive();
        } catch (\Throwable $e) {
            error_log('[STORE-ADMIN] allActive() failed: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
            $stores = [];
        }

        try {
            $billCounts = $this->billModel->countByStore();
        } catch (\Throwable $e) {
            error_log('[STORE-ADMIN] countByStore() failed: ' . $e->getMessage());
            $billCounts = [];
        }

        $billCountMap = [];
        foreach ($billCounts as $bc) {
            $billCountMap[$bc['store_id']] = $bc;
        }
        require __DIR__ . '/../views/admin/stores.php';
    }

    public function create() {
        if (!verify_csrf($_POST['csrf'] ?? '')) { flash('error', 'Invalid CSRF'); redirect('admin/stores'); }
        $name = trim($_POST['name'] ?? '');
        if ($name === '') { flash('error', t('auth.fill_required')); redirect('admin/stores'); }
        $this->storeModel->create([
            'name' => $name,
            'address' => trim($_POST['address'] ?? ''),
            'color' => trim($_POST['color'] ?? ''),
        ]);
        flash('success', 'Store created');
        redirect('admin/stores');
    }

    public function update($id) {
        if (!verify_csrf($_POST['csrf'] ?? '')) { flash('error', 'Invalid CSRF'); redirect('admin/stores'); }
        $store = $this->storeModel->find($id);
        if (!$store) { flash('error', 'Store not found'); redirect('admin/stores'); }
        $name = trim($_POST['name'] ?? '');
        if ($name === '') { flash('error', t('auth.fill_required')); redirect('admin/stores'); }
        $this->storeModel->update($id, [
            'name' => $name,
            'address' => trim($_POST['address'] ?? ''),
            'color' => trim($_POST['color'] ?? ''),
        ]);
        flash('success', 'Store updated');
        redirect('admin/stores');
    }

    /**
     * Store detail page — shows projects + all tasks of this store.
     */
    public function show($id) {
        $store = $this->storeModel->find($id);
        if (!$store) { flash('error', 'Store not found'); redirect('admin/stores'); }

        $db = Database::getInstance();
        $today = DateService::today();

        // Projects under this store
        $projects = $db->fetchAll(
            "SELECT p.*, COUNT(DISTINCT t.id) as task_count,
                    SUM(CASE WHEN t.is_completed = 1 THEN 1 ELSE 0 END) as completed_count,
                    SUM(CASE WHEN t.is_completed = 0 AND t.due_date < ? THEN 1 ELSE 0 END) as overdue_count
             FROM projects p
             LEFT JOIN tasks t ON t.project_id = p.id
             WHERE p.store_id = ?
             GROUP BY p.id
             ORDER BY p.name ASC",
            [$today, $id]
        );

        // All tasks under this store's projects
        $tasks = $db->fetchAll(
            "SELECT t.*, p.name as project_name, p.color as project_color, u.name as assignee_name, u.avatar as assignee_avatar
             FROM tasks t
             LEFT JOIN projects p ON t.project_id = p.id
             LEFT JOIN users u ON t.assignee_id = u.id
             WHERE p.store_id = ?
             ORDER BY t.is_completed ASC, t.due_date IS NULL, t.due_date ASC, t.created_at DESC",
            [$id]
        );

        // Stats
        $stats = [
            'total' => count($tasks),
            'completed' => 0, 'overdue' => 0, 'today' => 0, 'upcoming' => 0, 'recurring' => 0,
            'projects_count' => count($projects),
        ];
        foreach ($tasks as $t) {
            if ($t['is_completed']) { $stats['completed']++; continue; }
            if (!empty($t['repeat_type']) && $t['repeat_type'] !== 'none') $stats['recurring']++;
            if (!empty($t['due_date'])) {
                if ($t['due_date'] < $today) $stats['overdue']++;
                elseif ($t['due_date'] === $today) $stats['today']++;
                else $stats['upcoming']++;
            }
        }

        // Top assignees in this store
        $topAssignees = $db->fetchAll(
            "SELECT u.id, u.name, u.avatar,
                    COUNT(t.id) as task_count,
                    SUM(CASE WHEN t.is_completed = 0 AND t.due_date < ? THEN 1 ELSE 0 END) as overdue_count
             FROM tasks t
             JOIN users u ON t.assignee_id = u.id
             JOIN projects p ON t.project_id = p.id
             WHERE p.store_id = ?
             GROUP BY u.id
             ORDER BY task_count DESC
             LIMIT 10",
            [$today, $id]
        );

        require __DIR__ . '/../views/admin/store_detail.php';
    }

    public function delete($id) {
        $store = $this->storeModel->find($id);
        if (!$store) { flash('error', 'Store not found'); redirect('admin/stores'); }
        $this->storeModel->delete($id);
        flash('success', 'Store deleted');
        redirect('admin/stores');
    }

    /**
     * Admin Data Hygiene page — shows finance-pattern projects, duplicate stores,
     * ungrouped projects, and provides one-click cleanup actions.
     */
    public function dataHygiene() {
        if (!isAdmin()) { redirect('dashboard'); return; }
        $db = Database::getInstance();

        // ── Finance-pattern projects (candidates to convert to bills) ──
        $financeKeywords = ['pge','pg&e','qb tax','quickbooks','sale tax','sales tax',
                            'prepayment','amtrust','insurance','payroll','salary','rent','lease','general'];
        $allActiveProjects = $db->fetchAll(
            "SELECT p.id, p.name, p.color, p.store_id, p.status, p.asana_gid,
                    s.name as store_name, s.color as store_color,
                    (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count
             FROM projects p
             LEFT JOIN stores s ON p.store_id = s.id
             WHERE p.status = 'active' OR p.status IS NULL
             ORDER BY p.name ASC"
        );

        $financeProjects = [];
        foreach ($allActiveProjects as $p) {
            $n = strtolower($p['name']);
            foreach ($financeKeywords as $kw) {
                if (strpos($n, $kw) !== false) {
                    $financeProjects[] = $p;
                    break;
                }
            }
        }

        // ── Ungrouped projects (no store_id, with tasks) ──
        $ungroupedProjects = array_filter($allActiveProjects, function($p) {
            return empty($p['store_id']) && (int)$p['task_count'] > 0;
        });
        $ungroupedProjects = array_values($ungroupedProjects);

        // ── All stores for merge UI ──
        $allStores = $db->fetchAll(
            "SELECT s.*, COUNT(DISTINCT p.id) as project_count, COUNT(DISTINCT b.id) as bill_count
             FROM stores s
             LEFT JOIN projects p ON p.store_id = s.id AND (p.status = 'active' OR p.status IS NULL)
             LEFT JOIN bills b ON b.store_id = s.id
             GROUP BY s.id
             ORDER BY s.name ASC"
        );

        // ── Detect likely duplicate store pairs (name substring overlap) ──
        $duplicatePairs = [];
        $checkedPairs = [];
        foreach ($allStores as $a) {
            foreach ($allStores as $b) {
                if ($a['id'] === $b['id']) continue;
                $pairKey = min($a['id'], $b['id']) . '-' . max($a['id'], $b['id']);
                if (isset($checkedPairs[$pairKey])) continue;
                $checkedPairs[$pairKey] = true;

                $aWords = array_filter(preg_split('/[\s\-_]+/', strtolower($a['name'])));
                $bName  = strtolower($b['name']);
                $overlap = 0;
                foreach ($aWords as $w) {
                    if (strlen($w) >= 3 && strpos($bName, $w) !== false) $overlap++;
                }
                if ($overlap >= 1 && $overlap >= count($aWords) * 0.5) {
                    $duplicatePairs[] = [
                        'a' => $a,
                        'b' => $b,
                        'overlap' => $overlap,
                    ];
                }
            }
        }

        $notifications = (new Notification())->getUnreadCount($_SESSION['user_id']);
        $unreadCount = $notifications;
        $projects = (new Project())->getByUser($_SESSION['user_id'], true);
        require __DIR__ . '/../views/admin/data_hygiene.php';
    }

    /**
     * Merge sourceId store into targetId store.
     * Moves all projects + bills, then deactivates source.
     */
    public function mergeStores() {
        if (!isAdmin()) { flash('error', 'Unauthorized'); redirect('admin/data-hygiene'); return; }

        $db = Database::getInstance();
        $sourceId = (int)($_POST['source_id'] ?? 0);
        $targetId = (int)($_POST['target_id'] ?? 0);

        if (!$sourceId || !$targetId || $sourceId === $targetId) {
            flash('error', 'Select two different stores.');
            redirect('admin/data-hygiene');
            return;
        }

        $source = $this->storeModel->find($sourceId);
        $target = $this->storeModel->find($targetId);
        if (!$source || !$target) { flash('error', 'Store not found.'); redirect('admin/data-hygiene'); return; }

        // Move projects
        $movedProjects = $db->execute(
            "UPDATE projects SET store_id = ? WHERE store_id = ?",
            [$targetId, $sourceId]
        );

        // Move bills
        $movedBills = $db->execute(
            "UPDATE bills SET store_id = ? WHERE store_id = ?",
            [$targetId, $sourceId]
        );

        // Deactivate source store
        $db->execute("UPDATE stores SET is_active = 0 WHERE id = ?", [$sourceId]);

        flash('success', "Merged \"{$source['name']}\" into \"{$target['name']}\". Moved {$movedProjects} projects and {$movedBills} bills.");
        redirect('admin/data-hygiene');
    }
}
