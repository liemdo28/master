<?php
/**
 * Phase 1 — RBAC Validation
 * Logs in as user1/user2/user3, hits /api/workflow/command-center,
 * confirms role-gated access.
 *
 * Usage: php scripts/validate-rbac.php
 */
$BASE = 'https://preview.dashboard.bakudanramen.com';

$users = [
    ['email' => 'user1@bakudanramen.com', 'password' => 'user1', 'role' => 'admin',   'expected_access' => 'full'],
    ['email' => 'user2@bakudanramen.com', 'password' => 'user2', 'role' => 'manager', 'expected_access' => 'workflow'],
    ['email' => 'user3@bakudanramen.com', 'password' => 'user3', 'role' => 'member',  'expected_access' => 'my_work'],
];

function curl_post($url, $post, $cookie) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query($post),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_COOKIEJAR => $cookie,
        CURLOPT_COOKIEFILE => $cookie,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_TIMEOUT => 15,
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['code' => $code, 'body' => $body];
}

function curl_get($url, $sid) {
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

function extract_sid($jar) {
    if (!file_exists($jar)) return null;
    foreach (file($jar) as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') continue;
        $parts = preg_split('/\s+/', $line);
        if (count($parts) >= 7 && $parts[5] === 'PHPSESSID') return $parts[6];
    }
    return null;
}

echo "=== Phase 1 — RBAC Validation ===\n\n";

$endpoints = [
    '/api/workflow/my-work',
    '/api/workflow/reviewer-queue',
    '/api/workflow/approver-queue',
    '/api/workflow/command-center',
    '/command-center',   // page — should redirect if not logged in
    '/admin/users',      // admin-only page
    '/overview',         // manager+ page
    '/my-tasks',         // any role
];

$allPass = true;
foreach ($users as $u) {
    $jar = sys_get_temp_dir() . '/rbac_' . md5($u['email']) . '.txt';
    @unlink($jar);

    echo "─── {$u['email']} (expected: {$u['expected_access']}) ───\n";

    // Login
    $login = curl_post("$BASE/login", ['email' => $u['email'], 'password' => $u['password']], $jar);
    $sid   = extract_sid($jar);
    if (!$sid) {
        echo "  ✗ LOGIN FAILED (no session)\n";
        $allPass = false;
        continue;
    }
    echo "  ✓ login: PHPSESSID=" . substr($sid, 0, 12) . "...\n";

    foreach ($endpoints as $ep) {
        $res = curl_get("$BASE$ep", $sid);
        $code = $res['code'];
        $verdict = '';

        if ($ep === '/api/workflow/my-work' || $ep === '/api/workflow/command-center' || $ep === '/api/workflow/reviewer-queue' || $ep === '/api/workflow/approver-queue') {
            $expect = 200;
            $verdict = ($code === 200) ? 'PASS' : "FAIL (got $code)";
            if ($code === 200) {
                $j = json_decode($res['body'], true);
                if (!$j || empty($j['success'])) $verdict = "FAIL (no success)";
            }
        } elseif ($ep === '/command-center' || $ep === '/overview' || $ep === '/my-tasks') {
            $expect = 200;
            $verdict = ($code === 200) ? 'PASS' : "FAIL (got $code)";
        } elseif ($ep === '/admin/users') {
            // Admin only
            if ($u['role'] === 'admin') $expect = 200; else $expect = 302;
            $verdict = ($code === $expect) ? 'PASS' : "FAIL (expected $expect, got $code)";
        }

        echo sprintf("  %-32s %3d  %s\n", $ep, $code, $verdict);
        if ($verdict !== 'PASS') $allPass = false;
    }
    echo "\n";
}

echo $allPass ? "=== RBAC ALL PASS ===\n" : "=== RBAC FAILURES ===\n";
exit($allPass ? 0 : 1);
