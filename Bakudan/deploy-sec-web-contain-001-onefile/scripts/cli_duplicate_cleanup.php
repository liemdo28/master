<?php
/**
 * P0 Emergency Duplicate Cleanup
 * CEO-approved 2026-06-12
 * Archive 307 duplicate bills, 102 duplicate tasks, fix 28 overdue bills
 * DRY RUN by default — pass --execute to actually run
 */

$dryRun = !in_array('--execute', $argv ?? []);

chdir(dirname(__DIR__));
require_once __DIR__ . '/../config/database.php';

$db  = Database::getInstance();
$pdo = $db->getConnection();

$log = [];
function out(string $msg): void {
    global $log;
    $log[] = $msg;
    echo $msg . "\n";
}

out("=== P0 DUPLICATE CLEANUP ===");
out("Mode: " . ($dryRun ? "DRY RUN (no changes)" : "EXECUTE (real changes)"));
out("Time: " . date('Y-m-d H:i:s'));
out("");

// ─── STEP 1: Archive duplicate bills ────────────────────────────────────────

$billArchiveIds = array_merge(
    // May batch: 28–186 excluding canonicals 22–27
    range(28, 186),
    // June batch: 195–279 excluding canonicals 187–194
    range(195, 279),
    // July batch: 286–348 excluding canonicals 280–285
    range(286, 348)
);

out("STEP 1: Archive " . count($billArchiveIds) . " duplicate bills");

// Verify these bills exist and are not already archived
$placeholders = implode(',', array_fill(0, count($billArchiveIds), '?'));
$existing = $pdo->prepare("SELECT id, title, is_archived FROM bills WHERE id IN ($placeholders)");
$existing->execute($billArchiveIds);
$rows = $existing->fetchAll(PDO::FETCH_ASSOC);

$alreadyArchived = array_filter($rows, fn($r) => $r['is_archived'] == 1);
$toArchive       = array_filter($rows, fn($r) => $r['is_archived'] != 1);

out("  Found in DB: " . count($rows) . " / " . count($billArchiveIds));
out("  Already archived: " . count($alreadyArchived));
out("  Will archive: " . count($toArchive));

if (!$dryRun && count($toArchive) > 0) {
    $idsToArchive = array_column($toArchive, 'id');
    $ph2 = implode(',', array_fill(0, count($idsToArchive), '?'));
    $stmt = $pdo->prepare("UPDATE bills SET is_archived=1 WHERE id IN ($ph2)");
    $stmt->execute($idsToArchive);
    $affected = $stmt->rowCount();
    out("  ✅ Archived $affected bills");
} elseif ($dryRun) {
    out("  [DRY RUN] Would archive " . count($toArchive) . " bills");
}

// ─── STEP 2: Fix overdue status ─────────────────────────────────────────────

out("");
out("STEP 2: Fix overdue bill status");

$overdueCheck = $pdo->query(
    "SELECT COUNT(*) FROM bills
     WHERE due_date < CURDATE() AND status='pending' AND COALESCE(is_archived,0)=0"
);
$overdueCount = (int)$overdueCheck->fetchColumn();
out("  Bills with due_date < today and status=pending: $overdueCount");

if (!$dryRun && $overdueCount > 0) {
    $stmt = $pdo->query(
        "UPDATE bills SET status='overdue'
         WHERE due_date < CURDATE() AND status='pending' AND COALESCE(is_archived,0)=0"
    );
    out("  ✅ Updated " . $stmt->rowCount() . " bills to overdue");
} elseif ($dryRun) {
    out("  [DRY RUN] Would update $overdueCount bills to overdue");
}

// ─── STEP 3: Archive duplicate tasks ────────────────────────────────────────

out("");
out("STEP 3: Archive duplicate tasks");

$taskArchiveIds = [
    // Batch A (18xxx)
    18226, 18233, 18250, 18257, 18264, 18278, 18279, 18294, 18295,
    18323, 18324, 18325, 18326, 18354, 18355, 18356, 18357,
    18385, 18386, 18387, 18388, 18395, 18407, 18414, 18421,
    18436, 18464, 18465, 18466, 18467, 18481, 18482,
    18510, 18511, 18512, 18513, 18542, 18543, 18544, 18545,
    18573, 18574, 18575, 18576, 18589, 18616, 18617, 18618, 18619,
    18626, 18633, 18640, 18654, 18655, 18664, 18671, 18678,
    18693, 18694, 18695, 18696, 18697, 18698, 18707, 18710, 18711,
    18718, 18725, 18740, 18747, 18750, 18762, 18778,
    // Batch B (20xxx) + misc
    20054, 20185, 20186, 20187, 20188, 20189, 20190, 20191, 20192,
    20193, 20194, 20195, 20196, 20197, 20198, 20199, 20200, 20201,
    20202, 20203, 20204, 20205, 20206, 20209,
    18211, 18932, 19538, 19807, 20051,
];

