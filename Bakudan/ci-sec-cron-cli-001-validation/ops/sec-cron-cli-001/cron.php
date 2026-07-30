<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

if (PHP_SAPI !== 'cli') {
    sec_cron_fail('CLI-only runner refused non-CLI execution', 2);
}

$args = array_slice($argv ?? [], 1);
$dryRun = in_array('--dry-run', $args, true);
$executeApproved = in_array('--execute-approved', $args, true);
$help = in_array('--help', $args, true) || in_array('-h', $args, true);

if ($help) {
    echo "Usage: php cron.php --dry-run | --execute-approved\n";
    exit(0);
}

$home = getenv('HOME') ?: dirname(__DIR__, 2);
$appRoot = getenv('TASKFLOW_APP_ROOT') ?: $home . '/dashboard.bakudanramen.com';
$privateRoot = getenv('TASKFLOW_PRIVATE_ROOT') ?: $home . '/taskflow-private';
$envFile = getenv('TASKFLOW_PRIVATE_ENV') ?: $privateRoot . '/config/production.env';
$logFile = getenv('TASKFLOW_CRON_LOG') ?: $privateRoot . '/logs/cron.jsonl';
$lockFile = getenv('TASKFLOW_CRON_LOCK') ?: $privateRoot . '/locks/cron.lock';
$lockTtl = (int)(getenv('TASKFLOW_CRON_LOCK_TTL') ?: 7200);
$runId = 'sec-cron-cli-001-' . gmdate('Ymd\THis\Z') . '-' . bin2hex(random_bytes(4));

if (!$dryRun && !$executeApproved) {
    sec_cron_fail('real execution requires --execute-approved and CEO activation boundary', 64);
}
if (!$dryRun && getenv('SEC_CRON_CLI_001_APPROVED') !== '1') {
    sec_cron_fail('real execution requires SEC_CRON_CLI_001_APPROVED=1 in private environment', 65);
}

$started = microtime(true);
$lockAcquired = false;
$lockHandle = null;
$exitCode = 0;

