<?php
/**
 * P0 CEO DIRECTIVE Executor — Duplicate Cleanup + Penalty Reset
 * Access: https://dashboard.bakudanramen.com/p0_ceo_directive.php?key=P0-CEO-2026&step=X
 * CEO Directive Date: 2026-06-22
 *
 * RULES: Archive-only (no hard delete). Canonical = title+store+vendor+cat+due_date+amount+recurrence
 * created_by is NOT a uniqueness key
 */
define('SECRET_KEY', 'P0-CEO-2026');
if (($_GET['key'] ?? '') !== SECRET_KEY) {
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Forbidden']);
    exit;
}
error_reporting(0);
ini_set('max_execution_time', '600');
ini_set('memory_limit', '512M');
header('Content-Type: application/json; charset=utf-8');
$step  = $_GET['step']  ?? 'all';
$dry   = !empty($_GET['dry_run']);
$actor = (int)($_GET['actor_id'] ?? 1);
$out   = ['ts' => date('c'), 'step' => $step, 'dry_run' => $dry];

// Load .env
$envFile = __DIR__ . '/.env';
if (!file_exists($envFile)) $envFile = '/home/liemdo0208/dashboard.bakudanramen.com/.env';
if (!file_exists($envFile)) { die(json_encode(['error' => '.env not found'])); }

list($DB_HOST, $DB_NAME, $DB_USER, $DB_PASS) = ['', '', '', ''];
foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
    $line = trim($line);
    if ($line === '' || $line[0] === '#' || strpos($line, '=') === false) continue;
    [$key, $val] = explode('=', $line, 2);
    $key = trim($key); $val = trim($val);
    if (preg_match('/^([\'"'])(.*)$/', $val, $m)) $val = $m[2];
    if ($key === 'DB_HOST') $DB_HOST = $val;
    if ($key === 'DB_NAME') $DB_NAME = $val;
    if ($key === 'DB_USER') $DB_USER = $val;
    if ($key === 'DB_PASS') $DB_PASS = $val;
}

try {
    $pdo = new PDO(
        "mysql:host={$DB_HOST};dbname={$DB_NAME};charset=utf8mb4",
        $DB_USER, $DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );
    $pdo->exec("SET NAMES utf8mb4");
    $pdo->exec("SET time_zone = '+07:00'");
} catch (PDOException $e) {
    die(json_encode(['error' => 'DB fail', 'd' => $e->getMessage()]));
}

function tEx(PDO $p, string $t): bool {
    static $c = [];
    if (!isset($c[$t])) $c[$t] = (bool)$p->query(
        "SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='$t' LIMIT 1"
    )->fetchColumn();
    return $c[$t];
}

function cEx(PDO $p, string $t, string $c): bool {
    static $x = [];
    $k = "{$t}.{$c}";
    if (!isset($x[$k])) $x[$k] = (bool)$p->query(
        "SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='$t' AND column_name='$c' LIMIT 1"
    )->fetchColumn();
    return $x[$k];
}

function logAudit(PDO $pdo, string $mod, string $act, string $rtype, int $rid, int $uid, string $note): void {
    $note = str_replace(["'", '"' ], ' ', $note);
    $note = substr($note, 0, 500);
    $pdo->exec("INSERT INTO audit_logs (module,action,record_type,record_id,user_id,note,created_at) VALUES ('$mod','$act','$rtype',$rid,$uid,'" . $pdo->quote($note) . "',NOW())");
}

@mkdir($REPORT_DIR = __DIR__ . '/reports', 0755, true);
@mkdir($BACKUP_DIR = __DIR__ . '/backups', 0755, true);
