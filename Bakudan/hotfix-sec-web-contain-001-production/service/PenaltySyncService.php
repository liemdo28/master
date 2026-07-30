<?php
/**
 * PenaltySyncService — stub for future penalty integration.
 * Marks tasks that go overdue without approved extension.
 */
class PenaltySyncService {
    /**
     * Scan for overdue tasks that have no approved extension and flag them.
     * Currently a stub — penalty table not yet implemented.
     */
    public function syncOverduePenalties(): array {
        $db    = Database::getInstance();
        $today = function_exists('app_today') ? app_today() : date('Y-m-d');

        // Tasks that are overdue, not completed, and have no approved/auto_approved extension
        $rows = $db->fetchAll(
            "SELECT t.id, t.title, t.assignee_id, t.due_date
             FROM tasks t
             WHERE t.due_date < ?
               AND t.is_completed = 0
               AND NOT EXISTS (
                   SELECT 1 FROM deadline_extensions de
                   WHERE de.task_id = t.id
                     AND de.status IN ('approved','auto_approved')
                     AND de.requested_due_date >= ?
               )
             LIMIT 200",
            [$today, $today]
        );

        // Future: INSERT INTO task_penalties ...
        return ['synced' => count($rows), 'tasks' => array_column($rows, 'id')];
    }
}
