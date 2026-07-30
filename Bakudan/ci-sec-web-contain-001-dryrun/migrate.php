<?php
/**
 * Standalone migration - no dependencies, direct database access
 * Access directly: https://dashboard.bakudanramen.com/migrate.php
 * (Bypasses index.php routing)
 */

// SQL download helper — ?dl=1,2,3 to download migration files
if (isset($_GET['dl'])) {
    $files = [
        '1' => [__DIR__ . '/database/migrations/2026_04_12_task_schema_columns.sql', '1_task_schema_columns.sql'],
        '2' => [__DIR__ . '/database/migrations/2026_04_12_role_rename.sql',         '2_role_rename.sql'],
        '3' => [__DIR__ . '/database/migrations/2026_05_09_penalty_system.sql',       '3_penalty_system.sql'],
    ];
    $k = $_GET['dl'];
    if (isset($files[$k])) {
        header('Content-Type: application/octet-stream');
        header('Content-Disposition: attachment; filename="' . $files[$k][1] . '"');
        readfile($files[$k][0]);
        exit;
    }
    header('Content-Type: text/html; charset=utf-8');
    echo '<html><body style="font-family:sans-serif;padding:20px;background:#111;color:#eee">';
    echo '<h2>Download SQL Migrations</h2><p>Chạy theo thứ tự trên phpMyAdmin:</p><ol>';
    foreach ($files as $i => $f) echo "<li><a href='?dl=$i' style='color:#60a5fa'>{$f[1]}</a></li>";
    echo '</ol><p style="color:#f87171;font-size:12px">Xóa file này sau khi dùng xong</p></body></html>';
    exit;
}

// Database credentials from .env (or .env.preview for staging). Never hardcode production credentials here.
(function () {
    $candidates = [];
    $forcedFile = getenv('APP_ENV_FILE') ?: ($_SERVER['APP_ENV_FILE'] ?? '');
    if ($forcedFile !== '') {
        $candidates[] = $forcedFile;
    }

    $host = strtolower($_SERVER['HTTP_HOST'] ?? '');
    // Match subdomains: preview.dashboard..., draft.dashboard..., staging.dashboard...
    // Must NOT match dashboard.bakudanramen.com (which contains 'preview' substring)
    if ($host !== '' && (
        preg_match('/^(preview|draft|staging)\./', $host) ||
        str_ends_with($host, '.preview.dashboard.bakudanramen.com')
    )) {
        $candidates[] = __DIR__ . '/.env.preview';
    }

    $candidates[] = __DIR__ . '/.env';

    $envFile = null;
    foreach (array_values(array_unique($candidates)) as $candidate) {
        if ($candidate && file_exists($candidate)) {
            $envFile = $candidate;
            break;
        }
    }
    if ($envFile === null) return;

    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#' || strpos($line, '=') === false) continue;
        [$key, $value] = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value);
        if (preg_match('/^(["\'])(.*)\\1$/', $value, $m)) $value = $m[2];
        $_ENV[$key] = $value;
        putenv("$key=$value");
    }
})();

$DB_HOST = $_ENV['DB_HOST'] ?? getenv('DB_HOST') ?: '';
$DB_NAME = $_ENV['DB_NAME'] ?? getenv('DB_NAME') ?: ($_ENV['DB_DATABASE'] ?? getenv('DB_DATABASE') ?: '');
$DB_USER = $_ENV['DB_USER'] ?? getenv('DB_USER') ?: '';
$DB_PASS = $_ENV['DB_PASS'] ?? getenv('DB_PASS') ?: '';

if ($DB_HOST === '' || $DB_NAME === '' || $DB_USER === '' || $DB_PASS === '') {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'error' => 'DB credentials missing. Check .env.']);
    exit;
}

