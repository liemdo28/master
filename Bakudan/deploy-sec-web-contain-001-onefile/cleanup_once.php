<?php
/**
 * ONE-TIME CLEANUP — Run once via CLI or browser (admin only)
 *
 * Actions:
 *  1. Delete project "Flight's Plan" + all its tasks
 *  2. Delete ALL tasks overdue ≥ 7 days (is_completed=0) — duplicate/stale
 *
 * ⚠️  DELETE this file after running.
 */

$root = __DIR__;
require_once $root . '/config/database.php';

// Browser safety gate
if (PHP_SAPI !== 'cli') {
    session_start();
    if (empty($_GET['confirm']) || $_GET['confirm'] !== 'yes') {
        echo '<html><body style="font-family:sans-serif;background:#0f172a;color:#f1f5f9;padding:40px">';
        echo '<h2>⚠️ Cleanup Script</h2>';
        echo '<p>This will permanently delete:<br>';
        echo '&bull; Project "Flight\'s Plan" and all its tasks<br>';
        echo '&bull; All tasks overdue ≥ 7 days (non-completed)</p>';
        echo '<p><a href="?confirm=yes" style="background:#dc2626;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block">⚠️ Confirm &amp; Run Cleanup</a></p>';
        echo '</body></html>';
        exit;
    }
}

$db  = Database::getInstance();
$log = [];

// ── 1. Delete Flight's Plan project ────────────────────────────────────────
$flightProject = $db->fetch(
    "SELECT id, name FROM projects WHERE name LIKE '%Flight%Plan%' OR name LIKE '%Flight%s Plan%' LIMIT 1"
);

if ($flightProject) {
    $pid = (int)$flightProject['id'];
    $taskCount = $db->fetch("SELECT COUNT(*) AS cnt FROM tasks WHERE project_id = ?", [$pid]);
    $log[] = "Found project: \"{$flightProject['name']}\" (ID={$pid}) with {$taskCount['cnt']} tasks";

    // Get IDs of tasks in this project (to delete their sub-tasks)
    $projTaskIds = $db->fetchAll("SELECT id FROM tasks WHERE project_id = ?", [$pid]);
    if (!empty($projTaskIds)) {
        $idList = implode(',', array_map(function($r){ return (int)$r['id']; }, $projTaskIds));
        // Delete sub-tasks using JOIN (avoids MySQL "can't specify target table" error)
        $subDel = $db->execute(
            "DELETE t FROM tasks t INNER JOIN tasks parent ON t.parent_task_id = parent.id WHERE parent.project_id = ?",
            [$pid]
        );
        if ($subDel > 0) $log[] = "  → Deleted {$subDel} sub-tasks";
    }

    // Delete parent tasks in project
    $taskDel = $db->execute("DELETE FROM tasks WHERE project_id = ?", [$pid]);
    $log[] = "  → Deleted {$taskDel} tasks from project";

    // Delete project
    $db->execute("DELETE FROM projects WHERE id = ?", [$pid]);
    $log[] = "  → Deleted project \"{$flightProject['name']}\"";
} else {
    $log[] = "⚠️  Project 'Flight's Plan' not found — skipping";
}

// ── 2. Delete all tasks overdue ≥ 7 days ───────────────────────────────────
$cutoff = date('Y-m-d', strtotime('-7 days'));

$overdueList = $db->fetchAll(
    "SELECT t.id, t.title, t.due_date, p.name as project_name
     FROM tasks t
     LEFT JOIN projects p ON p.id = t.project_id
     WHERE t.is_completed = 0
       AND t.due_date IS NOT NULL
       AND t.due_date < ?
     ORDER BY t.due_date ASC",
    [$cutoff]
);

$log[] = "\nFound " . count($overdueList) . " tasks overdue ≥ 7 days (due before {$cutoff}):";
foreach ($overdueList as $t) {
    $log[] = "  [{$t['id']}] {$t['title']} | project: {$t['project_name']} | due: {$t['due_date']}";
}