try {
    $lock = sec_cron_acquire_lock($lockFile, $lockTtl);
    $lockAcquired = true;
    $lockHandle = $lock['handle'] ?? null;

    if (function_exists('pcntl_async_signals') && function_exists('pcntl_signal')) {
        pcntl_async_signals(true);
        $signalHandler = function (int $signal) use ($lockFile, &$lockHandle, $logFile, $runId): void {
            sec_cron_log($logFile, [
                'run_id' => $runId,
                'event' => 'signal',
                'signal' => $signal,
            ]);
            sec_cron_release_lock($lockFile, $lockHandle);
            exit(128 + $signal);
        };
        pcntl_signal(SIGTERM, $signalHandler);
        pcntl_signal(SIGINT, $signalHandler);
    }

    sec_cron_log($logFile, [
        'run_id' => $runId,
        'event' => 'start',
        'mode' => $dryRun ? 'dry-run' : 'real',
        'pid' => $lock['pid'] ?? getmypid(),
    ]);

    $identity = sec_cron_bootstrap_app($appRoot, $envFile);
    $jobs = sec_cron_job_catalog();

    $required = [
        $appRoot . '/scripts/run_notifications.php',
        $appRoot . '/config/database.php',
        $appRoot . '/config/telegram.php',
        $appRoot . '/models/Penalty.php',
        $appRoot . '/models/AiRouter.php',
        $appRoot . '/crons/DailyDuplicateTaskBillScanner.php',
    ];
    foreach ($required as $file) {
        if (!is_file($file)) {
            sec_cron_fail('required dependency missing: ' . basename($file), 66);
        }
    }

    if ($dryRun) {
        $pdo = Database::getInstance()->getConnection();
        $pdo->query('SELECT 1')->fetchColumn();
        sec_cron_log($logFile, [
            'run_id' => $runId,
            'event' => 'dry_run_pass',
            'database' => $identity['database'],
            'job_count' => count($jobs),
            'external_sends' => 'none',
            'database_writes' => 'none',
        ]);
        echo json_encode([
            'status' => 'PASS',
            'mode' => 'dry-run',
            'run_id' => $runId,
            'app_env' => $identity['app_env'],
            'database' => $identity['database'],
            'jobs' => array_column($jobs, 'name'),
            'external_sends' => 'none',
            'database_writes' => 'none',
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;
        exit(0);
    }

    require_once $appRoot . '/scripts/run_notifications.php';
    require_once $appRoot . '/config/telegram.php';
    require_once $appRoot . '/models/Penalty.php';
    require_once $appRoot . '/models/AiRouter.php';
    require_once $appRoot . '/models/TelegramAiTools.php';
    require_once $appRoot . '/models/TelegramBot.php';

    $results = [];
    $runJob = function (string $name, callable $fn) use (&$results, $logFile, $runId, &$exitCode): void {
        $t0 = microtime(true);
        try {
            $result = $fn();
            $results[] = ['name' => $name, 'status' => 'ok', 'duration_ms' => (int)round((microtime(true) - $t0) * 1000)];
            sec_cron_log($logFile, ['run_id' => $runId, 'event' => 'job_ok', 'job' => $name, 'result' => is_scalar($result) ? (string)$result : 'structured']);
        } catch (Throwable $e) {
            $exitCode = 1;
            $results[] = ['name' => $name, 'status' => 'error', 'duration_ms' => (int)round((microtime(true) - $t0) * 1000), 'error' => sec_cron_sanitize($e->getMessage())];
            sec_cron_log($logFile, ['run_id' => $runId, 'event' => 'job_error', 'job' => $name, 'error' => $e->getMessage()]);
        }
    };

    $summary = [];
    $runJob('notification_pipeline', function () use (&$summary) {
        $summary = taskflow_run_notification_pipeline([]);
        return 'summary';
    });
    $runJob('penalty_log_sync', function () {
        return json_encode((new Penalty())->syncAllLogs(), JSON_UNESCAPED_SLASHES);
    });
    $runJob('telegram_daily_summary', function () use ($appRoot) {
        ob_start();
        $argv = [$appRoot . '/scripts/telegram_daily_summary.php'];
        require $appRoot . '/scripts/telegram_daily_summary.php';
        return trim((string)ob_get_clean());
    });
    $runJob('ai_provider_health', function () {
        return json_encode((new AiRouter())->runHealthCheck(), JSON_UNESCAPED_SLASHES);
    });
    $runJob('duplicate_scan', function () use ($appRoot) {
        if ((int)date('G') !== 2) {
            return 'skipped-hour';
        }
        $scanScript = $appRoot . '/crons/DailyDuplicateTaskBillScanner.php';
        exec(escapeshellcmd(PHP_BINARY ?: 'php') . ' ' . escapeshellarg($scanScript) . ' 2>&1', $out, $code);
        if ($code !== 0) {
            throw new RuntimeException('duplicate scanner exit=' . $code . ' lines=' . count($out));
        }
        return 'exit=0 lines=' . count($out);
    });

    sec_cron_log($logFile, [
        'run_id' => $runId,
        'event' => 'finish',
        'exit_code' => $exitCode,
        'duration_ms' => (int)round((microtime(true) - $started) * 1000),
    ]);

    echo json_encode([
        'status' => $exitCode === 0 ? 'PASS' : 'DEGRADED',
        'run_id' => $runId,
        'jobs' => $results,
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;
    exit($exitCode);
} catch (Throwable $e) {
    $exitCode = $exitCode ?: 1;
    sec_cron_log($logFile, [
        'run_id' => $runId,
        'event' => 'fatal',
        'error' => $e->getMessage(),
        'duration_ms' => (int)round((microtime(true) - $started) * 1000),
    ]);
    fwrite(STDERR, '[SEC-CRON-CLI-001] ' . sec_cron_sanitize($e->getMessage()) . PHP_EOL);
    exit($exitCode);
} finally {
    if ($lockAcquired) {
        sec_cron_release_lock($lockFile, $lockHandle);
    }
}
