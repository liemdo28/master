<?php
/**
 * Database Configuration
 * Loads from .env file if present, falls back to hardcoded defaults.
 * IMPORTANT: Create a .env file in the project root for production.
 * Never commit real credentials — use .env.example as template.
 */

require_once __DIR__ . '/safety-guard.php';

// Load environment file if it exists (simple parser, no external dependency)
(function () {
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

    $envFile = null;
    foreach ($candidates as $candidate) {
        if ($candidate && file_exists($candidate)) {
            $envFile = $candidate;
            break;
        }
    }
    if ($envFile === null) return;

    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') continue;
        if (strpos($line, '=') === false) continue;
        [$key, $value] = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value);
        // Remove surrounding quotes if present
        if (preg_match('/^(["\'])(.*)\\1$/', $value, $m)) $value = $m[2];
        $existing = getenv($key);
        if ($existing === false || $existing === '') {
            $_ENV[$key] = $value;
            putenv("$key=$value");
        } elseif (!array_key_exists($key, $_ENV)) {
            $_ENV[$key] = $existing;
        }
    }

    $_ENV['APP_ENV_FILE_RESOLVED'] = $envFile;
    putenv('APP_ENV_FILE_RESOLVED=' . $envFile);
})();

define('DB_HOST', $_ENV['DB_HOST'] ?? getenv('DB_HOST') ?: 'mysql-taskflow.bakudanramen.com');
define('DB_PORT', (int) ($_ENV['DB_PORT'] ?? getenv('DB_PORT') ?: 3306));
define('DB_NAME', $_ENV['DB_NAME'] ?? getenv('DB_NAME') ?: 'taskflow_db');
define('DB_USER', $_ENV['DB_USER'] ?? getenv('DB_USER') ?: 'liemdo');
define('DB_PASS', $_ENV['DB_PASS'] ?? getenv('DB_PASS') ?: '');
define('DB_CHARSET', $_ENV['DB_CHARSET'] ?? getenv('DB_CHARSET') ?: 'utf8mb4');
define('APP_ENV', $_ENV['APP_ENV'] ?? getenv('APP_ENV') ?: safety_get_env());

/**
 * FAIL-FAST: Refuse to start if DB credentials are missing in production.
 * This catches the case where .env was not deployed (gitignore'd),
 * preventing silent "using password: NO" failures.
 */
