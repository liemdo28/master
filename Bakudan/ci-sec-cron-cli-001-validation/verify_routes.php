<?php
$code = file_get_contents(__DIR__ . '/index.php');
$routes = [
    'admin/release-dashboard',
    'admin/shifts',
    'admin/employees',
    'admin/training',
    'admin/procurement',
    'admin/documents',
    'admin/compliance',
    'admin/store-command',
    'ceo/boardroom',
    'admin/digital-twin',
    'manager/command',
    'control-tower',
    'company/calendar',
];
echo "Route Registration Verification\n";
echo "================================\n";
$pass = 0; $fail = 0;
foreach ($routes as $r) {
    $found = strpos($code, "'" . $r . "'") !== false || strpos($code, '"' . $r . '"') !== false;
    echo ($found ? '  ✓ OK' : '  ✗ MISSING') . " → /$r\n";
    $found ? $pass++ : $fail++;
}
// Check regex routes
$regexRoutes = ['admin\/stores\/(\d+)', 'admin\/shifts\/(\d+)\/delete', 'admin\/store-command\/(\d+)\/health'];
foreach ($regexRoutes as $r) {
    $found = strpos($code, $r) !== false;
    echo ($found ? '  ✓ OK' : '  ✗ MISSING') . " → /$r (regex)\n";
    $found ? $pass++ : $fail++;
}
echo "\nResult: $pass passed, $fail failed\n";
echo $fail === 0 ? "✅ All routes registered\n" : "❌ Some routes missing\n";
