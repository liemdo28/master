<?php
/**
 * Create RBAC test users (Phase 5 prep — Phase 1 deliverable)
 * user1 / user1 — CEO (admin role + full dashboard)
 * user2 / user2 — Manager (manager role — workflow access)
 * user3 / user3 — Member (member role — my-work only)
 *
 * Usage: php create_rbac_test_users.php
 *    or: https://preview.dashboard.bakudanramen.com/create_rbac_test_users.php?key=rbac-setup-2026
 *
 * This script is PREVIEW-only. Refuses on production.
 */
$SECRET = 'rbac-setup-2026';

$isCli = PHP_SAPI === 'cli';
if (!$isCli) {
    $key = $_GET['key'] ?? '';
    if ($key !== $SECRET) {
        http_response_code(403);
        die('Forbidden');
    }
    header('Content-Type: text/plain; charset=utf-8');
}

require_once __DIR__ . '/config/database.php';

$appUrl = getenv('APP_URL') ?: ($_ENV['APP_URL'] ?? '');
$appEnv = getenv('APP_ENV') ?: ($_ENV['APP_ENV'] ?? '');
$host   = $_SERVER['HTTP_HOST'] ?? '';
if (!str_contains($appUrl, 'preview') && $appEnv !== 'staging' && !str_contains($host, 'preview')) {
    die("REFUSED: only runs on preview/staging.\n");
}

$db = Database::getInstance();

// Three test users
$users = [
    ['email' => 'user1@bakudanramen.com', 'name' => 'User One (CEO)',     'password' => 'user1', 'role' => 'admin',   'is_ceo' => 1],
    ['email' => 'user2@bakudanramen.com', 'name' => 'User Two (Manager)',  'password' => 'user2', 'role' => 'manager', 'is_ceo' => 0],
    ['email' => 'user3@bakudanramen.com', 'name' => 'User Three (Member)', 'password' => 'user3', 'role' => 'member',  'is_ceo' => 0],
];

echo "=== RBAC Test Users Setup ===\n\n";

$cols = $db->fetchAll("SHOW COLUMNS FROM users");
$colNames = array_column($cols, 'Field');
$hasIsCeo = in_array('is_ceo', $colNames);
$hasIsActive = in_array('is_active', $colNames);

foreach ($users as $u) {
    $existing = $db->fetch("SELECT id, role, is_active FROM users WHERE email = ?", [$u['email']]);

    $hash = password_hash($u['password'], PASSWORD_BCRYPT);

    if ($existing) {
        // Update existing — keep id, refresh name/password/role
        $set = ['name = ?', 'password = ?', 'role = ?'];
        $params = [$u['name'], $hash, $u['role']];
        if ($hasIsActive)  { $set[] = 'is_active = 1'; }
        if ($hasIsCeo)     { $set[] = 'is_ceo = ?'; $params[] = $u['is_ceo']; }
        $params[] = $u['email'];
        $db->execute("UPDATE users SET " . implode(', ', $set) . " WHERE email = ?", $params);
        echo "✓ UPD user id={$existing['id']} email={$u['email']} role={$u['role']}\n";
    } else {
        $cols = ['name', 'email', 'password', 'role', 'created_at'];
        $place = ['?', '?', '?', '?', 'NOW()'];
        $params = [$u['name'], $u['email'], $hash, $u['role']];
        if ($hasIsActive)  { $cols[] = 'is_active';  $place[] = '1'; }
        if ($hasIsCeo)     { $cols[] = 'is_ceo';     $place[] = '?'; $params[] = $u['is_ceo']; }
        $sql = "INSERT INTO users (" . implode(', ', $cols) . ") VALUES (" . implode(', ', $place) . ")";
        $db->execute($sql, $params);
        $id = $db->lastInsertId();
        echo "✓ INS user id={$id} email={$u['email']} role={$u['role']}\n";
    }
}

echo "\n=== Validation ===\n\n";
foreach ($users as $u) {
    $row = $db->fetch("SELECT id, name, email, role FROM users WHERE email = ?", [$u['email']]);
    if ($row) {
        echo sprintf("✓ %-30s | id=%-3d | role=%-7s | password=%s\n",
            $row['email'], $row['id'], $row['role'], $u['password']);
    } else {
        echo "✗ {$u['email']} not found\n";
    }
}

echo "\n=== Done — Login URLs ===\n";
echo "  https://preview.dashboard.bakudanramen.com/login\n";
echo "  user1@bakudanramen.com / user1 (admin/CEO)\n";
echo "  user2@bakudanramen.com / user2 (manager)\n";
echo "  user3@bakudanramen.com / user3 (member)\n";
