<?php
/**
 * API v1 - My Tasks Endpoints
 * GET /api/v1/me/tasks  (tasks assigned to current user)
 * GET /api/v1/me/tasks/new  (unaccepted tasks)
 */
require_once __DIR__ . '/ApiController.php';
require_once __DIR__ . '/TaskApiController.php';

class MyTasksApiController extends ApiController {
    private $taskModel;

    public function __construct() {
        parent::__construct();
        $this->taskModel = new Task();
    }

    // ── GET /api/v1/me/tasks ────────────────────────────────────
    public function myTasks() {
        $this->requireAuth();
        $userId = $this->userId;

        $p = $this->paginationParams(50, 100);
        $sortBy = in_array($p['sortBy'], ['due_date','created_at','updated_at','priority','title']) ? $p['sortBy'] : 'due_date';
        $sortDir = $p['sortDir'];
        $offset = ($p['page'] - 1) * $p['perPage'];

        // Build groups
        $group = $_GET['group'] ?? 'all'; // all | today | upcoming | overdue | completed

        $today = app_today();
        $whereClause = "WHERE (t.assignee_id = ? OR t.created_by = ?)";
        $params = [$userId, $userId];

        switch ($group) {
            case 'today':
                $whereClause .= " AND t.due_date = ? AND t.is_completed = 0";
                $params[] = $today;
                break;
            case 'upcoming':
                $whereClause .= " AND t.due_date > ? AND t.is_completed = 0";
                $params[] = $today;
                break;
            case 'overdue':
                $whereClause .= " AND t.due_date < ? AND t.is_completed = 0";
                $params[] = $today;
                break;
            case 'completed':
                $whereClause .= " AND t.is_completed = 1";
                break;
            default:
                $whereClause .= " AND t.is_completed = 0 AND t.accepted_at IS NOT NULL";
        }

        // Count
        $total = $this->db->fetch(
            "SELECT COUNT(DISTINCT t.id) as c FROM tasks t
             $whereClause",
            $params
        )['c'] ?? 0;

        // Fetch
        $tasks = $this->db->fetchAll(
            "SELECT DISTINCT t.*, p.name as project_name, p.color as project_color, s.name as section_name
             FROM tasks t
             LEFT JOIN projects p ON t.project_id = p.id
             LEFT JOIN sections s ON t.section_id = s.id
             $whereClause
             ORDER BY
               CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END,
               t.{$sortBy} {$sortDir}
             LIMIT {$p['perPage']} OFFSET {$offset}",
            $params
        );

        // Group counts
        $counts = $this->db->fetchAll(
            "SELECT
               SUM(CASE WHEN t.is_completed = 0 AND t.accepted_at IS NOT NULL THEN 1 ELSE 0 END) as active,
               SUM(CASE WHEN t.due_date = ? AND t.is_completed = 0 AND t.accepted_at IS NOT NULL THEN 1 ELSE 0 END) as today,
               SUM(CASE WHEN t.due_date > ? AND t.is_completed = 0 AND t.accepted_at IS NOT NULL THEN 1 ELSE 0 END) as upcoming,
               SUM(CASE WHEN t.due_date < ? AND t.is_completed = 0 AND t.accepted_at IS NOT NULL THEN 1 ELSE 0 END) as overdue,
               SUM(CASE WHEN t.is_completed = 1 THEN 1 ELSE 0 END) as completed
             FROM tasks t
             WHERE t.assignee_id = ? OR t.created_by = ?",
            [$today, $today, $today, $userId, $userId]
        );

        $taskCtrl = new TaskApiController();
        api_response([
            'tasks' => array_map([$taskCtrl, 'formatTask'], $tasks),
            'counts' => [
                'active'    => (int)($counts[0]['active'] ?? 0),
                'today'     => (int)($counts[0]['today'] ?? 0),
                'upcoming'  => (int)($counts[0]['upcoming'] ?? 0),
                'overdue'   => (int)($counts[0]['overdue'] ?? 0),
                'completed' => (int)($counts[0]['completed'] ?? 0),
            ],
        ], 'OK', 200, api_paginate($tasks, $total, $p['page'], $p['perPage']));
    }

    // ── GET /api/v1/me/tasks/new ─────────────────────────────────
    public function newTasks() {
        $this->requireAuth();
        $userId = $this->userId;

        $tasks = $this->db->fetchAll(
            "SELECT t.*, p.name as project_name, p.color as project_color,
                    c.name as creator_name, s.name as section_name
             FROM tasks t
             LEFT JOIN projects p ON t.project_id = p.id
             LEFT JOIN users c ON t.created_by = c.id
             LEFT JOIN sections s ON t.section_id = s.id
             WHERE t.assignee_id = ? AND t.accepted_at IS NULL AND t.is_completed = 0
             ORDER BY t.created_at DESC",
            [$userId]
        );

        $taskCtrl = new TaskApiController();
        api_response([
            'tasks' => array_map([$taskCtrl, 'formatTask'], $tasks),
        ], 'OK');
    }

    // ── POST /api/v1/me/tasks/{id}/accept ───────────────────────
    public function acceptTask($taskId) {
        $this->requireAuth();
        $userId = $this->userId;

        $task = $this->db->fetch(
            "SELECT * FROM tasks WHERE id = ? AND assignee_id = ? AND accepted_at IS NULL",
            [$taskId, $userId]
        );

        if (!$task) api_error('Task not found or already accepted', 404);

        $body = $this->getJsonInput();
        $dueDate = $body['due_date'] ?? null;

        if ($dueDate) {
            $this->taskModel->update($taskId, ['due_date' => $dueDate]);
        }

        $task = $this->db->fetch("SELECT * FROM tasks WHERE id = ?", [$taskId]);
        if (empty($task['due_date'])) {
            api_error('Due date is required before accepting', 422, ['due_date' => ['Required']]);
        }

        $this->taskModel->acceptAssignedTask($taskId);

        // Notify watchers
        $notif = new Notification();
        $user = (new User())->findById($userId);
        $notif->notifyWatchers($taskId, $userId, 'task_assigned',
            $user['name'] . ' đã chấp nhận task',
            $task['title'],
            $userId
        );

        $this->auditLog('task_accepted', 'task', $taskId);
        $this->broadcast('task_updated', (new TaskApiController())->formatTask($this->taskModel->findById($taskId)));

        api_response([], 'Task accepted');
    }
}
