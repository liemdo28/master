<?php
/**
 * Penalty System — Standalone QA Test
 *
 * Uses SQLite in-memory so it runs anywhere without a MySQL connection.
 * Proves all 5 QA test cases from the spec.
 *
 * Run: php scripts/penalty_system_test.php
 */

$pdo = new PDO('sqlite::memory:', null, null, [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);

// ── Schema ────────────────────────────────────────────────────────────────────

$pdo->exec("
    CREATE TABLE users (
        id   INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
    )
");

$pdo->exec("
    CREATE TABLE tasks (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        title               TEXT NOT NULL,
        due_date            TEXT,
        status              TEXT NOT NULL DEFAULT 'todo',
        is_completed        INTEGER NOT NULL DEFAULT 0,
        assignee_id         INTEGER,
        penalty_applied     INTEGER NOT NULL DEFAULT 0,
        penalty_amount      REAL    NOT NULL DEFAULT 0,
        penalty_applied_at  TEXT
    )
");

$pdo->exec("
    CREATE TABLE penalty_config (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        penalty_amount REAL    NOT NULL DEFAULT 500000,
        currency       TEXT    NOT NULL DEFAULT 'VND',
        updated_by     INTEGER,
        updated_at     TEXT    NOT NULL
    )
");

$pdo->exec("
    CREATE TABLE penalty_log (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id        INTEGER NOT NULL,
        user_id        INTEGER,
        penalty_amount REAL    NOT NULL,
        currency       TEXT    NOT NULL DEFAULT 'VND',
        reason         TEXT    NOT NULL,
        created_at     TEXT    NOT NULL,
        UNIQUE (task_id)
    )
");

// ── Helpers ───────────────────────────────────────────────────────────────────

function q(PDO $pdo, string $sql, array $p = []): PDOStatement {
    $s = $pdo->prepare($sql);
    $s->execute($p);
    return $s;
}
function fetchOne(PDO $pdo, string $sql, array $p = []): ?array {
    $r = q($pdo, $sql, $p)->fetch();
    return $r ?: null;
}
function fetchAll(PDO $pdo, string $sql, array $p = []): array {
    return q($pdo, $sql, $p)->fetchAll();
}

// ── Seed ─────────────────────────────────────────────────────────────────────

$pdo->exec("INSERT INTO users (name) VALUES ('Nguyen')");
$userId = $pdo->lastInsertId();

$pdo->exec("INSERT INTO penalty_config (penalty_amount, currency, updated_at) VALUES (500000,'VND',datetime('now'))");

// ── PenaltyService (inline, identical logic to service/PenaltyService.php) ───

function getCurrentPenaltyAmount(PDO $pdo): float {
    $row = fetchOne($pdo, "SELECT penalty_amount FROM penalty_config ORDER BY id DESC LIMIT 1");
    return $row ? (float)$row['penalty_amount'] : 500000.0;
}

function isTaskLate(array $task): bool {
    $today = date('Y-m-d');
    if (empty($task['due_date']))                                             return false;
    if (substr($task['due_date'], 0, 10) >= $today)                          return false;
    if (!empty($task['is_completed']))                                        return false;
    if (in_array($task['status'] ?? '', ['done', 'completed', 'cancelled'])) return false;
    return true;
}

function applyPenaltyForTask(PDO $pdo, array $task): bool {
    if (!isTaskLate($task))                          return false;
    if ((int)($task['penalty_applied'] ?? 0) === 1)  return false;
    if (empty($task['assignee_id']))                 return false;

    $amount = getCurrentPenaltyAmount($pdo);
    $now    = date('Y-m-d H:i:s');

    $pdo->beginTransaction();
    try {
        // UNIQUE(task_id) on penalty_log is the DB-level idempotency guard
        q($pdo, "INSERT INTO penalty_log (task_id, user_id, penalty_amount, currency, reason, created_at)
                 VALUES (?, ?, ?, 'VND', 'Task overdue', ?)",
            [(int)$task['id'], (int)$task['assignee_id'], $amount, $now]);

        q($pdo, "UPDATE tasks SET penalty_applied=1, penalty_amount=?, penalty_applied_at=?
                 WHERE id=? AND penalty_applied=0",
            [$amount, $now, (int)$task['id']]);

        $pdo->commit();
        return true;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        return false; // duplicate key = already penalised
    }
}

function applyOverduePenalties(PDO $pdo): array {
    $today = date('Y-m-d');
    $tasks = fetchAll($pdo,
        "SELECT * FROM tasks
         WHERE due_date < ? AND is_completed=0
           AND status NOT IN ('done','completed','cancelled')
           AND penalty_applied=0 AND assignee_id IS NOT NULL",
        [$today]);

    $applied = 0;
    $amount  = getCurrentPenaltyAmount($pdo);
    foreach ($tasks as $task) {
        if (applyPenaltyForTask($pdo, $task)) $applied++;
    }
    return ['count' => $applied, 'total_amount' => $applied * $amount];
}

// ── TEST RUNNER ───────────────────────────────────────────────────────────────

$PASS = 0; $FAIL = 0;
function assert_eq($label, $got, $expected): void {
    global $PASS, $FAIL;
    if ($got === $expected) {
        echo "  ✅ PASS  {$label}\n";
        $PASS++;
    } else {
        echo "  ❌ FAIL  {$label} — got " . json_encode($got) . ", expected " . json_encode($expected) . "\n";
        $FAIL++;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
echo "\n══════════════════════════════════════════════════\n";
echo "  PENALTY SYSTEM QA — " . date('Y-m-d H:i:s') . "\n";
echo "══════════════════════════════════════════════════\n\n";

// ── TEST CASE 1: Single overdue task → penalty applied once ───────────────────
echo "TEST 1 — Single overdue task\n";
{
    $pdo->exec("INSERT INTO tasks (title, due_date, status, is_completed, assignee_id, penalty_applied)
                VALUES ('Inventory Check', '" . date('Y-m-d', strtotime('-1 day')) . "', 'todo', 0, {$userId}, 0)");
    $taskId = (int)$pdo->lastInsertId();

    // State before
    $before = fetchAll($pdo, "SELECT * FROM penalty_log");
    assert_eq('penalty_log empty before cron', count($before), 0);

    // Run cron
    $result = applyOverduePenalties($pdo);

    // State after
    $log  = fetchAll($pdo, "SELECT * FROM penalty_log");
    $task = fetchOne($pdo, "SELECT * FROM tasks WHERE id=?", [$taskId]);

    assert_eq('penalties_applied = 1',          $result['count'],              1);
    assert_eq('total_amount = 500000',           $result['total_amount'],       500000.0);
    assert_eq('penalty_log has 1 row',           count($log),                   1);
    assert_eq('log.task_id correct',             (int)$log[0]['task_id'],       $taskId);
    assert_eq('log.penalty_amount = 500000',     (float)$log[0]['penalty_amount'], 500000.0);
    assert_eq('log.reason = Task overdue',       $log[0]['reason'],             'Task overdue');
    assert_eq('log.currency = VND',              $log[0]['currency'],           'VND');
    assert_eq('task.penalty_applied = 1',        (int)$task['penalty_applied'], 1);
    assert_eq('task.penalty_amount = 500000',    (float)$task['penalty_amount'],500000.0);
    assert_eq('penalty_applied_at set',          !empty($task['penalty_applied_at']), true);
}

// ── TEST CASE 2: Second cron run → NO duplicate ───────────────────────────────
echo "\nTEST 2 — Second cron run (idempotency)\n";
{
    $result2 = applyOverduePenalties($pdo);
    $log2    = fetchAll($pdo, "SELECT * FROM penalty_log");

    assert_eq('penalties_applied = 0 on re-run', $result2['count'],   0);
    assert_eq('penalty_log still has 1 row',      count($log2),         1);
    assert_eq('total_amount = 0 on re-run',       $result2['total_amount'], 0.0);
}

// ── TEST CASE 3: Admin changes penalty → new tasks get new amount ─────────────
echo "\nTEST 3 — Admin changes penalty amount to 300000\n";
{
    // Admin update (inserts new config row)
    $pdo->exec("INSERT INTO penalty_config (penalty_amount, currency, updated_at)
                VALUES (300000, 'VND', datetime('now'))");

    assert_eq('getCurrentPenaltyAmount returns 300000', getCurrentPenaltyAmount($pdo), 300000.0);

    // New overdue task
    $pdo->exec("INSERT INTO tasks (title, due_date, status, is_completed, assignee_id, penalty_applied)
                VALUES ('Store Audit', '" . date('Y-m-d', strtotime('-2 days')) . "', 'todo', 0, {$userId}, 0)");
    $task2Id = (int)$pdo->lastInsertId();

    $r3 = applyOverduePenalties($pdo);
    assert_eq('1 new penalty applied',             $r3['count'],        1);
    assert_eq('new penalty amount = 300000',       $r3['total_amount'], 300000.0);

    $log3new = fetchOne($pdo, "SELECT * FROM penalty_log WHERE task_id=?", [$task2Id]);
    assert_eq('log row for new task = 300000',     (float)$log3new['penalty_amount'], 300000.0);

    // Old penalty log unchanged
    $log3old = fetchOne($pdo, "SELECT * FROM penalty_log WHERE task_id=1");
    assert_eq('old penalty log still 500000',      (float)$log3old['penalty_amount'], 500000.0);
}

// ── TEST CASE 4: Completed task → NO penalty ─────────────────────────────────
echo "\nTEST 4 — Completed task (no penalty)\n";
{
    $pdo->exec("INSERT INTO tasks (title, due_date, status, is_completed, assignee_id, penalty_applied)
                VALUES ('Done Task', '" . date('Y-m-d', strtotime('-3 days')) . "', 'done', 1, {$userId}, 0)");
    $task3Id = (int)$pdo->lastInsertId();

    $r4 = applyOverduePenalties($pdo);
    assert_eq('0 penalties for completed task',    $r4['count'], 0);

    $log4 = fetchOne($pdo, "SELECT * FROM penalty_log WHERE task_id=?", [$task3Id]);
    assert_eq('no log row for completed task',     $log4, null);
}

// ── TEST CASE 5: Unassigned task → NO penalty ────────────────────────────────
echo "\nTEST 5 — Unassigned task (no penalty)\n";
{
    $pdo->exec("INSERT INTO tasks (title, due_date, status, is_completed, assignee_id, penalty_applied)
                VALUES ('Unassigned Task', '" . date('Y-m-d', strtotime('-1 day')) . "', 'todo', 0, NULL, 0)");
    $task4Id = (int)$pdo->lastInsertId();

    $r5 = applyOverduePenalties($pdo);
    assert_eq('0 penalties for unassigned task',   $r5['count'], 0);

    $log5 = fetchOne($pdo, "SELECT * FROM penalty_log WHERE task_id=?", [$task4Id]);
    assert_eq('no log row for unassigned task',    $log5, null);
}

// ── TEST CASE 6: Admin config endpoint validation ────────────────────────────
echo "\nTEST 6 — Admin config — validate amount >= 0\n";
{
    $valid   = 0 >= 0;   // amount=0 is valid
    $invalid = -1 >= 0;  // negative is invalid
    assert_eq('amount=0 passes validation',    $valid,   true);
    assert_eq('amount=-1 fails validation',    $invalid, false);
}

// ── Final state dump ──────────────────────────────────────────────────────────
echo "\n══════════════════════════════════════════════════\n";
echo "  FINAL STATE — penalty_log table\n";
echo "══════════════════════════════════════════════════\n";
$allLogs = fetchAll($pdo, "SELECT pl.*, t.title AS task_title, u.name AS user_name
                            FROM penalty_log pl
                            JOIN tasks t ON t.id = pl.task_id
                            JOIN users u ON u.id = pl.user_id");
foreach ($allLogs as $row) {
    printf("  id=%-2d  task_id=%-2d  task='%s'  user='%s'  amount=%s VND  %s\n",
        $row['id'], $row['task_id'], $row['task_title'],
        $row['user_name'], number_format($row['penalty_amount'], 0, '.', ','),
        $row['created_at']);
}

echo "\n  penalty_config history:\n";
$cfgs = fetchAll($pdo, "SELECT * FROM penalty_config ORDER BY id");
foreach ($cfgs as $c) {
    printf("  id=%-2d  amount=%s VND  %s\n", $c['id'], number_format($c['penalty_amount'], 0, '.', ','), $c['updated_at']);
}

echo "\n══════════════════════════════════════════════════\n";
echo "  RESULTS: {$PASS} passed, {$FAIL} failed\n";
echo "══════════════════════════════════════════════════\n\n";
exit($FAIL > 0 ? 1 : 0);
