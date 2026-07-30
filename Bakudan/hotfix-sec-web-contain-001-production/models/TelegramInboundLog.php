<?php
class TelegramInboundLog {
    private $db;

    public function __construct() {
        $this->db = Database::getInstance();
    }

    public function create(array $data): int {
        return (int)$this->db->insert(
            "INSERT INTO telegram_inbound_logs
             (telegram_chat_id, telegram_user_id, dashboard_user_id, raw_message, parsed_intent, parsed_payload)
             VALUES (?, ?, ?, ?, ?, ?)",
            [
                $data['telegram_chat_id'],
                $data['telegram_user_id']   ?? null,
                $data['dashboard_user_id']  ?? null,
                $data['raw_message'],
                $data['parsed_intent']      ?? null,
                isset($data['parsed_payload']) ? json_encode($data['parsed_payload']) : null,
            ]
        );
    }

    public function markProcessed(int $id, string $intent, ?array $payload = null): void {
        $this->db->execute(
            "UPDATE telegram_inbound_logs
             SET processing_status='processed', parsed_intent=?, parsed_payload=?, processed_at=NOW()
             WHERE id=?",
            [$intent, $payload ? json_encode($payload) : null, $id]
        );
    }

    public function markFailed(int $id, string $error): void {
        $this->db->execute(
            "UPDATE telegram_inbound_logs
             SET processing_status='failed', error_message=?, processed_at=NOW()
             WHERE id=?",
            [$error, $id]
        );
    }

    public function getRecent(int $limit = 50): array {
        return $this->db->fetchAll(
            "SELECT til.*, u.name AS user_name
             FROM telegram_inbound_logs til
             LEFT JOIN users u ON til.dashboard_user_id = u.id
             ORDER BY til.created_at DESC LIMIT ?",
            [$limit]
        ) ?: [];
    }
}
