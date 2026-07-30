<?php
/**
 * P0 EMERGENCY — Create missing reviewer/approval tables.
 * All CREATE TABLE statements use IF NOT EXISTS — safe to run multiple times.
 * DELETE THIS FILE after successful execution.
 *
 * Access: https://dashboard.bakudanramen.com/run_p0_reviewer_tables.php
 * Auth:   CEO/Admin session OR ?key=bkd_p0_reviewer_2026
 */

define('MIGRATION_KEY', 'bkd_p0_reviewer_2026');

session_start();
require_once __DIR__ . '/config/database.php';

$authed = false;
if (isset($_SESSION['user_id'])) {
    $db  = Database::getInstance();
    $usr = $db->fetch("SELECT role FROM users WHERE id = ?", [$_SESSION['user_id']]);
    $authed = in_array($usr['role'] ?? '', ['ceo', 'admin']);
}
if (!$authed && ($_GET['key'] ?? '') === MIGRATION_KEY) $authed = true;
if (!$authed) { http_response_code(403); die('<h2>403 Forbidden</h2>'); }

$db  = Database::getInstance();
$pdo = $db->getConnection();

function tblExists(PDO $pdo, string $tbl): bool {
    $s = $pdo->prepare("SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=? LIMIT 1");
    $s->execute([$tbl]);
    return (bool)$s->fetch();
}

function run(PDO $pdo, string $label, string $sql): string {
    try {
        $pdo->exec($sql);
        return "<tr style='color:#4ade80'><td>✅</td><td>$label</td><td>OK</td></tr>";
    } catch (PDOException $e) {
        return "<tr style='color:#f87171'><td>❌</td><td>$label</td><td>" . htmlspecialchars($e->getMessage()) . "</td></tr>";
    }
}

$rows = '';

