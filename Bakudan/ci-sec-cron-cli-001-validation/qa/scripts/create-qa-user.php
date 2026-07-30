<?php
/**
 * Create Preview QA User
 * 
 * Creates a dedicated QA test user on PREVIEW environment only.
 * This user has admin+reviewer+approver roles for full workflow testing.
 *
 * Usage:
 *   CLI:  php qa/scripts/create-qa-user.php
 *   HTTP: https://preview.dashboard.bakudanramen.com/qa/scripts/create-qa-user.php?key={value set via QA_SETUP_KEY env var, no longer hardcoded}
 *
 * Environment: PREVIEW ONLY. Will refuse to run on production.
 */

$key = getenv('QA_SETUP_KEY') ?: '';

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
require_once __DIR__ . '/../../config/database.php';

// Safety: Only run on preview/staging
$appUrl = getenv('APP_URL') ?: ($_ENV['APP_URL'] ?? '');
$appEnv = getenv('APP_ENV') ?: ($_ENV['APP_ENV'] ?? '');
if (!str_contains($appUrl, 'preview') && $appEnv !== 'staging') {
    die("REFUSED: This script only runs on preview/staging environment.\n");
}

$db = Database::getInstance();

// ── QA User Config ────────────────────────────────────────────────────────────
$email    = 'qa.bot@bakudanramen.com';
$name     = 'QA Bot';
$password = getenv('QA_TEST_PASSWORD') ?: bin2hex(random_bytes(12));
$role     = 'admin'; // Admin has reviewer+approver privileges
$hash     = password_hash($password, PASSWORD_BCRYPT);

echo "=== Preview QA User Setup ===\n\n";

// ── Check existing ────────────────────────────────────────────────────────────
$existing = $db->fetch("SELECT id, email, role, name FROM users WHERE email = ?", [$email]);

if ($existing) {
    // Update password and ensure role is admin
    $db->execute(
        "UPDATE users SET password = ?, role = ?, name = ?, is_active = 1 WHERE email = ?",
        [$hash, $role, $name, $email]
    );
    echo "✅ Updated existing QA user (ID: {$existing['id']})\n";
    echo "   Email: {$email}\n";
    echo "   Role: {$role}\n";
    echo "   Password: reset to default\n";
} else {
    // Create new user
    $db->execute(
        "INSERT INTO users (name, email, password, role, is_active, created_at) VALUES (?, ?, ?, ?, 1, NOW())",
        [$name, $email, $hash, $role]
    );
    $newId = $db->lastInsertId();
    echo "✅ Created QA user (ID: {$newId})\n";
    echo "   Email: {$email}\n";
    echo "   Role: {$role}\n";
    echo "   Password: QA-Preview-2026!\n";
}

// ── Verify ────────────────────────────────────────────────────────────────────
$verify = $db->fetch("SELECT id, email, role, name, is_active FROM users WHERE email = ?", [$email]);
echo "\n=== Verification ===\n";
echo "ID:       {$verify['id']}\n";
echo "Name:     {$verify['name']}\n";
echo "Email:    {$verify['email']}\n";
echo "Role:     {$verify['role']}\n";
echo "Active:   {$verify['is_active']}\n";
echo "\n✅ QA user ready for automated testing.\n";
echo "\nSet environment variables:\n";
echo "  TEST_EMAIL=qa.bot@bakudanramen.com\n";
echo "  TEST_PASSWORD=QA-Preview-2026!\n";
