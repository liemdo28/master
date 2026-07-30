<?php
/**
 * Keeps reviewer assignments visible as normal tasks for the reviewer.
 *
 * A review child is intentionally a regular task so it appears in My Day,
 * calendar, overdue, and assignee workload views. Completing that child is
 * handled by TaskCompletionService as reviewer approval for the parent task.
 */
class TaskReviewService
{
    private Task $taskModel;
    private Database $db;

    public function __construct(?Task $taskModel = null)
    {
        $this->taskModel = $taskModel ?: new Task();
        $this->db = Database::getInstance();
    }

    public function syncForTask(int $parentTaskId, ?int $actorUserId = null): ?int
    {
        $parent = $this->taskModel->findById($parentTaskId);
        if (!$parent || !$this->supportsReviewChildren()) {
            return null;
        }

        $reviewerId = !empty($parent['reviewer_id']) ? (int)$parent['reviewer_id'] : 0;
        if ($reviewerId <= 0) {
            $this->cancelOpenReviewChildren($parentTaskId);
            return null;
        }

        $dueDate = $this->reviewDueDate($parent);
        $title = 'Review: ' . ($parent['title'] ?? ('Task #' . $parentTaskId));
        $description = $this->buildDescription($parent);
        $existing = $this->findOpenReviewChild($parentTaskId);

        $payload = [
            'title' => $title,
            'description' => $description,
            'assignee_id' => $reviewerId,
            'priority' => $parent['priority'] ?? 'medium',
            'status' => 'todo',
            'due_date' => $dueDate,
            'visibility' => $parent['visibility'] ?? 'private',
            'private_by_user_id' => $parent['private_by_user_id'] ?? ($parent['created_by'] ?? $actorUserId),
            'task_category' => 'review',
        ];

        if ($existing) {
            $this->taskModel->update((int)$existing['id'], $payload);
            $reviewTaskId = (int)$existing['id'];
        } else {
            $payload += [
                'project_id' => $parent['project_id'] ?? null,
                'section_id' => $parent['section_id'] ?? null,
                'start_date' => null,
                'created_by' => $actorUserId ?: ($parent['created_by'] ?? null),
                'repeat_type' => 'none',
                'repeat_config' => null,
                'parent_task_id' => $parentTaskId,
            ];
            $reviewTaskId = (int)$this->taskModel->create($payload);
            if ($reviewTaskId > 0) {
                $this->taskModel->update($reviewTaskId, $payload);
            }
        }

        if ($reviewTaskId > 0) {
            $this->copyStore($parent, $reviewTaskId, $actorUserId);
            $this->taskModel->addWatcher($reviewTaskId, $reviewerId);
            if (!empty($parent['created_by'])) {
                $this->taskModel->addWatcher($reviewTaskId, (int)$parent['created_by']);
            }
            $this->notifyReviewer($reviewerId, $reviewTaskId, $parent, $actorUserId);
            return $reviewTaskId;
        }

        return null;
    }

    public function isReviewChild(array $task): bool
    {
        return !empty($task['parent_task_id']) && (($task['task_category'] ?? '') === 'review');
    }

    public function reviewDueDate(array $parent): ?string
    {
        if (!empty($parent['reviewer_due_date'])) {
            return substr((string)$parent['reviewer_due_date'], 0, 10);
        }
        if (!empty($parent['due_date'])) {
            return substr((string)$parent['due_date'], 0, 10);
        }
        return date('Y-m-d', strtotime('+3 days'));
    }

    private function supportsReviewChildren(): bool
    {
        return $this->db->columnExists('tasks', 'parent_task_id')
            && $this->db->columnExists('tasks', 'task_category');
    }

    private function findOpenReviewChild(int $parentTaskId): ?array
    {
        return $this->db->fetch(
            "SELECT * FROM tasks
             WHERE parent_task_id = ?
               AND task_category = 'review'
               AND is_completed = 0
             ORDER BY id DESC
             LIMIT 1",
            [$parentTaskId]
        ) ?: null;
    }

    private function cancelOpenReviewChildren(int $parentTaskId): void
    {
        try {
            $this->db->execute(
                "UPDATE tasks
                 SET status = 'cancelled', is_completed = 1, completed_at = NOW(), updated_at = NOW()
                 WHERE parent_task_id = ?
                   AND task_category = 'review'
                   AND is_completed = 0",
                [$parentTaskId]
            );
        } catch (\Throwable $e) {
            error_log('[TaskReviewService] cancelOpenReviewChildren failed: ' . $e->getMessage());
        }
    }

    private function buildDescription(array $parent): string
    {
        $lines = [
            'Review task for: ' . ($parent['title'] ?? ('Task #' . ($parent['id'] ?? ''))),
            'Original task: /tasks/' . (int)($parent['id'] ?? 0),
        ];

        if (!empty($parent['review_instructions'])) {
            $lines[] = '';
            $lines[] = 'Reviewer instructions:';
            $lines[] = trim((string)$parent['review_instructions']);
        }

        if (!empty($parent['description'])) {
            $lines[] = '';
            $lines[] = 'Original description:';
            $lines[] = trim((string)$parent['description']);
        }

        return implode("\n", $lines);
    }

    private function copyStore(array $parent, int $reviewTaskId, ?int $actorUserId): void
    {
        $storeId = !empty($parent['direct_store_id']) ? (int)$parent['direct_store_id'] : 0;
        if ($storeId <= 0 && !empty($parent['project_id'])) {
            $project = (new Project())->findById((int)$parent['project_id']);
            $storeId = !empty($project['store_id']) ? (int)$project['store_id'] : 0;
        }
        if ($storeId <= 0) {
            return;
        }

        try {
            if (class_exists('TaskStoreService')) {
                (new TaskStoreService())->sync($reviewTaskId, [$storeId], $actorUserId ?: 0);
            } else {
                $this->taskModel->update($reviewTaskId, ['direct_store_id' => $storeId]);
            }
        } catch (\Throwable $e) {
            error_log('[TaskReviewService] copyStore failed: ' . $e->getMessage());
        }
    }

    private function notifyReviewer(int $reviewerId, int $reviewTaskId, array $parent, ?int $actorUserId): void
    {
        if (!function_exists('notifyUser')) {
            return;
        }
        try {
            notifyUser([
                'user_id' => $reviewerId,
                'type' => 'task_review_assigned',
                'title' => 'Review task assigned',
                'message' => $parent['title'] ?? 'Task review',
                'task_id' => $reviewTaskId,
                'project_id' => $parent['project_id'] ?? null,
                'from_user_id' => $actorUserId,
                'deep_link' => '/tasks/' . $reviewTaskId,
            ]);
        } catch (\Throwable $e) {
            error_log('[TaskReviewService] notifyReviewer failed: ' . $e->getMessage());
        }
    }
}