// ── 1. task_comments ──────────────────────────────────────────
$rows .= run($pdo, 'task_comments', "
CREATE TABLE IF NOT EXISTS `task_comments` (
  `id`           BIGINT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  `task_id`      INT              NOT NULL,
  `user_id`      INT              NOT NULL,
  `content`      TEXT             NOT NULL,
  `comment_type` ENUM('comment','reviewer_note','approval_note','system') NOT NULL DEFAULT 'comment',
  `parent_id`    BIGINT UNSIGNED  NULL DEFAULT NULL,
  `is_deleted`   TINYINT(1)       NOT NULL DEFAULT 0,
  `created_at`   DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_tc_task`    (`task_id`),
  INDEX `idx_tc_user`    (`user_id`),
  INDEX `idx_tc_created` (`created_at`),
  FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");

// ── 2. task_mentions ──────────────────────────────────────────
$rows .= run($pdo, 'task_mentions', "
CREATE TABLE IF NOT EXISTS `task_mentions` (
  `id`                BIGINT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  `task_id`           INT              NOT NULL,
  `comment_id`        BIGINT UNSIGNED  NOT NULL,
  `mentioned_user_id` INT              NOT NULL,
  `mentioned_by`      INT              NOT NULL,
  `mention_context`   VARCHAR(64)      NOT NULL DEFAULT 'comment',
  `created_at`        DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_mention` (`comment_id`, `mentioned_user_id`, `mention_context`),
  INDEX `idx_tm_task` (`task_id`),
  INDEX `idx_tm_user` (`mentioned_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");

// ── 3. task_notifications ─────────────────────────────────────
$rows .= run($pdo, 'task_notifications', "
CREATE TABLE IF NOT EXISTS `task_notifications` (
  `id`                BIGINT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  `user_id`           INT              NOT NULL,
  `task_id`           INT              NULL DEFAULT NULL,
  `notification_type` VARCHAR(64)      NOT NULL DEFAULT 'mention',
  `title`             VARCHAR(255)     NOT NULL,
  `message`           TEXT             NULL,
  `from_user_id`      INT              NULL DEFAULT NULL,
  `is_read`           TINYINT(1)       NOT NULL DEFAULT 0,
  `metadata`          JSON             NULL DEFAULT NULL,
  `inbox_category`    ENUM('task','review','approval','mention','system') NOT NULL DEFAULT 'task',
  `created_at`        DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_tn_user`    (`user_id`),
  INDEX `idx_tn_task`    (`task_id`),
  INDEX `idx_tn_read`    (`user_id`, `is_read`),
  INDEX `idx_tn_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");

// ── 4. task_reviewer_notes ────────────────────────────────────
$rows .= run($pdo, 'task_reviewer_notes', "
CREATE TABLE IF NOT EXISTS `task_reviewer_notes` (
  `id`               BIGINT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  `task_id`          INT              NOT NULL,
  `user_id`          INT              NOT NULL,
  `note_type`        ENUM('checklist','comment','request','info') NOT NULL DEFAULT 'comment',
  `title`            VARCHAR(255)     NULL DEFAULT NULL,
  `content`          TEXT             NULL DEFAULT NULL,
  `checklist_items`  JSON             NULL DEFAULT NULL,
  `is_completed`     TINYINT(1)       NOT NULL DEFAULT 0,
  `is_acknowledged`  TINYINT(1)       NOT NULL DEFAULT 0,
  `created_at`       DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_trn_task`  (`task_id`),
  INDEX `idx_trn_user`  (`user_id`),
  FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");

// ── 5. task_approval_notes  ← PRIMARY BLOCKER ─────────────────
$rows .= run($pdo, 'task_approval_notes (PRIMARY BLOCKER)', "
CREATE TABLE IF NOT EXISTS `task_approval_notes` (
  `id`         BIGINT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  `task_id`    INT              NOT NULL,
  `user_id`    INT              NOT NULL,
  `action`     ENUM('approved','rejected','requested_changes','info_requested') NOT NULL,
  `content`    TEXT             NOT NULL,
  `is_final`   TINYINT(1)       NOT NULL DEFAULT 0,
  `created_at` DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_tan_task`    (`task_id`),
  INDEX `idx_tan_user`    (`user_id`),
  INDEX `idx_tan_action`  (`action`),
  INDEX `idx_tan_created` (`created_at`),
  FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");

// ── 6. inbox_category column (ALTER — idempotent) ─────────────
$rows .= run($pdo, 'task_notifications.inbox_category column', "
ALTER TABLE `task_notifications`
  ADD COLUMN IF NOT EXISTS `inbox_category`
    ENUM('task','review','approval','mention','system') NOT NULL DEFAULT 'task'
");

// ── Verify ────────────────────────────────────────────────────
$tables = ['task_comments','task_mentions','task_notifications','task_reviewer_notes','task_approval_notes'];
$vrows = '';
foreach ($tables as $t) {
    $exists = tblExists($pdo, $t);
    $vrows .= "<tr><td>" . ($exists ? '✅' : '❌') . "</td><td>$t</td><td>" . ($exists ? 'EXISTS' : 'MISSING') : '') . "</td></tr>";
}

// Re-do vrows cleanly
$vrows = '';
foreach ($tables as $t) {
    $exists = tblExists($pdo, $t);
    $col = $exists ? '#4ade80' : '#f87171';
    $vrows .= "<tr style='color:$col'><td>" . ($exists?'✅':'❌') . "</td><td>$t</td><td>" . ($exists?'EXISTS':'MISSING') . "</td></tr>";
}

echo "<!DOCTYPE html><html><head><meta charset='utf-8'><title>P0 Migration</title>
<style>body{font-family:monospace;background:#0f172a;color:#e2e8f0;padding:2rem}
table{border-collapse:collapse;width:100%;margin:1rem 0}
td{padding:6px 12px;border:1px solid #334155}
h2{color:#60a5fa}h3{color:#94a3b8}</style></head><body>
<h2>P0 Emergency Migration — Reviewer / Approval Tables</h2>
<h3>Execution Results</h3>
<table><tr><th></th><th>Table</th><th>Result</th></tr>$rows</table>
<h3>Verification</h3>
<table><tr><th></th><th>Table</th><th>Status</th></tr>$vrows</table>
<p style='color:#94a3b8;margin-top:2rem'>✅ Migration complete. <strong>Delete this file from server after verifying task detail pages.</strong></p>
</body></html>";
