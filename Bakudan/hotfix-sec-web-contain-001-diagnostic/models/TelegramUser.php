<?php
class TelegramUser {
    private $db;

    public function __construct() {
        $this->db = Database::getInstance();
        $this->ensureSchema();
    }

    private function ensureSchema(): void {
        if ($this->db->tableExists('telegram_users')) return;
        try {
            $sql = file_get_contents(__DIR__ . '/../database/migrations/telegram.sql');
            // Strip SQL comment lines (-- ...) before splitting to avoid semicolons inside comments
            $lines = array_filter(
                explode("\n", $sql),
                fn($l) => !preg_match('/^\s*--/', $l)
            );
            $stmts = array_filter(array_map('trim', explode(';', implode("\n", $lines))));
            foreach ($stmts as $stmt) {
                $this->db->execute($stmt);
            }
            $this->db->invalidateSchemaCache();
        } catch (\Throwable $e) {
            error_log('[TelegramUser::ensureSchema] ' . $e->getMessage());
        }
    }

    /** Find by dashboard user_id */
    public function findByUserId(int $userId): ?array {
        return $this->db->fetch(
            "SELECT * FROM telegram_users WHERE user_id = ? AND is_active = 1",
            [$userId]
        ) ?: null;
    }

    /** Find by Telegram chat_id */
    public function findByChatId(string $chatId): ?array {
        return $this->db->fetch(
            "SELECT tu.*, u.name AS user_name, u.email AS user_email
             FROM telegram_users tu
             JOIN users u ON tu.user_id = u.id
             WHERE tu.telegram_chat_id = ? AND tu.is_active = 1",
            [$chatId]
        ) ?: null;
    }

    /** Find by connect code (must not be expired) */
    public function findByConnectCode(string $code): ?array {
        return $this->db->fetch(
            "SELECT * FROM telegram_users
             WHERE connect_code = ? AND connect_code_expires_at > NOW()",
            [$code]
        ) ?: null;
    }

    /** Set connect code for a user (creates row if needed) */
    public function upsertConnectCode(int $userId, string $code, string $expiresAt): void {
        $existing = $this->db->fetch(
            "SELECT id FROM telegram_users WHERE user_id = ?", [$userId]
        );
        if ($existing) {
            $this->db->execute(
                "UPDATE telegram_users SET connect_code=?, connect_code_expires_at=? WHERE user_id=?",
                [$code, $expiresAt, $userId]
            );
        } else {
            $this->db->execute(
                "INSERT INTO telegram_users (user_id, telegram_chat_id, connect_code, connect_code_expires_at)
                 VALUES (?, '', ?, ?)",
                [$userId, $code, $expiresAt]
            );
        }
    }

    /** Confirm Telegram connection after /connect CODE */
    public function confirmConnection(int $userId, array $tgData): void {
        $this->db->execute(
            "UPDATE telegram_users
             SET telegram_chat_id=?, telegram_user_id=?, telegram_username=?,
                 first_name=?, last_name=?, connect_code=NULL,
                 connect_code_expires_at=NULL, is_active=1, updated_at=NOW()
             WHERE user_id=?",
            [
                $tgData['chat_id'],
                $tgData['user_id'] ?? null,
                $tgData['username'] ?? null,
                $tgData['first_name'] ?? null,
                $tgData['last_name'] ?? null,
                $userId,
            ]
        );
    }

    /** Get all active mapped users (for reminder broadcasts) */
    public function getAllActive(): array {
        return $this->db->fetchAll(
            "SELECT tu.*, u.name AS user_name, u.timezone AS user_timezone
             FROM telegram_users tu
             JOIN users u ON tu.user_id = u.id
             WHERE tu.is_active = 1 AND tu.telegram_chat_id != ''
             ORDER BY tu.user_id ASC"
        ) ?: [];
    }

    /** Deactivate (disconnect) */
    public function disconnect(int $userId): void {
        $this->db->execute(
            "UPDATE telegram_users SET is_active=0, updated_at=NOW() WHERE user_id=?",
            [$userId]
        );
    }

    /** Is connected? */
    public function isConnected(int $userId): bool {
        $row = $this->db->fetch(
            "SELECT id FROM telegram_users WHERE user_id=? AND is_active=1 AND telegram_chat_id!=''",
            [$userId]
        );
        return !empty($row);
    }
}
