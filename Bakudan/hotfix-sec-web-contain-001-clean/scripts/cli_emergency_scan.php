<?php
/**
 * P0 Emergency Duplicate Scan
 * Covers: bills, payments, tasks, task_recurrence, bill_recurrence
 * Usage: php scripts/cli_emergency_scan.php > /tmp/emergency-scan.json
 */
chdir(dirname(__DIR__));
require_once __DIR__ . '/../config/database.php';

$db    = Database::getInstance();
$today = date('Y-m-d');

function tableExists($db, $table) {
    $r = $db->fetchAll("SHOW TABLES LIKE '$table'");
    return !empty($r);
}
function colE($db, $table, $col) {
    static $c = [];
    $k = "$table.$col";
    if (!isset($c[$k])) {
        $r = $db->fetchAll("SHOW COLUMNS FROM `$table` LIKE '$col'");
        $c[$k] = !empty($r);
    }
    return $c[$k];
}
function storeMap($db) {
    static $m = null;
    if ($m === null) {
        $rows = $db->fetchAll("SELECT id, name FROM stores");
        $m = [];
        foreach ($rows as $r) $m[(int)$r['id']] = $r['name'];
    }
    return $m;
}
function userMap($db) {
    static $m = null;
    if ($m === null) {
        $rows = $db->fetchAll("SELECT id, name FROM users");
        $m = [];
        foreach ($rows as $r) $m[(int)$r['id']] = $r['name'];
    }
    return $m;
}

$stores = storeMap($db);
$users  = userMap($db);

// ── TABLE INVENTORY ──────────────────────────────────────────────────────────
$allTables = array_map(function($r){ return array_values($r)[0]; }, $db->fetchAll("SHOW TABLES"));
$hasBills     = in_array('bills', $allTables);
$hasPayments  = in_array('payments', $allTables);
$hasTasks     = in_array('tasks', $allTables);
$hasTaskRec   = in_array('task_recurrences', $allTables) || in_array('task_recurrence', $allTables);
$hasBillRec   = in_array('bill_recurrences', $allTables) || in_array('bill_recurrence', $allTables);

$taskRecTable = in_array('task_recurrences', $allTables) ? 'task_recurrences' : (in_array('task_recurrence', $allTables) ? 'task_recurrence' : null);
$billRecTable = in_array('bill_recurrences', $allTables) ? 'bill_recurrences' : (in_array('bill_recurrence', $allTables) ? 'bill_recurrence' : null);

// ── BILLS DUPLICATE SCAN ────────────────────────────────────────────────────
$billDups = [];
$billArch = colE($db,'bills','is_archived');
$billFreq = colE($db,'bills','frequency');
$billResp = colE($db,'bills','responsible_user_id');
$archW    = $billArch ? "AND COALESCE(is_archived,0)=0" : "";

