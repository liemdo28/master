<?php
/**
 * CRON JOB — hourly scheduler entrypoint
 *
 * Hosting (cPanel): `php /home/liemdo0208/dashboard.bakudanramen.com/cron.php`
 * Or via HTTP:      https://dashboard.bakudanramen.com/cron.php?key=taskflow-cron-2024-secret
 *
 * Options (HTTP GET or CLI argv):
 *   force_telegram=1   Force Telegram reminders regardless of current hour
 *   force_asana=1      Force Asana sync regardless of the 06:00/18:00 UTC gate
 */

// ── Opcache flush (deploy helper) ───────────────────────────────
if (isset($_GET['flush_opcache']) && $_GET['flush_opcache'] === '1') {
    $ok = function_exists('opcache_reset') ? opcache_reset() : false;
    header('Content-Type: application/json');
    echo json_encode(['opcache_reset' => $ok, 'ts' => time()]);
    exit;
}

// ── HTTP headers ────────────────────────────────────────────────
if (php_sapi_name() !== 'cli') {
    header('Cache-Control: no-store, no-cache, must-revalidate');
    header('Pragma: no-cache');
    header('Content-Type: text/plain; charset=utf-8');
}

// ── Security ─────────────────────────────────────────────────────
$isCliExecution  = php_sapi_name() === 'cli';
$expectedKey     = 'taskflow-cron-2024-secret';
$validWebRequest = isset($_GET['key']) && $_GET['key'] === $expectedKey;

if (!$isCliExecution && !$validWebRequest) {
    http_response_code(403);
    die('Forbidden');
}

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/models/Notification.php';
require_once __DIR__ . '/models/Bill.php';
require_once __DIR__ . '/models/Project.php';
require_once __DIR__ . '/models/Section.php';
require_once __DIR__ . '/models/Task.php';
require_once __DIR__ . '/models/User.php';
require_once __DIR__ . '/controllers/AsanaController.php';
require_once __DIR__ . '/models/Penalty.php';

// ── Config ───────────────────────────────────────────────────────
define('CRON_ALERT_EMAIL',    'liem.dt0208@gmail.com');
define('CRON_LOG_FILE',       __DIR__ . '/cron.log');
define('CRON_LOG_MAX_BYTES',  500 * 1024); // rotate after 500 KB
define('CRON_HEARTBEAT_HOUR', 8);          // send success ping at 8 AM (APP_TIMEZONE)

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Append a line to cron.log (with auto-rotation).
 */
function cron_log(string $line): void {
    $entry = date('Y-m-d H:i:s') . '  ' . $line . "\n";
    if (file_exists(CRON_LOG_FILE) && filesize(CRON_LOG_FILE) >= CRON_LOG_MAX_BYTES) {
        // Keep last half of the file to avoid unbounded growth
        $content = file_get_contents(CRON_LOG_FILE);
        file_put_contents(CRON_LOG_FILE, substr($content, (int)(strlen($content) / 2)));
    }
    file_put_contents(CRON_LOG_FILE, $entry, FILE_APPEND | LOCK_EX);
}

/**
 * Send failure alert via Telegram (to admin chat) AND email.
 */
function cron_alert_failure(Throwable $e, string $context = ''): void {
    $time    = date('Y-m-d H:i:s');
    $server  = $_SERVER['SERVER_NAME'] ?? 'CLI';
    $message = $e->getMessage();
    $file    = $e->getFile() . ':' . $e->getLine();

    // ── Telegram alert ───────────────────────────────────────────
    if (defined('TELEGRAM_BOT_TOKEN') && TELEGRAM_BOT_TOKEN !== '' &&
        defined('TELEGRAM_API_URL')   && TELEGRAM_API_URL   !== '') {
        $tgText = "🚨 <b>CRON FAILED — TaskFlow</b>\n\n"
                . "🕐 Time: <code>{$time}</code>\n"
                . "🖥 Server: <code>{$server}</code>\n\n"
                . "❌ <b>Error:</b>\n<code>" . htmlspecialchars($message) . "</code>\n"
                . ($context ? "\n📍 <b>Context:</b> " . htmlspecialchars($context) . "\n" : '')
                . "\n⚠️ <b>Impact:</b>\n"
                . "• Task reminders paused\n"
                . "• Email queue stopped\n"
                . "• Finance / compliance risk\n\n"
                . "🔧 <b>Action:</b> Check server logs at <code>cron.log</code>";

        // Send to all admin users connected on Telegram
        try {
            $db = Database::getInstance();
            $admins = $db->fetchAll(
                "SELECT tu.telegram_chat_id
                 FROM telegram_users tu
                 JOIN users u ON tu.user_id = u.id
                 WHERE u.role IN ('admin','ceo') AND tu.is_active = 1 AND tu.telegram_chat_id != ''"
            );
            foreach ($admins as $admin) {
                @file_get_contents(TELEGRAM_API_URL . '/sendMessage?' . http_build_query([
                    'chat_id'    => $admin['telegram_chat_id'],
                    'text'       => $tgText,
                    'parse_mode' => 'HTML',
                ]));
            }
        } catch (Throwable $tgEx) {
            // Telegram alert failed — fall through to email
        }
    }

    // ── Email alert ──────────────────────────────────────────────
    $subject = "🚨 CRON FAILED — TaskFlow [{$time}]";
    $body    = "TaskFlow Cron Job Failed\n"
             . str_repeat('=', 50) . "\n\n"
             . "Time:    {$time}\n"
             . "Server:  {$server}\n\n"
             . "ERROR:\n{$message}\n"
             . "File:    {$file}\n"
             . ($context ? "Context: {$context}\n" : '')
             . "\n" . str_repeat('-', 50) . "\n"
             . "IMPACT:\n"
             . "  - Automated task reminders are paused\n"
             . "  - Email notification queue has stopped\n"
             . "  - Finance / compliance deadlines may be missed\n\n"
             . "ACTION REQUIRED:\n"
             . "  1. SSH into server and check: tail -50 cron.log\n"
             . "  2. Verify PHP path: /usr/local/bin/php\n"
             . "  3. Re-run manually to confirm fix:\n"
             . "     https://dashboard.bakudanramen.com/cron.php?key=taskflow-cron-2024-secret\n";

    @mail(CRON_ALERT_EMAIL, $subject, $body,
        "From: noreply@bakudanramen.com\r\nContent-Type: text/plain; charset=utf-8");
}

