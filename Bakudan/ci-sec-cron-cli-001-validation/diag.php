<?php
// Phase 1 — Password + Role Diagnostic
if (($_GET['key'] ?? '') !== 'diag-2026') { http_response_code(403); exit('Forbidden'); }
header('Content-Type: text/plain; charset=utf-8');

// Minimal bootstrap — only database.php (no User.php to avoid conflicts)
require_once __DIR__ . '/config/database.php';

$db = Database::getInstance();
$users = [
    ['email' => 'user1@bakudanramen.com', 'pass' => 'user1', 'exp_role' => 'admin'],
    ['email' => 'user2@bakudanramen.com', 'pass' => 'user2', 'exp_role' => 'manager'],
    ['email' => 'user3@bakudanramen.com', 'pass' => 'user3', 'exp_role' => 'staff'],
];

echo "PHP_VERSION: " . PHP_VERSION . "\n";
echo "password_hash algo: " . PASSWORD_BCRYPT . "\n\n";

foreach ($users as $u) {
    $row = $db->fetch("SELECT id, role, password FROM users WHERE email = ?", [$u['email']]);
    if (!$row) {
        echo "{$u['email']}: NOT FOUND\n";
        continue;
    }
    $hash = $row['password'];
    $pwd  = $u['pass'];
    $verify = password_verify($pwd, $hash);
    $algo   = password_get_info($hash)['algo'];
    echo "{$u['email']}:\n";
    echo "  id={$row['id']} role={$row['role']}\n";
    echo "  hash_len=" . strlen($hash) . " hash_prefix=" . substr($hash, 0, 7) . "\n";
    echo "  password={$pwd}\n";
    echo "  password_is_string=" . (is_string($pwd) ? 'YES' : 'NO') . " type=" . gettype($pwd) . "\n";
    echo "  password_bytes=" . bin2hex($pwd) . "\n";
    echo "  verify=" . ($verify ? 'TRUE' : 'FALSE') . " expected_algo=" . PASSWORD_BCRYPT . " actual_algo=$algo\n";
    echo "  role_ok=" . ($row['role'] === $u['exp_role'] ? 'YES' : "NO (got '{$row['role']}')") . "\n";
    echo "\n";
}
