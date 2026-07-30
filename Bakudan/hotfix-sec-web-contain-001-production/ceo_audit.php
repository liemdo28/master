<?php
/**
 * CEO Evidence Pack — Production API Query Script
 * Uses cURL to login and query the live site.
 */

$base = 'https://dashboard.bakudanramen.com';
$action = $argv[1] ?? 'login';
$cookieFile = __DIR__ . '/ceo_cookies.txt';
$queryId = $argv[2] ?? 'ping';

function httpGet($url, $cookies) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_COOKIEJAR => $cookies,
        CURLOPT_COOKIEFILE => $cookies,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_USERAGENT => 'CEO-Audit-Bot/1.0',
        CURLOPT_TIMEOUT => 30,
    ]);
    $resp = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['code' => $code, 'body' => $resp];
}

function httpPost($url, $data, $cookies) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query($data),
        CURLOPT_COOKIEJAR => $cookies,
        CURLOPT_COOKIEFILE => $cookies,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_USERAGENT => 'CEO-Audit-Bot/1.0',
        CURLOPT_TIMEOUT => 30,
    ]);
    $resp = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['code' => $code, 'body' => $resp];
}

switch ($action) {
    case 'login':
        // Step 1: Get CSRF token
        $r = httpGet("$base/login", $cookieFile);
        if (!preg_match('/name="csrf"\s+value="([^"]+)"/', $r['body'], $m)) {
            echo "ERROR: Cannot find CSRF token\n";
            echo "Body snippet: " . substr($r['body'], 0, 500) . "\n";
            exit(1);
        }
        $csrf = $m[1];
        
        // Step 2: Login with admin credentials
        $r = httpPost("$base/auth/login", [
            'csrf' => $csrf,
            'email' => 'liem.dt0208@gmail.com',
            'password' => 'admin',
        ], $cookieFile);
        
        // Check result
        if (preg_match('/class="dashboard|\/dashboard|Dashboard/s', $r['body'])) {
            echo "LOGIN_SUCCESS\n";
        } else {
            echo "LOGIN_RESULT: HTTP {$r['code']}, body length=" . strlen($r['body']) . "\n";
            echo "Snippet: " . substr(strip_tags($r['body']), 0, 300) . "\n";
        }
        break;

    case 'query':
        // Query db_query.php on production (must be deployed first)
        $r = httpGet("$base/db_query.php?query_id=$queryId", $cookieFile);
        echo $r['body'];
        break;

    case 'route_test':
        // Test specific routes
        $routes = explode(',', $queryId);
        $results = [];
        foreach ($routes as $route) {
            $route = trim($route);
            $r = httpGet("$base$route", $cookieFile);
            $results[$route] = [
                'status' => $r['code'],
                'length' => strlen($r['body']),
                'has_error' => strpos($r['body'], 'SQL') !== false || strpos($r['body'], 'Fatal error') !== false || strpos($r['body'], '500') !== false,
                'snippet' => substr(strip_tags($r['body']), 0, 200),
            ];
        }
        echo json_encode($results, JSON_PRETTY_PRINT);
        break;

    default:
        echo "Usage: php ceo_audit.php [login|query|route_test] [query_id]\n";
}
