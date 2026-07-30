<?php
/**
 * TelegramContext — per-chat conversation state (last task reference).
 *
 * One row per telegram_chat_id, upserted on every save.
 * Consumers must enforce their own TTL by checking updated_at.
 */
class TelegramContext {
    private $db;

    public function __construct() {
        $this->db = Database::getInstance();
        $this->ensureSchema();
    }

    private function ensureSchema(): void {
        if ($this->db->tableExists('telegram_context')) return;
        try {
            $sql   = file_get_contents(__DIR__ . '/../database/migrations/telegram_context.sql');
            $lines = array_filter(explode("\n", $sql), fn($l) => !preg_match('/^\s*--/', $l));
            $stmts = array_filter(array_map('trim', explode(';', implode("\n", $lines))));
            foreach ($stmts as $stmt) $this->db->execute($stmt);
            $this->db->invalidateSchemaCache();
        } catch (\Throwable $e) {
            error_log('[TelegramContext::ensureSchema] ' . $e->getMessage());
        }
    }

    /**
     * Save (upsert) the last referenced task for a chat.
     */
    public function save(string $chatId, int $taskId, string $taskTitle): void {
        $this->db->execute(
            "INSERT INTO telegram_context (telegram_chat_id, last_task_id, last_task_title)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE
               last_task_id    = VALUES(last_task_id),
               last_task_title = VALUES(last_task_title),
               updated_at      = NOW()",
            [$chatId, $taskId, $taskTitle]
        );
    }

    /**
     * Fetch context for a chat. Returns null if no row exists.
     */
    public function get(string $chatId): ?array {
        return $this->db->fetch(
            "SELECT * FROM telegram_context WHERE telegram_chat_id = ?",
            [$chatId]
        ) ?: null;
    }

    /**
     * Clear context for a chat (e.g. after a successful reassign).
     */
    public function clear(string $chatId): void {
        $this->db->execute(
            "DELETE FROM telegram_context WHERE telegram_chat_id = ?",
            [$chatId]
        );
    }
}
