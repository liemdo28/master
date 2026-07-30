<?php
/**
 * TeamController — Workload + Accountability + Rebalancing Control Center
 *
 * Routes:
 *   GET  /team                  → index()
 *   GET  /team/member/{id}      → memberDetail($id)
 *   GET  /api/team/summary      → apiSummary()
 *   GET  /api/team/members      → apiMembers()
 *   GET  /api/team/member/{id}  → apiMemberDetail($id)
 *
 * Access: Admin + Manager only (enforced here AND in index.php route guard).
 */
class TeamController
{
    // ── Guard ────────────────────────────────────────────────────────────────
    private function guard(): void
    {
        if (!isAdmin() && !isManager()) {
            redirect('overview');
            exit;
        }
    }

    // ── Core: build member rows ──────────────────────────────────────────────
    /**
     * Run the main per-member aggregation query.
     * Returns enriched member rows with risk, businesses, top overdue task.
     */
    public function buildMembers(\Database $db, string $today): array
    {
        $members = $db->fetchAll(
            "SELECT u.id, u.name, u.role, u.email,
                    COUNT(t.id)                                                                   AS total,
                    SUM(CASE WHEN t.is_completed = 1 THEN 1 ELSE 0 END)                          AS completed,
                    SUM(CASE WHEN t.is_completed = 0 AND t.due_date < ? THEN 1 ELSE 0 END)       AS overdue,
                    SUM(CASE WHEN t.is_completed = 0 AND t.due_date = ? THEN 1 ELSE 0 END)       AS due_today,
                    SUM(CASE WHEN t.is_completed = 0
                                  AND t.due_date BETWEEN ? AND DATE_ADD(?, INTERVAL 7 DAY)
                              THEN 1 ELSE 0 END)                                                  AS due_week,
                    SUM(CASE WHEN t.is_completed = 0 AND t.status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
                    SUM(CASE WHEN t.is_completed = 0 THEN 1 ELSE 0 END)                          AS open,
                    SUM(CASE WHEN t.is_completed = 1
                                  AND t.updated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                              THEN 1 ELSE 0 END)                                                  AS completed_week,
                    COUNT(DISTINCT p.store_id)                                                    AS stores_count
             FROM users u
             LEFT JOIN tasks t ON t.assignee_id = u.id
             LEFT JOIN projects p ON t.project_id = p.id
             WHERE u.is_active = 1
             GROUP BY u.id, u.name, u.role, u.email
             ORDER BY overdue DESC, open DESC, u.name ASC",
            [$today, $today, $today, $today]
        );

        $maxOpen = max(1, max(array_column($members, 'open') ?: [1]));
        $totalAll = array_sum(array_column($members, 'total'));
        $avgOpen  = count($members) > 0 ? array_sum(array_column($members, 'open')) / count($members) : 0;

        foreach ($members as &$m) {
            $m['on_time_pct'] = (int)$m['total'] > 0
                ? round((int)$m['completed'] / (int)$m['total'] * 100) : 0;

            // Risk classification (V1 thresholds per spec)
            $ov = (int)$m['overdue'];
            $pct = (int)$m['on_time_pct'];
            if      ($ov > 5 || ($ov > 3 && $pct < 60))  $m['risk'] = 'critical';
            elseif  ($ov >= 3 || $pct < 60)               $m['risk'] = 'behind';
            elseif  ($ov >= 1 || $pct < 75)               $m['risk'] = 'watch';
            else                                           $m['risk'] = 'stable';

            // Load score (0–100): weighted combo of open + overdue
            $openScore   = min(100, (int)$m['open']   / max(1, $maxOpen)   * 60);
            $overdueScore = min(40, (int)$m['overdue'] * 8);
            $m['load_score'] = (int)($openScore + $overdueScore);

            // Businesses with open tasks
            $biz = $db->fetchAll(
                "SELECT DISTINCT COALESCE(s.name,'No Store') AS name, s.color
                 FROM tasks t
                 JOIN projects p ON p.id = t.project_id
                 LEFT JOIN stores s ON s.id = p.store_id
                 WHERE t.assignee_id = ? AND t.is_completed = 0
                 LIMIT 4",
                [(int)$m['id']]
            );
            $m['businesses'] = $biz;

            // Top overdue task
            $m['top_overdue_task'] = $db->fetch(
                "SELECT t.id, t.title, t.due_date, p.name AS project_name
                 FROM tasks t
                 LEFT JOIN projects p ON p.id = t.project_id
                 WHERE t.assignee_id = ? AND t.is_completed = 0 AND t.due_date < ?
                 ORDER BY t.due_date ASC LIMIT 1",
                [(int)$m['id'], $today]
            );
        }
        unset($m);

        return $members;
    }

    /**
     * Compute KPI totals and smart recommendations from member rows.
     */
    public function buildKpiAndRecs(\Database $db, array $members, string $today): array
    {
        $totalOpen    = array_sum(array_column($members, 'open'));
        $totalOverdue = array_sum(array_column($members, 'overdue'));
        $avgOpen      = count($members) > 0 ? $totalOpen / count($members) : 0;

        $overloadedMembers = count(array_filter($members, fn($m) => in_array($m['risk'], ['critical','behind'])));
        $rebalanceOpps     = $avgOpen > 0
            ? count(array_filter($members, fn($m) => (int)$m['open'] > ($avgOpen * 1.5)))
            : 0;

        $bizImpacted = (int)($db->fetch(
            "SELECT COUNT(DISTINCT p.store_id) AS cnt
             FROM tasks t JOIN projects p ON p.id = t.project_id
             WHERE t.is_completed = 0 AND t.due_date < ? AND p.store_id IS NOT NULL",
            [$today]
        )['cnt'] ?? 0);

        $totalAll  = array_sum(array_column($members, 'total'));
        $totalDone = array_sum(array_column($members, 'completed'));
        $onTimePct = $totalAll > 0 ? round($totalDone / $totalAll * 100) : 0;

        // ── Smart recommendations ───────────────────────────────────────────
        $recs = [];

        // 1. Most overloaded
        $sortedByOD = $members;
        usort($sortedByOD, fn($a,$b) => (int)$b['overdue'] - (int)$a['overdue']);
        $top = $sortedByOD[0] ?? null;
        if ($top && (int)$top['overdue'] >= 3) {
            $recs[] = [
                'type'       => 'overload',
                'priority'   => 'high',
                'icon'       => '🔥',
                'title'      => $top['name'] . ' has ' . (int)$top['overdue'] . ' overdue tasks — rebalance recommended',
                'reason'     => 'Risk level: ' . ucfirst($top['risk']),
                'action'     => 'reassign',
                'from_user_id' => (int)$top['id'],
                'label'      => '⇄ Reassign',
            ];
        }

        // 2. Business with most overdue tasks
        $topBiz = $db->fetch(
            "SELECT s.name AS store_name, COUNT(t.id) AS cnt
             FROM tasks t
             JOIN projects p ON p.id = t.project_id
             JOIN stores s ON s.id = p.store_id
             WHERE t.is_completed = 0 AND t.due_date < ?
             GROUP BY s.id ORDER BY cnt DESC LIMIT 1",
            [$today]
        );
        if ($topBiz && (int)$topBiz['cnt'] >= 2) {
            $recs[] = [
                'type'     => 'warning',
                'priority' => 'medium',
                'icon'     => '🏪',
                'title'    => $topBiz['store_name'] . ' impacted by ' . (int)$topBiz['cnt'] . ' overdue tasks',
                'reason'   => 'Business operations at risk',
                'action'   => 'overview',
                'label'    => '🏢 View Overview',
            ];
        }

        // 3. Underloaded users who can absorb work
        $under = array_filter($members, fn($m) => (int)$m['open'] <= 3 && $m['risk'] === 'stable');
        if (count($under) > 0 && $rebalanceOpps > 0) {
            $ul = array_values($under)[0];
            $recs[] = [
                'type'       => 'capacity',
                'priority'   => 'medium',
                'icon'       => '⚡',
                'title'      => $ul['name'] . ' has capacity (' . (int)$ul['open'] . ' open tasks) — ideal for redistribution',
                'reason'     => 'Low risk · available bandwidth',
                'action'     => 'reassign_to',
                'to_user_id' => (int)$ul['id'],
                'label'      => '⇄ Reassign To',
            ];
        }

        // 4. Low team completion rate
        if ($onTimePct < 65 && $totalAll > 5) {
            $recs[] = [
                'type'     => 'warning',
                'priority' => 'medium',
                'icon'     => '📉',
                'title'    => 'Team on-time rate is ' . $onTimePct . '% — review task priorities',
                'reason'   => 'Below 65% threshold',
                'action'   => 'none',
                'label'    => null,
            ];
        }

        return [
            'totals' => [
                'members'    => count($members),
                'open'       => $totalOpen,
                'overdue'    => $totalOverdue,
                'done_week'  => array_sum(array_column($members, 'completed_week')),
                'overloaded' => $overloadedMembers,
                'biz_impact' => $bizImpacted,
                'rebalance'  => $rebalanceOpps,
                'on_time_pct'=> $onTimePct,
                'avg_open'   => round($avgOpen, 1),
            ],
            'recs'     => $recs,
            'max_open' => max(1, max(array_column($members, 'open') ?: [1])),
            'avg_open' => $avgOpen,
        ];
    }

    // ── 1. Page: /team ───────────────────────────────────────────────────────
    public function index(string $mode = 'members'): void
    {
        $this->guard();
        $db     = Database::getInstance();
        $today  = app_today();
        $userId = (int)$_SESSION['user_id'];
        $isLoadMode = $mode === 'load';
        $currentPage = $isLoadMode ? 'team-load' : 'team';
        $pageTitle = $isLoadMode ? 'Team Load' : 'Team Members';

        $members   = $this->buildMembers($db, $today);
        $kpi       = $this->buildKpiAndRecs($db, $members, $today);
        $teamTotals = $kpi['totals'];
        $smartRecs  = $kpi['recs'];
        $maxOpen    = $kpi['max_open'];
        $avgOpen    = $kpi['avg_open'];

        // Stores with active overdue tasks (for filter dropdown)
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
        $projects      = (new Project())->getByUser($userId, isAdmin());

        require __DIR__ . '/../views/dashboard/team.php';
    }

    // ── 2. Page: /team/member/{id} ───────────────────────────────────────────
    public function memberDetail(int $memberId): void
    {
        $this->guard();
        $db     = Database::getInstance();
        $today  = app_today();
        $userId = (int)$_SESSION['user_id'];

        $member = $db->fetch("SELECT id, name, role, email FROM users WHERE id = ? AND is_active = 1", [$memberId]);
        if (!$member) { redirect('team'); return; }

        // Stats
        $stats = $db->fetch(
            "SELECT
                SUM(CASE WHEN is_completed=0 THEN 1 ELSE 0 END) AS open,
                SUM(CASE WHEN is_completed=0 AND due_date < ? THEN 1 ELSE 0 END) AS overdue,
                SUM(CASE WHEN is_completed=0 AND due_date BETWEEN ? AND DATE_ADD(?,INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS due_week,
                SUM(CASE WHEN is_completed=1 THEN 1 ELSE 0 END) AS completed,
                COUNT(*) AS total
             FROM tasks WHERE assignee_id = ?",
            [$today, $today, $today, $memberId]
        );

        $onTimePct = (int)($stats['total'] ?? 0) > 0
            ? round((int)$stats['completed'] / (int)$stats['total'] * 100) : 0;

        // Classify risk
        $ov = (int)($stats['overdue'] ?? 0);
        $risk = $ov > 5 ? 'critical' : ($ov >= 3 ? 'behind' : ($ov >= 1 ? 'watch' : 'stable'));

        // Urgent tasks (overdue first, then due today/high priority)
        $urgentTasks = $db->fetchAll(
            "SELECT t.id, t.title, t.priority, t.due_date, t.status, p.name AS project_name, s.name AS store_name
             FROM tasks t
             LEFT JOIN projects p ON p.id = t.project_id
             LEFT JOIN stores s ON s.id = p.store_id
             WHERE t.assignee_id = ? AND t.is_completed = 0
             ORDER BY
                CASE WHEN t.due_date < ? THEN 0
                     WHEN t.due_date = ? THEN 1
                     WHEN t.priority IN ('urgent','high') THEN 2
                     ELSE 3 END,
                t.due_date ASC, FIELD(t.priority,'urgent','high','medium','low')
             LIMIT 10",
            [$memberId, $today, $today]
        );

        // Recent completions (last 7 days)
        $recentDone = $db->fetchAll(
            "SELECT t.id, t.title, t.updated_at, p.name AS project_name
             FROM tasks t LEFT JOIN projects p ON p.id = t.project_id
             WHERE t.assignee_id = ? AND t.is_completed = 1 AND t.updated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
             ORDER BY t.updated_at DESC LIMIT 8",
            [$memberId]
        );

        // Businesses impacted
        $businesses = $db->fetchAll(
            "SELECT DISTINCT s.name, s.color, COUNT(t.id) AS task_count,
                    SUM(CASE WHEN t.due_date < ? THEN 1 ELSE 0 END) AS overdue_count
             FROM tasks t
             JOIN projects p ON p.id = t.project_id
             LEFT JOIN stores s ON s.id = p.store_id
             WHERE t.assignee_id = ? AND t.is_completed = 0
             GROUP BY s.id, s.name, s.color
             ORDER BY overdue_count DESC, task_count DESC",
            [$today, $memberId]
        );

        $notifications = new Notification();
        $unreadCount   = $notifications->getUnreadCount($userId);
        $projects      = (new Project())->getByUser($userId, isAdmin());

        // Penalty summary for this member
        $penaltySummary = ['count' => 0, 'total_amount' => 0.0, 'currency' => 'VND'];
        try {
            $root = dirname(__DIR__);
            if (!class_exists('PenaltyService')) {
                require_once $root . '/service/PenaltyService.php';
            }
            $penaltySummary = (new PenaltyService())->getUserPenaltySummary($memberId, 'month');
        } catch (Throwable $e) {}

        require __DIR__ . '/../views/dashboard/team_member.php';
    }

    // ── 3. API: GET /api/team/summary ────────────────────────────────────────
    public function apiSummary(): void
    {
        $this->guard();
        header('Content-Type: application/json');
        $db    = Database::getInstance();
        $today = app_today();

        $members = $this->buildMembers($db, $today);
        $kpi     = $this->buildKpiAndRecs($db, $members, $today);

        $totals = $kpi['totals'];

        echo json_encode([
            'success' => true,
            // Nested kpi block — matches refreshTeamKpis() JS key map
            'kpi' => [
                'overloaded'    => (int)($totals['overloaded']   ?? 0),
                'total_overdue' => (int)($totals['overdue']      ?? 0),
                'biz_impact'    => (int)($totals['biz_impact']   ?? 0),
                'rebalance'     => (int)($totals['rebalance']    ?? 0),
                'on_time_pct'   => (int)($totals['on_time_pct']  ?? 0),
                'done_week'     => (int)($totals['done_week']    ?? 0),
                'open'          => (int)($totals['open']         ?? 0),
                'members'       => (int)($totals['members']      ?? 0),
            ],
            // Flat keys kept for backwards compat / external callers
            'overloaded_members'        => (int)($totals['overloaded']   ?? 0),
            'overdue_tasks'             => (int)($totals['overdue']      ?? 0),
            'businesses_impacted'       => (int)($totals['biz_impact']   ?? 0),
            'reassignment_opportunities'=> (int)($totals['rebalance']    ?? 0),
            'team_completion_rate'      => (int)($totals['on_time_pct']  ?? 0),
            'team_members'              => (int)($totals['members']      ?? 0),
            'open_tasks'                => (int)($totals['open']         ?? 0),
            'done_this_week'            => (int)($totals['done_week']    ?? 0),
            'smart_suggestions'         => $kpi['recs'],
        ]);
        exit;
    }

    // ── 4. API: GET /api/team/members ────────────────────────────────────────
    public function apiMembers(): void
    {
        $this->guard();
        header('Content-Type: application/json');
        $db    = Database::getInstance();
        $today = app_today();

        $members = $this->buildMembers($db, $today);

        // Optional filters
        $search = strtolower(trim($_GET['search'] ?? ''));
        $risk   = trim($_GET['risk'] ?? '');
        $bizId  = (int)($_GET['business_id'] ?? 0);

        $result = [];
        foreach ($members as $m) {
            if ($search && stripos($m['name'], $search) === false) continue;
            if ($risk && $m['risk'] !== $risk) continue;

            $result[] = [
                'id'                  => (int)$m['id'],
                'name'                => $m['name'],
                'role'                => $m['role'],
                'open_tasks'          => (int)$m['open'],
                'overdue_tasks'       => (int)$m['overdue'],
                'due_this_week'       => (int)$m['due_week'],
                'on_time_pct'         => (int)$m['on_time_pct'],
                'businesses_impacted' => array_map(fn($b) => $b['name'], $m['businesses']),
                'risk_level'          => $m['risk'],
                'load_score'          => (int)$m['load_score'],
                'top_overdue_task'    => $m['top_overdue_task'] ? $m['top_overdue_task']['title'] : null,
            ];
        }

        echo json_encode(['success' => true, 'members' => $result, 'total' => count($result)]);
        exit;
    }

    // ── NEW: GET /api/team/rebalance-plan ────────────────────────────────────
    /**
     * Generate a full AI rebalance plan from SmartEngine.
     * Returns: has_plan, confidence, actions[], risk_reduction, summary.
     */
    public function apiRebalancePlan(): void
    {
        $this->guard();
        header('Content-Type: application/json');

        $engine = new SmartEngine((int)$_SESSION['user_id'], $_SESSION['user_role'] ?? 'manager');

        // Return both Safe and Aggressive plans in one response
        echo json_encode($engine->rebalancePlanBoth(), JSON_UNESCAPED_UNICODE);
        exit;
    }

    // ── NEW: POST /api/team/rebalance-apply ──────────────────────────────────
    /**
     * Apply an approved rebalance plan: bulk-reassign tasks.
     * Expects JSON body: { actions: [ { to_user_id, task_ids[] }, ... ] }
     * Returns: { success, moved, kpi: {...} }
     */
    public function apiRebalanceApply(): void
    {
        $this->guard();
        header('Content-Type: application/json');

        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            echo json_encode(['success' => false, 'error' => 'POST required']);
            exit;
        }

        // CSRF guard
        $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
        if (!hash_equals($_SESSION['csrf_token'] ?? '', $token)) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'CSRF mismatch']);
            exit;
        }