/**
 * Send daily success heartbeat at 8 AM via Telegram.
 */
function cron_heartbeat_success(array $summary): void {
    if (!defined('TELEGRAM_API_URL') || TELEGRAM_API_URL === '') return;

    $tgToday   = $summary['telegram_due_today_sent'] ?? 'n/a';
    $tgOverdue = $summary['telegram_overdue_sent']   ?? 'n/a';
    $queue     = ($summary['email_queue_before'] ?? 0) . '→' . ($summary['email_queue_after'] ?? 0);
    $time      = date('Y-m-d H:i:s');

    $tgText = "✅ <b>TaskFlow Cron — Daily Report</b>\n\n"
            . "🕐 <code>{$time}</code>\n\n"
            . "📬 Reminders sent today:\n"
            . "  • Due-today alerts: <b>" . ($tgToday  === -1 ? 'skipped' : $tgToday)  . "</b>\n"
            . "  • Overdue alerts:   <b>" . ($tgOverdue === -1 ? 'skipped' : $tgOverdue) . "</b>\n\n"
            . "📧 Email queue: <b>{$queue}</b> processed\n"
            . "🔁 Recurring tasks generated: <b>" . ($summary['recurring_generated'] ?? 0) . "</b>\n\n"
            . "All systems running normally ✓";

    try {
        $db = Database::getInstance();
        $admins = $db->fetchAll(
            "SELECT tu.telegram_chat_id
             FROM telegram_users tu
             JOIN users u ON tu.user_id = u.id
             WHERE u.role IN ('admin','ceo') AND tu.is_active = 1 AND tu.telegram_chat_id != ''"
        );
        foreach ($admins as $admin) {
            @file_get_contents(TELEGRAM_API_URL . '/sendMessage?' . http_build_query([
                'chat_id'    => $admin['telegram_chat_id'],
                'text'       => $tgText,
                'parse_mode' => 'HTML',
            ]));
        }
    } catch (Throwable $e) {
        // Non-critical
    }
}

// ── Pipeline options ──────────────────────────────────────────────
$pipelineOptions = [];
$forceAsanaRequested = !empty($_GET['force_asana']) || in_array('force_asana=1', $argv ?? []);
if (!empty($_GET['force_telegram']) || in_array('force_telegram=1', $argv ?? [])) {
    $pipelineOptions['force_telegram'] = true;
}
if ($forceAsanaRequested) {
    $pipelineOptions['force_asana'] = true;
}
if (!empty($_GET['skip_asana']) || in_array('skip_asana=1', $argv ?? [])) {
    $pipelineOptions['skip_asana'] = true;
}

// ── Run pipeline ─────────────────────────────────────────────────
require_once __DIR__ . '/scripts/run_notifications.php';
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/config/telegram.php';
require_once __DIR__ . '/models/Penalty.php';
require_once __DIR__ . '/models/AiRouter.php';
require_once __DIR__ . '/models/TelegramAiTools.php';
require_once __DIR__ . '/models/TelegramBot.php';

$startTime = microtime(true);

