<?php
/**
 * API v1 - Tasks Endpoints
 * GET|POST /api/v1/tasks
 * GET|PUT|PATCH|DELETE /api/v1/tasks/{id}
 */
require_once __DIR__ . '/ApiController.php';
require_once __DIR__ . '/../../../models/Task.php';
require_once __DIR__ . '/../../../models/Section.php';

class TaskApiController extends ApiController {
    private $taskModel;

    public function __construct() {
        parent::__construct();
        $this->taskModel = new Task();
    }

    // ── GET /api/v1/tasks ────────────────────────────────────────
    public function index() {
        $this->requireAuth();

        $p = $this->paginationParams(20, 100);
        $filters = $this->buildFilters();

        // Count total
        $total = $this->countTasks($filters);

        // Fetch tasks
        $tasks = $this->fetchTasks($p, $filters);

        api_response(api_paginate($tasks, $total, $p['page'], $p['perPage']), 'OK', 200);
    }

    // ── POST /api/v1/tasks ───────────────────────────────────────
    public function store() {
        $this->requireAuth();
        $body = $this->getJsonInput();

        $errors = [];
        if (empty(trim($body['title'] ?? ''))) $errors['title'] = ['Title is required'];
        if (empty($body['project_id'])) $errors['project_id'] = ['Project is required'];
        if (!empty($errors)) api_error('Validation failed', 422, $errors);

        $projectId = (int)$body['project_id'];
        $safeSectionId = (new Section())->normalizeSectionId($body['section_id'] ?? null, $projectId);

        $id = $this->taskModel->create([
            'project_id'   => $projectId,
            'section_id'   => $safeSectionId,
            'title'       => trim($body['title']),
            'description' => trim($body['description'] ?? ''),
            'assignee_id' => !empty($body['assignee_id']) ? (int)$body['assignee_id'] : null,
            'priority'    => in_array($body['priority'] ?? '', ['low','medium','high','urgent']) ? $body['priority'] : 'medium',
            'status'      => in_array($body['status'] ?? '', ['todo','in_progress','review','done']) ? $body['status'] : 'todo',
            'visibility'  => in_array($body['visibility'] ?? '', ['private','public'], true) ? $body['visibility'] : 'private',
            'private_by_user_id' => $this->userId,
            'due_date'    => !empty($body['due_date']) ? $body['due_date'] : null,
            'start_date'  => !empty($body['start_date']) ? $body['start_date'] : null,
            'created_by'  => $this->userId,
        ]);
        if (isset($body['task_categories']) || isset($body['task_category'])) {
            $rawCategories = $body['task_categories'] ?? [$body['task_category']];
            if (!is_array($rawCategories)) $rawCategories = [$rawCategories];
            $this->taskModel->syncCategories((int)$id, $rawCategories);
        }

        $task = $this->taskModel->findById($id);
        $this->auditLog('task_created', 'task', $id, ['title' => $task['title'] ?? '']);

        // Notify assignee
        if (!empty($body['assignee_id']) && (int)$body['assignee_id'] !== $this->userId) {
            $proj = (new Project())->findById($body['project_id']);
            notifyUser([
                'user_id'      => (int)$body['assignee_id'],
                'type'         => 'task_assigned',
                'title'        => 'Task mới được giao cho bạn',
                'message'      => $task['title'] . ' — ' . ($proj['name'] ?? ''),
                'task_id'      => $id,
                'project_id'   => $body['project_id'],
                'from_user_id' => $this->userId,
                'deep_link'    => '/tasks/' . $id,
            ]);
            $this->broadcast('task_created', $task);
        }

        api_response(['task' => $this->formatTask($task)], 'Task created', 201);
    }

