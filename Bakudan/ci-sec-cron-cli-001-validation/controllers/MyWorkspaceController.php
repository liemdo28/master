<?php
/**
 * Phase 11.5 — Module 5: My Workspace
 * /my-workspace — Personal unified view reducing dashboard complexity
 */

class MyWorkspaceController
{
    private $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    /**
     * GET /my-workspace
     */
    public function index(): void
    {
        if (!isLoggedIn()) { redirect('/login'); }

        $userId = $_SESSION['user_id'];
        $today = function_exists('app_today') ? app_today() : date('Y-m-d');

        // My Tasks (active, not completed)
        $myTasks = $this->db->fetchAll(
            "SELECT id, title, status, priority, due_date, project_id
             FROM tasks
             WHERE assignee_id = ? AND is_completed = 0
             ORDER BY CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, due_date ASC
             LIMIT 20",
            [$userId]
        );

        // My Approvals (tasks/releases waiting for my action)
        $myApprovals = [];
        if (canAdmin() || canManage()) {
            try {
                $myApprovals = $this->db->fetchAll(
                    "SELECT id, name as title, 'release' as approval_type, status, created_at
                     FROM releases
                     WHERE status IN ('review','preview')
                     ORDER BY created_at DESC LIMIT 10"
                );
            } catch (\Throwable $e) { /* releases table may not exist */ }
        }

        // My Reviews (tasks I created that are pending)
        $myReviews = $this->db->fetchAll(
            "SELECT t.id, t.title, t.status, t.assignee_id, u.name as assignee_name, t.due_date
             FROM tasks t
             LEFT JOIN users u ON t.assignee_id = u.id
             WHERE t.creator_id = ? AND t.is_completed = 0
             ORDER BY t.due_date ASC
             LIMIT 15",
            [$userId]
        );

        // My Incidents
        $myIncidents = [];
        if (canAdmin() || canManage()) {
            try {
                $myIncidents = $this->db->fetchAll(
                    "SELECT id, title, severity, status, created_at
                     FROM incidents
                     WHERE (reported_by = ? OR assigned_to = ?) AND status != 'resolved'
                     ORDER BY created_at DESC LIMIT 10",
                    [$userId, $userId]
                );
            } catch (\Throwable $e) { /* incidents table may not exist */ }
        }

        // My Calendar (tasks due this week)
        $weekEnd = date('Y-m-d', strtotime('+7 days'));
        $myCalendar = $this->db->fetchAll(
            "SELECT id, title, due_date, priority, status
             FROM tasks
             WHERE assignee_id = ? AND is_completed = 0 AND due_date BETWEEN ? AND ?
             ORDER BY due_date ASC
             LIMIT 20",
            [$userId, $today, $weekEnd]
        );

        // Favorites
        $favorites = [];
        try {
            $favorites = $this->db->fetchAll(
                "SELECT * FROM user_favorites WHERE user_id = ? ORDER BY sort_order ASC LIMIT 10",
                [$userId]
            );
        } catch (\Throwable $e) { /* table may not exist yet */ }

        UsageTracker::log('workspace_view');

        $pageTitle = 'My Workspace';
        $currentPage = 'my-workspace';

        ob_start();
        include __DIR__ . '/../views/workspace/index.php';
        $content = ob_get_clean();
        include __DIR__ . '/../views/layouts/main.php';
    }
}