try {
    $summary = taskflow_run_notification_pipeline($pipelineOptions);

    if ($forceAsanaRequested && empty($summary['asana_synced'])) {
        AsanaController::cronSync();
        $summary['asana_synced'] = true;
    }

    // Check if any pipeline step errored
    $failedSteps = array_filter($summary['steps'] ?? [], fn($s) => $s['status'] === 'error');

    if (!empty($failedSteps)) {
        $stepErrors = implode('; ', array_map(
            fn($s) => $s['name'] . ': ' . ($s['error'] ?? 'unknown'),
            $failedSteps
        ));
        cron_alert_failure(
            new RuntimeException($stepErrors),
            'Partial pipeline failure — ' . count($failedSteps) . ' step(s) failed'
        );
        cron_log('WARN  | ' . count($failedSteps) . ' step(s) failed: ' . $stepErrors);
    }

    // ── Penalty log sync ──────────────────────────────────────
    $penaltyResult = ['users' => 0, 'upserted' => 0, 'deleted' => 0];
    try {
        $penaltyResult = (new Penalty())->syncAllLogs();
    } catch (\Throwable $e) {
        cron_log('WARN  | Penalty syncAllLogs failed: ' . $e->getMessage());
    }

    // ── Telegram: F1 daily summary ───────────────────────────
    $tgSummaryResult = ['sent' => 0, 'errors' => 0];
    try {
        if (defined('TELEGRAM_BOT_TOKEN') && TELEGRAM_BOT_TOKEN !== '') {
            ob_start();
            $argv = [__FILE__];
            require __DIR__ . '/scripts/telegram_daily_summary.php';
            $tgOutput = ob_get_clean();
            preg_match('/sent=(\d+), errors=(\d+)/', $tgOutput, $m);
            $tgSummaryResult = ['sent' => (int)($m[1] ?? 0), 'errors' => (int)($m[2] ?? 0)];
        }
    } catch (\Throwable $e) {
        cron_log('WARN  | Telegram daily summary failed: ' . $e->getMessage());
    }

    // ── AI Provider health check ─────────────────────────────
    $aiHealthResult = [];
    try {
        if (defined('TELEGRAM_BOT_TOKEN') && TELEGRAM_BOT_TOKEN !== '') {
            $aiHealthResult = (new AiRouter())->runHealthCheck();
        }
    } catch (\Throwable $e) {
        cron_log('WARN  | AiRouter health check failed: ' . $e->getMessage());
    }

    $aiHealthStr = empty($aiHealthResult)
        ? 'skipped'
        : implode(',', array_map(fn($p, $s) => "{$p}:{$s}", array_keys($aiHealthResult), $aiHealthResult));

    // Format & emit summary
    $tgToday   = $summary['telegram_due_today_sent'] ?? 'n/a';
    $tgOverdue = $summary['telegram_overdue_sent']   ?? 'n/a';
    $elapsed   = round((microtime(true) - $startTime) * 1000);

    $summaryLine = sprintf(
        'OK    | new_notifs=%d · bills=%d · recurring=%d · asana=%s · queue=%d->%d · tg_today=%s · tg_overdue=%s · risk=%s · decisions=%d · approvals=%d · push=%d · penalties=%d · penalty_amount=%s · penalty_sync=u:%d,up:%d,del:%d · tg_summary=sent:%d,err:%d · ai_health=%s · cleanup=%d · activity=%d · stale=%d · %dms',
        $summary['notifications_created'],
        $summary['bills_reminded'],
        $summary['recurring_generated'],
        $summary['asana_synced'] ? 'yes' : 'no',
        $summary['email_queue_before'],
        $summary['email_queue_after'],
        $tgToday  === -1 ? 'skip' : $tgToday,
        $tgOverdue === -1 ? 'skip' : $tgOverdue,
        $summary['risk_score'] ?? 'n/a',
        $summary['decisions_generated']    ?? 0,
        $summary['approvals_queued']       ?? 0,
        $summary['push_items_queued']      ?? 0,
        $summary['penalties_applied']      ?? 0,
        number_format((float)($summary['penalties_total_amount'] ?? 0), 0, '.', ''),
        $penaltyResult['users'],
        $penaltyResult['upserted'],
        $penaltyResult['deleted'],
        $tgSummaryResult['sent'],
        $tgSummaryResult['errors'],
        $aiHealthStr,
        $summary['session_cleanup']        ?? 0,
        $summary['activity_logged']        ?? 0,
        $summary['stale_feed_cleared']     ?? 0,
        $elapsed
    );

    cron_log($summaryLine);
    echo $summaryLine . "\n";

    // Daily 8 AM heartbeat to Telegram
    $currentHour = (int) date('G');
    if ($currentHour === CRON_HEARTBEAT_HOUR || !empty($pipelineOptions['force_telegram'])) {
        cron_heartbeat_success($summary);
    }

    // Daily 2 AM — duplicate bill/task scanner (runs as subprocess to avoid define conflicts)
    if ($currentHour === 2) {
        $scanScript = __DIR__ . '/crons/DailyDuplicateTaskBillScanner.php';
        if (file_exists($scanScript)) {
            $phpBin = PHP_BINARY ?: 'php';
            exec(escapeshellcmd($phpBin) . ' ' . escapeshellarg($scanScript) . ' 2>&1', $scanOut, $scanCode);
            cron_log('DuplicateScanner | exit=' . $scanCode . ' lines=' . count($scanOut));
        }
    }

} catch (Throwable $e) {
    $elapsed = round((microtime(true) - $startTime) * 1000);
    $errLine = 'FAIL  | ' . $e->getMessage() . ' [' . $elapsed . 'ms]';

    cron_log($errLine);
    echo $errLine . "\n";

    cron_alert_failure($e);
    exit(1);
}