    // ── GET /api/v1/tasks/{id} ───────────────────────────────────
    public function show($id) {
        $this->requireAuth();
        $task = $this->taskModel->findById($id);

        if (!$task) api_error('Task not found', 404);

        $this->checkTaskAccess($task);

        $comments = (new Comment())->getByTask($id);
        $attachments = $this->taskModel->getAttachments($id);
        $watchers = $this->taskModel->getWatchers($id);

        api_response([
            'task'       => $this->formatTask($task),
            'comments'   => array_map([$this, 'formatComment'], $comments),
            'attachments' => array_map([$this, 'formatAttachment'], $attachments),
            'watchers'   => array_map(fn($u) => ['id' => $u['id'], 'name' => $u['name'], 'avatar' => $u['avatar']], $watchers),
        ], 'OK');
    }

    // ── PUT /api/v1/tasks/{id} ───────────────────────────────────
    public function update($id) {
        $this->requireAuth();
        $task = $this->taskModel->findById($id);
        if (!$task) api_error('Task not found', 404);
        $this->checkTaskEditAccess($task);

        $body = $this->getJsonInput();

        $data = [];
        foreach (['title','description','assignee_id','priority','status','visibility','due_date','start_date','section_id','repeat_type','repeat_config'] as $f) {
            if (isset($body[$f])) {
                $data[$f] = $body[$f] !== '' ? $body[$f] : null;
            }
        }
        // Support new recurrence fields
        foreach (['repeat_from_mode','repeat_end_type','repeat_end_date','repeat_end_count'] as $f) {
            if (isset($body[$f])) {
                $data[$f] = $body[$f] !== '' ? $body[$f] : null;
            }
        }
        foreach (['approval_required','reviewer_id','approver_id','reviewer_due_date','review_instructions'] as $f) {
            if (isset($body[$f])) {
                $data[$f] = $body[$f] !== '' ? $body[$f] : null;
            }
        }
        if (isset($data['visibility']) && $data['visibility'] === 'private') {
            $data['private_by_user_id'] = $this->userId;
        }

        if (isset($body['is_completed'])) {
            $data['is_completed'] = $body['is_completed'] ? 1 : 0;
            if ($body['is_completed']) $data['status'] = 'done';
            else $data['status'] = 'todo';
        }

        if (!empty($task['reviewer_id']) && (($data['is_completed'] ?? 0) || (($data['status'] ?? '') === 'done'))) {
            $svc = new TaskCompletionService($this->taskModel);
            $result = $svc->complete((int)$id, $this->userId);
            $updated = $this->taskModel->findById($id);
            $this->auditLog('task_submitted_for_review', 'task', $id, $result);
            api_response(['task' => $this->formatTask($updated), 'review' => $result], 'Task submitted for review');
        }

        if (empty($data)) api_error('No fields to update', 400);

        $this->taskModel->update($id, $data);
        if (isset($body['task_categories']) || isset($body['task_category'])) {
            $rawCategories = $body['task_categories'] ?? [$body['task_category']];
            if (!is_array($rawCategories)) $rawCategories = [$rawCategories];
            $this->taskModel->syncCategories((int)$id, $rawCategories);
        }
        if (array_key_exists('reviewer_id', $data) || array_key_exists('reviewer_due_date', $data) || array_key_exists('review_instructions', $data)) {
            (new TaskReviewService($this->taskModel))->syncForTask((int)$id, $this->userId);
        }
        $updated = $this->taskModel->findById($id);

        $this->auditLog('task_updated', 'task', $id, $data);

        // Notify assignee change
        if (isset($data['assignee_id']) && $data['assignee_id'] != ($task['assignee_id'] ?? '') && $data['assignee_id'] && (int)$data['assignee_id'] !== $this->userId) {
            $proj = (new Project())->findById($task['project_id']);
            notifyUser([
                'user_id'      => (int)$data['assignee_id'],
                'type'         => 'task_assigned',
                'title'        => 'Task được giao cho bạn',
                'message'      => ($data['title'] ?? $task['title']),
                'task_id'      => $id,
                'project_id'   => $task['project_id'],
                'from_user_id' => $this->userId,
                'deep_link'    => '/tasks/' . $id,
            ]);
        }

        $this->broadcast('task_updated', $this->formatTask($updated));

        api_response(['task' => $this->formatTask($updated)], 'Task updated');
    }

