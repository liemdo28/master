<?php
declare(strict_types=1);

function sec_cron_fail(string $message, int $code = 1): never
{
    fwrite(STDERR, '[SEC-CRON-CLI-001] ' . $message . PHP_EOL);
    exit($code);
}

function sec_cron_sanitize(string $message): string
{
    $message = preg_replace('/([?&](key|secret|token)=)[^&\s]+/i', '$1<redacted>', $message) ?? $message;
    $message = preg_replace('/(password|passwd|pwd|token|secret|key)\s*=\s*[^\s;]+/i', '$1=<redacted>', $message) ?? $message;
    return str_replace(["\r", "\n"], ' ', $message);
}

function sec_cron_load_private_env(string $envFile, string $appRoot): void
{
    $envReal = realpath($envFile);
    $rootReal = realpath($appRoot);

    if ($envReal === false || !is_file($envReal)) {
        sec_cron_fail('private environment file is missing');
    }
    if ($rootReal === false || !is_dir($rootReal)) {
        sec_cron_fail('application root is missing');
    }
    if (str_starts_with($envReal, rtrim($rootReal, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR)) {
        sec_cron_fail('private environment file resolves inside public application root');
    }

    $lines = file($envReal, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) {
        sec_cron_fail('private environment file is not readable');
    }

    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#' || strpos($line, '=') === false) {
            continue;
        }
        [$key, $value] = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value);
        if ($key === '' || !preg_match('/^[A-Z0-9_]+$/', $key)) {
            continue;
        }
        if (preg_match('/^(["\'])(.*)\1$/', $value, $m)) {
            $value = $m[2];
        }
        $_ENV[$key] = $value;
        putenv($key . '=' . $value);
    }

    $_ENV['APP_ENV_FILE'] = $envReal;
    $_SERVER['APP_ENV_FILE'] = $envReal;
    putenv('APP_ENV_FILE=' . $envReal);
}

function sec_cron_bootstrap_app(string $appRoot, string $envFile): array
{
    if (PHP_SAPI !== 'cli') {
        sec_cron_fail('CLI-only runner refused non-CLI execution', 2);
    }

    sec_cron_load_private_env($envFile, $appRoot);

    $_SERVER['HTTP_HOST'] = '';
    $_SERVER['REQUEST_URI'] = '';
    $_SERVER['SERVER_NAME'] = 'SEC-CRON-CLI-001';

    require_once rtrim($appRoot, DIRECTORY_SEPARATOR) . '/config/database.php';

    $resolved = getenv('APP_ENV_FILE_RESOLVED') ?: '';
    $expected = realpath($envFile) ?: $envFile;
    if ($resolved !== $expected) {
        sec_cron_fail('database config did not resolve the private environment file');
    }
    if (!defined('APP_ENV') || APP_ENV !== 'production') {
        sec_cron_fail('APP_ENV is not production');
    }

    $pdo = Database::getInstance()->getConnection();
    $database = (string)$pdo->query('SELECT DATABASE()')->fetchColumn();
    $expectedDb = getenv('TASKFLOW_EXPECTED_DB_NAME') ?: (defined('DB_NAME') ? DB_NAME : '');
    if ($expectedDb === '' || $database !== $expectedDb) {
        sec_cron_fail('database identity assertion failed');
    }

    return [
        'database' => $database,
        'env_file' => $expected,
        'app_env' => APP_ENV,
    ];
}

function sec_cron_log(string $logFile, array $event): void
{
    $dir = dirname($logFile);
    if (!is_dir($dir)) {
        mkdir($dir, 0700, true);
    }
    $event['ts'] = $event['ts'] ?? date('c');
    foreach ($event as $key => $value) {
        if (is_string($value)) {
            $event[$key] = sec_cron_sanitize($value);
        }
    }
    file_put_contents($logFile, json_encode($event, JSON_UNESCAPED_SLASHES) . PHP_EOL, FILE_APPEND | LOCK_EX);
}

function sec_cron_acquire_lock(string $lockFile, int $ttlSeconds): array
{
    $dir = dirname($lockFile);
    if (!is_dir($dir)) {
        mkdir($dir, 0700, true);
    }

    $handle = fopen($lockFile, 'c+');
    if ($handle === false) {
        sec_cron_fail('lock file is not writable', 73);
    }
    if (!flock($handle, LOCK_EX | LOCK_NB)) {
        fclose($handle);
        sec_cron_fail('another cron run holds the lock', 75);
    }

    $now = time();
    $raw = stream_get_contents($handle);
    if (is_string($raw) && trim($raw) !== '') {
        $data = json_decode($raw, true);
        $started = isset($data['started_at_epoch']) ? (int)$data['started_at_epoch'] : (int)filemtime($lockFile);
        if ($started > 0 && ($now - $started) < $ttlSeconds) {
            flock($handle, LOCK_UN);
            fclose($handle);
            sec_cron_fail('another cron run appears active', 75);
        }
    }

    $payload = [
        'pid' => getmypid(),
        'started_at' => date('c', $now),
        'started_at_epoch' => $now,
        'lock_file' => $lockFile,
        'handle' => $handle,
    ];
    rewind($handle);
    ftruncate($handle, 0);
    fwrite($handle, json_encode(array_diff_key($payload, ['handle' => true]), JSON_UNESCAPED_SLASHES));
    fflush($handle);
    chmod($lockFile, 0600);

    return $payload;
}

function sec_cron_release_lock(string $lockFile, $handle = null): void
{
    if (is_resource($handle)) {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
    if (is_file($lockFile)) {
        unlink($lockFile);
    }
}

function sec_cron_job_catalog(): array
{
    return [
        ['name' => 'notification_pipeline', 'current_function' => 'taskflow_run_notification_pipeline', 'reads' => true, 'writes' => true, 'external' => 'email/Telegram/Asana conditional', 'failure' => 'step-isolated in existing pipeline'],
        ['name' => 'penalty_log_sync', 'current_function' => 'Penalty::syncAllLogs', 'reads' => true, 'writes' => true, 'external' => 'none', 'failure' => 'isolated warning'],
        ['name' => 'telegram_daily_summary', 'current_function' => 'scripts/telegram_daily_summary.php', 'reads' => true, 'writes' => true, 'external' => 'Telegram', 'failure' => 'isolated warning'],
        ['name' => 'ai_provider_health', 'current_function' => 'AiRouter::runHealthCheck', 'reads' => true, 'writes' => false, 'external' => 'AI providers', 'failure' => 'isolated warning'],
        ['name' => 'heartbeat', 'current_function' => 'cron_heartbeat_success equivalent', 'reads' => true, 'writes' => false, 'external' => 'Telegram', 'failure' => 'isolated warning'],
        ['name' => 'duplicate_scan', 'current_function' => 'crons/DailyDuplicateTaskBillScanner.php', 'reads' => true, 'writes' => true, 'external' => 'none', 'failure' => 'isolated subprocess result'],
    ];
}
