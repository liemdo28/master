<?php
/**
 * Phase 11 — Module 10: Company Operating Calendar
 * 
 * Single calendar view for all company events.
 * /company/calendar
 */
require_once __DIR__ . '/../models/Task.php';
require_once __DIR__ . '/../models/Bill.php';
require_once __DIR__ . '/../models/User.php';

class CompanyCalendarController
{
    private $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    public function index(): void
    {
        if (!canManage()) {
            header('Location: /dashboard');
            exit;
        }

        $month = (int)($_GET['month'] ?? date('m'));
        $year = (int)($_GET['year'] ?? date('Y'));
        $selectedStoreId = (int)($_GET['store_id'] ?? 0);
        $selectedType = trim($_GET['type'] ?? 'all');
        if (!in_array($selectedType, ['all', 'task', 'bill', 'release', 'checklist'], true)) {
            $selectedType = 'all';
        }
        $monthName = date('F', mktime(0, 0, 0, $month, 1));

        $startDate = sprintf('%04d-%02d-01', $year, $month);
        $endDate = date('Y-m-t', strtotime($startDate));

        $stores = $this->getStores();
        $storeLookup = [];
        foreach ($stores as $store) {
            $storeLookup[(int)$store['id']] = $store;
        }

        $events = $this->getCalendarEvents($startDate, $endDate, $selectedStoreId, $selectedType, $storeLookup);

        $content = $this->renderView(compact(
            'month', 'year', 'monthName', 'startDate', 'endDate', 'events', 'stores', 'selectedStoreId', 'selectedType'
        ));

        $pageTitle = 'Company Calendar';
        $currentPage = 'company-calendar';
        $extraCss = ['operations.css'];
        require __DIR__ . '/../views/layouts/main.php';
    }

