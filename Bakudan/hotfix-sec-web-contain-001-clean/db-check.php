<?php
/**
 * DB Schema Check for RBAC columns
 * Run: curl "https://preview.dashboard.bakudanramen.com/db-check.php?key=dbcheck-2026"
 */
if (($_GET['key'] ?? '') !== 'dbcheck-2026') { http_response_code(403); exit('Forbidden'); }
header('Content-Type: text/plain; charset=utf-8');
require_once __DIR__ . '/config/database.php';
$db = Database::getInstance();

echo "=== DB Schema Check ===\n\n";

// Users columns
echo "users columns:\n";
$cols = $db->fetchAll("SHOW COLUMNS FROM users");
foreach ($cols as $c) {
    echo "  {$c['Field']} | {$c['Type']} | default={$c['Default']}\n";
}

// Check our 3 users
echo "\nRBAC test users:\n";
$emails = ['user1@bakudanramen.com','user2@bakudanramen.com','user3@bakudanramen.com'];
foreach ($emails as $email) {
    $u = $db->fetch("SELECT * FROM users WHERE email = ?", [$email]);
    if (!$u) {
        echo "  $email — NOT FOUND\n";
    } else {
        echo "  $email | id={$u['id']} | role={$u['role']} | is_active={$u['is_active']}\n";
        // Show hash (first 30 chars only)
        if (isset($u['password'])) echo "    hash=" . substr($u['password'], 0, 30) . "...\n";
    }
}

// Verify password for user1
echo "\nPassword verify test:\n";
$u = $db->fetch("SELECT password FROM users WHERE email = 'user1@bakudanramen.com'");
if ($u) {
    $test = password_verify('user1', $u['password']);
    echo "  password_verify('user1', hash) = " . ($test ? 'TRUE' : 'FALSE') . "\n";
    echo "  hash starts with: " . substr($u['password'], 0, 10) . "\n";
}

// Check if the update worked for role
echo "\nRe-run user3 update to fix role:\n";
if (in_array('role', array_column($cols, 'Field'))) {
    $db->execute("UPDATE users SET role = 'member' WHERE email = 'user3@bakudanramen.com'");
    $u3 = $db->fetch("SELECT role FROM users WHERE email = 'user3@bakudanramen.com'");
    echo "  user3 role after update: '{$u3['role']}'\n";
} else {
    echo "  NOTE: 'role' column does not exist in users table!\n";
    echo "  The schema uses a different RBAC mechanism.\n";
    // Check for alternative RBAC columns
    foreach ($cols as $c) {
        if (stripos($c['Field'], 'perm') !== false || stripos($c['Field'], 'access') !== false || stripos($c['Field'], 'level') !== false) {
            echo "  Found RBAC-related column: {$c['Field']}\n";
        }
    }
}
