<?php
/**
 * TelegramWebhookController — receives and processes Telegram webhook updates.
 *
 * Route: POST /webhooks/telegram
 *
 * This endpoint is PUBLIC (no session auth) but only responds to Telegram's servers.
 * We return HTTP 200 immediately so Telegram doesn't retry.
 */
class TelegramWebhookController {
    private TelegramInboundService $inbound;

    public function __construct() {
        $this->inbound = new TelegramInboundService();
    }

    public function handle(): void {
        // Read input FIRST — before fastcgi_finish_request() drains the stream
        $raw = file_get_contents('php://input');

        // ── Debug log — always write, even if body is empty ───────────────────
        file_put_contents(
            __DIR__ . '/../telegram_debug.log',
            date('Y-m-d H:i:s') . ' IP:' . ($_SERVER['REMOTE_ADDR'] ?? '?') . "\n" . $raw . "\n\n",
            FILE_APPEND
        );

        // Respond 200 immediately so Telegram doesn't retry
        http_response_code(200);
        header('Content-Type: application/json');
        echo json_encode(['ok' => true]);
        if (function_exists('fastcgi_finish_request')) fastcgi_finish_request();

        // Parse incoming JSON
        $update = json_decode($raw, true);

        if (!is_array($update)) return;

        // Optional: verify Telegram IP ranges
        if (defined('TELEGRAM_VERIFY_IP') && TELEGRAM_VERIFY_IP) {
            $ip = $_SERVER['REMOTE_ADDR'] ?? '';
            if (!$this->isTelegramIp($ip)) {
                error_log('[TelegramWebhook] Rejected non-Telegram IP: ' . $ip);
                return;
            }
        }

        try {
            $this->inbound->process($update);
        } catch (\Throwable $e) {
            error_log('[TelegramWebhook] Error: ' . $e->getMessage());
        }
    }

    /**
     * Check if IP belongs to Telegram's known ranges.
     * Telegram publishes their IP ranges; this is a simplified check.
     */
    private function isTelegramIp(string $ip): bool {
        // Telegram uses these CIDR ranges (as of 2024)
        $allowedRanges = [
            '149.154.160.0/20',
            '91.108.4.0/22',
            '91.108.56.0/22',
            '91.108.8.0/22',
        ];
        foreach ($allowedRanges as $range) {
            if ($this->ipInCidr($ip, $range)) return true;
        }
        return false;
    }

    private function ipInCidr(string $ip, string $cidr): bool {
        [$subnet, $bits] = explode('/', $cidr);
        $ip     = ip2long($ip);
        $subnet = ip2long($subnet);
        $mask   = -1 << (32 - (int)$bits);
        return ($ip & $mask) === ($subnet & $mask);
    }
}
