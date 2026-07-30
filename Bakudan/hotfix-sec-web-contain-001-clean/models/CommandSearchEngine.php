<?php
/**
 * CommandSearchEngine — Powers the Command Palette (Ctrl+K).
 * Searches pages, stores, bills, tasks, users, actions, AI suggestions.
 * Role-aware result ordering.
 */
class CommandSearchEngine
{
    private $db;
    private string $today;
    private bool $isPriv;   // admin or manager
    private string $role;
    private int $uid;

    public function __construct()
    {
        $this->db     = Database::getInstance();
        $this->today  = function_exists('app_today') ? app_today() : date('Y-m-d');
        $this->isPriv = isAdmin() || isManager();
        $this->role   = $_SESSION['user_role'] ?? 'member';
        $this->uid    = (int)($_SESSION['user_id'] ?? 0);
    }

    /**
     * Main entry. mode = 'search' | 'action' | 'ai'
     */
    public function search(string $q, string $mode = 'search'): array
    {
        $q = trim($q);
        if ($q === '') {
            return $this->defaultState();
        }

        try {
            if ($mode === 'action') {
                return [
                    'query'   => $q,
                    'mode'    => 'action',
                    'pages'   => [],
                    'stores'  => [],
                    'bills'   => [],
                    'tasks'   => [],
                    'users'   => [],
                    'actions' => $this->searchActions($q),
                    'ai'      => [],
                ];
            }

            if ($mode === 'ai') {
                return [
                    'query'   => $q,
                    'mode'    => 'ai',
                    'pages'   => [],
                    'stores'  => [],
                    'bills'   => [],
                    'tasks'   => [],
                    'users'   => [],
                    'actions' => [],
                    'ai'      => $this->searchAI($q),
                ];
            }

            // Default: full search — auto-detect if it looks like an AI question
            $lq = mb_strtolower($q);
            $isQuestion = (
                str_starts_with($lq, 'what') || str_starts_with($lq, 'who') ||
                str_starts_with($lq, 'why')  || str_starts_with($lq, 'how') ||
                str_contains($lq, 'overdue') || str_contains($lq, 'overload') ||
                str_contains($lq, 'next')    || str_contains($lq, 'risk') ||
                str_contains($lq, 'should')
            );

            $result = [
                'query'   => $q,
                'mode'    => 'search',
                'pages'   => $this->searchPages($q),
                'stores'  => $this->searchStores($q, 4),
                'bills'   => $this->isPriv ? $this->searchBills($q, 4) : [],
                'tasks'   => $this->searchTasks($q, 5),
                'users'   => $this->isPriv ? $this->searchUsers($q, 4) : [],
                'actions' => $this->searchActions($q),
                'ai'      => $isQuestion ? $this->searchAI($q) : [],
            ];

            return $result;

        } catch (\Throwable $e) {
            return $this->defaultState($q);
        }
    }

    /**
     * Default state shown when palette opens (no query yet).
     * Shows quick-jump pages + top actions.
     */
    private function defaultState(string $q = ''): array
    {
        return [
            'query'   => $q,
            'mode'    => 'search',
            'pages'   => array_slice($this->allPages(), 0, 6),
            'stores'  => [],
            'bills'   => [],
            'tasks'   => [],
            'users'   => [],
            'actions' => array_slice($this->allActions(), 0, 3),
            'ai'      => [],
        ];
    }

    // ──────────────────────────────────────────────────────────────
    //  PAGES — static route index
    // ──────────────────────────────────────────────────────────────

