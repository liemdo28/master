<?php
/**
 * API v1 - Dashboard Endpoints
 * GET /api/v1/dashboard/summary
 */
require_once __DIR__ . '/ApiController.php';
require_once __DIR__ . '/../../../models/Task.php';

class DashboardApiController extends ApiController {

    // ── GET /api/v1/dashboard/summary ───────────────────────────
    public function summary() {
        $this->requireAuth();
        $userId = $this->userId;
        $taskModel = new Task();
        $visibleSql = $taskModel->scopeVisibleToUserSql('t', $userId, $this->user['role'] ?? 'member');

        // Total accessible tasks
        $total = $this->db->fetch(
            "SELECT COUNT(DISTINCT t.id) as c FROM tasks t
             WHERE {$visibleSql}"
        )['c'] ?? 0;

        // Due today (assigned to me + accessible)
        $today = app_today();
        $dueToday = $this->db->fetch(
            "SELECT COUNT(DISTINCT t.id) as c FROM tasks t
             WHERE t.due_date = ?
             AND t.is_completed = 0
             AND {$visibleSql}",
            [$today]
        )['c'] ?? 0;

        // Overdue (assigned to me)
        $overdue = $this->db->fetch(
            "SELECT COUNT(DISTINCT t.id) as c FROM tasks t
             WHERE t.due_date < ?
             AND t.is_completed = 0
             AND {$visibleSql}",
            [$today]
        )['c'] ?? 0;

        // Assigned to me (active tasks)
        $assignedToMe = $this->db->fetch(
            "SELECT COUNT(DISTINCT t.id) as c FROM tasks t
             WHERE t.assignee_id = ?
             AND t.is_completed = 0
             AND t.accepted_at IS NOT NULL
             AND {$visibleSql}",
            [$userId]
        )['c'] ?? 0;

        // Completed (this month)
        $thisMonth = (int)date('m', strtotime($today));
        $thisYear  = (int)date('Y', strtotime($today));
        $completedThisMonth = $this->db->fetch(
            "SELECT COUNT(DISTINCT t.id) as c FROM tasks t
             WHERE t.is_completed = 1
             AND MONTH(t.completed_at) = ?
             AND YEAR(t.completed_at) = ?
             AND {$visibleSql}",
            [$thisMonth, $thisYear]
        )['c'] ?? 0;

        // Unread notifications
        $unreadNotifications = $this->db->fetch(
            "SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0",
            [$userId]
        )['c'] ?? 0;

        // New tasks (unaccepted)
        $newTasks = $this->db->fetch(
            "SELECT COUNT(*) as c FROM tasks WHERE assignee_id = ? AND accepted_at IS NULL AND is_completed = 0",
            [$userId]
        )['c'] ?? 0;

        // Recent tasks (latest 5) — GROUP BY id avoids ambiguous ORDER BY with DISTINCT
        $recentTasks = $this->db->fetchAll(
            "SELECT t.*, p.name as project_name, p.color as project_color,
                    u.name as assignee_name
             FROM tasks t
             LEFT JOIN projects p ON t.project_id = p.id
             LEFT JOIN users u ON t.assignee_id = u.id
             WHERE {$visibleSql}
             GROUP BY t.id
             ORDER BY t.updated_at DESC LIMIT 5"
        );

        // Upcoming tasks (next 7 days)
        $upcomingEnd = date('Y-m-d', strtotime($today . ' +7 days'));
        $upcomingTasks = $this->db->fetchAll(
            "SELECT DISTINCT t.*, p.name as project_name, p.color as project_color,
                    u.name as assignee_name
             FROM tasks t
             LEFT JOIN projects p ON t.project_id = p.id
             LEFT JOIN users u ON t.assignee_id = u.id
             WHERE t.due_date BETWEEN ? AND ?
             AND t.is_completed = 0
             AND {$visibleSql}
             ORDER BY t.due_date ASC LIMIT 10",
            [$today, $upcomingEnd]
        );

        api_response([
            'stats' => [
                'total_tasks'        => (int)$total,
                'due_today'          => (int)$dueToday,
                'overdue'            => (int)$overdue,
                'assigned_to_me'    => (int)$assignedToMe,
                'completed_this_month'=> (int)$completedThisMonth,
                'unread_notifications'=> (int)$unreadNotifications,
                'new_tasks'         => (int)$newTasks,
            ],
            'recent_tasks' => array_map([$this, 'formatMiniTask'], $recentTasks),
            'upcoming_tasks'=> array_map([$this, 'formatMiniTask'], $upcomingTasks),
        ], 'OK');
    }

    private function formatMiniTask($t) {
        return [
            'id'            => (int)$t['id'],
            'title'        => $t['title'] ?? '',
            'status'       => $t['status'] ?? 'todo',
            'priority'     => $t['priority'] ?? 'medium',
            'due_date'    => $t['due_date'] ?? null,
            'is_completed'=> (int)($t['is_completed'] ?? 0),
            'project_name'=> $t['project_name'] ?? null,
            'project_color'=> $t['project_color'] ?? null,
            'assignee_name'=> $t['assignee_name'] ?? null,
        ];
    }
}
