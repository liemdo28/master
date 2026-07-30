<?php
/**
 * TelegramBotService — low-level Telegram Bot API wrapper.
 *
 * Handles all HTTP communication with the Telegram API.
 * Every send is logged via TelegramNotificationLog.
 */
class TelegramBotService {
    private string $apiUrl;
    private TelegramNotificationLog $log;

    public function __construct() {
        $this->apiUrl = defined('TELEGRAM_API_URL') ? TELEGRAM_API_URL : '';
        $this->log    = new TelegramNotificationLog();
    }

    /**
     * Send a plain-text message to a chat.
     *
     * @param string $chatId   Telegram chat ID
     * @param string $text     Message text (Markdown supported)
     * @param array  $meta     Logging metadata
     */
    public function sendMessage(string $chatId, string $text, array $meta = []): bool {
        if (empty($this->apiUrl) || empty(TELEGRAM_BOT_TOKEN)) {
            error_log('[TelegramBotService] Bot token not configured.');
            return false;
        }

        $payload = [
            'chat_id'    => $chatId,
            'text'       => $text,
            'parse_mode' => 'HTML',
        ];

        // Log before send
        $logId = $this->log->create(array_merge([
            'telegram_chat_id'    => $chatId,
            'event_type'          => $meta['event_type'] ?? 'message',
            'related_entity_type' => $meta['entity_type'] ?? null,
            'related_entity_id'   => $meta['entity_id'] ?? null,
            'user_id'             => $meta['user_id'] ?? null,
            'payload'             => $payload,
        ]));

        try {
            $response = $this->post('sendMessage', $payload);
            $this->log->markSent($logId, $response);
            return true;
        } catch (\Throwable $e) {
            $this->log->markFailed($logId, $e->getMessage());
            error_log('[TelegramBotService] sendMessage failed: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Call a Telegram Bot API method via HTTP POST.
     */
    public function post(string $method, array $data): array {
        if (empty($this->apiUrl) || !$this->isConfigured()) {
            throw new \RuntimeException("Bot token not configured. Create config/telegram.local.php with TELEGRAM_BOT_TOKEN.");
        }

        $url = $this->apiUrl . '/' . $method;

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode($data),
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 10,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);
        $raw     = curl_exec($ch);
        $curlErr = curl_error($ch);
        curl_close($ch);

        if ($curlErr) throw new \RuntimeException("cURL error: $curlErr");

        $resp = json_decode($raw, true);
        if (!$resp) throw new \RuntimeException("Invalid JSON from Telegram: $raw");
        if (!($resp['ok'] ?? false)) {
            throw new \RuntimeException("Telegram API error: " . ($resp['description'] ?? 'unknown'));
        }
        return $resp;
    }

    /**
     * Set the webhook URL.
     */
    public function setWebhook(string $webhookUrl): array {
        return $this->post('setWebhook', ['url' => $webhookUrl]);
    }

    /**
     * Delete webhook (revert to polling mode).
     */
    public function deleteWebhook(): array {
        return $this->post('deleteWebhook', []);
    }

    /**
     * Get bot info.
     */
    public function getMe(): array {
        return $this->post('getMe', []);
    }

    /**
     * Get webhook info from Telegram (useful for debugging).
     */
    public function getWebhookInfo(): array {
        return $this->post('getWebhookInfo', []);
    }

    /**
     * Register bot commands so Telegram shows autocomplete menu.
     */
    public function setMyCommands(): array {
        return $this->post('setMyCommands', [
            'commands' => [
                ['command' => 'today',   'description' => 'Tasks due today'],
                ['command' => 'overdue', 'description' => 'Overdue tasks'],
                ['command' => 'help',    'description' => 'Show all commands and examples'],
            ],
        ]);
    }

    /**
     * Is the bot token configured?
     */
    public function isConfigured(): bool {
        return !empty(TELEGRAM_BOT_TOKEN);
    }
}
