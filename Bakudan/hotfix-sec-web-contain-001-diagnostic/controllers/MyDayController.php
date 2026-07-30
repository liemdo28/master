<?php
/**
 * Phase 11 — Module 4: Employee App Mode — "My Day"
 * 
 * Simplified view for regular employees. Only what they need.
 * /my-day
 */
require_once __DIR__ . '/../models/Task.php';
require_once __DIR__ . '/../models/User.php';

class MyDayController
{
    private $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    public function index(): void
    {
        $uid = (int)$_SESSION['user_id'];
        $user = currentUser();
        $today = DateService::today();

        // Today's tasks
        $todayTasks = $this->db->fetchAll(
            "SELECT t.*, p.name as project_name, p.color as project_color
             FROM tasks t
             LEFT JOIN projects p ON t.project_id = p.id
             WHERE t.assignee_id = ?
               AND t.status NOT IN ('completed','cancelled')
               AND t.due_date <= ?
             ORDER BY t.priority DESC, t.due_date ASC",
            [$uid, $today]
        );

        // Upcoming tasks (next 7 days)
        $upcomingTasks = $this->db->fetchAll(
            "SELECT t.*, p.name as project_name, p.color as project_color
             FROM tasks t
             LEFT JOIN projects p ON t.project_id = p.id
             WHERE t.assignee_id = ?
               AND t.status NOT IN ('completed','cancelled')
               AND t.due_date > ?
               AND t.due_date <= DATE_ADD(?, INTERVAL 7 DAY)
             ORDER BY t.due_date ASC
             LIMIT 10",
            [$uid, $today, $today]
        );

        // Announcements (from tasks flagged as announcements)
        $announcements = $this->db->fetchAll(
            "SELECT t.*, u.name as created_by_name
             FROM tasks t
             LEFT JOIN users u ON t.created_by = u.id
             WHERE t.visibility = 'public'
               AND t.is_completed = 0
               AND (t.title LIKE '%announcement%' OR t.title LIKE '%notice%')
             ORDER BY t.created_at DESC
             LIMIT 5"
        );

        // Personal stats
        $stats = $this->db->fetch(
            "SELECT
                COUNT(*) as total,
                SUM(CASE WHEN is_completed=1 THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN due_date = ? AND is_completed=0 THEN 1 ELSE 0 END) as due_today,
                SUM(CASE WHEN due_date < ? AND is_completed=0 THEN 1 ELSE 0 END) as overdue
             FROM tasks WHERE assignee_id = ? AND status != 'cancelled'",
            [$today, $today, $uid]
        );

        $pageTitle = 'My Day';
        $currentPage = 'my-day';
        $extraCss = ['operations.css'];

        ob_start();
        include __DIR__ . '/../views/employee/my-day.php';
        $content = ob_get_clean();

        require __DIR__ . '/../views/layouts/main.php';
    }
}
