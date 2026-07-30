<?php
/**
 * ONE-TIME migration runner for task approval workflow columns.
 * MySQL 5.x compatible — uses SHOW COLUMNS checks instead of IF NOT EXISTS.
 * DELETE THIS FILE after successful execution.
 *
 * Access: https://dashboard.bakudanramen.com/run_approval_migration.php
 * Auth:   Requires CEO/Admin session OR ?key=<MIGRATION_KEY> header.
 */

define('MIGRATION_KEY', getenv('MIGRATION_RUN_KEY') ?: 'bkd_mig_approval_2026');

session_start();
require_once __DIR__ . '/config/database.php';

// Auth: must be logged-in CEO/Admin OR provide the key
$authed = false;
if (isset($_SESSION['user_id'])) {
    $db  = Database::getInstance();
    $usr = $db->fetch("SELECT role FROM users WHERE id = ?", [$_SESSION['user_id']]);
    $authed = in_array($usr['role'] ?? '', ['ceo', 'admin']);
}
if (!$authed && ($_GET['key'] ?? '') === MIGRATION_KEY) {
    $authed = true;
}
if (!$authed) {
    http_response_code(403);
    die('<h2>403 Forbidden</h2><p>Login as CEO/Admin or provide ?key=</p>');
}

$db = Database::getInstance();
$pdo = $db->getConnection();
$results = [];

function colExists(PDO $pdo, string $table, string $col): bool {
    $stmt = $pdo->prepare(
        "SELECT 1 FROM information_schema.columns
         WHERE table_schema = DATABASE()
           AND table_name = ?
           AND column_name = ?
         LIMIT 1"
    );
    $stmt->execute([$table, $col]);
    return (bool)$stmt->fetch();
}

function idxExists(PDO $pdo, string $table, string $idx): bool {
    $stmt = $pdo->prepare(
        "SELECT 1 FROM information_schema.statistics
         WHERE table_schema = DATABASE()
           AND table_name = ?
           AND index_name = ?
         LIMIT 1"
    );
    $stmt->execute([$table, $idx]);
    return (bool)$stmt->fetch();
}

function run(PDO $pdo, string $label, string $sql, bool $checkFirst = false): array {
    try {
        if ($checkFirst) {
            // Don't execute — this is a no-op placeholder
            return ['label' => $label, 'status' => 'SKIPPED_CHECK', 'sql' => trim($sql)];
        }
        $pdo->exec($sql);
        return ['label' => $label, 'status' => 'OK', 'sql' => trim($sql)];
    } catch (PDOException $e) {
        $msg = $e->getMessage();
        if (strpos($msg, 'Duplicate column') !== false
            || strpos($msg, 'already exists') !== false
            || strpos($msg, 'Duplicate key name') !== false) {
            return ['label' => $label, 'status' => 'ALREADY_EXISTS', 'sql' => trim($sql)];
        }
        return ['label' => $label, 'status' => 'ERROR: ' . $msg, 'sql' => trim($sql)];
    }
}

// ── 1. ADD MISSING COLUMNS TO tasks ──────────────────────────────────────────
$cols = [
    ['approval_required', "ALTER TABLE `tasks` ADD COLUMN `approval_required` TINYINT(1) NOT NULL DEFAULT 0 AFTER `priority`"],
    ['reviewer_id',       "ALTER TABLE `tasks` ADD COLUMN `reviewer_id` INT UNSIGNED NULL DEFAULT NULL AFTER `assignee_id`"],
    ['approver_id',      "ALTER TABLE `tasks` ADD COLUMN `approver_id` INT UNSIGNED NULL DEFAULT NULL AFTER `reviewer_id`"],
    ['final_done_at',     "ALTER TABLE `tasks` ADD COLUMN `final_done_at` DATETIME NULL DEFAULT NULL AFTER `completed_at`"],
    ['review_note',       "ALTER TABLE `tasks` ADD COLUMN `review_note` TEXT NULL DEFAULT NULL"],
    ['acceptance_note',   "ALTER TABLE `tasks` ADD COLUMN `acceptance_note` TEXT NULL DEFAULT NULL"],
];

foreach ($cols as [$colName, $sql]) {
    if (colExists($pdo, 'tasks', $colName)) {
        $results[] = ['label' => "tasks.{$colName}", 'status' => 'ALREADY_EXISTS', 'sql' => "(column exists)"];
    } else {
        $results[] = run($pdo, "tasks.{$colName}", $sql);
    }
}

