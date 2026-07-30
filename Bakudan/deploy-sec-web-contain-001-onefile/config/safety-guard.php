<?php
/**
 * Environment Safety Guard — CEO Directive Dashboard Safety
 * ==========================================================
 * Included by config/database.php to enforce data protection rules.
 * Blocks destructive commands in production/staging environments.
 *
 * Guard Rules:
 *   - Blocks: DROP TABLE, TRUNCATE, DELETE mass data, RESET, seed reset
 *   - Allowed in non-production: add nullable columns, add new tables, add indexes
 *   - Requires ALLOW_DESTRUCTIVE_MIGRATION=true env var to bypass
 *
 * No .env required — safe to include even when DB credentials are missing.
 */

define('SAFETY_LOG', __DIR__ . '/../logs/safety-guard.log');

// ── Detect environment ────────────────────────────────────────────────────────
function safety_env_files(): array {
    $candidates = [];
    $forcedFile = getenv('APP_ENV_FILE') ?: ($_SERVER['APP_ENV_FILE'] ?? '');
    if ($forcedFile !== '') {
        $candidates[] = $forcedFile;
    }

    $host = strtolower($_SERVER['HTTP_HOST'] ?? '');
    // Match subdomains: preview.dashboard..., draft.dashboard..., staging.dashboard...
    // Must NOT match dashboard.bakudanramen.com (which contains 'preview' substring)
    if ($host !== '' && (
        preg_match('/^(preview|draft|staging)\./', $host) ||
        str_ends_with($host, '.preview.dashboard.bakudanramen.com')
    )) {
        $candidates[] = __DIR__ . '/../.env.preview';
    }

    $candidates[] = __DIR__ . '/../.env';
    return array_values(array_unique($candidates));
}

function safety_read_env_value(string $targetKey): ?string {
    foreach (safety_env_files() as $envFile) {
        if (!$envFile || !file_exists($envFile)) continue;
        foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            $line = trim($line);
            if ($line === '' || $line[0] === '#' || strpos($line, '=') === false) continue;
            [$key, $value] = explode('=', $line, 2);
            if (trim($key) !== $targetKey) continue;
            $value = trim($value);
            if (preg_match('/^(["\'])(.*)\\1$/', $value, $m)) $value = $m[2];
            return $value;
        }
    }
    return null;
}

function safety_get_env(): string {
    static $loaded = false;
    static $env = 'unknown';
    if ($loaded) return $env;
    $loaded = true;

    $envFromFile = safety_read_env_value('APP_ENV');
    if ($envFromFile !== null && $envFromFile !== '') {
        $env = $envFromFile;
        return $env;
    }

    $host = $_SERVER['HTTP_HOST'] ?? '';
    if (str_contains($host, 'preview') || str_contains($host, 'draft') || str_contains($host, 'staging')) {
        $env = 'staging';
    } elseif (str_contains($host, 'localhost') || str_contains($host, '127.0.0.1')) {
        $env = 'local';
    } else {
        $env = 'production';
    }
    return $env;
}

function safety_get_db_name(): string {
    if (defined('DB_NAME')) return DB_NAME;
    return safety_read_env_value('DB_NAME') ?? 'unknown';
}

function safety_get_db_host(): string {
    if (defined('DB_HOST')) return DB_HOST;
    return safety_read_env_value('DB_HOST') ?? 'unknown';
}

function safety_log(string $level, string $message, array $context = []): void {
    $dir = dirname(SAFETY_LOG);
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    $contextStr = $context ? ' | ' . json_encode($context, JSON_UNESCAPED_SLASHES) : '';
    $entry = sprintf(
        "[%s] [%s] %s%s\n",
        date('Y-m-d H:i:s'),
        strtoupper($level),
        $message,
        $contextStr
    );
    @file_put_contents(SAFETY_LOG, $entry, FILE_APPEND | LOCK_EX);
}