    private function allPages(): array
    {
        $all = [
            ['label'=>'Overview',        'url'=>'/overview',              'subtitle'=>'Executive command center',        'roles'=>['admin','manager'], 'icon'=>'overview'],
            ['label'=>'Team Load',       'url'=>'/team',                  'subtitle'=>'Team performance & accountability','roles'=>['admin','manager'], 'icon'=>'users'],
            ['label'=>'My Work',         'url'=>'/my-tasks',              'subtitle'=>'Your assigned tasks',             'roles'=>[],                  'icon'=>'check-square'],
            ['label'=>'Today',           'url'=>'/my-tasks?filter=today', 'subtitle'=>'Tasks due today',                 'roles'=>[],                  'icon'=>'calendar'],
            ['label'=>'Overdue Tasks',   'url'=>'/my-tasks?filter=overdue','subtitle'=>'All overdue tasks',              'roles'=>[],                  'icon'=>'clock'],
            ['label'=>'Calendar',        'url'=>'/calendar',              'subtitle'=>'Deadlines & schedule',            'roles'=>[],                  'icon'=>'calendar'],
            ['label'=>'Bills',           'url'=>'/bills',                 'subtitle'=>'Payment management',              'roles'=>[],                  'icon'=>'credit-card'],
            ['label'=>'Overdue Bills',   'url'=>'/bills?filter=overdue',  'subtitle'=>'Unpaid overdue bills',            'roles'=>['admin','manager'], 'icon'=>'wallet'],
            ['label'=>'Projects',        'url'=>'/projects',              'subtitle'=>'All projects',                    'roles'=>['admin','manager'], 'icon'=>'folder'],
            ['label'=>'Stores',          'url'=>'/admin/stores',          'subtitle'=>'Store management',                'roles'=>['admin','manager'], 'icon'=>'store'],
            ['label'=>'Vendors',         'url'=>'/admin/vendors',         'subtitle'=>'Vendor directory',                'roles'=>['admin','manager'], 'icon'=>'building'],
            ['label'=>'Inbox',           'url'=>'/inbox',                 'subtitle'=>'Notifications',                   'roles'=>[],                  'icon'=>'inbox'],
            ['label'=>'Admin Panel',     'url'=>'/admin/users',           'subtitle'=>'User management',                 'roles'=>['admin'],           'icon'=>'admin'],
            ['label'=>'Data Hygiene',    'url'=>'/admin/data-hygiene',    'subtitle'=>'Clean up records',                'roles'=>['admin'],           'icon'=>'filter'],
            ['label'=>'Integrations',    'url'=>'/asana',                 'subtitle'=>'Asana sync & import',             'roles'=>['admin','manager'], 'icon'=>'zap'],
            ['label'=>'Rebalance',       'url'=>'/team#rebalance',        'subtitle'=>'Redistribute workload',           'roles'=>['admin','manager'], 'icon'=>'arrow-left-right'],
        ];

        return array_values(array_filter($all, function($p) {
            if (empty($p['roles'])) return true;
            return in_array($this->role, $p['roles'], true) || $this->isPriv;
        }));
    }

    private function searchPages(string $q): array
    {
        $lq = mb_strtolower($q);
        $pages = $this->allPages();
        $matched = [];
        foreach ($pages as $p) {
            $score = 0;
            $label = mb_strtolower($p['label']);
            $sub   = mb_strtolower($p['subtitle']);
            if (str_contains($label, $lq)) $score += str_starts_with($label, $lq) ? 20 : 10;
            if (str_contains($sub, $lq))   $score += 5;
            if ($score > 0) { $p['_score'] = $score; $matched[] = $p; }
        }
        usort($matched, fn($a,$b) => $b['_score'] <=> $a['_score']);
        return array_slice($matched, 0, 5);
    }

    // ──────────────────────────────────────────────────────────────
    //  ACTIONS — static action index
    // ──────────────────────────────────────────────────────────────

    private function allActions(): array
    {
        $actions = [
            ['label'=>'Create Task',         'subtitle'=>'Add a new task',                         'action'=>'open-create-task',  'icon'=>'check-square', 'roles'=>[]],
            ['label'=>'Rebalance Team',      'subtitle'=>'Open workload redistribution tool',       'action'=>'navigate',          'url'=>'/team#rebalance','icon'=>'arrow-left-right','roles'=>['admin','manager']],
            ['label'=>'View Overdue Bills',  'subtitle'=>'See all unpaid overdue bills',            'action'=>'navigate',          'url'=>'/bills?filter=overdue','icon'=>'wallet','roles'=>['admin','manager']],
            ['label'=>'Command Center',      'subtitle'=>'Open executive overview dashboard',       'action'=>'navigate',          'url'=>'/overview',      'icon'=>'alert-triangle','roles'=>['admin','manager']],
            ['label'=>'Team Dashboard',      'subtitle'=>'See team load & accountability',          'action'=>'navigate',          'url'=>'/team',          'icon'=>'users','roles'=>['admin','manager']],
            ['label'=>'File Tax / Compliance','subtitle'=>'Navigate to compliance filings',         'action'=>'navigate',          'url'=>'/overview#compliance','icon'=>'shield','roles'=>['admin','manager']],
            ['label'=>'View Vendors',        'subtitle'=>'Open vendor directory',                  'action'=>'navigate',          'url'=>'/admin/vendors', 'icon'=>'building','roles'=>['admin','manager']],
            ['label'=>'Bill Templates',      'subtitle'=>'Manage recurring bill templates',         'action'=>'navigate',          'url'=>'/bills/templates','icon'=>'credit-card','roles'=>['admin','manager']],
        ];

        return array_values(array_filter($actions, function($a) {
            if (empty($a['roles'])) return true;
            return in_array($this->role, $a['roles'], true) || $this->isPriv;
        }));
    }

