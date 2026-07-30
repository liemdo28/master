<?php
/**
 * TaskStore — pivot model for task ↔ store many-to-many relation.
 *
 * Table: task_stores
 *   id, task_id, store_id, created_at
 */
class TaskStore {
    private $db;

    public function __construct() {
        $this->db = Database::getInstance();
        $this->ensureSchema();
    }

    private function ensureSchema(): void {
        try {
            if (!$this->db->tableExists('task_stores')) {
                $this->db->execute("
                    CREATE TABLE task_stores (
                        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                        task_id INT NOT NULL,
                        store_id INT NOT NULL,
                        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        CONSTRAINT uq_task_stores_task_store UNIQUE (task_id, store_id),
                        INDEX idx_task_stores_task_id (task_id),
                        INDEX idx_task_stores_store_id (store_id)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                ");
                $this->db->invalidateSchemaCache();
            }
        } catch (\Throwable $e) {}

        try {
            if (!$this->db->tableExists('task_store_audit_logs')) {
                $this->db->execute("
                    CREATE TABLE task_store_audit_logs (
                        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                        task_id INT NOT NULL,
                        actor_id INT NOT NULL,
                        old_store_ids TEXT NULL,
                        new_store_ids TEXT NULL,
                        changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        INDEX idx_tsau_task (task_id),
                        INDEX idx_tsau_actor (actor_id)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                ");
                $this->db->invalidateSchemaCache();
            }
        } catch (\Throwable $e) {}
    }

    /** Get all stores linked to a task. Returns [{id, name, color}, ...] */
    public function getForTask(int $taskId): array {
        return $this->db->fetchAll(
            "SELECT s.id, s.name, s.color
             FROM task_stores ts
             JOIN stores s ON ts.store_id = s.id
             WHERE ts.task_id = ?
             ORDER BY s.name ASC",
            [$taskId]
        ) ?: [];
    }

    /** Get raw store IDs linked to a task */
    public function getStoreIdsForTask(int $taskId): array {
        $rows = $this->db->fetchAll(
            "SELECT store_id FROM task_stores WHERE task_id = ?",
            [$taskId]
        );
        return array_column($rows ?? [], 'store_id');
    }

    /** Get all tasks linked to a specific store */
    public function getTaskIdsForStore(int $storeId): array {
        $rows = $this->db->fetchAll(
            "SELECT task_id FROM task_stores WHERE store_id = ?",
            [$storeId]
        );
        return array_column($rows ?? [], 'task_id');
    }

    /** Replace all store links for a task (atomic sync) */
    public function sync(int $taskId, array $storeIds, int $actorId): void {
        $oldIds = $this->getStoreIdsForTask($taskId);
        sort($oldIds);
        sort($storeIds);

        if ($oldIds === $storeIds) return; // no change

        // Audit
        $this->logAudit($taskId, $actorId, $oldIds, $storeIds);

        // Delete all existing links for this task
        $this->db->execute("DELETE FROM task_stores WHERE task_id = ?", [$taskId]);

        // Insert new links
        foreach ($storeIds as $sid) {
            try {
                $this->db->execute(
                    "INSERT IGNORE INTO task_stores (task_id, store_id) VALUES (?, ?)",
                    [$taskId, $sid]
                );
            } catch (\Throwable $e) {}
        }
    }

    /** Log a store-assignment change */
    private function logAudit(int $taskId, int $actorId, array $oldIds, array $newIds): void {
        try {
            $this->db->execute(
                "INSERT INTO task_store_audit_logs (task_id, actor_id, old_store_ids, new_store_ids)
                 VALUES (?, ?, ?, ?)",
                [$taskId, $actorId, json_encode($oldIds), json_encode($newIds)]
            );
        } catch (\Throwable $e) {}
    }

    /** Get audit history for a task */
    public function getAuditForTask(int $taskId): array {
        return $this->db->fetchAll(
            "SELECT al.*, u.name as actor_name
             FROM task_store_audit_logs al
             JOIN users u ON al.actor_id = u.id
             WHERE al.task_id = ?
             ORDER BY al.changed_at DESC",
            [$taskId]
        ) ?: [];
    }
}
