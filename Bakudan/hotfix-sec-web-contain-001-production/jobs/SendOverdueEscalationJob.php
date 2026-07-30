<?php
/**
 * SendOverdueEscalationJob — queue overdue escalation emails.
 *
 * Run via:
 *   GET /api/email/jobs/overdue (cron endpoint, secret-protected)
 *
 * Or directly from CLI:
 *   php jobs/SendOverdueEscalationJob.php
 *
 * Schedule: 9:00 AM daily (crontab example):
 *   0 9 * * * curl -s "https://dashboard.bakudanramen.com/api/email/jobs/overdue?secret=CRON_SECRET" > /dev/null 2>&1
 *
 * NOTE: This job only QUEUES emails. Actual sending is done by ProcessEmailQueueJob.
 */
class SendOverdueEscalationJob {
    private EmailNotificationService $notifService;

    public function __construct() {
        $this->notifService = new EmailNotificationService();
    }

    public function run(): array {
        $queued = $this->notifService->sendOverdueEscalation();
        $today  = function_exists('app_today') ? app_today() : date('Y-m-d');
        return [
            'job'    => 'overdue_email_escalation',
            'date'   => $today,
            'queued' => $queued,
            'ran_at' => date('Y-m-d H:i:s'),
        ];
    }
}

// ── CLI runner ────────────────────────────────────────────────────────────────
if (PHP_SAPI === 'cli' && basename(__FILE__) === basename($argv[0] ?? '')) {
    $dir = dirname(__DIR__);
    require_once $dir . '/config/database.php';
    require_once $dir . '/config/email.php';
    require_once $dir . '/config/time.php';
    require_once $dir . '/models/User.php';
    require_once $dir . '/models/Task.php';
    require_once $dir . '/models/TaskStore.php';
    require_once $dir . '/models/EmailLog.php';
    require_once $dir . '/models/EmailQueue.php';
    require_once $dir . '/service/SmtpMailer.php';
    require_once $dir . '/service/EmailQueueService.php';
    require_once $dir . '/service/EmailService.php';
    require_once $dir . '/service/EmailTemplateService.php';
    require_once $dir . '/service/EmailNotificationService.php';

    if (!defined('APP_TIMEZONE')) define('APP_TIMEZONE', 'Asia/Ho_Chi_Minh');
    date_default_timezone_set(APP_TIMEZONE);

    $result = (new SendOverdueEscalationJob())->run();
    echo json_encode($result, JSON_PRETTY_PRINT) . PHP_EOL;
}
