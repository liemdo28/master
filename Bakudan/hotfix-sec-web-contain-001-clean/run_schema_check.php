<?php
/**
 * CLI wrapper to load pdo_mysql extension then run schema check.
 * Usage: php run_schema_check.php [args...]
 *   php run_schema_check.php --verbose --json
 *   php run_schema_check.php --env=preview --verbose --json
 */
$extDir = str_replace('\\', '/', __DIR__) . '/ext';
// Use the XAMPP windowsXamppPhp subdirectory
$xamppExt = 'C:/xampp/php/windowsXamppPhp/ext';
if (is_dir($xamppExt)) {
    $extDir = $xamppExt;
} elseif (!is_dir($extDir)) {
    $extDir = 'C:/xampp/php/ext';
}

// Try to load pdo_mysql
if (!extension_loaded('pdo_mysql')) {
    if (@dl('php_pdo_mysql.dll')) {
        fwrite(STDERR, "[OK] Loaded pdo_mysql via dl()\n");
    } else {
        // Manual approach: try all known extension dirs
        $dirs = ['C:/xampp/php/ext', 'C:/xampp/php/windowsXamppPhp/ext'];
        $loaded = false;
        foreach ($dirs as $d) {
            if (is_dir($d)) {
                ini_set('extension_dir', $d);
                if (@dl('php_pdo_mysql.dll')) {
                    fwrite(STDERR, "[OK] Loaded pdo_mysql from $d\n");
                    $loaded = true;
                    break;
                }
            }
        }
        if (!$loaded) {
            fwrite(STDERR, "FATAL: Cannot load pdo_mysql. Tried: " . implode(', ', $dirs) . "\n");
            exit(1);
        }
    }
}

// Remove this script from argv so the target script doesn't see it
// Shift first argument (this script name)
$_SERVER['argv'] = array_values(array_slice($_SERVER['argv'], 1));

require __DIR__ . '/scripts/schema_check_standalone.php';
