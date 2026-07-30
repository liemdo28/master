<?php
/**
 * Phase 11 — Module 3: Manager Command Center
 * 
 * All-in-one view for managers: team, store, payroll in one screen.
 * /manager/command
 */
require_once __DIR__ . '/../models/Store.php';
require_once __DIR__ . '/../models/Task.php';
require_once __DIR__ . '/../models/Bill.php';
require_once __DIR__ . '/../models/User.php';

class ManagerCommandController
{
    private $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    public function command(): void
    {
        if (!canManage()) {
            header('Location: /dashboard');
            exit;
        }

        $today = DateService::today();

        // ── Team Status ────────────────────────────────────────────────
        $teamMembers = $this->getTeamStatus($today);

        // ── Store Overview ─────────────────────────────────────────────
        $storeOverview = $this->getStoreOverview();

        // ── Payroll Pending ────────────────────────────────────────────
        $payrollPending = $this->getPayrollPending();

        // ── Action Items ────────────────────────────────────────────────
        $actionItems = $this->getActionItems();

        $content = $this->renderView(compact(
            'today', 'teamMembers', 'storeOverview',
            'payrollPending', 'actionItems'
        ));

        $pageTitle = 'Command Center';
        $currentPage = 'manager-command';
        require __DIR__ . '/../views/layouts/main.php';
    }

    private function getTeamStatus(string $today): array
    {
        $members = $this->db->fetchAll(
            "SELECT u.id, u.name, u.avatar, u.role,
                    COUNT(t.id) as total_tasks,
                    SUM(CASE WHEN t.due_date < CURDATE() AND t.is_completed = 0 THEN 1 ELSE 0 END) as overdue,
                    SUM(CASE WHEN t.due_date = CURDATE() AND t.is_completed = 0 THEN 1 ELSE 0 END) as today,
                    SUM(CASE WHEN t.is_completed = 1 THEN 1 ELSE 0 END) as completed
             FROM users u
             LEFT JOIN tasks t ON t.assignee_id = u.id AND t.status != 'completed'
             WHERE u.is_active = 1
             GROUP BY u.id
             ORDER BY overdue DESC, u.name ASC"
        );

        // Find who's off today (no tasks due)
        foreach ($members as &$m) {
            $m['is_active_today'] = ($m['today'] + $m['overdue']) > 0;
            $m['completion_rate'] = ($m['total_tasks'] > 0)
                ? round(($m['completed'] / $m['total_tasks']) * 100)
                : 100;
            $m['load_status'] = $m['overdue'] > 5 ? 'critical' : ($m['overdue'] > 2 ? 'warning' : 'ok');
        }
        return $members;
    }

    private function getStoreOverview(): array
    {
        $rows = $this->db->fetchAll(
            "SELECT s.id, s.name, s.color,
                    COUNT(DISTINCT t.id) as total_tasks,
                    SUM(CASE WHEN t.due_date < CURDATE() AND t.is_completed = 0 THEN 1 ELSE 0 END) as overdue,
                    SUM(CASE WHEN t.due_date = CURDATE() AND t.is_completed = 0 THEN 1 ELSE 0 END) as today,
                    SUM(CASE WHEN t.is_completed = 1 THEN 1 ELSE 0 END) as completed,
                    SUM(CASE WHEN t.priority IN ('urgent','high') AND t.is_completed = 0 THEN 1 ELSE 0 END) as incidents
             FROM stores s
             LEFT JOIN projects p ON p.store_id = s.id
             LEFT JOIN tasks t ON t.project_id = p.id
             WHERE s.is_active = 1
             GROUP BY s.id
             ORDER BY overdue DESC"
        );

        foreach ($rows as &$r) {
            $r['health'] = $r['total_tasks'] > 0
                ? max(0, round(100 - ($r['overdue'] / $r['total_tasks']) * 100))
                : 100;
            $r['health_status'] = $r['health'] >= 80 ? 'healthy' : ($r['health'] >= 50 ? 'warning' : 'critical');
        }
        return $rows;
    }

    private function getPayrollPending(): array
    {
        return $this->db->fetchAll(
            "SELECT b.*, s.name as store_name
             FROM bills b
             LEFT JOIN stores s ON b.store_id = s.id
             WHERE b.category = 'payroll'
               AND b.status = 'pending'
             ORDER BY b.due_date ASC
             LIMIT 10"
        );
    }

    private function getActionItems(): array
    {
        // Tasks that need manager action: overdue, or escalated
        $rows = $this->db->fetchAll(
            "SELECT t.*, p.name as project_name, s.name as store_name,
                    u.name as assignee_name
             FROM tasks t
             LEFT JOIN projects p ON t.project_id = p.id
             LEFT JOIN stores s ON p.store_id = s.id
             LEFT JOIN users u ON t.assignee_id = u.id
             WHERE t.is_completed = 0
               AND t.status IN ('todo','in_progress')
               AND t.due_date <= CURDATE()
             ORDER BY t.priority DESC, t.due_date ASC
             LIMIT 15"
        );
        $today = DateService::today();
        foreach ($rows as &$r) {
            $r['days_overdue'] = (int)((strtotime($today) - strtotime($r['due_date'])) / 86400);
        }
        return $rows;
    }

    private function renderView(array $vars): string
    {
        extract($vars);
        ob_start();
        include __DIR__ . '/../views/manager/command.php';
        return ob_get_clean();
    }
}
