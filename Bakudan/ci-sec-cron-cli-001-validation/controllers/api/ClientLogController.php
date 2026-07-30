<?php
/**
 * ClientLogController — Receives frontend error reports.
 *
 * POST /api/client-log
 * Body (JSON): { kind, message, stack, context, path, ts }
 *
 * Rate-limited: max 30 reports per session per minute.
 * Logs to: logs/frontend.log (structured, rotated at 5MB)
 */
class ClientLogController
{
    private const LOG_DIR = __DIR__ . '/../../logs';
    private const LOG_FILE = 'frontend.log';
    private const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    private const RATE_LIMIT = 30; // per minute per session
    private const MAX_BODY_SIZE = 4096; // bytes

    public function store(): void
    {
        header('Content-Type: application/json');

        // Rate limiting via session
        if (session_status() !== PHP_SESSION_ACTIVE) {
            @session_start();
        }
        $now = time();
        $window = $_SESSION['_client_log_window'] ?? 0;
        $count = $_SESSION['_client_log_count'] ?? 0;

        if ($now - $window > 60) {
            $_SESSION['_client_log_window'] = $now;
            $_SESSION['_client_log_count'] = 0;
            $count = 0;
        }

        if ($count >= self::RATE_LIMIT) {
            http_response_code(429);
            echo json_encode(['error' => 'Rate limited']);
            return;
        }

        $_SESSION['_client_log_count'] = $count + 1;

        // Read and validate body
        $raw = file_get_contents('php://input');
        if (strlen($raw) > self::MAX_BODY_SIZE) {
            $raw = substr($raw, 0, self::MAX_BODY_SIZE);
        }

        $data = json_decode($raw, true);
        if (!is_array($data)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid JSON']);
            return;
        }

        // Sanitize fields
        $entry = [
            'kind'    => $this->sanitize($data['kind'] ?? 'unknown', 50),
            'message' => $this->sanitize($data['message'] ?? '', 500),
            'stack'   => $this->sanitize($data['stack'] ?? '', 1600),
            'path'    => $this->sanitize($data['path'] ?? '', 200),
            'context' => is_array($data['context'] ?? null) ? array_slice($data['context'], 0, 10) : [],
            'ts'      => $this->sanitize($data['ts'] ?? '', 30),
            'user_id' => $_SESSION['user_id'] ?? null,
            'ip'      => $_SERVER['REMOTE_ADDR'] ?? null,
            'ua'      => $this->sanitize($_SERVER['HTTP_USER_AGENT'] ?? '', 200),
        ];

        $this->writeLog($entry);

        // Also log to ProductionLogger if available
        if (class_exists('ProductionLogger')) {
            ProductionLogger::warning('FRONTEND', $entry['kind'] . ': ' . $entry['message'], [
                'path'    => $entry['path'],
                'stack'   => substr($entry['stack'], 0, 300),
                'context' => $entry['context'],
            ]);
        }

        http_response_code(204);
    }

    private function writeLog(array $entry): void
    {
        $dir = self::LOG_DIR;
        $path = $dir . '/' . self::LOG_FILE;

        if (!is_dir($dir)) {
            @mkdir($dir, 0755, true);
        }

        // Auto-rotate
        if (file_exists($path) && filesize($path) > self::MAX_SIZE) {
            @rename($path, $path . '.1');
        }

        $timestamp = date('Y-m-d H:i:s');
        $json = json_encode($entry, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $line = "[{$timestamp}] [FRONTEND] [{$entry['kind']}] {$entry['message']} {$json}" . PHP_EOL;

        @file_put_contents($path, $line, FILE_APPEND | LOCK_EX);
    }

    private function sanitize(?string $value, int $maxLen): string
    {
        if ($value === null) return '';
        // Strip control characters except newline/tab
        $clean = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', $value);
        return mb_substr($clean, 0, $maxLen);
    }
}
