<?php
/**
 * TaskCompletionService — single orchestrator for task completion side effects.
 *
 * Responsibilities:
 *  1. Toggle completion state via Task::toggleComplete()
 *  2. Generate next recurring occurrence (single path — no double-fire)
 *  3. Notify watchers
 *
 * IMPORTANT: Task::toggleComplete() does NOT trigger recurrence generation.
 * Only this service does. This prevents double-generation when both are called.
 */
class TaskCompletionService
{
    /** @var Task */
    private $taskModel;

    public function __construct(?Task $taskModel = null, ?RecurringTaskService $recurring = null)
    {
        $this->taskModel = $taskModel ?: new Task();
        // $recurring param kept for backward compat but not used — we delegate to Task model directly
    }

    /**
     * Complete (or reopen) a task and handle all side effects.
     * @return array{completed:bool, next_task_id:?int}
     */
    public function complete(int $taskId, ?int $actorUserId = null): array
    {
        $task = $this->taskModel->findById($taskId);
        if (!$task) return ['completed' => false, 'next_task_id' => null];

        $wasIncomplete = empty($task['is_completed']);
        $reviewService = class_exists('TaskReviewService') ? new TaskReviewService($this->taskModel) : null;

        if ($wasIncomplete && $reviewService && $reviewService->isReviewChild($task)) {
            $this->taskModel->toggleComplete($taskId);
            $parentId = (int)$task['parent_task_id'];
            $parent = $this->taskModel->findById($parentId);

            if ($parent && empty($parent['is_completed'])) {
                if (($parent['status'] ?? '') !== 'pending_review') {
                    $this->taskModel->submitTask($parentId, $actorUserId ?: (int)($parent['assignee_id'] ?? 0), 'Submitted by reviewer task completion', true);
                }
                $this->taskModel->reviewApprove($parentId, $actorUserId ?: (int)($parent['reviewer_id'] ?? 0), 'Reviewer task completed', true);
            }

            ProductionLogger::info('TASK_REVIEW_COMPLETE', 'Review child task completed', [
                'task_id' => $taskId,
                'parent_task_id' => $parentId,
                'actor_user_id' => $actorUserId,
            ]);

            return [
                'completed' => true,
                'next_task_id' => null,
                'review_parent_id' => $parentId,
            ];
        }

        if ($wasIncomplete && !empty($task['reviewer_id'])) {
            $this->taskModel->submitTask($taskId, $actorUserId ?: (int)($task['assignee_id'] ?? 0), 'Submitted for reviewer completion', true);
            $reviewTaskId = $reviewService ? $reviewService->syncForTask($taskId, $actorUserId) : null;

            ProductionLogger::info('TASK_REVIEW_REQUIRED', 'Task completion converted to review request', [
                'task_id' => $taskId,
                'review_task_id' => $reviewTaskId,
                'actor_user_id' => $actorUserId,
            ]);

            return [
                'completed' => false,
                'next_task_id' => null,
                'pending_review' => true,
                'review_task_id' => $reviewTaskId,
            ];
        }

        // Step 1: Toggle the completion state (does NOT trigger recurrence)
        $this->taskModel->toggleComplete($taskId);

        ProductionLogger::info('TASK_COMPLETE', $wasIncomplete ? 'Task completed' : 'Task reopened', [
            'task_id' => $taskId,
            'actor_user_id' => $actorUserId,
            'title' => $task['title'] ?? null,
        ]);

        // Step 2: Generate next recurring occurrence (only if completing, not reopening)
        // Guard: skip if this task already has an open (incomplete) child — prevents
        // duplicate generation on reopen→recomplete cycles.
        $nextId = null;
        if ($wasIncomplete && ($task['repeat_type'] ?? 'none') !== 'none') {
            $useCompletionDate = ($task['repeat_from_mode'] ?? 'due_date') === 'completion_date';
            $children = $this->taskModel->getChildren($taskId);
            $hasOpenChild = false;
            foreach ($children as $child) {
                if (empty($child['is_completed'])) { $hasOpenChild = true; break; }
            }
            if ($hasOpenChild) {
                ProductionLogger::info('RECURRENCE', 'Skipped recurrence — open child already exists', [
                    'task_id' => $taskId,
                ]);
            } else {
                $nextId = $this->taskModel->createNextRecurringOccurrence($taskId, $useCompletionDate);
                ProductionLogger::info('RECURRENCE', 'Recurrence generation triggered', [
                    'task_id' => $taskId,
                    'next_task_id' => $nextId,
                    'repeat_type' => $task['repeat_type'],
                    'use_completion_date' => $useCompletionDate,
                ]);
            }
        }

        // Step 3: Notify watchers (best-effort)
        if ($wasIncomplete && function_exists('notifyUser')) {
            try {
                $watchers = $this->taskModel->getWatchers($taskId);
                foreach ($watchers as $w) {
                    if ($actorUserId && (int)$w['id'] === (int)$actorUserId) continue;
                    notifyUser([
                        'user_id' => $w['id'],
                        'type'    => 'task_completed',
                        'title'   => 'Task completed',
                        'message' => ($task['title'] ?? 'Task') . ' marked complete',
                        'link'    => '/tasks/' . $taskId,
                    ]);
                }
            } catch (Exception $e) { /* best-effort */ }
        }

        return ['completed' => $wasIncomplete, 'next_task_id' => $nextId];
    }
}
