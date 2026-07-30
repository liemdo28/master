<?php
/**
 * CEO URGENT FIX — Approval Workflow Schema Sync
 * Checks if approval_required column exists in tasks table.
 * If not, runs non-destructive ALTER TABLE.
 * Also ensures task_approval_events table exists.
 * 
 * Run via: php fix_approval_schema.php
 */

// Load DB config
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/config/email.php';

echo "=== Production Schema Diagnostic ===\n";
echo "DB Host: " . DB_HOST . "\n";
echo "DB Name: " . DB_NAME . "\n";
echo "DB User: " . DB_USER . "\n\n";

$dsn = "mysql:host=" . DB_HOST . ";port=" . (defined('DB_PORT') ? DB_PORT : 3306) . ";dbname=" . DB_NAME . ";charset=utf8mb4";
try {
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    echo "✓ Connected to production database.\n\n";
} catch (PDOException $e) {
    echo "✗ Connection failed: " . $e->getMessage() . "\n";
    exit(1);
}

// 1. Check if approval_required column exists
echo "--- Checking tasks table for approval_required column ---\n";
$cols = $pdo->query("SHOW COLUMNS FROM tasks LIKE 'approval_required'")->fetchAll();
$hasApprovalCol = !empty($cols);

if ($hasApprovalCol) {
    echo "✓ approval_required column EXISTS in tasks table.\n";
} else {
    echo "✗ approval_required column MISSING from tasks table.\n";
    echo "  Running non-destructive ALTER TABLE...\n";
    
    // Check reviewer_id and approver_id too
    $hasReviewerId = !empty($pdo->query("SHOW COLUMNS FROM tasks LIKE 'reviewer_id'")->fetchAll());
    $hasApproverId = !empty($pdo->query("SHOW COLUMNS FROM tasks LIKE 'approver_id'")->fetchAll());
    
    $alterStatements = [];
    
    if (!$hasApprovalCol) {
        $alterStatements[] = "ADD COLUMN `approval_required` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Enable 3-stage approval chain'";
    }
    if (!$hasReviewerId) {
        $alterStatements[] = "ADD COLUMN `reviewer_id` INT UNSIGNED NULL DEFAULT NULL COMMENT 'User who reviews submission (stage 2)'";
    }
    if (!$hasApproverId) {
        $alterStatements[] = "ADD COLUMN `approver_id` INT UNSIGNED NULL DEFAULT NULL COMMENT 'User who gives final acceptance (stage 3)'";
    }
    
    if (!empty($alterStatements)) {
        $sql = "ALTER TABLE `tasks` " . implode(", ", $alterStatements);
        try {
            $pdo->exec($sql);
            echo "✓ ALTER TABLE succeeded:\n";
            echo "  SQL: $sql\n";
        } catch (PDOException $e) {
            echo "✗ ALTER TABLE failed: " . $e->getMessage() . "\n";
        }
    }
}

// 2. Check task_approval_events table
echo "\n--- Checking task_approval_events table ---\n";
$stmt = $pdo->query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '" . DB_NAME . "' AND table_name = 'task_approval_events'");
$taeExists = (bool)$stmt->fetchColumn();

if ($taeExists) {
    echo "✓ task_approval_events table EXISTS.\n";
} else {
    echo "✗ task_approval_events table MISSING.\n";
    echo "  Creating...\n";
    $createSql = "CREATE TABLE IF NOT EXISTS `task_approval_events` (
  `id`            BIGINT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  `task_id`       INT UNSIGNED     NOT NULL,
  `actor_user_id` INT UNSIGNED     NOT NULL,
  `action_type`   ENUM('started','submitted','review_approved','review_rejected','acceptance_approved','acceptance_rejected','marked_done','reopened','override') NOT NULL,
  `from_status`   VARCHAR(64)      NULL,
  `to_status`     VARCHAR(64)      NULL,
  `comment`       TEXT             NULL,
  `evidence_url`  VARCHAR(512)     NULL,
  `is_override`   TINYINT(1)       NOT NULL DEFAULT 0,
  `created_at`    DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_tae_task` (`task_id`),
  INDEX `idx_tae_actor` (`actor_user_id`),
  INDEX `idx_tae_action` (`action_type`),
  INDEX `idx_tae_created` (`created_at`),
  FOREIGN KEY (`task_id`)       REFERENCES `tasks`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    try {
        $pdo->exec($createSql);
        echo "✓ task_approval_events created successfully.\n";
    } catch (PDOException $e) {
        echo "✗ task_approval_events creation failed: " . $e->getMessage() . "\n";
    }
}

// 3. Also check if new reviewer workspace tables exist
echo "\n--- Checking reviewer workspace tables ---\n";
$rwTables = ['task_comments', 'task_mentions', 'task_notifications', 'task_reviewer_notes', 'task_approval_notes'];
foreach ($rwTables as $tbl) {
    $stmt = $pdo->query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '" . DB_NAME . "' AND table_name = '$tbl'");
    $exists = (bool)$stmt->fetchColumn();
    echo ($exists ? "✓" : "✗") . " $tbl " . ($exists ? "EXISTS" : "MISSING") . "\n";
}

// 4. Final verification — read task 19737
echo "\n--- Final check: Attempting to SELECT task 19737 ---\n";
try {
    $taskStmt = $pdo->prepare("SELECT id, title, approval_required, reviewer_id, approver_id FROM tasks WHERE id = 19737");
    $taskStmt->execute();
    $task = $taskStmt->fetch();
    if ($task) {
        echo "✓ Successfully read task 19737:\n";
        echo "  ID: " . $task['id'] . "\n";
        echo "  Title: " . $task['title'] . "\n";
        echo "  approval_required: " . ($task['approval_required'] ?? 'NULL') . "\n";
        echo "  reviewer_id: " . ($task['reviewer_id'] ?? 'NULL') . "\n";
        echo "  approver_id: " . ($task['approver_id'] ?? 'NULL') . "\n";
    } else {
        echo "⚠ Task 19737 not found (may be deleted).\n";
    }
} catch (PDOException $e) {
    echo "✗ SELECT failed: " . $e->getMessage() . "\n";
}

echo "\n=== Diagnostic Complete ===\n";
echo "If all columns show ✓, try saving task 19737 again.\n";
