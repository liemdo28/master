#!/usr/bin/env python3
"""Generate the complete P0 CEO Directive PHP executor."""
p = r'e:\Project\Master\Bakudan\dashboard.bakudanramen.com\p0_ceo_directive.php'

parts = []

# === HEADER ===
parts.append(r"""<?php
/**
 * P0 CEO DIRECTIVE Executor — Duplicate Cleanup + Penalty Reset
 * Access: https://dashboard.bakudanramen.com/p0_ceo_directive.php?key=P0-CEO-2026&step=X
 * CEO Directive Date: 2026-06-22
 *
 * RULES:
 * - Archive-only (no hard delete). Canonical = title+store+vendor+cat+due_date+amount+recurrence
 * - created_by is NOT a uniqueness key
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
    if (preg_match('/^([\'"])(.*)\\1$/', $val, $m)) $val = $m[2];
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
    $note = preg_replace('/[\'"]/', ' ', $note);
    $note = substr($note, 0, 500);
    $pdo->exec("INSERT INTO audit_logs (module,action,record_type,record_id,user_id,note,created_at) " .
        "VALUES ('$mod','$act','$rtype',$rid,$uid,'" . $pdo->quote($note) . "',NOW())");
}
@mkdir($REPORT_DIR = __DIR__ . '/reports', 0755, true);
@mkdir($BACKUP_DIR = __DIR__ . '/backups', 0755, true);
""")

# === STEP 1: BACKUP ===
parts.append(r"""
// ════════════════════════════════════════════════════════════════════════════════
// STEP 1 — FULL DATABASE BACKUP
// ════════════════════════════════════════════════════════════════════════════════
if ($step === 'all' || $step === '1' || $step === 'backup') {
    $TABLES = [
        'tasks','users','comments','attachments','files','images',
        'credentials','credential_permissions','task_approval_events',
        'audit_logs','notifications','stores','projects','shifts',
        'bills','employees','deadline_extensions',
        'penalties','penalty_assessments','penalty_history',
        'penalty_rules','task_penalties','penalty_daily_snapshots',
        'penalty_log','payments','vendors',
        'duplicate_task_flags','duplicate_bill_flags',
        'obligation_payments','obligation_tasks','obligations',
    ];
    $ts = date('Y-m-d_H-i-s');
    $fn = "P0_BACKUP_{$ts}.sql.gz";
    $fp = gzopen($BACKUP_DIR . '/' . $fn, 'w');
    if (!$fp) {
        $out['backup'] = ['error' => "Cannot write {$BACKUP_DIR}/{$fn}"];
    } else {
        gzwrite($fp, "-- P0 Backup {$ts} | DB:{$DB_NAME}\nSET FOREIGN_KEY_CHECKS=0;\n\n");
        $tc = [];
        foreach ($TABLES as $tbl) {
            $safe = preg_replace('/[^a-zA-Z0-9_]/', '', $tbl);
            if (!$pdo->query("SELECT 1 FROM information_schema.tables WHERE table_schema='{$DB_NAME}' AND table_name='{$safe}' LIMIT 1")->fetchColumn()) continue;
            $cnt = (int)$pdo->query("SELECT COUNT(*) FROM `{$safe}`")->fetchColumn();
            $tc[$safe] = $cnt;
            $cr = $pdo->query("SHOW CREATE TABLE `{$safe}`")->fetch();
            if ($cr) {
                gzwrite($fp, "\n-- {$safe} ({$cnt})\nDROP TABLE IF EXISTS `{$safe}`;\n{$cr['Create Table']};\n\n");
            }
            if ($cnt > 0) {
                $off = 0; $ch = 200;
                while (1) {
                    $rows = $pdo->query("SELECT * FROM `{$safe}` LIMIT {$ch} OFFSET {$off}")->fetchAll(PDO::FETCH_ASSOC);
                    if (!$rows) break;
                    $cs = array_map(fn($c) => '`' . preg_replace('/[^a-zA-Z0-9_]/', '', $c) . '`', array_keys($rows[0]));
                    $vl = [];
                    foreach ($rows as $row) {
                        $p2 = [];
                        foreach (array_values($row) as $v) {
                            if ($v === null) $p2[] = 'NULL';
                            elseif (is_numeric($v)) $p2[] = (string)$v;
                            else $p2[] = $pdo->quote((string)$v);
                        }
                        $vl[] = '(' . implode(',', $p2) . ')';
                    }
                    gzwrite($fp, "INSERT INTO `{$safe}` (" . implode(',', $cs) . ") VALUES\n");
                    gzwrite($fp, implode(",\n", $vl) . ";\n");
                    $off += $ch;
                    if (count($rows) < $ch) break;
                }
            }
        }
        gzwrite($fp, "\nSET FOREIGN_KEY_CHECKS=1;\n");
        gzclose($fp);
        $fsz = filesize($BACKUP_DIR . '/' . $fn);
        $out['backup'] = [
            'filename' => $fn, 'filepath' => $BACKUP_DIR . '/' . $fn,
            'timestamp' => $ts, 'size_bytes' => $fsz,
            'size_human' => round($fsz / 1048576, 2) . ' MB',
            'tables' => $tc, 'tables_count' => count($tc), 'ok' => true,
        ];
    }
}
""")

