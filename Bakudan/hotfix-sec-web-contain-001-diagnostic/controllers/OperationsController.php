<?php
/**
 * Phase 11 — Module 1: Daily Operations Center
 * 
 * CEO/Manager morning view — what needs attention today.
 * /operations/today
 */
require_once __DIR__ . '/../models/Store.php';
require_once __DIR__ . '/../models/Task.php';
require_once __DIR__ . '/../models/Bill.php';
require_once __DIR__ . '/../models/User.php';

class OperationsController
{
    private $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    /**
     * GET /operations/today — Daily Operations Center
     */
    public function today(): void
    {
        if (!canManage()) {
            header('Location: /dashboard');
            exit;
        }

        $today = DateService::today();
        $now = date('H:i');
        $isMorning = (int)date('H') < 12;

        // ── SECTION 1: Today's workload ─────────────────────────────────
        $overdueTasks = $this->getOverdueTasks();
        $todayTasks = $this->getTodayTasks();
        $pendingAudits = $this->getPendingAudits();
        $pendingPayroll = $this->getPendingPayroll();
        $pendingReleases = $this->getPendingReleases();

        // ── SECTION 2: Anomalies ──────────────────────────────────────
        $storeHealthIssues = $this->getStoreHealthIssues();
        $payrollVariances = $this->getPayrollVariances();
        $recentAuditFails = $this->getRecentAuditFails();
        $newIncidents = $this->getNewIncidents();

        // ── SECTION 3: People needing attention ────────────────────────
        $overloadedManagers = $this->getOverloadedManagers();
        $lateEmployees = $this->getLateEmployees();
        $storeOverdueCounts = $this->getStoreOverdueCounts();

        // ── Quick stats ───────────────────────────────────────────────
        $totalOverdue = $this->getOverdueTaskCount();
        $totalToday = count($todayTasks);
        $urgentCount = $totalOverdue + count($pendingReleases) + count($newIncidents);

        $content = $this->renderView(compact(
            'today', 'now', 'isMorning',
            'overdueTasks', 'todayTasks', 'pendingAudits', 'pendingPayroll', 'pendingReleases',
            'storeHealthIssues', 'payrollVariances', 'recentAuditFails', 'newIncidents',
            'overloadedManagers', 'lateEmployees', 'storeOverdueCounts',
            'totalOverdue', 'totalToday', 'urgentCount'
        ));

        $pageTitle = 'Operations Today';
        $currentPage = 'operations-today';
        $extraCss = ['operations.css'];
        require __DIR__ . '/../views/layouts/main.php';
    }

    // ─── DATA GATHERING METHODS ─────────────────────────────────────────

    private function getOverdueTasks(): array
    {
        $rows = $this->db->fetchAll(
            "SELECT t.*, p.name as project_name, p.color as project_color,
                    s.name as store_name, u.name as assignee_name, u.avatar as assignee_avatar
             FROM tasks t
             LEFT JOIN projects p ON t.project_id = p.id
             LEFT JOIN stores s ON p.store_id = s.id
             LEFT JOIN users u ON t.assignee_id = u.id
             WHERE t.is_completed = 0 AND t.status != 'completed'
               AND t.due_date < CURDATE()
             ORDER BY t.due_date ASC, t.priority DESC
             LIMIT 20"
        );
        return $this->enrichTasks($rows);
    }

    private function getOverdueTaskCount(): int
    {
        return (int)$this->db->fetchColumn(
            "SELECT COUNT(*)
             FROM tasks t
             WHERE t.is_completed = 0 AND t.status != 'completed'
               AND t.due_date < CURDATE()"
        );
    }