    private function searchActions(string $q): array
    {
        $lq   = mb_strtolower($q);
        $acts = $this->allActions();

        // Action-keyword synonyms
        $synonyms = [
            'pay'       => ['bill','payment','overdue'],
            'rebalance' => ['team','workload','redistribute','nguyen','load'],
            'create'    => ['add','new','task'],
            'file'      => ['tax','compliance','cdtfa','irs','ftb','edd'],
            'open'      => ['go','navigate','view'],
        ];

        $matched = [];
        foreach ($acts as $a) {
            $score = 0;
            $label = mb_strtolower($a['label']);
            $sub   = mb_strtolower($a['subtitle']);
            if (str_contains($label, $lq)) $score += str_starts_with($label, $lq) ? 30 : 15;
            if (str_contains($sub, $lq))   $score += 8;
            // Synonym expansion
            foreach ($synonyms as $kw => $terms) {
                if (str_contains($lq, $kw)) {
                    foreach ($terms as $t) {
                        if (str_contains($label, $t) || str_contains($sub, $t)) { $score += 12; break; }
                    }
                }
            }
            if ($score > 0) { $a['_score'] = $score; $matched[] = $a; }
        }
        usort($matched, fn($a,$b) => $b['_score'] <=> $a['_score']);
        return array_slice($matched, 0, 4);
    }

    // ──────────────────────────────────────────────────────────────
    //  BILLS
    // ──────────────────────────────────────────────────────────────

    private function searchBills(string $q, int $limit = 5): array
    {
        $like = '%' . $q . '%';
        $rows = $this->db->fetchAll(
            "SELECT b.id, b.title, b.vendor, b.amount, b.due_date, b.status,
                    b.category, s.name AS store_name
             FROM bills b
             LEFT JOIN stores s ON s.id = b.store_id
             WHERE (b.title LIKE ? OR b.vendor LIKE ? OR b.category LIKE ?)
             ORDER BY
               CASE WHEN b.status='overdue' THEN 0
                    WHEN b.due_date = ? THEN 1
                    WHEN b.status='pending' THEN 2
                    ELSE 3 END,
               b.due_date ASC
             LIMIT ?",
            [$like, $like, $like, $this->today, $limit]
        );

        return array_map(function($r) {
            $isOverdue = $r['status'] === 'overdue' || ($r['due_date'] < $this->today && $r['status'] !== 'paid');
            $isToday   = $r['due_date'] === $this->today;
            $daysOver  = 0;
            if ($isOverdue && $r['due_date']) {
                $daysOver = (int)round((strtotime($this->today) - strtotime($r['due_date'])) / 86400);
            }
            return [
                'id'        => (int)$r['id'],
                'title'     => $r['title'],
                'vendor'    => $r['vendor'] ?? '',
                'amount'    => (float)$r['amount'],
                'due_date'  => $r['due_date'],
                'status'    => $r['status'],
                'category'  => $r['category'] ?? '',
                'store_name'=> $r['store_name'] ?? '',
                'is_overdue'=> $isOverdue,
                'is_today'  => $isToday,
                'days_over' => $daysOver,
                'url'       => '/bills',
            ];
        }, $rows);
    }

    // ──────────────────────────────────────────────────────────────
    //  TASKS
    // ──────────────────────────────────────────────────────────────

    private function searchTasks(string $q, int $limit = 6): array
    {
        $like  = '%' . $q . '%';
        $isAdm = $this->isPriv;
        $uid   = $this->uid;
        $sql   = "SELECT DISTINCT t.id, t.title, t.status, t.priority, t.due_date, t.is_completed,
                         t.repeat_type, p.name AS project_name, p.color AS project_color,
                         s.name AS store_name, u.name AS assignee_name
                  FROM tasks t
                  LEFT JOIN projects p ON t.project_id = p.id
                  LEFT JOIN stores s ON p.store_id = s.id
                  LEFT JOIN users u ON t.assignee_id = u.id
                  LEFT JOIN project_members pm ON p.id = pm.project_id
                  WHERE (t.title LIKE ? OR t.description LIKE ?)
                  " . ($isAdm ? "" : "AND (pm.user_id=? OR p.owner_id=? OR t.assignee_id=? OR t.created_by=?)") . "
                  ORDER BY t.is_completed ASC, t.due_date IS NULL, t.due_date ASC
                  LIMIT ?";
        $params = $isAdm ? [$like, $like, $limit] : [$like, $like, $uid, $uid, $uid, $uid, $limit];
        $rows   = $this->db->fetchAll($sql, $params);

        return array_map(function($t) {
            $isOverdue = !$t['is_completed'] && $t['due_date'] && $t['due_date'] < $this->today;
            return [
                'id'           => (int)$t['id'],
                'title'        => $t['title'],
                'status'       => $t['status'],
                'priority'     => $t['priority'] ?? 'medium',
                'due_date'     => $t['due_date'],
                'is_completed' => (bool)$t['is_completed'],
                'is_overdue'   => $isOverdue,
                'is_recurring' => !empty($t['repeat_type']) && $t['repeat_type'] !== 'none',
                'project_name' => $t['project_name'] ?? '',
                'project_color'=> $t['project_color'] ?? '#6366f1',
                'store_name'   => $t['store_name'] ?? '',
                'assignee_name'=> $t['assignee_name'] ?? '',
                'url'          => '/tasks/' . (int)$t['id'],
            ];
        }, $rows);
    }

