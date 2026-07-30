<?php
/**
 * TaskStoreService — orchestrates task ↔ store many-to-many relations.
 *
 * Responsibilities:
 *  - validate store IDs (exist + active)
 *  - deduplicate
 *  - sync pivot table
 *  - retrieval with eager-loading helpers
 */
class TaskStoreService {
    private TaskStore $pivotModel;

    public function __construct() {
        $this->pivotModel = new TaskStore();
    }

    /**
     * Validate an array of store IDs.
     * Returns array of error strings (empty = valid).
     */
    public function validate(array $storeIds): array {
        if (empty($storeIds)) return [];
        $db = Database::getInstance();

        $errors = [];
        foreach ($storeIds as $sid) {
            if (!is_numeric($sid) || (int)$sid <= 0) {
                $errors[] = "Invalid store ID: " . htmlspecialchars((string)$sid);
                continue;
            }
            $row = $db->fetch("SELECT id, is_active FROM stores WHERE id = ?", [(int)$sid]);
            if (!$row) {
                $errors[] = "Store ID {$sid} does not exist.";
            } elseif (isset($row['is_active']) && !$row['is_active']) {
                $errors[] = "Store ID {$sid} is not active.";
            }
        }
        return $errors;
    }

    /**
     * Sanitize: cast to int, deduplicate, remove zeros.
     */
    public function sanitize(array $storeIds): array {
        $ids = array_map('intval', $storeIds);
        $ids = array_filter($ids, fn($id) => $id > 0);
        return array_values(array_unique($ids));
    }

    /**
     * Sync store links for a task. Validates, deduplicates, then syncs.
     * Throws \RuntimeException on validation failure.
     *
     * @param int   $taskId
     * @param array $storeIds   raw store IDs from request (may have dupes, strings)
     * @param int   $actorId    user performing the action (for audit)
     */
    public function sync(int $taskId, array $storeIds, int $actorId): void {
        $clean  = $this->sanitize($storeIds);
        $errors = $this->validate($clean);
        if ($errors) {
            throw new \RuntimeException(implode(' ', $errors));
        }
        $this->pivotModel->sync($taskId, $clean, $actorId);

        // Keep tasks.direct_store_id in sync with the pivot. Task::resolveStoreId()
        // and the COALESCE(direct_store_id, project.store_id) pattern used across
        // the dashboards only ever consult direct_store_id — without this, that
        // column stays NULL forever and every one of those queries silently falls
        // back to the task's project store instead of the store actually picked here.
        // Only unambiguous when exactly one store is selected; NULL (fall back to
        // project store) when 0 or 2+ stores are linked.
        $resolvedStoreId = count($clean) === 1 ? $clean[0] : null;
        Database::getInstance()->execute(
            "UPDATE tasks SET direct_store_id = ? WHERE id = ?",
            [$resolvedStoreId, $taskId]
        );
    }

    /**
     * Get stores for a task. Returns [{id, name, color}, ...].
     * Returns empty array if task has no stores.
     */
    public function getForTask(int $taskId): array {
        return $this->pivotModel->getForTask($taskId);
    }

    /**
     * Eager-load stores for multiple tasks in a single query.
     * Returns [task_id => [{id, name, color}, ...], ...]
     *
     * @param int[] $taskIds
     */
    public function getForTasks(array $taskIds): array {
        if (empty($taskIds)) return [];
        $db = Database::getInstance();

        $placeholders = implode(',', array_fill(0, count($taskIds), '?'));
        $rows = $db->fetchAll(
            "SELECT ts.task_id, s.id, s.name, s.color
             FROM task_stores ts
             JOIN stores s ON ts.store_id = s.id
             WHERE ts.task_id IN ({$placeholders})
             ORDER BY s.name ASC",
            $taskIds
        ) ?: [];

        $map = [];
        foreach ($rows as $row) {
            $tid = (int)$row['task_id'];
            if (!isset($map[$tid])) $map[$tid] = [];
            $map[$tid][] = ['id' => (int)$row['id'], 'name' => $row['name'], 'color' => $row['color'] ?? null];
        }
        return $map;
    }

    /**
     * Get raw store IDs for a task.
     */
    public function getStoreIds(int $taskId): array {
        return $this->pivotModel->getStoreIdsForTask($taskId);
    }
}