    private function getTodayTasks(): array
    {
        $today = DateService::today();
        $rows = $this->db->fetchAll(
            "SELECT t.*, p.name as project_name, p.color as project_color,
                    s.name as store_name, u.name as assignee_name, u.avatar as assignee_avatar
             FROM tasks t
             LEFT JOIN projects p ON t.project_id = p.id
             LEFT JOIN stores s ON p.store_id = s.id
             LEFT JOIN users u ON t.assignee_id = u.id
             WHERE t.is_completed = 0 AND t.status != 'completed'
               AND t.due_date = ?
             ORDER BY t.priority DESC, t.due_date ASC
             LIMIT 20",
            [$today]
        );
        return $this->enrichTasks($rows);
    }

    private function getPendingAudits(): array
    {
        $today = DateService::today();
        $rows = $this->db->fetchAll(
            "SELECT t.*, p.name as project_name, s.name as store_name, u.name as assignee_name
             FROM tasks t
             LEFT JOIN projects p ON t.project_id = p.id
             LEFT JOIN stores s ON p.store_id = s.id
             LEFT JOIN users u ON t.assignee_id = u.id
             WHERE t.title LIKE '%audit%' AND t.is_completed = 0
               AND t.status IN ('todo','in_progress')
             ORDER BY t.due_date ASC
             LIMIT 10"
        );
        return $rows;
    }

    private function getPendingPayroll(): array
    {
        $today = DateService::today();
        // Payroll bills pending approval
        $rows = $this->db->fetchAll(
            "SELECT b.*, s.name as store_name
             FROM bills b
             LEFT JOIN stores s ON b.store_id = s.id
             WHERE (b.category = 'payroll' OR b.vendor LIKE '%payroll%')
               AND b.status IN ('pending', 'approved')
             ORDER BY b.due_date ASC
             LIMIT 10"
        );
        return $rows;
    }

    private function getPendingReleases(): array
    {
        if (!$this->db->tableExists('releases')) return [];
        $hasCreatedBy = $this->db->columnExists('releases', 'created_by');
        $hasOwnerId   = $this->db->columnExists('releases', 'owner_id');
        $createdByCol = $hasCreatedBy ? 'r.created_by' : ($hasOwnerId ? 'r.owner_id' : 'NULL');
        $rows = $this->db->fetchAll(
            "SELECT r.*, u.name as created_by_name
             FROM releases r
             LEFT JOIN users u ON {$createdByCol} = u.id
             WHERE r.status IN ('draft', 'review', 'testing')
             ORDER BY r.created_at DESC
             LIMIT 5"
        );
        return $rows;
    }

    private function getStoreHealthIssues(): array
    {
        // Store health = based on overdue task ratio
        $rows = $this->db->fetchAll(
            "SELECT s.id, s.name, s.color,
                    COUNT(t.id) as total_tasks,
                    SUM(CASE WHEN t.due_date < CURDATE() AND t.is_completed = 0 THEN 1 ELSE 0 END) as overdue_tasks,
                    SUM(CASE WHEN t.due_date = CURDATE() AND t.is_completed = 0 THEN 1 ELSE 0 END) as today_tasks
             FROM stores s
             LEFT JOIN projects p ON p.store_id = s.id
             LEFT JOIN tasks t ON t.project_id = p.id AND t.status != 'completed'
             WHERE s.is_active = 1
             GROUP BY s.id
             HAVING overdue_tasks > 0
             ORDER BY overdue_tasks DESC"
        );
        $issues = [];
        foreach ($rows as $r) {
            $health = 100;
            if ($r['total_tasks'] > 0) {
                $health = max(0, round(100 - ($r['overdue_tasks'] / $r['total_tasks']) * 100));
            }
            if ($health < 80) {
                $issues[] = [
                    'store' => $r,
                    'health' => $health,
                    'overdue' => (int)$r['overdue_tasks'],
                    'status' => $health < 60 ? 'critical' : ($health < 80 ? 'warning' : 'ok'),
                ];
            }
        }
        return $issues;
    }

    private function getPayrollVariances(): array
    {
        // Bills with payroll variance > 10%
        $rows = $this->db->fetchAll(
            "SELECT b.*, s.name as store_name
             FROM bills b
             LEFT JOIN stores s ON b.store_id = s.id
             WHERE b.category = 'payroll'
               AND b.status = 'pending'
             ORDER BY b.amount DESC
             LIMIT 5"
        );
        return $rows;
    }