    // ── PATCH /api/v1/tasks/{id}/status ──────────────────────────
    public function changeStatus($id) {
        $this->requireAuth();
        $task = $this->taskModel->findById($id);
        if (!$task) api_error('Task not found', 404);
        $this->checkTaskEditAccess($task);

        $body = $this->getJsonInput();
        $status = $body['status'] ?? '';

        if (!in_array($status, ['todo','in_progress','review','done'])) {
            api_error('Invalid status', 422, ['status' => ['Must be one of: todo, in_progress, review, done']]);
        }

        $data = ['status' => $status];

        if ($status === 'done') {
            if (!empty($task['reviewer_id'])) {
                $svc = new TaskCompletionService($this->taskModel);
                $result = $svc->complete((int)$id, $this->userId);
                $updated = $this->taskModel->findById($id);
                $this->auditLog('task_submitted_for_review', 'task', $id, $result);
                $this->broadcast('task_updated', $this->formatTask($updated));
                api_response(['task' => $this->formatTask($updated), 'review' => $result], 'Task submitted for review');
            }
            $data['is_completed'] = 1;
        } else {
            $data['is_completed'] = 0;
        }

        $this->taskModel->update($id, $data);
        $updated = $this->taskModel->findById($id);

        $this->auditLog('task_status_changed', 'task', $id, ['status' => $status]);
        $this->broadcast('task_updated', $this->formatTask($updated));

        api_response(['task' => $this->formatTask($updated)], 'Status updated');
    }

    // ── PATCH /api/v1/tasks/{id}/assign ──────────────────────────
    public function assign($id) {
        $this->requireAuth();
        $task = $this->taskModel->findById($id);
        if (!$task) api_error('Task not found', 404);
        $this->checkTaskEditAccess($task);

        $body = $this->getJsonInput();
        $assigneeId = isset($body['assignee_id']) ? (int)$body['assignee_id'] : null;

        $this->taskModel->update($id, ['assignee_id' => $assigneeId ?: null]);
        $updated = $this->taskModel->findById($id);

        if ($assigneeId && (int)$assigneeId !== $this->userId) {
            $proj = (new Project())->findById($task['project_id']);
            notifyUser([
                'user_id'      => $assigneeId,
                'type'         => 'task_assigned',
                'title'        => 'Task được giao cho bạn',
                'message'      => $task['title'] . ' — ' . ($proj['name'] ?? ''),
                'task_id'      => $id,
                'project_id'   => $task['project_id'],
                'from_user_id' => $this->userId,
                'deep_link'    => '/tasks/' . $id,
            ]);
        }

        $this->auditLog('task_assigned', 'task', $id, ['assignee_id' => $assigneeId]);
        $this->broadcast('task_updated', $this->formatTask($updated));

        api_response(['task' => $this->formatTask($updated)], 'Assignee updated');
    }

    // ── POST /api/v1/tasks/{id}/complete ─────────────────────────
    //    Sprint 1.2.3 — delegates to TaskCompletionService (recurring + notify)
    public function complete($id) {
        $this->requireAuth();
        $task = $this->taskModel->findById($id);
        if (!$task) api_error('Task not found', 404);
        $this->checkTaskEditAccess($task);

        $svc = new TaskCompletionService($this->taskModel);
        $result = $svc->complete((int)$id, $this->userId);

        $updated = $this->taskModel->findById($id);
        $this->auditLog('task_completed', 'task', $id, $result);
        $this->broadcast('task_updated', $this->formatTask($updated));

        $response = ['task' => $this->formatTask($updated)];
        if (!empty($result['next_task_id'])) {
            $nextTask = $this->taskModel->findById($result['next_task_id']);
            if ($nextTask) {
                $response['next_occurrence'] = $this->formatTask($nextTask);
                $this->broadcast('task_created', $this->formatTask($nextTask));
            }
        }
        api_response($response, 'Task completed');
    }