    // ──────────────────────────────────────────────────────────────
    //  STORES
    // ──────────────────────────────────────────────────────────────

    private function searchStores(string $q, int $limit = 4): array
    {
        try {
            $like = '%' . $q . '%';
            $rows = $this->db->fetchAll(
                "SELECT s.id, s.name, s.color,
                        (SELECT COUNT(*) FROM tasks t JOIN projects p ON t.project_id=p.id
                         WHERE p.store_id=s.id AND t.is_completed=0 AND t.due_date<?) AS overdue_tasks
                 FROM stores s
                 WHERE s.name LIKE ? AND s.status='active'
                 ORDER BY s.name ASC LIMIT ?",
                [$this->today, $like, $limit]
            );
            return array_map(fn($r) => [
                'id'           => (int)$r['id'],
                'name'         => $r['name'],
                'color'        => $r['color'] ?? '#f59e0b',
                'overdue_tasks'=> (int)$r['overdue_tasks'],
                'url'          => '/admin/stores',
            ], $rows);
        } catch (\Throwable $e) { return []; }
    }

    // ──────────────────────────────────────────────────────────────
    //  USERS
    // ──────────────────────────────────────────────────────────────

    private function searchUsers(string $q, int $limit = 4): array
    {
        try {
            $like = '%' . $q . '%';
            $rows = $this->db->fetchAll(
                "SELECT u.id, u.name, u.email, u.role,
                        COUNT(t.id) AS open_tasks
                 FROM users u
                 LEFT JOIN tasks t ON t.assignee_id=u.id AND t.is_completed=0 AND t.status!='completed'
                 WHERE u.status='active' AND (u.name LIKE ? OR u.email LIKE ?)
                 GROUP BY u.id
                 ORDER BY u.name ASC LIMIT ?",
                [$like, $like, $limit]
            );
            return array_map(fn($r) => [
                'id'        => (int)$r['id'],
                'name'      => $r['name'],
                'email'     => $r['email'],
                'role'      => $r['role'],
                'open_tasks'=> (int)$r['open_tasks'],
                'is_overloaded' => (int)$r['open_tasks'] > 5,
                'url'       => '/my-tasks?assignee_id=' . $r['id'],
            ], $rows);
        } catch (\Throwable $e) { return []; }
    }

    // ──────────────────────────────────────────────────────────────
    //  AI — pull from decisions engine
    // ──────────────────────────────────────────────────────────────

    private function searchAI(string $q): array
    {
        $suggestions = [];
        try {
            $engine  = new AutonomyEngine();
            $results = $engine->classifyAll();
            $ranked  = array_slice($results['problems'] ?? [], 0, 3);

            foreach ($ranked as $p) {
                $impact = match($p['severity'] ?? 'medium') {
                    'critical' => 'Critical',
                    'high'     => 'High',
                    default    => 'Medium',
                };
                $suggestions[] = [
                    'title'    => $p['title']       ?? 'Priority action required',
                    'subtitle' => $p['description'] ?? '',
                    'impact'   => $impact,
                    'url'      => $p['action_url']  ?? '/overview',
                    'action_label' => 'Review',
                ];
            }

            // If the query is about overdue bills, prepend finance context
            $lq = mb_strtolower($q);
            if (str_contains($lq, 'bill') || str_contains($lq, 'pay') || str_contains($lq, 'overdue')) {
                try {
                    $finance   = new FinanceIntelligenceEngine();
                    $timeline  = $finance->getCashTimeline();
                    $odAmount  = (float)$timeline['overdue']['amount'];
                    $odCount   = (int)$timeline['overdue']['count'];
                    if ($odCount > 0) {
                        array_unshift($suggestions, [
                            'title'    => "{$odCount} overdue bill(s) — \$" . number_format($odAmount, 0) . " at risk",
                            'subtitle' => 'Immediate payment required to avoid vendor disruption',
                            'impact'   => 'Critical',
                            'url'      => '/bills?filter=overdue',
                            'action_label' => 'View Bills',
                        ]);
                    }
                } catch (\Throwable $e) {}
            }

        } catch (\Throwable $e) {
            // Return a generic suggestion
            $suggestions[] = [
                'title'    => 'Open Command Center',
                'subtitle' => 'See executive overview with all risk signals',
                'impact'   => 'High',
                'url'      => '/overview',
                'action_label' => 'Open',
            ];
        }

        return array_slice($suggestions, 0, 3);
    }
}