        $body    = json_decode(file_get_contents('php://input'), true) ?: [];
        $actions = $body['actions'] ?? [];

        if (empty($actions)) {
            echo json_encode(['success' => false, 'error' => 'No actions provided']);
            exit;
        }

        $db     = Database::getInstance();
        $userId = (int)$_SESSION['user_id'];
        $moved  = 0;

        foreach ($actions as $action) {
            $toId    = (int)($action['to_user_id'] ?? 0);
            $taskIds = array_map('intval', (array)($action['task_ids'] ?? []));
            if (!$toId || empty($taskIds)) continue;

            // Verify destination user is active
            if (!$db->fetch("SELECT id FROM users WHERE id = ? AND is_active = 1", [$toId])) continue;

            foreach ($taskIds as $tid) {
                $rows = $db->execute(
                    "UPDATE tasks SET assignee_id = ?, updated_at = NOW()
                     WHERE id = ? AND is_completed = 0",
                    [$toId, $tid]
                );
                $moved += $rows;
            }
        }

        // ── Refresh data post-apply ──
        $today   = app_today();
        $members = $this->buildMembers($db, $today);
        $kpi     = $this->buildKpiAndRecs($db, $members, $today);
        $totals  = $kpi['totals'];

        // Collect affected user IDs (both source AND destination) and refresh open task counts
        $affectedIds = [];
        foreach ($actions as $action) {
            $toId   = (int)($action['to_user_id']   ?? 0);
            $fromId = (int)($action['from_user_id'] ?? 0);
            if ($toId)   $affectedIds[$toId]   = true;
            if ($fromId) $affectedIds[$fromId] = true;
        }
        $memberUpdates = [];
        foreach (array_keys($affectedIds) as $uid) {
            $row = $db->fetch(
                "SELECT COUNT(*) AS open_tasks,
                        SUM(CASE WHEN due_date < CURDATE() THEN 1 ELSE 0 END) AS overdue_tasks
                 FROM tasks WHERE assignee_id = ? AND is_completed = 0",
                [$uid]
            );
            $memberUpdates[] = [
                'user_id'      => $uid,
                'open_tasks'   => (int)($row['open_tasks']   ?? 0),
                'overdue_tasks'=> (int)($row['overdue_tasks'] ?? 0),
            ];
        }