    private function getRecentAuditFails(): array
    {
        // Tasks with 'audit fail' in title or description in last 7 days
        $rows = $this->db->fetchAll(
            "SELECT t.*, p.name as project_name, s.name as store_name
             FROM tasks t
             LEFT JOIN projects p ON t.project_id = p.id
             LEFT JOIN stores s ON p.store_id = s.id
             WHERE (t.title LIKE '%audit%fail%' OR t.description LIKE '%audit%fail%')
               AND t.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
             ORDER BY t.created_at DESC
             LIMIT 5"
        );
        return $rows;
    }

    private function getNewIncidents(): array
    {
        // Recent tasks flagged as incidents
        $rows = $this->db->fetchAll(
            "SELECT t.*, p.name as project_name, s.name as store_name, u.name as assignee_name
             FROM tasks t
             LEFT JOIN projects p ON t.project_id = p.id
             LEFT JOIN stores s ON p.store_id = s.id
             LEFT JOIN users u ON t.assignee_id = u.id
             WHERE t.priority IN ('urgent','high')
               AND t.is_completed = 0
               AND t.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
             ORDER BY t.created_at DESC
             LIMIT 5"
        );
        return $rows;
    }

    private function getOverloadedManagers(): array
    {
        // Managers with > 5 overdue tasks
        $rows = $this->db->fetchAll(
            "SELECT u.id, u.name, u.avatar, u.role,
                    COUNT(t.id) as overdue_count
             FROM users u
             JOIN tasks t ON t.assignee_id = u.id
             WHERE u.is_active = 1
               AND u.role IN ('admin','manager','ceo')
               AND t.is_completed = 0
               AND t.due_date < CURDATE()
             GROUP BY u.id
             HAVING overdue_count >= 3
             ORDER BY overdue_count DESC
             LIMIT 5"
        );
        return $rows;
    }

    private function getLateEmployees(): array
    {
        // Employees who are often overdue
        $rows = $this->db->fetchAll(
            "SELECT u.id, u.name, u.avatar,
                    COUNT(t.id) as overdue_count,
                    SUM(CASE WHEN t.due_date = CURDATE() THEN 1 ELSE 0 END) as today_count
             FROM users u
             JOIN tasks t ON t.assignee_id = u.id
             WHERE u.is_active = 1
               AND t.is_completed = 0
               AND t.due_date < CURDATE()
             GROUP BY u.id
             ORDER BY overdue_count DESC
             LIMIT 5"
        );
        return $rows;
    }

    private function getStoreOverdueCounts(): array
    {
        $rows = $this->db->fetchAll(
            "SELECT s.id, s.name, s.color,
                    COUNT(t.id) as overdue
             FROM stores s
             LEFT JOIN projects p ON p.store_id = s.id
             LEFT JOIN tasks t ON t.project_id = p.id
               AND t.is_completed = 0 AND t.due_date < CURDATE()
             WHERE s.is_active = 1
             GROUP BY s.id
             ORDER BY overdue DESC
             LIMIT 10"
        );
        return $rows;
    }

    private function enrichTasks(array $rows): array
    {
        $today = DateService::today();
        foreach ($rows as &$r) {
            $r['is_overdue'] = !empty($r['due_date']) && $r['due_date'] < $today && empty($r['is_completed']);
            $r['is_today'] = !empty($r['due_date']) && $r['due_date'] === $today;
            $r['days_overdue'] = $r['is_overdue'] ? max(1, (int)((strtotime($today) - strtotime($r['due_date'])) / 86400)) : 0;
        }
        return $rows;
    }

    private function renderView(array $vars): string
    {
        extract($vars);
        ob_start();
        include __DIR__ . '/../views/operations/today.php';
        return ob_get_clean();
    }
}
