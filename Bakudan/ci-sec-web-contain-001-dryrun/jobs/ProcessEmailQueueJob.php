<?php
/**
 * ProcessEmailQueueJob — dequeue and send pending emails via SmtpMailer.
 *
 * Run via:
 *   GET /api/email/jobs/process-queue (cron endpoint, secret-protected)
 *
 * Or directly from CLI:
 *   php jobs/ProcessEmailQueueJob.php [--batch=20]
 *
 * Recommended cron schedule: every 5 minutes
 *   *\/5 * * * * curl -s "https://dashboard.bakudanramen.com/api/email/jobs/process-queue?secret=CRON_SECRET" > /dev/null 2>&1
 *
 * This job:
 *   1. Fetches up to $batchSize emails with status='pending' and attempts < 3
 *   2. Sends each via SmtpMailer
 *   3. Marks sent/failed in email_queue
 *   4. Logs outcome to email_logs
 */
class ProcessEmailQueueJob {
    private EmailQueueService $queueService;
    private int $batchSize;

    public function __construct(int $batchSize = 20) {
        $this->queueService = new EmailQueueService();
        $this->batchSize    = $batchSize;
    }

    public function run(): array {
        $result = $this->queueService->processQueue($this->batchSize);

        return array_merge($result, [
            'job'       => 'process_email_queue',
            'batch'     => $this->batchSize,
            'pending'   => $this->queueService->pendingCount(),
            'ran_at'    => date('Y-m-d H:i:s'),
        ]);
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

    // Parse optional --batch=N argument
    $batch = 20;
    foreach ($argv as $arg) {
        if (preg_match('/^--batch=(\d+)$/', $arg, $m)) {
            $batch = max(1, min(100, (int)$m[1]));
        }
    }

    $result = (new ProcessEmailQueueJob($batch))->run();
    echo json_encode($result, JSON_PRETTY_PRINT) . PHP_EOL;
}