if (!empty($overdueList)) {
    // Delete sub-tasks using JOIN (avoids MySQL subquery-on-same-table error)
    $subDel = $db->execute(
        "DELETE t FROM tasks t
         INNER JOIN tasks parent ON t.parent_task_id = parent.id
         WHERE parent.is_completed = 0
           AND parent.due_date IS NOT NULL
           AND parent.due_date < ?",
        [$cutoff]
    );
    if ($subDel > 0) $log[] = "  → Deleted {$subDel} sub-tasks";

    // Delete the overdue tasks
    $overdueDel = $db->execute(
        "DELETE FROM tasks WHERE is_completed = 0 AND due_date IS NOT NULL AND due_date < ?",
        [$cutoff]
    );
    $log[] = "  → Deleted {$overdueDel} overdue tasks";
} else {
    $log[] = "  → No overdue tasks to delete";
}

// ── 3. Delete ALL tasks from 2025 and earlier ──────────────────────────────
$log[] = "\n── Step 3: Delete all tasks from year ≤ 2025 ──";

$oldCount = $db->fetch(
    "SELECT COUNT(*) AS cnt FROM tasks WHERE due_date IS NOT NULL AND YEAR(due_date) <= 2025"
);
$log[] = "Found {$oldCount['cnt']} tasks with due_date in 2025 or earlier";

if ($oldCount['cnt'] > 0) {
    // Delete child tasks first (JOIN avoids same-table subquery error)
    $oldSubDel = $db->execute(
        "DELETE t FROM tasks t
         INNER JOIN tasks parent ON t.parent_task_id = parent.id
         WHERE parent.due_date IS NOT NULL AND YEAR(parent.due_date) <= 2025"
    );
    if ($oldSubDel > 0) $log[] = "  → Deleted {$oldSubDel} child tasks";

    // Delete tasks with due_date in 2025 or earlier
    $oldDel = $db->execute(
        "DELETE FROM tasks WHERE due_date IS NOT NULL AND YEAR(due_date) <= 2025"
    );
    $log[] = "  → Deleted {$oldDel} tasks from 2025 and earlier";
}

// Also delete tasks with NULL due_date created in 2025 or earlier
$oldNullCount = $db->fetch(
    "SELECT COUNT(*) AS cnt FROM tasks WHERE due_date IS NULL AND YEAR(created_at) <= 2025"
);
if ($oldNullCount['cnt'] > 0) {
    $log[] = "Found {$oldNullCount['cnt']} tasks with no due_date created in 2025 or earlier";
    $oldNullDel = $db->execute(
        "DELETE FROM tasks WHERE due_date IS NULL AND YEAR(created_at) <= 2025"
    );
    $log[] = "  → Deleted {$oldNullDel} undated old tasks";
}

// ── Output ──────────────────────────────────────────────────────────────────
$output = implode("\n", $log);

if (PHP_SAPI === 'cli') {
    echo $output . "\n\n✅ Done. Delete this file: rm cleanup_once.php\n";
} else {
    echo '<html><body style="font-family:sans-serif;background:#0f172a;color:#f1f5f9;padding:40px">';
    echo '<pre style="background:#1e293b;color:#94a3b8;padding:24px;font-size:13px;border-radius:12px;max-width:900px;line-height:1.7">';
    echo '<strong style="color:#22c55e;font-size:16px">✅ Cleanup Complete</strong>' . "\n\n";
    echo htmlspecialchars($output);
    echo '</pre>';
    echo '<p style="color:#ef4444;font-weight:700;margin-top:20px">⚠️ Delete this file from server now: <code>cleanup_once.php</code></p>';
    echo '<p><a href="https://dashboard.bakudanramen.com/overview" style="color:#60a5fa">→ Go to Overview</a></p>';
    echo '</body></html>';
}