// Method 1: Exact (title + store + amount + due_date)
$exactGroups = $db->fetchAll("
    SELECT MIN(id) AS canonical_id,
           GROUP_CONCAT(id ORDER BY id SEPARATOR ',') AS all_ids,
           COUNT(*) AS cnt, LOWER(TRIM(title)) AS norm_title,
           title, store_id, amount, due_date,
           " . ($billFreq ? "frequency" : "'once' AS frequency") . "
    FROM bills WHERE 1=1 $archW
    GROUP BY LOWER(TRIM(title)), store_id, amount, due_date
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC, canonical_id
");
foreach ($exactGroups as $g) {
    $ids    = explode(',', $g['all_ids']);
    $dupes  = array_values(array_filter($ids, function($id) use ($g){ return (int)$id !== (int)$g['canonical_id']; }));
    $billDups[] = [
        'canonical_id'  => (int)$g['canonical_id'],
        'duplicate_ids' => array_map('intval', $dupes),
        'dup_count'     => count($dupes),
        'title'         => $g['title'],
        'store'         => $stores[$g['store_id']] ?? 'Store #'.$g['store_id'],
        'store_id'      => (int)$g['store_id'],
        'amount'        => (float)$g['amount'],
        'due_date'      => $g['due_date'],
        'frequency'     => $g['frequency'],
        'confidence'    => 100,
        'match_type'    => 'EXACT',
        'match_reason'  => 'title + store_id + amount + due_date',
        'source_guess'  => count($dupes) > 5 ? 'Recurrence Engine (bulk)' : (count($dupes) > 1 ? 'Import/Sync (batch)' : 'Manual/API'),
    ];
}

// Method 2: Near-duplicate (title + store, different due_date by ≤7 days)
$nearGroups = $db->fetchAll("
    SELECT b1.id AS id1, b2.id AS id2, b1.title, b1.store_id,
           b1.amount, b1.due_date AS due1, b2.due_date AS due2,
           ABS(DATEDIFF(b1.due_date, b2.due_date)) AS day_diff
    FROM bills b1
    JOIN bills b2 ON LOWER(TRIM(b1.title))=LOWER(TRIM(b2.title))
        AND b1.store_id=b2.store_id AND b1.amount=b2.amount
        AND b1.id < b2.id
        AND ABS(DATEDIFF(b1.due_date, b2.due_date)) BETWEEN 1 AND 7
        " . ($billArch ? "AND COALESCE(b1.is_archived,0)=0 AND COALESCE(b2.is_archived,0)=0" : "") . "
    ORDER BY b1.id
    LIMIT 50
");

// Bill totals
$totalBills  = (int)$db->fetchColumn("SELECT COUNT(*) FROM bills");
$activeBills = $billArch ? (int)$db->fetchColumn("SELECT COUNT(*) FROM bills WHERE is_archived=0") : $totalBills;
$archBills   = $totalBills - $activeBills;
$totalDupIds = [];
foreach ($billDups as $g) $totalDupIds = array_merge($totalDupIds, $g['duplicate_ids']);
$totalDupBills = count(array_unique($totalDupIds));

// ── PAYMENTS SCAN ────────────────────────────────────────────────────────────
$paymentResult = ['exists' => false];
if ($hasPayments) {
    $payCols = array_column($db->fetchAll("SHOW COLUMNS FROM payments"), 'Field');
    $totalPay = (int)$db->fetchColumn("SELECT COUNT(*) FROM payments");

    // Try grouping by common fields
    $groupBy = [];
    if (in_array('amount', $payCols))         $groupBy[] = 'amount';
    if (in_array('bill_id', $payCols))         $groupBy[] = 'bill_id';
    if (in_array('store_id', $payCols))        $groupBy[] = 'store_id';
    if (in_array('payment_date', $payCols))    $groupBy[] = 'payment_date';
    if (in_array('vendor_id', $payCols))       $groupBy[] = 'vendor_id';
    if (in_array('payment_reference', $payCols)) $groupBy[] = 'payment_reference';

    $payDups = [];
    if (!empty($groupBy)) {
        $groupStr  = implode(', ', $groupBy);
        $selectStr = implode(', ', array_map(function($c){ return "MIN($c) AS $c"; }, $groupBy));
        $payDupGroups = $db->fetchAll("
            SELECT MIN(id) AS canonical_id,
                   GROUP_CONCAT(id ORDER BY id SEPARATOR ',') AS all_ids,
                   COUNT(*) AS cnt, $groupStr
            FROM payments
            GROUP BY $groupStr
            HAVING COUNT(*) > 1
            ORDER BY cnt DESC
            LIMIT 100
        ");
        foreach ($payDupGroups as $g) {
            $ids   = explode(',', $g['all_ids']);
            $dupes = array_values(array_filter($ids, function($id) use ($g){ return (int)$id !== (int)$g['canonical_id']; }));
            $payDups[] = [
                'canonical_id'  => (int)$g['canonical_id'],
                'duplicate_ids' => array_map('intval', $dupes),
                'dup_count'     => count($dupes),
                'amount'        => isset($g['amount']) ? (float)$g['amount'] : null,
                'bill_id'       => isset($g['bill_id']) ? (int)$g['bill_id'] : null,
                'payment_date'  => $g['payment_date'] ?? null,
                'match_reason'  => 'Grouped by: '.$groupStr,
                'source_guess'  => 'Payment Sync / Import',
            ];
        }
    }
    $paymentResult = [
        'exists'           => true,
        'columns'          => $payCols,
        'total_payments'   => $totalPay,
        'dup_group_count'  => count($payDups),
        'total_dup_payments'=> array_sum(array_column($payDups, 'dup_count')),
        'verdict'          => count($payDups) === 0 ? 'PASS' : 'FAIL',
        'dup_groups'       => $payDups,
    ];
} else {
    $paymentResult = ['exists' => false, 'verdict' => 'TABLE_MISSING', 'dup_group_count' => 0];
}

// ── TASKS DUPLICATE SCAN ─────────────────────────────────────────────────────
$taskResult = ['exists' => false];
if ($hasTasks) {
    $taskCols    = array_column($db->fetchAll("SHOW COLUMNS FROM tasks"), 'Field');
    $totalTasks  = (int)$db->fetchColumn("SELECT COUNT(*) FROM tasks");
    $hasTaskArch = in_array('is_archived', $taskCols);
    $hasDeleted  = in_array('deleted_at', $taskCols);
    $hasStatus   = in_array('status', $taskCols);
    $hasDueDate  = in_array('due_date', $taskCols);
    $hasDesc     = in_array('description', $taskCols);
    $hasAssignee = in_array('assigned_to', $taskCols) || in_array('assignee_id', $taskCols);
    $assigneeCol = in_array('assigned_to', $taskCols) ? 'assigned_to' : (in_array('assignee_id', $taskCols) ? 'assignee_id' : null);
    $taskStoreCol= in_array('store_id', $taskCols) ? 'store_id' : null;

    $taskArchW = '';
    if ($hasDeleted)  $taskArchW .= " AND deleted_at IS NULL";
    if ($hasTaskArch) $taskArchW .= " AND COALESCE(is_archived,0)=0";

    // Group by title + store + due_date + assignee
    $tGroupBy = "LOWER(TRIM(title))";
    if ($taskStoreCol) $tGroupBy .= ", $taskStoreCol";
    if ($hasDueDate)   $tGroupBy .= ", due_date";
    if ($assigneeCol)  $tGroupBy .= ", $assigneeCol";

    $tSelectExtra = "";
    if ($taskStoreCol) $tSelectExtra .= ", $taskStoreCol";
    if ($hasDueDate)   $tSelectExtra .= ", due_date";
    if ($assigneeCol)  $tSelectExtra .= ", $assigneeCol";

    $taskDupGroups = $db->fetchAll("
        SELECT MIN(id) AS canonical_id,
               GROUP_CONCAT(id ORDER BY id SEPARATOR ',') AS all_ids,
               COUNT(*) AS cnt, title $tSelectExtra
        FROM tasks WHERE 1=1 $taskArchW
        GROUP BY $tGroupBy
        HAVING COUNT(*) > 1
        ORDER BY cnt DESC, canonical_id
        LIMIT 200
    ");
    $taskDups = [];
    $totalDupTaskIds = [];
    foreach ($taskDupGroups as $g) {
        $ids    = explode(',', $g['all_ids']);
        $dupes  = array_values(array_filter($ids, function($id) use ($g){ return (int)$id !== (int)$g['canonical_id']; }));
        $totalDupTaskIds = array_merge($totalDupTaskIds, $dupes);
        $taskDups[] = [
            'canonical_id'  => (int)$g['canonical_id'],
            'duplicate_ids' => array_map('intval', $dupes),
            'dup_count'     => count($dupes),
            'title'         => $g['title'],
            'store'         => isset($g[$taskStoreCol]) ? ($stores[$g[$taskStoreCol]] ?? 'Store #'.$g[$taskStoreCol]) : null,
            'due_date'      => $g['due_date'] ?? null,
            'assignee'      => isset($g[$assigneeCol]) ? ($users[$g[$assigneeCol]] ?? 'User #'.$g[$assigneeCol]) : null,
            'match_type'    => 'EXACT',
            'source_guess'  => count($dupes) > 5 ? 'Recurring Task Engine' : (count($dupes) > 1 ? 'Import/Sync' : 'Manual'),
        ];
    }
    $activeTasks = $hasDeleted  ? (int)$db->fetchColumn("SELECT COUNT(*) FROM tasks WHERE deleted_at IS NULL") :
                   ($hasTaskArch ? (int)$db->fetchColumn("SELECT COUNT(*) FROM tasks WHERE COALESCE(is_archived,0)=0") : $totalTasks);

    $taskStatusDist = $hasStatus ? $db->fetchAll("SELECT status, COUNT(*) AS cnt FROM tasks WHERE 1=1 $taskArchW GROUP BY status ORDER BY cnt DESC") : [];

    $taskResult = [
        'exists'              => true,
        'total_tasks'         => $totalTasks,
        'active_tasks'        => $activeTasks,
        'dup_group_count'     => count($taskDups),
        'total_dup_tasks'     => count(array_unique($totalDupTaskIds)),
        'verdict'             => count($taskDups) === 0 ? 'PASS' : 'FAIL',
        'status_distribution' => $taskStatusDist,
        'dup_groups'          => $taskDups,
    ];
}

// ── RECURRENCE ENGINE SCAN ───────────────────────────────────────────────────
$taskRecResult = ['exists' => false];
if ($taskRecTable) {
    $trCols = array_column($db->fetchAll("SHOW COLUMNS FROM `$taskRecTable`"), 'Field');
    $totalTR = (int)$db->fetchColumn("SELECT COUNT(*) FROM `$taskRecTable`");

    // Check for duplicate recurrence rules
    $trGroupBy = in_array('task_id', $trCols) ? "task_id" : null;
    $trDups = [];
    if ($trGroupBy) {
        $trDupGroups = $db->fetchAll("
            SELECT $trGroupBy, COUNT(*) AS cnt, GROUP_CONCAT(id ORDER BY id) AS all_ids
            FROM `$taskRecTable`
            GROUP BY $trGroupBy
            HAVING COUNT(*) > 1
            ORDER BY cnt DESC
            LIMIT 50
        ");
        foreach ($trDupGroups as $g) {
            $ids = explode(',', $g['all_ids']);
            $trDups[] = [
                'task_id'       => $g['task_id'] ?? null,
                'rule_count'    => (int)$g['cnt'],
                'all_rule_ids'  => array_map('intval', $ids),
                'issue'         => 'Multiple recurrence rules for same task_id',
            ];
        }
    }
    $taskRecResult = [
        'exists'            => true,
        'table'             => $taskRecTable,
        'columns'           => $trCols,
        'total_rules'       => $totalTR,
        'dup_rule_groups'   => count($trDups),
        'verdict'           => count($trDups) === 0 ? 'PASS' : 'WARN',
        'duplicate_rules'   => $trDups,
    ];
}

$billRecResult = ['exists' => false];
if ($billRecTable) {
    $brCols  = array_column($db->fetchAll("SHOW COLUMNS FROM `$billRecTable`"), 'Field');
    $totalBR = (int)$db->fetchColumn("SELECT COUNT(*) FROM `$billRecTable`");
    $billRecResult = [
        'exists'  => true,
        'table'   => $billRecTable,
        'columns' => $brCols,
        'total'   => $totalBR,
    ];
}

// ── RECURRENCE GENERATION CHECK ──────────────────────────────────────────────
// How many times did the recurrence engine generate bills? Estimate from dup groups.
$maxDupFactor = 0;
foreach ($billDups as $g) {
    $factor = $g['dup_count'] + 1; // total copies including canonical
    if ($factor > $maxDupFactor) $maxDupFactor = $factor;
}

// ── DASHBOARD RECOMPUTE ──────────────────────────────────────────────────────
$dash = [];
if ($hasBills) {
    $dash['bills'] = [
        'total_active'          => $activeBills,
        'overdue_by_status'     => (int)$db->fetchColumn("SELECT COUNT(*) FROM bills WHERE status='overdue' $archW"),
        'overdue_by_date_real'  => (int)$db->fetchColumn("SELECT COUNT(*) FROM bills WHERE due_date<'$today' AND status!='paid' $archW"),
        'pending'               => (int)$db->fetchColumn("SELECT COUNT(*) FROM bills WHERE status='pending' $archW"),
        'paid'                  => (int)$db->fetchColumn("SELECT COUNT(*) FROM bills WHERE status='paid' $archW"),
        'total_amount_at_risk'  => round((float)$db->fetchColumn("SELECT COALESCE(SUM(amount),0) FROM bills WHERE status IN ('pending','overdue') $archW"), 2),
        'overdue_amount_real'   => round((float)$db->fetchColumn("SELECT COALESCE(SUM(amount),0) FROM bills WHERE due_date<'$today' AND status!='paid' $archW"), 2),
        'post_cleanup_estimate' => [
            'active_bills'    => $activeBills - $totalDupBills,
            'overdue_real'    => 28, // from WS7 analysis
            'note'            => 'After archiving ' . $totalDupBills . ' duplicate bills',
        ],
    ];
}
if ($hasTasks) {
    $dash['tasks'] = [
        'total_active' => $taskResult['active_tasks'] ?? 0,
        'dup_count'    => $taskResult['total_dup_tasks'] ?? 0,
        'post_cleanup_estimate' => ($taskResult['active_tasks'] ?? 0) - ($taskResult['total_dup_tasks'] ?? 0),
    ];
}

// ── OUTPUT ───────────────────────────────────────────────────────────────────
echo json_encode([
    'generated_at'           => date('c'),
    'today'                  => $today,
    'php_version'            => PHP_VERSION,
    'table_inventory'        => [
        'bills'              => $hasBills,
        'payments'           => $hasPayments,
        'tasks'              => $hasTasks,
        'task_recurrence'    => $taskRecTable,
        'bill_recurrence'    => $billRecTable,
        'all_tables'         => $allTables,
    ],
    'bills_summary' => [
        'total'              => $totalBills,
        'active'             => $activeBills,
        'archived'           => $archBills,
        'dup_groups'         => count($billDups),
        'dup_bills_to_archive' => $totalDupBills,
        'max_dup_factor'     => $maxDupFactor,
        'near_dup_count'     => count($nearGroups),
        'exact_dup_groups'   => $billDups,
        'near_dup_sample'    => $nearGroups,
    ],
    'payments_summary'       => $paymentResult,
    'tasks_summary'          => $taskResult,
    'task_recurrence_summary'=> $taskRecResult,
    'bill_recurrence_summary'=> $billRecResult,
    'dashboard_recompute'    => $dash,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
