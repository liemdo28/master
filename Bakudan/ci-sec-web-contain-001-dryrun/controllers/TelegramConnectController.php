<?php
/**
 * TelegramConnectController — dashboard-side Telegram connection management.
 *
 * Routes:
 *   GET  /settings/telegram          — connection settings page
 *   POST /api/telegram/connect/init  — generate connect code
 *   POST /api/telegram/disconnect    — disconnect account
 *   POST /api/telegram/test-send     — admin: test send a message (JSON)
 *   POST /api/telegram/set-webhook   — admin: register webhook URL
 *   GET  /api/telegram/status        — check connection status (JSON)
 */
class TelegramConnectController {
    private TelegramUserLinkService $linkService;
    private TelegramBotService $bot;

    public function __construct() {
        if (!isLoggedIn()) redirect('login');
        $this->linkService = new TelegramUserLinkService();
        $this->bot         = new TelegramBotService();
    }

    /**
     * GET /settings/telegram — show connection page
     */
    public function settingsPage(): void {
        $userId     = (int)$_SESSION['user_id'];
        $connection = $this->linkService->getConnectionInfo($userId);
        $isConnected = $this->linkService->isConnected($userId);
        $botConfigured = $this->bot->isConfigured();

        require __DIR__ . '/../views/telegram/connect.php';
    }

    /**
     * POST /api/telegram/connect/init — generate a connect code (JSON)
     */
    public function initConnect(): void {
        if (!isLoggedIn()) json_response(['error' => 'Unauthorized'], 401);
        $userId = (int)$_SESSION['user_id'];
        $code   = $this->linkService->generateCode($userId);
        json_response([
            'ok'         => true,
            'code'       => $code,
            'expires_in' => TELEGRAM_CONNECT_CODE_TTL,
            'instruction'=> "Send <code>/connect {$code}</code> to the TaskFlow bot on Telegram.",
        ]);
    }

    /**
     * POST /api/telegram/disconnect
     */
    public function disconnect(): void {
        if (!isLoggedIn()) json_response(['error' => 'Unauthorized'], 401);
        $this->linkService->disconnect((int)$_SESSION['user_id']);
        json_response(['ok' => true, 'message' => 'Telegram account disconnected.']);
    }

    /**
     * GET /api/telegram/status
     */
    public function status(): void {
        if (!isLoggedIn()) json_response(['error' => 'Unauthorized'], 401);
        $userId  = (int)$_SESSION['user_id'];
        $conn    = $this->linkService->getConnectionInfo($userId);
        $ok      = $this->linkService->isConnected($userId);
        json_response([
            'connected'        => $ok,
            'telegram_username'=> $ok ? ($conn['telegram_username'] ?? null) : null,
            'first_name'       => $ok ? ($conn['first_name'] ?? null) : null,
            'bot_configured'   => $this->bot->isConfigured(),
        ]);
    }

    /**
     * POST /api/telegram/test-send — admin-only, sends a test message (JSON)
     */
    public function testSend(): void {
        if (!isAdmin()) json_response(['error' => 'Forbidden'], 403);

        $chatId  = trim($_POST['chat_id'] ?? '');
        $message = trim($_POST['message'] ?? '') ?: 'Test message from TaskFlow. Bot is working! ✅';

        if (!$chatId) json_response(['error' => 'chat_id required'], 422);

        $ok = $this->bot->sendMessage($chatId, $message, [
            'event_type' => 'test_send',
            'user_id'    => $_SESSION['user_id'],
        ]);
        json_response(['ok' => $ok]);
    }

    /**
     * POST /api/telegram/set-webhook — admin-only, register webhook
     */
    public function setWebhook(): void {
        if (!isAdmin()) json_response(['error' => 'Forbidden'], 403);

        $webhookUrl = trim($_POST['webhook_url'] ?? '');
        if (!$webhookUrl) {
            $webhookUrl = (defined('APP_URL') ? APP_URL : '') . '/webhooks/telegram';
        }

        try {
            $result = $this->bot->setWebhook($webhookUrl);
            // Register bot command menu automatically
            try { $this->bot->setMyCommands(); } catch (\Throwable $e) {}
            json_response(['ok' => true, 'result' => $result, 'webhook_url' => $webhookUrl]);
        } catch (\RuntimeException $e) {
            json_response(['ok' => false, 'error' => $e->getMessage()], 422);
        }
    }
}