// Detect which column to use for soft-delete
$colCheck = $pdo->query("SHOW COLUMNS FROM tasks LIKE 'is_deleted'");
$hasIsDeleted = $colCheck->rowCount() > 0;

$colCheck2 = $pdo->query("SHOW COLUMNS FROM tasks LIKE 'is_archived'");
$hasIsArchived = $colCheck2->rowCount() > 0;

$colCheck3 = $pdo->query("SHOW COLUMNS FROM tasks LIKE 'status'");
$hasStatus = $colCheck3->rowCount() > 0;

out("  Task columns: is_deleted=" . ($hasIsDeleted?'yes':'no') . " is_archived=" . ($hasIsArchived?'yes':'no') . " status=" . ($hasStatus?'yes':'no'));

$tph = implode(',', array_fill(0, count($taskArchiveIds), '?'));
$existingTasks = $pdo->prepare("SELECT id FROM tasks WHERE id IN ($tph)");
$existingTasks->execute($taskArchiveIds);
$foundTaskIds = array_column($existingTasks->fetchAll(PDO::FETCH_ASSOC), 'id');

out("  Found in DB: " . count($foundTaskIds) . " / " . count($taskArchiveIds));

if (!$dryRun && count($foundTaskIds) > 0) {
    $tph2 = implode(',', array_fill(0, count($foundTaskIds), '?'));
    if ($hasIsDeleted) {
        $stmt = $pdo->prepare("UPDATE tasks SET is_deleted=1 WHERE id IN ($tph2)");
        $stmt->execute($foundTaskIds);
        out("  ✅ Set is_deleted=1 on " . $stmt->rowCount() . " tasks");
    } elseif ($hasIsArchived) {
        $stmt = $pdo->prepare("UPDATE tasks SET is_archived=1 WHERE id IN ($tph2)");
        $stmt->execute($foundTaskIds);
        out("  ✅ Set is_archived=1 on " . $stmt->rowCount() . " tasks");
    } elseif ($hasStatus) {
        $stmt = $pdo->prepare("UPDATE tasks SET status='archived' WHERE id IN ($tph2)");
        $stmt->execute($foundTaskIds);
        out("  ✅ Set status=archived on " . $stmt->rowCount() . " tasks");
    } else {
        out("  ⚠️ No soft-delete column found on tasks table — skipping task archive");
    }
} elseif ($dryRun) {
    out("  [DRY RUN] Would archive " . count($foundTaskIds) . " tasks");
}

// ─── STEP 4: Verification ────────────────────────────────────────────────────

out("");
out("STEP 4: Post-cleanup verification");

$activeBills  = (int)$pdo->query("SELECT COUNT(*) FROM bills WHERE COALESCE(is_archived,0)=0")->fetchColumn();
$overdueBills = (int)$pdo->query("SELECT COUNT(*) FROM bills WHERE status='overdue' AND COALESCE(is_archived,0)=0")->fetchColumn();
$pendingBills = (int)$pdo->query("SELECT COUNT(*) FROM bills WHERE status='pending' AND COALESCE(is_archived,0)=0")->fetchColumn();
$archivedBills = (int)$pdo->query("SELECT COUNT(*) FROM bills WHERE is_archived=1")->fetchColumn();

out("  Bills active:   $activeBills  (target: 40)");
out("  Bills overdue:  $overdueBills (target: 28)");
out("  Bills pending:  $pendingBills");
out("  Bills archived: $archivedBills (target: 307+)");

// Task count
$taskWhere = $hasIsDeleted ? "COALESCE(is_deleted,0)=0" : ($hasIsArchived ? "COALESCE(is_archived,0)=0" : "1=1");
$activeTasks = (int)$pdo->query("SELECT COUNT(*) FROM tasks WHERE $taskWhere")->fetchColumn();
out("  Tasks active:   $activeTasks  (target: ~1568)");

out("");
out($dryRun ? "=== DRY RUN COMPLETE — rerun with --execute to apply ===" : "=== CLEANUP COMPLETE ===");
