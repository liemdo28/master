<?php
class DashboardController {
    private $taskModel;
    private $projectModel;
    private $userModel;
    private $billModel;

    public function __construct() {
        $this->taskModel    = new Task();
        $this->projectModel = new Project();
        $this->userModel    = new User();
        $this->billModel    = new Bill(); // triggers Bill::ensureSchema() — adds any missing columns (e.g. currency)
    }

    public function index() {
        $userId = $_SESSION['user_id'];
        $totalProjects = $this->projectModel->count();
        $totalTasks = $this->taskModel->totalCount();
        $completedTasks = $this->taskModel->completedCount();
        $totalMembers = $this->userModel->count();
        $myTasks = $this->taskModel->getByUser($userId, 10);
        $upcomingTasks = $this->taskModel->getUpcoming($userId, 7);
        $overdueTasks = $this->taskModel->getOverdue($userId);
        $tasksByStatus = $this->taskModel->countByStatus();
        $projects = $this->projectModel->getByUser($userId, isManager());
        $notifications = new Notification();
        $unreadCount = $notifications->getUnreadCount($userId);

        // TKT-201 · "Your workday" breakdown
        $today = app_today();
        $workday = [
            'today_tasks' => [],
            'overdue_tasks' => [],
            'recent_tasks' => [],
            'focus_task' => null,
        ];
        foreach ($myTasks as $t) {
            if (!empty($t['due_date']) && $t['due_date'] === $today && empty($t['is_completed'])) {
                $workday['today_tasks'][] = $t;
            }
        }
        foreach ($overdueTasks as $t) {
            $workday['overdue_tasks'][] = $t;
        }
        // Recent = last 5 updated tasks assigned to user, not completed
        $db = Database::getInstance();
        $workday['recent_tasks'] = $db->fetchAll(
            "SELECT t.*, p.name as project_name, p.color as project_color, s.name as store_name
             FROM tasks t
             LEFT JOIN projects p ON t.project_id = p.id
             LEFT JOIN stores s ON p.store_id = s.id
             WHERE (t.assignee_id = ? OR t.created_by = ?) AND t.is_completed = 0
             ORDER BY t.updated_at DESC LIMIT 5",
            [$userId, $userId]
        );
        // Focus task = highest-urgency unfinished task (overdue > today > urgent prio > next due)
        $allActive = array_merge($workday['overdue_tasks'], $workday['today_tasks']);
        if (empty($allActive)) $allActive = $workday['recent_tasks'];
        if (!empty($allActive)) {
            usort($allActive, function($a, $b) use ($today) {
                $score = function($t) use ($today) {
                    $s = 0;
                    if (!empty($t['due_date']) && $t['due_date'] < $today) $s += 40;
                    if (!empty($t['due_date']) && $t['due_date'] === $today) $s += 25;
                    $pri = ['urgent'=>30,'high'=>20,'medium'=>10,'low'=>5];
                    $s += $pri[$t['priority'] ?? 'medium'] ?? 10;
                    return -$s;
                };
                return $score($a) <=> $score($b);
            });
            $workday['focus_task'] = $allActive[0] ?? null;
        }

        require __DIR__ . '/../views/dashboard/index.php';
    }

    public function calendar() {
        $userId = $_SESSION['user_id'];
        $projects = $this->projectModel->getByUser($userId, isManager());
        $notifications = new Notification();
        $unreadCount = $notifications->getUnreadCount($userId);
        require __DIR__ . '/../views/calendar/index.php';
    }

    public function inbox() {
        $userId = $_SESSION['user_id'];
        $notifModel = new Notification();
        $allNotifs = $notifModel->getByUser($userId, 50);
        $unreadCount = $notifModel->getUnreadCount($userId);
        $projects = $this->projectModel->getByUser($userId, isManager());
        require __DIR__ . '/../views/inbox/index.php';
    }

    /**
     * GET /api/my-tasks/next-focus
     * Returns the next most-urgent incomplete task for the logged-in user.
     * Used by the Focus Card JS after marking the current task done.
     */
    public function apiFocusNext() {
        $userId = (int)$_SESSION['user_id'];
        $today  = app_today();
        $db     = Database::getInstance();

        $weekEnd = date('Y-m-d', strtotime(app_today() . ' +7 days'));
        $task = $db->fetch(
            "SELECT t.id, t.title, t.due_date, t.priority, t.status,
                    s.name as store_name, p.name as project_name
             FROM tasks t
             LEFT JOIN projects p ON p.id = t.project_id
             LEFT JOIN stores   s ON s.id  = p.store_id
             WHERE (t.assignee_id = ? OR t.created_by = ?) AND t.is_completed = 0
               AND (t.due_date IS NULL OR t.due_date <= ?)
             ORDER BY
                CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END,
                t.due_date ASC,
                FIELD(t.priority,'urgent','high','medium','low')
             LIMIT 1",
            [$userId, $userId, $weekEnd]
        );

        if (!$task) {
            json_response(['ok'=>true,'task'=>null,'message'=>'All caught up! 🎉']);
            return;
        }

        $d        = !empty($task['due_date']) ? substr($task['due_date'], 0, 10) : null;
        $urgency  = 'upcoming';
        $daysLate = 0;
        if ($d) {
            if ($d < $today)       { $urgency = 'overdue'; $daysLate = (int)((strtotime($today)-strtotime($d))/86400); }
            elseif ($d === $today) { $urgency = 'today'; }
            elseif ($d <= $weekEnd) { $urgency = 'week'; }
        }

        // Count remaining open tasks for KPI update
        $remaining = $db->fetch(
            "SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN due_date < ? AND is_completed=0 THEN 1 ELSE 0 END) AS overdue,
                SUM(CASE WHEN due_date = ? AND is_completed=0 THEN 1 ELSE 0 END) AS today
             FROM tasks WHERE (assignee_id = ? OR created_by = ?) AND is_completed = 0",
            [$today, $today, $userId, $userId]
        );

        json_response([
            'ok'   => true,
            'task' => [
                'id'           => (int)$task['id'],
                'title'        => $task['title'],
                'due_date'     => $d,
                'priority'     => $task['priority'] ?? 'medium',
                'urgency'      => $urgency,
                'days_late'    => $daysLate,
                'store_name'   => $task['store_name'] ?? '',
                'project_name' => $task['project_name'] ?? '',
                'complete_url' => APP_URL . '/api/tasks/' . (int)$task['id'] . '/complete',
                'detail_url'   => APP_URL . '/tasks/' . (int)$task['id'],
            ],
            'kpi' => [
                'total'   => (int)($remaining['total']   ?? 0),
                'overdue' => (int)($remaining['overdue'] ?? 0),
                'today'   => (int)($remaining['today']   ?? 0),
            ],
        ]);
    }

    public function myTasks() {
        $userId       = $_SESSION['user_id'];
        $targetUserId = $userId;
        $viewingUser  = null;
        if (isAdmin() && !empty($_GET['user'])) {
            $targetUserId = (int)$_GET['user'];
            if ($targetUserId !== $userId) {
                $viewingUser = $this->userModel->findById($targetUserId);
            }
        }

        $db      = Database::getInstance();
        $today   = app_today();
        $weekEnd = date('Y-m-d', strtotime(app_today() . ' +7 days'));
        $selectedMonth = max(1, min(12, (int)($_GET['month'] ?? date('n'))));
        $selectedYear = max(2020, min(2040, (int)($_GET['year'] ?? date('Y'))));
        $monthStart = sprintf('%04d-%02d-01', $selectedYear, $selectedMonth);
        $monthEnd = date('Y-m-t', strtotime($monthStart));
        $prevMonthDate = (new DateTimeImmutable($monthStart))->modify('-1 month');
        $nextMonthDate = (new DateTimeImmutable($monthStart))->modify('+1 month');
        $monthNav = [
            'month' => $selectedMonth,
            'year' => $selectedYear,
            'label' => date('F Y', strtotime($monthStart)),
            'start' => $monthStart,
            'end' => $monthEnd,
            'prev_url' => APP_URL . '/my-tasks?month=' . $prevMonthDate->format('n') . '&year=' . $prevMonthDate->format('Y') . (!empty($_GET['user']) ? '&user=' . (int)$_GET['user'] : ''),
            'next_url' => APP_URL . '/my-tasks?month=' . $nextMonthDate->format('n') . '&year=' . $nextMonthDate->format('Y') . (!empty($_GET['user']) ? '&user=' . (int)$_GET['user'] : ''),
            'today_url' => APP_URL . '/my-tasks' . (!empty($_GET['user']) ? '?user=' . (int)$_GET['user'] : ''),
        ];

        // Full task list for this user:
        // - tasks assigned to this user, OR
        // - tasks where this user is reviewer and review is pending (pending_review / pending_acceptance)
        $reviewerDueSel = $db->columnExists('tasks', 'reviewer_due_date')
            ? 'COALESCE(CASE WHEN t.assignee_id != ? AND t.reviewer_id = ? THEN t.reviewer_due_date END, t.due_date) as effective_due_date, (t.reviewer_id = ? AND t.assignee_id != ?) as is_review_task'
            : 'NULL as effective_due_date, 0 as is_review_task';
        $reviewerParams = $db->columnExists('tasks', 'reviewer_due_date')
            ? [$targetUserId, $targetUserId, $targetUserId, $targetUserId]
            : [];

        $myTasks = $db->fetchAll(
            "SELECT t.*, p.name as project_name, p.color as project_color,
                    COALESCE(ds.id, s.id) as store_id,
                    COALESCE(ds.name, s.name) as store_name,
                    COALESCE(ds.color, s.color) as store_color,
                    u2.name as assignee_name,
                    {$reviewerDueSel}
             FROM tasks t
             LEFT JOIN projects p ON t.project_id = p.id
             LEFT JOIN stores   s ON p.store_id   = s.id
             LEFT JOIN stores   ds ON t.direct_store_id = ds.id
             LEFT JOIN users   u2 ON t.assignee_id = u2.id
             WHERE (
                 t.assignee_id = ?
                 OR (t.reviewer_id = ? AND t.is_completed = 0 AND t.status IN ('pending_review','pending_acceptance','review'))
             )
             ORDER BY t.is_completed ASC,
                      CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END,
                      t.due_date ASC,
                      FIELD(t.priority,'urgent','high','medium','low'),
                      t.updated_at DESC",
            array_merge($reviewerParams, [$targetUserId, $targetUserId])
        );

        $kpi = [
            'overdue' => 0,
            'today' => 0,
            'this_week' => 0,
            'in_progress' => 0,
            'completed' => 0,
            'unscheduled' => 0,
            'review_pending' => 0,
            'total_open' => 0,
        ];

        // Group into urgency buckets (canonical order)
        $bucketOrder = ['review_pending','overdue','today','in_progress','this_week','upcoming','unscheduled','completed'];
        $bucketLabels = [
            'review_pending' => ['label'=>'🔍 Needs Your Review', 'color'=>'#F97316'],
            'overdue'     => ['label'=>'🔴 Overdue',         'color'=>'#EF4444'],
            'today'       => ['label'=>'🟡 Due Today',       'color'=>'#F59E0B'],
            'in_progress' => ['label'=>'🔵 In Progress',     'color'=>'#3B82F6'],
            'this_week'   => ['label'=>'📅 Due This Week',   'color'=>'#8B5CF6'],
            'upcoming'    => ['label'=>'⚪ Upcoming',        'color'=>'#94A3B8'],
            'unscheduled' => ['label'=>'— No Due Date',      'color'=>'#64748B'],
            'completed'   => ['label'=>'✅ Completed',       'color'=>'#22C55E'],
        ];

        $groups = [];
        foreach ($myTasks as $t) {
            $rawDue = !empty($t['is_review_task']) && !empty($t['reviewer_due_date'])
                ? $t['reviewer_due_date'] : ($t['due_date'] ?? null);
            $d = $rawDue ? substr($rawDue, 0, 10) : null;
            if (!empty($t['is_completed']))               $bucket = 'completed';
            elseif (!empty($t['is_review_task']))         $bucket = 'review_pending';
            elseif ($d && $d < $today)                    $bucket = 'overdue';
            elseif ($d && $d === $today)                  $bucket = 'today';
            elseif (($t['status']??'') === 'in_progress') $bucket = 'in_progress';
            elseif ($d && $d <= $weekEnd)                 $bucket = 'this_week';
            elseif ($d)                                   $bucket = 'upcoming';
            else                                          $bucket = 'unscheduled';
            $groups[$bucket][] = $t;
        }

        foreach ($groups as $bucket => $tasksInBucket) {
            $count = count($tasksInBucket);
            if (array_key_exists($bucket, $kpi)) {
                $kpi[$bucket] = $count;
            }
        }
        $kpi['total_open'] = max(0, count($myTasks) - $kpi['completed']);
        $kpi['total_all'] = count($myTasks);
        $kpi['completion_rate'] = $kpi['total_all'] > 0 ? round($kpi['completed'] / $kpi['total_all'] * 100) : 0;

        $monthlyControl = $this->buildMonthlyTaskControl($myTasks, $monthStart, $monthEnd, $today);

        // Enforce canonical order and limit completed to 20
        $orderedGroups = [];
        foreach ($bucketOrder as $b) {
            if (!empty($groups[$b])) {
                $tasks = $groups[$b];
                if ($b === 'completed') $tasks = array_slice($tasks, 0, 20);
                $orderedGroups[$b] = ['meta' => $bucketLabels[$b], 'tasks' => $tasks];
            }
        }

        $overdueTasks = $groups['overdue'] ?? [];
        $newTaskCount = $this->taskModel->countNewTasks($targetUserId);
        $projects     = $this->projectModel->getByUser($userId, isManager());
        $notifications = new Notification();
        $unreadCount   = $notifications->getUnreadCount($userId);

        // SmartEngine is advisory; task list must render even if the brief fails.
        $smartBrief = null;
        try {
            $currentUser = currentUser();
            $currentRole = strtolower((string)($currentUser['role'] ?? 'staff'));
            $staffRole = in_array($currentRole, ['admin', 'manager', 'ceo', 'staff', 'member'], true)
                ? $currentRole
                : 'staff';
            $engine = new SmartEngine($targetUserId, $staffRole);
            $smartBrief = $engine->brief();
        } catch (Throwable $e) {
            error_log('[DashboardController::myTasks] SmartEngine failed: ' . $e->getMessage());
        }

        // Penalty data — only load if viewer is admin OR target user is penalized
        $penaltyData = null;
        try {
            $penaltyModel = new Penalty();
            if (isAdmin()) {
                // Admin viewing any member's page: show that member's penalty detail
                $penaltyData = $penaltyModel->isUserPenalized($targetUserId)
                    ? $penaltyModel->getUserDetail($targetUserId)
                    : null;
            } elseif ($penaltyModel->isUserPenalized($targetUserId)) {
                // Member viewing their own page and they're penalized
                $penaltyData = $penaltyModel->getUserDetail($targetUserId);
            }
        } catch (Throwable $e) {
            error_log('[DashboardController::myTasks] Penalty summary failed: ' . $e->getMessage());
        }

        require __DIR__ . '/../views/dashboard/my_tasks.php';
    }

