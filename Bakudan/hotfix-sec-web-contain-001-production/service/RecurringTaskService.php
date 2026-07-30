<?php
/**
 * RecurringTaskService — thin wrapper around Task model's recurrence engine.
 *
 * CONSOLIDATED: All recurrence logic now lives in Task::createNextRecurringOccurrence().
 * This service exists as a facade for:
 *   - TaskCompletionService (which calls generateNextOccurrence)
 *   - index.php recurrence-preview endpoint (which calls computeNextDueDate/shouldContinue)
 *   - Cron/notification scripts
 *
 * Supports repeat_type: none, daily, weekly, monthly, yearly
 */
class RecurringTaskService
{
    /** @var Task */
    private $taskModel;

    public function __construct(?Task $taskModel = null)
    {
        $this->taskModel = $taskModel ?: new Task();
    }

    /**
     * Generate the next occurrence for a completed recurring task.
     * Delegates to Task model's consolidated engine.
     * Returns the new task id, or null if recurrence has ended / not applicable.
     */
    public function generateNextOccurrence(int $taskId): ?int
    {
        try {
            return $this->taskModel->createNextRecurringOccurrence($taskId);
        } catch (Exception $e) {
            error_log("[RecurringTaskService] generateNextOccurrence failed for task $taskId: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Pure function: compute next due date from the given task row.
     * Used by recurrence-preview endpoint.
     */
    public function computeNextDueDate(array $task): ?string
    {
        $type = $task['repeat_type'] ?? 'none';
        if ($type === 'none' || empty($task['due_date'])) return null;

        // Delegate to Task model's public method
        return $this->taskModel->nextOccurrenceDueDateFrom($task, $task['due_date']);
    }

    /**
     * Compute the next due date from an explicit anchor date.
     * Used by completion-date recurrence tests and preview endpoints.
     */
    public function computeNextDueDateFrom(array $task, string $baseDate): ?string
    {
        $type = $task['repeat_type'] ?? 'none';
        if ($type === 'none' || $baseDate === '') return null;

        return $this->taskModel->nextOccurrenceDueDateFrom($task, $baseDate);
    }

    /**
     * Check end rules — whether recurrence should continue.
     * Used by recurrence-preview endpoint.
     */
    public function shouldContinue(array $task): bool
    {
        $endType = $task['repeat_end_type'] ?? 'never';
        if ($endType === 'never') return true;

        if ($endType === 'date') {
            $endDate = $task['repeat_end_date'] ?? null;
            if (!$endDate) return true;
            $next = $this->computeNextDueDate($task);
            return $next && $next <= $endDate;
        }

        if ($endType === 'count') {
            $max = (int)($task['repeat_end_count'] ?? 0);
            if ($max <= 0) return true;
            $current = (int)($task['occurrence_index'] ?? 0);
            return ($current + 1) < $max;
        }

        return true;
    }
}