    private function getCalendarEvents(string $start, string $end, int $selectedStoreId, string $selectedType, array $storeLookup): array
    {
        $events = [];
        $includeTasks = in_array($selectedType, ['all', 'task'], true);
        $includeBills = in_array($selectedType, ['all', 'bill'], true);
        $includeReleases = in_array($selectedType, ['all', 'release'], true);
        $includeChecklists = in_array($selectedType, ['all', 'checklist'], true);

        // Tasks with due dates
        if ($includeTasks) {
            $hasDirectStore = $this->db->columnExists('tasks', 'direct_store_id');
            $directStoreSelect = $hasDirectStore ? 't.direct_store_id' : 'NULL AS direct_store_id';
            $resolvedStoreSelect = $hasDirectStore ? 'COALESCE(t.direct_store_id, p.store_id)' : 'p.store_id';
            $tasks = $this->db->fetchAll(
                "SELECT t.id, t.title, t.due_date, t.priority, t.status, t.is_completed,
                        {$directStoreSelect},
                        p.name as project_name, p.color as project_color,
                        COALESCE(ds.name, ps.name) as store_name,
                        {$resolvedStoreSelect} as resolved_store_id
                 FROM tasks t
                 LEFT JOIN projects p ON t.project_id = p.id
                 LEFT JOIN stores ps ON p.store_id = ps.id
                 LEFT JOIN stores ds ON " . ($hasDirectStore ? 't.direct_store_id = ds.id' : '1=0') . "
                 WHERE t.due_date BETWEEN ? AND ?
                   AND t.status NOT IN ('cancelled','archived')
                 ORDER BY t.due_date ASC",
                [$start, $end]
            );
            foreach ($tasks as $t) {
                $storeId = (int)($t['resolved_store_id'] ?? 0);
                $storeName = $t['store_name'] ?? '';
                if (!$storeId) {
                    $inferred = $this->inferStoreFromTitle($t['title'] ?? '', $storeLookup);
                    $storeId = (int)($inferred['id'] ?? 0);
                    $storeName = $inferred['name'] ?? $storeName;
                }
                if ($selectedStoreId > 0 && $storeId !== $selectedStoreId) {
                    continue;
                }
                $status = (int)($t['is_completed'] ?? 0) === 1 ? 'done' : ($t['status'] ?? 'todo');
                $events[] = [
                    'date' => $t['due_date'],
                    'type' => 'task',
                    'title' => $t['title'],
                    'subtitle' => $t['project_name'] ?? 'Task',
                    'store' => $storeName,
                    'store_id' => $storeId,
                    'priority' => $t['priority'],
                    'status' => $status,
                    'color' => $this->taskStatusColor($status, $t['due_date']),
                    'url' => '/tasks/' . $t['id'],
                ];
            }
        }

        // Bills with due dates
        if ($includeBills) {
            $archiveWhere = $this->db->columnExists('bills', 'is_archived') ? 'AND COALESCE(b.is_archived,0)=0' : '';
            $billWhere = "b.due_date BETWEEN ? AND ? {$archiveWhere}";
            $params = [$start, $end];
            if ($selectedStoreId > 0) {
                $billWhere .= ' AND b.store_id = ?';
                $params[] = $selectedStoreId;
            }
            $bills = $this->db->fetchAll(
                "SELECT b.id, b.title, b.vendor, b.amount, b.due_date, b.category, b.status,
                        b.store_id, s.name as store_name
                 FROM bills b
                 LEFT JOIN stores s ON b.store_id = s.id
                 WHERE {$billWhere}
                 ORDER BY b.due_date ASC",
                $params
            );
            foreach ($bills as $b) {
                $title = $b['title'] ?: ($b['vendor'] ?? 'Bill');
                $events[] = [
                    'date' => $b['due_date'],
                    'type' => 'bill',
                    'title' => $title,
                    'subtitle' => '$' . number_format((float)$b['amount'], 0),
                    'store' => $b['store_name'] ?? '',
                    'store_id' => (int)($b['store_id'] ?? 0),
                    'priority' => $b['status'] === 'overdue' ? 'urgent' : 'medium',
                    'status' => $b['status'],
                    'color' => $this->billCategoryColor($b['category'], $b['status']),
                    'url' => '/bills/' . $b['id'],
                ];
            }
        }

        // Releases
        if ($includeReleases && $selectedStoreId === 0 && $this->db->tableExists('releases')) {
            $hasTargetDate  = $this->db->columnExists('releases', 'target_date');
            $hasRelDueDate  = $this->db->columnExists('releases', 'due_date');
            $hasCreatedBy   = $this->db->columnExists('releases', 'created_by');
            $hasOwnerId     = $this->db->columnExists('releases', 'owner_id');
            $dateCol        = $hasTargetDate ? 'r.target_date' : ($hasRelDueDate ? 'r.due_date' : 'r.created_at');
            $createdByCol   = $hasCreatedBy  ? 'r.created_by'  : ($hasOwnerId    ? 'r.owner_id'  : 'NULL');
            $releases = $this->db->fetchAll(
                "SELECT r.id, r.name, r.title, COALESCE({$dateCol}, r.created_at) AS release_date, r.status,
                        u.name as created_by_name
                 FROM releases r
                 LEFT JOIN users u ON {$createdByCol} = u.id
                 WHERE COALESCE({$dateCol}, r.created_at) BETWEEN ? AND ?
                 ORDER BY COALESCE({$dateCol}, r.created_at) ASC",
                [$start, $end]
            );
            foreach ($releases as $r) {
                $events[] = [
                    'date' => $r['release_date'],
                    'type' => 'release',
                    'title' => $r['name'] ?? $r['title'] ?? 'Release',
                    'subtitle' => 'By ' . e($r['created_by_name'] ?? ''),
                    'store' => '',
                    'store_id' => 0,
                    'priority' => 'medium',
                    'status' => $r['status'],
                    'color' => '#8b5cf6',
                    'url' => '/releases/' . $r['id'],
                ];
            }
        }

        // Store checklists
        if ($includeChecklists && $this->db->tableExists('store_checklists')) {
            $checklistWhere = '(sc.opened_at BETWEEN ? AND ? OR sc.closed_at BETWEEN ? AND ?)';
            $params = [$start, $end, $start, $end];
            if ($selectedStoreId > 0) {
                $checklistWhere .= ' AND sc.store_id = ?';
                $params[] = $selectedStoreId;
            }
            $checklists = $this->db->fetchAll(
                "SELECT sc.id, sc.type, sc.opened_at, sc.closed_at, sc.store_id, s.name as store_name
                 FROM store_checklists sc
                 JOIN stores s ON sc.store_id = s.id
                 WHERE {$checklistWhere}
                 ORDER BY sc.opened_at ASC",
                $params
            );
            foreach ($checklists as $c) {
                $dt = !empty($c['opened_at']) ? $c['opened_at'] : ($c['closed_at'] ?? '');
                $events[] = [
                    'date' => date('Y-m-d', strtotime($dt)),
                    'type' => 'checklist',
                    'title' => ($c['type'] === 'open' ? 'Open' : 'Close') . ': ' . e($c['store_name']),
                    'subtitle' => '',
                    'store' => $c['store_name'],
                    'store_id' => (int)($c['store_id'] ?? 0),
                    'priority' => 'low',
                    'status' => 'done',
                    'color' => $c['type'] === 'open' ? '#22c55e' : '#60a5fa',
                    'url' => '/store/checklist/history',
                ];
            }
        }

        usort($events, fn($a, $b) => strcmp($a['date'], $b['date']) ?: strcmp($a['title'], $b['title']));
        return $events;
    }