    private function buildMonthlyTaskControl(array $tasks, string $monthStart, string $monthEnd, string $today): array {
        $patterns = [
            'review_yelp' => ['label' => 'Review Yelp', 'match' => '/review\s+yelp/i'],
            'review_google' => ['label' => 'Review Google', 'match' => '/review\s+google/i'],
            'doordash' => ['label' => 'DoorDash Campaign', 'match' => '/doordash/i'],
            'monthly_finance' => ['label' => 'Monthly Finance', 'match' => '/monthly\s+finance/i'],
            'tax' => ['label' => 'Tax / Filing', 'match' => '/\b(tax|de9|941|file)\b/i'],
            'bill_pay' => ['label' => 'Bill / Pay', 'match' => '/\b(pay|bill|rent|wireless|pge|cps|water|trash)\b/i'],
        ];

        $summary = ['total' => 0, 'done' => 0, 'open' => 0, 'overdue' => 0];
        $types = [];
        foreach ($patterns as $key => $meta) {
            $types[$key] = [
                'key' => $key,
                'label' => $meta['label'],
                'total' => 0,
                'done' => 0,
                'open' => 0,
                'overdue' => 0,
                'stores' => [],
                'next_due' => null,
                'tasks' => [],
            ];
        }

        foreach ($tasks as $task) {
            $due = !empty($task['due_date']) ? substr($task['due_date'], 0, 10) : null;
            if (!$due || $due < $monthStart || $due > $monthEnd) {
                continue;
            }

            $summary['total']++;
            $isDone = !empty($task['is_completed']) || in_array($task['status'] ?? '', ['done', 'completed'], true);
            $isOverdue = !$isDone && $due < $today;
            if ($isDone) $summary['done']++;
            else $summary['open']++;
            if ($isOverdue) $summary['overdue']++;

            $title = (string)($task['title'] ?? '');
            foreach ($patterns as $key => $meta) {
                if (!preg_match($meta['match'], $title)) {
                    continue;
                }
                $storeName = $task['store_name'] ?? 'No Store';
                $types[$key]['total']++;
                if ($isDone) $types[$key]['done']++;
                else $types[$key]['open']++;
                if ($isOverdue) $types[$key]['overdue']++;
                $types[$key]['stores'][$storeName] = true;
                if (!$isDone && (!$types[$key]['next_due'] || $due < $types[$key]['next_due'])) {
                    $types[$key]['next_due'] = $due;
                }
                $types[$key]['tasks'][] = [
                    'id' => (int)$task['id'],
                    'title' => $title,
                    'store_name' => $storeName,
                    'due_date' => $due,
                    'is_done' => $isDone,
                    'is_overdue' => $isOverdue,
                ];
                break;
            }
        }

        $visibleTypes = [];
        foreach ($types as $type) {
            if ($type['total'] === 0) {
                continue;
            }
            $type['store_count'] = count($type['stores']);
            $type['stores'] = array_keys($type['stores']);
            sort($type['stores']);
            $type['completion_rate'] = $type['total'] > 0 ? round($type['done'] / $type['total'] * 100) : 0;
            $visibleTypes[] = $type;
        }

        usort($visibleTypes, function ($a, $b) {
            if ($a['open'] !== $b['open']) return $b['open'] <=> $a['open'];
            return $b['total'] <=> $a['total'];
        });

        $summary['completion_rate'] = $summary['total'] > 0 ? round($summary['done'] / $summary['total'] * 100) : 0;
        return ['summary' => $summary, 'types' => $visibleTypes];
    }

    public function relatedTasks() {
        $userId = $_SESSION['user_id'];
        $today = app_today();
        $db = Database::getInstance();

        $relatedTasks = $db->fetchAll(
            "SELECT DISTINCT t.*, p.name as project_name, p.color as project_color,
                    s.id as store_id, s.name as store_name, s.color as store_color
             FROM tasks t
             LEFT JOIN projects p ON t.project_id = p.id
             LEFT JOIN stores s ON p.store_id = s.id
             LEFT JOIN task_watchers tw ON tw.task_id = t.id
             WHERE t.assignee_id != ?
               AND (
                    t.created_by = ?
                    OR tw.user_id = ?
               )
             ORDER BY t.is_completed ASC, t.updated_at DESC",
            [$userId, $userId, $userId]
        );

        $kpi = ['overdue'=>0,'today'=>0,'completed'=>0,'total_open'=>0];
        foreach ($relatedTasks as $t) {
            $d = !empty($t['due_date']) ? substr($t['due_date'],0,10) : null;
            if (!empty($t['is_completed'])) { $kpi['completed']++; continue; }
            $kpi['total_open']++;
            if ($d && $d < $today) $kpi['overdue']++;
            if ($d && $d === $today) $kpi['today']++;
        }

        $groups = ['related' => ['meta' => ['label' => '👥 Related Tasks', 'color' => '#94A3B8'], 'tasks' => $relatedTasks]];
        $overdueTasks = array_values(array_filter($relatedTasks, fn($t) => !empty($t['due_date']) && substr($t['due_date'],0,10) < $today && empty($t['is_completed'])));
        $newTaskCount = $this->taskModel->countNewTasks($userId);
        $projects = $this->projectModel->getByUser($userId, isManager());
        $viewingUser = null;
        $smartBrief = null;
        $isRelatedView = true;
        require __DIR__ . '/../views/dashboard/my_tasks.php';
    }

    public function newTasks() {
        $userId = $_SESSION['user_id'];
        $newTasks = $this->taskModel->getNewTasks($userId);
        $notifications = new Notification();
        $unreadCount = $notifications->getUnreadCount($userId);
        require __DIR__ . '/../views/dashboard/new_tasks.php';
    }

