<?php
/**
 * Phase 1 — Workflow API Smoke Test
 * Logs in as QA bot and tests all four endpoints.
 * Usage: php scripts/smoke-workflow-api.php
 */
$BASE = 'https://preview.dashboard.bakudanramen.com';
$EMAIL = 'qa.bot@bakudanramen.com';
$PASS  = 'QA-Preview-2026!';
$JAR   = sys_get_temp_dir() . '/wf_smoke_cookies.txt';

function do_curl($url, $cookie_file, $post_data = null) {
    $ch = curl_init($url);
    $opts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_COOKIEJAR      => $cookie_file,
        CURLOPT_COOKIEFILE     => $cookie_file,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_USERAGENT      => 'BakudanSmokeTest/1.0',
    ];
    if ($post_data) {
        $opts[CURLOPT_POST] = true;
        $opts[CURLOPT_POSTFIELDS] = http_build_query($post_data);
    }
    curl_setopt_array($ch, $opts);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['code' => $code, 'body' => $body];
}

echo "=== Phase 1 — Workflow API Smoke Test ===\n\n";

echo "1. Login as QA bot...\n";
$login = do_curl("$BASE/login", $JAR, ['email' => $EMAIL, 'password' => $PASS]);
echo "   HTTP {$login['code']}\n";

$session_id = null;
if (file_exists($JAR)) {
    foreach (file($JAR) as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') continue;
        $parts = preg_split('/\s+/', $line);
        if (count($parts) >= 7 && $parts[5] === 'PHPSESSID') {
            $session_id = $parts[6];
            break;
        }
    }
}
echo "   PHPSESSID = $session_id\n";
if (!$session_id) {
    echo "   FAIL: no PHPSESSID in cookie jar\n";
    exit(1);
}

function curl_get2($url, $sid) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_HTTPGET => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_HTTPHEADER => ["Cookie: PHPSESSID=$sid"],
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['code' => $code, 'body' => $body];
}

$endpoints = [
    '/api/workflow/my-work'         => ['assigned_to_me', 'due_today', 'overdue_mine', 'mentioned_me', 'waiting_on_me'],
    '/api/workflow/reviewer-queue'  => ['needs_review', 'waiting_evidence', 'approved', 'rejected'],
    '/api/workflow/approver-queue' => ['needs_approval', 'accepted', 'rejected'],
    '/api/workflow/command-center'  => ['my_work', 'review', 'approve', 'critical_today', 'blocked'],
];

$allPass = true;
foreach ($endpoints as $path => $required) {
    echo "\n2. GET $path\n";
    $res = curl_get2("$BASE$path", $session_id);
    echo "   HTTP {$res['code']}\n";

    if ($res['code'] === 302) {
        echo "   UNEXPECTED 302\n";
        $allPass = false;
        continue;
    }
    if ($res['code'] >= 400) {
        echo "   FAIL: HTTP {$res['code']}\n";
        $allPass = false;
        continue;
    }

    $json = json_decode($res['body'], true);
    if (!$json) {
        echo "   FAIL: invalid JSON\n";
        $allPass = false;
        continue;
    }
    if (empty($json['success'])) {
        echo "   FAIL: success!=true\n";
        $allPass = false;
        continue;
    }

    $ok = true;
    foreach ($required as $key) {
        if (!isset($json['data'][$key])) {
            echo "   FAIL: missing data.$key\n";
            $ok = false;
        }
    }
    if ($ok) {
        echo "   PASS: " . substr(json_encode($json['data']), 0, 120) . "\n";
    } else {
        $allPass = false;
    }
}

echo "\n3. GET /api/workflow/my-work/list?bucket=assigned_to_me\n";
$res = curl_get2("$BASE/api/workflow/my-work/list?bucket=assigned_to_me", $session_id);
echo "   HTTP {$res['code']}\n";
$json = json_decode($res['body'], true);
if ($res['code'] === 200 && $json && $json['success'] && is_array($json['data']['tasks'] ?? null)) {
    echo "   PASS: tasks=" . count($json['data']['tasks']) . " bucket={$json['data']['bucket']}\n";
} else {
    echo "   FAIL or empty\n";
    $allPass = false;
}

echo "\n" . ($allPass ? "=== ALL PASS ===" : "=== SOME FAILURES ===") . "\n";
exit($allPass ? 0 : 1);
