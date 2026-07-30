<?php
/**
 * Task Type View — single obligation type across all locations
 * GET /task-type-view?type=rent&period=2026-06
 */
class TaskTypeViewController
{
    private array $knownTaskTypes = [
        'review_google' => 'Review Google reviews',
        'review_yelp' => 'Review Yelp reviews',
        'doordash_campaign' => 'Check DoorDash campaign',
        'packing_update' => 'Packing Update',
        'heo_cc_update' => 'HEO CC Update',
        'texas_sales_tax' => 'File Texas Sales Tax',
        'amtrust_insurance' => 'Pay AmTrust insurance',
        'ift_tax' => 'IFT tax',
        'monthly_finance_nguyen' => 'Monthly Finance Task - Nguyen Nguyen',
        'monthly_finance_admin' => 'Monthly Finance Task - Admin',
        'rent' => 'Rent',
        'water' => 'Water',
        'electronic' => 'Electronic',
        'trash' => 'Trash',
        'phone' => 'Phone',
    ];

    public function index(): void
    {
        if (!canManage()) { redirect('overview'); return; }
        $db = Database::getInstance();

        $taskType = trim($_GET['type'] ?? '');
        $period   = trim($_GET['period'] ?? date('Y-m'));

        // Available task types from templates + tasks. Some production tasks do
        // not have task_type populated yet, so titles are normalized as fallback.
        $availableTypeMap = [];
        if ($db->tableExists('task_templates')) {
            $templateTypes = $db->fetchAll(
                "SELECT DISTINCT task_type, MIN(title) as label FROM task_templates WHERE is_active=1 GROUP BY task_type ORDER BY task_type"
            );
            foreach ($templateTypes as $row) {
                if (!empty($row['task_type'])) {
                    $availableTypeMap[$row['task_type']] = $row['label'] ?: $this->formatTaskType($row['task_type']);
                }
            }
        }
        if ($db->columnExists('tasks','task_type')) {
            $fromTasks = $db->fetchAll(
                "SELECT DISTINCT task_type, task_type as label FROM tasks WHERE task_type IS NOT NULL AND task_type != '' ORDER BY task_type"
            );
            foreach ($fromTasks as $row) {
                if (!empty($row['task_type'])) {
                    $availableTypeMap[$row['task_type']] = $this->formatTaskType($row['task_type']);
                }
            }
        }
        $taskRows = $db->fetchAll(
            "SELECT title FROM tasks WHERE title IS NOT NULL AND title != '' ORDER BY due_date DESC, id DESC LIMIT 1000"
        );
        foreach ($taskRows as $row) {
            $derived = $this->deriveTaskType($row['title'] ?? '');
            if ($derived) {
                $availableTypeMap[$derived] = $this->knownTaskTypes[$derived] ?? $this->formatTaskType($derived);
            }
        }
        uasort($availableTypeMap, fn($a, $b) => strcasecmp($a, $b));
        $availableTypes = [];
        foreach ($availableTypeMap as $value => $label) {
            $availableTypes[] = ['task_type' => $value, 'label' => $label];
        }

        // Per-store task status for selected type + period
        $storeResults = [];
        if ($taskType && $db->tableExists('stores')) {
            $stores = $db->fetchAll("SELECT id, name, color FROM stores WHERE is_active=1 ORDER BY name");

            $hasVerifStatus = $db->columnExists('tasks','verification_status');
            $hasTaskType    = $db->columnExists('tasks','task_type');
            $hasPeriod      = $db->columnExists('tasks','period');
            $hasExpected    = $db->columnExists('tasks','expected_amount');

            foreach ($stores as $store) {
                $params = [$store['id']];
                $periodWhere = '';
                if ($period) {
                    $periodWhere = $hasPeriod
                        ? "AND (t.period = ? OR DATE_FORMAT(t.due_date,'%Y-%m') = ?)"
                        : "AND DATE_FORMAT(t.due_date,'%Y-%m') = ?";
                    $params[] = $period;
                    if ($hasPeriod) {
                        $params[] = $period;
                    }
                }
                $typeWhere = $hasTaskType ? "AND (t.task_type = ? OR t.task_type IS NULL OR t.task_type = '')" : "";
                if ($hasTaskType) {
                    $params[] = $taskType;
                }
                $verifSel = $hasVerifStatus ? ", t.verification_status" : ", NULL as verification_status";
                $typeSel = $hasTaskType ? ", t.task_type" : ", NULL as task_type";
                $expectedSel = $hasExpected ? "t.expected_amount" : "NULL as expected_amount";
                $tasks = $db->fetchAll(
                    "SELECT t.id, t.title, t.status, t.due_date, $expectedSel, t.is_completed $typeSel $verifSel,
                            COALESCE(u.name,'—') as assignee_name
                     FROM tasks t
                     LEFT JOIN users u ON u.id = t.assignee_id
                     WHERE t.store_id = ?
                       $periodWhere
                       $typeWhere
                     ORDER BY t.due_date ASC",
                    $params
                );
                $tasks = array_values(array_filter($tasks, fn($task) => $this->matchesTaskType($task, $taskType)));

                // Derive display color
                $color = 'gray';
                if (!empty($tasks)) {
                    $statuses = array_column($tasks, 'verification_status');
                    $taskStatuses = array_column($tasks, 'status');
                    if (array_filter($tasks, fn($t) => (int)($t['is_completed'] ?? 0) === 1 || in_array($t['status'] ?? '', ['done','completed'], true))) {
                        $color = 'green';
                    }
                    if (in_array('failed', $statuses) || in_array('exception', $statuses)) {
                        $color = 'red';
                    } elseif (in_array('verified', $statuses) || $color === 'green') {
                        $color = 'green';
                    } elseif (in_array('pending', $statuses) || in_array('review', $taskStatuses)) {
                        $color = 'yellow';
                    } else {
                        // Check if overdue
                        foreach ($tasks as $t) {
                            if ($t['due_date'] && $t['due_date'] < date('Y-m-d')
                                && !in_array($t['status'], ['done','completed','cancelled'])) {
                                $color = 'red';
                                break;
                            }
                        }
                    }
                }

                $storeResults[] = [
                    'store'   => $store,
                    'tasks'   => $tasks,
                    'color'   => $color,
                    'count'   => count($tasks),
                ];
            }
        }

        // Period navigation (last 6 months + next 3)
        $periods = [];
        for ($i = -5; $i <= 3; $i++) {
            $periods[] = date('Y-m', strtotime("$i months"));
        }

        $pageTitle   = $taskType ? ucfirst($taskType) . ' — Task Type View' : 'Task Type View';
        $currentPage = 'task-type-view';

        ob_start();
        require __DIR__ . '/../views/dashboard/task_type_view.php';
        $content = ob_get_clean();
        require __DIR__ . '/../views/layouts/main.php';
    }

