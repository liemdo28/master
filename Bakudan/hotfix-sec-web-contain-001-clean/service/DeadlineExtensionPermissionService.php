<?php
class DeadlineExtensionPermissionService {

    /**
     * Can this user request a deadline extension for this task?
     */
    public function canRequest(array $task, int $userId, bool $isPriv): bool {
        if ($isPriv) return true;
        // Must be assignee or creator
        return (int)($task['assignee_id'] ?? 0) === $userId
            || (int)($task['created_by'] ?? 0) === $userId;
    }

    /**
     * Is this a self-approvable (T+3) extension?
     * Self-approved if: user is assignee/creator, due date is within 0-3 days from today.
     */
    public function isSelfApprovable(array $task, string $requestedDue, int $userId, bool $isPriv): bool {
        if ($isPriv) return false; // admins always go through approval
        $today = function_exists('app_today') ? app_today() : date('Y-m-d');
        $currentDue = $task['due_date'] ?? '';
        if (!$currentDue) return false;
        $daysUntilDue = (int)((strtotime($currentDue) - strtotime($today)) / 86400);
        // T+3: due date is today or within 3 days (inclusive)
        return $daysUntilDue >= 0 && $daysUntilDue <= 3;
    }

    /**
     * Can user approve/reject a given extension request?
     */
    public function canReview(int $userId, bool $isPriv): bool {
        return $isPriv;
    }
}
