<?php
class Task {
    private $db;

    public function __construct() {
        $this->db = Database::getInstance();
        // Schema is managed via database/migrations/2026_04_12_task_schema_columns.sql
    }

    private function normalizeRepeatType($repeatType): string {
        $repeatType = strtolower(trim((string)($repeatType ?? 'none')));
        return in_array($repeatType, ['none', 'daily', 'weekly', 'monthly', 'yearly'], true)
            ? $repeatType
            : 'none';
    }

    private function normalizeRepeatConfig($repeatType, $repeatConfig, array $context = []): ?string {
        $repeatType = $this->normalizeRepeatType($repeatType);
        if ($repeatType === 'none') {
            return null;
        }

        if (is_string($repeatConfig) && trim($repeatConfig) !== '') {
            $decoded = json_decode($repeatConfig, true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                $repeatConfig = $decoded;
            }
        }

        if (!is_array($repeatConfig)) {
            $repeatConfig = [];
        }

        $normalized = [];
        if ($repeatType === 'daily') {
            $normalized['interval'] = max(1, (int)($repeatConfig['interval'] ?? 1));
        } elseif ($repeatType === 'weekly') {
            $normalized['interval'] = max(1, (int)($repeatConfig['interval'] ?? 1));
            $days = $repeatConfig['days'] ?? [];
            if (is_string($days)) {
                $days = $days !== '' ? explode(',', $days) : [];
            }
            $days = array_values(array_unique(array_filter(array_map('intval', (array)$days), fn($d) => $d >= 1 && $d <= 7)));
            if (empty($days) && !empty($context['due_date'])) {
                $weekday = (int)date('N', strtotime((string)$context['due_date']));
                $days = [$weekday];
            }
            $normalized['days'] = $days;
        } elseif ($repeatType === 'monthly') {
            $normalized['interval'] = max(1, (int)($repeatConfig['interval'] ?? 1));
            $normalized['by'] = in_array(($repeatConfig['by'] ?? 'day_of_month'), ['day_of_month', 'weekday_of_month'], true)
                ? $repeatConfig['by']
                : 'day_of_month';
            $defaultDay = !empty($context['due_date']) ? (int)date('j', strtotime((string)$context['due_date'])) : 1;
            $normalized['day_of_month'] = max(1, min(31, (int)($repeatConfig['day_of_month'] ?? $defaultDay)));
        } elseif ($repeatType === 'yearly') {
            $normalized['interval'] = max(1, (int)($repeatConfig['interval'] ?? 1));
        }

        return json_encode($normalized, JSON_UNESCAPED_UNICODE);
    }

    public function findById($id) {
        $hasReviewerId = $this->db->columnExists('tasks', 'reviewer_id');
        $hasApproverId = $this->db->columnExists('tasks', 'approver_id');

        $reviewerSelect = $hasReviewerId
            ? 'r.name as reviewer_name'
            : 'NULL as reviewer_name';
        $approverSelect = $hasApproverId
            ? 'a.name as approver_name'
            : 'NULL as approver_name';
        $reviewerJoin = $hasReviewerId
            ? 'LEFT JOIN users r ON t.reviewer_id = r.id'
            : '';
        $approverJoin = $hasApproverId
            ? 'LEFT JOIN users a ON t.approver_id = a.id'
            : '';

        return $this->db->fetch(
            "SELECT t.*, 
                    u.name as assignee_name,
                    c.name as creator_name,
                    s.name as section_name,
                    p.name as project_name,
                    p.store_id,
                    st.name as store_name,
                    st.color as store_color,
                    {$reviewerSelect},
                    {$approverSelect}
             FROM tasks t
             LEFT JOIN users u ON t.assignee_id = u.id
             LEFT JOIN users c ON t.created_by = c.id
             LEFT JOIN sections s ON t.section_id = s.id
             LEFT JOIN projects p ON t.project_id = p.id
             LEFT JOIN stores st ON p.store_id = st.id
             {$reviewerJoin}
             {$approverJoin}
             WHERE t.id = ?",
            [$id]
        );
    }

    public function getByProject($projectId) {
        return $this->db->fetchAll(
            "SELECT t.*, u.name as assignee_name, p.store_id, st.name as store_name, st.color as store_color
             FROM tasks t
             LEFT JOIN users u ON t.assignee_id = u.id
             LEFT JOIN projects p ON t.project_id = p.id
             LEFT JOIN stores st ON p.store_id = st.id
             WHERE t.project_id = ? ORDER BY t.position, t.created_at DESC",
            [$projectId]
        );
    }

    // Get tasks in project that are related to a specific user (assignee, creator, or watcher)
    public function getByProjectForUser($projectId, $userId) {
        $visibleSql = $this->scopeVisibleToUserSql('t', $userId);
        return $this->db->fetchAll(
            "SELECT DISTINCT t.*, u.name as assignee_name, p.store_id, st.name as store_name, st.color as store_color
             FROM tasks t
             LEFT JOIN users u ON t.assignee_id = u.id
             LEFT JOIN projects p ON t.project_id = p.id
             LEFT JOIN stores st ON p.store_id = st.id
             WHERE t.project_id = ?
             AND {$visibleSql}
             ORDER BY t.position, t.created_at DESC",
            [$projectId]
        );
    }

    public function getBySection($sectionId) {
        return $this->db->fetchAll(
            "SELECT t.*, u.name as assignee_name, p.store_id, st.name as store_name, st.color as store_color
             FROM tasks t
             LEFT JOIN users u ON t.assignee_id = u.id
             LEFT JOIN projects p ON t.project_id = p.id
             LEFT JOIN stores st ON p.store_id = st.id
             WHERE t.section_id = ? ORDER BY t.position",
            [$sectionId]
        );
    }

    public function getByUser($userId, $limit = 20) {
        return $this->db->fetchAll(
            "SELECT DISTINCT t.*, p.name as project_name, p.store_id, st.name as store_name, st.color as store_color,
                    s.name as section_name
             FROM tasks t
             LEFT JOIN projects p ON t.project_id = p.id
             LEFT JOIN stores st ON p.store_id = st.id
             LEFT JOIN sections s ON t.section_id = s.id
             WHERE (t.assignee_id = ? OR t.created_by = ?) AND t.is_completed = 0
             -- accepted_at gate removed 2026-06-10: tasks appear immediately on assignment
             ORDER BY
                CASE
                    WHEN t.due_date IS NOT NULL AND t.due_date < ? THEN 0
                    WHEN t.status IN ('in_progress', 'review') THEN 1
                    WHEN t.due_date = ? THEN 2
                    WHEN t.due_date IS NOT NULL THEN 3
                    ELSE 4
                END ASC,
                t.due_date ASC,
                FIELD(t.priority, 'urgent', 'high', 'medium', 'low') ASC
             LIMIT ?",
            [$userId, $userId, app_today(), app_today(), $limit]
        );
    }

    // Get NEW (unaccepted) tasks assigned to user
    public function getNewTasks($userId) {
        return $this->db->fetchAll(
            "SELECT t.*, p.name as project_name, p.color as project_color, p.store_id,
                    st.name as store_name, st.color as store_color,
                    c.name as creator_name, s.name as section_name
             FROM tasks t
             LEFT JOIN projects p ON t.project_id = p.id
             LEFT JOIN stores st ON p.store_id = st.id
             LEFT JOIN users c ON t.created_by = c.id
             LEFT JOIN sections s ON t.section_id = s.id
             WHERE t.assignee_id = ? AND t.accepted_at IS NULL AND t.is_completed = 0
             ORDER BY t.created_at DESC",
            [$userId]
        );
    }

    public function countNewTasks($userId) {
        $result = $this->db->fetch(
            "SELECT COUNT(*) as c FROM tasks WHERE assignee_id = ? AND accepted_at IS NULL AND is_completed = 0",
            [$userId]
        );
        return (int)($result['c'] ?? 0);
    }

    public function acceptAssignedTask($id) {
        return $this->db->update(
            "UPDATE tasks SET accepted_at = NOW() WHERE id = ? AND accepted_at IS NULL",
            [$id]
        );
    }

    public function getUpcoming($userId, $days = 7) {
        return $this->db->fetchAll(
            "SELECT t.*, p.name as project_name, p.store_id, st.name as store_name, st.color as store_color
             FROM tasks t
             LEFT JOIN projects p ON t.project_id = p.id
             LEFT JOIN stores st ON p.store_id = st.id
             WHERE t.assignee_id = ? AND t.is_completed = 0
             AND t.due_date BETWEEN ? AND DATE_ADD(?, INTERVAL ? DAY)
             ORDER BY t.due_date ASC",
            [$userId, app_today(), app_today(), $days]
        );
    }

    public function getOverdue($userId) {
        return $this->db->fetchAll(
            "SELECT t.*, p.name as project_name, p.store_id, st.name as store_name, st.color as store_color
             FROM tasks t
             LEFT JOIN projects p ON t.project_id = p.id
             LEFT JOIN stores st ON p.store_id = st.id
             WHERE t.assignee_id = ? AND t.is_completed = 0
             AND t.due_date < ? ORDER BY t.due_date ASC",
            [$userId, app_today()]
        );
    }