# === STEP 2: REPRO ===
parts.append(r"""
// ════════════════════════════════════════════════════════════════════════════════
// STEP 2 — REPRO (visible duplicates from active records)
// ════════════════════════════════════════════════════════════════════════════════
if ($step === 'all' || $step === '2' || $step === 'repro') {
    $bills = $pdo->query("
        SELECT b.id, b.bill_name AS title, b.store_id, b.vendor_id, b.category,
               b.due_date, b.amount, b.repeat_rule,
               COALESCE(s.name,'N/A') AS store_name,
               COALESCE(v.name,'N/A') AS vendor_name,
               b.status, b.is_paid, b.created_by, b.created_at
        FROM bills b
        LEFT JOIN stores s ON s.id = b.store_id
        LEFT JOIN vendors v ON v.id = b.vendor_id
        WHERE (b.is_archived = 0 OR b.is_archived IS NULL)
        ORDER BY b.store_id, b.due_date, b.bill_name
    ")->fetchAll(PDO::FETCH_ASSOC);

    $eG = []; $eD = [];
    foreach ($bills as $b) {
        $k = strtolower(trim($b['title'] ?? '')) . '|' . ($b['store_id'] ?? '') . '|' . ($b['due_date'] ?? '');
        $eG[$k][] = $b;
    }
    foreach ($eG as $k => $g) if (count($g) > 1) $eD[$k] = $g;

    $sG = []; $sD = [];
    foreach ($bills as $b) {
        $k = strtolower(trim($b['title'] ?? '')) . '|' . ($b['store_id'] ?? '') . '|' . ($b['amount'] ?? '');
        $sG[$k][] = $b;
    }
    foreach ($sG as $k => $g) if (count($g) > 1) $sD[$k] = $g;

    $tD = [];
    if (tEx($pdo, 'tasks')) {
        $tasks = $pdo->query("
            SELECT t.id, t.title, t.store_id, t.assigned_to, t.due_date,
                   COALESCE(s.name,'N/A') AS store_name,
                   t.status, t.archived_duplicate, t.created_at
            FROM tasks t LEFT JOIN stores s ON s.id = t.store_id
            WHERE t.deleted_at IS NULL
              AND (t.archived_duplicate = 0 OR t.archived_duplicate IS NULL)
            ORDER BY t.store_id, t.due_date, t.title
        ")->fetchAll(PDO::FETCH_ASSOC);
        $tG = [];
        foreach ($tasks as $t) {
            $k = strtolower(trim($t['title'] ?? '')) . '|' . ($t['store_id'] ?? '') . '|' . ($t['due_date'] ?? '');
            $tG[$k][] = $t;
        }
        foreach ($tG as $k => $g) if (count($g) > 1) $tD[$k] = $g;
    }

    $out['repro'] = [
        'active_bills' => count($bills),
        'active_tasks' => tEx($pdo, 'tasks')
            ? (int)$pdo->query("SELECT COUNT(*) FROM tasks WHERE deleted_at IS NULL AND (archived_duplicate=0 OR archived_duplicate IS NULL)")->fetchColumn()
            : 0,
        'bill_exact_duplicates' => [
            'groups' => count($eD),
            'total_records' => array_sum(array_map('count', $eD)),
            'samples' => array_slice(array_values($eD), 0, 10, true),
        ],
        'bill_soft_duplicates' => [
            'groups' => count($sD),
            'total_records' => array_sum(array_map('count', $sD)),
            'samples' => array_slice(array_values($sD), 0, 10, true),
        ],
        'task_duplicates' => [
            'groups' => count($tD),
            'total_records' => array_sum(array_map('count', $tD)),
        ],
    ];
}
""")

