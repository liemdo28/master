<?php
/**
 * Wrapper: run verify-schema.php with pdo_mysql enabled.
 */
$extDir = 'C:/xampp/php/windowsXamppPhp/ext';
ini_set('extension_dir', $extDir);
// Enable pdo_mysql dynamically
if (!extension_loaded('pdo_mysql')) {
    // Try dl() on Windows
    @dl('php_pdo_mysql.dll');
}
// Fallback: set PDO drivers manually
if (!extension_loaded('pdo_mysql')) {
    fwrite(STDERR, "FATAL: pdo_mysql extension not loaded. Extension dir: $extDir\n");
    exit(1);
}

// Forward to actual script
$_SERVER['argv'] = array_merge(
    ['verify-schema.php'],
    array_slice($_SERVER['argv'] ?? [], 1)
);
require __DIR__ . '/scripts/verify-schema.php';
