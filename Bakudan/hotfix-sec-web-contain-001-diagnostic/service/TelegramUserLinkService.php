<?php
/**
 * TelegramUserLinkService — handles the connect-code flow.
 *
 * Flow:
 *  1. Dashboard user visits Settings → Telegram → clicks "Connect"
 *  2. Backend generates a 8-char alphanumeric code, saves to telegram_users
 *  3. User opens Telegram and sends: /connect ABC12345
 *  4. Webhook receives the message, calls confirmConnect()
 *  5. Connection saved; bot sends confirmation
 */
class TelegramUserLinkService {
    private TelegramUser $model;
    private TelegramBotService $bot;

    public function __construct() {
        $this->model = new TelegramUser();
        $this->bot   = new TelegramBotService();
    }

    /**
     * Step 1 (Dashboard): Generate a connect code for the logged-in user.
     * Returns the code to display to the user.
     */
    public function generateCode(int $userId): string {
        $code       = strtoupper(bin2hex(random_bytes(4))); // 8-char hex
        $expiresAt  = date('Y-m-d H:i:s', time() + TELEGRAM_CONNECT_CODE_TTL);
        $this->model->upsertConnectCode($userId, $code, $expiresAt);
        return $code;
    }

    /**
     * Step 2 (Telegram): User sends "/connect CODE" to bot.
     * Finds the pending code, links the Telegram account to the dashboard user.
     *
     * @param string $code       The code from the Telegram message
     * @param array  $tgUpdate   Telegram update object (from, chat)
     * @return array{ok: bool, message: string}
     */
    public function confirmConnect(string $code, array $tgUpdate): array {
        $from   = $tgUpdate['message']['from'] ?? [];
        $chat   = $tgUpdate['message']['chat'] ?? [];
        $chatId = (string)($chat['id'] ?? '');

        if (!$chatId) {
            return ['ok' => false, 'message' => 'Could not determine chat ID.'];
        }

        $pending = $this->model->findByConnectCode(strtoupper(trim($code)));
        if (!$pending) {
            return ['ok' => false, 'message' => 'Invalid or expired code. Please generate a new one from the dashboard.'];
        }

        // If this Telegram account is already linked to another user, refuse
        $existing = $this->model->findByChatId($chatId);
        if ($existing && (int)$existing['user_id'] !== (int)$pending['user_id']) {
            return ['ok' => false, 'message' => 'This Telegram account is already linked to another dashboard account.'];
        }

        $this->model->confirmConnection((int)$pending['user_id'], [
            'chat_id'    => $chatId,
            'user_id'    => (string)($from['id'] ?? ''),
            'username'   => $from['username'] ?? null,
            'first_name' => $from['first_name'] ?? null,
            'last_name'  => $from['last_name'] ?? null,
        ]);

        return ['ok' => true, 'message' => "Connected! Your Telegram account is now linked to TaskFlow.\n\nYou'll receive daily reminders for due tasks and overdue tasks.\n\nYou can also:\n• Ask about task due dates\n• Create tasks by describing them"];
    }

    /**
     * Disconnect a user from Telegram.
     */
    public function disconnect(int $userId): void {
        $this->model->disconnect($userId);
    }

    /**
     * Check if a dashboard user is connected.
     */
    public function isConnected(int $userId): bool {
        return $this->model->isConnected($userId);
    }

    /**
     * Get connection info for a user (for settings page).
     */
    public function getConnectionInfo(int $userId): ?array {
        return $this->model->findByUserId($userId);
    }
}