    private function getStores(): array
    {
        if (!$this->db->tableExists('stores')) {
            return [];
        }
        return $this->db->fetchAll("SELECT id, name, color FROM stores WHERE COALESCE(is_active,1)=1 ORDER BY name");
    }

    private function inferStoreFromTitle(string $title, array $storeLookup): array
    {
        $normalized = strtolower(trim($title));
        $aliases = [
            'raw stockton' => ['raw stockton', 'stockton'],
            'raw modesto' => ['raw modesto', 'modesto'],
            'bakudan - the rim (b1)' => ['b1', 'the rim'],
            'bakudan - stone oak (b2)' => ['b2', 'stone oak'],
            'bakudan - bandera (b3)' => ['b3', 'bandera'],
            'heo holding' => ['heo holding', 'heo'],
            'ift' => ['ift'],
            'copper (c1, c2, c3)' => ['copper'],
        ];

        foreach ($storeLookup as $store) {
            $storeName = strtolower($store['name'] ?? '');
            $needles = $aliases[$storeName] ?? [$storeName];
            foreach ($needles as $needle) {
                if ($needle !== '' && preg_match('/^' . preg_quote($needle, '/') . '\b/i', $normalized)) {
                    return $store;
                }
            }
        }

        return [];
    }

    private function taskStatusColor(string $status, ?string $dueDate): string
    {
        if (in_array($status, ['done', 'completed'], true)) {
            return '#94a3b8';
        }
        if ($dueDate && $dueDate < DateService::today()) {
            return '#ef4444';
        }
        if ($dueDate && $dueDate <= date('Y-m-d', strtotime('+7 days'))) {
            return '#facc15';
        }
        return '#22c55e';
    }

    private function billCategoryColor(?string $cat, ?string $status = null): string
    {
        if ($status === 'paid') {
            return '#94a3b8';
        }
        if ($status === 'overdue') {
            return '#ef4444';
        }
        return match($cat) {
            'payroll' => '#f59e0b',
            'tax' => '#f97316',
            'rent' => '#60a5fa',
            'utilities' => '#06b6d4',
            default => '#9ca3af',
        };
    }

    private function renderView(array $vars): string
    {
        extract($vars);
        ob_start();
        include __DIR__ . '/../views/company/calendar.php';
        return ob_get_clean();
    }
}