        // ── Next best action after this rebalance ──
        $engine     = new SmartEngine((int)$_SESSION['user_id'], $_SESSION['user_role'] ?? 'manager');
        $nextChain  = $engine->nextBestActionChain(2);
        $nextActions = array_map(fn($n) => [
            'type'       => $n['type']       ?? 'task',
            'title'      => $n['title']      ?? ($n['text'] ?? ''),
            'reason'     => $n['reason']     ?? '',
            'url'        => $n['url']        ?? null,
            'icon'       => $n['icon']       ?? '→',
            'conf_label' => $n['conf_label'] ?? '',
        ], $nextChain);

        // Persist rebalance result in session so overview can read it cross-tab/device
        $_SESSION['last_rebalance'] = ['ts' => time(), 'moved' => $moved];

        echo json_encode([
            'success'        => true,
            'moved'          => $moved,
            'member_updates' => $memberUpdates,
            'next_actions'   => $nextActions,
            'kpi'            => [
                'overloaded'    => (int)($totals['overloaded']  ?? 0),
                'total_overdue' => (int)($totals['overdue']     ?? 0),
                'rebalance'     => (int)($totals['rebalance']   ?? 0),
                'on_time_pct'   => (int)($totals['on_time_pct'] ?? 0),
                'open'          => (int)($totals['open']        ?? 0),
                'members'       => (int)($totals['members']     ?? 0),
            ],
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // ── GET /api/team/rebalance-status ───────────────────────────────────────
    /**
     * Returns whether a rebalance was recently applied (from session).
     * Clears the session key after returning it (one-time read), unless it is
     * fresher than 5 minutes, in which case it remains available for re-reads
     * within that window.
     */
    public function apiRebalanceStatus(): void
    {
        $this->guard();
        header('Content-Type: application/json');

        $sig = $_SESSION['last_rebalance'] ?? null;
        if (!$sig || !isset($sig['ts'])) {
            echo json_encode(['has_rebalance' => false, 'ts' => null, 'moved' => 0]);
            exit;
        }

        $age = time() - (int)$sig['ts'];
        if ($age > 300) {
            // Stale — clear and report nothing
            unset($_SESSION['last_rebalance']);
            echo json_encode(['has_rebalance' => false, 'ts' => null, 'moved' => 0]);
            exit;
        }

        // Clear after reading so the banner only shows once per rebalance
        unset($_SESSION['last_rebalance']);

        echo json_encode([
            'has_rebalance' => true,
            'ts'            => (int)$sig['ts'],
            'moved'         => (int)($sig['moved'] ?? 0),
        ]);
        exit;
    }

    // ── V3: GET /api/decision/problems ──────────────────────────────────────
    /**
     * Return all detected problems, ranked by impact + urgency + business scope.
     * Used by exec-zone JS and future cross-page decision panels.
     */
    public function apiDecisionProblems(): void
    {
        $this->guard();
        header('Content-Type: application/json');

        $engine   = new SmartEngine((int)$_SESSION['user_id'], $_SESSION['user_role'] ?? 'manager');
        $problems = $engine->detectProblems();
        $ranked   = $engine->rankProblems($problems);
        $quickWin = $engine->quickWin();

        echo json_encode([
            'success'   => true,
            'problems'  => $ranked,
            'quick_win' => $quickWin,
            'total'     => count($ranked),
            'generated' => date('Y-m-d H:i:s'),
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // ── 4c. API: GET /api/decision/compare ──────────────────────────────────
    /**
     * Cross-problem priority comparison — "What should I do first?"
     * Detects all current problems, ranks them, then scores each on 5 dimensions
     * (risk_reduction, safety, speed, simplicity, confidence) to produce a
     * total_score and priority_order across different problem types.
     */
    public function apiDecisionCompare(): void
    {
        $this->guard();
        header('Content-Type: application/json');

        $engine   = new SmartEngine((int)$_SESSION['user_id'], $_SESSION['user_role'] ?? 'manager');
        $problems = $engine->detectProblems();
        $ranked   = $engine->rankProblems($problems);
        $compared = $engine->comparePlans($ranked);
        $quickWin = $engine->quickWin();

        $topAction = !empty($compared) ? $compared[0] : null;

        echo json_encode([
            'success'    => true,
            'comparison' => $compared,
            'top_action' => $topAction,      // single highest-scoring item
            'quick_win'  => $quickWin,
            'total'      => count($compared),
            'generated'  => date('Y-m-d H:i:s'),
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // ── 5. API: GET /api/team/member/{id} ───────────────────────────────────
    public function apiMemberDetail(int $memberId): void
    {
        $this->guard();
        header('Content-Type: application/json');
        $db    = Database::getInstance();
        $today = app_today();

        $member = $db->fetch("SELECT id, name, role FROM users WHERE id = ? AND is_active = 1", [$memberId]);
        if (!$member) { http_response_code(404); echo json_encode(['error'=>'Not found']); exit; }

        $stats = $db->fetch(
            "SELECT
                SUM(CASE WHEN is_completed=0 THEN 1 ELSE 0 END) AS open,
                SUM(CASE WHEN is_completed=0 AND due_date < ? THEN 1 ELSE 0 END) AS overdue,
                SUM(CASE WHEN is_completed=0 AND due_date BETWEEN ? AND DATE_ADD(?,INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS due_week,
                SUM(CASE WHEN is_completed=1 THEN 1 ELSE 0 END) AS completed,
                COUNT(*) AS total
             FROM tasks WHERE assignee_id = ?",
            [$today, $today, $today, $memberId]
        );

        $onTimePct = (int)($stats['total'] ?? 0) > 0
            ? round((int)$stats['completed'] / (int)$stats['total'] * 100) : 0;

        $ov = (int)($stats['overdue'] ?? 0);
        $risk = $ov > 5 ? 'critical' : ($ov >= 3 ? 'behind' : ($ov >= 1 ? 'watch' : 'stable'));

        $urgentTasks = $db->fetchAll(
            "SELECT t.id, t.title, t.priority, t.due_date, p.name AS project_name
             FROM tasks t LEFT JOIN projects p ON p.id = t.project_id
             WHERE t.assignee_id = ? AND t.is_completed = 0
             ORDER BY CASE WHEN t.due_date < ? THEN 0 WHEN t.due_date = ? THEN 1 ELSE 2 END,
                      FIELD(t.priority,'urgent','high','medium','low')
             LIMIT 8",
            [$memberId, $today, $today]
        );

        $recentDone = $db->fetchAll(
            "SELECT t.id, t.title, t.updated_at FROM tasks t
             WHERE t.assignee_id = ? AND t.is_completed = 1
               AND t.updated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
             ORDER BY t.updated_at DESC LIMIT 5",
            [$memberId]
        );

        $businesses = $db->fetchAll(
            "SELECT DISTINCT s.name,
                    SUM(CASE WHEN t.due_date < ? THEN 1 ELSE 0 END) AS overdue_count
             FROM tasks t JOIN projects p ON p.id = t.project_id
             LEFT JOIN stores s ON s.id = p.store_id
             WHERE t.assignee_id = ? AND t.is_completed = 0
             GROUP BY s.id, s.name ORDER BY overdue_count DESC",
            [$today, $memberId]
        );

        echo json_encode([
            'success'             => true,
            'id'                  => (int)$member['id'],
            'name'                => $member['name'],
            'role'                => $member['role'],
            'open_tasks'          => (int)($stats['open'] ?? 0),
            'overdue_tasks'       => $ov,
            'due_this_week'       => (int)($stats['due_week'] ?? 0),
            'on_time_pct'         => $onTimePct,
            'risk_level'          => $risk,
            'urgent_tasks'        => $urgentTasks,
            'recent_completions'  => $recentDone,
            'businesses_impacted' => array_column($businesses, 'name'),
        ]);
        exit;
    }

    // ── V4 Decision OS API endpoints ──────────────────────────────────────────

    /** GET /api/decision — Full ranked decision list (V4 DecisionEngine) */
    public function apiDecisionRank(): void
    {
        $this->guard();
        header('Content-Type: application/json');
        $engine = new DecisionEngine((int)$_SESSION['user_id'], $_SESSION['user_role'] ?? 'manager');
        echo json_encode($engine->rankDecisions(), JSON_UNESCAPED_UNICODE);
        exit;
    }

    /** GET /api/decision/next — Single next best action */
    public function apiDecisionNext(): void
    {
        $this->guard();
        header('Content-Type: application/json');
        $engine = new DecisionEngine((int)$_SESSION['user_id'], $_SESSION['user_role'] ?? 'manager');
        $next   = $engine->nextDecision();
        echo json_encode(['success' => true, 'decision' => $next, 'generated' => date('Y-m-d H:i:s')], JSON_UNESCAPED_UNICODE);
        exit;
    }

    /** POST /api/decision/simulate — Simulate top decision outcome */
    public function apiDecisionSimulate(): void
    {
        $this->guard();
        if (!verify_csrf($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) {
            http_response_code(403);
            echo json_encode(['error' => 'Invalid CSRF token']);
            exit;
        }
        header('Content-Type: application/json');
        $engine = new DecisionEngine((int)$_SESSION['user_id'], $_SESSION['user_role'] ?? 'manager');
        echo json_encode(['success' => true, 'simulation' => $engine->simulateTop(), 'generated' => date('Y-m-d H:i:s')], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // ── V5 Autonomy API endpoints ──────────────────────────────────────────────

    /** GET /api/autonomy/decisions — All decisions with autonomy classification */
    public function apiAutonomyDecisions(): void
    {
        $this->guard();
        header('Content-Type: application/json');
        $engine = new AutonomyEngine((int)$_SESSION['user_id'], $_SESSION['user_role'] ?? 'manager');
        echo json_encode($engine->classifyAll(), JSON_UNESCAPED_UNICODE);
        exit;
    }

    /** POST /api/autonomy/approve — Approve a pending decision */
    public function apiAutonomyApprove(): void
    {
        $this->guard();
        if (!verify_csrf($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) { http_response_code(403); echo json_encode(['error'=>'Invalid CSRF']); exit; }
        header('Content-Type: application/json');
        $planId = trim($_POST['plan_id'] ?? '');
        if (!$planId) { http_response_code(400); echo json_encode(['error'=>'plan_id required']); exit; }
        $engine = new ApprovalEngine();
        $ok     = $engine->recordApproval($planId, (int)$_SESSION['user_id'], 'approved');
        echo json_encode(['success'=>$ok, 'plan_id'=>$planId, 'status'=>'approved'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    /** POST /api/autonomy/reject — Reject a pending decision */
    public function apiAutonomyReject(): void
    {
        $this->guard();
        if (!verify_csrf($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) { http_response_code(403); echo json_encode(['error'=>'Invalid CSRF']); exit; }
        header('Content-Type: application/json');
        $planId = trim($_POST['plan_id'] ?? '');
        if (!$planId) { http_response_code(400); echo json_encode(['error'=>'plan_id required']); exit; }
        $engine = new ApprovalEngine();
        $ok     = $engine->recordApproval($planId, (int)$_SESSION['user_id'], 'rejected');
        echo json_encode(['success'=>$ok, 'plan_id'=>$planId, 'status'=>'rejected'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    /** POST /api/autonomy/execute-safe — Auto-execute safe plan */
    public function apiAutonomyExecute(): void
    {
        $this->guard();
        if (!verify_csrf($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) { http_response_code(403); echo json_encode(['error'=>'Invalid CSRF']); exit; }
        header('Content-Type: application/json');
        $uid    = (int)$_SESSION['user_id'];
        $role   = $_SESSION['user_role'] ?? 'manager';
        $engine = new AutonomyEngine($uid, $role);
        $smart  = new SmartEngine($uid, $role);
        $dec    = (new DecisionEngine($uid, $role))->nextDecision();
        if (!$dec) { echo json_encode(['success'=>false,'reason'=>'No decisions available']); exit; }

        // Route plan by decision type — never blindly use rebalance for non-overload decisions
        $problemType = $dec['problem_type'] ?? 'unknown';
        if ($problemType === 'overload') {
            $plan = $smart->rebalancePlan('safe');
        } elseif ($problemType === 'bill_overdue') {
            // Bill decisions: stub plan with type flag; actual execution is via BillController
            $plan = ['has_plan'=>false,'actions'=>[],'plan_type'=>'bill_overdue','decision'=>$dec,'total_moving'=>0,'overdue_reduced'=>0,'risk_reduction'=>['destinations_safe'=>true]];
        } elseif ($problemType === 'store_risk') {
            $plan = ['has_plan'=>false,'actions'=>[],'plan_type'=>'store_risk','decision'=>$dec,'total_moving'=>0,'overdue_reduced'=>0,'risk_reduction'=>['destinations_safe'=>true]];
        } elseif ($problemType === 'low_throughput') {
            $plan = $smart->rebalancePlan('safe'); // throughput issues → rebalance is appropriate
        } else {
            $plan = ['has_plan'=>false,'actions'=>[],'plan_type'=>$problemType,'decision'=>$dec,'total_moving'=>0,'overdue_reduced'=>0,'risk_reduction'=>['destinations_safe'=>true]];
        }

        $result = $engine->executeIfSafe($plan, $dec);
        if ($result['executed']) {
            $engine->recordOutcome($plan, $result);
        }
        echo json_encode(['success'=>$result['executed'], 'decision_type'=>$problemType, 'result'=>$result, 'generated'=>date('Y-m-d H:i:s')], JSON_UNESCAPED_UNICODE);
        exit;
    }

    /** GET /api/autonomy/log — Autonomy action history */
    public function apiAutonomyLog(): void
    {
        $this->guard();
        header('Content-Type: application/json');
        $db  = Database::getInstance();
        try {
            $log = $db->fetchAll("SELECT * FROM autonomy_log ORDER BY created_at DESC LIMIT 50") ?: [];
        } catch (Exception $e) { $log = []; }
        echo json_encode(['success'=>true, 'log'=>$log, 'total'=>count($log)], JSON_UNESCAPED_UNICODE);
        exit;
    }

    /** GET /api/autonomy/settings — Current autonomy config */
    public function apiAutonomySettings(): void
    {
        $this->guard();
        header('Content-Type: application/json');
        $path = __DIR__ . '/../config/autonomy_engine.php';
        $cfg  = file_exists($path) ? require $path : [];
        echo json_encode(['success'=>true, 'settings'=>$cfg], JSON_UNESCAPED_UNICODE);
        exit;
    }
}