    public function overview() {
        $db = Database::getInstance();
        $user = currentUser();
        if (!$user) { redirect('login'); return; }
        $userId = (int) $user['id'];
        $today = app_today();

        // Active Projects count
        $activeProjects = $this->projectModel->count();

        // Total tasks & completed
        $totalTasks = $this->taskModel->totalCount();
        $completedTasks = $this->taskModel->completedCount();
        $completionRate = $totalTasks > 0 ? round($completedTasks / $totalTasks * 100) : 0;

        // Overdue breakdown — role-aware via OverdueResolverService
        $currentRole = $user['role'] ?? 'member';
        $overdueResolver = new OverdueResolverService();
        $overdueCounts = $overdueResolver->counts($userId, $currentRole);
        $totalOverdue = $overdueCounts['total'];
        $overdueTaskCount = $overdueCounts['tasks'];
        $overdueBillCount = $overdueCounts['bills'];

        // Total members
        $totalMembers = $this->userModel->count();

        // Project Portfolio stats (all projects) with store info
        $allProjects = $this->projectModel->getAll();
        $projectStats = [];
        foreach ($allProjects as $p) {
            $total = (int)$p['task_count'];
            $completed = (int)$p['completed_count'];
            $progress = $total > 0 ? round($completed / $total * 100) : 0;

            // Count overdue tasks in this project
            $od = $db->fetch(
                "SELECT COUNT(*) as c FROM tasks WHERE project_id = ? AND is_completed = 0 AND due_date < ?",
                [$p['id'], $today]
            );

            $projectStats[] = [
                'id' => $p['id'],
                'name' => $p['name'],
                'color' => $p['color'],
                'total' => $total,
                'completed' => $completed,
                'progress' => $progress,
                'overdue' => (int)($od['c'] ?? 0),
                'store_id' => $p['store_id'] ?? null,
            ];
        }

        // Group projects by store
        $storeModel = new Store();
        $allStores = $storeModel->allActive();
        $storeMap = [];
        foreach ($allStores as $s) {
            $storeMap[$s['id']] = $s;
        }

        $storeGroups = [];
        $ungroupedProjects = [];
        foreach ($projectStats as $ps) {
            // Skip projects with 0 tasks — they're noise on the dashboard
            if ($ps['total'] === 0) continue;

            $sid = $ps['store_id'];
            if ($sid && isset($storeMap[$sid])) {
                if (!isset($storeGroups[$sid])) {
                    $storeGroups[$sid] = [
                        'store' => $storeMap[$sid],
                        'projects' => [],
                        'total_tasks' => 0,
                        'completed_tasks' => 0,
                        'total_overdue' => 0,
                    ];
                }
                $storeGroups[$sid]['projects'][] = $ps;
                $storeGroups[$sid]['total_tasks'] += $ps['total'];
                $storeGroups[$sid]['completed_tasks'] += $ps['completed'];
                $storeGroups[$sid]['total_overdue'] += $ps['overdue'];
            } else {
                $ungroupedProjects[] = $ps;
            }
        }

        // Calculate store completion percentages
        foreach ($storeGroups as &$sg) {
            $sg['progress'] = $sg['total_tasks'] > 0 ? round($sg['completed_tasks'] / $sg['total_tasks'] * 100) : 0;
        }
        unset($sg);

        // Team Workload
        $teamWorkload = $db->fetchAll(
            "SELECT u.id, u.name,
                    COUNT(t.id) as total,
                    SUM(CASE WHEN t.is_completed = 1 THEN 1 ELSE 0 END) as completed,
                    SUM(CASE WHEN t.status = 'in_progress' AND t.is_completed = 0 THEN 1 ELSE 0 END) as in_progress,
                    SUM(CASE WHEN t.is_completed = 0 AND t.due_date < ? THEN 1 ELSE 0 END) as overdue,
                    SUM(CASE WHEN t.is_completed = 0 AND t.due_date BETWEEN ? AND DATE_ADD(?, INTERVAL 7 DAY) THEN 1 ELSE 0 END) as due_next_7,
                    COUNT(DISTINCT p.store_id) as stores_involved
             FROM users u
             LEFT JOIN tasks t ON t.assignee_id = u.id
             LEFT JOIN projects p ON t.project_id = p.id
             WHERE u.is_active = 1
             GROUP BY u.id, u.name
             ORDER BY total DESC"
            ,
            [$today, $today, $today]
        );

        foreach ($teamWorkload as &$member) {
            $member['completion_rate'] = (int) $member['total'] > 0
                ? (int) round(((int) $member['completed'] / (int) $member['total']) * 100)
                : 0;
            $member['workload_score'] = ((int) $member['overdue'] * 4) + ((int) $member['in_progress'] * 2) + (int) $member['due_next_7'];
        }
        unset($member);

        // Bill Summary (all-time)
        $billSummaryToday = app_today();
        $billSummary = $db->fetch(
            "SELECT
                COUNT(*) as total,
                SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as unpaid,
                SUM(CASE WHEN status = 'overdue' OR (status = 'pending' AND due_date < ?) THEN 1 ELSE 0 END) as overdue,
                COALESCE(SUM(amount), 0) as total_amount,
                COALESCE(SUM(CASE WHEN status IN ('pending','overdue') THEN amount ELSE 0 END), 0) as unpaid_amount
             FROM bills WHERE COALESCE(is_archived,0)=0",
            [$billSummaryToday]
        );

        // Overdue task list — uses same OverdueResolverService so list matches counter exactly
        $overdueTasksList = $overdueResolver->tasks($userId, $currentRole, 20);
        $overdueBillList  = $overdueResolver->bills($userId, $currentRole, 20);

        // Upcoming tasks (next 7 days, all users)
        $upcomingTasks = $db->fetchAll(
            "SELECT t.id, t.title, t.due_date, t.priority, p.name as project_name
             FROM tasks t
             LEFT JOIN projects p ON t.project_id = p.id
             WHERE t.is_completed = 0
             AND t.due_date BETWEEN ? AND DATE_ADD(?, INTERVAL 7 DAY)
             ORDER BY t.due_date ASC
             LIMIT 20"
            ,
            [$today, $today]
        );

        // Performance metrics
        $weekStart = date('Y-m-d', strtotime(app_today() . ' -7 days'));
        $completedWeek = $db->fetch(
            "SELECT COUNT(*) as c FROM tasks WHERE is_completed = 1 AND completed_at >= ?",
            [$weekStart]
        );
        $createdWeek = $db->fetch(
            "SELECT COUNT(*) as c FROM tasks WHERE created_at >= ?",
            [$weekStart]
        );
        $avgCompletion = $db->fetch(
            "SELECT AVG(DATEDIFF(completed_at, created_at)) as avg_days FROM tasks WHERE is_completed = 1 AND completed_at IS NOT NULL"
        );

        $performance = [
            'completed_week' => (int)($completedWeek['c'] ?? 0),
            'created_week' => (int)($createdWeek['c'] ?? 0),
            'avg_days' => round((float)($avgCompletion['avg_days'] ?? 0), 1),
        ];

        // ── Executive Dashboard Data (Manager/Admin only) ──
        $isManagerOrAdmin = isManager();

        // Business Health: per-store summary with full metrics
        $businessHealth = [];
        foreach ($allStores as $store) {
            $sid = $store['id'];
            $tasksInStore = $db->fetchAll(
                "SELECT t.id, t.title, t.due_date, t.priority, t.status, t.is_completed,
                        t.repeat_type, t.assignee_id, t.project_id,
                        p.name as project_name, u.name as assignee_name
                 FROM tasks t
                 JOIN projects p ON t.project_id = p.id
                 LEFT JOIN users u ON t.assignee_id = u.id
                 WHERE p.store_id = ?",
                [$sid]
            );

            $total = count($tasksInStore);
            $completed = count(array_filter($tasksInStore, fn($t) => !empty($t['is_completed'])));
            $pending = $total - $completed;
            $overdue = count(array_filter($tasksInStore, fn($t) => empty($t['is_completed']) && $t['due_date'] < $today));
            $new7 = count(array_filter($tasksInStore, fn($t) => strtotime($t['created_at'] ?? '') > strtotime("-7 days")));
            $progress = $total > 0 ? round($completed / $total * 100) : 0;
            $assigneeIds = array_unique(array_filter(array_column($tasksInStore, 'assignee_id')));

            $risk = 'green';
            if ($overdue > 0) $risk = 'red';
            elseif ($progress < 30 && $total > 0) $risk = 'yellow';

            $businessHealth[$sid] = [
                'id' => $sid,
                'name' => $store['name'],
                'color' => $store['color'] ?? '#3b82f6',
                'total' => $total,
                'completed' => $completed,
                'outstanding' => $pending,
                'overdue' => $overdue,
                'new' => $new7,
                'progress' => $progress,
                'risk' => $risk,
                'assignee_ids' => $assigneeIds,
                'project_ids' => array_values(array_unique(array_filter(array_column($tasksInStore, 'project_id')))),
            ];
        }

        // Category Matrix: per-store × per-category breakdown
        $catDefs = [
            'recurring' => ['label' => 'Recurring', 'pattern' => "t.repeat_type <> 'none'"],
            'payroll'   => ['label' => 'Payroll',   'pattern' => "p.name LIKE '%payroll%' OR p.name LIKE '%salary%' OR p.name LIKE '%lương%' OR p.name LIKE '%luong%'"],
            'tax'       => ['label' => 'Tax',       'pattern' => "p.name LIKE '%tax%' OR p.name LIKE '%thuế%' OR p.name LIKE '%VAT%' OR p.name LIKE '%sales tax%'"],
            'rent'      => ['label' => 'Rent',      'pattern' => "p.name LIKE '%rent%' OR p.name LIKE '%lease%' OR p.name LIKE '%thuê%' OR p.name LIKE '%thue%'"],
            'receipts'  => ['label' => 'Receipts',  'pattern' => "p.name LIKE '%receipt%' OR p.name LIKE '%bill%' OR p.name LIKE '%hóa đơn%' OR p.name LIKE '%hoa don%'"],
        ];

        $categoryMatrix = [];
        foreach ($allStores as $store) {
            $sid = $store['id'];
            $row = ['store_id' => $sid, 'store_name' => $store['name'], 'store_color' => $store['color'] ?? '#3b82f6', 'cats' => []];
            foreach ($catDefs as $catKey => $catDef) {
                $catTasks = $db->fetchAll(
                    "SELECT t.id, t.title, t.status, t.due_date, t.is_completed, t.priority, t.assignee_id,
                            p.name as project_name, u.name as assignee_name
                     FROM tasks t
                     JOIN projects p ON t.project_id = p.id
                     LEFT JOIN users u ON t.assignee_id = u.id
                     WHERE p.store_id = ? AND ({$catDef['pattern']})",
                    [$sid]
                );
                $total = count($catTasks);
                $completed = count(array_filter($catTasks, fn($t) => !empty($t['is_completed'])));
                $overdue = count(array_filter($catTasks, fn($t) => empty($t['is_completed']) && $t['due_date'] < $today));
                $row['cats'][$catKey] = [
                    'total' => $total,
                    'completed' => $completed,
                    'pending' => $total - $completed,
                    'overdue' => $overdue,
                    'tasks' => array_values($catTasks),
                ];
            }
            // "Other" category: tasks not in any above category
            $otherTasks = $db->fetchAll(
                "SELECT t.id, t.title, t.status, t.due_date, t.is_completed, t.priority, t.assignee_id,
                        p.name as project_name, u.name as assignee_name
                 FROM tasks t
                 JOIN projects p ON t.project_id = p.id
                 LEFT JOIN users u ON t.assignee_id = u.id
                 WHERE p.store_id = ?
                   AND t.repeat_type = 'none'
                   AND p.name NOT LIKE '%payroll%' AND p.name NOT LIKE '%salary%' AND p.name NOT LIKE '%lương%' AND p.name NOT LIKE '%luong%'
                   AND p.name NOT LIKE '%tax%' AND p.name NOT LIKE '%thuế%' AND p.name NOT LIKE '%VAT%'
                   AND p.name NOT LIKE '%rent%' AND p.name NOT LIKE '%lease%' AND p.name NOT LIKE '%thuê%' AND p.name NOT LIKE '%thue%'
                   AND p.name NOT LIKE '%receipt%' AND p.name NOT LIKE '%bill%' AND p.name NOT LIKE '%hóa đơn%' AND p.name NOT LIKE '%hoa don%'",
                [$sid]
            );
            $totalOther = count($otherTasks);
            $row['cats']['other'] = [
                'total' => $totalOther,
                'completed' => count(array_filter($otherTasks, fn($t) => !empty($t['is_completed']))),
                'pending' => $totalOther - count(array_filter($otherTasks, fn($t) => !empty($t['is_completed']))),
                'overdue' => count(array_filter($otherTasks, fn($t) => empty($t['is_completed']) && $t['due_date'] < $today)),
                'tasks' => array_values($otherTasks),
            ];
            $categoryMatrix[$sid] = $row;
        }

        // Outstanding Work: top scored incomplete tasks (manager/admin only)
        $allIncomplete = $db->fetchAll(
            "SELECT t.id, t.title, t.due_date, t.priority, t.status, t.is_completed,
                    p.name as project_name, p.store_id,
                    s.name as store_name, s.color as store_color,
                    u.name as assignee_name, t.assignee_id
             FROM tasks t
             JOIN projects p ON t.project_id = p.id
             LEFT JOIN stores s ON p.store_id = s.id
             LEFT JOIN users u ON t.assignee_id = u.id
             WHERE t.is_completed = 0
             ORDER BY t.due_date ASC"
        );

        $priorityScore = ['urgent' => 4, 'high' => 3, 'medium' => 2, 'low' => 1];
        foreach ($allIncomplete as &$t) {
            $pts = $priorityScore[$t['priority']] ?? 2;
            if (!empty($t['due_date']) && $t['due_date'] < $today) $pts += 3;
            elseif (!empty($t['due_date']) && $t['due_date'] <= date('Y-m-d', strtotime('+2 days'))) $pts += 1;
            $t['_score'] = $pts;
            $t['_is_overdue'] = !empty($t['due_date']) && $t['due_date'] < $today;
        }
        unset($t);
        usort($allIncomplete, fn($a, $b) => $b['_score'] <=> $a['_score']);
        $outstandingWork = array_slice($allIncomplete, 0, 20);

        $storeHealth = array_values(array_map(function ($group) {
            $risk = 'Low';
            if ($group['total_overdue'] > 5) {
                $risk = 'High';
            } elseif ($group['total_overdue'] > 0 || $group['progress'] < 50) {
                $risk = 'Medium';
            }

            return [
                'id' => $group['store']['id'],
                'name' => $group['store']['name'],
                'color' => $group['store']['color'] ?? '#3b82f6',
                'active_tasks' => $group['total_tasks'] - $group['completed_tasks'],
                'overdue' => $group['total_overdue'],
                'completed_week' => 0,
                'progress' => $group['progress'],
                'risk' => $risk,
            ];
        }, $storeGroups));

        usort($storeHealth, function ($a, $b) {
            if ($a['overdue'] !== $b['overdue']) {
                return $b['overdue'] <=> $a['overdue'];
            }

            return $a['progress'] <=> $b['progress'];
        });

        $roleFocus = [
            'title' => 'My Focus',
            'summary' => 'Keep your actionable queue moving first.',
        ];
        if (($user['role'] ?? 'member') === 'admin') {
            $topStore = $storeHealth[0]['name'] ?? 'All stores';
            $topMember = $teamWorkload[0]['name'] ?? 'Team';
            $roleFocus = [
                'title' => 'Executive Focus',
                'summary' => $totalOverdue > 0
                    ? "{$totalOverdue} overdue tasks need escalation. {$topStore} is the riskiest store and {$topMember} carries the heaviest load."
                    : "Operations are stable today. Watch {$topStore} for the next backlog shift.",
            ];
        } elseif (($user['role'] ?? 'member') === 'manager') {
            $roleFocus = [
                'title' => 'Manager Queue',
                'summary' => $totalOverdue > 0
                    ? "Start with overdue work, then unblock in-progress tasks and rebalance the busiest assignees."
                    : "Today is clear for follow-ups, approvals, and recurring control checks.",
            ];
        } else {
            $myOverdue = count($this->taskModel->getOverdue($_SESSION['user_id']));
            $myUpcoming = count($this->taskModel->getUpcoming($_SESSION['user_id'], 7));
            $roleFocus = [
                'title' => 'My Focus',
                'summary' => $myOverdue > 0
                    ? "You have {$myOverdue} overdue tasks. Clear those first, then move into the next {$myUpcoming} upcoming tasks."
                    : "No overdue work. Your next {$myUpcoming} tasks are ready to move.",
            ];
        }

        // ── AI Insights — rich, data-driven, role-aware ──────────────────────
        $aiInsights = [];

        // 1. Overdue severity + top store
        if ($totalOverdue > 0) {
            $topRiskStore = null;
            foreach ($storeHealth as $sh) {
                if ($sh['overdue'] > 0 && ($topRiskStore === null || $sh['overdue'] > $topRiskStore['overdue'])) {
                    $topRiskStore = $sh;
                }
            }
            $today = app_today();
            $avgDaysLate = $db->fetch(
                "SELECT ROUND(AVG(DATEDIFF(?, due_date))) as avg_days
                 FROM tasks WHERE is_completed = 0 AND due_date < ?",
                [$today, $today]
            );
            $daysLateMsg = (!empty($avgDaysLate['avg_days']) && $avgDaysLate['avg_days'] > 0)
                ? " — average {$avgDaysLate['avg_days']} days late" : '';
            $storeMsg = $topRiskStore ? " {$topRiskStore['name']} leads with {$topRiskStore['overdue']} overdue." : '';
            $aiInsights[] = [
                'icon' => '🔴',
                'level' => 'critical',
                'text' => "{$totalOverdue} tasks overdue{$daysLateMsg}.{$storeMsg} Resolve before creating new work.",
            ];
        } else {
            $aiInsights[] = [
                'icon' => '✅',
                'level' => 'ok',
                'text' => "No overdue tasks. Good window to close in-progress work and verify recurring controls.",
            ];
        }

        // 2. Workload imbalance detection
        if (count($teamWorkload) >= 2) {
            $avgWorkload = array_sum(array_column($teamWorkload, 'total')) / count($teamWorkload);
            $overloaded  = array_filter($teamWorkload, function($m) use ($avgWorkload) {
                return $m['total'] > $avgWorkload * 1.8 && $m['total'] > 5;
            });
            $underloaded = array_filter($teamWorkload, function($m) use ($avgWorkload) {
                return $m['total'] < $avgWorkload * 0.4 && $avgWorkload > 3;
            });
            if (!empty($overloaded)) {
                $ol = array_values($overloaded)[0];
                $aiInsights[] = [
                    'icon' => '⚠️',
                    'level' => 'warning',
                    'text' => "{$ol['name']} carries {$ol['total']} tasks vs team avg of " . round($avgWorkload) . ". Consider redistributing " . max(1, (int)($ol['total'] - $avgWorkload)) . " tasks.",
                ];
            } elseif (!empty($teamWorkload)) {
                $topMember = $teamWorkload[0];
                $aiInsights[] = [
                    'icon' => '👥',
                    'level' => 'info',
                    'text' => "{$topMember['name']} has the highest load: {$topMember['total']} tasks, {$topMember['in_progress']} in progress, {$topMember['overdue']} overdue.",
                ];
            }
        }

        // 3. Recurring task health
        $recurringRisk = $db->fetch(
            "SELECT COUNT(*) as total FROM tasks
             WHERE repeat_type <> 'none' AND is_completed = 1
               AND NOT EXISTS (
                   SELECT 1 FROM tasks ft
                   WHERE ft.recurring_root_id = COALESCE(tasks.recurring_root_id, tasks.id)
                     AND ft.due_date > tasks.due_date
               )"
        );
        $totalRecurring = $db->fetch("SELECT COUNT(*) as c FROM tasks WHERE repeat_type <> 'none' AND is_completed = 0");
        $recurringCount = (int)($totalRecurring['c'] ?? 0);
        if (!empty($recurringRisk['total']) && $recurringRisk['total'] > 0) {
            $aiInsights[] = [
                'icon' => '🔄',
                'level' => 'warning',
                'text' => "{$recurringRisk['total']} recurring tasks completed without a next occurrence. Run a recurring sync to regenerate them. {$recurringCount} active recurring tasks total.",
            ];
        } elseif ($recurringCount > 0) {
            $aiInsights[] = [
                'icon' => '🔄',
                'level' => 'ok',
                'text' => "{$recurringCount} active recurring tasks are on schedule. No generation gaps detected.",
            ];
        }

        // 4. At-risk projects (active, low progress, has due-date tasks)
        $atRiskProjects = $db->fetchAll(
            "SELECT p.name, p.id,
                    COUNT(t.id) as total,
                    SUM(CASE WHEN t.is_completed = 1 THEN 1 ELSE 0 END) as done,
                    SUM(CASE WHEN t.is_completed = 0 AND t.due_date < CURDATE() THEN 1 ELSE 0 END) as overdue_ct
             FROM projects p
             JOIN tasks t ON t.project_id = p.id
             WHERE (p.status = 'active' OR p.status IS NULL)
             GROUP BY p.id, p.name
             HAVING total >= 3 AND (done / total) < 0.25 AND overdue_ct > 0
             ORDER BY overdue_ct DESC
             LIMIT 3"
        );
        if (!empty($atRiskProjects)) {
            $names = implode(', ', array_column($atRiskProjects, 'name'));
            $aiInsights[] = [
                'icon' => '📉',
                'level' => 'warning',
                'text' => count($atRiskProjects) . " projects below 25% completion with overdue tasks: {$names}. These need immediate attention.",
            ];
        }

        // 5. Productivity trend (this week vs last week completed)
        $thisWeek = $db->fetch(
            "SELECT COUNT(*) as c FROM tasks WHERE is_completed = 1 AND updated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)"
        );
        $lastWeek = $db->fetch(
            "SELECT COUNT(*) as c FROM tasks WHERE is_completed = 1 AND updated_at BETWEEN DATE_SUB(NOW(), INTERVAL 14 DAY) AND DATE_SUB(NOW(), INTERVAL 7 DAY)"
        );
        $tw = (int)($thisWeek['c'] ?? 0);
        $lw = (int)($lastWeek['c'] ?? 0);
        if ($lw > 0) {
            $trend = $tw >= $lw ? '+' . ($tw - $lw) . ' vs last week ↑' : '-' . ($lw - $tw) . ' vs last week ↓';
            $trendLevel = $tw >= $lw ? 'ok' : 'warning';
            $aiInsights[] = [
                'icon' => $tw >= $lw ? '📈' : '📉',
                'level' => $trendLevel,
                'text' => "Team completed {$tw} tasks this week ({$trend}). " . ($tw >= $lw ? "Momentum is healthy." : "Velocity dropped — check for blockers."),
            ];
        }

        $notifications = new Notification();
        $unreadCount = $notifications->getUnreadCount($_SESSION['user_id']);

        // ── V3 Decision Intelligence Layer ───────────────────────────────────
        // detectProblems() is self-contained (runs its own lightweight queries)
        // so it does not duplicate the heavy per-store loops above.
        // ── V5 Autonomy Layer (wraps V4 DecisionEngine) ───────────────────────
        $overviewRole    = isAdmin() ? 'admin' : (isManager() ? 'manager' : 'staff');
        $v5Engine        = new AutonomyEngine((int)$_SESSION['user_id'], $overviewRole);
        $v5Result        = $v5Engine->classifyAll();
        $rankedDecisions = $v5Result['decisions']     ?? [];
        $decisionQuickWin= $v5Result['quick_win']     ?? null;
        $v4AllClear      = $v5Result['all_clear']     ?? true;
        $autoQueue       = $v5Result['auto_queue']    ?? [];
        $approvalQueue   = $v5Result['approval_queue']?? [];
        $blockedQueue    = $v5Result['blocked']        ?? [];

        // V3 compat shim: rankedProblems & comparedProblems still used by template
        $smartEngine     = new SmartEngine((int)$_SESSION['user_id'], $overviewRole);
        $rawProblems     = $smartEngine->detectProblems();
        $rankedProblems  = $smartEngine->rankProblems($rawProblems);
        $comparedProblems= count($rankedProblems) >= 2
            ? $smartEngine->comparePlans($rankedProblems)
            : [];

        // ── CEO+CFO Command Center ────────────────────────────────────────────────
        try {
            $financeEngine    = new FinanceIntelligenceEngine();
            $complianceEngine = new ComplianceEngine();
            $unifiedRisk      = new UnifiedRiskEngine();

            $cashTimeline     = $financeEngine->getCashTimeline();
            $paymentRisk      = $financeEngine->getPaymentRiskBuckets();
            $vendorIntel      = $financeEngine->getVendorIntelligence();
            $totalCashRisk    = $financeEngine->getTotalCashRisk();

            $filingCalendar   = $complianceEngine->getFilingCalendar();
            $overdueFilings   = $complianceEngine->getOverdueFilings();
            $complianceRisk   = $complianceEngine->getComplianceRisk();

            $riskAssessment   = $unifiedRisk->assess();
        } catch (\Throwable $e) {
            // Fail gracefully — catches both Exception and Error (TypeError etc.)
            error_log('[CommandCenter] Engine error: ' . $e->getMessage());
            $cashTimeline = $paymentRisk = $vendorIntel = [];
            $totalCashRisk = 0;
            $filingCalendar = $overdueFilings = [];
            $complianceRisk = ['score'=>0,'level'=>'low','overdue_count'=>0,'due_soon_count'=>0];
            $riskAssessment = ['total'=>0,'level'=>'low','breakdown'=>['finance'=>['score'=>0],'operations'=>['score'=>0],'compliance'=>['score'=>0]],'top_driver'=>''];
        }

        // Build top decisions by merging bill risk + existing rankedDecisions
        $topDecisions = [];

        // 1. Critical/overdue bills → bill decisions
        $criticalBills = array_merge($paymentRisk['critical'] ?? [], $paymentRisk['high'] ?? []);
        foreach (array_slice($criticalBills, 0, 2) as $bill) {
            $isOverdue = ($bill['status'] === 'overdue') || ($bill['due_date'] < $today);
            $daysOverdue = $isOverdue ? (int)floor((strtotime($today) - strtotime($bill['due_date'])) / 86400) : 0;
            $impactLevel = $isOverdue ? 'CRITICAL' : 'HIGH';
            $topDecisions[] = [
                'type'         => 'bill',
                'title'        => 'Pay ' . ($bill['vendor'] ?: $bill['title']),
                'deadline'     => $bill['due_date'] === $today ? 'Today' : $bill['due_date'],
                'impact_level' => $impactLevel,
                'impact_score' => $isOverdue ? 95 : 80,
                'consequence'  => $isOverdue
                    ? 'Overdue ' . $daysOverdue . ' day(s) — risk of late fees and service disruption'
                    : 'Due today — pay to maintain vendor relationship',
                'amount'       => (float)($bill['amount'] ?? 0),
                'action'       => ['type'=>'pay_bill','label'=>'Pay Now','url'=>APP_URL.'/bills/store/'.(int)($bill['store_id'] ?? 0),'data'=>['bill_id'=>(int)$bill['id']]],
                'prediction'   => ['if_ignored'=>['Late fee applied','Vendor may suspend service'],'horizon_hours'=>24],
            ];
        }

        // 2. Overdue compliance filings → compliance decisions
        foreach (array_slice($overdueFilings, 0, 1) as $filing) {
            $topDecisions[] = [
                'type'         => 'compliance',
                'title'        => 'File ' . $filing['title'],
                'deadline'     => $filing['due_date'] < $today ? 'OVERDUE' : $filing['due_date'],
                'impact_level' => 'CRITICAL',
                'impact_score' => 90,
                'consequence'  => 'Regulatory filing overdue — possible penalty and audit risk',
                'amount'       => (float)($filing['amount'] ?? 0),
                'action'       => ['type'=>'file_now','label'=>'File Now','url'=>APP_URL.'/bills/store/'.(int)($filing['store_id'] ?? 0),'data'=>[]],
                'prediction'   => ['if_ignored'=>['Government penalty','Potential audit trigger'],'horizon_hours'=>72],
            ];
        }

        // 3. Existing V4 ranked decisions (overload/team)
        foreach (array_slice($rankedDecisions ?? [], 0, 1) as $rd) {
            if ($rd['problem_type'] === 'overload') {
                $topDecisions[] = [
                    'type'         => 'team',
                    'title'        => $rd['title'] ?? 'Rebalance Team Workload',
                    'deadline'     => 'Now',
                    'impact_level' => $rd['impact_level'] ?? 'HIGH',
                    'impact_score' => (int)($rd['impact_score'] ?? 70),
                    'consequence'  => $rd['prediction']['if_ignored'][0] ?? 'Team overload will cause task delays',
                    'amount'       => null,
                    'action'       => ['type'=>'rebalance','label'=>'Rebalance Team','url'=>APP_URL.'/team','data'=>[]],
                    'prediction'   => $rd['prediction'] ?? ['if_ignored'=>['Task delays'],'horizon_hours'=>48],
                ];
            }
        }

        // Sort top decisions by impact_score DESC, limit to 3
        usort($topDecisions, fn($a,$b) => ($b['impact_score'] ?? 0) <=> ($a['impact_score'] ?? 0));
        $topDecisions = array_slice($topDecisions, 0, 3);
        foreach ($topDecisions as $i => &$td) { $td['rank'] = $i + 1; }
        unset($td);

        // Build exec summary
        $overdueTaskCount = (int)($db->fetch("SELECT COUNT(*) AS c FROM tasks WHERE is_completed=0 AND status NOT IN ('completed','done','cancelled') AND due_date < ?", [$today])['c'] ?? 0);
        $overloadedCount  = (int)($db->fetch(
            "SELECT COUNT(DISTINCT assignee_id) AS c FROM tasks WHERE is_completed=0 GROUP BY assignee_id HAVING COUNT(*)>5 LIMIT 1"
        )['c'] ?? 0);  // simplified — just check if any member has >5 open tasks

        // Build operations data (per-store risk + team)
        $storeRisk = [];
        foreach ($db->fetchAll("SELECT id, name FROM stores WHERE is_active=1 ORDER BY name") as $st) {
            $sid = (int)$st['id'];
            $overdueInStore = (int)($db->fetch(
                "SELECT COUNT(*) AS c FROM tasks t JOIN projects p ON t.project_id=p.id WHERE p.store_id=? AND t.is_completed=0 AND t.due_date<?",
                [$sid, $today]
            )['c'] ?? 0);
            $totalInStore = (int)($db->fetch(
                "SELECT COUNT(*) AS c FROM tasks t JOIN projects p ON t.project_id=p.id WHERE p.store_id=? AND t.is_completed=0",
                [$sid]
            )['c'] ?? 0);
            $overloadedInStore = (int)($db->fetch(
                "SELECT COUNT(DISTINCT t.assignee_id) AS c FROM tasks t JOIN projects p ON t.project_id=p.id WHERE p.store_id=? AND t.is_completed=0 GROUP BY t.assignee_id HAVING COUNT(*)>4",
                [$sid]
            )['c'] ?? 0);
            $storeStatus = $overdueInStore >= 5 ? 'critical' : ($overdueInStore >= 2 ? 'at_risk' : 'on_track');
            $storeRisk[] = [
                'store_id'     => $sid,
                'name'         => $st['name'],
                'overdue'      => $overdueInStore,
                'total_open'   => $totalInStore,
                'revenue_risk' => $overdueInStore >= 3,
                'overloaded'   => $overloadedInStore > 0,
                'status'       => $storeStatus,
            ];
        }

        $teamLoad = [];
        $members = $db->fetchAll(
            "SELECT u.id, u.name,
                    COUNT(t.id) AS open_tasks,
                    SUM(CASE WHEN t.due_date < ? THEN 1 ELSE 0 END) AS overdue_tasks
             FROM users u
             LEFT JOIN tasks t ON t.assignee_id=u.id AND t.is_completed=0
             WHERE u.is_active=1
             GROUP BY u.id, u.name
             ORDER BY overdue_tasks DESC, open_tasks DESC
             LIMIT 10",
            [$today]
        );
        foreach ($members as $m) {
            $ov = (int)($m['overdue_tasks'] ?? 0);
            $op = (int)($m['open_tasks'] ?? 0);
            $loadLevel = $ov >= 4 ? 'CRITICAL' : ($ov >= 2 || $op >= 6 ? 'WATCH' : 'STABLE');
            $teamLoad[] = ['name'=>$m['name'],'load_level'=>$loadLevel,'open_tasks'=>$op,'overdue_tasks'=>$ov,'user_id'=>(int)$m['id']];
        }

        $totalOpen   = (int)($db->fetch("SELECT COUNT(*) AS c FROM tasks WHERE is_completed=0")['c'] ?? 0);
        $totalProjTasks = (int)($db->fetch("SELECT COUNT(*) AS c FROM tasks")['c'] ?? 0);
        $completedPct = $totalProjTasks > 0 ? round($totalTasks > 0 ? ($completedTasks/$totalTasks*100) : 0) : 0;
        $atRiskCount  = array_sum(array_column(array_filter($storeRisk, fn($s)=>$s['status']==='at_risk'), 'overdue'));
        $criticalCount= array_sum(array_column(array_filter($storeRisk, fn($s)=>$s['status']==='critical'), 'overdue'));
        $onTrackPct   = $totalOpen > 0 ? max(0, 100 - (int)(($overdueTaskCount / $totalOpen) * 100)) : 100;
        $atRiskPct    = $totalOpen > 0 ? min(100, (int)(($atRiskCount / max($totalOpen,1)) * 100)) : 0;
        $criticalPct  = max(0, 100 - $onTrackPct - $atRiskPct);

        // ── Penalty KPIs for Admin Overview (from 2026-06-17 onwards)
        $penaltyKpis = null;
        try {
            require_once __DIR__ . '/../models/Penalty.php';
            $penaltyModel = new Penalty();
            $penaltyKpis = $penaltyModel->getAdminKpis();
        } catch (Throwable $e) {
            $penaltyKpis = null;
        }

        // ── Active penalty users for balanced display
        $penaltyUsers = [];
        try {
            $penaltyUsers = $penaltyModel->getAllSummaries() ?? [];
        } catch (Throwable $e) {
            $penaltyUsers = [];
        }

        $commandCenter = [
            'exec_summary' => [
                'total_cash_risk'    => $totalCashRisk,
                'overdue_bills'      => ['count'=>count($cashTimeline['overdue']['bills'] ?? []),'amount'=>(float)($cashTimeline['overdue']['amount'] ?? 0)],
                'critical_tasks'     => $overdueTaskCount,
                'compliance_risk'    => ['count'=>count($overdueFilings),'level'=>$complianceRisk['level']],
                'execution_risk'     => ['level'=> $overdueTaskCount >= 10 ? 'critical' : ($overdueTaskCount >= 5 ? 'high' : ($overdueTaskCount >= 2 ? 'medium' : 'low')), 'overloaded_count'=>$overloadedCount],
                'unified_risk'       => $riskAssessment,
            'penalty_cost_month' => $penaltyKpis['month']['vnd'] ?? 0.0,
            ],
            'top_decisions' => $topDecisions,
            'finance' => [
                'cash_timeline'    => $cashTimeline,
                'risk_buckets'     => $paymentRisk,
                'vendors'          => $vendorIntel,
            ],
            'operations' => [
                'health'  => ['on_track_pct'=>$onTrackPct,'at_risk_pct'=>$atRiskPct,'critical_pct'=>$criticalPct,'total_tasks'=>$totalOpen],
                'stores'  => $storeRisk,
                'team'    => $teamLoad,
            ],
            'compliance' => [
                'calendar'   => $filingCalendar,
                'overdue'    => $overdueFilings,
                'risk_score' => $complianceRisk['score'],
                'risk_level' => $complianceRisk['level'],
            ],
            'generated_at' => date('Y-m-d H:i:s'),
        ];

        $oblKpis = [];
        try {
            if (!class_exists('Obligation')) {
                require_once __DIR__ . '/../models/Obligation.php';
            }
            $oblKpis = (new Obligation())->getDashboardKpis();
        } catch (Throwable $e) {
            $oblKpis = [];
        }

        // Expose penalty KPIs as standalone var for the view
        $penaltyKpis = $commandCenter['penaltyKpis'] ?? null;

        require __DIR__ . '/../views/dashboard/overview.php';
    }

