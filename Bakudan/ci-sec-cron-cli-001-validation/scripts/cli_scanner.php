<?php
$_SERVER['HTTP_HOST'] = 'preview.dashboard.bakudanramen.com';
chdir(dirname(__DIR__));
// Load preview env before database.php runs (in case .env.preview missing on server)
(function() {
    $f = __DIR__ . '/../.env.preview';
    if (!file_exists($f)) $f = __DIR__ . '/../.env';
    if (!file_exists($f)) return;
    foreach (file($f, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (preg_match('/^\s*(DB_[A-Z_]+)\s*=\s*(.+)$/', $line, $m)) {
            putenv("{$m[1]}={$m[2]}");
            $_ENV[$m[1]] = $m[2];
        }
    }
})();
require_once dirname(__DIR__) . '/config/database.php';
require_once dirname(__DIR__) . '/crons/DailyDuplicateTaskBillScanner.php';
try {
    $scanner = new DailyDuplicateTaskBillScanner();
    $result = $scanner->run();
    echo "Scanner result: " . json_encode($result ?? ['status' => 'complete']) . "\n";
} catch (Throwable $e) {
    echo "Scanner error: " . $e->getMessage() . "\n";
}
$pdo = Database::getInstance()->getConnection();
try {
    $g = $pdo->query('SELECT COUNT(*) FROM duplicate_groups')->fetchColumn();
    $i = $pdo->query('SELECT COUNT(*) FROM duplicate_group_items')->fetchColumn();
    echo "duplicate_groups: $g rows\n";
    echo "duplicate_group_items: $i rows\n";
} catch (Exception $e) {
    echo "Count error: " . $e->getMessage() . "\n";
}