// ── Dangerous command patterns ─────────────────────────────────────────────────
function safety_get_dangerous_patterns(): array {
    return [
        '/\bDROP\s+TABLE\b/i',
        '/\bDROP\s+INDEX\b/i',
        '/\bTRUNCATE\b/i',
        '/\bDELETE\s+FROM\s+\w+\s*WHERE\s*1\s*=\s*1\b/i',
        '/\bDELETE\s+FROM\s+\w+\s*;?\s*$/im',
        '/\bRESET\s+(MASTER|SLAVE|REPLICA|QUERY\s+CACHE)\b/i',
        '/\bSHUTDOWN\b/i',
        '/\bKILL\b/i',
        '/\bGRANT\s+ALL\b/i',
        '/\bREVOKE\s+ALL\b/i',
        '/\bALTER\s+TABLE\s+\w+\s+DROP\b/i',
        '/\bALTER\s+TABLE\s+\w+\s+RENAME\b/i',
        '/\bALTER\s+TABLE\s+\w+\s+MODIFY\s+COLUMN\b/i',
        '/\bREPLACE\s+INTO\s+seed/i',
        '/--\s*BEGIN\s*SEED/i',
        '/\bREINDEX\b/i',
        '/\bOPTIMIZE\s+TABLE\b.*\bcredentials\b/i',
        '/\bOPTIMIZE\s+TABLE\b.*\busers\b/i',
    ];
}

// Tables that are absolutely protected — never allow DELETE/DROP/TRUNCATE
function safety_get_protected_tables(): array {
    return [
        'tasks', 'users', 'comments', 'attachments', 'files', 'images',
        'credentials', 'credential_permissions', 'task_approval_events',
        'audit_logs', 'notifications', 'stores', 'projects',
        'bills', 'employees', 'shifts',
    ];
}

function safety_bypass_allowed(): bool {
    $value = safety_read_env_value('ALLOW_DESTRUCTIVE_MIGRATION');
    if ($value !== null) {
        return strtolower($value) === 'true';
    }
    return strtolower(getenv('ALLOW_DESTRUCTIVE_MIGRATION') ?: '') === 'true';
}

/**
 * Check a string for dangerous patterns.
 * Returns array of matched dangerous patterns, or empty array if safe.
 */
function safety_check_string(string $input): array {
    $matched = [];
    foreach (safety_get_dangerous_patterns() as $pattern) {
        if (preg_match($pattern, $input, $m)) {
            $matched[] = $m[0];
        }
    }
    return $matched;
}

/**
 * Check if a SQL statement touches a protected table.
 */
function safety_touches_protected_table(string $sql): bool {
    foreach (safety_get_protected_tables() as $table) {
        if (preg_match("/\b(FROM|UPDATE|INTO|TABLE)\s+`?" . preg_quote($table, '/') . "`?/i", $sql)) {
            return true;
        }
    }
    return false;
}

/**
 * Full safety check — returns ['blocked' => bool, 'reason' => string, 'patterns' => array]
 */