(function () {
    // Only enforce in production-like environments (not CLI test/dev)
    $isCli = php_sapi_name() === 'cli';
    $isLocalhost = in_array($_SERVER['HTTP_HOST'] ?? '', ['localhost', '127.0.0.1'], true);
    if ($isCli && $isLocalhost) return;

    $missing = [];
    if (empty(DB_PASS)) $missing[] = 'DB_PASS';
    if (empty(DB_HOST)) $missing[] = 'DB_HOST';
    if (empty(DB_NAME)) $missing[] = 'DB_NAME';
    if (empty(DB_USER)) $missing[] = 'DB_USER';

    if ($missing) {
        error_log('[CONFIG] Missing required environment variables: ' . implode(', ', $missing)
            . ' — check .env file is deployed on the server');

        // Sanitized production response — never leak credential names or paths
        if (!headers_sent()) {
            http_response_code(503);
            header('Content-Type: ' . (str_starts_with($_SERVER['REQUEST_URI'] ?? '', '/api/') ? 'application/json' : 'text/html'));
        }

        if (str_starts_with($_SERVER['REQUEST_URI'] ?? '', '/api/')) {
            echo json_encode(['error' => 'Service temporarily unavailable', 'code' => 'E_MISCONFIG']);
        } else {
            echo '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
            <title>Service Unavailable</title>
            <style>body{font-family:system-ui,sans-serif;background:#09090b;color:#f4f4f5;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
            .card{background:#18181b;border:1px solid #27272a;border-radius:12px;padding:40px;max-width:520px;width:100%;text-align:center}
            h1{color:#f87171;margin:0 0 12px;font-size:24px}p{color:#a1a1aa;margin:8px 0;font-size:14px}
            a{color:#60a5fa;text-decoration:none;font-size:14px;display:inline-block;margin-top:20px;padding:10px 24px;background:#1e3a5f;border-radius:8px}
            </style></head>
            <body><div class="card">
            <h1>&#9888; Service Unavailable</h1>
            <p>The application is misconfigured and cannot start.</p>
            <p>This issue has been logged. Please contact support if it persists.</p>
            <a href="/">&#127968; Dashboard</a>
            </div></body></html>';
        }
        exit(1);
    }
})();

// Application settings
define('APP_NAME', 'TaskFlow');

// Auto-detect APP_URL: use .env first, localhost for local dev, production as fallback.
(function () {
    $envUrl = $_ENV['APP_URL'] ?? getenv('APP_URL') ?: '';
    if ($envUrl !== '') {
        define('APP_URL', rtrim($envUrl, '/'));
        return;
    }

    $host = $_SERVER['HTTP_HOST'] ?? '';
    if (str_starts_with($host, 'localhost') || str_starts_with($host, '127.0.0.1')) {
        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        define('APP_URL', $scheme . '://' . $host);
    } else {
        define('APP_URL', 'https://dashboard.bakudanramen.com');
    }
})();

define('APP_VERSION', '2.3.0');   // SmartEngine V2 + Team Control Center + Visual Intelligence layer
define('UPLOAD_DIR', __DIR__ . '/../uploads/');
define('MAX_UPLOAD_SIZE', 10 * 1024 * 1024); // 10MB

// Minimum runtime versions — enforced in index.php bootstrap
define('REQUIRED_PHP_VERSION',   '8.0.0');   // match(), str_starts_with(), arrow fn
define('REQUIRED_MYSQL_VERSION', '5.7.0');   // utf8mb4, JSON functions

// Session settings
define('SESSION_LIFETIME', 86400); // 24 hours

class Database {
    private static $instance = null;
    private $pdo;
    private $tableCache = [];
    private $columnCache = [];

    private function __construct() {
        try {
            $dsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
            $this->pdo = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
            // Force session collation — prevents UNION collation mismatch across
            // tables that were created with different charsets/collations.
            $this->pdo->exec("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
            // Fix MySQL session timezone to VN (UTC+7) so TIMESTAMP columns
            // (e.g. completed_at) are interpreted correctly — without this,
            // a server running UTC would mark tasks as late 7 hours too early.
            $this->pdo->exec("SET time_zone = '+07:00'");

            // MySQL version check (non-fatal — logs warning only)
            $mysqlVer = $this->pdo->query("SELECT VERSION() AS v")->fetchColumn();
            if ($mysqlVer && version_compare($mysqlVer, REQUIRED_MYSQL_VERSION, '<')) {
                error_log("TaskFlow warning: MySQL {$mysqlVer} is below minimum "
                        . REQUIRED_MYSQL_VERSION . ". Some features may not work.");
            }
        } catch (PDOException $e) {
            // Log full details internally — NEVER expose to browser in production
            error_log('[DB-CONNECT] ' . $e->getMessage() . ' | host=' . DB_HOST . ' db=' . DB_NAME);

            // Sanitized public response
            $isApi = isset($_SERVER['REQUEST_URI']) && str_starts_with($_SERVER['REQUEST_URI'], '/api/');
            if (!headers_sent()) {
                http_response_code(503);
                header('Content-Type: ' . ($isApi ? 'application/json' : 'text/html'));
            }
            if ($isApi) {
                echo json_encode(['error' => 'Database unavailable', 'code' => 'E_DB_CONN']);
            } else {
                echo '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
                <title>Service Unavailable</title>
                <style>body{font-family:system-ui,sans-serif;background:#09090b;color:#f4f4f5;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
                .card{background:#18181b;border:1px solid #27272a;border-radius:12px;padding:40px;max-width:520px;width:100%;text-align:center}
                h1{color:#f87171;margin:0 0 12px;font-size:24px}p{color:#a1a1aa;margin:8px 0;font-size:14px}
                a{color:#60a5fa;text-decoration:none;font-size:14px;display:inline-block;margin-top:20px;padding:10px 24px;background:#1e3a5f;border-radius:8px}
                </style></head>
                <body><div class="card">
                <h1>&#9888; Service Unavailable</h1>
                <p>Database connection failed. This issue has been logged.</p>
                <p>Please try again in a few minutes.</p>
                <a href="/">&#127968; Dashboard</a>
                </div></body></html>';
            }
            exit(1);
        }
    }

    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function getConnection() {
        return $this->pdo;
    }

    public function query($sql, $params = []) {
        return safety_guard_query($sql, $params, $this->pdo, 'query');
    }

    public function execute($sql, $params = []) {
        $stmt = safety_guard_query($sql, $params, $this->pdo, 'execute');
        return $stmt->rowCount();
    }

    public function fetch($sql, $params = []) {
        return $this->query($sql, $params)->fetch();
    }

    public function fetchAll($sql, $params = []) {
        return $this->query($sql, $params)->fetchAll();
    }

    public function insert($sql, $params = []) {
        safety_guard_query($sql, $params, $this->pdo, 'insert');
        return $this->pdo->lastInsertId();
    }

    public function update($sql, $params = []) {
        return safety_guard_update($sql, $params, $this->pdo);
    }

    public function delete($sql, $params = []) {
        return safety_guard_delete($sql, $params, $this->pdo);
    }

    public function lastInsertId(): string {
        return $this->pdo->lastInsertId();
    }

    public function fetchColumn($sql, $params = []) {
        $stmt = $this->query($sql, $params);
        $val = $stmt->fetchColumn();
        return $val === false ? 0 : $val;
    }

    public function tableExists($table) {
        if (array_key_exists($table, $this->tableCache)) {
            return $this->tableCache[$table];
        }

        $exists = (bool) $this->fetch(
            "SELECT 1
             FROM information_schema.tables
             WHERE table_schema = ?
             AND table_name = ?
             LIMIT 1",
            [DB_NAME, $table]
        );
        $this->tableCache[$table] = $exists;
        return $exists;
    }

    public function columnExists($table, $column) {
        $cacheKey = $table . '.' . $column;
        if (array_key_exists($cacheKey, $this->columnCache)) {
            return $this->columnCache[$cacheKey];
        }

        if (!$this->tableExists($table)) {
            $this->columnCache[$cacheKey] = false;
            return false;
        }

        $exists = (bool) $this->fetch(
            "SELECT 1
             FROM information_schema.columns
             WHERE table_schema = ?
             AND table_name = ?
             AND column_name = ?
             LIMIT 1",
            [DB_NAME, $table, $column]
        );
        $this->columnCache[$cacheKey] = $exists;
        return $exists;
    }

    public function invalidateSchemaCache($table = null, $column = null) {
        if ($table === null) {
            $this->tableCache = [];
            $this->columnCache = [];
            return;
        }

        unset($this->tableCache[$table]);

        if ($column !== null) {
            unset($this->columnCache[$table . '.' . $column]);
            return;
        }

        foreach (array_keys($this->columnCache) as $cacheKey) {
            if (strpos($cacheKey, $table . '.') === 0) {
                unset($this->columnCache[$cacheKey]);
            }
        }
    }
}
