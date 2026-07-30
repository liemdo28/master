<?php
/**
 * PHP built-in server router — mirrors .htaccess rewrite logic.
 * Usage: php -S localhost:5003 router.php -t /path/to/project
 *
 * NOT for production. DreamHost uses Apache + .htaccess.
 */

// Pass Authorization header (mirrors: RewriteRule .* - [E=HTTP_AUTHORIZATION:...])
if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
    putenv('HTTP_AUTHORIZATION=' . $_SERVER['HTTP_AUTHORIZATION']);
}

$uri  = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '/');
$root = __DIR__;

// Serve real files directly (CSS, JS, images, fonts, etc.)
if ($uri !== '/' && file_exists($root . $uri)) {
    return false; // let built-in server handle it
}

// Extract route from URI (strips leading slash)
$route = ltrim($uri, '/');

// Preserve existing query string params, append route
$qs = $_SERVER['QUERY_STRING'] ?? '';
$params = [];
if ($qs !== '') {
    parse_str($qs, $params);
}
$params['route'] = $route;
$_GET   = array_merge($_GET,   $params);
$_REQUEST = array_merge($_REQUEST, $params);

// Bootstrap the app
require_once $root . '/index.php';
