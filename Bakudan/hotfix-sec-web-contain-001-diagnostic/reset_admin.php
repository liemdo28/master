<?php
/**
 * One-time admin reset script.
 *
 * CLI:  php reset_admin.php
 * HTTP: https://dashboard.bakudanramen.com/reset_admin.php?key=reset-admin-2024
 *
 * REMOVE this file after use.
 */

$SECRET = 'reset-admin-2024';

// ── Auth ──────────────────────────────────────────────────────────────────────
$isCli = PHP_SAPI === 'cli';
if (!$isCli) {
    $key = $_GET['key'] ?? '';
    if ($key !== $SECRET) {
        http_response_code(403);
        die('Forbidden');
    }
    header('Content-Type: text/plain; charset=utf-8');
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
require_once __DIR__ . '/config/database.php';

$db       = Database::getInstance();
$email    = 'liem.dt0208@gmail.com';
$name     = 'admin';
$password = 'admin';
$role     = 'admin';
$hash     = password_hash($password, PASSWORD_BCRYPT);

// ── Check existing ────────────────────────────────────────────────────────────
$existing = $db->fetch("SELECT id, email, role FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1");

if ($existing) {
    // Update existing admin: reset email, name, password
    $db->execute(
        "UPDATE users SET name = ?, email = ?, password = ?, is_active = 1 WHERE id = ?",
        [$name, $email, $hash, $existing['id']]
    );
    echo "UPDATED existing admin (id={$existing['id']})" . PHP_EOL;
    echo "  Old email : {$existing['email']}" . PHP_EOL;
} else {
    // Create new admin
    $db->insert(
        "INSERT INTO users (name, email, password, role, is_active, created_at)
         VALUES (?, ?, ?, 'admin', 1, NOW())",
        [$name, $email, $hash]
    );
    echo "CREATED new admin user" . PHP_EOL;
}

echo "  Email    : {$email}" . PHP_EOL;
echo "  Password : {$password}" . PHP_EOL;
echo "  Role     : {$role}" . PHP_EOL;
echo PHP_EOL;
echo "Login at: https://dashboard.bakudanramen.com/login" . PHP_EOL;
echo PHP_EOL;
echo "*** DELETE this file after logging in! ***" . PHP_EOL;
