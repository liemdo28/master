<?php
/**
 * DailyDuplicateTaskBillScanner
 * Schedule: daily at 02:00
 *
 * Scans all non-archived, non-paid bills and all incomplete tasks,
 * computes hashes, detects collisions, and writes to duplicate_groups.
 *
 * Usage: php crons/DailyDuplicateTaskBillScanner.php
 */

define('APP_ROOT', dirname(__DIR__));
require_once APP_ROOT . '/config/database.php';

// Bootstrap minimum models
if (!class_exists('DuplicateDetector')) {
    require_once APP_ROOT . '/models/DuplicateDetector.php';
}

$db = Database::getInstance();
$log = [];
$now = date('Y-m-d H:i:s');

// ── Helpers ───────────────────────────────────────────────────────────────────

function scanner_log(string $msg): void {
    global $log;
    $log[] = date('[H:i:s]') . ' ' . $msg;
    error_log('[DuplicateScanner] ' . $msg);
}

function alreadyResolved($db, string $hash, string $entityType): bool {
    if (!$db->tableExists('duplicate_groups') || !$db->tableExists('duplicate_resolution_log')) return false;
    $group = $db->fetch(
        "SELECT dg.id FROM duplicate_groups dg
         WHERE dg.duplicate_hash = ? AND dg.entity_type = ?
         ORDER BY dg.detected_at DESC LIMIT 1",
        [$hash, $entityType]
    );
    if (!$group) return false;
    $entry = $db->fetch(
        "SELECT id FROM duplicate_resolution_log WHERE group_id = ? AND action IN ('ignored','merged','marked_not_duplicate') LIMIT 1",
        [$group['id']]
    );
    return (bool)$entry;
}

function ensureGroup($db, string $entityType, string $hash, int $canonicalId): int {
    $existing = $db->fetch(
        "SELECT id FROM duplicate_groups WHERE entity_type = ? AND duplicate_hash = ? AND status = 'pending' LIMIT 1",
        [$entityType, $hash]
    );
    if ($existing) return (int)$existing['id'];

    return $db->insert(
        "INSERT INTO duplicate_groups (entity_type, duplicate_hash, canonical_id, status, detected_at) VALUES (?, ?, ?, 'pending', NOW())",
        [$entityType, $hash, $canonicalId]
    );
}

function ensureGroupItem($db, int $groupId, int $entityId, bool $isCanonical): void {
    $existing = $db->fetch(
        "SELECT id FROM duplicate_group_items WHERE group_id = ? AND entity_id = ? LIMIT 1",
        [$groupId, $entityId]
    );
    if ($existing) return;
    $db->execute(
        "INSERT INTO duplicate_group_items (group_id, entity_id, is_canonical) VALUES (?, ?, ?)",
        [$groupId, $entityId, $isCanonical ? 1 : 0]
    );
}

// ── Scan Bills ────────────────────────────────────────────────────────────────
$billGroupsCreated = 0;
if ($db->tableExists('bills') && $db->tableExists('duplicate_groups')) {
    $hasArchived = $db->columnExists('bills', 'is_archived');
    $archiveClause = $hasArchived ? "AND (b.is_archived = 0 OR b.is_archived IS NULL)" : "";

    $bills = $db->fetchAll(
        "SELECT b.*, COALESCE(v.name, b.vendor) AS vendor_label
         FROM bills b
         LEFT JOIN vendors v ON v.id = b.vendor_id
         WHERE b.status NOT IN ('paid','cancelled','completed')
         {$archiveClause}
         ORDER BY b.id ASC"
    );

    scanner_log("Scanning " . count($bills) . " active bills...");

    $hashMap = []; // hash => [bill_ids]
    foreach ($bills as $bill) {
        $hash = DuplicateDetector::billHash(
            (string)($bill['title'] ?? ''),
            (int)($bill['store_id'] ?? 0),
            substr($bill['due_date'] ?? '', 0, 10),
            (float)($bill['amount'] ?? 0),
            (string)($bill['vendor_label'] ?? ''),
            (string)($bill['category'] ?? '')
        );

        // Persist hash
        if ($db->columnExists('bills', 'duplicate_hash') && empty($bill['duplicate_hash'])) {
            $db->execute("UPDATE bills SET duplicate_hash = ? WHERE id = ?", [$hash, $bill['id']]);
        }

        $hashMap[$hash][] = $bill['id'];
    }

    foreach ($hashMap as $hash => $ids) {
        if (count($ids) < 2) continue;
        if (alreadyResolved($db, $hash, 'bill')) continue;

        $canonicalId = min($ids);
        $groupId = ensureGroup($db, 'bill', $hash, $canonicalId);
        foreach ($ids as $eid) {
            ensureGroupItem($db, $groupId, $eid, $eid === $canonicalId);
        }
        $billGroupsCreated++;
    }

    scanner_log("Bill scan complete. {$billGroupsCreated} duplicate group(s) created/updated.");
}

// ── Scan Tasks ────────────────────────────────────────────────────────────────
$taskGroupsCreated = 0;
if ($db->tableExists('tasks') && $db->tableExists('duplicate_groups')) {
    $hasArchived = $db->columnExists('tasks', 'archived_duplicate');
    $archiveClause = $hasArchived ? "AND (t.archived_duplicate = 0 OR t.archived_duplicate IS NULL)" : "";

    $tasks = $db->fetchAll(
        "SELECT t.*, p.store_id
         FROM tasks t
         LEFT JOIN projects p ON p.id = t.project_id
         WHERE t.is_completed = 0
         {$archiveClause}
         ORDER BY t.id ASC"
    );

    scanner_log("Scanning " . count($tasks) . " active tasks...");

    $hashMap = [];
    foreach ($tasks as $task) {
        $hash = DuplicateDetector::taskHash(
            (string)($task['title'] ?? ''),
            (int)($task['store_id'] ?? 0),
            substr($task['due_date'] ?? '', 0, 10),
            (int)($task['assignee_id'] ?? 0),
            (string)($task['category'] ?? '')
        );

        if ($db->columnExists('tasks', 'duplicate_hash') && empty($task['duplicate_hash'])) {
            $db->execute("UPDATE tasks SET duplicate_hash = ? WHERE id = ?", [$hash, $task['id']]);
        }

        $hashMap[$hash][] = $task['id'];
    }

    foreach ($hashMap as $hash => $ids) {
        if (count($ids) < 2) continue;
        if (alreadyResolved($db, $hash, 'task')) continue;

        $canonicalId = min($ids);
        $groupId = ensureGroup($db, 'task', $hash, $canonicalId);
        foreach ($ids as $eid) {
            ensureGroupItem($db, $groupId, $eid, $eid === $canonicalId);
        }
        $taskGroupsCreated++;
    }

    scanner_log("Task scan complete. {$taskGroupsCreated} duplicate group(s) created/updated.");
}

// ── Summary ───────────────────────────────────────────────────────────────────
scanner_log("DONE. Bills: {$billGroupsCreated} groups | Tasks: {$taskGroupsCreated} groups");
echo implode("\n", $log) . "\n";
