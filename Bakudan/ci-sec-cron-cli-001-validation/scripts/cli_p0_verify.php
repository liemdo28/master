<?php
$_GET['key'] = 'bkd_verify_2026';
$_SERVER['REQUEST_URI'] = '/run_p0_verification.php';
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
ob_start();
require dirname(__DIR__) . '/run_p0_verification.php';
$html = ob_get_clean();
$text = strip_tags($html);
$text = preg_replace('/[ \t]+/', ' ', $text);
$text = preg_replace('/\n{3,}/', "\n\n", $text);
// Print only relevant lines
foreach (explode("\n", $text) as $line) {
    $line = trim($line);
    if (empty($line)) continue;
    if (preg_match('/PASS|FAIL|WARN|READY|Phase|Schema|Verif|bill_|task_|dup|scanner|categor/i', $line)) {
        echo $line . "\n";
    }
}
