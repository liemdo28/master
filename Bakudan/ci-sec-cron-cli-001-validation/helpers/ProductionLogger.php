<?php
/**
 * ProductionLogger — structured logging for critical operations.
 *
 * Format: [YYYY-MM-DD HH:MM:SS] [LEVEL] [CHANNEL] message {context_json}
 * Channels: RECURRENCE, TASK_COMPLETE, CALENDAR, SSE, PERMISSION, AUTH
 * Levels: DEBUG, INFO, WARNING, ERROR, CRITICAL
 *
 * Auto-rotates when log file exceeds 10MB.
 */
class ProductionLogger
{
    private static ?string $requestId = null;

    private const LOG_DIR = __DIR__ . '/../logs';
    private const LOG_FILE = 'app.log';
    private const MAX_SIZE = 10 * 1024 * 1024; // 10MB

    private const VALID_LEVELS = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'];
    private const VALID_CHANNELS = ['RECURRENCE', 'TASK_COMPLETE', 'CALENDAR', 'SSE', 'PERMISSION', 'AUTH', 'FRONTEND', 'API', 'QUEUE', 'TASK', 'VALIDATION', 'PERFORMANCE'];

    // ── Public API ───────────────────────────────────────────────────────

    public static function debug(string $channel, string $message, array $context = []): void
    {
        self::log('DEBUG', $channel, $message, $context);
    }

    public static function info(string $channel, string $message, array $context = []): void
    {
        self::log('INFO', $channel, $message, $context);
    }

    public static function warning(string $channel, string $message, array $context = []): void
    {
        self::log('WARNING', $channel, $message, $context);
    }

    public static function error(string $channel, string $message, array $context = []): void
    {
        self::log('ERROR', $channel, $message, $context);
    }

    public static function critical(string $channel, string $message, array $context = []): void
    {
        self::log('CRITICAL', $channel, $message, $context);
    }

    // ── Core ─────────────────────────────────────────────────────────────

    private static function log(string $level, string $channel, string $message, array $context): void
    {
        $level = strtoupper($level);
        $channel = strtoupper($channel);

        if (!in_array($level, self::VALID_LEVELS, true)) {
            $level = 'INFO';
        }
        if (!in_array($channel, self::VALID_CHANNELS, true)) {
            $channel = 'AUTH'; // fallback
        }

        // Enrich context
        $context['request_id'] = self::getRequestId();
        $context['user_id'] = $context['user_id'] ?? self::getUserId();

        $timestamp = date('Y-m-d H:i:s');
        $contextJson = json_encode($context, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        $line = "[{$timestamp}] [{$level}] [{$channel}] {$message} {$contextJson}" . PHP_EOL;

        self::write($line);
    }

    private static function write(string $line): void
    {
        $dir = self::LOG_DIR;
        $path = $dir . '/' . self::LOG_FILE;

        // Ensure log directory exists
        if (!is_dir($dir)) {
            @mkdir($dir, 0755, true);
        }

        // Auto-rotate if file exceeds max size
        if (file_exists($path) && filesize($path) > self::MAX_SIZE) {
            $rotated = $path . '.1';
            @rename($path, $rotated);
        }

        @file_put_contents($path, $line, FILE_APPEND | LOCK_EX);
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private static function getRequestId(): string
    {
        if (self::$requestId === null) {
            self::$requestId = uniqid('req_', true);
        }
        return self::$requestId;
    }

    private static function getUserId(): ?int
    {
        if (session_status() === PHP_SESSION_ACTIVE && !empty($_SESSION['user_id'])) {
            return (int) $_SESSION['user_id'];
        }
        return null;
    }
}
