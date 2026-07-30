<?php
/**
 * CLI script to deduplicate bills in production DB.
 * Safe to run multiple times (idempotent).
 * Usage: php scripts/cli_deduplicate_bills.php
 */
chdir(dirname(__DIR__));
require_once __DIR__ . '/../config/database.php';

$pdo = Database::getInstance()->getConnection();

echo "=== Bill Deduplication Script ===\n";

// Count before
$before = $pdo->query("SELECT COUNT(*) FROM bills")->fetchColumn();
echo "Bills before: $before\n\n";

// Step 1: For each (store_id, title, repeat_type) recurring template group,
// find the keeper (prefer paid, else smallest id)
echo "Step 1: Finding duplicate templates...\n";
$groups = $pdo->query("
    SELECT store_id, title, repeat_type,
           MIN(CASE WHEN status='paid' THEN id ELSE NULL END) AS paid_id,
           MIN(id) AS oldest_id,
           COUNT(*) AS cnt
    FROM bills
    WHERE (repeat_parent_id IS NULL OR repeat_parent_id = 0)
      AND repeat_type IS NOT NULL AND repeat_type <> 'none'
    GROUP BY store_id, title, repeat_type
    HAVING COUNT(*) > 1
")->fetchAll(PDO::FETCH_ASSOC);

$templatesDeleted = 0;
foreach ($groups as $g) {
    $keepId = $g['paid_id'] ?? $g['oldest_id'];
    echo "  Group: store={$g['store_id']} title=\"{$g['title']}\" repeat={$g['repeat_type']} count={$g['cnt']} keep=$keepId\n";

    // Reassign children of doomed templates to keeper
    $pdo->prepare("
        UPDATE bills SET repeat_parent_id = ?
        WHERE repeat_parent_id IN (
            SELECT id FROM (
                SELECT id FROM bills
                WHERE store_id = ? AND title = ? AND repeat_type = ?
                  AND (repeat_parent_id IS NULL OR repeat_parent_id = 0)
                  AND id <> ?
            ) AS doomed
        )
    ")->execute([$keepId, $g['store_id'], $g['title'], $g['repeat_type'], $keepId]);

    // Delete duplicate templates (not the keeper)
    $stmt = $pdo->prepare("
        DELETE FROM bills
        WHERE store_id = ? AND title = ? AND repeat_type = ?
          AND (repeat_parent_id IS NULL OR repeat_parent_id = 0)
          AND id <> ?
    ");
    $stmt->execute([$g['store_id'], $g['title'], $g['repeat_type'], $keepId]);
    $templatesDeleted += $stmt->rowCount();
}
echo "  Deleted $templatesDeleted duplicate templates.\n\n";

// Step 2: Deduplicate children per (repeat_parent_id, due_date) — keep oldest/paid
echo "Step 2: Deduplicating child instances...\n";
$childGroups = $pdo->query("
    SELECT repeat_parent_id, due_date,
           MIN(CASE WHEN status='paid' THEN id ELSE NULL END) AS paid_id,
           MIN(id) AS oldest_id,
           COUNT(*) AS cnt
    FROM bills
    WHERE repeat_parent_id IS NOT NULL AND repeat_parent_id > 0
    GROUP BY repeat_parent_id, due_date
    HAVING COUNT(*) > 1
")->fetchAll(PDO::FETCH_ASSOC);

$childrenDeleted = 0;
foreach ($childGroups as $cg) {
    $keepId = $cg['paid_id'] ?? $cg['oldest_id'];
    $stmt = $pdo->prepare("
        DELETE FROM bills
        WHERE repeat_parent_id = ? AND due_date = ? AND id <> ?
    ");
    $stmt->execute([$cg['repeat_parent_id'], $cg['due_date'], $keepId]);
    $childrenDeleted += $stmt->rowCount();
}
echo "  Deleted $childrenDeleted duplicate child bills.\n\n";

// Step 3: Delete orphaned children (parent no longer exists)
// Use PHP loop to avoid MySQL "You can't specify target table for update in FROM clause"
echo "Step 3: Cleaning orphaned children...\n";
$orphanedChildren = $pdo->query("
    SELECT id FROM bills
    WHERE repeat_parent_id IS NOT NULL AND repeat_parent_id > 0
      AND repeat_parent_id NOT IN (SELECT id FROM (SELECT id FROM bills WHERE repeat_parent_id IS NULL OR repeat_parent_id = 0) AS parents)
")->fetchAll(PDO::FETCH_COLUMN);
$orphanDelStmt = $pdo->prepare("DELETE FROM bills WHERE id = ?");
$orphanCount = 0;
foreach ($orphanedChildren as $orphanId) {
    $orphanDelStmt->execute([$orphanId]);
    $orphanCount++;
}
echo "  Deleted $orphanCount orphaned children.\n\n";

// Step 4: Deduplicate one-time bills (store_id, title, due_date)
echo "Step 4: Deduplicating one-time bills...\n";
$onetimeGroups = $pdo->query("
    SELECT store_id, title, due_date,
           MIN(CASE WHEN status='paid' THEN id ELSE NULL END) AS paid_id,
           MIN(id) AS oldest_id,
           COUNT(*) AS cnt
    FROM bills
    WHERE (repeat_type = 'none' OR repeat_type IS NULL)
      AND (repeat_parent_id IS NULL OR repeat_parent_id = 0)
      AND due_date IS NOT NULL
    GROUP BY store_id, title, due_date
    HAVING COUNT(*) > 1
")->fetchAll(PDO::FETCH_ASSOC);

$onetimeDeleted = 0;
foreach ($onetimeGroups as $og) {
    $keepId = $og['paid_id'] ?? $og['oldest_id'];
    $stmt = $pdo->prepare("
        DELETE FROM bills
        WHERE store_id = ? AND title = ? AND due_date = ?
          AND (repeat_type = 'none' OR repeat_type IS NULL)
          AND (repeat_parent_id IS NULL OR repeat_parent_id = 0)
          AND id <> ?
    ");
    $stmt->execute([$og['store_id'], $og['title'], $og['due_date'], $keepId]);
    $onetimeDeleted += $stmt->rowCount();
}
echo "  Deleted $onetimeDeleted duplicate one-time bills.\n\n";

// Step 5: Cross-template child deduplication — same (store_id, title, due_date),
// different repeat_parent_id (two templates generated two children for same month)
echo "Step 5: Cross-template child dedup by (store_id, title, due_date)...\n";
$crossGroups = $pdo->query("
    SELECT store_id, title, due_date,
           MIN(CASE WHEN status='paid' THEN id ELSE NULL END) AS paid_id,
           MIN(id) AS oldest_id,
           COUNT(*) AS cnt
    FROM bills
    WHERE due_date IS NOT NULL
    GROUP BY store_id, title, due_date
    HAVING COUNT(*) > 1
")->fetchAll(PDO::FETCH_ASSOC);

$crossDeleted = 0;
foreach ($crossGroups as $cg) {
    $keepId = $cg['paid_id'] ?? $cg['oldest_id'];
    echo "  Dup: store={$cg['store_id']} title=\"{$cg['title']}\" due={$cg['due_date']} count={$cg['cnt']} keep=$keepId\n";
    $stmt = $pdo->prepare("
        DELETE FROM bills
        WHERE store_id = ? AND title = ? AND due_date = ? AND id <> ?
    ");
    $stmt->execute([$cg['store_id'], $cg['title'], $cg['due_date'], $keepId]);
    $crossDeleted += $stmt->rowCount();
}
echo "  Deleted $crossDeleted cross-template duplicates.\n\n";

$after = $pdo->query("SELECT COUNT(*) FROM bills")->fetchColumn();
$total = $templatesDeleted + $childrenDeleted + $orphans + $onetimeDeleted + $crossDeleted;
echo "=== DONE ===\n";
echo "Bills before: $before\n";
echo "Bills after:  $after\n";
echo "Total deleted: $total\n";