# === STEP 3: AUDIT ===
parts.append(r"""
// ════════════════════════════════════════════════════════════════════════════════
// STEP 3 — DEEP AUDIT (fuzzy + normalized matching)
// ════════════════════════════════════════════════════════════════════════════════
if ($step === 'all' || $step === '3' || $step === 'audit') {
    $bills = $pdo->query("
        SELECT b.*, COALESCE(s.name,'N/A') AS store_name,
               COALESCE(v.name,'N/A') AS vendor_name
        FROM bills b
        LEFT JOIN stores s ON s.id = b.store_id
        LEFT JOIN vendors v ON v.id = b.vendor_id
        WHERE (b.is_archived = 0 OR b.is_archived IS NULL)
    ")->fetchAll(PDO::FETCH_ASSOC);

    $L1 = []; $L2 = []; $L3 = [];
    foreach ($bills as $b) {
        $k1 = implode('|', [
            't:' . strtolower(trim($b['bill_name'] ?? '')),
            's:' . ($b['store_id'] ?? ''),
            'v:' . ($b['vendor_id'] ?? ''),
            'd:' . ($b['due_date'] ?? ''),
            'a:' . ($b['amount'] ?? ''),
            'r:' . ($b['repeat_rule'] ?? ''),
        ]); $L1[$k1][] = $b;
        $k2 = implode('|', [
            't:' . strtolower(trim($b['bill_name'] ?? '')),
            's:' . ($b['store_id'] ?? ''),
            'v:' . ($b['vendor_id'] ?? ''),
            'a:' . ($b['amount'] ?? ''),
        ]); $L2[$k2][] = $b;
        $k3 = implode('|', [
            't:' . strtolower(trim($b['bill_name'] ?? '')),
            's:' . ($b['store_id'] ?? ''),
        ]); $L3[$k3][] = $b;
    }
    $d1 = array_filter($L1, fn($g) => count($g) > 1);
    $d2 = array_filter($L2, fn($g) => count($g) > 1);
    $d3 = array_filter($L3, fn($g) => count($g) > 1);

    $pD = [];
    if (tEx($pdo, 'payments')) {
        $pays = $pdo->query("SELECT id, bill_id, amount, paid_at, created_at FROM payments")->fetchAll(PDO::FETCH_ASSOC);
        $pG = [];
        foreach ($pays as $p) {
            $k = ($p['bill_id'] ?? '') . '|' . ($p['amount'] ?? '') . '|' . ($p['paid_at'] ?? '');
            $pG[$k][] = $p;
        }
        foreach ($pG as $k => $g) if (count($g) > 1) $pD[$k] = $g;
    }

    $templates = $pdo->query("
        SELECT id, bill_name AS title, store_id, vendor_id, amount, due_date, repeat_rule
        FROM bills
        WHERE (is_archived = 0 OR is_archived IS NULL)
          AND repeat_rule IS NOT NULL AND repeat_rule != ''
    ")->fetchAll(PDO::FETCH_ASSOC);

    $out['audit'] = [
        'bills' => [
            'L1_exact_6field' => [
                'groups' => count($d1),
                'records' => array_sum(array_map('count', $d1)),
                'sample_keys' => array_slice(array_keys($d1), 0, 15),
            ],
            'L2_title_store_vendor_amt' => [
                'groups' => count($d2),
                'records' => array_sum(array_map('count', $d2)),
            ],
            'L3_title_store' => [
                'groups' => count($d3),
                'records' => array_sum(array_map('count', $d3)),
            ],
        ],
        'payments' => [
            'groups' => count($pD),
            'records' => array_sum(array_map('count', $pD)),
        ],
        'recurring_templates' => count($templates),
        'ts' => date('c'),
    ];
}
""")

