<?php
class TelegramNotificationLog {
    private $db;

    public function __construct() {
        $this->db = Database::getInstance();
    }

    public function create(array $data): int {
        return (int)$this->db->insert(
            "INSERT INTO telegram_notification_logs
             (user_id, telegram_chat_id, event_type, related_entity_type, related_entity_id, payload, status)
             VALUES (?, ?, ?, ?, ?, ?, 'pending')",
            [
                $data['user_id']              ?? null,
                $data['telegram_chat_id'],
                $data['event_type'],
                $data['related_entity_type']  ?? null,
                $data['related_entity_id']    ?? null,
                isset($data['payload']) ? json_encode($data['payload']) : null,
            ]
        );
    }

    public function markSent(int $id, array $response): void {
        $this->db->execute(
            "UPDATE telegram_notification_logs
             SET status='sent', sent_at=NOW(), response_payload=? WHERE id=?",
            [json_encode($response), $id]
        );
    }

    public function markFailed(int $id, string $error): void {
        $this->db->execute(
            "UPDATE telegram_notification_logs
             SET status='failed', error_message=? WHERE id=?",
            [$error, $id]
        );
    }

    /** Get failed notifications (for retry) */
    public function getFailed(int $limit = 50): array {
        return $this->db->fetchAll(
            "SELECT * FROM telegram_notification_logs
             WHERE status='failed'
             ORDER BY created_at DESC LIMIT ?",
            [$limit]
        ) ?: [];
    }
}
