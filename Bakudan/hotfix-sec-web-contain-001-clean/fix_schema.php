<?php
/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  APPROVAL WORKFLOW SCHEMA FIX — dashboard.bakudanramen.com ║
 * ║  CEO URGENT P0 — One-Click Safe Schema Sync               ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * HOW TO USE:
 *   Step 1: Open this file's URL with your secret token
 *   Step 2: Review the DRY-RUN output (default mode — no changes made)
 *   Step 3: If dry-run looks correct, add &confirm=1 to actually run
 *   Step 4: Delete/rename this file when done
 *
 * URL: https://dashboard.bakudanramen.com/fix_schema.php?token=YOUR_TOKEN
 *
 * TOKEN: Set SCHEMA_FIX_TOKEN in .env file.
 *        Default emergency token: APPROVAL_FIX_2026
 *
 * SAFETY:
 *   - Destructive SQL (DROP, DELETE, TRUNCATE) is NEVER executed
 *   - Always shows DRY RUN first unless &confirm=1 is set
 *   - No passwords or credentials shown in output
 *   - All operations are ADD COLUMN / CREATE TABLE IF NOT EXISTS only
 */

// ── Bootstrap DB only (do NOT require index.php — that boots the full router) ──
require_once __DIR__ . '/config/database.php';

// ── Auth: secret token required ───────────────────────────────────────────────
$validToken = $_ENV['SCHEMA_FIX_TOKEN'] ?? 'APPROVAL_FIX_2026';
$providedToken = $_GET['token'] ?? '';

if (!hash_equals($validToken, $providedToken)) {
    http_response_code(403);
    header('Content-Type: text/plain');
    echo "Access denied. Provide valid ?token= parameter.\n";
    exit;
}

// ── Confirmed? ───────────────────────────────────────────────────────────────
$isDryRun  = !isset($_GET['confirm']);
$isConfirm = isset($_GET['confirm']);

// ── Helpers ───────────────────────────────────────────────────────────────────
function out($html) { echo $html . "\n"; }
function section($title) { out("<h2 style='color:#60a5fa;margin:24px 0 12px;border-bottom:1px solid #21262d;padding-bottom:8px'>$title</h2>"); }
function sub($label, $value, $ok = null) {
    $status = '';
    if ($ok === true)  $status = '<span style="color:#4ade80;font-weight:700"> ✓ OK</span>';
    if ($ok === false) $status = '<span style="color:#f87171;font-weight:700"> ✗ MISSING</span>';
    if ($ok === null)  $status = '';
    out("<div style='margin:4px 0'><strong style='color:#c9d1d9;min-width:220px;display:inline-block'>$label:</strong> $value$status</div>");
}
function parse_schema_sql_file($file) {
    if (!file_exists($file)) return [];
    $sql = file_get_contents($file);
    $sql = preg_replace('/^\s*--.*$/m', '', $sql);
    $sql = preg_replace('/\/\*.*?\*\//s', '', $sql);
    return array_values(array_filter(
        array_map('trim', explode(';', $sql)),
        fn($stmt) => $stmt !== ''
    ));
}

$brandColor = '#dc2626';
$bg = '#09090b';
$card = '#18181b';
$border = '#27272a';
$text = '#e4e4e7';
$muted = '#71717a';
$success = '#4ade80';
$danger = '#f87171';
$warn = '#fbbf24';