# === STEP 4: CLEANUP ===
parts.append(r"""
// ════════════════════════════════════════════════════════════════════════════════
// STEP 4 — CLEANUP (archive duplicates, keep canonical — NO hard deletes)
// ════════════════════════════════════════════════════════════════════════════════
if ($step === 'all' || $step === '4' || $step === 'cleanup') {
    if ($dry) {
        $out['cleanup'] = ['note' => 'DRY RUN — no changes made', 'dry_run' => true];
    } else {
        $pdo->beginTransaction();
        $log = [
            'bills_archived' => 0, 'bills_kept' => 0,
            'tasks_archived' => 0, 'tasks_kept' => 0,
            'payments_archived' => 0,
            'groups_processed' => 0,
            'errors' => [],
        ];

        try {
            // BILLS: group by title+store+due_date+amount+repeat
            $bills = $pdo->query("
                SELECT b.*, COALESCE(s.name,'N/A') AS store_name,
                       COALESCE(v.name,'N/A') AS vendor_name
                FROM bills b
                LEFT JOIN stores s ON s.id = b.store_id
                LEFT JOIN vendors v ON v.id = b.vendor_id
                WHERE (b.is_archived = 0 OR b.is_archived IS NULL)
            ")->fetchAll(PDO::FETCH_ASSOC);

            $groups = [];
            foreach ($bills as $b) {
                $k = implode('|', [
                    't:' . strtolower(trim($b['bill_name'] ?? '')),
                    's:' . ($b['store_id'] ?? ''),
                    'd:' . ($b['due_date'] ?? ''),
                    'a:' . ($b['amount'] ?? ''),
                    'r:' . ($b['repeat_rule'] ?? ''),
                ]);
                $groups[$k][] = $b;
            }

            foreach ($groups as $k => $g) {
                $log['groups_processed']++;
                if (count($g) <= 1) { $log['bills_kept']++; continue; }
                $canon = $g[0];
                $dups  = array_slice($g, 1);
                foreach ($dups as $d) {
                    $id = (int)$d['id'];
                    try {
                        $pdo->exec("UPDATE bills SET is_archived=1, status='archived_duplicate', updated_at=NOW() WHERE id=$id");
                        logAudit($pdo, 'bills', 'archive_duplicate', 'bill', $id, $actor,
                            "P0 CEO: archived duplicate of bill#{$canon['id']} | {$canon['bill_name']} | {$canon['store_name']}");
                        $log['bills_archived']++;
                    } catch (Throwable $e) {
                        $log['errors'][] = "bill:$id " . $e->getMessage();
                    }
                }
                $log['bills_kept']++;
            }

            // TASKS: group by title+store+due_date
            if (tEx($pdo, 'tasks')) {
                $tasks = $pdo->query("
                    SELECT t.*, COALESCE(s.name,'N/A') AS store_name
                    FROM tasks t LEFT JOIN stores s ON s.id = t.store_id
                    WHERE t.deleted_at IS NULL
                      AND (t.archived_duplicate = 0 OR t.archived_duplicate IS NULL)
                ")->fetchAll(PDO::FETCH_ASSOC);
                $tG = [];
                foreach ($tasks as $t) {
                    $k = strtolower(trim($t['title'] ?? '')) . '|'