// ── 2. EXTEND status ENUM ────────────────────────────────────────────────────
$colInfo = $pdo->query("SHOW COLUMNS FROM `tasks` WHERE Field = 'status'")->fetch(PDO::FETCH_ASSOC);
$currentType = $colInfo['Type'] ?? '';
$isEnum = stripos($currentType, 'enum') !== false;

if ($isEnum) {
    $needsNewValues = false;
    foreach (['pending_review','review_rejected','pending_acceptance','acceptance_rejected','accepted'] as $v) {
        if (strpos($currentType, "'$v'") === false) { $needsNewValues = true; break; }
    }
    if ($needsNewValues) {
        preg_match_all("/'([^']+)'/", $currentType, $m);
        $existingVals = $m[1] ?? [];
        $newVals = array_unique(array_merge($existingVals, [
            'pending_review','review_rejected','pending_acceptance','acceptance_rejected','accepted'
        ]));
        $enumDef = implode(',', array_map(fn($v) => "'$v'", $newVals));
        $sql = "ALTER TABLE `tasks` MODIFY COLUMN `status` ENUM({$enumDef}) NOT NULL DEFAULT 'todo'";
        $results[] = run($pdo, 'tasks.status ENUM extend', $sql);
    } else {
        $results[] = ['label' => 'tasks.status ENUM extend', 'status' => 'ALREADY_EXISTS', 'sql' => '(no change needed)'];
    }
} else {
    $results[] = ['label' => 'tasks.status type', 'status' => 'SKIPPED', 'sql' => "status is $currentType — no ENUM mod needed"];
}

// ── 3. ADD INDEXES ───────────────────────────────────────────────────────────
$indexes = [
    ['idx_tasks_reviewer', 'reviewer_id'],
    ['idx_tasks_approver', 'approver_id'],
    ['idx_tasks_approval_required', 'approval_required'],
];

foreach ($indexes as [$idxName, $colName]) {
    if (idxExists($pdo, 'tasks', $idxName)) {
        $results[] = ['label' => $idxName, 'status' => 'ALREADY_EXISTS', 'sql' => "(index exists)"];
    } else {
        $results[] = run($pdo, $idxName, "ALTER TABLE `tasks` ADD INDEX `{$idxName}` (`{$colName}`)");
    }
}

