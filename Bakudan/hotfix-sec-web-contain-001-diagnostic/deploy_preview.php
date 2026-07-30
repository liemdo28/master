<?php
/**
 * Preview Full Deploy — pulls ALL files from origin/main
 * Usage: GET /deploy_preview.php?key=preview-deploy-2026
 * DELETE THIS FILE after use.
 */
if (($_GET['key'] ?? '') !== 'preview-deploy-2026') {
    http_response_code(403);
    die('Forbidden');
}

header('Content-Type: text/plain; charset=utf-8');
$root = __DIR__;
$output = [];

echo "=== PREVIEW FULL DEPLOY ===\n\n";

// Fetch latest
exec("cd {$root} && git fetch origin main 2>&1", $output, $code);
echo "Fetch: exit={$code}\n";
echo implode("\n", $output) . "\n\n";

// Reset working tree to origin/main (full deploy)
$output = [];
exec("cd {$root} && git reset --hard origin/main 2>&1", $output, $code);
echo "Reset: exit={$code}\n";
echo implode("\n", $output) . "\n\n";

// Verify key files exist
$checkFiles = [
    'index.php',
    '.htaccess',
    'config/database.php',
    'config/safety-guard.php',
    'models/Section.php',
    'models/User.php',
    'models/Task.php',
    'models/Project.php',
    'controllers/AuthController.php',
    'views/auth/login.php',
    'preview_db_health.php',
    'validate_preview_workflow.php',
    'repair_preview.php',
];

echo "=== FILE VERIFICATION ===\n";
foreach ($checkFiles as $f) {
    $exists = file_exists("{$root}/{$f}");
    echo ($exists ? "✓" : "✗") . " {$f}\n";
}

echo "\n";
if ($code === 0) {
    echo "DEPLOY_OK — all origin/main files deployed.\n";
    echo "Next: GET /preview_db_health.php?token=PREVIEW_HEALTH_2026\n";
} else {
    echo "DEPLOY_FAILED — check output above.\n";
}
