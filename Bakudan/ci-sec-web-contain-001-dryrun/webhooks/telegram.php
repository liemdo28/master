<?php
/**
 * webhooks/telegram.php — Direct Telegram webhook entry point.
 *
 * Accessed as a REAL FILE so Apache serves it directly,
 * bypassing .htaccess rewrite rules (avoids 302 redirect issues).
 *
 * Webhook URL: https://dashboard.bakudanramen.com/webhooks/telegram.php
 */

// Read raw input immediately — before any output or session
$raw = file_get_contents('php://input');

// Debug log
file_put_contents(
    __DIR__ . '/../telegram_debug.log',
    date('Y-m-d H:i:s') . ' IP:' . ($_SERVER['REMOTE_ADDR'] ?? '?') . "\n" . $raw . "\n\n",
    FILE_APPEND
);

// Respond 200 immediately
http_response_code(200);
header('Content-Type: application/json');
echo json_encode(['ok' => true]);
if (function_exists('fastcgi_finish_request')) fastcgi_finish_request();

// Bootstrap
$dir = __DIR__ . '/..';
require_once $dir . '/config/database.php';
require_once $dir . '/config/telegram.php';
require_once $dir . '/config/time.php';
require_once $dir . '/config/ai.php';   // needed by TelegramIntentClassifier

if (!defined('APP_TIMEZONE')) define('APP_TIMEZONE', 'Asia/Ho_Chi_Minh');
date_default_timezone_set(APP_TIMEZONE);

require_once $dir . '/models/User.php';
require_once $dir . '/models/Project.php';
require_once $dir . '/models/Task.php';
require_once $dir . '/models/TaskStore.php';
require_once $dir . '/models/TelegramUser.php';
require_once $dir . '/models/TelegramNotificationLog.php';
require_once $dir . '/models/TelegramInboundLog.php';
require_once $dir . '/models/TelegramContext.php';
require_once $dir . '/service/TaskStoreService.php';
require_once $dir . '/service/TelegramBotService.php';
require_once $dir . '/service/TelegramUserLinkService.php';
require_once $dir . '/service/TelegramNotificationService.php';
require_once $dir . '/service/TelegramTaskParserService.php';
require_once $dir . '/service/TelegramIntentClassifier.php';
require_once $dir . '/service/TelegramTaskQueryService.php';
require_once $dir . '/service/TelegramConversationService.php';
require_once $dir . '/service/TelegramInboundService.php';

// Helper stubs needed by services
if (!function_exists('app_today')) {
    function app_today(): string { return date('Y-m-d'); }
}

// Process the update
$update = json_decode($raw, true);
if (!is_array($update)) exit;

try {
    (new TelegramInboundService())->process($update);
} catch (\Throwable $e) {
    error_log('[TelegramWebhook] ' . $e->getMessage());
}
