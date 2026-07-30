<?php
/**
 * CEO Evidence Pack — DB Query Runner
 * Queries production DB and outputs JSON results.
 * 
 * Usage: php-win.exe db_query.php <query_id>
 */

$queryId = $_GET['query_id'] ?? ($argv[1] ?? 'ping');

require_once __DIR__ . '/config/database.php';
$db = Database::getInstance();

header('Content-Type: application/json');

switch ($queryId) {
    case 'ping':
        $tables = $db->fetchAll("SHOW TABLES");
        echo json_encode(['status' => 'ok', 'tables' => array_map(fn($r) => reset($r), $tables)]);
        break;

    case 'task_count':
        echo json_encode($db->fetch("SELECT COUNT(*) as cnt FROM tasks"));
        break;

    case 'task_audit':
        $tasks = $db->fetchAll("
            SELECT 
                t.id as task_id,
                t.title,
                COALESCE(a.name, t.assigned_to, 'unassigned') as assignee,
                COALESCE(r.name, 'none') as reviewer,
                COALESCE(ap.name, 'none') as approver,
                (SELECT COUNT(*) FROM task_comments tc WHERE tc.task_id = t.id) as comments_count,
                (SELECT COUNT(*) FROM task_attachments ta WHERE ta.task_id = t.id) as attachments_count
            FROM tasks t
            LEFT JOIN users a ON t.assigned_to = a.id
            LEFT JOIN users r ON t.reviewer_id = r.id
            LEFT JOIN users ap ON t.approver_id = ap.id
            WHERE t.archived_duplicate = 0
            ORDER BY t.id
            LIMIT 100
        ");
        echo json_encode($tasks);
        break;

    case 'task_random':
        $tasks = $db->fetchAll("
            SELECT 
                t.id as task_id,
                t.title,
                COALESCE(a.name, CAST(t.assigned_to AS CHAR), 'unassigned') as assignee,
                COALESCE(r.name, 'none') as reviewer,
                COALESCE(ap.name, 'none') as approver,
                (SELECT COUNT(*) FROM task_comments tc WHERE tc.task_id = t.id) as comments_count,
                (SELECT COUNT(*) FROM task_attachments ta WHERE ta.task_id = t.id) as attachments_count
            FROM tasks t
            LEFT JOIN users a ON t.assigned_to = a.id
            LEFT JOIN users r ON t.reviewer_id = r.id
            LEFT JOIN users ap ON t.approver_id = ap.id
            WHERE t.archived_duplicate = 0
            ORDER BY RAND()
            LIMIT 100
        ");
        echo json_encode($tasks);
        break;

    case 'bill_overdue':
        $bills = $db->fetchAll("
            SELECT 
                b.id as bill_id,
                b.bill_name,
                COALESCE(s.name, 'unassigned') as store,
                COALESCE(b.category, 'uncategorized') as category,
                COALESCE(v.name, 'unknown') as vendor,
                COALESCE(b.amount, 0) as amount,
                b.due_date,
                COALESCE(b.repeat_rule, 'none') as repeat_rule
            FROM bills b
            LEFT JOIN stores s ON b.store_id = s.id
            LEFT JOIN vendors v ON b.vendor_id = v.id
            WHERE b.is_archived = 0
            AND b.due_date < CURDATE()
            ORDER BY b.due_date ASC
            LIMIT 50
        ");
        echo json_encode($bills);
        break;

    case 'bills_all':
        $bills = $db->fetchAll("
            SELECT 
                b.id as bill_id,
                b.bill_name,
                COALESCE(s.name, 'unassigned') as store,
                COALESCE(b.category, 'uncategorized') as category,
                COALESCE(v.name, 'unknown') as vendor,
                COALESCE(b.amount, 0) as amount,
                b.due_date,
                b.is_archived,
                b.is_paid,
                COALESCE(b.repeat_rule, 'none') as repeat_rule
            FROM bills b
            LEFT JOIN stores s ON b.store_id = s.id
            LEFT JOIN vendors v ON b.vendor_id = v.id
            ORDER BY b.id
            LIMIT 200
        ");
        echo json_encode($bills);
        break;

    case 'duplicates':
        $dupes = $db->fetchAll("
            SELECT 
                duplicate_hash,
                COUNT(*) as group_size,
                GROUP_CONCAT(id ORDER BY id) as task_ids,
                MIN(title) as sample_title
            FROM tasks
            WHERE duplicate_hash IS NOT NULL
            AND duplicate_hash != ''
            AND (archived_duplicate = 0 OR archived_duplicate IS NULL)
            GROUP BY duplicate_hash
            HAVING COUNT(*) > 1
            ORDER BY COUNT(*) DESC
        ");
        echo json_encode(['active_duplicate_groups' => $dupes, 'count' => count($dupes)]);

        $archived = $db->fetch("SELECT COUNT(*) as cnt FROM tasks WHERE archived_duplicate = 1");
        $merged = $db->fetch("SELECT COUNT(*) as cnt FROM tasks WHERE merged_into_task_id IS NOT NULL");
        echo json_encode(array_merge(['active_duplicate_groups' => $dupes, 'count' => count($dupes)], $archived, $merged));
        break;

    case 'duplicates_bills':
        $dupes = $db->fetchAll("
            SELECT 
                duplicate_hash,
                COUNT(*) as group_size,
                GROUP_CONCAT(id ORDER BY id) as bill_ids,
                MIN(bill_name) as sample_name
            FROM bills
            WHERE duplicate_hash IS NOT NULL
            AND duplicate_hash != ''
            GROUP BY duplicate_hash
            HAVING COUNT(*) > 1
            ORDER BY COUNT(*) DESC
        ");
        $archived = $db->fetch("SELECT COUNT(*) as cnt FROM bills WHERE is_archived = 1");
        echo json_encode(['bill_duplicate_groups' => $dupes, 'count' => count($dupes), 'archived_bills' => $archived]);
        break;

    case 'stores':
        $stores = $db->fetchAll("SELECT id, name, type, is_active FROM stores ORDER BY id");
        echo json_encode($stores);
        break;

    case 'user_lookup':
        $expectedKey = getenv('MI_SNAPSHOT_SECRET') ?: safety_read_env_value('MI_SNAPSHOT_SECRET');
        $providedKey = $_GET['key'] ?? '';
        if (!$expectedKey || !hash_equals($expectedKey, $providedKey)) {
            http_response_code(403);
            echo json_encode(['ok' => false, 'error' => 'Forbidden']);
            break;
        }
        $q = trim((string)($_GET['q'] ?? ''));
        $like = '%' . $q . '%';
        $users = $db->fetchAll(
            "SELECT id, name, email, role, is_active
             FROM users
             WHERE (? = '' OR name LIKE ? OR email LIKE ?)
             ORDER BY is_active DESC, name ASC
             LIMIT 100",
            [$q, $like, $like]
        );
        echo json_encode(['ok' => true, 'query' => $q, 'users' => $users], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        break;

    case 'obligations':
        $obs = $db->fetchAll("
            SELECT 
                o.id,
                o.name as obligation_name,
                COALESCE(s.name, 'company-wide') as store,
                o.frequency,
                COALESCE(oc.name, 'unknown') as category,
                COALESCE(o.amount, 0) as amount,
                o.is_active
            FROM obligations o
            LEFT JOIN stores s ON o.store_id = s.id
            LEFT JOIN obligation_categories oc ON o.category_id = oc.id
            WHERE o.is_active = 1
            ORDER BY s.name, o.name
        ");
        echo json_encode($obs);
        break;

    case 'schema_check':
        // Check for missing columns across key tables
        $checks = [];
        $tables = ['tasks', 'bills', 'users', 'stores', 'vendors', 'projects'];
        $requiredCols = [
            'tasks' => ['id', 'title', 'assigned_to', 'reviewer_id', 'approver_id', 'duplicate_hash', 'archived_duplicate', 'due_date', 'priority', 'status', 'project_id'],
            'bills' => ['id', 'bill_name', 'store_id', 'vendor_id', 'amount', 'due_date', 'is_archived', 'is_paid', 'duplicate_hash', 'repeat_rule'],
            'users' => ['id', 'name', 'email', 'password', 'role'],
            'stores' => ['id', 'name', 'type'],
            'vendors' => ['id', 'name', 'category'],
            'projects' => ['id', 'name', 'store_id']
        ];
        foreach ($tables as $table) {
            if (!$db->tableExists($table)) {
                $checks[] = ['table' => $table, 'exists' => false];
                continue;
            }
            foreach ($requiredCols[$table] ?? [] as $col) {
                $exists = $db->columnExists($table, $col);
                if (!$exists) {
                    $checks[] = ['table' => $table, 'column' => $col, 'exists' => false];
                }
            }
        }
        echo json_encode(['missing' => $checks, 'total_missing' => count($checks)]);
        break;

    case 'tables':
        $tables = $db->fetchAll("SHOW TABLES");
        echo json_encode(array_map(fn($r) => reset($r), $tables));
        break;

    // ── P0 CEO DIRECTIVE: Backup ──────────────────────────────────────────────
    case 'p0_backup':
        $tables = ['tasks','users','comments','attachments','files','images','credentials','credential_permissions','task_approval_events','audit_logs','notifications','stores','projects','shifts','bills','employees','deadline_extensions','penalties','penalty_assessments','penalty_history','penalty_rules','task_penalties','penalty_daily_snapshots','penalty_log','payments','vendors','duplicate_task_flags','duplicate_bill_flags','obligation_payments','obligation_tasks','obligations'];
        $bd = __DIR__ . '/backups';
        if (!is_dir($bd)) @mkdir($bd, 0755, true);
        $ts = date('Y-m-d_H-i-s');
        $fn = "P0_BACKUP_{$ts}.sql.gz";
        $fp = gzopen("{$bd}/{$fn}", 'w');
        if (!$fp) { echo json_encode(['error' => "Cannot write {$bd}/{$fn}"]); break; }
        gzwrite($fp, "-- P0 Backup {$ts}\nSET FOREIGN_KEY_CHECKS=0;\n\n");
        $tc = [];
        $pdo = $db->getConnection();
        foreach ($tables as $tbl) {
            $s = preg_replace('/[^a-zA-Z0-9_]/', '', $tbl);
            if (!$pdo->query("SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='{$s}' LIMIT 1")->fetchColumn()) continue;
            $cnt = (int)$pdo->query("SELECT COUNT(*) FROM `{$s}`")->fetchColumn();
            $tc[$s] = $cnt;
            $cr = $pdo->query("SHOW CREATE TABLE `{$s}`")->fetch();
            if ($cr) gzwrite($fp, "\n-- {$s} ({$cnt})\nDROP TABLE IF EXISTS `{$s}`;\n{$cr['Create Table']};\n\n");
            if ($cnt > 0) {
                $off = 0;
                while (1) {
                    $rows = $pdo->query("SELECT * FROM `{$s}` LIMIT 200 OFFSET {$off}")->fetchAll(PDO::FETCH_ASSOC);
                    if (!$rows) break;
                    $cs = array_map(fn($c) => '`' . preg_replace('/[^a-zA-Z0-9_]/', '', $c) . '`', array_keys($rows[0]));
                    $vl = [];
                    foreach ($rows as $row) {
                        $p2 = [];
                        foreach (array_values($row) as $v) {
                            if ($v === null) $p2[] = 'NULL';
                            elseif (is_numeric($v)) $p2[] = (string)$v;
                            else $p2[] = $pdo->quote((string)$v);
                        }
                        $vl[] = '(' . implode(',', $p2) . ')';
                    }
                    gzwrite($fp, "INSERT INTO `{$s}` (" . implode(',', $cs) . ") VALUES\n");
                    gzwrite($fp, implode(",\n", $vl) . ";\n");
                    $off += 200;
                    if (count($rows) < 200) break;
                }
            }
        }
        gzwrite($fp, "\nSET FOREIGN_KEY_CHECKS=1;\n");
        gzclose($fp);
        $fsz = filesize("{$bd}/{$fn}");
        echo json_encode(['ok' => true, 'filename' => $fn, 'size_bytes' => $fsz, 'size_human' => round($fsz / 1048576, 2) . ' MB', 'tables' => $tc]);
        break;

    // ── P0 CEO DIRECTIVE: Repro ───────────────────────────────────────────────
    case 'p0_repro':
        $bills = $db->fetchAll("
            SELECT b.id, b.bill_name AS title, b.store_id, b.vendor_id, b.category,
                   b.due_date, b.amount, b.repeat_rule,
                   COALESCE(s.name,'N/A') AS store_name,
                   COALESCE(v.name,'N/A') AS vendor_name,
                   b.status, b.is_paid
            FROM bills b
            LEFT JOIN stores s ON s.id = b.store_id
            LEFT JOIN vendors v ON v.id = b.vendor_id
            WHERE (b.is_archived = 0 OR b.is_archived IS NULL)
            ORDER BY b.store_id, b.due_date, b.bill_name
        ");
        $eG = [];
        foreach ($bills as $b) {
            $k = strtolower(trim($b['title'] ?? '')) . '|' . ($b['store_id'] ?? '') . '|' . ($b['due_date'] ?? '');
            $eG[$k][] = $b;
        }
        $eD = array_filter($eG, fn($g) => count($g) > 1);
        $sG = [];
        foreach ($bills as $b) {
            $k = strtolower(trim($b['title'] ?? '')) . '|' . ($b['store_id'] ?? '') . '|' . ($b['amount'] ?? '');
            $sG[$k][] = $b;
        }
        $sD = array_filter($sG, fn($g) => count($g) > 1);
        echo json_encode([
            'active_bills' => count($bills),
            'bill_exact_duplicates' => ['groups' => count($eD), 'records' => array_sum(array_map('count', $eD))],
            'bill_soft_duplicates' => ['groups' => count($sD), 'records' => array_sum(array_map('count', $sD)), 'samples' => array_slice(array_values($sD), 0, 8)],
        ]);
        break;

    // ── P0 CEO DIRECTIVE: Cleanup ─────────────────────────────────────────────
    case 'p0_cleanup':
        $pdo = $db->getConnection();
        $pdo->beginTransaction();
        $log = ['ba' => 0, 'bk' => 0, 'ta' => 0, 'tk' => 0, 'pa' => 0, 'gp' => 0, 'err' => []];
        try {
            $bills = $db->fetchAll("
                SELECT b.*, COALESCE(s.name,'N/A') AS store_name
                FROM bills b LEFT JOIN stores s ON s.id = b.store_id
                WHERE (b.is_archived = 0 OR b.is_archived IS NULL)
            ");
            $gr = [];
            foreach ($bills as $b) {
                $k = implode('|', [strtolower(trim($b['bill_name'] ?? '')), ($b['store_id'] ?? ''), ($b['due_date'] ?? ''), ($b['amount'] ?? ''), ($b['repeat_rule'] ?? '')]);
                $gr[$k][] = $b;
            }
            foreach ($gr as $k => $g) {
                $log['gp']++;
                if (count($g) <= 1) { $log['bk']++; continue; }
                $can = $g[0];
                $dps = array_slice($g, 1);
                foreach ($dps as $d) {
                    $id = (int)$d['id'];
                    try {
                        $pdo->exec("UPDATE bills SET is_archived=1, status='archived_duplicate', updated_at=NOW() WHERE id={$id}");
                        $pdo->exec("INSERT INTO audit_logs(module,action,record_type,record_id,user_id,note,created_at) VALUES('bills','archive_duplicate','bill',{$id},1,'P0 CEO: archived duplicate of bill#{$can['id']}|{$can['bill_name']}|{$can['store_name']}',NOW())");
                        $log['ba']++;
                    } catch (\Throwable $e) {
                        $log['err'][] = "b:{$id} " . $e->getMessage();
                    }
                }
                $log['bk']++;
            }
            // Tasks
            if ($db->tableExists('tasks')) {
                $tasks = $db->fetchAll("SELECT t.*, COALESCE(s.name,'N/A') AS store_name FROM tasks t LEFT JOIN stores s ON s.id=t.store_id WHERE t.deleted_at IS NULL AND (t.archived_duplicate=0 OR t.archived_duplicate IS NULL)");
                $tG = [];
                foreach ($tasks as $t) {
                    $tG[strtolower(trim($t['title'] ?? '')) . '|' . ($t['store_id'] ?? '') . '|' . ($t['due_date'] ?? '')][] = $t;
                }
                foreach ($tG as $k => $g) {
                    if (count($g) <= 1) { $log['tk']++; continue; }
                    $can = $g[0];
                    $dps = array_slice($g, 1);
                    foreach ($dps as $d) {
                        $id = (int)$d['id'];
                        try {
                            if ($db->columnExists('tasks', 'archived_duplicate'))
                                $pdo->exec("UPDATE tasks SET archived_duplicate=1, duplicate_reason='P0_cleanup' WHERE id={$id}");
                            else
                                $pdo->exec("UPDATE tasks SET deleted_at=NOW() WHERE id={$id}");
                            $pdo->exec("INSERT INTO audit_logs(module,action,record_type,record_id,user_id,note,created_at) VALUES('tasks','archive_duplicate','task',{$id},1,'P0 CEO: archived duplicate of task#{$can['id']}|{$can['title']}',NOW())");
                            $log['ta']++;
                        } catch (\Throwable $e) {
                            $log['err'][] = "t:{$id} " . $e->getMessage();
                        }
                    }
                    $log['tk']++;
                }
            }
            $pdo->commit();
            echo json_encode(['ok' => true, 'log' => $log]);
        } catch (\Throwable $e) {
            $pdo->rollBack();
            echo json_encode(['ok' => false, 'error' => $e->getMessage(), 'log' => $log]);
        }
        break;

    // ── P0 CEO DIRECTIVE: Penalty Reset ───────────────────────────────────────
    case 'p0_penalty_reset':
        $pdo = $db->getConnection();
        $pdo->beginTransaction();
        $log = ['penalties' => 0, 'penalty_log' => 0, 'penalty_assessments' => 0, 'task_penalties' => 0, 'users_reset' => 0];
        try {
            if ($db->tableExists('penalties')) {
                $log['penalties'] = (int)$pdo->query("SELECT COUNT(*) FROM penalties")->fetchColumn();
                if ($db->columnExists('penalties', 'status'))
                    $pdo->exec("UPDATE penalties SET status='reset', updated_at=NOW() WHERE status!='reset'");
                elseif ($db->columnExists('penalties', 'is_archived'))
                    $pdo->exec("UPDATE penalties SET is_archived=1 WHERE is_archived=0");
                else $pdo->exec("DELETE FROM penalties");
            }
            if ($db->tableExists('penalty_log')) {
                $log['penalty_log'] = (int)$pdo->query("SELECT COUNT(*) FROM penalty_log")->fetchColumn();
                if ($db->columnExists('penalty_log', 'archived_at'))
                    $pdo->exec("UPDATE penalty_log SET archived_at=NOW() WHERE archived_at IS NULL");
                else $pdo->exec("DELETE FROM penalty_log");
            }
            if ($db->tableExists('penalty_assessments')) {
                $log['penalty_assessments'] = (int)$pdo->query("SELECT COUNT(*) FROM penalty_assessments")->fetchColumn();
                if ($db->columnExists('penalty_assessments', 'is_archived'))
                    $pdo->exec("UPDATE penalty_assessments SET is_archived=1 WHERE is_archived=0");
                else $pdo->exec("DELETE FROM penalty_assessments");
            }
            if ($db->tableExists('task_penalties')) {
                $log['task_penalties'] = (int)$pdo->query("SELECT COUNT(*) FROM task_penalties")->fetchColumn();
                if ($db->columnExists('task_penalties', 'is_archived'))
                    $pdo->exec("UPDATE task_penalties SET is_archived=1 WHERE is_archived=0");
                else $pdo->exec("DELETE FROM task_penalties");
            }
            if ($db->tableExists('penalty_appeals')) $pdo->exec("DELETE FROM penalty_appeals");
            if ($db->tableExists('penalty_comments')) $pdo->exec("DELETE FROM penalty_comments");
            if ($db->tableExists('users')) {
                $sets = [];
                if ($db->columnExists('users', 'total_penalties')) $sets[] = "total_penalties=0";
                if ($db->columnExists('users', 'total_penalty_amount')) $sets[] = "total_penalty_amount=0";
                if ($db->columnExists('users', 'penalty_count')) $sets[] = "penalty_count=0";
                if ($db->columnExists('users', 'last_penalty_at')) $sets[] = "last_penalty_at=NULL";
                if ($sets) {
                    $pdo->exec("UPDATE users SET " . implode(',', $sets) . " WHERE total_penalties>0 OR penalty_count>0");
                    $log['users_reset'] = (int)$pdo->query("SELECT ROW_COUNT()")->fetchColumn();
                }
            }
            if ($db->tableExists('penalty_daily_snapshots')) $pdo->exec("DELETE FROM penalty_daily_snapshots");
            $reason = "CEO requested full penalty reset before new penalty policy enforcement";
            if ($db->tableExists('audit_logs')) {
                $reasonEsc = $pdo->quote($reason);
                $pdo->exec("INSERT INTO audit_logs(module,action,record_type,record_id,user_id,note,created_at) VALUES('penalties','full_reset','system',0,1,{$reasonEsc},NOW())");
            }
            $pdo->commit();
            echo json_encode(['ok' => true, 'log' => $log, 'reason' => $reason]);
        } catch (\Throwable $e) {
            $pdo->rollBack();
            echo json_encode(['ok' => false, 'error' => $e->getMessage(), 'log' => $log]);
        }
        break;

    // ── P0 CEO DIRECTIVE: Verify ──────────────────────────────────────────────
    case 'p0_verify':
        $v = [];
        // Bill duplicates
        $bills = $db->fetchAll("SELECT b.id, b.bill_name AS t, b.store_id, b.due_date, b.amount, b.repeat_rule FROM bills b WHERE (b.is_archived=0 OR b.is_archived IS NULL)");
        $gr = [];
        foreach ($bills as $b) {
            $gr[implode('|', [strtolower(trim($b['t'] ?? '')), ($b['store_id'] ?? ''), ($b['due_date'] ?? ''), ($b['amount'] ?? ''), ($b['repeat_rule'] ?? '')])][] = $b;
        }
        $v['bill_dups'] = count(array_filter($gr, fn($g) => count($g) > 1));
        $v['active_bills'] = count($bills);
        // Task duplicates
        if ($db->tableExists('tasks')) {
            $tasks = $db->fetchAll("SELECT t.id, t.title, t.store_id, t.due_date FROM tasks t WHERE t.deleted_at IS NULL AND (t.archived_duplicate=0 OR t.archived_duplicate IS NULL)");
            $tG = [];
            foreach ($tasks as $t) {
                $tG[strtolower(trim($t['title'] ?? '')) . '|' . ($t['store_id'] ?? '') . '|' . ($t['due_date'] ?? '')][] = $t;
            }
            $v['task_dups'] = count(array_filter($tG, fn($g) => count($g) > 1));
            $v['active_tasks'] = count($tasks);
        }
        // Penalty counts
        $pdo = $db->getConnection();
        $v['penalties_active'] = $db->tableExists('penalties') ? (int)$pdo->query("SELECT COUNT(*) FROM penalties WHERE status IS NULL OR (status != 'reset' AND status != '')")->fetchColumn() : 0;
        $v['penalty_log_active'] = $db->tableExists('penalty_log') ? (int)$pdo->query("SELECT COUNT(*) FROM penalty_log WHERE archived_at IS NULL")->fetchColumn() : 0;
        $v['pass'] = ($v['bill_dups'] === 0 && ($v['task_dups'] ?? 0) === 0);
        echo json_encode($v);
        break;

    case 'complete_tasks_over_9_days':
        $expectedKey = getenv('MI_SNAPSHOT_SECRET') ?: safety_read_env_value('MI_SNAPSHOT_SECRET');
        $providedKey = $_GET['key'] ?? '';
        if (!$expectedKey || !hash_equals($expectedKey, $providedKey)) {
            http_response_code(403);
            echo json_encode(['ok' => false, 'error' => 'Forbidden']);
            break;
        }

        $pdo = $db->getConnection();
        $mode = ($_GET['mode'] ?? 'dry-run') === 'execute' ? 'execute' : 'dry-run';
        $cutoff = $db->fetchColumn("SELECT DATE_SUB(CURDATE(), INTERVAL 9 DAY)");

        $targetSql = "
            SELECT id, title, status, due_date, is_completed, completed_at
            FROM tasks
            WHERE COALESCE(is_completed, 0) = 0
              AND due_date IS NOT NULL
              AND due_date < ?
              AND COALESCE(status, '') NOT IN ('done', 'completed', 'cancelled')
            ORDER BY due_date ASC, id ASC
            LIMIT 5000
        ";
        $targetTasks = $db->fetchAll($targetSql, [$cutoff]);

        if ($mode !== 'execute') {
            echo json_encode([
                'ok' => true,
                'mode' => 'dry-run',
                'cutoff' => $cutoff,
                'rule' => 'open tasks with due_date < cutoff, where cutoff = CURDATE() - 9 days',
                'tasks_to_complete' => count($targetTasks),
                'samples' => array_slice($targetTasks, 0, 30),
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
            break;
        }

        $backupDir = __DIR__ . '/backups';
        if (!is_dir($backupDir)) @mkdir($backupDir, 0755, true);
        $backupFile = 'TASKS_OVER_9_DAYS_COMPLETION_' . date('Y-m-d_H-i-s') . '.json';
        $backupPath = $backupDir . '/' . $backupFile;
        file_put_contents($backupPath, json_encode([
            'created_at' => date('c'),
            'cutoff' => $cutoff,
            'tasks' => $targetTasks,
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        $completed = 0;
        $pdo->beginTransaction();
        try {
            if (!empty($targetTasks)) {
                $targetIds = array_map(fn($row) => (int)$row['id'], $targetTasks);
                $placeholders = implode(',', array_fill(0, count($targetIds), '?'));
                $completed = $db->update(
                    "UPDATE tasks
                     SET is_completed = 1, status = 'done', completed_at = NOW(), updated_at = NOW()
                     WHERE id IN ({$placeholders})",
                    $targetIds
                );
            }

            if ($db->tableExists('audit_logs')) {
                $note = sprintf(
                    'Completed %d open tasks over 9 days old; cutoff %s; backup %s',
                    $completed,
                    $cutoff,
                    $backupFile
                );
                $db->insert(
                    "INSERT INTO audit_logs(module, action, record_type, record_id, user_id, note, created_at)
                     VALUES('tasks', 'complete_over_9_days', 'task', 0, 1, ?, NOW())",
                    [$note]
                );
            }

            $remaining = (int)$db->fetchColumn(
                "SELECT COUNT(*)
                 FROM tasks
                 WHERE COALESCE(is_completed, 0) = 0
                   AND due_date IS NOT NULL
                   AND due_date < ?
                   AND COALESCE(status, '') NOT IN ('done', 'completed', 'cancelled')",
                [$cutoff]
            );

            $pdo->commit();
            echo json_encode([
                'ok' => true,
                'mode' => 'execute',
                'cutoff' => $cutoff,
                'backup_file' => $backupFile,
                'completed_tasks' => $completed,
                'remaining_open_over_9_days' => $remaining,
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        } catch (\Throwable $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode([
                'ok' => false,
                'error' => $e->getMessage(),
                'backup_file' => $backupFile,
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        }
        break;

    case 'finance_task_maintenance_20260710':
        $expectedKey = getenv('MI_SNAPSHOT_SECRET') ?: safety_read_env_value('MI_SNAPSHOT_SECRET');
        $providedKey = $_GET['key'] ?? '';
        if (!$expectedKey || !hash_equals($expectedKey, $providedKey)) {
            http_response_code(403);
            echo json_encode(['ok' => false, 'error' => 'Forbidden']);
            break;
        }

        $payload = json_decode(file_get_contents('php://input') ?: '[]', true);
        if (!is_array($payload) || !isset($payload['tasks']) || !is_array($payload['tasks'])) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'Missing JSON payload.tasks']);
            break;
        }

        $pdo = $db->getConnection();
        $mode = ($_GET['mode'] ?? 'dry-run') === 'execute' ? 'execute' : 'dry-run';
        $today = $db->fetchColumn('SELECT CURDATE()');

        $nextMonthlyDate = static function (int $day) use ($today): string {
            $base = new DateTimeImmutable($today . ' 00:00:00');
            $year = (int)$base->format('Y');
            $month = (int)$base->format('n');
            for ($i = 0; $i < 24; $i++) {
                $candidateMonth = $month + $i;
                $candidateYear = $year + intdiv($candidateMonth - 1, 12);
                $normalizedMonth = (($candidateMonth - 1) % 12) + 1;
                $lastDay = (int)(new DateTimeImmutable(sprintf('%04d-%02d-01', $candidateYear, $normalizedMonth)))
                    ->modify('last day of this month')
                    ->format('j');
                $candidateDay = min($day, $lastDay);
                $candidate = DateTimeImmutable::createFromFormat(
                    '!Y-n-j',
                    $candidateYear . '-' . $normalizedMonth . '-' . $candidateDay
                );
                if ($candidate && $candidate->format('Y-m-d') > $today) {
                    return $candidate->format('Y-m-d');
                }
            }
            return $base->modify('+1 month')->format('Y-m-d');
        };

        $nextScheduledDate = static function (array $task) use ($today, $nextMonthlyDate): string {
            if (($task['repeat_type'] ?? '') === 'weekly' && isset($task['due_weekday'])) {
                $targetWeekday = max(0, min(6, (int)$task['due_weekday']));
                $base = new DateTimeImmutable($today . ' 00:00:00');
                for ($i = 1; $i <= 14; $i++) {
                    $candidate = $base->modify('+' . $i . ' days');
                    if ((int)$candidate->format('w') === $targetWeekday) {
                        return $candidate->format('Y-m-d');
                    }
                }
            }

            $day = max(1, min(31, (int)($task['due_day'] ?? 1)));
            $months = $task['due_months'] ?? null;
            if (!is_array($months) || empty($months)) {
                return $nextMonthlyDate($day);
            }

            $base = new DateTimeImmutable($today . ' 00:00:00');
            $year = (int)$base->format('Y');
            $normalizedMonths = array_values(array_unique(array_map('intval', $months)));
            sort($normalizedMonths);
            for ($offsetYear = 0; $offsetYear < 5; $offsetYear++) {
                foreach ($normalizedMonths as $month) {
                    if ($month < 1 || $month > 12) continue;
                    $candidateYear = $year + $offsetYear;
                    $lastDay = (int)(new DateTimeImmutable(sprintf('%04d-%02d-01', $candidateYear, $month)))
                        ->modify('last day of this month')
                        ->format('j');
                    $candidateDay = min($day, $lastDay);
                    $candidate = DateTimeImmutable::createFromFormat(
                        '!Y-n-j',
                        $candidateYear . '-' . $month . '-' . $candidateDay
                    );
                    if ($candidate && $candidate->format('Y-m-d') > $today) {
                        return $candidate->format('Y-m-d');
                    }
                }
            }
            return $base->modify('+3 months')->format('Y-m-d');
        };

        $admin = $db->fetch(
            "SELECT id FROM users WHERE email = ? ORDER BY id ASC LIMIT 1",
            ['liem.dt0208@gmail.com']
        ) ?: $db->fetch("SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1")
          ?: $db->fetch("SELECT id FROM users ORDER BY id ASC LIMIT 1");

        if (!$admin) {
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => 'No user found for task ownership']);
            break;
        }
        $adminId = (int)$admin['id'];

        $resolveAssignee = static function (array $task) use ($db, $adminId): array {
            if (!empty($task['assignee_id'])) {
                $user = $db->fetch(
                    "SELECT id, name, email FROM users WHERE id = ? LIMIT 1",
                    [(int)$task['assignee_id']]
                );
                if ($user) {
                    return ['id' => (int)$user['id'], 'name' => $user['name'] ?? null, 'email' => $user['email'] ?? null, 'found' => true];
                }
            }

            if (!empty($task['assignee_email'])) {
                $user = $db->fetch(
                    "SELECT id, name, email FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM(?)) LIMIT 1",
                    [$task['assignee_email']]
                );
                if ($user) {
                    return ['id' => (int)$user['id'], 'name' => $user['name'] ?? null, 'email' => $user['email'] ?? null, 'found' => true];
                }
            }

            if (!empty($task['assignee_name'])) {
                $user = $db->fetch(
                    "SELECT id, name, email FROM users WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) ORDER BY id ASC LIMIT 1",
                    [$task['assignee_name']]
                );
                if (!$user) {
                    $like = '%' . trim((string)$task['assignee_name']) . '%';
                    $user = $db->fetch(
                        "SELECT id, name, email FROM users WHERE name LIKE ? ORDER BY id ASC LIMIT 1",
                        [$like]
                    );
                }
                if ($user) {
                    return ['id' => (int)$user['id'], 'name' => $user['name'] ?? null, 'email' => $user['email'] ?? null, 'found' => true];
                }
                return ['id' => $adminId, 'name' => null, 'email' => null, 'found' => false, 'requested' => $task['assignee_name']];
            }

            $user = $db->fetch("SELECT id, name, email FROM users WHERE id = ? LIMIT 1", [$adminId]);
            return ['id' => $adminId, 'name' => $user['name'] ?? 'admin', 'email' => $user['email'] ?? null, 'found' => true];
        };

        $financeProject = $db->fetch(
            "SELECT id, name FROM projects WHERE LOWER(TRIM(name)) = 'finance' ORDER BY id ASC LIMIT 1"
        );

        $projectWouldBeCreated = !$financeProject;
        $projectId = $financeProject ? (int)$financeProject['id'] : null;
        $sectionId = null;

        if ($projectId) {
            $section = $db->fetch(
                "SELECT id FROM sections WHERE project_id = ? ORDER BY position ASC, id ASC LIMIT 1",
                [$projectId]
            );
            $sectionId = $section ? (int)$section['id'] : null;
        }

        $actions = [];
        foreach ($payload['tasks'] as $task) {
            if (!is_array($task) || empty($task['title'])) {
                continue;
            }

            $storeId = null;
            if (!empty($task['store_name'])) {
                $store = $db->fetch(
                    "SELECT id, name FROM stores WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1",
                    [$task['store_name']]
                );
                if ($store) {
                    $storeId = (int)$store['id'];
                }
            }

            $dueDate = $nextScheduledDate($task);
            $assignee = $resolveAssignee($task);
            $existing = null;
            if (!empty($task['existing_task_id'])) {
                $existing = $db->fetch(
                    "SELECT id, title, due_date, status, is_completed
                     FROM tasks
                     WHERE id = ?
                       AND project_id = ?
                       AND COALESCE(is_completed, 0) = 0
                     LIMIT 1",
                    [(int)$task['existing_task_id'], $projectId]
                );
            }
            if (!$existing && $projectId) {
                $existing = $db->fetch(
                    "SELECT id, title, due_date, status, is_completed
                     FROM tasks
                     WHERE project_id = ?
                       AND LOWER(TRIM(title)) = LOWER(TRIM(?))
                       AND COALESCE(is_completed, 0) = 0
                     ORDER BY due_date DESC, id DESC
                     LIMIT 1",
                    [$projectId, $task['title']]
                );
            }

            $actions[] = [
                'key' => $task['key'] ?? null,
                'title' => $task['title'],
                'action' => $existing ? 'update' : 'create',
                'existing_task_id' => $existing['id'] ?? null,
                'due_date' => $dueDate,
                'repeat_type' => $task['repeat_type'] ?? 'none',
                'repeat_config' => $task['repeat_config'] ?? null,
                'store_id' => $storeId,
                'store_name' => $task['store_name'] ?? null,
                'category' => $task['task_category'] ?? null,
                'assignee_id' => $assignee['id'],
                'assignee_name' => $assignee['name'] ?? null,
                'assignee_found' => $assignee['found'],
                'assignee_requested' => $assignee['requested'] ?? null,
            ];
        }

        if ($mode !== 'execute') {
            echo json_encode([
                'ok' => true,
                'mode' => 'dry-run',
                'today' => $today,
                'project' => [
                    'id' => $projectId,
                    'name' => $financeProject['name'] ?? 'Finance',
                    'would_create' => $projectWouldBeCreated,
                ],
                'actions' => $actions,
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
            break;
        }

        $pdo->beginTransaction();
        try {
            if (!$projectId) {
                $projectId = (int)$db->insert(
                    "INSERT INTO projects (name, description, color, owner_id, status)
                     VALUES (?, ?, ?, ?, 'active')",
                    ['Finance', 'Recurring finance, tax, insurance, and payment tasks.', '#2563EB', $adminId]
                );
                if ($db->tableExists('project_members')) {
                    $db->insert(
                        "INSERT IGNORE INTO project_members (project_id, user_id, role) VALUES (?, ?, 'owner')",
                        [$projectId, $adminId]
                    );
                }
                $sectionId = (int)$db->insert(
                    "INSERT INTO sections (project_id, name, position) VALUES (?, 'To Do', 0)",
                    [$projectId]
                );
                $db->insert(
                    "INSERT INTO sections (project_id, name, position) VALUES (?, 'In Progress', 1)",
                    [$projectId]
                );
                $db->insert(
                    "INSERT INTO sections (project_id, name, position) VALUES (?, 'Done', 2)",
                    [$projectId]
                );
            } elseif (!$sectionId) {
                $sectionId = (int)$db->insert(
                    "INSERT INTO sections (project_id, name, position) VALUES (?, 'To Do', 0)",
                    [$projectId]
                );
            }

            $results = [];
            foreach ($payload['tasks'] as $task) {
                if (!is_array($task) || empty($task['title'])) {
                    continue;
                }

                $storeId = null;
                if (!empty($task['store_name'])) {
                    $store = $db->fetch(
                        "SELECT id, name FROM stores WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1",
                        [$task['store_name']]
                    );
                    if ($store) {
                        $storeId = (int)$store['id'];
                    }
                }

                $dueDate = $nextScheduledDate($task);
                $assignee = $resolveAssignee($task);
                if ($db->tableExists('project_members') && !empty($assignee['id'])) {
                    $db->insert(
                        "INSERT IGNORE INTO project_members (project_id, user_id, role) VALUES (?, ?, 'member')",
                        [$projectId, (int)$assignee['id']]
                    );
                }
                $repeatType = $task['repeat_type'] ?? 'none';
                $repeatConfig = isset($task['repeat_config'])
                    ? json_encode($task['repeat_config'], JSON_UNESCAPED_SLASHES)
                    : null;
                $visibility = $task['visibility'] ?? 'private';

                $existing = null;
                if (!empty($task['existing_task_id'])) {
                    $existing = $db->fetch(
                        "SELECT id
                         FROM tasks
                         WHERE id = ?
                           AND project_id = ?
                           AND COALESCE(is_completed, 0) = 0
                         LIMIT 1",
                        [(int)$task['existing_task_id'], $projectId]
                    );
                }
                if (!$existing) {
                    $existing = $db->fetch(
                        "SELECT id
                         FROM tasks
                         WHERE project_id = ?
                           AND LOWER(TRIM(title)) = LOWER(TRIM(?))
                           AND COALESCE(is_completed, 0) = 0
                         ORDER BY due_date DESC, id DESC
                         LIMIT 1",
                        [$projectId, $task['title']]
                    );
                }

                if ($existing) {
                    $sets = [
                        'title = ?',
                        'description = ?',
                        'notes = ?',
                        'assignee_id = ?',
                        'priority = ?',
                        'status = ?',
                        'due_date = ?',
                        'section_id = ?',
                        'repeat_type = ?',
                        'repeat_config = ?',
                        'repeat_from_mode = ?',
                        'repeat_end_type = ?',
                        'updated_at = NOW()',
                    ];
                    $params = [
                        $task['title'],
                        $task['description'] ?? '',
                        $task['notes'] ?? null,
                        $assignee['id'],
                        $task['priority'] ?? 'medium',
                        'todo',
                        $dueDate,
                        $sectionId,
                        $repeatType,
                        $repeatConfig,
                        $task['repeat_from_mode'] ?? 'due_date',
                        $task['repeat_end_type'] ?? 'never',
                    ];
                    if ($db->columnExists('tasks', 'visibility')) {
                        $sets[] = 'visibility = ?';
                        $params[] = $task['visibility'] ?? 'private';
                    }
                    if ($db->columnExists('tasks', 'private_by_user_id')) {
                        $sets[] = 'private_by_user_id = ?';
                        $params[] = $visibility === 'public' ? null : $adminId;
                    }
                    if ($db->columnExists('tasks', 'direct_store_id')) {
                        $sets[] = 'direct_store_id = ?';
                        $params[] = $storeId;
                    }
                    if ($db->columnExists('tasks', 'task_category')) {
                        $sets[] = 'task_category = ?';
                        $params[] = $task['task_category'] ?? 'other';
                    }
                    $params[] = (int)$existing['id'];
                    $db->update("UPDATE tasks SET " . implode(', ', $sets) . " WHERE id = ?", $params);
                    $results[] = ['action' => 'updated', 'task_id' => (int)$existing['id'], 'title' => $task['title'], 'due_date' => $dueDate];
                    continue;
                }

                $fields = ['project_id', 'section_id', 'title', 'description', 'notes', 'assignee_id', 'priority', 'status', 'due_date', 'created_by', 'repeat_type', 'repeat_config', 'repeat_from_mode', 'repeat_end_type'];
                $placeholders = array_fill(0, count($fields), '?');
                $params = [
                    $projectId,
                    $sectionId,
                    $task['title'],
                    $task['description'] ?? '',
                    $task['notes'] ?? null,
                    $assignee['id'],
                    $task['priority'] ?? 'medium',
                    'todo',
                    $dueDate,
                    $adminId,
                    $repeatType,
                    $repeatConfig,
                    $task['repeat_from_mode'] ?? 'due_date',
                    $task['repeat_end_type'] ?? 'never',
                ];
                if ($db->columnExists('tasks', 'accepted_at')) {
                    $fields[] = 'accepted_at';
                    $placeholders[] = '?';
                    $params[] = date('Y-m-d H:i:s');
                }
                if ($db->columnExists('tasks', 'visibility')) {
                    $fields[] = 'visibility';
                    $placeholders[] = '?';
                    $params[] = $visibility;
                }
                if ($db->columnExists('tasks', 'private_by_user_id')) {
                    $fields[] = 'private_by_user_id';
                    $placeholders[] = '?';
                    $params[] = $visibility === 'public' ? null : $adminId;
                }
                if ($db->columnExists('tasks', 'direct_store_id')) {
                    $fields[] = 'direct_store_id';
                    $placeholders[] = '?';
                    $params[] = $storeId;
                }
                if ($db->columnExists('tasks', 'task_category')) {
                    $fields[] = 'task_category';
                    $placeholders[] = '?';
                    $params[] = $task['task_category'] ?? 'other';
                }

                $taskId = (int)$db->insert(
                    "INSERT INTO tasks (" . implode(', ', $fields) . ") VALUES (" . implode(', ', $placeholders) . ")",
                    $params
                );
                $results[] = ['action' => 'created', 'task_id' => $taskId, 'title' => $task['title'], 'due_date' => $dueDate];
            }

            if ($db->tableExists('audit_logs')) {
                $db->insert(
                    "INSERT INTO audit_logs(module, action, record_type, record_id, user_id, note, created_at)
                     VALUES('tasks', 'finance_task_maintenance', 'project', ?, ?, ?, NOW())",
                    [$projectId, $adminId, 'Created/updated recurring Finance tasks from 2026-07-10 request']
                );
            }

            $pdo->commit();
            echo json_encode([
                'ok' => true,
                'mode' => 'execute',
                'project_id' => $projectId,
                'results' => $results,
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        } catch (\Throwable $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => $e->getMessage()], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        }
        break;

    case 'finance_calendar_maintenance_20260710':
        $expectedKey = getenv('MI_SNAPSHOT_SECRET') ?: safety_read_env_value('MI_SNAPSHOT_SECRET');
        $providedKey = $_GET['key'] ?? '';
        if (!$expectedKey || !hash_equals($expectedKey, $providedKey)) {
            http_response_code(403);
            echo json_encode(['ok' => false, 'error' => 'Forbidden']);
            break;
        }

        $mode = ($_GET['mode'] ?? 'dry-run') === 'execute' ? 'execute' : 'dry-run';
        $pdo = $db->getConnection();
        $today = $db->fetchColumn('SELECT CURDATE()');
        $currentYear = (int)substr($today, 0, 4);
        $currentMonth = (int)substr($today, 5, 2);
        $dueDateForDay = static function (int $day) use ($currentYear, $currentMonth): string {
            $lastDay = (int)(new DateTimeImmutable(sprintf('%04d-%02d-01', $currentYear, $currentMonth)))
                ->modify('last day of this month')
                ->format('j');
            return sprintf('%04d-%02d-%02d', $currentYear, $currentMonth, min($day, $lastDay));
        };

        $stores = $db->fetchAll("SELECT id, name FROM stores WHERE COALESCE(is_active, 1) = 1 ORDER BY name ASC") ?: [];
        $storeByName = [];
        foreach ($stores as $store) {
            $storeByName[strtolower(trim((string)$store['name']))] = $store;
        }
        $findStore = static function (string $needle) use ($stores) {
            $needle = strtolower(trim($needle));
            foreach ($stores as $store) {
                if (strtolower(trim((string)$store['name'])) === $needle) return $store;
            }
            foreach ($stores as $store) {
                if (str_contains(strtolower((string)$store['name']), $needle)) return $store;
            }
            return null;
        };

        $billSpecs = [];
        foreach ($stores as $store) {
            $billSpecs[] = [
                'store_id' => (int)$store['id'],
                'title' => 'Rent',
                'vendor' => 'Landlord',
                'category' => 'rent',
                'due_date' => $dueDateForDay(1),
                'repeat_day' => 1,
                'note' => 'Monthly rent placeholder. Amount/account detail to be filled by admin.',
            ];
        }

        $raw = $findStore('Raw Stockton');
        if ($raw) {
            $billSpecs[] = [
                'store_id' => (int)$raw['id'],
                'title' => 'Raw Stockton Water',
                'vendor' => 'City of Stockton',
                'category' => 'water',
                'due_date' => $dueDateForDay(20),
                'repeat_day' => 20,
                'note' => 'Pay/check at https://egov.stocktonca.gov/Click2GovCX/index.html',
            ];
            $billSpecs[] = [
                'store_id' => (int)$raw['id'],
                'title' => 'Raw Stockton PGE',
                'vendor' => 'PG&E',
                'category' => 'electronic',
                'due_date' => $dueDateForDay(20),
                'repeat_day' => 20,
                'note' => 'Monthly electric bill.',
            ];
            $billSpecs[] = [
                'store_id' => (int)$raw['id'],
                'title' => 'Raw Stockton WM Trash',
                'vendor' => 'WM',
                'category' => 'trash',
                'due_date' => $dueDateForDay(20),
                'repeat_day' => 20,
                'note' => 'Pay/check at https://www.wm.com/us/en/mywm/locate?redirect=/us/en/mywm',
            ];
        }

        foreach (['Bakudan - The Rim (B1)', 'Bakudan - Stone Oak (B2)', 'Bakudan - Bandera (B3)'] as $name) {
            $store = $findStore($name);
            if (!$store) continue;
            $code = preg_match('/\((B\d)\)/', (string)$store['name'], $m) ? $m[1] : (string)$store['name'];
            $billSpecs[] = [
                'store_id' => (int)$store['id'],
                'title' => $code . ' CPS Electric',
                'vendor' => 'CPS Energy',
                'category' => 'electronic',
                'due_date' => $dueDateForDay(20),
                'repeat_day' => 20,
                'note' => 'Monthly CPS electric bill.',
            ];
        }

        $actions = [];
        foreach ($billSpecs as $spec) {
            $existing = $db->fetch(
                "SELECT id, title, category, vendor, due_date, status
                 FROM bills
                 WHERE store_id = ?
                   AND LOWER(TRIM(title)) = LOWER(TRIM(?))
                   AND due_date = ?
                 LIMIT 1",
                [$spec['store_id'], $spec['title'], $spec['due_date']]
            );
            $actions[] = [
                'type' => 'bill',
                'action' => $existing ? 'update' : 'create',
                'id' => $existing['id'] ?? null,
                'store_id' => $spec['store_id'],
                'title' => $spec['title'],
                'category' => $spec['category'],
                'due_date' => $spec['due_date'],
            ];
        }

        $openTasks = $db->fetchAll(
            "SELECT id, title, description, notes, direct_store_id
             FROM tasks
             WHERE COALESCE(is_completed, 0) = 0
               AND COALESCE(status, '') NOT IN ('completed', 'done', 'cancelled')"
        ) ?: [];
        $aliasMap = [];
        foreach ($stores as $store) {
            $aliases = [strtolower((string)$store['name'])];
            $name = strtolower((string)$store['name']);
            $baseName = trim(preg_replace('/\s*\([^)]*\)\s*/', '', $name));
            if ($baseName !== '' && !in_array($baseName, ['bakudan'], true)) {
                $aliases[] = $baseName;
            }
            if (str_contains($baseName, ' - ')) {
                $tail = trim(substr($baseName, strrpos($baseName, ' - ') + 3));
                if ($tail !== '') {
                    $aliases[] = $tail;
                }
            }
            if (preg_match('/\(([^)]+)\)/', (string)$store['name'], $m)) {
                $aliases[] = strtolower($m[1]);
            }
            if (str_contains(strtolower((string)$store['name']), 'raw stockton')) {
                $aliases[] = 'raw';
            }
            $aliasMap[(int)$store['id']] = array_values(array_unique(array_filter($aliases)));
        }

        $taskTagActions = [];
        foreach ($openTasks as $task) {
            if (!empty($task['direct_store_id'])) {
                continue;
            }
            $haystack = strtolower(trim($task['title'] ?? ''));
            $matchedStoreIds = [];
            foreach ($aliasMap as $storeId => $aliases) {
                foreach ($aliases as $alias) {
                    $pattern = '/(^|[^a-z0-9])' . preg_quote($alias, '/') . '([^a-z0-9]|$)/i';
                    if (preg_match($pattern, $haystack)) {
                        $matchedStoreIds[] = $storeId;
                        break;
                    }
                }
            }
            $matchedStoreIds = array_values(array_unique($matchedStoreIds));
            $matchedStoreId = count($matchedStoreIds) === 1 ? $matchedStoreIds[0] : null;
            if ($matchedStoreId && (int)($task['direct_store_id'] ?? 0) !== $matchedStoreId) {
                $taskTagActions[] = [
                    'task_id' => (int)$task['id'],
                    'title' => $task['title'],
                    'old_store_id' => $task['direct_store_id'] ? (int)$task['direct_store_id'] : null,
                    'new_store_id' => $matchedStoreId,
                ];
            }
        }

        $overdueAudit = $db->fetchAll(
            "SELECT COALESCE(s.name, '(no store)') AS store_name,
                    COALESCE(p.name, '(no project)') AS project_name,
                    COUNT(*) AS overdue_count
             FROM tasks t
             LEFT JOIN projects p ON p.id = t.project_id
             LEFT JOIN stores s ON s.id = COALESCE(t.direct_store_id, p.store_id)
             WHERE COALESCE(t.is_completed, 0) = 0
               AND COALESCE(t.status, '') NOT IN ('completed', 'done', 'cancelled')
               AND t.due_date < CURDATE()
             GROUP BY store_name, project_name
             ORDER BY overdue_count DESC, store_name ASC
             LIMIT 20"
        ) ?: [];
        $overdueTotal = (int)$db->fetchColumn(
            "SELECT COUNT(*)
             FROM tasks
             WHERE COALESCE(is_completed, 0) = 0
               AND COALESCE(status, '') NOT IN ('completed', 'done', 'cancelled')
               AND due_date < CURDATE()"
        );

        if ($mode !== 'execute') {
            echo json_encode([
                'ok' => true,
                'mode' => 'dry-run',
                'bill_actions' => $actions,
                'task_store_tag_actions' => $taskTagActions,
                'operations_overdue_total' => $overdueTotal,
                'operations_overdue_breakdown' => $overdueAudit,
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
            break;
        }

        $pdo->beginTransaction();
        try {
            $billResults = [];
            foreach ($billSpecs as $spec) {
                $existing = $db->fetch(
                    "SELECT id FROM bills
                     WHERE store_id = ?
                       AND LOWER(TRIM(title)) = LOWER(TRIM(?))
                       AND due_date = ?
                     LIMIT 1",
                    [$spec['store_id'], $spec['title'], $spec['due_date']]
                );

                $status = $spec['due_date'] < $today ? 'overdue' : 'pending';
                if ($existing) {
                    $sets = [
                        'title = ?',
                        'vendor = ?',
                        'amount = ?',
                        'due_date = ?',
                        'status = ?',
                        'note = ?',
                        'category = ?',
                        'repeat_type = ?',
                        'repeat_interval = ?',
                        'repeat_day = ?',
                        'updated_at = NOW()',
                    ];
                    $params = [
                        $spec['title'],
                        $spec['vendor'],
                        null,
                        $spec['due_date'],
                        $status,
                        $spec['note'],
                        $spec['category'],
                        'monthly',
                        1,
                        $spec['repeat_day'],
                    ];
                    if ($db->columnExists('bills', 'is_template')) {
                        $sets[] = 'is_template = ?';
                        $params[] = 1;
                    }
                    $params[] = (int)$existing['id'];
                    $db->update("UPDATE bills SET " . implode(', ', $sets) . " WHERE id = ?", $params);
                    $billResults[] = ['action' => 'updated', 'id' => (int)$existing['id'], 'title' => $spec['title']];
                } else {
                    $fields = ['store_id', 'title', 'vendor', 'amount', 'due_date', 'status', 'note', 'category', 'repeat_type', 'repeat_interval', 'repeat_day', 'created_by', 'created_at'];
                    $values = ['?', '?', '?', '?', '?', '?', '?', '?', '?', '?', '?', '?', 'NOW()'];
                    $params = [$spec['store_id'], $spec['title'], $spec['vendor'], null, $spec['due_date'], $status, $spec['note'], $spec['category'], 'monthly', 1, $spec['repeat_day'], 1];
                    if ($db->columnExists('bills', 'is_template')) {
                        $fields[] = 'is_template';
                        $values[] = '?';
                        $params[] = 1;
                    }
                    $id = (int)$db->insert("INSERT INTO bills (" . implode(', ', $fields) . ") VALUES (" . implode(', ', $values) . ")", $params);
                    $billResults[] = ['action' => 'created', 'id' => $id, 'title' => $spec['title']];
                }
            }

            $categoryUpdates = [
                ['electronic', '%PGE%'],
                ['electronic', '%CPS%'],
                ['water', '%Water%'],
                ['trash', '%Trash%'],
                ['trash', '%WM%'],
            ];
            foreach ($categoryUpdates as [$category, $needle]) {
                $db->update(
                    "UPDATE bills SET category = ?, updated_at = NOW()
                     WHERE (title LIKE ? OR vendor LIKE ?)
                       AND COALESCE(status, '') <> 'paid'",
                    [$category, $needle, $needle]
                );
            }

            $taskTagResults = [];
            foreach ($taskTagActions as $action) {
                $db->update(
                    "UPDATE tasks SET direct_store_id = ?, updated_at = NOW() WHERE id = ?",
                    [$action['new_store_id'], $action['task_id']]
                );
                $taskTagResults[] = $action;
            }

            if ($db->tableExists('audit_logs')) {
                $db->insert(
                    "INSERT INTO audit_logs(module, action, record_type, record_id, user_id, note, created_at)
                     VALUES('finance', 'calendar_maintenance', 'system', 0, 1, ?, NOW())",
                    ['Created/updated rent, water, electronic, trash bills and auto-tagged open tasks to stores from 2026-07-10 request']
                );
            }

            $pdo->commit();
            echo json_encode([
                'ok' => true,
                'mode' => 'execute',
                'bill_results' => $billResults,
                'task_store_tag_results' => $taskTagResults,
                'operations_overdue_total' => $overdueTotal,
                'operations_overdue_breakdown' => $overdueAudit,
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        } catch (\Throwable $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => $e->getMessage()], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        }
        break;

    case 'finance_store_prefix_maintenance_20260710':
        $expectedKey = getenv('MI_SNAPSHOT_SECRET') ?: safety_read_env_value('MI_SNAPSHOT_SECRET');
        $providedKey = $_GET['key'] ?? '';
        if (!$expectedKey || !hash_equals($expectedKey, $providedKey)) {
            http_response_code(403);
            echo json_encode(['ok' => false, 'error' => 'Forbidden']);
            break;
        }

        $mode = ($_GET['mode'] ?? 'dry-run') === 'execute' ? 'execute' : 'dry-run';
        $pdo = $db->getConnection();

        $stores = $db->fetchAll("SELECT id, name FROM stores WHERE COALESCE(is_active, 1) = 1 ORDER BY name ASC") ?: [];
        $prefixMap = [];
        foreach ($stores as $store) {
            $storeId = (int)$store['id'];
            $name = trim((string)$store['name']);
            $prefixMap[strtolower($name)] = ['id' => $storeId, 'name' => $name];
            $baseName = trim(preg_replace('/\s*\([^)]*\)\s*/', '', $name));
            if ($baseName !== '') {
                $prefixMap[strtolower($baseName)] = ['id' => $storeId, 'name' => $name];
            }
            if (preg_match('/\(([^)]+)\)/', $name, $m)) {
                $prefixMap[strtolower(trim($m[1]))] = ['id' => $storeId, 'name' => $name];
            }
            if (str_contains(strtolower($name), 'raw stockton')) {
                $prefixMap['raw'] = ['id' => $storeId, 'name' => $name];
                $prefixMap['raw stockton'] = ['id' => $storeId, 'name' => $name];
            }
            if (str_contains(strtolower($name), 'heo holding')) {
                $prefixMap['heo'] = ['id' => $storeId, 'name' => $name];
                $prefixMap['heo holding'] = ['id' => $storeId, 'name' => $name];
            }
            if (str_contains(strtolower($name), 'modesto')) {
                $prefixMap['raw modesto'] = ['id' => $storeId, 'name' => $name];
                $prefixMap['modesto'] = ['id' => $storeId, 'name' => $name];
            }
            if (str_contains(strtolower($name), 'copper')) {
                $prefixMap['copper'] = ['id' => $storeId, 'name' => $name];
            }
        }

        $financeProject = $db->fetch("SELECT id FROM projects WHERE LOWER(TRIM(name)) = 'finance' ORDER BY id ASC LIMIT 1");
        $financeProjectId = $financeProject ? (int)$financeProject['id'] : 0;
        $rows = $financeProjectId ? $db->fetchAll(
            "SELECT t.id, t.title, t.direct_store_id, s.name AS direct_store_name
             FROM tasks t
             LEFT JOIN stores s ON s.id = t.direct_store_id
             WHERE t.project_id = ?
               AND COALESCE(t.is_completed, 0) = 0
               AND COALESCE(t.status, '') NOT IN ('completed', 'done', 'cancelled')
             ORDER BY t.due_date ASC, t.id ASC",
            [$financeProjectId]
        ) : [];

        $actions = [];
        $invalidPrefixes = [];
        foreach ($rows as $row) {
            $title = trim((string)$row['title']);
            if (!preg_match('/^(.+?)\s+-\s+(.+)$/', $title, $m)) {
                continue;
            }
            $prefix = strtolower(trim($m[1]));
            $body = trim($m[2]);
            $match = $prefixMap[$prefix] ?? null;

            $removeFinancePrefix = false;
            if (!$match && $prefix === 'finance' && preg_match('/^heo\b/i', $body)) {
                $match = $prefixMap['heo'] ?? null;
                $newTitle = ($match['name'] ?? 'Heo Holding') . ' - ' . $body;
            } else {
                $newTitle = null;
            }

            if (!$match) {
                if ($prefix === 'finance') {
                    $actions[] = [
                        'task_id' => (int)$row['id'],
                        'old_title' => $title,
                        'new_title' => $body,
                        'old_store_id' => $row['direct_store_id'] ? (int)$row['direct_store_id'] : null,
                        'new_store_id' => $row['direct_store_id'] ? (int)$row['direct_store_id'] : null,
                        'new_store_name' => $row['direct_store_name'] ?? null,
                        'fix_title' => true,
                        'fix_store' => false,
                    ];
                    continue;
                }
                $invalidPrefixes[] = [
                    'task_id' => (int)$row['id'],
                    'title' => $title,
                    'prefix' => $m[1],
                    'direct_store_id' => $row['direct_store_id'] ? (int)$row['direct_store_id'] : null,
                    'direct_store_name' => $row['direct_store_name'] ?? null,
                ];
                continue;
            }

            $needsStore = (int)($row['direct_store_id'] ?? 0) !== (int)$match['id'];
            $needsTitle = $newTitle && $newTitle !== $title;
            if ($needsStore || $needsTitle) {
                $actions[] = [
                    'task_id' => (int)$row['id'],
                    'old_title' => $title,
                    'new_title' => $newTitle ?: $title,
                    'old_store_id' => $row['direct_store_id'] ? (int)$row['direct_store_id'] : null,
                    'new_store_id' => (int)$match['id'],
                    'new_store_name' => $match['name'],
                    'fix_title' => $needsTitle,
                    'fix_store' => $needsStore,
                ];
            }
        }

        if ($mode !== 'execute') {
            echo json_encode([
                'ok' => true,
                'mode' => 'dry-run',
                'actions' => $actions,
                'invalid_prefixes' => $invalidPrefixes,
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
            break;
        }

        $pdo->beginTransaction();
        try {
            foreach ($actions as $action) {
                $db->update(
                    "UPDATE tasks SET title = ?, direct_store_id = ?, updated_at = NOW() WHERE id = ?",
                    [$action['new_title'], $action['new_store_id'], $action['task_id']]
                );
            }
            if ($db->tableExists('audit_logs')) {
                $db->insert(
                    "INSERT INTO audit_logs(module, action, record_type, record_id, user_id, note, created_at)
                     VALUES('tasks', 'finance_store_prefix_maintenance', 'project', ?, 1, ?, NOW())",
                    [$financeProjectId, 'Aligned Finance task prefixes with store links from 2026-07-10 request']
                );
            }
            $pdo->commit();
            echo json_encode([
                'ok' => true,
                'mode' => 'execute',
                'results' => $actions,
                'invalid_prefixes' => $invalidPrefixes,
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        } catch (\Throwable $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => $e->getMessage()], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        }
        break;

    case 'monthly_task_type_audit_20260710':
        $expectedKey = getenv('MI_SNAPSHOT_SECRET') ?: safety_read_env_value('MI_SNAPSHOT_SECRET');
        $providedKey = $_GET['key'] ?? '';
        if (!$expectedKey || !hash_equals($expectedKey, $providedKey)) {
            http_response_code(403);
            echo json_encode(['ok' => false, 'error' => 'Forbidden']);
            break;
        }

        $month = max(1, min(12, (int)($_GET['month'] ?? date('n'))));
        $year = max(2020, min(2040, (int)($_GET['year'] ?? date('Y'))));
        $monthStart = sprintf('%04d-%02d-01', $year, $month);
        $monthEnd = date('Y-m-t', strtotime($monthStart));
        $today = $db->fetchColumn('SELECT CURDATE()');
        $patterns = [
            'review_yelp' => ['label' => 'Review Yelp', 'like' => '%review yelp%'],
            'review_google' => ['label' => 'Review Google', 'like' => '%review google%'],
            'doordash' => ['label' => 'DoorDash Campaign', 'like' => '%doordash%'],
        ];
        $results = [];
        foreach ($patterns as $key => $meta) {
            $rows = $db->fetchAll(
                "SELECT t.id, t.title, t.due_date, t.is_completed, t.status,
                        COALESCE(ds.name, ps.name, '(no store)') AS store_name
                 FROM tasks t
                 LEFT JOIN projects p ON p.id = t.project_id
                 LEFT JOIN stores ps ON ps.id = p.store_id
                 LEFT JOIN stores ds ON ds.id = t.direct_store_id
                 WHERE LOWER(t.title) LIKE LOWER(?)
                   AND t.due_date BETWEEN ? AND ?
                 ORDER BY store_name ASC, t.due_date ASC, t.id ASC",
                [$meta['like'], $monthStart, $monthEnd]
            ) ?: [];
            $stores = [];
            $done = 0;
            $open = 0;
            $overdue = 0;
            $nextDue = null;
            foreach ($rows as $row) {
                $stores[$row['store_name']] = true;
                $isDone = (int)($row['is_completed'] ?? 0) === 1 || in_array($row['status'] ?? '', ['done', 'completed'], true);
                if ($isDone) {
                    $done++;
                } else {
                    $open++;
                    $due = substr((string)$row['due_date'], 0, 10);
                    if ($due < $today) $overdue++;
                    if (!$nextDue || $due < $nextDue) $nextDue = $due;
                }
            }
            $storeNames = array_keys($stores);
            sort($storeNames);
            $results[$key] = [
                'label' => $meta['label'],
                'total' => count($rows),
                'done' => $done,
                'open' => $open,
                'overdue' => $overdue,
                'store_count' => count($storeNames),
                'stores' => $storeNames,
                'completion_rate' => count($rows) > 0 ? round($done / count($rows) * 100) : null,
                'next_due' => $nextDue,
                'tasks' => $rows,
            ];
        }
        echo json_encode([
            'ok' => true,
            'month' => $month,
            'year' => $year,
            'month_start' => $monthStart,
            'month_end' => $monthEnd,
            'today' => $today,
            'types' => $results,
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        break;

    case 'finance_task_visibility_audit_20260710':
        $expectedKey = getenv('MI_SNAPSHOT_SECRET') ?: safety_read_env_value('MI_SNAPSHOT_SECRET');
        $providedKey = $_GET['key'] ?? '';
        if (!$expectedKey || !hash_equals($expectedKey, $providedKey)) {
            http_response_code(403);
            echo json_encode(['ok' => false, 'error' => 'Forbidden']);
            break;
        }

        $project = $db->fetch(
            "SELECT id, name FROM projects WHERE LOWER(TRIM(name)) = 'finance' ORDER BY id ASC LIMIT 1"
        );
        $projectId = $project ? (int)$project['id'] : 0;
        $rows = $projectId ? $db->fetchAll(
            "SELECT t.id, t.title, t.due_date, t.status, t.is_completed, t.section_id,
                    sec.name AS section_name,
                    t.visibility, t.private_by_user_id, t.direct_store_id,
                    s.name AS store_name,
                    t.assignee_id, u.name AS assignee_name,
                    CASE WHEN pm.user_id IS NULL THEN 0 ELSE 1 END AS assignee_is_project_member
             FROM tasks t
             LEFT JOIN sections sec ON sec.id = t.section_id
             LEFT JOIN stores s ON s.id = t.direct_store_id
             LEFT JOIN users u ON u.id = t.assignee_id
             LEFT JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = t.assignee_id
             WHERE t.project_id = ?
               AND t.title LIKE '%Monthly Finance Task%'
               AND COALESCE(t.is_completed, 0) = 0
             ORDER BY t.assignee_id, t.due_date, t.id",
            [$projectId]
        ) : [];

        echo json_encode([
            'ok' => true,
            'project' => $project,
            'count' => count($rows),
            'public_count' => count(array_filter($rows, fn($r) => ($r['visibility'] ?? '') === 'public')),
            'missing_section_count' => count(array_filter($rows, fn($r) => empty($r['section_id']))),
            'missing_project_member_count' => count(array_filter($rows, fn($r) => empty($r['assignee_is_project_member']))),
            'tasks' => $rows,
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        break;

    case 'task_maintenance_20260701':
        $expectedKey = getenv('MI_SNAPSHOT_SECRET') ?: safety_read_env_value('MI_SNAPSHOT_SECRET');
        $providedKey = $_GET['key'] ?? '';
        if (!$expectedKey || !hash_equals($expectedKey, $providedKey)) {
            http_response_code(403);
            echo json_encode(['ok' => false, 'error' => 'Forbidden']);
            break;
        }

        $pdo = $db->getConnection();
        $mode = ($_GET['mode'] ?? 'dry-run') === 'execute' ? 'execute' : 'dry-run';
        $cutoff = date('Y-m-d', strtotime('-7 days'));

        $testSql = "
            SELECT id, title, description, status, due_date, created_at
            FROM tasks
            WHERE COALESCE(is_completed, 0) = 0
              AND (
                LOWER(COALESCE(title, '')) REGEXP '(^|[^a-z0-9])(qa|test|smoke|dummy|sample|demo|playwright|e2e|walkthrough|ops check)([^a-z0-9]|$)'
                OR LOWER(COALESCE(description, '')) REGEXP 'automated end-to-end approval workflow test task|qa test|smoke test|playwright|e2e'
              )
            ORDER BY id
            LIMIT 1000
        ";
        $testTasks = $db->fetchAll($testSql);
        $testIds = array_map(fn($row) => (int)$row['id'], $testTasks);

        $overdueSql = "
            SELECT id, title, status, due_date, is_completed, completed_at
            FROM tasks
            WHERE COALESCE(is_completed, 0) = 0
              AND due_date IS NOT NULL
              AND due_date <= ?
              AND COALESCE(status, '') NOT IN ('done', 'completed', 'cancelled')
        ";
        $overdueParams = [$cutoff];
        if (!empty($testIds)) {
            $overdueSql .= " AND id NOT IN (" . implode(',', array_fill(0, count($testIds), '?')) . ")";
            $overdueParams = array_merge($overdueParams, $testIds);
        }
        $overdueSql .= " ORDER BY due_date ASC, id ASC LIMIT 5000";
        $overdueTasks = $db->fetchAll($overdueSql, $overdueParams);

        if ($mode !== 'execute') {
            echo json_encode([
                'ok' => true,
                'mode' => 'dry-run',
                'cutoff' => $cutoff,
                'test_tasks_to_delete' => count($testTasks),
                'overdue_tasks_to_complete' => count($overdueTasks),
                'test_samples' => array_slice($testTasks, 0, 30),
                'overdue_samples' => array_slice($overdueTasks, 0, 30),
            ], JSON_PRETTY_PRINT);
            break;
        }

        $backupDir = __DIR__ . '/backups';
        if (!is_dir($backupDir)) @mkdir($backupDir, 0755, true);
        $backupFile = 'TASK_MAINTENANCE_20260701_' . date('Y-m-d_H-i-s') . '.json';
        $backupPath = $backupDir . '/' . $backupFile;
        file_put_contents($backupPath, json_encode([
            'created_at' => date('c'),
            'cutoff' => $cutoff,
            'test_tasks' => $testTasks,
            'overdue_tasks' => $overdueTasks,
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        $deleted = 0;
        $completed = 0;
        $pdo->beginTransaction();
        try {
            if (!empty($testIds)) {
                $placeholders = implode(',', array_fill(0, count($testIds), '?'));
                foreach (['attachments', 'task_attachments', 'task_comments', 'task_watchers', 'task_approval_events', 'notifications', 'deadline_extensions', 'task_penalties'] as $relatedTable) {
                    if ($db->tableExists($relatedTable) && $db->columnExists($relatedTable, 'task_id')) {
                        $db->delete("DELETE FROM {$relatedTable} WHERE task_id IN ({$placeholders})", $testIds);
                    }
                }
                if ($db->columnExists('tasks', 'parent_task_id')) {
                    $db->update("UPDATE tasks SET parent_task_id = NULL WHERE parent_task_id IN ({$placeholders})", $testIds);
                }
                $deleted = $db->delete("DELETE FROM tasks WHERE id IN ({$placeholders})", $testIds);
            }

            if (!empty($overdueTasks)) {
                $overdueIds = array_map(fn($row) => (int)$row['id'], $overdueTasks);
                $placeholders = implode(',', array_fill(0, count($overdueIds), '?'));
                $completed = $db->update(
                    "UPDATE tasks
                     SET is_completed = 1, status = 'done', completed_at = NOW(), updated_at = NOW()
                     WHERE id IN ({$placeholders})",
                    $overdueIds
                );
            }

            if ($db->tableExists('audit_logs')) {
                $note = sprintf(
                    'CEO task maintenance 2026-07-01: deleted %d test tasks; completed %d tasks overdue 7+ days; backup %s',
                    $deleted,
                    $completed,
                    $backupFile
                );
                $db->insert(
                    "INSERT INTO audit_logs(module, action, record_type, record_id, user_id, note, created_at)
                     VALUES('tasks', 'maintenance_cleanup', 'task', 0, 1, ?, NOW())",
                    [$note]
                );
            }

            $pdo->commit();
            echo json_encode([
                'ok' => true,
                'mode' => 'execute',
                'cutoff' => $cutoff,
                'backup_file' => $backupFile,
                'deleted_test_tasks' => $deleted,
                'completed_overdue_tasks' => $completed,
            ], JSON_PRETTY_PRINT);
        } catch (\Throwable $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode([
                'ok' => false,
                'error' => $e->getMessage(),
                'backup_file' => $backupFile,
            ], JSON_PRETTY_PRINT);
        }
        break;

    // ── Duplicate Store Audit ─────────────────────────────────────────────────
    case 'dup_store_audit':
        $dupIds   = [1, 3, 4, 9]; // JHT, B2, Raw, HEO
        $mergeMap = [3 => 6, 4 => 2, 9 => 12];
        $result   = [];
        foreach ($dupIds as $sid) {
            $store = $db->fetch("SELECT id, name, is_active FROM stores WHERE id = ?", [$sid]);
            $target = isset($mergeMap[$sid]) ? $db->fetch("SELECT id, name FROM stores WHERE id = ?", [$mergeMap[$sid]]) : null;

            $taskCount = 0;
            $projCount = 0;
            $billCount = 0;
            $sampleTasks = [];
            $sampleProjects = [];

            try { $rows = $db->fetchAll("SELECT id, title FROM tasks WHERE store_id = ? LIMIT 200", [$sid]); $taskCount = count($rows); $sampleTasks = array_column(array_slice($rows,0,5),'title'); } catch(\Throwable $e) {}
            try { $rows = $db->fetchAll("SELECT id, name FROM projects WHERE store_id = ? LIMIT 100", [$sid]); $projCount = count($rows); $sampleProjects = array_column($rows,'name'); } catch(\Throwable $e) {}
            try { $rows = $db->fetchAll("SELECT id FROM bills WHERE store_id = ? LIMIT 100", [$sid]); $billCount = count($rows); } catch(\Throwable $e) {}

            $result[] = [
                'store'      => $store,
                'target'     => $target,
                'task_count' => $taskCount,
                'proj_count' => $projCount,
                'bill_count' => $billCount,
                'tasks'      => $sampleTasks,
                'projects'   => $sampleProjects,
            ];
        }
        echo json_encode($result, JSON_PRETTY_PRINT);
        break;

    // ── Duplicate Store Migrate + Delete ──────────────────────────────────────
    // Reassigns tasks/projects/bills from dup stores to target stores, then
    // permanently removes the dup store rows. Idempotent.
    case 'dup_store_migrate':
        $mergeMap = [3 => 6, 4 => 2, 9 => 12]; // B2→Stone Oak, Raw→Raw Stockton, HEO→Heo Holding
        $deleteOnly = [1];                        // JHT — no merge target, just delete

        $pdo = $db->getConnection();
        $pdo->beginTransaction();
        $log = ['tasks_moved' => 0, 'projects_moved' => 0, 'bills_moved' => 0, 'stores_deleted' => 0, 'errors' => []];

        try {
            foreach ($mergeMap as $fromId => $toId) {
                $from = $db->fetch("SELECT name FROM stores WHERE id = ?", [$fromId]);
                $to   = $db->fetch("SELECT name FROM stores WHERE id = ?", [$toId]);
                if (!$from || !$to) { $log['errors'][] = "Store $fromId or $toId not found"; continue; }

                // Move tasks (skip if store_id column doesn't exist)
                try { $moved = $pdo->exec("UPDATE tasks SET store_id = $toId WHERE store_id = $fromId"); $log['tasks_moved'] += (int)$moved; } catch(\Throwable $e) { $log['errors'][] = "tasks skip: ".$e->getMessage(); }

                // Move projects (skip if store_id column doesn't exist)
                try { $moved = $pdo->exec("UPDATE projects SET store_id = $toId WHERE store_id = $fromId"); $log['projects_moved'] += (int)$moved; } catch(\Throwable $e) { $log['errors'][] = "projects skip: ".$e->getMessage(); }

                // Move bills
                try { $moved = $pdo->exec("UPDATE bills SET store_id = $toId WHERE store_id = $fromId"); $log['bills_moved'] += (int)$moved; } catch(\Throwable $e) { $log['errors'][] = "bills error: ".$e->getMessage(); throw $e; }

                // Audit log
                if ($db->tableExists('audit_logs')) {
                    $note = $pdo->quote("Duplicate store merge: store#{$fromId} ({$from['name']}) → store#{$toId} ({$to['name']}). Tasks/projects/bills reassigned.");
                    $pdo->exec("INSERT INTO audit_logs(module,action,record_type,record_id,user_id,note,created_at) VALUES('stores','merge_duplicate','store',$fromId,1,$note,NOW())");
                }

                // Hard-delete the duplicate store
                $pdo->exec("DELETE FROM stores WHERE id = $fromId");
                $log['stores_deleted']++;
            }

            foreach ($deleteOnly as $sid) {
                $store = $db->fetch("SELECT name FROM stores WHERE id = ?", [$sid]);
                if (!$store) continue;
                // Delete orphaned data (skip tables without store_id)
                try { $pdo->exec("DELETE FROM bills WHERE store_id = $sid"); } catch(\Throwable $e) {}
                try { $pdo->exec("DELETE FROM tasks WHERE store_id = $sid"); } catch(\Throwable $e) {}
                try { $pdo->exec("DELETE FROM projects WHERE store_id = $sid"); } catch(\Throwable $e) {}
                if ($db->tableExists('audit_logs')) {
                    $note = $pdo->quote("Test/garbage store deleted: store#{$sid} ({$store['name']}). Orphaned bills/tasks/projects removed.");
                    $pdo->exec("INSERT INTO audit_logs(module,action,record_type,record_id,user_id,note,created_at) VALUES('stores','delete_test','store',$sid,1,$note,NOW())");
                }
                $pdo->exec("DELETE FROM stores WHERE id = $sid");
                $log['stores_deleted']++;
            }

            $pdo->commit();
            echo json_encode(['ok' => true, 'log' => $log], JSON_PRETTY_PRINT);
        } catch (\Throwable $e) {
            $pdo->rollBack();
            echo json_encode(['ok' => false, 'error' => $e->getMessage(), 'log' => $log]);
        }
        break;

    // ── Delete test/dummy bills ───────────────────────────────────────────────
    case 'delete_test_bills':
        $pdo = $db->getConnection();
        $pdo->beginTransaction();
        try {
            $deleted = $pdo->exec("DELETE FROM bills WHERE title LIKE '%TEST%' OR title LIKE '%DUPLICATE%' OR title LIKE '%test%' OR title LIKE '%dummy%'");
            $pdo->commit();
            echo json_encode(['ok' => true, 'deleted' => (int)$deleted]);
        } catch (\Throwable $e) {
            $pdo->rollBack();
            echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
        }
        break;

    default:
        echo json_encode(['error' => 'Unknown query_id: ' . $queryId]);
}