// ── P0 Repair Mode: ?repair=1 ─────────────────────────────────────────────────
// Must run BEFORE migrations so PDO is fresh and not inside transaction.
if (isset($_GET['repair']) && $_GET['repair'] === '1') {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    $repairOutput = ['repair_started_at' => date('c'), 'steps' => []];
    try {
        $pdo = new PDO("mysql:host=$DB_HOST;dbname=$DB_NAME;charset=utf8mb4", $DB_USER, $DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'error' => 'DB connection failed: ' . $e->getMessage()]);
        exit;
    }
    $currentDb = $pdo->query('SELECT DATABASE()')->fetchColumn();
    $repairOutput['database'] = $currentDb;

    // Guard: only allow on preview DB
    if (stripos($currentDb, 'preview') === false) {
        $repairOutput['error'] = 'Repair endpoint is only available on preview databases';
        echo json_encode($repairOutput, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        exit;
    }

    try {
        // Step 1: Inspect orphaned section_ids
        $orphans = $pdo->query("
            SELECT t.id, t.title, t.section_id, t.project_id
            FROM tasks t
            LEFT JOIN sections s ON s.id = t.section_id
            WHERE t.section_id IS NOT NULL AND s.id IS NULL
        ")->fetchAll(PDO::FETCH_ASSOC);
        $repairOutput['steps'][] = [
            'step' => 1,
            'name' => 'inspect_orphans',
            'count' => count($orphans),
            'details' => $orphans,
        ];

        // Step 2: Repair orphaned section_ids → NULL
        $pdo->exec("
            UPDATE tasks t
            LEFT JOIN sections s ON s.id = t.section_id
            SET t.section_id = NULL
            WHERE t.section_id IS NOT NULL AND s.id IS NULL
        ");
        $repairOutput['steps'][] = [
            'step' => 2,
            'name' => 'repair_orphans',
            'affected_rows' => $pdo->rowCount(),
            'done' => true,
        ];

        // Step 3: Ensure default sections for projects
        $projectsWithoutSections = $pdo->query("
            SELECT p.id, p.name
            FROM projects p
            WHERE NOT EXISTS (SELECT 1 FROM sections s WHERE s.project_id = p.id)
        ")->fetchAll(PDO::FETCH_ASSOC);
        foreach ($projectsWithoutSections as $p) {
            $pdo->prepare("INSERT INTO sections (project_id, name, position) VALUES (?, 'To Do', 0)")
                ->execute([$p['id']]);
        }
        $repairOutput['steps'][] = [
            'step' => 3,
            'name' => 'ensure_default_sections',
            'projects_without_sections_before' => count($projectsWithoutSections),
            'created_sections' => array_map(fn($p) => [
                'project_id' => $p['id'],
                'section_id' => (int)$pdo->lastInsertId(),
            ], $projectsWithoutSections),
            'done' => true,
        ];

        // Step 4: Verify sections table
        $sectionCols = $pdo->query("SHOW COLUMNS FROM sections")->fetchAll(PDO::FETCH_COLUMN, 1);
        $sectionCount = $pdo->query("SELECT COUNT(*) FROM sections")->fetchColumn();
        $finalOrphans = $pdo->query("
            SELECT COUNT(*) FROM tasks t
            LEFT JOIN sections s ON s.id = t.section_id
            WHERE t.section_id IS NOT NULL AND s.id IS NULL
        ")->fetchColumn();
        $repairOutput['steps'][] = [
            'step' => 4,
            'name' => 'verify_sections_table',
            'columns' => $sectionCols,
            'total_sections' => (int)$sectionCount,
            'final_orphan_count' => (int)$finalOrphans,
            'done' => true,
        ];

        $repairOutput['repair_completed_at'] = date('c');
        $repairOutput['status'] = ($finalOrphans == 0) ? 'CLEAN' : 'ISSUES_REMAIN';

    } catch (Throwable $e) {
        $repairOutput['error'] = $e->getMessage();
        $repairOutput['error_class'] = get_class($e);
    }

    echo json_encode($repairOutput, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}
// ── End Repair Mode ────────────────────────────────────────────────────────────

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

try {
    $pdo = new PDO("mysql:host=$DB_HOST;dbname=$DB_NAME;charset=utf8mb4", $DB_USER, $DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'error' => 'DB connection failed: ' . $e->getMessage()]);
    exit;
}

$results = [];

function addColumn($pdo, $table, $col, $sql, &$results) {
    $exists = $pdo->query(
        "SELECT 1 FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = '$table' AND column_name = '$col'"
    )->fetch();
    if ($exists) {
        $results["$table.$col"] = ['status' => 'EXISTS'];
    } else {
        try {
            $pdo->exec($sql);
            $results["$table.$col"] = ['status' => 'ADDED'];
        } catch (Exception $e) {
            $results["$table.$col"] = ['status' => 'ERROR', 'message' => $e->getMessage()];
        }
    }
}

$migrations = [
    'api_tokens' => "CREATE TABLE IF NOT EXISTS api_tokens (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, device_id VARCHAR(100) DEFAULT NULL, device_name VARCHAR(200) DEFAULT NULL, platform ENUM('android','ios','web') DEFAULT 'web', access_token VARCHAR(64) NOT NULL, refresh_token VARCHAR(64) NOT NULL, access_token_expires_at TIMESTAMP NOT NULL, refresh_token_expires_at TIMESTAMP NOT NULL, last_used_at TIMESTAMP NULL DEFAULT NULL, revoked_at TIMESTAMP NULL DEFAULT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, INDEX idx_access_token (access_token(32)), INDEX idx_refresh_token (refresh_token(32)), INDEX idx_user_active (user_id, revoked_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    'devices' => "CREATE TABLE IF NOT EXISTS devices (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, platform ENUM('android','ios') NOT NULL, device_id VARCHAR(100) NOT NULL, device_name VARCHAR(200) DEFAULT NULL, app_version VARCHAR(20) DEFAULT NULL, os_version VARCHAR(50) DEFAULT NULL, push_token VARCHAR(255) DEFAULT NULL, push_token_updated_at TIMESTAMP NULL DEFAULT NULL, is_active TINYINT(1) DEFAULT 1, last_active_at TIMESTAMP NULL DEFAULT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, UNIQUE KEY uk_user_device (user_id, device_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    'notification_deliveries' => "CREATE TABLE IF NOT EXISTS notification_deliveries (id INT AUTO_INCREMENT PRIMARY KEY, notification_id INT NOT NULL, channel ENUM('email','push','in_app') NOT NULL, delivery_status ENUM('pending','sent','delivered','failed') DEFAULT 'pending', provider_response TEXT DEFAULT NULL, sent_at TIMESTAMP NULL DEFAULT NULL, delivered_at TIMESTAMP NULL DEFAULT NULL, failed_at TIMESTAMP NULL DEFAULT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_notification_channel (notification_id, channel)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    'rate_limits' => "CREATE TABLE IF NOT EXISTS rate_limits (id INT AUTO_INCREMENT PRIMARY KEY, ip_address VARCHAR(45) NOT NULL, action VARCHAR(30) NOT NULL DEFAULT 'login', attempts INT DEFAULT 1, locked_until TIMESTAMP NULL DEFAULT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, INDEX idx_ip_action (ip_address, action), INDEX idx_locked (locked_until)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    'audit_log' => "CREATE TABLE IF NOT EXISTS audit_log (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT DEFAULT NULL, action VARCHAR(50) NOT NULL, entity_type VARCHAR(50) DEFAULT NULL, entity_id INT DEFAULT NULL, device_id VARCHAR(100) DEFAULT NULL, ip_address VARCHAR(45) DEFAULT NULL, user_agent TEXT DEFAULT NULL, metadata JSON DEFAULT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL, INDEX idx_user_action (user_id, action), INDEX idx_entity (entity_type, entity_id), INDEX idx_created (created_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    'sync_events' => "CREATE TABLE IF NOT EXISTS sync_events (id BIGINT AUTO_INCREMENT PRIMARY KEY, event VARCHAR(50) NOT NULL, payload JSON NOT NULL, user_id INT DEFAULT NULL, channel VARCHAR(50) DEFAULT 'global', expires_at TIMESTAMP NULL DEFAULT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_channel_created (channel, created_at), INDEX idx_expires (expires_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
];

foreach ($migrations as $name => $sql) {
    try { $pdo->exec($sql); $results[$name] = ['status' => 'OK']; }
    catch (Exception $e) { $results[$name] = ['status' => 'ERROR', 'message' => $e->getMessage()]; }
}

addColumn($pdo, 'notifications', 'is_read',    "ALTER TABLE notifications ADD COLUMN is_read TINYINT(1) DEFAULT 0 AFTER message", $results);
addColumn($pdo, 'notifications', 'deep_link',  "ALTER TABLE notifications ADD COLUMN deep_link VARCHAR(255) DEFAULT NULL AFTER is_read", $results);
addColumn($pdo, 'users', 'preferred_language', "ALTER TABLE users ADD COLUMN preferred_language VARCHAR(5) DEFAULT 'vi' AFTER avatar", $results);
addColumn($pdo, 'users', 'notification_settings', "ALTER TABLE users ADD COLUMN notification_settings JSON DEFAULT NULL AFTER email_notifications", $results);
addColumn($pdo, 'attachments', 'file_url',     "ALTER TABLE attachments ADD COLUMN file_url VARCHAR(500) DEFAULT NULL AFTER original_name", $results);

try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS task_watchers (task_id INT NOT NULL, user_id INT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (task_id, user_id), INDEX idx_watcher_user (user_id), FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $results['task_watchers table'] = ['status' => 'OK'];
} catch (Exception $e) { $results['task_watchers table'] = ['status' => 'ERROR', 'message' => $e->getMessage()]; }

try {
    $stmt = $pdo->query("SELECT id, name, role FROM users WHERE role IN ('admin', 'manager') AND is_active = 1");
    $managersAdmins = $stmt->fetchAll();
    $managerAdminIds = array_column($managersAdmins, 'id');
    if (count($managerAdminIds) > 0) {
        $tasks = $pdo->query("SELECT id FROM tasks")->fetchAll();
        $placeholders = []; $values = [];
        foreach ($tasks as $task) {
            foreach ($managerAdminIds as $uid) { $placeholders[] = "(?, ?)"; $values[] = (int)$task['id']; $values[] = (int)$uid; }
        }
        $insertedCount = 0;
        if (!empty($placeholders)) {
            foreach (array_chunk($placeholders, 100) as $i => $chunk) {
                $s = $pdo->prepare("INSERT IGNORE INTO task_watchers (task_id, user_id) VALUES " . implode(', ', $chunk));
                $s->execute(array_slice($values, $i * 200, 200));
                $insertedCount += $s->rowCount();
            }
        }
        $results['add_manager_admin_watchers'] = ['status' => 'OK', 'managers_admins_found' => count($managersAdmins), 'tasks_updated' => count($tasks), 'watcher_links_created' => $insertedCount];
    } else {
        $results['add_manager_admin_watchers'] = ['status' => 'SKIPPED', 'reason' => 'No admin/manager users found'];
    }
} catch (Exception $e) { $results['add_manager_admin_watchers'] = ['status' => 'ERROR', 'message' => $e->getMessage()]; }

// ── Sprint 2: Role rename (member → staff, add ceo) ──────────────────────────
try {
    $pdo->exec("ALTER TABLE users MODIFY COLUMN role ENUM('ceo','admin','manager','staff','member') NOT NULL DEFAULT 'staff'");
    $pdo->exec("UPDATE users SET role = 'staff' WHERE role = 'member'");
    $pdo->exec("ALTER TABLE users MODIFY COLUMN role ENUM('ceo','admin','manager','staff') NOT NULL DEFAULT 'staff'");
    $results['role_rename_member_to_staff'] = ['status' => 'OK'];
} catch (Exception $e) { $results['role_rename_member_to_staff'] = ['status' => 'ERROR', 'message' => $e->getMessage()]; }

// ── Sprint 2: Task schema columns ─────────────────────────────────────────────
$taskCols = [
    ['tasks', 'accepted_at',     "ALTER TABLE tasks ADD COLUMN accepted_at TIMESTAMP NULL DEFAULT NULL AFTER completed_at"],
    ['tasks', 'parent_task_id',  "ALTER TABLE tasks ADD COLUMN parent_task_id INT NULL DEFAULT NULL AFTER accepted_at"],
    ['tasks', 'reschedule_count',"ALTER TABLE tasks ADD COLUMN reschedule_count INT DEFAULT 0 AFTER parent_task_id"],
    ['tasks', 'visibility',      "ALTER TABLE tasks ADD COLUMN visibility ENUM('private','public') DEFAULT 'private' COMMENT 'private=only assignee/creator/admin' AFTER status"],
    ['tasks', 'private_by_user_id', "ALTER TABLE tasks ADD COLUMN private_by_user_id INT NULL DEFAULT NULL AFTER visibility"],
    ['tasks', 'repeat_type',     "ALTER TABLE tasks ADD COLUMN repeat_type ENUM('none','daily','weekly','monthly','yearly') DEFAULT 'none' AFTER reschedule_count"],
    ['tasks', 'repeat_config',   "ALTER TABLE tasks ADD COLUMN repeat_config TEXT NULL DEFAULT NULL AFTER repeat_type"],
    ['tasks', 'repeat_from_mode', "ALTER TABLE tasks ADD COLUMN repeat_from_mode ENUM('due_date','completion_date') DEFAULT 'due_date' AFTER repeat_config"],
    ['tasks', 'repeat_end_type',  "ALTER TABLE tasks ADD COLUMN repeat_end_type ENUM('never','on_date','after_count') DEFAULT 'never' AFTER repeat_from_mode"],
    ['tasks', 'repeat_end_date',  "ALTER TABLE tasks ADD COLUMN repeat_end_date DATE NULL DEFAULT NULL AFTER repeat_end_type"],
    ['tasks', 'repeat_end_count', "ALTER TABLE tasks ADD COLUMN repeat_end_count INT NULL DEFAULT NULL AFTER repeat_end_date"],
    ['tasks', 'estimated_time',   "ALTER TABLE tasks ADD COLUMN estimated_time INT NULL DEFAULT NULL AFTER repeat_end_count"],
];
foreach ($taskCols as [$tbl, $col, $sql]) { addColumn($pdo, $tbl, $col, $sql, $results); }

// ── P1 Fix: approver_id column for task approval workflow ─────────────────
addColumn($pdo, 'tasks', 'approver_id', "ALTER TABLE tasks ADD COLUMN approver_id INT UNSIGNED NULL DEFAULT NULL AFTER reviewer_id", $results);

// ── P1 Fix: approver_id column for task approval workflow ─────────────────
addColumn($pdo, 'tasks', 'approver_id', "ALTER TABLE tasks ADD COLUMN approver_id INT UNSIGNED NULL DEFAULT NULL AFTER reviewer_id", $results);

// ── Sprint 2: Penalty system ──────────────────────────────────────────────────
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS penalty_config (id INT AUTO_INCREMENT PRIMARY KEY, penalty_amount DECIMAL(12,2) NOT NULL DEFAULT 500000, currency VARCHAR(10) NOT NULL DEFAULT 'VND', updated_by INT NULL, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $results['penalty_config'] = ['status' => 'OK'];
} catch (Exception $e) { $results['penalty_config'] = ['status' => 'ERROR', 'message' => $e->getMessage()]; }

try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS penalty_log (id INT AUTO_INCREMENT PRIMARY KEY, task_id INT NOT NULL, project_id INT NULL, store_id INT NULL, user_id INT NULL, penalty_amount DECIMAL(12,2) NOT NULL, penalty_currency VARCHAR(10) NOT NULL DEFAULT 'VND', overdue_days INT NOT NULL DEFAULT 1, reason VARCHAR(255) NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uniq_task_penalty (task_id), INDEX idx_pl_user (user_id), INDEX idx_pl_project (project_id), INDEX idx_pl_created (created_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $results['penalty_log'] = ['status' => 'OK'];
} catch (Exception $e) { $results['penalty_log'] = ['status' => 'ERROR', 'message' => $e->getMessage()]; }

try {
    $seedColumns = $pdo->query(
        "SELECT column_name FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = 'penalty_config'
         AND column_name IN ('penalty_amount', 'currency')"
    )->fetchAll(PDO::FETCH_COLUMN);
    if (in_array('penalty_amount', $seedColumns, true) && in_array('currency', $seedColumns, true)) {
        $pdo->exec("INSERT INTO penalty_config (id, penalty_amount, currency) VALUES (1, 500000, 'VND') ON DUPLICATE KEY UPDATE id=id");
        $results['penalty_config_seed'] = ['status' => 'OK'];
    } else {
        $results['penalty_config_seed'] = ['status' => 'SKIPPED', 'reason' => 'Current penalty_config schema uses per-user configuration'];
    }
} catch (Exception $e) { $results['penalty_config_seed'] = ['status' => 'ERROR', 'message' => $e->getMessage()]; }

$penaltyCols = [
    ['tasks', 'penalty_applied',    "ALTER TABLE tasks ADD COLUMN penalty_applied TINYINT(1) NOT NULL DEFAULT 0"],
    ['tasks', 'penalty_amount',     "ALTER TABLE tasks ADD COLUMN penalty_amount DECIMAL(12,2) NOT NULL DEFAULT 0"],
    ['tasks', 'penalty_currency',   "ALTER TABLE tasks ADD COLUMN penalty_currency VARCHAR(10) NOT NULL DEFAULT 'VND'"],
    ['tasks', 'penalty_applied_at', "ALTER TABLE tasks ADD COLUMN penalty_applied_at DATETIME NULL"],
];
foreach ($penaltyCols as [$tbl, $col, $sql]) { addColumn($pdo, $tbl, $col, $sql, $results); }

// ── Preview sync compatibility: main DB may lag preview code schema ─────────
$compatCols = [
    ['tasks', 'creator_id', "ALTER TABLE tasks ADD COLUMN creator_id INT NULL DEFAULT NULL AFTER created_by"],
    ['notifications', 'sender_id', "ALTER TABLE notifications ADD COLUMN sender_id INT NULL DEFAULT NULL AFTER user_id"],
    ['deadline_extensions', 'requested_at', "ALTER TABLE deadline_extensions ADD COLUMN requested_at DATETIME NULL DEFAULT NULL AFTER requested_due_date"],
    ['releases', 'created_by', "ALTER TABLE releases ADD COLUMN created_by INT NULL DEFAULT NULL AFTER owner_id"],
    ['releases', 'published_by', "ALTER TABLE releases ADD COLUMN published_by INT NULL DEFAULT NULL AFTER published_at"],
    ['releases', 'title', "ALTER TABLE releases ADD COLUMN title VARCHAR(255) NULL DEFAULT NULL AFTER name"],
    ['releases', 'summary', "ALTER TABLE releases ADD COLUMN summary TEXT NULL AFTER title"],
    ['releases', 'change_log', "ALTER TABLE releases ADD COLUMN change_log TEXT NULL AFTER summary"],
    ['releases', 'bug_fixes', "ALTER TABLE releases ADD COLUMN bug_fixes TEXT NULL AFTER change_log"],
    ['releases', 'known_issues', "ALTER TABLE releases ADD COLUMN known_issues TEXT NULL AFTER bug_fixes"],
    ['releases', 'risk_notes', "ALTER TABLE releases ADD COLUMN risk_notes TEXT NULL AFTER known_issues"],
    ['releases', 'rollback_notes', "ALTER TABLE releases ADD COLUMN rollback_notes TEXT NULL AFTER risk_notes"],
    ['releases', 'rollback_contact', "ALTER TABLE releases ADD COLUMN rollback_contact VARCHAR(255) NULL DEFAULT NULL AFTER rollback_notes"],
    ['releases', 'release_window_notes', "ALTER TABLE releases ADD COLUMN release_window_notes TEXT NULL AFTER rollback_contact"],
    ['releases', 'confidence_letter', "ALTER TABLE releases ADD COLUMN confidence_letter VARCHAR(5) NULL DEFAULT NULL AFTER confidence_score"],
    ['releases', 'target_date', "ALTER TABLE releases ADD COLUMN target_date DATETIME NULL DEFAULT NULL AFTER scheduled_at"],
];
foreach ($compatCols as [$tbl, $col, $sql]) { addColumn($pdo, $tbl, $col, $sql, $results); }

try {
    if (isset($results['tasks.creator_id']['status']) && in_array($results['tasks.creator_id']['status'], ['ADDED', 'EXISTS'], true)) {
        $pdo->exec("UPDATE tasks SET creator_id = created_by WHERE creator_id IS NULL AND created_by IS NOT NULL");
    }
    if (isset($results['notifications.sender_id']['status']) && in_array($results['notifications.sender_id']['status'], ['ADDED', 'EXISTS'], true)) {
        $pdo->exec("UPDATE notifications SET sender_id = from_user_id WHERE sender_id IS NULL AND from_user_id IS NOT NULL");
    }
    if (isset($results['deadline_extensions.requested_at']['status']) && in_array($results['deadline_extensions.requested_at']['status'], ['ADDED', 'EXISTS'], true)) {
        $pdo->exec("UPDATE deadline_extensions SET requested_at = created_at WHERE requested_at IS NULL AND created_at IS NOT NULL");
    }
    if (isset($results['releases.created_by']['status']) && in_array($results['releases.created_by']['status'], ['ADDED', 'EXISTS'], true)) {
        $pdo->exec("UPDATE releases SET created_by = owner_id WHERE created_by IS NULL AND owner_id IS NOT NULL");
    }
    $results['preview_sync_backfill'] = ['status' => 'OK'];
} catch (Exception $e) { $results['preview_sync_backfill'] = ['status' => 'ERROR', 'message' => $e->getMessage()]; }

try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS release_artifacts (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        release_id BIGINT UNSIGNED NOT NULL,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NULL,
        url VARCHAR(500) NULL,
        description TEXT NULL,
        uploaded_by BIGINT UNSIGNED NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_release_artifacts_release (release_id),
        INDEX idx_release_artifacts_type (release_id, type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $results['release_artifacts'] = ['status' => 'OK'];
} catch (Exception $e) { $results['release_artifacts'] = ['status' => 'ERROR', 'message' => $e->getMessage()]; }

try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS usage_events (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT UNSIGNED NOT NULL,
        event VARCHAR(100) NOT NULL,
        page VARCHAR(200) NULL,
        metadata JSON NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_usage_user_event (user_id, event),
        INDEX idx_usage_event_date (event, created_at),
        INDEX idx_usage_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $results['usage_events'] = ['status' => 'OK'];
} catch (Exception $e) { $results['usage_events'] = ['status' => 'ERROR', 'message' => $e->getMessage()]; }

try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS store_checklists (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        store_id BIGINT UNSIGNED NOT NULL,
        type ENUM('open', 'close') NOT NULL,
        items JSON NOT NULL,
        notes TEXT NULL,
        cash_count DECIMAL(12,2) NULL,
        opened_by BIGINT UNSIGNED NULL,
        opened_at DATETIME NULL,
        closed_by BIGINT UNSIGNED NULL,
        closed_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_store_type (store_id, type),
        INDEX idx_opened_at (opened_at),
        INDEX idx_closed_at (closed_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $results['store_checklists'] = ['status' => 'OK'];
} catch (Exception $e) { $results['store_checklists'] = ['status' => 'ERROR', 'message' => $e->getMessage()]; }

try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS deploy_freezes (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        reason VARCHAR(500) NOT NULL,
        started_by INT UNSIGNED NOT NULL,
        starts_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        ends_at DATETIME DEFAULT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_deploy_freezes_active (is_active, starts_at, ends_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $results['deploy_freezes'] = ['status' => 'OK'];
} catch (Exception $e) { $results['deploy_freezes'] = ['status' => 'ERROR', 'message' => $e->getMessage()]; }

// ── Phase 15: Release Governance (CEO directive 2026-06-02)
$governanceSqlFile = __DIR__ . '/database/migrations/2026_06_02_release_governance.sql';
if (file_exists($governanceSqlFile)) {
    $sqlContent = file_get_contents($governanceSqlFile);
    $sqlContent = preg_replace('/^\s*--.*$/m', '', $sqlContent);
    $sqlContent = preg_replace('/\/\*.*?\*\//s', '', $sqlContent);
    $statements = array_filter(
        array_map('trim', explode(';', $sqlContent)),
        fn($s) => $s !== ''
    );
    $govCount = 0;
    $govErrors = [];
    foreach ($statements as $stmt) {
        $s = trim($stmt);
        if ($s === '') continue;
        try { $pdo->exec($s); $govCount++; }
        catch (Exception $e) { $govErrors[] = $e->getMessage(); }
    }
    $results['release_governance_tables'] = [
        'status' => 'OK',
        'statements_run' => $govCount,
        'errors' => $govErrors ?: null,
    ];
} else {
    $results['release_governance_tables'] = ['status' => 'SKIPPED', 'reason' => 'File not found'];
}

// ── Phase 14: Reviewer Workspace (task_comments, task_mentions, task_notifications,
//               task_reviewer_notes, task_approval_notes, inbox_category)
//               Source: database/migrations/2026_06_02_reviewer_workspace.sql
$reviewerSqlFile = __DIR__ . '/database/migrations/2026_06_02_reviewer_workspace.sql';
if (file_exists($reviewerSqlFile)) {
    $sqlContent = file_get_contents($reviewerSqlFile);
    $sqlContent = preg_replace('/^\s*--.*$/m', '', $sqlContent);
    $sqlContent = preg_replace('/\/\*.*?\*\//s', '', $sqlContent);
    $statements = array_filter(
        array_map('trim', explode(';', $sqlContent)),
        fn($s) => $s !== ''
    );
    $rwCount = 0;
    $rwErrors = [];
    $rwExpectedTables = [
        'task_comments',
        'task_mentions',
        'task_notifications',
        'task_reviewer_notes',
        'task_approval_notes',
    ];
    foreach ($statements as $stmt) {
        $s = trim($stmt);
        if ($s === '') continue;
        try { $pdo->exec($s); $rwCount++; }
        catch (Exception $e) { $rwErrors[] = substr($e->getMessage(), 0, 120); }
    }
    $rwTableStatus = [];
    foreach ($rwExpectedTables as $table) {
        $exists = $pdo->query(
            "SELECT 1 FROM information_schema.tables
             WHERE table_schema = DATABASE() AND table_name = " . $pdo->quote($table) . "
             LIMIT 1"
        )->fetchColumn();
        $rwTableStatus[$table] = $exists ? 'EXISTS' : 'MISSING';
        if (!$exists) {
            $rwErrors[] = "Required reviewer workspace table missing after migration: {$table}";
        }
    }
    $results['reviewer_workspace'] = [
        'status' => empty($rwErrors) ? 'OK' : 'WARN',
        'statements_run' => $rwCount,
        'tables' => $rwTableStatus,
        'errors' => $rwErrors ?: 'none',
        'source' => '2026_06_02_reviewer_workspace.sql',
    ];
} else {
    $results['reviewer_workspace'] = ['status' => 'SKIPPED', 'reason' => 'SQL file not found'];
}

echo json_encode(['success' => true, 'message' => 'All migrations completed', 'migrations' => $results, 'timestamp' => date('c')], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