    private function matchesTaskType(array $task, string $taskType): bool
    {
        if (($task['task_type'] ?? '') === $taskType) {
            return true;
        }
        return $this->deriveTaskType($task['title'] ?? '') === $taskType;
    }

    private function deriveTaskType(string $title): ?string
    {
        $normalized = strtolower(trim(preg_replace('/\s+/', ' ', html_entity_decode($title, ENT_QUOTES))));
        $normalized = preg_replace('/^(raw stockton|raw modesto|stockton|modesto|b1|b2|b3|bakudan\s*-\s*the rim|bakudan\s*-\s*stone oak|bakudan\s*-\s*bandera|heo holding|ift|copper)\s*[-:]\s*/i', '', $normalized);

        $checks = [
            'review_google' => ['review google'],
            'review_yelp' => ['review yelp'],
            'doordash_campaign' => ['doordash campaign'],
            'packing_update' => ['packing update', 'packling update', 'packing list'],
            'heo_cc_update' => ['heo cc update'],
            'texas_sales_tax' => ['texas sales tax', 'sale tax', 'sales tax'],
            'amtrust_insurance' => ['amtrust'],
            'ift_tax' => ['ift tax', 'ift:'],
            'monthly_finance_nguyen' => ['monthly finance task - nguyen', 'monthly finance - nguyen'],
            'monthly_finance_admin' => ['monthly finance task - admin', 'monthly finance - admin'],
            'rent' => ['rent'],
            'water' => ['water'],
            'electronic' => ['electronic', 'pge', 'pg&e', 'cps energy'],
            'trash' => ['trash', 'waste management', ' wm '],
            'phone' => ['phone', 'at&t', 'att '],
        ];

        foreach ($checks as $type => $needles) {
            foreach ($needles as $needle) {
                if (str_contains(" $normalized ", $needle)) {
                    return $type;
                }
            }
        }

        return null;
    }

    private function formatTaskType(string $taskType): string
    {
        return $this->knownTaskTypes[$taskType] ?? ucwords(str_replace('_', ' ', $taskType));
    }
}