    public function create($data) {
        // ── SAFE: Normalize section_id before using it in any query ──────────
        $projectId = isset($data['project_id']) ? (int)$data['project_id'] : null;
        $section = new Section();
        $safeSectionId = $section->normalizeSectionId($data['section_id'] ?? null, $projectId);

        $maxPos = $this->db->fetch(
            "SELECT MAX(position) as mp FROM tasks WHERE section_id = ?",
            [$safeSectionId]
        );

        $acceptedAt = isset($data['accepted_at']) ? $data['accepted_at'] : null;
        $parentTaskId = $data['parent_task_id'] ?? null;
        $rescheduleCount = $data['reschedule_count'] ?? 0;

        $repeatType = $this->normalizeRepeatType($data['repeat_type'] ?? 'none');
        $repeatConfig = $this->normalizeRepeatConfig($repeatType, $data['repeat_config'] ?? null, $data);
        $recurringRootId = $data['recurring_root_id'] ?? null;
        $occurrenceIndex = isset($data['occurrence_index']) ? max(0, (int) $data['occurrence_index']) : 0;
        $visibility = $this->normalizeVisibility($data['visibility'] ?? 'private');
        $privateByUserId = $visibility === 'private'
            ? ($data['private_by_user_id'] ?? $data['created_by'] ?? null)
            : null;

        $id = $this->db->insert(
            "INSERT INTO tasks (project_id, section_id, title, description, notes, assignee_id, priority, status, visibility, private_by_user_id, due_date, start_date, position, created_by, accepted_at, parent_task_id, reschedule_count, repeat_type, repeat_config, repeat_from_mode, repeat_end_type, repeat_end_date, repeat_end_count, estimated_time, recurring_root_id, occurrence_index)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                $data['project_id'],
                $safeSectionId,
                $data['title'],
                $data['description'] ?? '',
                $data['notes'] ?? null,
                $data['assignee_id'] ?: null,
                $data['priority'] ?? 'medium',
                $data['status'] ?? 'todo',
                $visibility,
                $privateByUserId,
                $data['due_date'] ?: null,
                $data['start_date'] ?: null,
                ($maxPos['mp'] ?? -1) + 1,
                $data['created_by'],
                $acceptedAt,
                $parentTaskId,
                $rescheduleCount,
                $repeatType,
                $repeatConfig,
                $data['repeat_from_mode'] ?? 'due_date',
                $data['repeat_end_type'] ?? 'never',
                $data['repeat_end_date'] ?? null,
                $data['repeat_end_count'] ?? null,
                $data['estimated_time'] ?? null,
                $recurringRootId,
                $occurrenceIndex
            ]
        );

        if ($id && $repeatType !== 'none' && empty($recurringRootId)) {
            $this->db->update("UPDATE tasks SET recurring_root_id = ? WHERE id = ?", [$id, $id]);
        }

        // Auto-add creator and assignee as watchers
        if ($id) {
            $this->addWatcher($id, $data['created_by']);
            if (!empty($data['assignee_id']) && $data['assignee_id'] != $data['created_by']) {
                $this->addWatcher($id, $data['assignee_id']);
            }
        }