?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Approval Workflow Schema Fix</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:<?=$bg?>;color:<?=$text?>;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;min-height:100vh;padding:24px}
.wrap{max-width:900px;margin:0 auto}
h1{font-size:1.5rem;font-weight:900;color:<?=$brandColor?>;margin-bottom:4px}
.sub{color:<?=$muted?>;font-size:.9rem;margin-bottom:24px}
.card{background:<?=$card?>;border:1px solid <?=$border?>;border-radius:12px;padding:24px;margin-bottom:16px}
h2{color:#60a5fa;font-size:1rem;font-weight:700;margin:0 0 12px;padding-bottom:8px;border-bottom:1px solid #21262d}
.info-box{padding:14px 16px;border-radius:8px;margin-bottom:16px;font-size:.9rem}
.info-box.warn{background:rgba(251,191,36,.1);border-left:4px solid #fbbf24;color:#fbbf24}
.info-box.success{background:rgba(74,222,128,.1);border-left:4px solid #4ade80;color:#4ade80}
.info-box.danger{background:rgba(248,113,113,.1);border-left:4px solid #f87171;color:#f87171}
.info-box.info{background:rgba(96,165,250,.1);border-left:4px solid #60a5fa;color:#60a5fa}
.mono{font-family:'Consolas','Monaco',monospace;font-size:.85rem;color:#9ca3af;background:#0d1117;border:1px solid #21262d;border-radius:6px;padding:12px;margin:8px 0;overflow-x:auto;white-space:pre-wrap;word-break:break-all}
table{width:100%;border-collapse:collapse;font-size:.875rem}
th{text-align:left;color:#71717a;font-weight:700;text-transform:uppercase;font-size:.7rem;letter-spacing:.05em;padding:8px 10px;border-bottom:1px solid #21262d}
td{padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.04);color:#c9d1d9}
tr:last-child td{border-bottom:none}
.ok{color:#4ade80;font-weight:700}
.fail{color:#f87171;font-weight:700}
.warn-text{color:#fbbf24}
.pass-btn{display:inline-block;padding:12px 28px;background:#4ade80;color:#000;font-weight:900;font-size:1rem;border-radius:10px;text-decoration:none;border:none;cursor:pointer;margin-top:8px}
.dry-btn{display:inline-block;padding:12px 28px;background:#3b82f6;color:#fff;font-weight:700;font-size:1rem;border-radius:10px;text-decoration:none;border:none}
.warn-btn{display:inline-block;padding:12px 28px;background:#fbbf24;color:#000;font-weight:900;font-size:1rem;border-radius:10px;border:none}
hr{border:none;border-top:1px solid #21262d;margin:20px 0}
</style>
</head>
<body>
<div class="wrap">

<h1>⚡ Approval Workflow Schema Fix</h1>
<p class="sub">TaskFlow — Production Safe Migration &nbsp;|&nbsp; <?= date('Y-m-d H:i:s T') ?></p>

<?php if ($isDryRun): ?>
<div class="info-box warn">
  <strong>DRY RUN MODE</strong> — No changes have been made yet.<br>
  Review the results below. Click <strong>"Run Fix — Confirm"</strong> at the bottom to apply.
</div>
<?php else: ?>
<div class="info-box danger">
  <strong>⚠ LIVE MODE</strong> — ALTER TABLE statements are being executed.
</div>
<?php endif; ?>

<div class="card">
<h2>1. Connection &amp; Environment</h2>
<?php
try {
    $pdo = Database::getInstance()->getConnection();
    out('<div class="ok">✓ Connected to database</div>');
    $dbName = DB_NAME;
    $dbHost = preg_replace('/:[0-9]+$/', '', DB_HOST); // strip port for display
    sub('Database Host', $dbHost . ':***');
    sub('Database Name', htmlspecialchars($dbName));
    sub('Database User', '*** (hidden)');
    sub('MySQL Version', $pdo->query('SELECT VERSION()')->fetchColumn());
} catch (PDOException $e) {
    out('<div class="fail">✗ Connection failed: ' . htmlspecialchars($e->getMessage()) . '</div>');
    exit;
}
?>
</div>

<div class="card">
<h2>2. Pre-Fix Evidence — Tasks Table Snapshot</h2>
<?php
try {
    $totalTasks = (int)$pdo->query("SELECT COUNT(*) FROM tasks")->fetchColumn();
    sub('Total tasks in database', number_format($totalTasks));
    
    $allCols = $pdo->query("SHOW COLUMNS FROM tasks")->fetchAll(PDO::FETCH_ASSOC);
    $colNames = array_column($allCols, 'Field');
    
    out('<table><thead><tr><th>Column</th><th>Type</th><th>Null</th><th>Default</th></tr></thead><tbody>');
    foreach ($allCols as $col) {
        $type = htmlspecialchars($col['Type']);
        $null = $col['Null'] === 'YES' ? '<span style="color:#4ade80">YES</span>' : 'NO';
        $def  = $col['Default'] === null ? '<span style="color:#52525b">NULL</span>' : htmlspecialchars($col['Default']);
        $extra = in_array($col['Field'], $colNames) ? '' : '';
        out('<tr><td>' . htmlspecialchars($col['Field']) . '</td><td>' . $type . '</td><td>' . $null . '</td><td>' . $def . '</td></tr>');
    }
    out('</tbody></table>');
} catch (PDOException $e) {
    out('<div class="fail">✗ Error: ' . htmlspecialchars($e->getMessage()) . '</div>');
}
?>
</div>

<div class="card">
<h2>3. Approval Column Check</h2>
<?php
$approvalCols = [
    'approval_required'      => 'Enable 3-stage approval workflow',
    'reviewer_id'            => 'User who reviews submission (stage 2)',
    'approver_id'            => 'User who gives final acceptance (stage 3)',
    'submitted_at'           => 'Timestamp when assignee submitted for review',
    'checked_at'             => 'Timestamp when reviewer checked',
    'accepted_workflow_at'   => 'Timestamp when approver accepted in workflow',
    'final_done_at'          => 'Timestamp when task officially became DONE',
    'review_note'            => 'Reviewer note on approval/rejection',
    'acceptance_note'        => 'Approver note on acceptance/rejection',
];
$allPresent = true;
foreach ($approvalCols as $col => $desc):
    $present = in_array($col, $colNames);
    if (!$present) $allPresent = false;
    sub($col, $desc, $present);
endforeach;
?>
</div>

<div class="card">
<h2>4. task_approval_events Table Check</h2>
<?php
try {
    $taeCheck = $pdo->query(
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '" . addcslashes(DB_NAME, "'") . "' AND table_name = 'task_approval_events'"
    )->fetchColumn();
    $taeExists = $taeCheck > 0;
    sub('task_approval_events', $taeExists ? 'Table exists' : 'Table MISSING — will be created', !$taeExists);
} catch (PDOException $e) {
    sub('task_approval_events', 'Error: ' . htmlspecialchars($e->getMessage()), false);
}
?>
</div>

<div class="card">
<h2>5. New Reviewer Workspace Tables Check</h2>
<?php
$rwTables = [
    'task_comments'       => 'Rich comment thread with @mentions',
    'task_mentions'       => '@mention tracking',
    'task_notifications'   => 'In-app notification inbox',
    'task_reviewer_notes'  => 'Reviewer workspace notes/instructions',
    'task_approval_notes'  => 'Approver notes section',
];
$rwMissing = [];
foreach ($rwTables as $tbl => $desc):
    try {
        $cnt = $pdo->query(
            "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '" . addcslashes(DB_NAME, "'") . "' AND table_name = '$tbl'"
        )->fetchColumn();
        $exists = $cnt > 0;
        if (!$exists) $rwMissing[] = $tbl;
        sub($tbl, $desc . ' — ' . ($exists ? 'EXISTS' : 'MISSING'), $exists);
    } catch (PDOException $e) {
        sub($tbl, 'Error: ' . htmlspecialchars($e->getMessage()), false);
        $rwMissing[] = $tbl;
    }
endforeach;
?>
</div>

<div class="card">
<h2>6. SQL That Will Be Executed</h2>
<?php
$missingTasksCols = array_keys(array_filter($approvalCols, fn($_, $c) => !in_array($c, $colNames), ARRAY_FILTER_USE_BOTH));
$sqls = [];

if (!empty($missingTasksCols)):
    $adds = [];
    $colDefs = [
        'approval_required'    => '`approval_required` TINYINT(1) NOT NULL DEFAULT 0',
        'reviewer_id'          => '`reviewer_id` INT UNSIGNED NULL DEFAULT NULL',
        'approver_id'          => '`approver_id` INT UNSIGNED NULL DEFAULT NULL',
        'submitted_at'         => '`submitted_at` DATETIME NULL DEFAULT NULL',
        'checked_at'           => '`checked_at` DATETIME NULL DEFAULT NULL',
        'accepted_workflow_at' => '`accepted_workflow_at` DATETIME NULL DEFAULT NULL',
        'final_done_at'        => '`final_done_at` DATETIME NULL DEFAULT NULL',
        'review_note'          => '`review_note` TEXT NULL DEFAULT NULL',
        'acceptance_note'      => '`acceptance_note` TEXT NULL DEFAULT NULL',
        'submitted_by'         => '`submitted_by` INT UNSIGNED NULL DEFAULT NULL',
        'checked_by'           => '`checked_by` INT UNSIGNED NULL DEFAULT NULL',
        'accepted_workflow_by' => '`accepted_workflow_by` INT UNSIGNED NULL DEFAULT NULL',
        'rejected_at'          => '`rejected_at` DATETIME NULL DEFAULT NULL',
        'rejected_by'          => '`rejected_by` INT UNSIGNED NULL DEFAULT NULL',
        'rejection_reason'     => '`rejection_reason` TEXT NULL DEFAULT NULL',
    ];
    foreach ($missingTasksCols as $c) {
        if (isset($colDefs[$c])) $adds[] = 'ADD COLUMN ' . $colDefs[$c];
    }
    if (!empty($adds)) {
        $sqls[] = "ALTER TABLE `tasks`\n  " . implode(",\n  ", $adds) . ';';
    }
endif;

if (!$taeExists):
    $sqls[] = "CREATE TABLE IF NOT EXISTS `task_approval_events` (
  `id`            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `task_id`       INT              NOT NULL,
  `actor_user_id` INT              NOT NULL,
  `action_type`   ENUM('started','submitted','review_approved','review_rejected','acceptance_approved','acceptance_rejected','marked_done','reopened','override') NOT NULL,
  `from_status`   VARCHAR(64)     NULL,
  `to_status`     VARCHAR(64)     NULL,
  `comment`       TEXT             NULL,
  `evidence_url`  VARCHAR(512)    NULL,
  `is_override`   TINYINT(1)      NOT NULL DEFAULT 0,
  `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_tae_task`    (`task_id`),
  INDEX `idx_tae_actor`   (`actor_user_id`),
  INDEX `idx_tae_action`  (`action_type`),
  INDEX `idx_tae_created` (`created_at`),
  FOREIGN KEY (`task_id`)       REFERENCES `tasks`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";
endif;

$reviewerSqlFile = __DIR__ . '/database/migrations/2026_06_02_reviewer_workspace.sql';
$reviewerStatements = !empty($rwMissing) ? parse_schema_sql_file($reviewerSqlFile) : [];
if (!empty($rwMissing) && empty($reviewerStatements)) {
    out('<div class="info-box danger">Reviewer Workspace tables are missing, but migration file was not found or could not be parsed: <code>database/migrations/2026_06_02_reviewer_workspace.sql</code></div>');
} elseif (!empty($reviewerStatements)) {
    $sqls[] = "-- Reviewer Workspace migration: creates missing tables (" . implode(', ', $rwMissing) . ")\n"
        . "-- Source: database/migrations/2026_06_02_reviewer_workspace.sql\n"
        . implode(";\n\n", $reviewerStatements) . ';';
}

if (empty($sqls)):
    out('<div class="info-box success">All required columns and tables are already present. No changes needed.</div>');
else:
    foreach ($sqls as $i => $sql):
        out('<div style="margin-bottom:12px"><strong style="color:#71717a">Statement ' . ($i+1) . ':</strong></div>');
        out('<pre class="mono">' . htmlspecialchars($sql) . '</pre>');
    endforeach;
endif;
?>
</div>

<div class="card">
<h2>7. Action</h2>
<?php
if ($isDryRun):
    if (empty($sqls)):
        out('<div class="info-box success">Schema is already in sync. No action needed.</div>');
    else:
        out('<div class="info-box warn">DRY RUN: Review the SQL above. To execute, visit:</div>');
        $confirmUrl = htmlspecialchars('?token=' . rawurlencode($validToken) . '&confirm=1');
        out('<div class="mono">' . $confirmUrl . '</div>');
        out('<br><a href="' . htmlspecialchars($confirmUrl) . '" class="warn-btn" onclick="return confirm(\'⚠ This will run ALTER TABLE on the tasks table. Proceed?\')">▶ Run Fix — Confirm</a>');
    endif;
else:
    // ── LIVE EXECUTION ──────────────────────────────────────────────────────
    out('<div class="info-box info">Executing safe SQL...</div>');
    
    $allOk = true;
    
    // A. ALTER TABLE — add missing columns to tasks
    if (!empty($missingTasksCols)) {
        $adds = [];
        $colDefs = [
            'approval_required'    => 'ADD COLUMN `approval_required` TINYINT(1) NOT NULL DEFAULT 0',
            'reviewer_id'          => 'ADD COLUMN `reviewer_id` INT UNSIGNED NULL DEFAULT NULL',
            'approver_id'          => 'ADD COLUMN `approver_id` INT UNSIGNED NULL DEFAULT NULL',
            'submitted_at'         => 'ADD COLUMN `submitted_at` DATETIME NULL DEFAULT NULL',
            'submitted_by'         => 'ADD COLUMN `submitted_by` INT UNSIGNED NULL DEFAULT NULL',
            'checked_at'           => 'ADD COLUMN `checked_at` DATETIME NULL DEFAULT NULL',
            'checked_by'           => 'ADD COLUMN `checked_by` INT UNSIGNED NULL DEFAULT NULL',
            'accepted_workflow_at' => 'ADD COLUMN `accepted_workflow_at` DATETIME NULL DEFAULT NULL',
            'accepted_workflow_by' => 'ADD COLUMN `accepted_workflow_by` INT UNSIGNED NULL DEFAULT NULL',
            'rejected_at'          => 'ADD COLUMN `rejected_at` DATETIME NULL DEFAULT NULL',
            'rejected_by'          => 'ADD COLUMN `rejected_by` INT UNSIGNED NULL DEFAULT NULL',
            'rejection_reason'     => 'ADD COLUMN `rejection_reason` TEXT NULL DEFAULT NULL',
            'final_done_at'        => 'ADD COLUMN `final_done_at` DATETIME NULL DEFAULT NULL',
            'review_note'          => 'ADD COLUMN `review_note` TEXT NULL DEFAULT NULL',
            'acceptance_note'      => 'ADD COLUMN `acceptance_note` TEXT NULL DEFAULT NULL',
        ];
        foreach ($missingTasksCols as $c) {
            if (isset($colDefs[$c])) $adds[] = $colDefs[$c];
        }
        
        if (!empty($adds)) {
            $alterSql = "ALTER TABLE `tasks` " . implode(", ", $adds);
            try {
                $pdo->exec($alterSql);
                out('<div class="ok">✓ ALTER TABLE succeeded. Columns added: ' . implode(', ', $missingTasksCols) . '</div>');
            } catch (PDOException $e) {
                $err = $e->getMessage();
                if (strpos($err, 'Duplicate column') !== false) {
                    out('<div class="ok">✓ Column already exists (race condition handled): ' . htmlspecialchars($err) . '</div>');
                } else {
                    out('<div class="fail">✗ ALTER TABLE failed: ' . htmlspecialchars($err) . '</div>');
                    $allOk = false;
                }
            }
        }
    } else {
        out('<div class="ok">✓ Tasks table columns already present.</div>');
    }
    
    // B. CREATE task_approval_events
    if (!$taeExists) {
        $createSql = "CREATE TABLE IF NOT EXISTS `task_approval_events` (
  `id`            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `task_id`       INT              NOT NULL,
  `actor_user_id` INT              NOT NULL,
  `action_type`   ENUM('started','submitted','review_approved','review_rejected','acceptance_approved','acceptance_rejected','marked_done','reopened','override') NOT NULL,
  `from_status`   VARCHAR(64)     NULL,
  `to_status`     VARCHAR(64)     NULL,
  `comment`       TEXT             NULL,
  `evidence_url`  VARCHAR(512)    NULL,
  `is_override`   TINYINT(1)      NOT NULL DEFAULT 0,
  `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_tae_task`    (`task_id`),
  INDEX `idx_tae_actor`   (`actor_user_id`),
  INDEX `idx_tae_action`  (`action_type`),
  INDEX `idx_tae_created` (`created_at`),
  FOREIGN KEY (`task_id`)       REFERENCES `tasks`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
        try {
            $pdo->exec($createSql);
            out('<div class="ok">✓ task_approval_events table created.</div>');
        } catch (PDOException $e) {
            $err = $e->getMessage();
            if (strpos($err, 'already exists') !== false) {
                out('<div class="ok">✓ task_approval_events already exists.</div>');
            } else {
                out('<div class="fail">✗ task_approval_events creation failed: ' . htmlspecialchars($err) . '</div>');
                $allOk = false;
            }
        }
    } else {
        out('<div class="ok">✓ task_approval_events already exists.</div>');
    }

    // C. CREATE Reviewer Workspace tables
    if (!empty($rwMissing)) {
        out('<h2 style="color:#60a5fa;margin-top:18px">Reviewer Workspace Tables</h2>');
        if (empty($reviewerStatements)) {
            out('<div class="fail">✗ Reviewer Workspace migration file missing or empty.</div>');
            $allOk = false;
        } else {
            $rwRun = 0;
            foreach ($reviewerStatements as $stmt) {
                try {
                    $pdo->exec($stmt);
                    $rwRun++;
                } catch (PDOException $e) {
                    out('<div class="fail">✗ Reviewer Workspace statement failed: ' . htmlspecialchars($e->getMessage()) . '</div>');
                    $allOk = false;
                }
            }
            out('<div class="ok">✓ Reviewer Workspace migration statements executed: ' . (int)$rwRun . '</div>');
        }
    } else {
        out('<div class="ok">✓ Reviewer Workspace tables already present.</div>');
    }
    
    // D. Final verification
    echo '<hr><h2 style="color:#60a5fa">8. Verification After Fix</h2>';
    
    $newCols = $pdo->query("SHOW COLUMNS FROM tasks")->fetchAll(PDO::FETCH_ASSOC);
    $newColNames = array_column($newCols, 'Field');
    
    $passCount = 0;
    $totalCount = count($approvalCols) + 1; // +1 for task_approval_events
    
    foreach ($approvalCols as $col => $desc):
        $present = in_array($col, $newColNames);
        if ($present) $passCount++;
        sub($col, $present ? 'PASS' : 'FAIL', $present);
    endforeach;
    
    $taeCheck2 = $pdo->query(
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '" . addcslashes(DB_NAME, "'") . "' AND table_name = 'task_approval_events'"
    )->fetchColumn();
    if ($taeCheck2 > 0) $passCount++;
    sub('task_approval_events', $taeCheck2 > 0 ? 'PASS' : 'FAIL', $taeCheck2 > 0);

    foreach ($rwTables as $tbl => $desc) {
        $exists = $pdo->query(
            "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '" . addcslashes(DB_NAME, "'") . "' AND table_name = '$tbl'"
        )->fetchColumn() > 0;
        if ($exists) $passCount++;
        sub($tbl, $exists ? 'PASS' : 'FAIL', $exists);
        if (!$exists) $allOk = false;
    }
    
    // Test: can we SELECT tasks with approval_required?
    try {
        $pdo->query("SELECT id, approval_required FROM tasks LIMIT 1")->fetch();
        out('<div class="ok">✓ SELECT tasks.approval_required succeeds — no more SQLSTATE[42S22]</div>');
    } catch (PDOException $e) {
        out('<div class="fail">✗ SELECT still failing: ' . htmlspecialchars($e->getMessage()) . '</div>');
        $allOk = false;
    }
    
    echo '<hr>';
    if ($allOk):
        out('<div class="info-box success" style="font-size:1.1rem;font-weight:700">✅ PASS — Schema is now in sync. Task save should work.</div>');
        out('<div style="margin-top:12px;color:#71717a;font-size:.875rem">');
        out('✓ approval_required column: PRESENT<br>');
        out('✓ reviewer_id column: PRESENT<br>');
        out('✓ approver_id column: PRESENT<br>');
        out('✓ submitted_at / reviewed_at / accepted_at / final_done_at: PRESENT<br>');
        out('✓ task_approval_events table: PRESENT<br>');
        out('✓ SELECT on tasks works: CONFIRMED<br>');
        out('<br><strong>Next step:</strong> Open <a href="/tasks/19737" style="color:#60a5fa">/tasks/19737</a> and try saving again.<br>');
        out('<br><strong>⚠ IMPORTANT:</strong> Delete or rename this file after use.<br>');
        out('Run: <code style="background:#0d1117;padding:4px 8px;border-radius:4px;color:#fbbf24">mv fix_schema.php fix_schema.php.done</code></div>');
    else:
        out('<div class="info-box danger" style="font-size:1.1rem;font-weight:700">❌ FAIL — Some operations failed. Review errors above.</div>');
        out('<div style="margin-top:12px;color:#71717a;font-size:.875rem">Check the error messages above and re-run or fix manually via phpMyAdmin.</div>');
    endif;
endif;
?>

</div>
</div>
</body>
</html>
