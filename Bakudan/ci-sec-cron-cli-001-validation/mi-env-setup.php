<?php
// ONE-TIME: Append a line to server .env — DELETE AFTER USE
if (($_GET['key'] ?? '') !== 'mi-setup-2026-x9') {
    http_response_code(403); die('Forbidden');
}
$var   = preg_replace('/[^A-Z0-9_]/', '', strtoupper($_GET['var'] ?? ''));
$value = $_GET['val'] ?? '';
if (!$var || !$value) { die("Missing var/val"); }

$envPath = __DIR__ . '/.env';
$content = file_exists($envPath) ? file_get_contents($envPath) : '';
if (str_contains($content, $var . '=')) {
    echo "$var already set.\n";
} else {
    file_put_contents($envPath, rtrim($content) . "\n$var=$value\n");
    echo "$var added.\n";
}
unlink(__FILE__);
echo "Script deleted.\n";
