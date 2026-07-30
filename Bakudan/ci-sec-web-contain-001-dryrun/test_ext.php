<?php
echo "PHP Version: " . PHP_VERSION . "\n";
echo "dl() available: " . (function_exists('dl') ? 'YES' : 'NO') . "\n";
echo "extension_dir before: " . ini_get('extension_dir') . "\n";

$dirs = [
    'C:/xampp/php/ext',
    'C:/xampp/php/windowsXamppPhp/ext',
    'C:\\xampp\\php\\ext',
    'C:\\xampp\\php\\windowsXamppPhp\\ext',
];
foreach ($dirs as $d) {
    $found = file_exists($d . '/php_pdo_mysql.dll');
    echo "  $d/php_pdo_mysql.dll: " . ($found ? 'EXISTS' : 'NOT FOUND') . "\n";
}

if (function_exists('dl')) {
    foreach ($dirs as $d) {
        ini_set('extension_dir', $d);
        $ok = @dl('php_pdo_mysql.dll');
        echo "  dl from $d: " . ($ok ? 'SUCCESS' : 'FAILED') . "\n";
        if ($ok) break;
    }
}

echo "pdo_mysql loaded: " . (extension_loaded('pdo_mysql') ? 'YES' : 'NO') . "\n";
echo "PDO drivers: " . var_export(PDO::getAvailableDrivers(), true) . "\n";