    /**
     * Business detail page: /overview/store/{id}
     * Shows categories (projects) + tasks for a single store/business.
     */
    /**
     * Phase 1 — Workflow Command Center page
     * Renders the new top-of-dashboard layout that consumes
     * /api/v1/command-center and the three queue APIs.
     */
    public function commandCenterPage(): void
    {
        if (!isLoggedIn()) { redirect('login'); }
        $pageTitle = 'Command Center';
        $currentPage = 'command-center';
        $extraCss = ['workflow-command-center.css'];
        $extraJs  = ['workflow-command-center.js'];

        ob_start();
        include __DIR__ . '/../views/workflow/command-center.php';
        $content = ob_get_clean();
        require __DIR__ . '/../views/layouts/main.php';
    }

    public function businessDetail($storeId) {
        $storeId = (int)$storeId;
        $db = Database::getInstance();
        $storeModel = new Store();
        $store = $storeModel->find($storeId);
        if (!$store) { flash('error', 'Business not found'); redirect('overview'); return; }

        $today = app_today();
        $userId = $_SESSION['user_id'];

        // All projects (categories) in this store with task stats
        $categories = $db->fetchAll(
            "SELECT p.id, p.name, p.color, p.description, p.status,
                    COUNT(t.id) as total_tasks,
                    SUM(CASE WHEN t.is_completed = 1 THEN 1 ELSE 0 END) as completed_tasks,
                    SUM(CASE WHEN t.is_completed = 0 AND t.due_date < ? THEN 1 ELSE 0 END) as overdue_tasks,
                    SUM(CASE WHEN t.is_completed = 0 AND t.due_date BETWEEN ? AND DATE_ADD(?, INTERVAL 7 DAY) THEN 1 ELSE 0 END) as due_soon
             FROM projects p
             LEFT JOIN tasks t ON t.project_id = p.id
             WHERE p.store_id = ? AND (p.status = 'active' OR p.status IS NULL)
             GROUP BY p.id, p.name, p.color, p.description, p.status
             ORDER BY overdue_tasks DESC, total_tasks DESC",
            [$today, $today, $today, $storeId]
        );

        foreach ($categories as &$cat) {
            $cat['progress'] = (int)$cat['total_tasks'] > 0
                ? round((int)$cat['completed_tasks'] / (int)$cat['total_tasks'] * 100) : 0;
            $cat['risk'] = (int)$cat['overdue_tasks'] > 0 ? 'red'
                : ((int)$cat['progress'] < 30 && (int)$cat['total_tasks'] > 0 ? 'yellow' : 'green');
        }
        unset($cat);

        // Outstanding tasks for this store (top 25 by priority)
        $outstandingTasks = $db->fetchAll(
            "SELECT t.id, t.title, t.due_date, t.priority, t.status, t.is_completed,
                    t.repeat_type,
                    p.id as project_id, p.name as project_name, p.color as project_color,
                    u.name as assignee_name, u.id as assignee_id
             FROM tasks t
             JOIN projects p ON t.project_id = p.id
             LEFT JOIN users u ON t.assignee_id = u.id
             WHERE p.store_id = ? AND t.is_completed = 0
             ORDER BY
                (CASE WHEN t.due_date < ? THEN 0 ELSE 1 END) ASC,
                FIELD(t.priority,'urgent','high','medium','low'),
                t.due_date ASC
             LIMIT 25",
            [$storeId, $today]
        );

        // Recurring tasks for this store
        $recurringTasks = $db->fetchAll(
            "SELECT t.id, t.title, t.due_date, t.status, t.is_completed,
                    t.repeat_type, p.name as project_name, u.name as assignee_name
             FROM tasks t
             JOIN projects p ON t.project_id = p.id
             LEFT JOIN users u ON t.assignee_id = u.id
             WHERE p.store_id = ? AND t.repeat_type <> 'none' AND t.is_completed = 0
             ORDER BY t.due_date ASC
             LIMIT 20",
            [$storeId]
        );

        // Bills for this store this month
        $billMonth = (int)date('m');
        $billYear  = (int)date('Y');
        $bills = [];
        try {
            $billModel = new Bill();
            $billModel->ensureRecurringForMonth($storeId, $billMonth, $billYear);
            $bills = $billModel->getByStore($storeId, $billMonth, $billYear);
        } catch (\Exception $e) {}

        // Team working on this store
        $teamStats = $db->fetchAll(
            "SELECT u.id, u.name,
                    COUNT(DISTINCT t.id) as total,
                    SUM(CASE WHEN t.is_completed = 1 THEN 1 ELSE 0 END) as completed,
                    SUM(CASE WHEN t.is_completed = 0 AND t.due_date < ? THEN 1 ELSE 0 END) as overdue,
                    SUM(CASE WHEN t.is_completed = 0 AND t.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress
             FROM users u
             JOIN tasks t ON t.assignee_id = u.id
             JOIN projects p ON t.project_id = p.id
             WHERE p.store_id = ? AND u.is_active = 1
             GROUP BY u.id, u.name
             ORDER BY overdue DESC, total DESC",
            [$today, $storeId]
        );

        // KPI totals
        $totalTasks    = array_sum(array_column($categories, 'total_tasks'));
        $completedTasks = array_sum(array_column($categories, 'completed_tasks'));
        $overdueTasks  = array_sum(array_column($categories, 'overdue_tasks'));
        $progress      = $totalTasks > 0 ? round($completedTasks / $totalTasks * 100) : 0;

        $notifications = new Notification();
        $unreadCount = $notifications->getUnreadCount($userId);
        $projects = $this->projectModel->getByUser($userId, isManager());

        require __DIR__ . '/../views/dashboard/business.php';
    }

    /**
     * Member Portfolio detail page: /overview/member/{id}
     * Shows a single team member's full task workload, breakdown by store,
     * completion rate, urgency groups, and recent activity.
     */
    public function memberDetail($memberId) {
        $memberId = (int)$memberId;
        $db       = Database::getInstance();
        $userId   = (int)$_SESSION['user_id'];

        // Authorization — admin/manager can view anyone; staff only themselves
        if (!isAdmin() && !isManager() && $memberId !== $userId) {
            redirect('overview');
            return;
        }

        $member = $this->userModel->findById($memberId);
        if (!$member) { flash('error', 'Member not found'); redirect('overview'); return; }

        $today   = app_today();
        $weekEnd = date('Y-m-d', strtotime('+7 days'));

        // All tasks assigned to this member (with project + store context)
        $allTasks = $db->fetchAll(
            "SELECT t.*, p.name as project_name, p.color as project_color, p.id as project_id,
                    s.id as store_id, s.name as store_name, s.color as store_color,
                    sec.name as section_name
             FROM tasks t
             LEFT JOIN projects p ON t.project_id = p.id
             LEFT JOIN stores   s ON p.store_id = s.id
             LEFT JOIN sections sec ON t.section_id = sec.id
             WHERE t.assignee_id = ?
             ORDER BY t.is_completed ASC,
                      CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END,
                      t.due_date ASC,
                      FIELD(t.priority,'urgent','high','medium','low'),
                      t.created_at DESC",
            [$memberId]
        );

        // Compute stats
        $stats = [
            'total'           => count($allTasks),
            'completed'       => 0,
            'overdue'         => 0,
            'in_progress'     => 0,
            'due_today'       => 0,
            'due_week'        => 0,
            'recurring'       => 0,
            'unscheduled'     => 0,
        ];
        foreach ($allTasks as $t) {
            if (!empty($t['is_completed'])) { $stats['completed']++; continue; }
            if (($t['repeat_type'] ?? 'none') !== 'none') $stats['recurring']++;
            if (($t['status'] ?? '') === 'in_progress') $stats['in_progress']++;
            $d = !empty($t['due_date']) ? substr($t['due_date'], 0, 10) : null;
            if ($d && $d < $today)            $stats['overdue']++;
            elseif ($d && $d === $today)      $stats['due_today']++;
            elseif ($d && $d <= $weekEnd)     $stats['due_week']++;
            elseif (!$d)                      $stats['unscheduled']++;
        }
        $stats['completion_rate'] = $stats['total'] > 0 ? round($stats['completed'] / $stats['total'] * 100) : 0;
        $workloadScore  = $stats['overdue'] * 4 + $stats['in_progress'] * 2 + $stats['due_week'];
        $workloadStatus = $workloadScore >= 20 ? 'overloaded' : ($workloadScore >= 8 ? 'busy' : 'stable');

        // Group active tasks by urgency bucket
        $activeTasks   = array_values(array_filter($allTasks, function($t) { return empty($t['is_completed']); }));
        $completedList = array_slice(
            array_values(array_filter($allTasks, function($t) { return !empty($t['is_completed']); })),
            0, 30
        );

        $taskGroups = [];
        foreach ($activeTasks as $t) {
            $d = !empty($t['due_date']) ? substr($t['due_date'], 0, 10) : null;
            if ($d && $d < $today)            $key = '🔴 Overdue';
            elseif ($d && $d === $today)      $key = '🟡 Due Today';
            elseif ($d && $d <= $weekEnd)     $key = '📅 Due This Week';
            elseif ($d)                       $key = '⚪ Upcoming';
            else                              $key = '— No Due Date';
            $taskGroups[$key][] = $t;
        }
        if (!empty($completedList)) $taskGroups['✅ Completed'] = $completedList;

        // Breakdown by store
        $storeBreakdown = [];
        foreach ($allTasks as $t) {
            $sid = (int)($t['store_id'] ?? 0);
            if (!isset($storeBreakdown[$sid])) {
                $storeBreakdown[$sid] = [
                    'id'      => $sid,
                    'name'    => $t['store_name'] ?? 'No Store',
                    'color'   => $t['store_color'] ?? '#888',
                    'total'   => 0, 'done' => 0, 'overdue' => 0, 'in_progress' => 0,
                ];
            }
            $storeBreakdown[$sid]['total']++;
            $d = !empty($t['due_date']) ? substr($t['due_date'], 0, 10) : null;
            if (!empty($t['is_completed']))            $storeBreakdown[$sid]['done']++;
            elseif ($d && $d < $today)                $storeBreakdown[$sid]['overdue']++;
            elseif (($t['status'] ?? '') === 'in_progress') $storeBreakdown[$sid]['in_progress']++;
        }
        uasort($storeBreakdown, function($a, $b) { return $b['total'] - $a['total']; });

        // Recent activity — tasks completed in last 14 days
        $recentCompleted = $db->fetchAll(
            "SELECT t.id, t.title, t.priority, t.updated_at,
                    p.name as project_name, p.color as project_color,
                    s.name as store_name, s.color as store_color
             FROM tasks t
             LEFT JOIN projects p ON t.project_id = p.id
             LEFT JOIN stores   s ON p.store_id = s.id
             WHERE t.assignee_id = ? AND t.is_completed = 1
               AND t.updated_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
             ORDER BY t.updated_at DESC
             LIMIT 15",
            [$memberId]
        );

        // Recurring tasks this member owns
        $recurringTasks = array_values(array_filter($allTasks, function($t) {
            return ($t['repeat_type'] ?? 'none') !== 'none' && empty($t['is_completed']);
        }));

        $notifications = new Notification();
        $unreadCount   = $notifications->getUnreadCount($userId);
        $projects      = $this->projectModel->getByUser($userId, isManager());

        require __DIR__ . '/../views/dashboard/member.php';
    }

    /**
     * Team Accountability page — /team
     * Manager/admin only. Full workload + risk table per team member.
     */
    public function team() {
        if (!isAdmin() && !isManager()) { redirect('overview'); return; }

        $db    = Database::getInstance();
        $today = app_today();
        $userId = (int)$_SESSION['user_id'];

        // Per-member aggregation
        $members = $db->fetchAll(
            "SELECT u.id, u.name, u.role, u.email,
                    COUNT(t.id)                                                             AS total,
                    SUM(CASE WHEN t.is_completed=1 THEN 1 ELSE 0 END)                      AS completed,
                    SUM(CASE WHEN t.is_completed=0 AND t.due_date < ? THEN 1 ELSE 0 END)   AS overdue,
                    SUM(CASE WHEN t.is_completed=0 AND t.due_date = ? THEN 1 ELSE 0 END)   AS due_today,
                    SUM(CASE WHEN t.is_completed=0 AND t.due_date BETWEEN ? AND DATE_ADD(?, INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS due_week,
                    SUM(CASE WHEN t.is_completed=0 AND t.status='in_progress' THEN 1 ELSE 0 END) AS in_progress,
                    SUM(CASE WHEN t.is_completed=0 THEN 1 ELSE 0 END)                      AS open,
                    COUNT(DISTINCT p.store_id)                                              AS stores_count,
                    SUM(CASE WHEN t.is_completed=1 AND t.updated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS completed_week
             FROM users u
             LEFT JOIN tasks t ON t.assignee_id = u.id
             LEFT JOIN projects p ON t.project_id = p.id
             WHERE u.is_active = 1
             GROUP BY u.id, u.name, u.role, u.email
             ORDER BY overdue DESC, open DESC, u.name ASC",
            [$today, $today, $today, $today]
        );

        // Per-member: store names, top overdue task, completion rate
        foreach ($members as &$m) {
            $m['on_time_pct'] = (int)$m['total'] > 0
                ? round((int)$m['completed'] / (int)$m['total'] * 100) : 0;

            // Risk badge
            $ov = (int)$m['overdue'];
            if      ($ov >= 5)                      $m['risk'] = 'critical';
            elseif  ($ov >= 3)                      $m['risk'] = 'behind';
            elseif  ($ov >= 1 || (int)$m['open']>15) $m['risk'] = 'watch';
            else                                     $m['risk'] = 'stable';

            // Businesses this member touches
            $biz = $db->fetchAll(
                "SELECT DISTINCT COALESCE(s.name, 'No Store') AS name, s.color
                 FROM tasks t
                 JOIN projects p ON p.id = t.project_id
                 LEFT JOIN stores s ON s.id = p.store_id
                 WHERE t.assignee_id = ? AND t.is_completed = 0
                 LIMIT 4",
                [(int)$m['id']]
            );
            $m['businesses'] = $biz;

            // Top overdue task
            $topOverdue = $db->fetch(
                "SELECT t.id, t.title, t.due_date, p.name AS project_name
                 FROM tasks t
                 LEFT JOIN projects p ON p.id = t.project_id
                 WHERE t.assignee_id = ? AND t.is_completed=0 AND t.due_date < ?
                 ORDER BY t.due_date ASC LIMIT 1",
                [(int)$m['id'], $today]
            );
            $m['top_overdue_task'] = $topOverdue;
        }
        unset($m);

        // ── Enhanced KPI totals ─────────────────────────────────────────────
        $totalOpen      = array_sum(array_column($members, 'open'));
        $totalOverdue   = array_sum(array_column($members, 'overdue'));
        $overloadedMembers = count(array_filter($members, fn($m) => in_array($m['risk'], ['critical','behind'])));

        // Businesses impacted (unique stores with overdue tasks)
        $bizImpacted = $db->fetch(
            "SELECT COUNT(DISTINCT p.store_id) AS cnt
             FROM tasks t
             JOIN projects p ON p.id = t.project_id
             WHERE t.is_completed = 0 AND t.due_date < ? AND p.store_id IS NOT NULL",
            [$today]
        );
        $bizImpactedCount = (int)($bizImpacted['cnt'] ?? 0);

        // Rebalance opportunities: members with open > 1.5× team average (and avg > 0)
        $avgOpen = count($members) > 0 ? $totalOpen / count($members) : 0;
        $rebalanceOpps = $avgOpen > 0
            ? count(array_filter($members, fn($m) => (int)$m['open'] > ($avgOpen * 1.5)))
            : 0;

        // Team on-time rate
        $totalAll = array_sum(array_column($members, 'total'));
        $totalDone = array_sum(array_column($members, 'completed'));
        $teamOnTimePct = $totalAll > 0 ? round($totalDone / $totalAll * 100) : 0;

        $teamTotals = [
            'members'    => count($members),
            'open'       => $totalOpen,
            'overdue'    => $totalOverdue,
            'done_week'  => array_sum(array_column($members, 'completed_week')),
            'overloaded' => $overloadedMembers,
            'biz_impact' => $bizImpactedCount,
            'rebalance'  => $rebalanceOpps,
            'on_time_pct'=> $teamOnTimePct,
        ];

        // ── Compute max open tasks (for workload bar scaling) ───────────────
        $maxOpen = max(1, max(array_column($members, 'open') ?: [1]));

        // ── Smart recommendations ───────────────────────────────────────────
        $smartRecs = [];
        // 1. Most overloaded member
        $sortedByOverdue = $members;
        usort($sortedByOverdue, fn($a,$b) => (int)$b['overdue'] - (int)$a['overdue']);
        $topOverloaded = $sortedByOverdue[0] ?? null;
        if ($topOverloaded && (int)$topOverloaded['overdue'] >= 3) {
            $smartRecs[] = [
                'severity' => 'critical',
                'icon'     => '🔥',
                'text'     => e($topOverloaded['name']) . ' has ' . (int)$topOverloaded['overdue'] . ' overdue tasks — rebalance now',
                'action'   => 'reassign',
                'user_id'  => (int)$topOverloaded['id'],
                'label'    => 'Reassign',
            ];
        }
        // 2. Business with most overdue
        $topBizOverdue = $db->fetch(
            "SELECT s.name AS store_name, COUNT(t.id) AS cnt
             FROM tasks t
             JOIN projects p ON p.id = t.project_id
             JOIN stores s ON s.id = p.store_id
             WHERE t.is_completed = 0 AND t.due_date < ?
             GROUP BY s.id ORDER BY cnt DESC LIMIT 1",
            [$today]
        );
        if ($topBizOverdue && (int)$topBizOverdue['cnt'] >= 2) {
            $smartRecs[] = [
                'severity' => 'warning',
                'icon'     => '🏪',
                'text'     => e($topBizOverdue['store_name']) . ' is impacted by ' . (int)$topBizOverdue['cnt'] . ' overdue tasks',
                'action'   => 'overview',
                'label'    => 'View Store',
            ];
        }
        // 3. Overall completion rate low
        if ($teamOnTimePct < 65 && $totalAll > 5) {
            $smartRecs[] = [
                'severity' => 'warning',
                'icon'     => '📉',
                'text'     => 'Team on-time rate is only ' . $teamOnTimePct . '% — review task assignments',
                'action'   => 'none',
                'label'    => null,
            ];
        }
        // 4. Underloaded users (could absorb work)
        $underloaded = array_filter($members, fn($m) => (int)$m['open'] <= 2 && (int)$m['open'] >= 0);
        if (count($underloaded) > 0 && $rebalanceOpps > 0) {
            $ul = array_values($underloaded)[0];
            $smartRecs[] = [
                'severity' => 'info',
                'icon'     => '⚡',
                'text'     => e($ul['name']) . ' has capacity (' . (int)$ul['open'] . ' open tasks) — ideal for redistribution',
                'action'   => 'reassign_to',
                'user_id'  => (int)$ul['id'],
                'label'    => 'Reassign To',
            ];
        }

        // All active stores (for filter dropdown)
        $allStoresFilter = $db->fetchAll(
            "SELECT DISTINCT s.id, s.name, s.color
             FROM stores s
             JOIN projects p ON p.store_id = s.id
             JOIN tasks t ON t.project_id = p.id
             WHERE t.is_completed = 0
             ORDER BY s.name"
        );

        $notifications = new Notification();
        $unreadCount   = $notifications->getUnreadCount($userId);
        $projects      = $this->projectModel->getByUser($userId, isManager());

        require __DIR__ . '/../views/dashboard/team.php';
    }

    /**
     * CEO / Executive Dashboard — /ceo
     * Fast-glance: business health, bill risk, team accountability, category matrix.
     * Admin/manager only.
     */
    public function ceo() {
        if (!isAdmin() && !isManager()) {
            redirect('overview');
            return;
        }

        $db    = Database::getInstance();
        $today = app_today();
        $month = (int)date('m');
        $year  = (int)date('Y');
        $userId = (int)$_SESSION['user_id'];

        // ── 1. Critical KPI Cards ─────────────────────────────────────────────

        // Overdue bills
        $todayForBills = app_today();
        $overdueBills = $db->fetch(
            "SELECT COUNT(*) AS cnt, COALESCE(SUM(amount),0) AS total_amount
             FROM bills WHERE (status='overdue' OR (status='pending' AND due_date < ?))
               AND COALESCE(is_archived,0)=0",
            [$todayForBills]
        );
        $overdueBillCount  = (int)($overdueBills['cnt'] ?? 0);
        $overdueBillAmount = (float)($overdueBills['total_amount'] ?? 0);

        // Bills due this week
        $dueThisWeek = $db->fetch(
            "SELECT COUNT(*) AS cnt, COALESCE(SUM(amount),0) AS total_amount
             FROM bills WHERE status='pending' AND due_date BETWEEN ? AND DATE_ADD(?, INTERVAL 7 DAY)
               AND COALESCE(is_archived,0)=0",
            [$todayForBills, $todayForBills]
        );
        $dueWeekCount  = (int)($dueThisWeek['cnt'] ?? 0);
        $dueWeekAmount = (float)($dueThisWeek['total_amount'] ?? 0);

        // Overdue tasks (all users)
        $overdueTasksRow = $db->fetch(
            "SELECT COUNT(*) AS cnt FROM tasks WHERE is_completed=0 AND due_date < ?", [$today]
        );
        $overdueTaskCount = (int)($overdueTasksRow['cnt'] ?? 0);

        // Bills paid this month
        $paidThisMonth = $db->fetch(
            "SELECT COUNT(*) AS cnt, COALESCE(SUM(amount),0) AS total
             FROM bills WHERE status='paid' AND MONTH(due_date)=? AND YEAR(due_date)=?
               AND COALESCE(is_archived,0)=0",
            [$month, $year]
        );

        // ── 2. Business Health Matrix ─────────────────────────────────────────
        $businessModel  = new Business();
        $businessHealth = $businessModel->getCeoFinancialSummary($month, $year);

        // Count businesses "at risk" or "critical"
        $atRiskCount = count(array_filter($businessHealth, function($b) {
            return in_array($b['health'], ['critical', 'at_risk']);
        }));

        // ── 3. Urgent Queue — top 10 items needing immediate action ──────────
        // COLLATE utf8mb4_unicode_ci applied to every text column in both UNION
        // branches — prevents SQLSTATE[HY000] 1271 when tables have mixed collations.
        $urgentQueue = $db->fetchAll(
            "SELECT
                CAST('bill' AS CHAR) COLLATE utf8mb4_unicode_ci          AS type,
                b.id,
                CONVERT(b.title    USING utf8mb4) COLLATE utf8mb4_unicode_ci AS title,
                b.due_date, b.amount,
                CONVERT(b.status   USING utf8mb4) COLLATE utf8mb4_unicode_ci AS status,
                CONVERT(s.name     USING utf8mb4) COLLATE utf8mb4_unicode_ci AS business_name,
                CONVERT(s.color    USING utf8mb4) COLLATE utf8mb4_unicode_ci AS business_color,
                CONVERT(COALESCE(b.category,'general') USING utf8mb4) COLLATE utf8mb4_unicode_ci AS category,
                CAST(NULL          AS CHAR)        COLLATE utf8mb4_unicode_ci AS assignee_name
             FROM bills b
             JOIN stores s ON s.id = b.store_id
             WHERE b.status IN ('overdue','pending') AND b.due_date <= DATE_ADD(CURDATE(), INTERVAL 3 DAY)
               AND COALESCE(b.is_archived,0)=0
             UNION ALL
             SELECT
                CAST('task' AS CHAR) COLLATE utf8mb4_unicode_ci          AS type,
                t.id,
                CONVERT(t.title    USING utf8mb4) COLLATE utf8mb4_unicode_ci AS title,
                t.due_date, NULL AS amount,
                CONVERT(t.status   USING utf8mb4) COLLATE utf8mb4_unicode_ci AS status,
                CONVERT(COALESCE(st.name, p.name) USING utf8mb4) COLLATE utf8mb4_unicode_ci AS business_name,
                CONVERT(COALESCE(st.color,'#6B7280') USING utf8mb4) COLLATE utf8mb4_unicode_ci AS business_color,
                CONVERT(p.name     USING utf8mb4) COLLATE utf8mb4_unicode_ci AS category,
                CONVERT(u.name     USING utf8mb4) COLLATE utf8mb4_unicode_ci AS assignee_name
             FROM tasks t
             JOIN projects p ON p.id = t.project_id
             LEFT JOIN stores st ON st.id = p.store_id
             LEFT JOIN users u ON u.id = t.assignee_id
             WHERE t.is_completed=0 AND t.due_date < ?
             ORDER BY due_date ASC
             LIMIT 10",
            [$today]
        );

        // ── 4. Team Accountability ────────────────────────────────────────────
        $teamRows = $db->fetchAll(
            "SELECT u.id, u.name,
                    COUNT(t.id)                                                      AS total,
                    SUM(CASE WHEN t.is_completed=1 THEN 1 ELSE 0 END)               AS completed,
                    SUM(CASE WHEN t.is_completed=0 AND t.due_date < ? THEN 1 ELSE 0 END) AS overdue,
                    SUM(CASE WHEN t.is_completed=0 AND t.status='in_progress' THEN 1 ELSE 0 END) AS in_progress,
                    SUM(CASE WHEN t.is_completed=0 AND t.due_date BETWEEN ? AND DATE_ADD(?, INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS due_week,
                    COUNT(DISTINCT p.store_id)                                       AS businesses_count
             FROM users u
             LEFT JOIN tasks t ON t.assignee_id = u.id
             LEFT JOIN projects p ON t.project_id = p.id
             WHERE u.is_active = 1
             GROUP BY u.id, u.name
             ORDER BY overdue DESC, total DESC",
            [$today, $today, $today]
        );

        foreach ($teamRows as &$row) {
            $open = (int)$row['total'] - (int)$row['completed'];
            $row['open'] = $open;
            $row['on_time_pct'] = (int)$row['total'] > 0
                ? round((int)$row['completed'] / (int)$row['total'] * 100) : 0;
            // Risk badge
            if ((int)$row['overdue'] >= 5)                          $row['risk'] = 'critical';
            elseif ((int)$row['overdue'] >= 2)                      $row['risk'] = 'behind';
            elseif ((int)$row['overdue'] >= 1 || $open > 15)       $row['risk'] = 'watch';
            else                                                     $row['risk'] = 'stable';
        }
        unset($row);

        // ── 5. Financial Category Matrix ──────────────────────────────────────
        // Rows = businesses, columns = bill categories
        $billCategories = ['utilities', 'tax', 'insurance', 'rent', 'payroll', 'general'];
        $categoryMatrix = [];

        $hasBizId = $db->columnExists('bills', 'business_id');
        if ($hasBizId) {
            $matrixRows = $db->fetchAll(
                "SELECT biz.id AS business_id, biz.name AS business_name, biz.color,
                        COALESCE(b.category,'general') AS category,
                        COUNT(b.id) AS total,
                        SUM(b.status='paid') AS paid,
                        SUM(b.status='overdue' OR (b.status='pending' AND b.due_date<CURDATE())) AS overdue
                 FROM businesses biz
                 LEFT JOIN bills b ON b.business_id=biz.id AND MONTH(b.due_date)=? AND YEAR(b.due_date)=?
                 WHERE biz.is_active=1
                 GROUP BY biz.id, biz.name, biz.color, category
                 ORDER BY biz.sort_order, biz.name",
                [$month, $year]
            );
        } else {
            $matrixRows = $db->fetchAll(
                "SELECT biz.id AS business_id, biz.name AS business_name, biz.color,
                        COALESCE(b.category,'general') AS category,
                        COUNT(b.id) AS total,
                        SUM(b.status='paid') AS paid,
                        SUM(b.status='overdue' OR (b.status='pending' AND b.due_date<CURDATE())) AS overdue
                 FROM businesses biz
                 LEFT JOIN stores s ON s.business_id=biz.id
                 LEFT JOIN bills b ON b.store_id=s.id AND MONTH(b.due_date)=? AND YEAR(b.due_date)=?
                 WHERE biz.is_active=1
                 GROUP BY biz.id, biz.name, biz.color, category
                 ORDER BY biz.sort_order, biz.name",
                [$month, $year]
            );
        }

        foreach ($matrixRows as $mr) {
            $bid = $mr['business_id'];
            if (!isset($categoryMatrix[$bid])) {
                $categoryMatrix[$bid] = [
                    'business_id'   => $bid,
                    'business_name' => $mr['business_name'],
                    'color'         => $mr['color'],
                    'cats'          => [],
                ];
            }
            $cat = $mr['category'] ?? 'general';
            $categoryMatrix[$bid]['cats'][$cat] = [
                'total'   => (int)$mr['total'],
                'paid'    => (int)$mr['paid'],
                'overdue' => (int)$mr['overdue'],
            ];
        }

        // ── 6. AI Smart Summary — top 3-5 insights ───────────────────────────
        $smartInsights = [];

        // Overdue bills
        if ($overdueBillCount > 0) {
            $topOverdueBiz = $db->fetch(
                "SELECT s.name, COUNT(b.id) AS cnt
                 FROM bills b JOIN stores s ON s.id=b.store_id
                 WHERE (b.status='overdue' OR (b.status='pending' AND b.due_date<CURDATE()))
                   AND COALESCE(b.is_archived,0)=0
                 GROUP BY s.id, s.name ORDER BY cnt DESC LIMIT 1"
            );
            $bizMsg = $topOverdueBiz ? " {$topOverdueBiz['name']} leads with {$topOverdueBiz['cnt']}." : '';
            $smartInsights[] = [
                'level'   => 'critical',
                'icon'    => '🔴',
                'text'    => "{$overdueBillCount} overdue bill" . ($overdueBillCount > 1 ? 's' : '') . " ($" . number_format($overdueBillAmount) . " unpaid).{$bizMsg}",
                'action'  => 'bills',
                'action_label' => 'View bills',
            ];
        }

        // Due this week
        if ($dueWeekCount > 0) {
            $smartInsights[] = [
                'level'   => 'warning',
                'icon'    => '🟡',
                'text'    => "{$dueWeekCount} bill" . ($dueWeekCount > 1 ? 's' : '') . " due in the next 7 days ($" . number_format($dueWeekAmount) . "). Schedule payments now.",
                'action'  => 'bills',
                'action_label' => 'Payment schedule',
            ];
        }

        // Overdue tasks
        if ($overdueTaskCount > 0) {
            $topLateUser = !empty($teamRows) ? $teamRows[0] : null;
            $whoMsg = ($topLateUser && (int)$topLateUser['overdue'] > 0) ? " {$topLateUser['name']} has the most ({$topLateUser['overdue']})." : '';
            $smartInsights[] = [
                'level'   => $overdueTaskCount >= 5 ? 'critical' : 'warning',
                'icon'    => $overdueTaskCount >= 5 ? '🔴' : '🟡',
                'text'    => "{$overdueTaskCount} task" . ($overdueTaskCount > 1 ? 's' : '') . " overdue across all businesses.{$whoMsg}",
                'action'  => 'overview',
                'action_label' => 'View overview',
            ];
        }

        // Businesses critical
        $criticalBiz = array_filter($businessHealth, function($b) { return $b['health'] === 'critical'; });
        if (!empty($criticalBiz)) {
            $names = implode(', ', array_column(array_values($criticalBiz), 'business_name'));
            $smartInsights[] = [
                'level'   => 'critical',
                'icon'    => '⚠️',
                'text'    => count($criticalBiz) . " business" . (count($criticalBiz) > 1 ? 'es' : '') . " with overdue bills: {$names}.",
                'action'  => 'bills',
                'action_label' => 'Resolve overdue',
            ];
        }

        // Positive — if all clear
        if (empty($smartInsights)) {
            $smartInsights[] = [
                'level'   => 'ok',
                'icon'    => '✅',
                'text'    => "All businesses are on track this month. No overdue bills or critical tasks.",
                'action'  => null,
                'action_label' => null,
            ];
        }

        // ── 7. Monthly Bill Summary ───────────────────────────────────────────
        $monthSummary = $db->fetch(
            "SELECT
                COUNT(*) AS total,
                SUM(status='paid') AS paid,
                SUM(status='pending') AS pending,
                SUM(status='overdue' OR (status='pending' AND due_date<CURDATE())) AS overdue,
                COALESCE(SUM(amount),0) AS total_amount,
                COALESCE(SUM(CASE WHEN status='paid' THEN amount ELSE 0 END),0) AS paid_amount,
                COALESCE(SUM(CASE WHEN status IN ('pending','overdue') THEN amount ELSE 0 END),0) AS unpaid_amount
             FROM bills WHERE MONTH(due_date)=? AND YEAR(due_date)=?
               AND COALESCE(is_archived,0)=0",
            [$month, $year]
        );

        $monthNames = ['January','February','March','April','May','June',
                       'July','August','September','October','November','December'];

        // ── 8. SmartEngine — ranked actions + brief ───────────────────────────
        $role   = isAdmin() ? 'admin' : (isManager() ? 'manager' : 'staff');
        $engine = new SmartEngine($userId, $role);
        $smartResult   = $engine->compute();
        $smartTopItems = $engine->topActions(5);
        $smartBrief    = $engine->brief();

        $notifications = new Notification();
        $unreadCount   = $notifications->getUnreadCount($userId);
        $projects      = $this->projectModel->getByUser($userId, isManager());

        require __DIR__ . '/../views/dashboard/ceo.php';
    }

    /**
     * GET /store-overview
     * Per-store overview: all stores listed with task stats, overdue, due-today, etc.
     */
    public function storeOverview() {
        $db = Database::getInstance();
        $user = currentUser();
        if (!$user) { redirect('login'); return; }
        $userId = (int) $user['id'];
        $today = app_today();

        $storeModel = new Store();
        $allStores = $storeModel->allActive();

        $storeStats = [];
        foreach ($allStores as $store) {
            $sid = $store['id'];

            $tasks = $db->fetchAll(
                "SELECT t.id, t.title, t.due_date, t.priority, t.status, t.is_completed,
                        p.name as project_name, u.name as assignee_name
                 FROM tasks t
                 JOIN projects p ON t.project_id = p.id
                 LEFT JOIN users u ON t.assignee_id = u.id
                 WHERE p.store_id = ?",
                [$sid]
            );

            $total = count($tasks);
            $completed = count(array_filter($tasks, fn($t) => !empty($t['is_completed'])));
            $outstanding = $total - $completed;
            $overdue = count(array_filter($tasks, fn($t) => empty($t['is_completed']) && !empty($t['due_date']) && $t['due_date'] < $today));
            $dueToday = count(array_filter($tasks, fn($t) => empty($t['is_completed']) && !empty($t['due_date']) && $t['due_date'] === $today));
            $dueSoon = count(array_filter($tasks, fn($t) => empty($t['is_completed']) && !empty($t['due_date']) && $t['due_date'] > $today && $t['due_date'] <= date('Y-m-d', strtotime('+7 days'))));
            $progress = $total > 0 ? round($completed / $total * 100) : 0;

            // Bills for this store
            $bills = [];
            try {
                $billModel = new Bill();
                $bills = $billModel->getByStore($sid);
            } catch (\Throwable $e) {}
            $overdueBills = count(array_filter($bills, fn($b) => !empty($b['due_date']) && $b['due_date'] < $today && empty($b['is_paid'])));

            $storeStats[] = [
                'store' => $store,
                'total_tasks' => $total,
                'completed' => $completed,
                'outstanding' => $outstanding,
                'overdue' => $overdue,
                'due_today' => $dueToday,
                'due_soon' => $dueSoon,
                'progress' => $progress,
                'overdue_bills' => $overdueBills,
                'total_bills' => count($bills),
            ];
        }

        // Sort by overdue desc then progress asc (riskiest first)
        usort($storeStats, fn($a, $b) => $b['overdue'] <=> $a['overdue'] ?: $a['progress'] <=> $b['progress']);

        $notifications = new Notification();
        $unreadCount = $notifications->getUnreadCount($userId);
        $projects = $this->projectModel->getByUser($userId, isManager());

        require __DIR__ . '/../views/dashboard/store_overview.php';
    }
}