        return $id;
    }

    public function update($id, $data) {
        $current = $this->findById($id);
        if (!$current) {
            return false;
        }

        if (array_key_exists('repeat_type', $data) && $this->normalizeRepeatType($data['repeat_type']) === 'none' && !array_key_exists('repeat_config', $data)) {
            $data['repeat_config'] = null;
        }

        $fields = [];
        $params = [];
        // Approval workflow columns only if they exist in the DB (guard against unapplied migration)
        $approvalCols = $this->db->columnExists('tasks', 'approval_required')
            ? ['approval_required', 'reviewer_id', 'approver_id']
            : [];
        $workspaceCols = [];
        foreach (['review_instructions', 'review_checklist', 'required_evidence', 'required_files', 'reviewer_result', 'reviewer_result_note', 'reviewer_result_at', 'approver_result', 'approver_result_note', 'approver_result_at'] as $col) {
            if ($this->db->columnExists('tasks', $col)) {
                $workspaceCols[] = $col;
            }
        }

        $reviewerDateCols = [];
        foreach (['reviewer_due_date', 'reviewer_assigned_at'] as $col) {
            if ($this->db->columnExists('tasks', $col)) $reviewerDateCols[] = $col;
        }

        $storeCols = [];
        foreach (['task_category', 'direct_store_id', 'bill_id'] as $col) {
            if ($this->db->columnExists('tasks', $col)) $storeCols[] = $col;
        }

        $allowed = array_merge(
            ['title', 'description', 'notes', 'assignee_id', 'priority', 'status', 'visibility',
             'private_by_user_id', 'due_date', 'start_date', 'section_id', 'position',
             'is_completed', 'repeat_type', 'repeat_config', 'repeat_from_mode',
             'repeat_end_type', 'repeat_end_date', 'repeat_end_count', 'estimated_time'],
            $approvalCols,
            $workspaceCols,
            $reviewerDateCols,
            $storeCols
        );
        foreach ($allowed as $field) {
            if (array_key_exists($field, $data)) {
                if ($field === 'visibility') {
                    $data[$field] = $this->normalizeVisibility($data[$field]);
                    if ($data[$field] === 'public' && !array_key_exists('private_by_user_id', $data)) {
                        $fields[] = "private_by_user_id = NULL";
                    }
                    if ($data[$field] === 'private' && empty($data['private_by_user_id'])) {
                        $data['private_by_user_id'] = $_SESSION['user_id'] ?? ($current['created_by'] ?? null);
                    }
                }
                if ($field === 'section_id') {
                    $section = new Section();
                    $data[$field] = $section->normalizeSectionId($data[$field], (int)($data['project_id'] ?? $current['project_id'] ?? 0));
                }
                if ($field === 'repeat_type') {
                    $data[$field] = $this->normalizeRepeatType($data[$field]);
                }
                if ($field === 'repeat_config') {
                    $repeatType = $data['repeat_type'] ?? ($current['repeat_type'] ?? 'none');
                    $data[$field] = $this->normalizeRepeatConfig($repeatType, $data[$field], $current);
                }
                $fields[] = "$field = ?";
                $params[] = $data[$field] === '' ? null : $data[$field];
            }
        }
        if (isset($data['is_completed']) && $data['is_completed']) {
            $fields[] = "completed_at = NOW()";
        }
        if (isset($data['status']) && !array_key_exists('is_completed', $data)) {
            if ($data['status'] === 'done') {
                $fields[] = "is_completed = 1";
                $fields[] = "completed_at = NOW()";
                $data['is_completed'] = 1;
            } elseif (!empty($current['is_completed'])) {
                $fields[] = "is_completed = 0";
                $fields[] = "completed_at = NULL";
                $data['is_completed'] = 0;
            }
        }

        // Auto-set reviewer_assigned_at and reviewer_due_date when reviewer_id is first assigned
        if (isset($data['reviewer_id']) && !empty($data['reviewer_id']) && empty($current['reviewer_id'])) {
            if ($this->db->columnExists('tasks', 'reviewer_assigned_at') && !array_key_exists('reviewer_assigned_at', $data)) {
                $fields[] = "reviewer_assigned_at = NOW()";
            }
            if ($this->db->columnExists('tasks', 'reviewer_due_date') && !array_key_exists('reviewer_due_date', $data)) {
                // Default: 3 days from now, but not after task due_date
                $taskDue = $data['due_date'] ?? $current['due_date'] ?? null;
                $defaultReviewerDue = date('Y-m-d', strtotime('+3 days'));
                if ($taskDue && $taskDue < $defaultReviewerDue) {
                    $defaultReviewerDue = $taskDue;
                }
                $fields[] = "reviewer_due_date = ?";
                $params[] = $defaultReviewerDue;
            }
        }
        if (empty($fields)) {
            return false;
        }

        $params[] = $id;
        $result = $this->db->update("UPDATE tasks SET " . implode(', ', $fields) . " WHERE id = ?", $params);

        // If assignee changed, add new assignee as watcher
        if (isset($data['assignee_id']) && $data['assignee_id']) {
            $this->addWatcher($id, $data['assignee_id']);
        }

        // REMOVED: Recurrence generation no longer triggered from update().
        // All completion-based recurrence is handled exclusively by TaskCompletionService::complete().
        // This prevents double-generation and ensures consistent repeat_from_mode handling.

        return $result;
    }

    public function delete($id) {
        return $this->db->delete("DELETE FROM tasks WHERE id = ?", [$id]);
    }

    public function toggleComplete($id) {
        $task = $this->findById($id);
        if (!$task) {
            return false;
        }

        $result = $this->db->update(
            "UPDATE tasks SET is_completed = NOT is_completed,
             completed_at = IF(is_completed = 0, NOW(), NULL),
             status = IF(is_completed = 0, 'done', 'todo')
             WHERE id = ?",
            [$id]
        );

        // Auto-complete parent task when a rescheduled task is completed.
        // Review children are approval gates and must not complete the parent here.
        $isReviewChild = (($task['task_category'] ?? '') === 'review');
        if ($task && !$task['is_completed'] && !empty($task['parent_task_id']) && !$isReviewChild) {
            $this->db->update(
                "UPDATE tasks SET is_completed = 1, completed_at = NOW(), status = 'done'
                 WHERE id = ? AND is_completed = 0",
                [$task['parent_task_id']]
            );
        }

        // NOTE: Recurrence generation is NOT triggered here.
        // It is handled by TaskCompletionService::complete() which is the single
        // orchestrator for completion side-effects. This prevents double-fire when
        // TaskCompletionService calls toggleComplete() then generateNextOccurrence().

        return $result;
    }

    // Reschedule: create new task linked to original
    public function reschedule($id, $newDueDate) {
        $task = $this->findById($id);
        if (!$task) return false;

        $count = ($task['reschedule_count'] ?? 0) + 1;
        $baseTitle = preg_replace('/\s*\(dời lịch lần \d+\)\s*$/', '', $task['title']);
        $newTitle = $baseTitle . " (dời lịch lần $count)";

        $newId = $this->create([
            'project_id' => $task['project_id'],
            'section_id' => $task['section_id'],
            'title' => $newTitle,
            'description' => $task['description'],
            'assignee_id' => $task['assignee_id'],
            'priority' => $task['priority'],
            'status' => 'todo',
            'due_date' => $newDueDate,
            'start_date' => null,
            'created_by' => $task['assignee_id'] ?: $task['created_by'],
            'accepted_at' => date('Y-m-d H:i:s'),
            'visibility' => $task['visibility'] ?? 'private',
            'private_by_user_id' => $task['private_by_user_id'] ?? null,
            'parent_task_id' => $id,
            'reschedule_count' => $count,
        ]);

        // Copy watchers to new task
        if ($newId) {
            $watchers = $this->getWatchers($id);
            foreach ($watchers as $w) {
                $this->addWatcher($newId, $w['id']);
            }
        }

        return $newId;
    }

    // Get children (rescheduled) tasks
    // Duplicate a task (copy)
    public function duplicate($id, $createdBy) {
        $task = $this->findById($id);
        if (!$task) return false;

        $title = preg_replace('/\s*\(Copy\)\s*$/', '', $task['title']) . ' (Copy)';

        $newId = $this->create([
            'project_id' => $task['project_id'],
            'section_id' => $task['section_id'],
            'title' => $title,
            'description' => $task['description'],
            'assignee_id' => $task['assignee_id'],
            'priority' => $task['priority'],
            'status' => 'todo',
            'due_date' => $task['due_date'],
            'start_date' => $task['start_date'],
            'created_by' => $createdBy,
            'accepted_at' => date('Y-m-d H:i:s'),
            'visibility' => $task['visibility'] ?? 'private',
            'private_by_user_id' => $task['private_by_user_id'] ?? null,
            'repeat_type' => $task['repeat_type'] ?? 'none',
            'repeat_config' => $task['repeat_config'] ?? null,
            'recurring_root_id' => null,
            'occurrence_index' => 0,
        ]);

        // Copy watchers
        if ($newId) {
            $watchers = $this->getWatchers($id);
            foreach ($watchers as $w) {
                $this->addWatcher($newId, $w['id']);
            }
        }

        return $newId;
    }

    public function getChildren($taskId) {
        return $this->db->fetchAll(
            "SELECT t.*, u.name as assignee_name FROM tasks t
             LEFT JOIN users u ON t.assignee_id = u.id
             WHERE t.parent_task_id = ? ORDER BY t.reschedule_count",
            [$taskId]
        );
    }

    public function move($id, $sectionId, $position) {
        $task = $this->findById($id);
        if (!$task) return false;

        $section = new Section();
        $safeSectionId = $section->normalizeSectionId($sectionId, (int)$task['project_id']);

        return $this->db->update(
            "UPDATE tasks SET section_id = ?, position = ? WHERE id = ?",
            [$safeSectionId, (int)$position, $id]
        );
    }

    public function reorder($tasks) {
        $section = new Section();
        foreach ($tasks as $task) {
            $current = $this->findById($task['id']);
            if (!$current) continue;

            $safeSectionId = $section->normalizeSectionId($task['section_id'] ?? null, (int)$current['project_id']);
            $this->db->update(
                "UPDATE tasks SET section_id = ?, position = ? WHERE id = ?",
                [$safeSectionId, (int)($task['position'] ?? 0), $task['id']]
            );
        }
    }

    // Watchers
    public function getWatchers($taskId) {
        return $this->db->fetchAll(
            "SELECT u.id, u.name, u.email, u.avatar FROM task_watchers tw
             JOIN users u ON tw.user_id = u.id WHERE tw.task_id = ? ORDER BY u.name",
            [$taskId]
        );
    }

    public function addWatcher($taskId, $userId) {
        try {
            return $this->db->insert(
                "INSERT IGNORE INTO task_watchers (task_id, user_id) VALUES (?, ?)",
                [$taskId, $userId]
            );
        } catch (Exception $e) {
            return false;
        }
    }

    public function removeWatcher($taskId, $userId) {
        return $this->db->delete(
            "DELETE FROM task_watchers WHERE task_id = ? AND user_id = ?",
            [$taskId, $userId]
        );
    }

    public function isWatcher($taskId, $userId) {
        $result = $this->db->fetch(
            "SELECT COUNT(*) as c FROM task_watchers WHERE task_id = ? AND user_id = ?",
            [$taskId, $userId]
        );
        return $result['c'] > 0;
    }

    // Stats
    public function countByStatus($projectId = null) {
        $where = $projectId ? "WHERE project_id = ?" : "";
        $params = $projectId ? [$projectId] : [];
        return $this->db->fetchAll(
            "SELECT status, COUNT(*) as count FROM tasks $where GROUP BY status",
            $params
        );
    }

    public function countByUser($projectId = null) {
        $where = $projectId ? "AND t.project_id = ?" : "";
        $params = $projectId ? [$projectId] : [];
        return $this->db->fetchAll(
            "SELECT u.name, COUNT(*) as total,
             SUM(t.is_completed) as completed
             FROM tasks t JOIN users u ON t.assignee_id = u.id
             WHERE t.assignee_id IS NOT NULL $where
             GROUP BY t.assignee_id",
            $params
        );
    }

    public function totalCount() {
        $result = $this->db->fetch("SELECT COUNT(*) as total FROM tasks");
        return $result['total'];
    }

    public function completedCount() {
        $result = $this->db->fetch("SELECT COUNT(*) as total FROM tasks WHERE is_completed = 1");
        return $result['total'];
    }

    public function getCalendarTasksForUser($userId, $startDate, $endDate, $projectId = null) {
        $projectClause = '';
        $uid = (int)$userId;
        $personalSql = "(
            t.assignee_id = {$uid}
            OR t.created_by = {$uid}
            OR EXISTS (SELECT 1 FROM task_watchers tw WHERE tw.task_id = t.id AND tw.user_id = {$uid})
        )";
        $params = [$startDate, $endDate];
        if ($projectId !== null) {
            $projectClause = " AND t.project_id = ?";
            $params[] = $projectId;
        }

        return $this->db->fetchAll(
            "SELECT DISTINCT t.*, p.name as project_name, p.color as project_color,
                    COALESCE(t.direct_store_id, p.store_id) as store_id,
                    COALESCE(dst.name, st.name) as store_name,
                    COALESCE(dst.color, st.color) as store_color,
                    u.name as assignee_name, c.name as creator_name
             FROM tasks t
             LEFT JOIN projects p ON t.project_id = p.id
             LEFT JOIN stores st ON p.store_id = st.id
             LEFT JOIN stores dst ON t.direct_store_id = dst.id
             LEFT JOIN users u ON t.assignee_id = u.id
             LEFT JOIN users c ON t.created_by = c.id
             WHERE t.due_date BETWEEN ? AND ?
             AND COALESCE(t.status, 'todo') NOT IN ('cancelled','archived')
             AND {$personalSql}
             {$projectClause}
             ORDER BY t.due_date ASC, FIELD(t.priority, 'urgent', 'high', 'medium', 'low') ASC, t.created_at ASC",
            $params
        );
    }

    public function getTasksByDateForUser($userId, $date, $projectId = null) {
        $uid = (int)$userId;
        $personalSql = "(
            t.assignee_id = {$uid}
            OR t.created_by = {$uid}
            OR EXISTS (SELECT 1 FROM task_watchers tw WHERE tw.task_id = t.id AND tw.user_id = {$uid})
        )";
        $params = [$date];
        $projectClause = '';
        if ($projectId !== null) {
            $projectClause = " AND t.project_id = ?";
            $params[] = $projectId;
        }

        return $this->db->fetchAll(
            "SELECT DISTINCT t.*, p.name as project_name, p.color as project_color,
                    COALESCE(t.direct_store_id, p.store_id) as store_id,
                    COALESCE(dst.name, st.name) as store_name,
                    COALESCE(dst.color, st.color) as store_color,
                    u.name as assignee_name, c.name as creator_name
             FROM tasks t
             LEFT JOIN projects p ON t.project_id = p.id
             LEFT JOIN stores st ON p.store_id = st.id
             LEFT JOIN stores dst ON t.direct_store_id = dst.id
             LEFT JOIN users u ON t.assignee_id = u.id
             LEFT JOIN users c ON t.created_by = c.id
             WHERE t.due_date = ?
             AND COALESCE(t.status, 'todo') NOT IN ('cancelled','archived')
             AND {$personalSql}
             {$projectClause}
             ORDER BY
                CASE
                    WHEN t.status IN ('in_progress', 'review') THEN 0
                    ELSE 1
                END ASC,
                FIELD(t.priority, 'urgent', 'high', 'medium', 'low') ASC,
                t.title ASC",
            $params
        );
    }

    // Attachments
    public function getAttachments($taskId) {
        return $this->db->fetchAll(
            "SELECT a.*, u.name as user_name FROM attachments a
             JOIN users u ON a.user_id = u.id WHERE a.task_id = ? ORDER BY a.created_at DESC",
            [$taskId]
        );
    }

    public function addAttachment($data) {
        return $this->db->insert(
            "INSERT INTO attachments (task_id, user_id, filename, original_name, file_size, mime_type)
             VALUES (?, ?, ?, ?, ?, ?)",
            [$data['task_id'], $data['user_id'], $data['filename'], $data['original_name'], $data['file_size'], $data['mime_type']]
        );
    }

    public function findAttachment($id) {
        return $this->db->fetch("SELECT * FROM attachments WHERE id = ?", [$id]);
    }

    public function deleteAttachment($id) {
        $att = $this->findAttachment($id);
        if ($att) {
            $filepath = UPLOAD_DIR . $att['filename'];
            if (file_exists($filepath)) unlink($filepath);
            return $this->db->delete("DELETE FROM attachments WHERE id = ?", [$id]);
        }
        return false;
    }

    // ── Recurring task helpers ───────────────────────────────────────────

    private function normalizeVisibility($visibility) {
        $visibility = strtolower(trim((string) $visibility));
        return in_array($visibility, ['private', 'public'], true) ? $visibility : 'private';
    }

    private function clampRepeatInterval($type, $value) {
        $limits = ['daily' => 30, 'weekly' => 12, 'monthly' => 12, 'yearly' => 10];
        $max = $limits[$type] ?? 12;
        return max(1, min($max, (int) $value));
    }

    private function decodeRepeatConfig($config) {
        if (is_array($config)) return $config;
        $decoded = json_decode((string) $config, true);
        return is_array($decoded) ? $decoded : [];
    }

    private function taskDateTime($task) {
        $dueDate = $task['due_date'] ?? app_today();
        return new DateTimeImmutable($dueDate . ' 00:00:00', app_timezone());
    }

    private function recurrenceRootId($task) {
        return !empty($task['recurring_root_id']) ? (int) $task['recurring_root_id'] : (int) $task['id'];
    }

    private function recurringSourceTask($task) {
        $rootId = $this->recurrenceRootId($task);
        if ($rootId === (int) $task['id']) return $task;
        return $this->findById($rootId) ?: $task;
    }

    private function nextOccurrenceDueDate($task) {
        $source = $this->recurringSourceTask($task);
        $type = $this->normalizeRepeatType($source['repeat_type'] ?? 'none');
        if ($type === 'none') return null;
        $config = $this->decodeRepeatConfig($source['repeat_config'] ?? null);
        $interval = $this->clampRepeatInterval($type, $config['interval'] ?? 1);
        $current = $this->taskDateTime($task);
        switch ($type) {
            case 'daily':
                return $current->modify('+' . $interval . ' days')->format('Y-m-d');
            case 'weekly':
                $days = array_values(array_unique(array_filter(array_map('intval', $config['days'] ?? []))));
                sort($days);
                if (empty($days)) $days = [(int) $this->taskDateTime($source)->format('N')];
                $currentWeekday = (int) $current->format('N');
                foreach ($days as $day) {
                    if ($day > $currentWeekday)
                        return $current->modify('+' . ($day - $currentWeekday) . ' days')->format('Y-m-d');
                }
                $delta = ($interval * 7) - $currentWeekday + $days[0];
                return $current->modify('+' . $delta . ' days')->format('Y-m-d');
            case 'monthly':
                $dayOfMonth = max(1, min(31, (int) ($config['day_of_month'] ?? $this->taskDateTime($source)->format('j'))));
                $targetMonth = ((int) $current->format('n')) + $interval;
                $targetYear = (int) $current->format('Y') + (int) floor(($targetMonth - 1) / 12);
                $targetMonth = (($targetMonth - 1) % 12) + 1;
                $lastDay = cal_days_in_month(CAL_GREGORIAN, $targetMonth, $targetYear);
                return sprintf('%04d-%02d-%02d', $targetYear, $targetMonth, min($dayOfMonth, $lastDay));
            case 'yearly':
                $targetYear = (int) $current->format('Y') + $interval;
                $targetMonth = (int) $current->format('n');
                $targetDay = (int) $current->format('j');
                $lastDay = cal_days_in_month(CAL_GREGORIAN, $targetMonth, $targetYear);
                return sprintf('%04d-%02d-%02d', $targetYear, $targetMonth, min($targetDay, $lastDay));
        }
        return null;
    }

    /**
     * Calculate next due date starting from a specific base date (used for completion-based recurrence).
     * Mirrors nextOccurrenceDueDate() but accepts an arbitrary base date instead of task['due_date'].
     */
    public function nextOccurrenceDueDateFrom(array $task, string $fromDate): ?string
    {
        $source = $this->recurringSourceTask($task);
        $type = $this->normalizeRepeatType($source['repeat_type'] ?? 'none');
        if ($type === 'none') return null;

        $config = $this->decodeRepeatConfig($source['repeat_config'] ?? null);
        $interval = $this->clampRepeatInterval($type, $config['interval'] ?? 1);

        $tz = app_timezone();
        $base = new DateTimeImmutable(substr($fromDate, 0, 10) . ' 00:00:00', $tz);

        switch ($type) {
            case 'daily':
                return $base->modify('+' . $interval . ' days')->format('Y-m-d');

            case 'weekly':
                $days = array_values(array_unique(array_filter(array_map('intval', $config['days'] ?? []))));
                sort($days);
                if (empty($days)) $days = [(int) $base->format('N')];
                $currentWeekday = (int) $base->format('N');
                foreach ($days as $day) {
                    if ($day > $currentWeekday) {
                        return $base->modify('+' . ($day - $currentWeekday) . ' days')->format('Y-m-d');
                    }
                }
                $delta = ($interval * 7) - $currentWeekday + $days[0];
                return $base->modify('+' . $delta . ' days')->format('Y-m-d');

            case 'monthly':
                $dayOfMonth = max(1, min(31, (int)($config['day_of_month'] ?? (int)$base->format('j'))));
                $targetMonth = ((int)$base->format('n')) + $interval;
                $targetYear  = (int)$base->format('Y') + (int)floor(($targetMonth - 1) / 12);
                $targetMonth = (($targetMonth - 1) % 12) + 1;
                $lastDay = cal_days_in_month(CAL_GREGORIAN, $targetMonth, $targetYear);
                return sprintf('%04d-%02d-%02d', $targetYear, $targetMonth, min($dayOfMonth, $lastDay));

            case 'yearly':
                $targetYear = (int)$base->format('Y') + $interval;
                $targetMonth = (int)$base->format('n');
                $targetDay   = (int)$base->format('j');
                $lastDay = cal_days_in_month(CAL_GREGORIAN, $targetMonth, $targetYear);
                return sprintf('%04d-%02d-%02d', $targetYear, $targetMonth, min($targetDay, $lastDay));

            default:
                return null;
        }
    }

    private function recurringOccurrenceExists($rootId, $dueDate) {
        return (bool) $this->db->fetch(
            "SELECT id FROM tasks WHERE due_date = ? AND (id = ? OR recurring_root_id = ?) LIMIT 1",
            [$dueDate, $rootId, $rootId]
        );
    }

    /**
     * Generate the next occurrence for a completed recurring task.
     *
     * Supports two modes:
     *   - repeat_from_mode = 'due_date'        → schedule based on original due date
     *   - repeat_from_mode = 'completion_date' → schedule based on when user completed
     *
     * @param int  $taskId
     * @param bool $useCompletionDate If true, forces completion_date mode (used by TaskCompletionService)
     * @return int|null New task ID, or null if recurrence ended / not applicable.
     */
    public function createNextRecurringOccurrence($taskId, bool $useCompletionDate = false)
    {
        $pdo = $this->db->getConnection();
        $pdo->beginTransaction();
        try {
            $task = $this->db->fetch("SELECT * FROM tasks WHERE id = ? FOR UPDATE", [$taskId]);
            if (!$task || empty($task['is_completed'])) { $pdo->commit(); return null; }

            $source = $this->recurringSourceTask($task);
            $type = $this->normalizeRepeatType($source['repeat_type'] ?? 'none');
            if ($type === 'none') { $pdo->commit(); return null; }

            // ── Calculate next due date ──────────────────────────────────────
            // Choose base date for recurrence calculation:
            //   completion_date: use actual completion timestamp (Asana/Todoist behavior)
            //   due_date:        use original due date (preserves calendar schedule)
            $repeatFromMode = $source['repeat_from_mode'] ?? 'due_date';
            if ($useCompletionDate || $repeatFromMode === 'completion_date') {
                $completedAt = !empty($task['completed_at']) ? substr($task['completed_at'], 0, 10) : date('Y-m-d');
                $nextDueDate = $this->nextOccurrenceDueDateFrom($source, $completedAt);
            } else {
                $nextDueDate = $this->nextOccurrenceDueDate($source);
            }

            // ── End-rule check (uses computed nextDueDate for consistency) ───
            if (!$this->shouldRecurrenceContinueForDate($source, $task, $nextDueDate)) { $pdo->commit(); return null; }

            if (!$nextDueDate) { $pdo->commit(); return null; }

            $rootId = $this->recurrenceRootId($source);
            if ($this->recurringOccurrenceExists($rootId, $nextDueDate)) { $pdo->commit(); return null; }

            // ── Clone task preserving all metadata ───────────────────────────
            $newId = $this->create([
                'project_id'          => $source['project_id'],
                'section_id'          => $source['section_id'],
                'title'               => $source['title'],
                'description'         => $source['description'],
                'notes'               => $source['notes'] ?? null,
                'assignee_id'         => $source['assignee_id'],
                'priority'            => $source['priority'],
                'status'              => 'todo',
                'due_date'            => $nextDueDate,
                'start_date'          => $source['start_date'] ?: null,
                'created_by'          => $source['created_by'],
                'accepted_at'         => $source['accepted_at'] ?? null,
                'visibility'          => $source['visibility'] ?? 'private',
                'private_by_user_id'  => $source['private_by_user_id'] ?? null,
                'parent_task_id'      => $task['id'],
                'reschedule_count'    => 0,
                'repeat_type'         => $source['repeat_type'],
                'repeat_config'       => $source['repeat_config'],
                'repeat_from_mode'    => $source['repeat_from_mode'] ?? 'due_date',
                'repeat_end_type'     => $source['repeat_end_type'] ?? 'never',
                'repeat_end_date'     => $source['repeat_end_date'] ?? null,
                'repeat_end_count'    => $source['repeat_end_count'] ?? null,
                'estimated_time'      => $source['estimated_time'] ?? null,
                'recurring_root_id'   => $rootId,
                'occurrence_index'    => ((int) ($task['occurrence_index'] ?? 0)) + 1,
            ]);

            // Copy watchers to new task
            foreach ($this->getWatchers($taskId) as $watcher) {
                $this->addWatcher($newId, $watcher['id']);
            }

            // Copy comments to new task
            $this->copyTaskComments($taskId, $newId);

            $pdo->commit();

            ProductionLogger::info('RECURRENCE', 'Recurring occurrence created', [
                'source_task_id' => $taskId,
                'new_task_id' => $newId,
                'next_due_date' => $nextDueDate,
                'root_id' => $rootId,
                'occurrence_index' => ((int) ($task['occurrence_index'] ?? 0)) + 1,
            ]);
            return $newId;
        } catch (Exception $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            ProductionLogger::error('RECURRENCE', 'Failed to create recurring occurrence', [
                'task_id' => $taskId,
                'error' => $e->getMessage(),
            ]);
            error_log("[Recurrence] createNextRecurringOccurrence error: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Check whether recurrence should continue generating.
     * Returns false if the end-rule has been reached.
     * @deprecated Use shouldRecurrenceContinueForDate() which accepts the pre-computed nextDueDate.
     */
    private function shouldRecurrenceContinue(array $source, array $completedTask): bool
    {
        $endType = $source['repeat_end_type'] ?? 'never';
        if ($endType === 'never') return true;

        if ($endType === 'date') {
            $endDate = $source['repeat_end_date'] ?? null;
            if (!$endDate) return true;
            $next = $this->nextOccurrenceDueDate($source);
            return (bool)($next && $next <= $endDate);
        }

        if ($endType === 'count') {
            $max = (int)($source['repeat_end_count'] ?? 0);
            if ($max <= 0) return true;
            $current = (int)($completedTask['occurrence_index'] ?? 0);
            return ($current + 1) < $max;
        }

        return true;
    }

    /**
     * Unified end-rule check that uses the already-computed next due date.
     * This ensures consistency regardless of whether recurrence uses due_date or completion_date mode.
     *
     * @param array       $source        The recurring root/source task config
     * @param array       $completedTask The task that was just completed
     * @param string|null $nextDueDate   The pre-computed next occurrence date
     * @return bool True if recurrence should continue, false if end-rule reached.
     */
    private function shouldRecurrenceContinueForDate(array $source, array $completedTask, ?string $nextDueDate): bool
    {
        $endType = $source['repeat_end_type'] ?? 'never';
        if ($endType === 'never') return true;

        if ($endType === 'date') {
            $endDate = $source['repeat_end_date'] ?? null;
            if (!$endDate) return true;
            return (bool)($nextDueDate && $nextDueDate <= $endDate);
        }

        if ($endType === 'count') {
            $max = (int)($source['repeat_end_count'] ?? 0);
            if ($max <= 0) return true;
            $current = (int)($completedTask['occurrence_index'] ?? 0);
            return ($current + 1) < $max;
        }

        return true;
    }

    /**
     * Copy comments from one task to another.
     */
    private function copyTaskComments(int $fromTaskId, int $toTaskId): void
    {
        try {
            $comments = $this->db->fetchAll(
                "SELECT user_id, content FROM comments WHERE task_id = ?",
                [$fromTaskId]
            );
            foreach ($comments as $c) {
                $this->db->insert(
                    "INSERT INTO comments (task_id, user_id, content, created_at) VALUES (?, ?, ?, NOW())",
                    [$toTaskId, $c['user_id'], $c['content']]
                );
            }
        } catch (Exception $e) {
            // Best-effort: comments are not critical
            error_log("[Recurrence] copyTaskComments failed: " . $e->getMessage());
        }
    }

    /**
     * Check if a user is allowed to edit a task.
     * Admins and managers (who are project members) can always edit.
     * The task assignee and creator can also edit their own tasks.
     */
    public function canEdit(int $taskId, int $userId): bool {
        if (canAdmin()) return true;
        $task = $this->findById($taskId);
        if (!$task) return false;
        // Assignee or creator can edit
        if ((int)($task['assignee_id'] ?? 0) === $userId || (int)($task['created_by'] ?? 0) === $userId) {
            return true;
        }
        // Manager can edit tasks in projects they belong to
        if (canManage() && !empty($task['project_id'])) {
            return (new \Project())->isMember($task['project_id'], $userId);
        }
        return false;
    }

    /**
     * Build a SQL WHERE fragment for task visibility scoping.
     * Returns a self-contained SQL expression with NO placeholders — user ID and role
     * are embedded as literal integers/strings (safe: userId is always cast to int,
     * role is from a fixed whitelist).
     *
     * This design allows callers to simply interpolate the result into their queries
     * without needing to pass extra params.
     */
    public function scopeVisibleToUserSql(string $alias = 't', ?int $userId = null, string $role = 'member'): string {
        // Admin/manager sees everything
        if (canAdmin()) return '1=1';

        $uid = (int)($userId ?? ($_SESSION['user_id'] ?? 0));
        if (!$uid) return '1=0';

        // Sanitize role to prevent injection (whitelist)
        $allowedRoles = ['admin', 'manager', 'member'];
        $safeRole = in_array($role, $allowedRoles, true) ? $role : 'member';

        $a = $alias;

        // Manager sees everything in their projects
        if ($safeRole === 'manager') {
            return "(
                {$a}.visibility = 'public'
                OR {$a}.created_by = {$uid}
                OR {$a}.assignee_id = {$uid}
                OR EXISTS (SELECT 1 FROM task_watchers tw WHERE tw.task_id = {$a}.id AND tw.user_id = {$uid})
                OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = {$a}.project_id AND pm.user_id = {$uid})
            )";
        }

        // Regular member: see public tasks in their projects + private tasks they own/watch
        return "(
            ({$a}.visibility = 'public' AND EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = {$a}.project_id AND pm.user_id = {$uid}))
            OR {$a}.created_by = {$uid}
            OR {$a}.assignee_id = {$uid}
            OR EXISTS (SELECT 1 FROM task_watchers tw WHERE tw.task_id = {$a}.id AND tw.user_id = {$uid})
        )";
    }

    /**
     * Check if a user can VIEW a specific task.
     * Lightweight check without running a full query — uses the same logic as scopeVisibleToUserSql.
     */
    public function canView(int $taskId, int $userId): bool {
        if (canAdmin()) return true;

        $task = $this->findById($taskId);
        if (!$task || !is_array($task)) return false;

        // Creator or assignee can always view
        if ((int)($task['created_by'] ?? 0) === $userId) return true;
        if ((int)($task['assignee_id'] ?? 0) === $userId) return true;

        // Watcher can view
        if ($this->isWatcher($taskId, $userId)) return true;

        // Public task: any project member can view
        if (($task['visibility'] ?? 'private') === 'public' && !empty($task['project_id'])) {
            return (new \Project())->isMember($task['project_id'], $userId);
        }

        // Manager can view tasks in projects they belong to
        if (canManage() && !empty($task['project_id'])) {
            return (new \Project())->isMember($task['project_id'], $userId);
        }

        return false;
    }

    // V9: TASK CATEGORY + BILL LINK + STORE RESOLUTION

    public function allowedCategories(): array {
        return [
            'payroll',
            'tax',
            'sale_receipt',
            'bill',
            'payment',
            'store_operation',
            'admin',
            'other',
            'rent',
            'utility',
            'utilities',
            'water',
            'electronic',
            'trash',
            'phone',
            'insurance',
            'credit_card',
            'waste',
            'licensing',
            'compliance',
            'vendor',
            'software',
            'subscription',
            'supplies',
            'maintenance',
            'banking',
            'general',
            'review',
        ];
    }

    public function updateCategory(int $id, string $category): bool {
        $allowed = $this->allowedCategories();
        if (!in_array($category, $allowed, true)) return false;
        return $this->db->update("UPDATE tasks SET task_category = ? WHERE id = ?", [$category, $id]);
    }

    public function getCategories(int $taskId): array {
        if (!$this->db->tableExists('task_category_links')) {
            $task = $this->findById($taskId);
            return !empty($task['task_category']) ? [(string)$task['task_category']] : [];
        }
        $rows = $this->db->fetchAll(
            "SELECT category FROM task_category_links WHERE task_id = ? ORDER BY category",
            [$taskId]
        );
        return array_values(array_map(fn($r) => (string)$r['category'], $rows));
    }

    public function syncCategories(int $taskId, array $categories): bool {
        $allowed = $this->allowedCategories();
        $clean = [];
        foreach ($categories as $category) {
            $category = strtolower(trim((string)$category));
            if ($category !== '' && in_array($category, $allowed, true)) {
                $clean[$category] = $category;
            }
        }
        $clean = array_values($clean);
        $primary = $clean[0] ?? null;

        if ($this->db->columnExists('tasks', 'task_category')) {
            $this->db->update("UPDATE tasks SET task_category = ? WHERE id = ?", [$primary, $taskId]);
        }

        if (!$this->db->tableExists('task_category_links')) {
            return true;
        }

        $this->db->execute("DELETE FROM task_category_links WHERE task_id = ?", [$taskId]);
        foreach ($clean as $category) {
            $this->db->insert(
                "INSERT INTO task_category_links (task_id, category, created_at) VALUES (?, ?, NOW())",
                [$taskId, $category]
            );
        }
        return true;
    }

    public function linkToBill(int $taskId, ?int $billId): bool {
        return $this->db->update("UPDATE tasks SET bill_id = ? WHERE id = ?", [$billId, $taskId]) !== false;
    }

    public function setDirectStore(int $taskId, ?int $storeId): bool {
        return $this->db->update("UPDATE tasks SET direct_store_id = ? WHERE id = ?", [$storeId, $taskId]) !== false;
    }

    public function resolveStoreId(array $task): ?int {
        if (!empty($task['direct_store_id'])) return (int)$task['direct_store_id'];
        if (!empty($task['bill_id'])) {
            $bill = $this->db->fetch("SELECT store_id FROM bills WHERE id = ?", [(int)$task['bill_id']]);
            if ($bill && !empty($bill['store_id'])) return (int)$bill['store_id'];
        }
        if (!empty($task['project_id'])) {
            $proj = $this->db->fetch("SELECT store_id FROM projects WHERE id = ?", [(int)$task['project_id']]);
            if ($proj && !empty($proj['store_id'])) return (int)$proj['store_id'];
        }
        return null;
    }

    public function getAllByStore(?int $userId = null, ?int $storeId = null, ?string $category = null, ?string $status = null, ?string $startDate = null, ?string $endDate = null, bool $includeCompleted = true, int $limit = 500): array {
        $uid = (int)($userId ?? ($_SESSION['user_id'] ?? 0));
        $conditions = [];
        $params = [];
        if (!canAdmin()) {
            $conditions[] = "(t.visibility = 'public' OR t.assignee_id = {$uid} OR t.created_by = {$uid} OR EXISTS (SELECT 1 FROM task_watchers tw WHERE tw.task_id = t.id AND tw.user_id = {$uid}))";
        }
        if ($storeId) {
            $conditions[] = "(t.direct_store_id = ? OR EXISTS (SELECT 1 FROM projects p2 WHERE p2.id = t.project_id AND p2.store_id = ?))";
            $params[] = $storeId; $params[] = $storeId;
        }
        if ($category) {
            $conditions[] = "(t.task_category = ? OR EXISTS (SELECT 1 FROM task_category_links tcl WHERE tcl.task_id = t.id AND tcl.category = ?))";
            $params[] = $category;
            $params[] = $category;
        }
        if ($status === 'completed') { $conditions[] = "t.is_completed = 1"; }
        elseif ($status === 'open') { $conditions[] = "t.is_completed = 0"; }
        elseif ($status === 'overdue') { $conditions[] = "t.is_completed = 0 AND t.due_date < ?"; $params[] = app_today(); }
        if ($startDate) { $conditions[] = "t.due_date >= ?"; $params[] = $startDate; }
        if ($endDate) { $conditions[] = "t.due_date <= ?"; $params[] = $endDate; }
        if (!$includeCompleted) { $conditions[] = "t.is_completed = 0"; }
        $where = $conditions ? "WHERE " . implode(' AND ', $conditions) : "";
        $params[] = $limit;
        $rows = $this->db->fetchAll(
            "SELECT t.*, p.name as project_name, p.color as project_color, p.store_id as project_store_id, s.name as store_name, s.color as store_color, u.name as assignee_name, c.name as creator_name
             FROM tasks t LEFT JOIN projects p ON t.project_id = p.id LEFT JOIN stores s ON s.id = COALESCE(t.direct_store_id, p.store_id) LEFT JOIN users u ON t.assignee_id = u.id LEFT JOIN users c ON t.created_by = c.id
             {$where} ORDER BY s.name, t.due_date ASC, FIELD(t.priority,'urgent','high','medium','low') ASC LIMIT ?", $params
        );
        $grouped = [];
        foreach ($rows as $row) {
            $effectiveStoreId = $this->resolveStoreId($row);
            $key = $effectiveStoreId ?? 'unassigned';
            if (!isset($grouped[$key])) {
                $grouped[$key] = ['store_id' => $effectiveStoreId, 'store_name' => $row['store_name'] ?? 'Unassigned', 'store_color' => $row['store_color'] ?? '#6B7280', 'tasks' => []];
            }
            $grouped[$key]['tasks'][] = $row;
        }
        return $grouped;
    }

    public function getAllTasksForCeo(?int $memberId = null, ?int $storeId = null, ?string $category = null, ?string $filter = null, ?string $startDate = null, ?string $endDate = null, int $limit = 500): array {
        $conditions = [];
        $params = [];
        if ($memberId) { $conditions[] = "t.assignee_id = ?"; $params[] = $memberId; }
        if ($storeId) {
            $conditions[] = "(t.direct_store_id = ? OR EXISTS (SELECT 1 FROM projects p2 WHERE p2.id = t.project_id AND p2.store_id = ?))";
            $params[] = $storeId; $params[] = $storeId;
        }
        if ($category) {
            $conditions[] = "(t.task_category = ? OR EXISTS (SELECT 1 FROM task_category_links tcl WHERE tcl.task_id = t.id AND tcl.category = ?))";
            $params[] = $category;
            $params[] = $category;
        }
        $today = app_today();
        if ($filter === 'overdue') { $conditions[] = "t.is_completed = 0 AND t.due_date < ?"; $params[] = $today; }
        elseif ($filter === 'today') { $conditions[] = "t.is_completed = 0 AND t.due_date = ?"; $params[] = $today; }
        elseif ($filter === 'this_week') { $conditions[] = "t.is_completed = 0 AND t.due_date BETWEEN ? AND DATE_ADD(?, INTERVAL 7 DAY)"; $params[] = $today; $params[] = $today; }
        elseif ($filter === 'completed') { $conditions[] = "t.is_completed = 1"; }
        if ($startDate) { $conditions[] = "t.due_date >= ?"; $params[] = $startDate; }
        if ($endDate) { $conditions[] = "t.due_date <= ?"; $params[] = $endDate; }
        $where = $conditions ? "WHERE " . implode(' AND ', $conditions) : "";
        $params[] = $limit;
        return $this->db->fetchAll(
            "SELECT t.*, p.name as project_name, p.store_id as project_store_id, s.name as store_name, s.color as store_color, u.name as assignee_name, u.id as assignee_user_id, c.name as creator_name
             FROM tasks t LEFT JOIN projects p ON t.project_id = p.id LEFT JOIN stores s ON s.id = COALESCE(t.direct_store_id, p.store_id) LEFT JOIN users u ON t.assignee_id = u.id LEFT JOIN users c ON t.created_by = c.id
             {$where} ORDER BY t.due_date ASC, FIELD(t.priority,'urgent','high','medium','low') ASC, t.updated_at DESC LIMIT ?", $params
        );
    }

    // V9: DUPLICATE DETECTION

    public function findDuplicates(): array {
        $rows = $this->db->fetchAll(
            "SELECT t.id, t.title, t.assignee_id, t.due_date, t.project_id, t.recurring_root_id, t.occurrence_index, t.is_completed, t.repeat_type, t.created_at, u.name as assignee_name, p.name as project_name,
                    COUNT(*) OVER (PARTITION BY LOWER(TRIM(t.title)), t.assignee_id, t.due_date, t.project_id, COALESCE(t.recurring_root_id, 0)) as dup_count
             FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id LEFT JOIN projects p ON t.project_id = p.id
             ORDER BY dup_count DESC, t.due_date DESC, t.created_at DESC"
        );
        $seen = [];
        foreach ($rows as $row) {
            $key = implode('|', [mb_strtolower(trim($row['title'])), $row['assignee_id'] ?? '', $row['due_date'] ?? '', $row['project_id'] ?? '', $row['recurring_root_id'] ?? '']);
            if (!isset($seen[$key])) $seen[$key] = ['group_key' => $key, 'tasks' => [], 'dup_count' => 0];
            $seen[$key]['tasks'][] = $row;
            $seen[$key]['dup_count'] = $row['dup_count'];
        }
        $duplicates = [];
        foreach ($seen as $group) { if ($group['dup_count'] > 1) $duplicates[] = $group; }
        usort($duplicates, fn($a, $b) => $b['dup_count'] <=> $a['dup_count']);
        return $duplicates;
    }

    public function getDuplicateGroup(int $taskId): ?array {
        $task = $this->findById($taskId);
        if (!$task) return null;
        return $this->db->fetchAll(
            "SELECT t.*, u.name as assignee_name, p.name as project_name FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id LEFT JOIN projects p ON t.project_id = p.id
             WHERE LOWER(TRIM(t.title)) = LOWER(TRIM(?)) AND COALESCE(t.assignee_id, 0) = COALESCE(?, 0) AND COALESCE(t.due_date, '') = COALESCE(?, '') AND COALESCE(t.project_id, 0) = COALESCE(?, 0) ORDER BY t.id ASC",
            [$task['title'], $task['assignee_id'], $task['due_date'], $task['project_id']]
        );
    }

    public function archive(int $taskId, int $archivedBy): bool {
        $task = $this->findById($taskId);
        if (!$task) return false;
        $archivedTitle = '[ARCHIVED ' . date('Y-m-d') . '] ' . $task['title'];
        return $this->db->update("UPDATE tasks SET title = ?, status = 'done', is_completed = 1, completed_at = NOW(), updated_at = NOW() WHERE id = ?", [$archivedTitle, $taskId]) !== false;
    }

    public function recordDuplicateAudit(int $taskId, ?int $canonicalId, string $matchType, array $matchFields, int $auditedBy): bool {
        if (!$this->db->tableExists('task_duplicate_audit')) return false;
        $fields = json_encode($matchFields, JSON_UNESCAPED_UNICODE);
        return $this->db->insert("INSERT INTO task_duplicate_audit (task_id, duplicate_of, match_type, match_fields, audited_by, audited_at, status) VALUES (?, ?, ?, ?, ?, NOW(), 'pending')", [$taskId, $canonicalId, $matchType, $fields, $auditedBy]) !== false;
    }

    // V9: WORKFLOW

    public function submitForVerification(int $taskId, int $submittedBy, ?string $note = null): bool {
        $task = $this->findById($taskId);
        if (!$task || !empty($task['submitted_at'])) return false;
        $ok = $this->db->update("UPDATE tasks SET submitted_at = NOW(), submitted_by = ?, status = 'review' WHERE id = ? AND submitted_at IS NULL", [$submittedBy, $taskId]) !== false;
        if ($ok) $this->logWorkflowAction($taskId, 'submit', $submittedBy, $note);
        return $ok;
    }

    public function markChecked(int $taskId, int $checkedBy, ?string $note = null): bool {
        $task = $this->findById($taskId);
        if (!$task || empty($task['submitted_at']) || !empty($task['checked_at'])) return false;
        $ok = $this->db->update("UPDATE tasks SET checked_at = NOW(), checked_by = ? WHERE id = ? AND checked_at IS NULL", [$checkedBy, $taskId]) !== false;
        if ($ok) $this->logWorkflowAction($taskId, 'check', $checkedBy, $note);
        return $ok;
    }

    public function acceptWorkflow(int $taskId, int $acceptedBy, ?string $note = null): bool {
        $task = $this->findById($taskId);
        if (!$task || empty($task['submitted_at'])) return false;
        $ok = $this->db->update("UPDATE tasks SET accepted_workflow_at = NOW(), accepted_workflow_by = ?, status = 'done', is_completed = 1, completed_at = NOW() WHERE id = ?", [$acceptedBy, $taskId]) !== false;
        if ($ok) $this->logWorkflowAction($taskId, 'accept', $acceptedBy, $note);
        return $ok;
    }

    public function rejectWorkflow(int $taskId, int $rejectedBy, string $reason): bool {
        $task = $this->findById($taskId);
        if (!$task || empty($task['submitted_at'])) return false;
        $ok = $this->db->update("UPDATE tasks SET rejected_at = NOW(), rejected_by = ?, rejection_reason = ?, status = 'todo' WHERE id = ?", [$rejectedBy, $reason, $taskId]) !== false;
        if ($ok) $this->logWorkflowAction($taskId, 'reject', $rejectedBy, $reason);
        return $ok;
    }

    public function reopenWorkflow(int $taskId, int $reopenedBy): bool {
        $ok = $this->db->update("UPDATE tasks SET submitted_at = NULL, submitted_by = NULL, checked_at = NULL, checked_by = NULL, accepted_workflow_at = NULL, accepted_workflow_by = NULL, rejected_at = NULL, rejected_by = NULL, rejection_reason = NULL, status = 'in_progress' WHERE id = ?", [$taskId]) !== false;
        if ($ok) $this->logWorkflowAction($taskId, 'reopen', $reopenedBy, null);
        return $ok;
    }

    public function getWorkflowHistory(int $taskId): array {
        if (!$this->db->tableExists('task_bill_audit_log')) return [];
        return $this->db->fetchAll("SELECT l.*, u.name as actor_name FROM task_bill_audit_log l LEFT JOIN users u ON l.actor_id = u.id WHERE l.task_id = ? ORDER BY l.created_at ASC", [$taskId]);
    }

    public function getByWorkflowStage(string $stage, ?int $storeId = null, int $limit = 100): array {
        $conditions = ["t.submitted_at IS NOT NULL"];
        $params = [];
        switch ($stage) {
            case 'submitted': $conditions[] = "t.checked_at IS NULL AND t.rejected_at IS NULL"; break;
            case 'checking': $conditions[] = "t.checked_at IS NOT NULL AND t.accepted_workflow_at IS NULL AND t.rejected_at IS NULL"; break;
            case 'accepted': $conditions[] = "t.accepted_workflow_at IS NOT NULL"; break;
            case 'rejected': $conditions[] = "t.rejected_at IS NOT NULL"; break;
        }
        if ($storeId) { $conditions[] = "(t.direct_store_id = ? OR EXISTS (SELECT 1 FROM projects p2 WHERE p2.id = t.project_id AND p2.store_id = ?))"; $params[] = $storeId; $params[] = $storeId; }
        $params[] = $limit;
        return $this->db->fetchAll(
            "SELECT t.*, u.name as assignee_name, c.name as creator_name, s.name as store_name, s.color as store_color
             FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id LEFT JOIN users c ON t.created_by = c.id LEFT JOIN projects p ON t.project_id = p.id LEFT JOIN stores s ON s.id = COALESCE(t.direct_store_id, p.store_id)
             WHERE " . implode(' AND ', $conditions) . " ORDER BY t.submitted_at ASC LIMIT ?", $params
        );
    }

    private function logWorkflowAction(int $taskId, string $action, int $actorId, ?string $note): void {
        if (!$this->db->tableExists('task_bill_audit_log')) return;
        try {
            $this->db->insert("INSERT INTO task_bill_audit_log (task_id, action, actor_id, note) VALUES (?, ?, ?, ?)", [$taskId, $action, $actorId, $note]);
        } catch (Exception $e) {
            error_log("[Task Workflow] Audit log failed: " . $e->getMessage());
        }
    }

    // ── APPROVAL WORKFLOW (Phase: Task Approval Chain) ────────────────────────

    /**
     * Ensure task_approval_events table exists (auto-migrate).
     */
    private function ensureApprovalSchema(): void {
        if (!$this->db->tableExists('task_approval_events')) {
            $migFile = __DIR__ . '/../database/migrations/2026_06_02_task_approval_workflow.sql';
            if (file_exists($migFile)) {
                try {
                    foreach (array_filter(array_map('trim', explode(';', file_get_contents($migFile)))) as $stmt) {
                        if ($stmt && !str_starts_with(ltrim($stmt), '--')) {
                            $this->db->getConnection()->exec($stmt);
                        }
                    }
                } catch (\Throwable $e) {
                    error_log('[Task::ensureApprovalSchema] ' . $e->getMessage());
                }
            }
        }
    }

    /**
     * Log an approval event to task_approval_events.
     */
    public function logApprovalEvent(
        int $taskId,
        int $actorId,
        string $actionType,
        ?string $fromStatus,
        ?string $toStatus,
        ?string $comment = null,
        bool $isOverride = false
    ): void {
        try {
            $this->db->insert(
                "INSERT INTO task_approval_events
                    (task_id, actor_user_id, action_type, from_status, to_status, comment, is_override)
                 VALUES (?, ?, ?, ?, ?, ?, ?)",
                [$taskId, $actorId, $actionType, $fromStatus, $toStatus, $comment, $isOverride ? 1 : 0]
            );
        } catch (\Throwable $e) {
            error_log('[Task::logApprovalEvent] ' . $e->getMessage());
        }
    }

    /**
     * Get full approval history for a task.
     */
    public function getApprovalHistory(int $taskId): array {
        if (!$this->db->tableExists('task_approval_events')) return [];
        return $this->db->fetchAll(
            "SELECT tae.*, u.name as actor_name, u.role as actor_role
             FROM task_approval_events tae
             LEFT JOIN users u ON tae.actor_user_id = u.id
             WHERE tae.task_id = ?
             ORDER BY tae.created_at ASC",
            [$taskId]
        );
    }

    /**
     * Submit task for review (Assignee action).
     * Transitions: in_progress / review_rejected / acceptance_rejected → pending_review
     */
    public function submitTask(int $taskId, int $submittedBy, ?string $note = null, bool $isOverride = false): bool {
        $task = $this->findById($taskId);
        if (!$task) return false;

        $allowedStatuses = ['in_progress', 'todo', 'review_rejected', 'acceptance_rejected'];
        $fromStatus = $task['status'];

        if (!$isOverride && !in_array($fromStatus, $allowedStatuses)) return false;
        if (!$isOverride && (int)$task['assignee_id'] !== $submittedBy) return false;

        // Auto-set reviewer_due_date on submission if not already set
        $reviewerDueSql = '';
        $reviewerDueParams = [$submittedBy, $taskId];
        if ($this->db->columnExists('tasks', 'reviewer_due_date') && empty($task['reviewer_due_date'])) {
            $taskDue = $task['due_date'] ?? null;
            $defaultDue = date('Y-m-d', strtotime('+3 days'));
            if ($taskDue && substr($taskDue, 0, 10) < $defaultDue) {
                $defaultDue = substr($taskDue, 0, 10);
            }
            $reviewerDueSql = ", reviewer_due_date = ?";
            $reviewerDueParams = [$submittedBy, $defaultDue, $taskId];
        }

        $ok = $this->db->execute(
            "UPDATE tasks SET status = 'pending_review', submitted_at = NOW(), submitted_by = ? {$reviewerDueSql} WHERE id = ?",
            $reviewerDueParams
        ) > 0;

        if ($ok) {
            $this->logApprovalEvent($taskId, $submittedBy, 'submitted', $fromStatus, 'pending_review', $note, $isOverride);
            $this->logWorkflowAction($taskId, 'submit', $submittedBy, $note);
        }
        return $ok;
    }

    /**
     * Reviewer approves the submission.
     * Transitions pending_review to pending_acceptance when an approver exists,
     * otherwise directly to done.
     */
    public function reviewApprove(int $taskId, int $reviewerId, ?string $note = null, bool $isOverride = false): bool {
        $task = $this->findById($taskId);
        if (!$task || $task['status'] !== 'pending_review') return false;
        if (!$isOverride && (int)$task['reviewer_id'] !== $reviewerId) return false;

        $hasApprover = !empty($task['approver_id']);
        if ($hasApprover) {
            $toStatus = 'pending_acceptance';
            $sql = "UPDATE tasks SET status = 'pending_acceptance', checked_at = NOW(), checked_by = ?, review_note = ? WHERE id = ?";
            $params = [$reviewerId, $note, $taskId];
        } else {
            $toStatus = 'done';
            $sets = [
                "status = 'done'",
                "is_completed = 1",
                "completed_at = NOW()",
                "checked_at = NOW()",
                "checked_by = ?",
                "review_note = ?"
            ];
            if ($this->db->columnExists('tasks', 'final_done_at')) {
                $sets[] = "final_done_at = NOW()";
            }
            $sql = "UPDATE tasks SET " . implode(', ', $sets) . " WHERE id = ?";
            $params = [$reviewerId, $note, $taskId];
        }

        $ok = $this->db->execute($sql, $params) > 0;

        if ($ok) {
            $this->logApprovalEvent($taskId, $reviewerId, 'review_approved', 'pending_review', $toStatus, $note, $isOverride);
            $this->logWorkflowAction($taskId, 'check', $reviewerId, $note);
        }
        return $ok;
    }

    /**
     * Reviewer rejects the submission.
     * Transitions: pending_review → review_rejected
     */
    public function reviewReject(int $taskId, int $reviewerId, string $reason, bool $isOverride = false): bool {
        $task = $this->findById($taskId);
        if (!$task || $task['status'] !== 'pending_review') return false;
        if (!$isOverride && (int)$task['reviewer_id'] !== $reviewerId) return false;

        $ok = $this->db->execute(
            "UPDATE tasks SET status = 'review_rejected', rejected_at = NOW(), rejected_by = ?, rejection_reason = ?, review_note = ? WHERE id = ?",
            [$reviewerId, $reason, $reason, $taskId]
        ) > 0;

        if ($ok) {
            $this->logApprovalEvent($taskId, $reviewerId, 'review_rejected', 'pending_review', 'review_rejected', $reason, $isOverride);
            $this->logWorkflowAction($taskId, 'reject', $reviewerId, $reason);
        }
        return $ok;
    }

    /**
     * Approver accepts the reviewed task.
     * Transitions: pending_acceptance → accepted → done
     */
    public function acceptTask(int $taskId, int $approverId, ?string $note = null, bool $isOverride = false): bool {
        $task = $this->findById($taskId);
        if (!$task || $task['status'] !== 'pending_acceptance') return false;
        if (!$isOverride && (int)$task['approver_id'] !== $approverId) return false;

        $sets = [
            "status = 'done'",
            "is_completed = 1",
            "completed_at = NOW()"
        ];
        $params = [];
        if ($this->db->columnExists('tasks', 'accepted_at')) {
            $sets[] = "accepted_at = NOW()";
        }
        if ($this->db->columnExists('tasks', 'accepted_workflow_at')) {
            $sets[] = "accepted_workflow_at = NOW()";
        }
        if ($this->db->columnExists('tasks', 'accepted_workflow_by')) {
            $sets[] = "accepted_workflow_by = ?";
            $params[] = $approverId;
        }
        if ($this->db->columnExists('tasks', 'final_done_at')) {
            $sets[] = "final_done_at = NOW()";
        }
        if ($this->db->columnExists('tasks', 'acceptance_note')) {
            $sets[] = "acceptance_note = ?";
            $params[] = $note;
        }
        $params[] = $taskId;
        $ok = $this->db->execute(
            "UPDATE tasks SET " . implode(', ', $sets) . " WHERE id = ?",
            $params
        ) > 0;

        if ($ok) {
            $this->logApprovalEvent($taskId, $approverId, 'acceptance_approved', 'pending_acceptance', 'done', $note, $isOverride);
            $this->logApprovalEvent($taskId, $approverId, 'marked_done', 'accepted', 'done', $note, $isOverride);
            $this->logWorkflowAction($taskId, 'accept', $approverId, $note);
        }
        return $ok;
    }

    /**
     * Approver rejects the reviewed task.
     * Transitions: pending_acceptance → acceptance_rejected
     */
    public function acceptReject(int $taskId, int $approverId, string $reason, bool $isOverride = false): bool {
        $task = $this->findById($taskId);
        if (!$task || $task['status'] !== 'pending_acceptance') return false;
        if (!$isOverride && (int)$task['approver_id'] !== $approverId) return false;

        $sets = ["status = 'acceptance_rejected'"];
        $params = [];
        if ($this->db->columnExists('tasks', 'rejected_at')) {
            $sets[] = "rejected_at = NOW()";
        }
        if ($this->db->columnExists('tasks', 'rejected_by')) {
            $sets[] = "rejected_by = ?";
            $params[] = $approverId;
        }
        if ($this->db->columnExists('tasks', 'rejection_reason')) {
            $sets[] = "rejection_reason = ?";
            $params[] = $reason;
        }
        if ($this->db->columnExists('tasks', 'acceptance_note')) {
            $sets[] = "acceptance_note = ?";
            $params[] = $reason;
        }
        $params[] = $taskId;
        $ok = $this->db->execute(
            "UPDATE tasks SET " . implode(', ', $sets) . " WHERE id = ?",
            $params
        ) > 0;

        if ($ok) {
            $this->logApprovalEvent($taskId, $approverId, 'acceptance_rejected', 'pending_acceptance', 'acceptance_rejected', $reason, $isOverride);
            $this->logWorkflowAction($taskId, 'reject', $approverId, $reason);
        }
        return $ok;
    }

    /**
     * Reopen a task that's in any approval stage (CEO/Admin override).
     * Clears all approval timestamps.
     */
    public function reopenApproval(int $taskId, int $reopenedBy, ?string $reason = null): bool {
        $task = $this->findById($taskId);
        if (!$task) return false;
        $fromStatus = $task['status'];

        $sets = [
            "status = 'in_progress'",
            "submitted_at = NULL",
            "is_completed = 0",
            "completed_at = NULL"
        ];
        foreach (['submitted_by','checked_at','checked_by','accepted_workflow_at','accepted_workflow_by','rejected_at','rejected_by','rejection_reason','final_done_at','review_note','acceptance_note','reviewed_at','accepted_at'] as $col) {
            if ($this->db->columnExists('tasks', $col)) {
                $sets[] = "$col = NULL";
            }
        }
        $ok = $this->db->execute(
            "UPDATE tasks SET " . implode(', ', $sets) . " WHERE id = ?",
            [$taskId]
        ) > 0;

        if ($ok) {
            $this->logApprovalEvent($taskId, $reopenedBy, 'reopened', $fromStatus, 'in_progress', $reason, true);
            $this->logWorkflowAction($taskId, 'reopen', $reopenedBy, $reason);
        }
        return $ok;
    }

    /**
     * Get tasks where the given user is the reviewer AND status = pending_review.
     */
    public function getPendingReviewForUser(int $reviewerId): array {
        return $this->db->fetchAll(
            "SELECT t.*, u.name as assignee_name, p.name as project_name
             FROM tasks t
             LEFT JOIN users u ON t.assignee_id = u.id
             LEFT JOIN projects p ON t.project_id = p.id
             WHERE t.reviewer_id = ? AND t.status = 'pending_review' AND t.is_completed = 0
             ORDER BY t.submitted_at ASC",
            [$reviewerId]
        );
    }

    /**
     * Get tasks where the given user is the approver AND status = pending_acceptance.
     */
    public function getPendingAcceptanceForUser(int $approverId): array {
        return $this->db->fetchAll(
            "SELECT t.*, u.name as assignee_name, r.name as reviewer_name, p.name as project_name
             FROM tasks t
             LEFT JOIN users u ON t.assignee_id = u.id
             LEFT JOIN users r ON t.reviewer_id = r.id
             LEFT JOIN projects p ON t.project_id = p.id
             WHERE t.approver_id = ? AND t.status = 'pending_acceptance' AND t.is_completed = 0
             ORDER BY t.checked_at ASC",
            [$approverId]
        );
    }

    /**
     * Determine the current approval stage label and who acts next.
     */
    public function getApprovalStageInfo(array $task): array {
        $status = $task['status'] ?? '';
        $stages = [
            'in_progress'          => ['stage' => 'In Progress',         'next_actor' => 'assignee',  'label' => 'Assignee working'],
            'pending_review'       => ['stage' => 'Pending Review',      'next_actor' => 'reviewer',  'label' => 'Waiting for Reviewer'],
            'review_rejected'      => ['stage' => 'Review Rejected',     'next_actor' => 'assignee',  'label' => 'Returned to Assignee'],
            'pending_acceptance'   => ['stage' => 'Pending Acceptance',  'next_actor' => 'approver',  'label' => 'Waiting for Approver'],
            'acceptance_rejected'  => ['stage' => 'Acceptance Rejected', 'next_actor' => 'assignee',  'label' => 'Returned to Assignee'],
            'accepted'             => ['stage' => 'Accepted',            'next_actor' => 'none',      'label' => 'Task Accepted'],
            'done'                 => ['stage' => 'Done',                'next_actor' => 'none',      'label' => 'Task Complete'],
        ];
        return $stages[$status] ?? ['stage' => ucfirst($status), 'next_actor' => 'unknown', 'label' => ucfirst($status)];
    }

}
