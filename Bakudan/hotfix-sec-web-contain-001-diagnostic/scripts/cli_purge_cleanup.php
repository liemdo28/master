<?php
/**
 * P0 Purge Cleanup
 *
 * Step 1: Mark tasks overdue by 10+ days as 'completed'
 * Step 2: Hard DELETE archived bills (duplicates from P0 cleanup)
 * Step 3: Hard DELETE archived tasks (duplicates from P0 cleanup)
 * Step 4: Hard DELETE duplicate payments (amount+bill_id+date collision)
 *
 * Usage:
 *   php cli_purge_cleanup.php          # dry-run
 *   php cli_purge_cleanup.php --execute
 */

$execute = in_array('--execute', $argv ?? []);
$mode = $execute ? 'EXECUTE' : 'DRY-RUN';

$root = dirname(__DIR__);
require_once $root . '/config/database.php';

$db = Database::getInstance();

echo "=== P0 PURGE CLEANUP [{$mode}] ===\n";
echo "Timestamp: " . date('Y-m-d H:i:s') . "\n\n";

// ─── STEP 1: Mark overdue tasks (10+ days) as completed ──────────────────────
echo "--- STEP 1: Complete tasks overdue ≥10 days ---\n";

$rows = $db->fetchAll(
    "SELECT id, title, due_date, status
     FROM tasks
     WHERE status IN ('pending','overdue')
       AND COALESCE(is_archived, 0) = 0
       AND due_date IS NOT NULL
       AND due_date < DATE_SUB(CURDATE(), INTERVAL 10 DAY)
     ORDER BY due_date ASC
     LIMIT 500"
);

echo "Tasks to complete: " . count($rows) . "\n";
foreach ($rows as $r) {
    echo "  id={$r['id']} due={$r['due_date']} status={$r['status']} | {$r['title']}\n";
}

if ($execute && count($rows) > 0) {
    $ids = array_column($rows, 'id');
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $db->execute("UPDATE tasks SET status='completed', updated_at=NOW() WHERE id IN ({$placeholders})", $ids);
    echo "DONE: " . count($ids) . " tasks marked completed.\n";
} elseif (!$execute) {
    echo "[DRY-RUN] Would mark " . count($rows) . " tasks as completed.\n";
}

echo "\n";

// ─── STEP 2: Hard DELETE archived bills ──────────────────────────────────────
echo "--- STEP 2: Hard DELETE archived bills (is_archived=1) ---\n";

$archivedBills = $db->fetchAll(
    "SELECT id, title, status, amount, due_date FROM bills WHERE COALESCE(is_archived,0)=1 ORDER BY id"
);

echo "Archived bills to DELETE: " . count($archivedBills) . "\n";
if (count($archivedBills) > 0) {
    $sample = array_slice($archivedBills, 0, 10);
    foreach ($sample as $b) {
        echo "  id={$b['id']} \${$b['amount']} due={$b['due_date']} | {$b['title']}\n";
    }
    if (count($archivedBills) > 10) {
        echo "  ... and " . (count($archivedBills) - 10) . " more\n";
    }
}

if ($execute && count($archivedBills) > 0) {
    $db->execute("DELETE FROM bills WHERE COALESCE(is_archived,0)=1");
    echo "DONE: " . count($archivedBills) . " archived bills hard-deleted.\n";
} elseif (!$execute) {
    echo "[DRY-RUN] Would DELETE " . count($archivedBills) . " archived bills.\n";
}

echo "\n";

// ─── STEP 3: Hard DELETE archived tasks ──────────────────────────────────────
echo "--- STEP 3: Hard DELETE archived tasks (is_archived=1) ---\n";

$archivedTasks = $db->fetchAll(
    "SELECT id, title, status FROM tasks WHERE COALESCE(is_archived,0)=1 ORDER BY id"
);

echo "Archived tasks to DELETE: " . count($archivedTasks) . "\n";
if (count($archivedTasks) > 0) {
    $sample = array_slice($archivedTasks, 0, 10);
    foreach ($sample as $t) {
        echo "  id={$t['id']} status={$t['status']} | {$t['title']}\n";
    }
    if (count($archivedTasks) > 10) {
        echo "  ... and " . (count($archivedTasks) - 10) . " more\n";
    }
}

if ($execute && count($archivedTasks) > 0) {
    $db->execute("DELETE FROM tasks WHERE COALESCE(is_archived,0)=1");
    echo "DONE: " . count($archivedTasks) . " archived tasks hard-deleted.\n";
} elseif (!$execute) {
    echo "[DRY-RUN] Would DELETE " . count($archivedTasks) . " archived tasks.\n";
}

echo "\n";

// ─── STEP 4: Hard DELETE duplicate payments ───────────────────────────────────
echo "--- STEP 4: Hard DELETE duplicate payments ---\n";

// Detect duplicates: same bill_id + amount + DATE(payment_date), keep lowest id
$dupPayments = [];
if ($db->tableExists('payments')) {
    $dupPayments = $db->fetchAll(
        "SELECT id FROM payments
         WHERE id NOT IN (
             SELECT MIN(id) FROM payments
             GROUP BY bill_id, amount, DATE(payment_date)
         )
         ORDER BY id"
    );
    echo "Duplicate payments to DELETE: " . count($dupPayments) . "\n";

    if ($execute && count($dupPayments) > 0) {
        $ids = array_column($dupPayments, 'id');
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $db->execute("DELETE FROM payments WHERE id IN ({$placeholders})", $ids);
        echo "DONE: " . count($ids) . " duplicate payments hard-deleted.\n";
    } elseif (!$execute) {
        echo "[DRY-RUN] Would DELETE " . count($dupPayments) . " duplicate payments.\n";
    }
} else {
    echo "payments table not found — skipping.\n";
}

echo "\n";

// ─── VERIFICATION ─────────────────────────────────────────────────────────────
echo "--- VERIFICATION (post-run counts) ---\n";

$activeBills    = $db->fetch("SELECT COUNT(*) AS n FROM bills WHERE COALESCE(is_archived,0)=0")['n'];
$archivedBillsR = $db->fetch("SELECT COUNT(*) AS n FROM bills WHERE COALESCE(is_archived,0)=1")['n'];
$overdueBills   = $db->fetch("SELECT COUNT(*) AS n FROM bills WHERE COALESCE(is_archived,0)=0 AND status='overdue'")['n'];
$activeTasks    = $db->fetch("SELECT COUNT(*) AS n FROM tasks WHERE COALESCE(is_archived,0)=0")['n'];
$archivedTasksR = $db->fetch("SELECT COUNT(*) AS n FROM tasks WHERE COALESCE(is_archived,0)=1")['n'];
$overdueTasks   = $db->fetch("SELECT COUNT(*) AS n FROM tasks WHERE COALESCE(is_archived,0)=0 AND status='overdue'")['n'];
$completedTasks = $db->fetch("SELECT COUNT(*) AS n FROM tasks WHERE COALESCE(is_archived,0)=0 AND status='completed'")['n'];

echo "bills_active    : {$activeBills}\n";
echo "bills_archived  : {$archivedBillsR}\n";
echo "bills_overdue   : {$overdueBills}\n";
echo "tasks_active    : {$activeTasks}\n";
echo "tasks_archived  : {$archivedTasksR}\n";
echo "tasks_overdue   : {$overdueTasks}\n";
echo "tasks_completed : {$completedTasks}\n";

if ($db->tableExists('payments')) {
    $totalPayments = $db->fetch("SELECT COUNT(*) AS n FROM payments")['n'];
    echo "payments_total  : {$totalPayments}\n";
}

echo "\n=== [{$mode}] DONE ===\n";
