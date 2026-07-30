<?php
/**
 * TelegramBot — Core Telegram integration model
 *
 * Responsibilities:
 *  - Account linking (generate OTP token, consume on /start)
 *  - Send messages / inline keyboards to Telegram
 *  - Preference management (daily summary time, notification toggles)
 *  - Rate limiting (per-user, per-hour message count)
 *  - Message logging (telegram_message_log)
 */
class TelegramBot {
    private Database $db;

    public function __construct() {
        $this->db = Database::getInstance();
        $this->ensureSchema();
    }

    // ── Schema bootstrap ─────────────────────────────────────────────────────

    private function ensureSchema(): void {
        $tables = [
            'telegram_link' => "
                CREATE TABLE IF NOT EXISTS telegram_link (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    telegram_chat_id BIGINT NOT NULL,
                    telegram_username VARCHAR(100) NULL,
                    telegram_first_name VARCHAR(100) NULL,
                    linked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    is_active TINYINT(1) NOT NULL DEFAULT 1,
                    UNIQUE KEY uq_tg_user (user_id),
                    UNIQUE KEY uq_tg_chat (telegram_chat_id),
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
            'telegram_link_token' => "
                CREATE TABLE IF NOT EXISTS telegram_link_token (
                    token CHAR(36) NOT NULL PRIMARY KEY,
                    user_id INT NOT NULL,
                    expires_at TIMESTAMP NOT NULL,
                    consumed_at TIMESTAMP NULL DEFAULT NULL,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
            'telegram_preferences' => "
                CREATE TABLE IF NOT EXISTS telegram_preferences (
                    user_id INT NOT NULL PRIMARY KEY,
                    daily_summary_enabled TINYINT(1) NOT NULL DEFAULT 1,
                    daily_summary_time TIME NOT NULL DEFAULT '08:00:00',
                    notify_on_assign TINYINT(1) NOT NULL DEFAULT 1,
                    notify_on_mention TINYINT(1) NOT NULL DEFAULT 1,
                    notify_on_task_update TINYINT(1) NOT NULL DEFAULT 0,
                    notify_on_deadline TINYINT(1) NOT NULL DEFAULT 1,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
            'telegram_message_log' => "
                CREATE TABLE IF NOT EXISTS telegram_message_log (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NULL,
                    chat_id BIGINT NOT NULL,
                    direction ENUM('in','out') NOT NULL,
                    message_type ENUM('summary','create_task','notify','qa','pending_task','other') NOT NULL DEFAULT 'other',
                    content TEXT NULL,
                    draft_key VARCHAR(32) NULL DEFAULT NULL,
                    consumed_at TIMESTAMP NULL DEFAULT NULL,
                    ai_provider VARCHAR(30) NULL,
                    ai_tokens_used INT NULL DEFAULT 0,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    KEY idx_tg_log_user(user_id),
                    KEY idx_tg_log_chat(chat_id),
                    KEY idx_tg_log_type(message_type),
                    KEY idx_tg_log_draft(draft_key),
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
        ];

        foreach ($tables as $table => $ddl) {
            if (!$this->db->tableExists($table)) {
                try { $this->db->execute($ddl); } catch (\Exception $e) { /* non-fatal */ }
            }
        }
    }

    // ── Account linking ───────────────────────────────────────────────────────

    /**
     * Generate a one-time deep-link token for account linking.
     * Returns the full t.me URL.
     */
    public function generateLinkToken(int $userId): string {
        // Purge expired tokens for this user
        $this->db->execute(
            "DELETE FROM telegram_link_token WHERE user_id = ? AND (expires_at < NOW() OR consumed_at IS NOT NULL)",
            [$userId]
        );

        $token     = \Ramsey\Uuid\Uuid::uuid4()->toString();
        // Fallback if ramsey/uuid not installed: use random hex
        if (!class_exists('Ramsey\\Uuid\\Uuid')) {
            $token = sprintf(
                '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
                mt_rand(0, 0xffff), mt_rand(0, 0xffff),
                mt_rand(0, 0xffff),
                mt_rand(0, 0x0fff) | 0x4000,
                mt_rand(0, 0x3fff) | 0x8000,
                mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
            );
        }

        $ttl = defined('TG_LINK_TOKEN_TTL_MIN') ? TG_LINK_TOKEN_TTL_MIN : 15;
        $this->db->execute(
            "INSERT INTO telegram_link_token (token, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))",
            [$token, $userId, $ttl]
        );

        $botUsername = defined('TELEGRAM_BOT_USERNAME') ? TELEGRAM_BOT_USERNAME : 'taskflow_bot';
        return "https://t.me/{$botUsername}?start={$token}";
    }

    /**
     * Consume a link token sent by the user via /start {token}.
     * Creates telegram_link and telegram_preferences rows.
     * Returns the linked app user or null on failure.
     */
    public function consumeLinkToken(string $token, int $chatId, string $username = '', string $firstName = ''): ?array {
        $row = $this->db->fetch(
            "SELECT * FROM telegram_link_token WHERE token = ? AND consumed_at IS NULL AND expires_at > NOW()",
            [$token]
        );
        if (!$row) return null;

        $userId = (int)$row['user_id'];

        // Mark token consumed
        $this->db->execute(
            "UPDATE telegram_link_token SET consumed_at = NOW() WHERE token = ?",
            [$token]
        );

        // Upsert telegram_link (user may re-link from a new account)
        $this->db->execute(
            "INSERT INTO telegram_link (user_id, telegram_chat_id, telegram_username, telegram_first_name, is_active)
             VALUES (?, ?, ?, ?, 1)
             ON DUPLICATE KEY UPDATE telegram_chat_id=VALUES(telegram_chat_id),
                telegram_username=VALUES(telegram_username),
                telegram_first_name=VALUES(telegram_first_name),
                is_active=1, linked_at=NOW()",
            [$userId, $chatId, $username ?: null, $firstName ?: null]
        );

        // Create default preferences if not exists
        $this->db->execute(
            "INSERT IGNORE INTO telegram_preferences (user_id) VALUES (?)",
            [$userId]
        );

        return $this->db->fetch("SELECT * FROM users WHERE id = ?", [$userId]);
    }

    /**
     * Unlink a user's Telegram account (soft deactivate).
     */
    public function unlinkUser(int $userId): void {
        $this->db->execute(
            "UPDATE telegram_link SET is_active = 0 WHERE user_id = ?",
            [$userId]
        );
    }

    // ── Lookup helpers ────────────────────────────────────────────────────────

    public function getLinkByUser(int $userId): ?array {
        return $this->db->fetch(
            "SELECT * FROM telegram_link WHERE user_id = ? AND is_active = 1",
            [$userId]
        ) ?: null;
    }

    public function getUserByChatId(int $chatId): ?array {
        $link = $this->db->fetch(
            "SELECT tl.user_id FROM telegram_link tl WHERE tl.telegram_chat_id = ? AND tl.is_active = 1",
            [$chatId]
        );
        if (!$link) return null;
        return $this->db->fetch("SELECT * FROM users WHERE id = ?", [(int)$link['user_id']]);
    }

    public function getPreferences(int $userId): array {
        $prefs = $this->db->fetch(
            "SELECT * FROM telegram_preferences WHERE user_id = ?",
            [$userId]
        );
        return $prefs ?: [
            'user_id'               => $userId,
            'daily_summary_enabled' => 1,
            'daily_summary_time'    => '08:00:00',
            'notify_on_assign'      => 1,
            'notify_on_mention'     => 1,
            'notify_on_task_update' => 0,
            'notify_on_deadline'    => 1,
        ];
    }

    public function updatePreferences(int $userId, array $data): void {
        $allowed = ['daily_summary_enabled','daily_summary_time','notify_on_assign',
                    'notify_on_mention','notify_on_task_update','notify_on_deadline'];
        $sets = []; $params = [];
        foreach ($allowed as $key) {
            if (array_key_exists($key, $data)) {
                $sets[]   = "{$key} = ?";
                $params[] = $data[$key];
            }
        }
        if (empty($sets)) return;
        $params[] = $userId;
        $this->db->execute(
            "INSERT INTO telegram_preferences (user_id) VALUES (?) ON DUPLICATE KEY UPDATE " . implode(', ', $sets),
            array_merge([$userId], array_slice($params, 0, count($sets)))
        );
        // Re-run properly as upsert
        $this->db->execute(
            "UPDATE telegram_preferences SET " . implode(', ', $sets) . " WHERE user_id = ?",
            $params
        );
    }

    // ── Rate limiting ─────────────────────────────────────────────────────────

    /**
     * Check if user is within rate limits for inbound message processing.
     * Returns true if allowed, false if throttled.
     */
    public function checkRateLimit(int $userId, string $type = 'message'): bool {
        if ($type === 'ai') {
            $limit = defined('TG_RATE_AI_PER_DAY') ? TG_RATE_AI_PER_DAY : 50;
            $count = $this->db->fetch(
                "SELECT COUNT(*) AS c FROM telegram_message_log
                 WHERE user_id = ? AND direction = 'in' AND message_type IN ('create_task','qa')
                   AND created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)",
                [$userId]
            );
            return (int)($count['c'] ?? 0) < $limit;
        }

        $limit = defined('TG_RATE_MSG_PER_HOUR') ? TG_RATE_MSG_PER_HOUR : 30;
        $count = $this->db->fetch(
            "SELECT COUNT(*) AS c FROM telegram_message_log
             WHERE user_id = ? AND direction = 'in'
               AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)",
            [$userId]
        );
        return (int)($count['c'] ?? 0) < $limit;
    }

    // ── Message logging ───────────────────────────────────────────────────────

    public function log(array $data): int {
        return (int)$this->db->insert(
            "INSERT INTO telegram_message_log
                (user_id, chat_id, direction, message_type, content, draft_key, ai_provider, ai_tokens_used)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [
                $data['user_id']       ?? null,
                $data['chat_id'],
                $data['direction'],
                $data['message_type']  ?? 'other',
                $data['content']       ?? null,
                $data['draft_key']     ?? null,
                $data['ai_provider']   ?? null,
                $data['ai_tokens_used']?? 0,
            ]
        );
    }

    public function getPendingDraft(string $draftKey, int $chatId): ?array {
        $row = $this->db->fetch(
            "SELECT * FROM telegram_message_log
             WHERE draft_key = ? AND chat_id = ? AND message_type = 'pending_task'
               AND consumed_at IS NULL AND created_at >= DATE_SUB(NOW(), INTERVAL 30 MINUTE)",
            [$draftKey, $chatId]
        );
        if (!$row) return null;
        $content = json_decode($row['content'] ?? '{}', true);
        return is_array($content) ? array_merge($row, ['parsed' => $content]) : null;
    }

    public function consumeDraft(string $draftKey): void {
        $this->db->execute(
            "UPDATE telegram_message_log SET consumed_at = NOW() WHERE draft_key = ?",
            [$draftKey]
        );
    }

    // ── Telegram API helpers ──────────────────────────────────────────────────

    /**
     * Send a plain text message to a chat.
     */
    public function sendMessage(int $chatId, string $text, array $extra = []): bool {
        return $this->apiCall('sendMessage', array_merge([
            'chat_id'    => $chatId,
            'text'       => $text,
            'parse_mode' => 'HTML',
        ], $extra));
    }

    /**
     * Send a message with inline keyboard buttons.
     * $buttons = [[['text'=>'Label','callback_data'=>'data']], ...]
     */
    public function sendWithKeyboard(int $chatId, string $text, array $buttons): bool {
        return $this->apiCall('sendMessage', [
            'chat_id'      => $chatId,
            'text'         => $text,
            'parse_mode'   => 'HTML',
            'reply_markup' => json_encode(['inline_keyboard' => $buttons]),
        ]);
    }

    /**
     * Answer a callback query (required to clear the loading state on the button).
     */
    public function answerCallback(string $callbackId, string $text = '', bool $alert = false): bool {
        return $this->apiCall('answerCallbackQuery', [
            'callback_query_id' => $callbackId,
            'text'              => $text,
            'show_alert'        => $alert,
        ]);
    }

    /**
     * Register or update the webhook URL with Telegram.
     * Call once after deployment: POST /telegram/setup-webhook (admin only).
     */
    public function setWebhook(string $url, string $secret = ''): bool {
        $payload = ['url' => $url];
        if ($secret !== '') $payload['secret_token'] = $secret;
        return $this->apiCall('setWebhook', $payload);
    }

    /**
     * F3: Push a notification to a user if they have Telegram linked and preference enabled.
     * $notifType: 'assign' | 'mention' | 'task_update' | 'deadline'
     */
    public function triggerNotification(int $userId, string $notifType, string $title, string $message, ?int $taskId = null): void {
        $link = $this->getLinkByUser($userId);
        if (!$link) return;

        $prefs  = $this->getPreferences($userId);
        $prefKey = match ($notifType) {
            'assign'      => 'notify_on_assign',
            'mention'     => 'notify_on_mention',
            'task_update' => 'notify_on_task_update',
            'deadline'    => 'notify_on_deadline',
            default       => null,
        };
        if ($prefKey && !(bool)(int)($prefs[$prefKey] ?? 0)) return;

        $icon = match ($notifType) {
            'assign'      => '📋',
            'mention'     => '💬',
            'task_update' => '🔄',
            'deadline'    => '⏰',
            default       => '🔔',
        };

        $text = "{$icon} <b>{$title}</b>\n{$message}";
        if ($taskId) {
            $text .= "\n\n<a href=\"" . rtrim(APP_URL, '/') . "/tasks/{$taskId}\">→ Xem task</a>";
        }

        $chatId = (int)$link['telegram_chat_id'];
        $this->sendMessage($chatId, $text);
        $this->log([
            'user_id'      => $userId,
            'chat_id'      => $chatId,
            'direction'    => 'out',
            'message_type' => 'notify',
            'content'      => $text,
        ]);
    }

    // ── Low-level API call ────────────────────────────────────────────────────

    private function apiCall(string $method, array $params = []): bool {
        $token = defined('TELEGRAM_BOT_TOKEN') ? TELEGRAM_BOT_TOKEN : '';
        if ($token === '') {
            error_log('TelegramBot: TELEGRAM_BOT_TOKEN not configured');
            return false;
        }

        $url  = "https://api.telegram.org/bot{$token}/{$method}";
        $json = json_encode($params, JSON_UNESCAPED_UNICODE);

        $ctx = stream_context_create(['http' => [
            'method'        => 'POST',
            'header'        => "Content-Type: application/json\r\nContent-Length: " . strlen($json),
            'content'       => $json,
            'timeout'        => 10,
            'ignore_errors' => true,
        ]]);

        $raw = @file_get_contents($url, false, $ctx);
        if ($raw === false) {
            error_log("TelegramBot: HTTP failed for {$method}");
            return false;
        }

        $resp = json_decode($raw, true);
        if (!($resp['ok'] ?? false)) {
            error_log("TelegramBot: {$method} failed — " . ($resp['description'] ?? $raw));
            return false;
        }
        return true;
    }
}
