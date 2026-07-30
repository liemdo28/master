<?php
/**
 * One-time CLI script: delete 10 test tasks created during QA session 2026-05-28.
 * Safe to run multiple times (idempotent — skips if not found).
 * Usage: php scripts/cli_delete_test_tasks.php
 */
chdir(dirname(__DIR__));
require_once __DIR__ . '/../config/database.php';

$pdo = Database::getInstance()->getConnection();

$testTaskIds = [19720, 19721, 19722, 19723, 19724, 19725, 19726, 19727, 19728];

echo "=== Delete Test Tasks ===\n";

$deleted = 0;
foreach ($testTaskIds as $id) {
    // Verify it's actually a test task before deleting
    $task = $pdo->prepare("SELECT id, title, project_id FROM tasks WHERE id = ?");
    $task->execute([$id]);
    $row = $task->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        echo "  SKIP id=$id (not found)\n";
        continue;
    }

    // Only delete if title contains test markers
    $isTest = str_contains($row['title'], '2026-05-28')
           || str_contains($row['title'], 'QA ')
           || str_contains($row['title'], 'walkthrough')
           || str_contains($row['title'], 'ops check');

    if (!$isTest) {
        echo "  SKIP id=$id title=\"{$row['title']}\" — not a test task\n";
        continue;
    }

    // Delete attachments first
    $pdo->prepare("DELETE FROM attachments WHERE task_id = ?")->execute([$id]);
    // Delete comments
    $pdo->prepare("DELETE FROM task_comments WHERE task_id = ?")->execute([$id]);
    // Delete the task
    $stmt = $pdo->prepare("DELETE FROM tasks WHERE id = ?");
    $stmt->execute([$id]);
    echo "  DELETED id=$id title=\"{$row['title']}\"\n";
    $deleted++;
}

echo "\nDone. Deleted $deleted test tasks.\n";