function safety_check(string $sql, string $operation = 'query'): array {
    $env = safety_get_env();
    $isProtected = in_array($env, ['production', 'staging'], true);
    $isPreviewDb = str_contains(strtolower(safety_get_db_name()), 'preview');

    if (!$isProtected) {
        $envName = $env;
        return [
            'blocked' => false,
            'reason' => "Environment '{$envName}' is not protected — destructive commands allowed",
            'patterns' => [],
        ];
    }

    // Bypass check requires explicit env var
    if (safety_bypass_allowed()) {
        safety_log('WARN', 'Destructive migration BYPASS active — production/staging', [
            'env' => $env,
            'sql_preview' => substr(trim($sql), 0, 80),
        ]);
        return [
            'blocked' => false,
            'reason' => 'BYPASS: ALLOW_DESTRUCTIVE_MIGRATION=true is set',
            'patterns' => [],
        ];
    }

    // Check for dangerous patterns
    $matchedPatterns = safety_check_string($sql);
    if (!empty($matchedPatterns)) {
        safety_log('BLOCK', 'Dangerous pattern detected in protected environment', [
            'env' => $env,
            'operation' => $operation,
            'matched' => $matchedPatterns,
            'sql_preview' => substr(trim($sql), 0, 100),
        ]);
        return [
            'blocked' => true,
            'reason' => 'Blocked: dangerous SQL pattern in ' . $env . ' environment. '
                      . 'Matched: ' . implode(', ', $matchedPatterns),
            'patterns' => $matchedPatterns,
        ];
    }

    // Allow normal preview sandbox writes when using a dedicated preview DB.
    if ($env === 'staging' && $isPreviewDb && in_array(strtolower($operation), ['update', 'delete', 'insert'], true)) {
        safety_log('INFO', 'Preview sandbox write allowed on isolated preview DB', [
            'env' => $env,
            'db' => safety_get_db_name(),
            'operation' => $operation,
            'sql_preview' => substr(trim($sql), 0, 100),
        ]);
        return [
            'blocked' => false,
            'reason' => 'Approved: isolated preview DB write allowed',
            'patterns' => [],
        ];
    }

    // Block mass/unguarded DELETE on protected tables (no WHERE clause = wipes whole table).
    // Targeted deletes with WHERE (normal app flow: delete task by id, etc.) are allowed.
    // Dangerous patterns (DROP, TRUNCATE, DELETE without WHERE) are already caught above.
    if (strtolower($operation) === 'delete' && safety_touches_protected_table($sql)) {
        // Allow targeted deletes that have a WHERE clause — these are normal app operations
        $hasWhere = preg_match('/\bWHERE\b/i', $sql);
        if (!$hasWhere) {
            safety_log('BLOCK', 'Mass DELETE (no WHERE) on protected table blocked', [
                'env' => $env,
                'db' => safety_get_db_name(),
                'operation' => $operation,
                'sql_preview' => substr(trim($sql), 0, 100),
            ]);
            return [
                'blocked' => true,
                'reason' => 'Blocked: mass DELETE (no WHERE) on protected table in ' . $env
                          . '. Requires ALLOW_DESTRUCTIVE_MIGRATION=true to proceed.',
                'patterns' => [],
            ];
        }
    }

    return [
        'blocked' => false,
        'reason' => 'Approved',
        'patterns' => [],
    ];
}

/**
 * Generic query guard. Blocks dangerous statements in protected environments.
 */
function safety_guard_query(string $sql, array $params, PDO $pdo, string $operation = 'query'): PDOStatement {
    $result = safety_check($sql, $operation);
    if ($result['blocked']) {
        $msg = '[SAFETY] BLOCKED ' . $operation . ': ' . $result['reason'];
        error_log($msg);
        if (php_sapi_name() === 'cli') {
            fwrite(STDERR, "ERROR: $msg\n");
        }
        throw new RuntimeException('SAFETY GUARD: ' . $result['reason']);
    }
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt;
}

/**
 * Wrapper for Database::update() — call before every UPDATE/DELETE.
 * Usage: safety_guard_update($sql, $params, $pdo)
 */
function safety_guard_update(string $sql, array $params, PDO $pdo): int {
    $result = safety_check($sql, 'update');
    if ($result['blocked']) {
        $msg = '[SAFETY] BLOCKED update: ' . $result['reason'];
        error_log($msg);
        if (php_sapi_name() === 'cli') {
            fwrite(STDERR, "ERROR: $msg\n");
        }
        throw new RuntimeException('SAFETY GUARD: ' . $result['reason']);
    }
    $stmt = safety_guard_query($sql, $params, $pdo, 'update');
    return $stmt->rowCount();
}

/**
 * Wrapper for Database::delete() — call before every DELETE.
 */
function safety_guard_delete(string $sql, array $params, PDO $pdo): int {
    $result = safety_check($sql, 'delete');
    if ($result['blocked']) {
        $msg = '[SAFETY] BLOCKED delete: ' . $result['reason'];
        error_log($msg);
        if (php_sapi_name() === 'cli') {
            fwrite(STDERR, "ERROR: $msg\n");
        }
        throw new RuntimeException('SAFETY GUARD: ' . $result['reason']);
    }
    $stmt = safety_guard_query($sql, $params, $pdo, 'delete');
    return $stmt->rowCount();
}