    // ── POST /api/v1/tasks/{id}/move-date ────────────────────────
    public function moveDate($id) {
        $this->requireAuth();
        $task = $this->taskModel->findById($id);
        if (!$task) api_error('Task not found', 404);
        $this->checkTaskEditAccess($task);

        $body = $this->getJsonInput();
        $due = trim($body['due_date'] ?? '');
        if (!$due || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $due)) {
            api_error('due_date (YYYY-MM-DD) is required', 422, ['due_date' => ['Invalid date']]);
        }
        $this->taskModel->update($id, ['due_date' => $due]);
        $updated = $this->taskModel->findById($id);
        $this->auditLog('task_date_moved', 'task', $id, ['from' => $task['due_date'], 'to' => $due]);
        $this->broadcast('task_updated', $this->formatTask($updated));
        api_response(['task' => $this->formatTask($updated)], 'Due date updated');
    }

    // ── POST /api/v1/tasks/{id}/snooze ───────────────────────────
    public function snooze($id) {
        $this->requireAuth();
        $task = $this->taskModel->findById($id);
        if (!$task) api_error('Task not found', 404);
        $this->checkTaskEditAccess($task);

        $body = $this->getJsonInput();
        $days = max(1, min(30, (int)($body['days'] ?? 1)));
        $base = $task['due_date'] ? substr($task['due_date'], 0, 10) : DateService::today();
        $newDue = DateService::addDays($base, $days);
        $this->taskModel->update($id, ['due_date' => $newDue]);
        $updated = $this->taskModel->findById($id);
        $this->auditLog('task_snoozed', 'task', $id, ['days' => $days, 'new_due' => $newDue]);
        $this->broadcast('task_updated', $this->formatTask($updated));
        api_response(['task' => $this->formatTask($updated)], "Snoozed {$days} day(s)");
    }

    // ── DELETE /api/v1/tasks/{id} ────────────────────────────────
    public function destroy($id) {
        $this->requireAuth();
        $task = $this->taskModel->findById($id);
        if (!$task) api_error('Task not found', 404);
        $this->checkTaskEditAccess($task);

        $this->auditLog('task_deleted', 'task', $id, ['title' => $task['title']]);
        $this->taskModel->delete($id);

        $this->broadcast('task_deleted', ['id' => $id]);

        api_response([], 'Task deleted');
    }

    // ── POST /api/v1/tasks/{id}/comments ─────────────────────────
    public function addComment($taskId) {
        $this->requireAuth();
        $task = $this->taskModel->findById($taskId);
        if (!$task) api_error('Task not found', 404);
        $this->checkTaskEditAccess($task);

        $body = $this->getJsonInput();
        $content = trim($body['content'] ?? '');

        if (!$content) api_error('Comment content is required', 400);

        $commentId = (new Comment())->create(
            $taskId,
            $this->userId,
            $content
        );

        $comment = $this->db->fetch(
            "SELECT c.*, u.name as user_name, u.avatar as user_avatar
             FROM comments c JOIN users u ON c.user_id = u.id WHERE c.id = ?",
            [$commentId]
        );

        $this->auditLog('comment_added', 'task', $taskId);

        // Notify watchers
        $notif = new Notification();
        $notif->notifyWatchers($taskId, $this->userId, 'task_comment',
            'Bình luận mới trên task',
            $task['title'] . ': ' . mb_substr($content, 0, 80),
            $this->userId
        );

        api_response(['comment' => $this->formatComment($comment)], 'Comment added', 201);
    }

    // ── GET /api/v1/tasks/{id}/comments ─────────────────────────
    public function getComments($taskId) {
        $this->requireAuth();
        $task = $this->taskModel->findById($taskId);
        if (!$task) api_error('Task not found', 404);
        $this->checkTaskAccess($task);

        $comments = (new Comment())->getByTask($taskId);
        api_response(['comments' => array_map([$this, 'formatComment'], $comments)], 'OK');
    }

    // ── Private helpers ─────────────────────────────────────────

    private function buildFilters() {
        $filters = [];

        $search = trim($_GET['search'] ?? '');
        if ($search) $filters['search'] = $search;

        $status = $_GET['status'] ?? '';
        if ($status) $filters['status'] = $status;

        $priority = $_GET['priority'] ?? '';
        if ($priority) $filters['priority'] = $priority;

        $assigneeId = $_GET['assignee_id'] ?? '';
        if ($assigneeId) $filters['assignee_id'] = (int)$assigneeId;

        $projectId = $_GET['project_id'] ?? '';
        if ($projectId) $filters['project_id'] = (int)$projectId;

        $storeId = $_GET['store_id'] ?? '';
        if ($storeId) $filters['store_id'] = (int)$storeId;

        $dueFrom = $_GET['due_from'] ?? '';
        if ($dueFrom) $filters['due_from'] = $dueFrom;

        $dueTo = $_GET['due_to'] ?? '';
        if ($dueTo) $filters['due_to'] = $dueTo;

        $overdue = $_GET['overdue'] ?? '';
        if ($overdue) $filters['overdue'] = true;

        $view = $_GET['view'] ?? '';
        if ($view) $filters['view'] = $view;

        $repeatType = $_GET['repeat_type'] ?? '';
        if ($repeatType) $filters['repeat_type'] = $repeatType;

        // Sprint 1.4.2 — is_recurring boolean shortcut + due-range preset
        if (isset($_GET['is_recurring'])) {
            $filters['is_recurring'] = in_array(strtolower((string)$_GET['is_recurring']), ['1','true','yes'], true);
        }
        $dueRange = $_GET['due_range'] ?? '';
        if (in_array($dueRange, ['today','week','month'], true)) $filters['due_range'] = $dueRange;

        return $filters;
    }

    private function countTasks($filters) {
        $sql = "SELECT COUNT(DISTINCT t.id) as total FROM tasks t
                LEFT JOIN projects p ON t.project_id = p.id
                LEFT JOIN project_members pm ON p.id = pm.project_id
                WHERE 1=1";

        $params = [];
        $sql .= $this->applyFilters($filters, $params);

        $r = $this->db->fetch($sql, $params);
        return (int)$r['total'];
    }

    private function fetchTasks($p, $filters) {
        $allowedSorts = ['created_at', 'updated_at', 'due_date', 'priority', 'title', 'status'];
        $sortBy = in_array($p['sortBy'], $allowedSorts) ? $p['sortBy'] : 'created_at';
        $sortDir = $p['sortDir'];
        $offset = ($p['page'] - 1) * $p['perPage'];

        $sql = "SELECT DISTINCT t.*, u.name as assignee_name, u.avatar as assignee_avatar,
                       c.name as creator_name, s.name as section_name,
                       p.name as project_name, p.color as project_color, p.store_id,
                       st.name as store_name, st.color as store_color
                FROM tasks t
                LEFT JOIN users u ON t.assignee_id = u.id
                LEFT JOIN users c ON t.created_by = c.id
                LEFT JOIN sections s ON t.section_id = s.id
                LEFT JOIN projects p ON t.project_id = p.id
                LEFT JOIN stores st ON p.store_id = st.id
                LEFT JOIN project_members pm ON p.id = pm.project_id
                WHERE 1=1";

        $params = [];
        $sql .= $this->applyFilters($filters, $params);
        $sql .= " ORDER BY t.{$sortBy} {$sortDir} LIMIT {$p['perPage']} OFFSET {$offset}";

        $tasks = $this->db->fetchAll($sql, $params);
        return array_map([$this, 'formatTask'], $tasks);
    }

    private function applyFilters($filters, &$params) {
        $userId = $this->userId;
        $sql = "";

        // Watchers are notifications only; task privacy is enforced by Task::canView rules.
        $sql .= " AND " . $this->taskModel->scopeVisibleToUserSql('t', $userId, $this->user['role'] ?? 'member');

        if (!empty($filters['search'])) {
            $sql .= " AND t.title LIKE ?";
            $params[] = '%' . $filters['search'] . '%';
        }

        if (!empty($filters['status'])) {
            $sql .= " AND t.status = ?";
            $params[] = $filters['status'];
        }

        if (!empty($filters['priority'])) {
            $sql .= " AND t.priority = ?";
            $params[] = $filters['priority'];
        }

        if (!empty($filters['assignee_id'])) {
            $sql .= " AND t.assignee_id = ?";
            $params[] = $filters['assignee_id'];
        }

        if (!empty($filters['project_id'])) {
            $sql .= " AND t.project_id = ?";
            $params[] = $filters['project_id'];
        }

        if (!empty($filters['store_id'])) {
            $sql .= " AND p.store_id = ?";
            $params[] = $filters['store_id'];
        }

        if (!empty($filters['due_from'])) {
            $sql .= " AND t.due_date >= ?";
            $params[] = $filters['due_from'];
        }

        if (!empty($filters['due_to'])) {
            $sql .= " AND t.due_date <= ?";
            $params[] = $filters['due_to'];
        }

        // TZ-aware "today" from per-user timezone (falls back to workspace default)
        $today = app_today($this->user['timezone'] ?? null);

        if (!empty($filters['overdue'])) {
            $sql .= " AND t.due_date < ? AND t.is_completed = 0";
            $params[] = $today;
        }

        if (!empty($filters['view'])) {
            switch ($filters['view']) {
                case 'today':
                    $sql .= " AND t.due_date = ? AND t.is_completed = 0";
                    $params[] = $today;
                    break;
                case 'upcoming':
                    $sql .= " AND t.due_date > ? AND t.is_completed = 0";
                    $params[] = $today;
                    break;
                case 'completed':
                    $sql .= " AND t.is_completed = 1";
                    break;
            }
        }

        // repeat_type filter — supports 'recurring' | 'single' | specific type
        if (!empty($filters['repeat_type'])) {
            if ($filters['repeat_type'] === 'recurring') {
                $sql .= " AND t.repeat_type <> 'none'";
            } elseif ($filters['repeat_type'] === 'single') {
                $sql .= " AND (t.repeat_type = 'none' OR t.repeat_type IS NULL)";
            } else {
                $sql .= " AND t.repeat_type = ?";
                $params[] = $filters['repeat_type'];
            }
        }

        // Sprint 1.4.2 — is_recurring boolean shortcut (alternative to repeat_type)
        if (isset($filters['is_recurring'])) {
            $sql .= $filters['is_recurring']
                ? " AND t.repeat_type IS NOT NULL AND t.repeat_type <> 'none'"
                : " AND (t.repeat_type IS NULL OR t.repeat_type = 'none')";
        }

        // Sprint 1.4.2 — due range presets (today / week / month)
        if (!empty($filters['due_range'])) {
            switch ($filters['due_range']) {
                case 'today':
                    $sql .= " AND t.due_date = ?";
                    $params[] = $today;
                    break;
                case 'week':
                    $sql .= " AND t.due_date BETWEEN ? AND ?";
                    $params[] = $today;
                    $params[] = (new DateTimeImmutable($today))->modify('+7 days')->format('Y-m-d');
                    break;
                case 'month':
                    $sql .= " AND t.due_date BETWEEN ? AND ?";
                    $params[] = $today;
                    $params[] = (new DateTimeImmutable($today))->modify('+30 days')->format('Y-m-d');
                    break;
            }
        }

        return $sql;
    }

    private function checkTaskAccess($task) {
        $userId = $this->userId;
        $isAdmin = in_array($this->user['role'] ?? '', ['admin', 'ceo']);

        if ($isAdmin) return true;

        $related = ($task['assignee_id'] == $userId)
            || ($task['created_by'] == $userId)
            || $this->taskModel->isWatcher($task['id'], $userId);

        if (!$related) {
            api_error('Access denied', 403);
        }
        return true;
    }

    private function checkTaskEditAccess($task) {
        if (!$this->taskModel->canEdit((int)$task['id'], $this->userId)) {
            api_error('Access denied', 403);
        }
        return true;
    }

    public function formatTask($task) {
        return [
            'id'                  => (int)$task['id'],
            'title'               => $task['title'] ?? '',
            'description'         => $task['description'] ?? '',
            'notes'              => $task['notes'] ?? null,
            'status'             => $task['status'] ?? 'todo',
            'visibility'         => $task['visibility'] ?? 'private',
            'private_by_user_id'  => !empty($task['private_by_user_id']) ? (int)$task['private_by_user_id'] : null,
            'priority'           => $task['priority'] ?? 'medium',
            'due_date'           => $task['due_date'] ?? null,
            'start_date'         => $task['start_date'] ?? null,
            'is_completed'       => (int)($task['is_completed'] ?? 0),
            'completed_at'       => $task['completed_at'] ?? null,
            'accepted_at'        => $task['accepted_at'] ?? null,
            'project_id'         => (int)$task['project_id'],
            'section_id'         => $task['section_id'] ? (int)$task['section_id'] : null,
            'assignee_id'        => $task['assignee_id'] ? (int)$task['assignee_id'] : null,
            'assignee_name'      => $task['assignee_name'] ?? null,
            'assignee_avatar'    => $task['assignee_avatar'] ?? null,
            'creator_id'         => (int)($task['created_by'] ?? 0),
            'creator_name'       => $task['creator_name'] ?? null,
            'project_name'       => $task['project_name'] ?? null,
            'project_color'      => $task['project_color'] ?? null,
            'store_id'           => !empty($task['store_id']) ? (int) $task['store_id'] : null,
            'store_name'         => $task['store_name'] ?? null,
            'store_color'        => $task['store_color'] ?? null,
            'section_name'       => $task['section_name'] ?? null,
            'repeat_type'        => $task['repeat_type'] ?? 'none',
            'repeat_config'      => $task['repeat_config'] ?? null,
            'repeat_from_mode'   => $task['repeat_from_mode'] ?? 'due_date',
            'repeat_end_type'    => $task['repeat_end_type'] ?? 'never',
            'repeat_end_date'    => $task['repeat_end_date'] ?? null,
            'repeat_end_count'   => $task['repeat_end_count'] ?? null,
            'recurring_root_id'  => !empty($task['recurring_root_id']) ? (int)$task['recurring_root_id'] : null,
            'occurrence_index'  => (int)($task['occurrence_index'] ?? 0),
            'repeat_summary'    => app_task_repeat_summary($task),
            'estimated_time'    => $task['estimated_time'] ?? null,
            'created_at'        => $task['created_at'] ?? null,
            'updated_at'        => $task['updated_at'] ?? null,
        ];
    }

    private function formatComment($comment) {
        return [
            'id'        => (int)$comment['id'],
            'task_id'   => (int)$comment['task_id'],
            'user_id'   => (int)$comment['user_id'],
            'user_name' => $comment['user_name'] ?? null,
            'user_avatar' => $comment['user_avatar'] ?? null,
            'content'   => $comment['content'] ?? '',
            'created_at'=> $comment['created_at'] ?? null,
            'updated_at'=> $comment['updated_at'] ?? null,
        ];
    }

    private function formatAttachment($att) {
        $fileUrl = '';
        if (!empty($att['filename'])) {
            $fileUrl = rtrim(APP_URL, '/') . '/attachments/' . $att['id'] . '/download';
            if (!empty($att['file_url'])) $fileUrl = $att['file_url'];
        }
        return [
            'id'           => (int)$att['id'],
            'task_id'      => (int)$att['task_id'],
            'user_id'      => (int)$att['user_id'],
            'user_name'    => $att['user_name'] ?? null,
            'filename'     => $att['filename'] ?? '',
            'original_name'=> $att['original_name'] ?? '',
            'file_url'     => $fileUrl,
            'file_size'    => (int)($att['file_size'] ?? 0),
            'mime_type'    => $att['mime_type'] ?? '',
            'created_at'   => $att['created_at'] ?? null,
        ];
    }
}
