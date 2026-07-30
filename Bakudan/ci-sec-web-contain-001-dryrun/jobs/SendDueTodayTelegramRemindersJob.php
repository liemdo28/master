<?php
/**
 * SendDueTodayTelegramRemindersJob — send due-today reminders to all linked Telegram users.
 *
 * Run via:
 *   GET /api/telegram/jobs/due-today (admin-authenticated cron endpoint)
 *
 * Or directly from CLI:
 *   php jobs/SendDueTodayTelegramRemindersJob.php
 *
 * Schedule: 8:00 AM daily (crontab example):
 *   0 8 * * * curl -s "https://dashboard.bakudanramen.com/api/telegram/jobs/due-today?secret=CRON_SECRET" > /dev/null 2>&1
 */
class SendDueTodayTelegramRemindersJob {
    private TelegramNotificationService $notifService;

    public function __construct() {
        $this->notifService = new TelegramNotificationService();
    }

    public function run(): array {
        $sent  = $this->notifService->sendDueTodayReminders();
        $today = function_exists('app_today') ? app_today() : date('Y-m-d');
        return [
            'job'   => 'due_today_reminders',
            'date'  => $today,
            'sent'  => $sent,
            'ran_at'=> date('Y-m-d H:i:s'),
        ];
    }
}

// ── CLI runner ────────────────────────────────────────────────────────────────
if (PHP_SAPI === 'cli' && basename(__FILE__) === basename($argv[0] ?? '')) {
    $dir = dirname(__DIR__);
    require_once $dir . '/config/database.php';
    require_once $dir . '/config/telegram.php';
    require_once $dir . '/config/time.php';
    require_once $dir . '/models/TelegramUser.php';
    require_once $dir . '/models/TelegramNotificationLog.php';
    require_once $dir . '/models/Task.php';
    require_once $dir . '/models/TaskStore.php';
    require_once $dir . '/service/TelegramBotService.php';
    require_once $dir . '/service/TelegramNotificationService.php';
    require_once $dir . '/service/TaskStoreService.php';

    if (!defined('APP_TIMEZONE')) define('APP_TIMEZONE', 'Asia/Ho_Chi_Minh');
    date_default_timezone_set(APP_TIMEZONE);

    $result = (new SendDueTodayTelegramRemindersJob())->run();
    echo json_encode($result, JSON_PRETTY_PRINT) . PHP_EOL;
}
