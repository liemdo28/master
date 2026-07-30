<?php
class DeadlineExtensionAuditLog {
    private $db;

    public function __construct() {
        $this->db = Database::getInstance();
    }

    public function log(array $data): void {
        try {
            $this->db->execute(
                "INSERT INTO deadline_extension_audit_logs (extension_id, task_id, actor_id, action, old_status, new_status, note)
                 VALUES (?,?,?,?,?,?,?)",
                [
                    $data['extension_id'],
                    $data['task_id'],
                    $data['actor_id'],
                    $data['action'],
                    $data['old_status'] ?? null,
                    $data['new_status'] ?? null,
                    $data['note'] ?? null,
                ]
            );
        } catch (\Throwable $e) {}
    }

    public function getByExtension(int $extensionId): array {
        return $this->db->fetchAll(
            "SELECT al.*, u.name as actor_name, u.avatar as actor_avatar
             FROM deadline_extension_audit_logs al
             JOIN users u ON al.actor_id = u.id
             WHERE al.extension_id = ?
             ORDER BY al.created_at ASC",
            [$extensionId]
        );
    }

    public function getByTask(int $taskId): array {
        return $this->db->fetchAll(
            "SELECT al.*, u.name as actor_name
             FROM deadline_extension_audit_logs al
             JOIN users u ON al.actor_id = u.id
             WHERE al.task_id = ?
             ORDER BY al.created_at DESC",
            [$taskId]
        );
    }
}