// ── 4. CREATE task_approval_events TABLE ─────────────────────────────────────
$tableExists = (bool)$pdo->query("SHOW TABLES LIKE 'task_approval_events'")->fetch();
if (!$tableExists) {
    // Determine the correct task_id type by inspecting tasks.id
    $idInfo = $pdo->query("SHOW COLUMNS FROM `tasks` LIKE 'id'")->fetch(PDO::FETCH_ASSOC);
    $idType = $idInfo['Type'] ?? 'INT';
    $idUnsigned = stripos($idType, 'unsigned') !== false ? 'UNSIGNED' : '';

    $results[] = run($pdo, 'CREATE task_approval_events', "
CREATE TABLE IF NOT EXISTS `task_approval_events` (
  `id`            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `task_id`      {$idType} {$idUnsigned} NOT NULL,
  `actor_user_id` INT UNSIGNED NOT NULL,
  `action_type`   VARCHAR(64) NOT NULL,
  `from_status`   VARCHAR(64) NULL,
  `to_status`     VARCHAR(64) NULL,
  `comment`       TEXT NULL,
  `evidence_url`  VARCHAR(512) NULL,
  `is_override`   TINYINT(1) NOT NULL DEFAULT 0,
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_tae_task` (`task_id`),
  INDEX `idx_tae_actor` (`actor_user_id`),
  INDEX `idx_tae_action` (`action_type`),
  INDEX `idx_tae_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");
} else {
    $results[] = ['label' => 'CREATE task_approval_events', 'status' => 'ALREADY_EXISTS', 'sql' => '(table exists)'];
}

// ── 5. VERIFY ────────────────────────────────────────────────────────────────
$verification = [
    'approval_required' => colExists($pdo, 'tasks', 'approval_required'),
    'reviewer_id'       => colExists($pdo, 'tasks', 'reviewer_id'),
    'approver_id'       => colExists($pdo, 'tasks', 'approver_id'),
    'final_done_at'     => colExists($pdo, 'tasks', 'final_done_at'),
    'review_note'       => colExists($pdo, 'tasks', 'review_note'),
    'acceptance_note'   => colExists($pdo, 'tasks', 'acceptance_note'),
    'task_approval_events' => (bool)$pdo->query("SHOW TABLES LIKE 'task_approval_events'")->fetch(),
];

$taskCount = $pdo->query("SELECT COUNT(*) as c FROM tasks")->fetch(PDO::FETCH_ASSOC)['c'];
$userCount = $pdo->query("SELECT COUNT(*) as c FROM users")->fetch(PDO::FETCH_ASSOC)['c'];

// ── OUTPUT ──────────────────────────────────────────────────────────────────
?>
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Migration Runner</title>
<style>
body{font-family:system-ui,sans-serif;background:#09090b;color:#e4e4e7;padding:24px;max-width:900px;margin:0 auto}
h1{color:#f4f4f5;font-size:20px;margin-bottom:4px}
.sub{color:#71717a;font-size:13px;margin-bottom:24px}
table{width:100%;border-collapse:collapse;margin-bottom:24px;font-size:13px}
th{background:#18181b;padding:8px 12px;text-align:left;color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:.05em}
td{padding:8px 12px;border-top:1px solid #27272a}
.ok{color:#4ade80;font-weight:700}
.err{color:#f87171;font-weight:700}
.skip{color:#71717a}
.exists{color:#4ade80}
.missing{color:#f87171;font-weight:700}
.verify-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px;margin-bottom:24px}
.v-card{background:#18181b;border:1px solid #27272a;border-radius:8px;padding:12px 14px;font-size:13px}
.v-card strong{display:block;color:#a1a1aa;font-size:11px;text-transform:uppercase;margin-bottom:4px}
.warning{background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.3);color:#fbbf24;padding:14px;border-radius:8px;margin-bottom:20px;font-size:13px}
.success{background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.3);color:#4ade80;padding:14px;border-radius:8px;margin-bottom:20px;font-size:13px}
code{background:#1c1c1f;padding:2px 6px;border-radius:4px;font-size:11px;color:#a78bfa}
</style>
</head>
<body>
<h1>🔧 Approval Workflow Migration Runner</h1>
<div class="sub">Database: <code><?= htmlspecialchars(DB_NAME) ?></code> &nbsp;|&nbsp; <?= date('Y-m-d H:i:s') ?></div>

<?php
$hasErrors = false;
foreach ($results as $r) {
    if (strpos($r['status'] ?? '', 'ERROR') !== false) $hasErrors = true;
}
?>
<?php if ($hasErrors): ?>
<div class="warning">⚠️ One or more migrations encountered errors. Review the table below.</div>
<?php else: ?>
<div class="success">✅ All migrations completed successfully.</div>
<?php endif; ?>

<h3 style="font-size:14px;color:#a1a1aa;margin-bottom:8px">Migration Results</h3>
<table>
  <thead><tr><th>Step</th><th>Status</th></tr></thead>
  <tbody>
<?php foreach ($results as $r): ?>
  <tr>
    <td><code><?= htmlspecialchars($r['label']) ?></code></td>
    <td class="<?= strpos($r['status'],'OK')===0 ? 'ok' : (strpos($r['status'],'ALREADY')===0 ? 'exists' : (strpos($r['status'],'ERROR')===0 ? 'err' : 'skip')) ?>"><?= htmlspecialchars($r['status']) ?></td>
  </tr>
<?php endforeach; ?>
  </tbody>
</table>

<h3 style="font-size:14px;color:#a1a1aa;margin-bottom:8px">Schema Verification</h3>
<div class="verify-grid">
<?php foreach ($verification as $name => $exists): ?>
<div class="v-card">
  <strong><?= htmlspecialchars($name) ?></strong>
  <span class="<?= $exists ? 'exists' : 'missing' ?>"><?= $exists ? '✅ EXISTS' : '❌ MISSING' ?></span>
</div>
<?php endforeach; ?>
<div class="v-card"><strong>tasks count</strong><?= (int)$taskCount ?> rows</div>
<div class="v-card"><strong>users count</strong><?= (int)$userCount ?> rows</div>
</div>

<div class="warning" style="background:rgba(248,113,113,.08);border-color:rgba(248,113,113,.2);color:#fca5a5">
  ⚠️ <strong>Security:</strong> Delete this file from the server after verifying the migration ran successfully.<br>
  <code>rm ~/dashboard.bakudanramen.com/run_approval_migration.php</code>
</div>
</body></html>
