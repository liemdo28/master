<?php
/**
 * Phase 13.5 — Bill & Payment Deep Audit
 * Access: https://dashboard.bakudanramen.com/bill-audit.php
 * Auth: session-based (same as app)
 */
chdir(__DIR__);
session_start();
require_once __DIR__ . '/config/app.php';
require_once __DIR__ . '/config/database.php';

// Auth check
if (empty($_SESSION['user_id'])) {
    http_response_code(403);
    echo json_encode(['error' => 'Not authenticated']);
    exit;
}
$role = $_SESSION['role'] ?? '';
if (!in_array($role, ['admin', 'manager'])) {
    http_response_code(403);
    echo json_encode(['error' => 'Admin or manager only', 'role' => $role]);
    exit;
}

header('Content-Type: application/json; charset=utf-8');
set_time_limit(120);

$db    = Database::getInstance();
$today = date('Y-m-d');

function col_exists($db, $table, $col) {
    static $cache = [];
    $k = "$table.$col";
    if (!isset($cache[$k])) {
        $r = $db->fetchAll("SHOW COLUMNS FROM `$table` LIKE '$col'");
        $cache[$k] = !empty($r);
    }
    return $cache[$k];
}

function store_map($db) {
    static $map = null;
    if ($map === null) {
        $rows = $db->fetchAll("SELECT id, name FROM stores");
        $map = [];
        foreach ($rows as $r) $map[(int)$r['id']] = $r['name'];
    }
    return $map;
}

$hasArch    = col_exists($db, 'bills', 'is_archived');
$hasFinCat  = col_exists($db, 'bills', 'finance_category');
$hasFreq    = col_exists($db, 'bills', 'frequency');
$hasResp    = col_exists($db, 'bills', 'responsible_user_id');
$hasChecker = col_exists($db, 'bills', 'checker_user_id');
$hasApprover= col_exists($db, 'bills', 'approver_user_id');
$hasVerifier= col_exists($db, 'bills', 'verifier_user_id');
$hasPaidAt  = col_exists($db, 'bills', 'paid_at');
$hasReminded= col_exists($db, 'bills', 'reminded_at');
$hasWS      = col_exists($db, 'bills', 'workflow_status');

$archW  = $hasArch ? "AND COALESCE(is_archived,0)=0" : "";
$catCol = $hasFinCat ? 'finance_category' : 'NULL';
$stores = store_map($db);

// ── SCHEMA PROBE ──────────────────────────────────────────────────────────────
$cols      = array_column($db->fetchAll("SHOW COLUMNS FROM bills"), 'Field');
$tableRows = $db->fetchAll("SHOW TABLES");
$allTables = array_map(function($r){ return array_values($r)[0]; }, $tableRows);
$billTables = array_values(array_filter($allTables, function($t){
    return strpos($t,'bill')!==false || strpos($t,'payment')!==false || strpos($t,'vendor')!==false;
}));
$totalBills  = (int)$db->fetchColumn("SELECT COUNT(*) FROM bills");
$activeBills = $hasArch ? (int)$db->fetchColumn("SELECT COUNT(*) FROM bills WHERE is_archived=0") : $totalBills;

// ── WS1: EXACT DUPLICATES ────────────────────────────────────────────────────
$dupGroups = $db->fetchAll("
    SELECT MIN(id) AS canonical_id,
           GROUP_CONCAT(id ORDER BY id SEPARATOR ',') AS all_ids,
           COUNT(*) AS cnt, title, store_id, amount, due_date,
           COALESCE($catCol,'') AS category
    FROM bills WHERE 1=1 $archW
    GROUP BY LOWER(TRIM(title)), store_id, amount, due_date
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC, canonical_id
");
$exactDupes = [];
$totalDupBills = 0;
foreach ($dupGroups as $g) {
    $ids = explode(',', $g['all_ids']);
    $dupeIds = array_values(array_filter($ids, function($id) use ($g){ return (int)$id !== (int)$g['canonical_id']; }));
    $totalDupBills += count($dupeIds);
    $exactDupes[] = [
        'canonical_id'  => (int)$g['canonical_id'],
        'duplicate_ids' => array_map('intval', $dupeIds),
        'dup_count'     => count($dupeIds),
        'title'         => $g['title'],
        'store'         => isset($stores[$g['store_id']]) ? $stores[$g['store_id']] : 'Store #'.$g['store_id'],
        'amount'        => (float)$g['amount'],
        'due_date'      => $g['due_date'],
        'category'      => $g['category'],
        'confidence'    => 100,
        'match_reason'  => 'Exact: title + store_id + amount + due_date',
    ];
}

// ── WS2: RECURRENCE ──────────────────────────────────────────────────────────
$ws2 = ['status' => 'SCHEMA_MISSING', 'verdict' => 'BLOCKED'];
if ($hasFreq) {
    $recurring = $db->fetchAll("SELECT id,title,store_id,amount,due_date,frequency,status FROM bills WHERE frequency!='once' $archW ORDER BY store_id,title,due_date DESC");
    $tpl = [];
    foreach ($recurring as $b) {
        $k = strtolower(trim($b['title'])).'|'.$b['store_id'];
        if (!isset($tpl[$k])) {
            $tpl[$k] = ['title'=>$b['title'],'store'=>isset($stores[$b['store_id']])?$stores[$b['store_id']]:'Store #'.$b['store_id'],'frequency'=>$b['frequency'],'occurrences'=>[]];
        }
        $tpl[$k]['occurrences'][] = ['id'=>(int)$b['id'],'due_date'=>$b['due_date'],'status'=>$b['status']];
    }
    $doubles = [];
    foreach ($tpl as $t) {
        $months = [];
        foreach ($t['occurrences'] as $o) { $months[substr($o['due_date'],0,7)][] = $o['id']; }
        foreach ($months as $m => $ids) {
            if (count($ids) > 1) $doubles[] = ['title'=>$t['title'],'store'=>$t['store'],'month'=>$m,'bill_ids'=>$ids,'issue'=>'DOUBLE_RECURRENCE'];
        }
    }
    $overdueRec = array_values(array_filter($recurring, function($b) use ($today){ return $b['due_date'] < $today && $b['status'] !== 'paid'; }));
    $ws2 = [
        'total_recurring'         => count($recurring),
        'template_count'          => count($tpl),
        'double_recurrence_count' => count($doubles),
        'double_recurrence'       => $doubles,
        'overdue_recurring_count' => count($overdueRec),
        'overdue_recurring_sample'=> array_slice(array_map(function($b) use ($stores, $today){
            return ['id'=>(int)$b['id'],'title'=>$b['title'],'store'=>isset($stores[$b['store_id']])?$stores[$b['store_id']]:'Store #'.$b['store_id'],'due_date'=>$b['due_date'],'frequency'=>$b['frequency'],'status'=>$b['status'],'days_overdue'=>(int)((strtotime($today)-strtotime($b['due_date']))/86400)];
        }, $overdueRec), 0, 30),
        'verdict' => count($doubles) === 0 ? 'PASS' : 'FAIL',
    ];
}

// ── WS3: CATEGORIES ──────────────────────────────────────────────────────────
$catDist = $db->fetchAll("SELECT COALESCE($catCol,'MISSING') AS category, COUNT(*) AS cnt FROM bills WHERE 1=1 $archW GROUP BY category ORDER BY cnt DESC");
$missingCatBills = $db->fetchAll("SELECT id,title,store_id,amount,due_date FROM bills WHERE ($catCol IS NULL OR $catCol='' OR $catCol='other') $archW ORDER BY due_date DESC LIMIT 50");

// ── WS4: STORE OWNERSHIP ─────────────────────────────────────────────────────
$noStore  = $db->fetchAll("SELECT id,title,amount,due_date FROM bills WHERE store_id IS NULL $archW");
$badStore = $db->fetchAll("SELECT b.id,b.title,b.store_id,b.amount,b.due_date FROM bills b LEFT JOIN stores s ON b.store_id=s.id WHERE b.store_id IS NOT NULL AND s.id IS NULL $archW");

// ── WS5: RESPONSIBILITY ───────────────────────────────────────────────────────
$noOwner     = $hasResp  ? $db->fetchAll("SELECT id,title,store_id,due_date,status FROM bills WHERE responsible_user_id IS NULL $archW ORDER BY due_date LIMIT 100") : [];
$noCheckerCt = $hasChecker  ? (int)$db->fetchColumn("SELECT COUNT(*) FROM bills WHERE checker_user_id IS NULL $archW")  : null;
$noApproverCt= $hasApprover ? (int)$db->fetchColumn("SELECT COUNT(*) FROM bills WHERE approver_user_id IS NULL $archW") : null;
$noVerifierCt= $hasVerifier ? (int)$db->fetchColumn("SELECT COUNT(*) FROM bills WHERE verifier_user_id IS NULL $archW") : null;

// ── WS6: PAYMENT STATUS ───────────────────────────────────────────────────────
$byStatus = $db->fetchAll("SELECT status, COUNT(*) AS cnt FROM bills WHERE 1=1 $archW GROUP BY status");
$byWS     = $hasWS ? $db->fetchAll("SELECT workflow_status, COUNT(*) AS cnt FROM bills WHERE 1=1 $archW GROUP BY workflow_status") : [];
$stuck    = $db->fetchAll("SELECT id,title,store_id,amount,due_date,status, DATEDIFF(NOW(),due_date) AS days_over FROM bills WHERE status IN ('pending','overdue') AND due_date < DATE_SUB(NOW(),INTERVAL 30 DAY) $archW ORDER BY days_over DESC LIMIT 50");
$paidNoPaidAt = $hasPaidAt ? (int)$db->fetchColumn("SELECT COUNT(*) FROM bills WHERE status='paid' AND paid_at IS NULL $archW") : null;

// ── WS7: DASHBOARD INTEGRITY ─────────────────────────────────────────────────
$kpis = [
    ['metric'=>'Total active bills',                   'db_value'=>(int)$db->fetchColumn("SELECT COUNT(*) FROM bills WHERE 1=1 $archW")],
    ['metric'=>'status=overdue',                       'db_value'=>(int)$db->fetchColumn("SELECT COUNT(*) FROM bills WHERE status='overdue' $archW")],
    ['metric'=>'status=pending',                       'db_value'=>(int)$db->fetchColumn("SELECT COUNT(*) FROM bills WHERE status='pending' $archW")],
    ['metric'=>'status=paid',                          'db_value'=>(int)$db->fetchColumn("SELECT COUNT(*) FROM bills WHERE status='paid' $archW")],
    ['metric'=>'Past due AND unpaid (real overdue)',   'db_value'=>(int)$db->fetchColumn("SELECT COUNT(*) FROM bills WHERE due_date<'$today' AND status!='paid' $archW")],
    ['metric'=>'Drilldown overdue-bills count',        'db_value'=>(int)$db->fetchColumn("SELECT COUNT(*) FROM bills WHERE (status='overdue' OR (due_date<'$today' AND status NOT IN ('paid'))) $archW")],
    ['metric'=>'Due in next 7 days (pending)',         'db_value'=>(int)$db->fetchColumn("SELECT COUNT(*) FROM bills WHERE due_date BETWEEN '$today' AND DATE_ADD('$today',INTERVAL 7 DAY) AND status='pending' $archW")],
    ['metric'=>'Due in next 30 days (pending)',        'db_value'=>(int)$db->fetchColumn("SELECT COUNT(*) FROM bills WHERE due_date BETWEEN '$today' AND DATE_ADD('$today',INTERVAL 30 DAY) AND status='pending' $archW")],
    ['metric'=>'Overdue total amount ($)',             'db_value'=>round((float)$db->fetchColumn("SELECT COALESCE(SUM(amount),0) FROM bills WHERE (status='overdue' OR (due_date<'$today' AND status!='paid')) $archW"), 2)],
    ['metric'=>'Pending total amount ($)',             'db_value'=>round((float)$db->fetchColumn("SELECT COALESCE(SUM(amount),0) FROM bills WHERE status='pending' $archW"), 2)],
];
$overdueByStatus = (int)$db->fetchColumn("SELECT COUNT(*) FROM bills WHERE status='overdue' $archW");
$overdueByDate   = (int)$db->fetchColumn("SELECT COUNT(*) FROM bills WHERE due_date<'$today' AND status!='paid' $archW");

// ── WS8: REMINDERS ───────────────────────────────────────────────────────────
$due7 = $db->fetchAll("SELECT id,title,store_id,amount,due_date," . ($hasReminded?'reminded_at':'NULL AS reminded_at') . " FROM bills WHERE due_date BETWEEN '$today' AND DATE_ADD('$today',INTERVAL 7 DAY) AND status='pending' $archW ORDER BY due_date");
$notReminded = array_filter($due7, function($b){ return empty($b['reminded_at']); });
$overdueNeverReminded = ($hasReminded && $hasArch) ? (int)$db->fetchColumn("SELECT COUNT(*) FROM bills WHERE due_date<'$today' AND status!='paid' AND reminded_at IS NULL $archW") : null;

// ── WS9: CREDIT CARD ─────────────────────────────────────────────────────────
$catWhere = $hasFinCat ? "finance_category='credit_card'" : "LOWER(title) LIKE '%credit card%'";
$cc = $db->fetchAll("SELECT id,title,store_id,amount,due_date,status FROM bills WHERE $catWhere $archW ORDER BY store_id,due_date DESC");
$ccDupGroups = $db->fetchAll("SELECT MIN(id) AS canonical_id, GROUP_CONCAT(id ORDER BY id) AS all_ids, COUNT(*) AS cnt, title, store_id, amount, due_date FROM bills WHERE $catWhere $archW GROUP BY LOWER(TRIM(title)), store_id, amount, due_date HAVING COUNT(*) > 1");
$ccPaid    = count(array_filter($cc, function($b){ return $b['status']==='paid'; }));
$ccOverdue = count(array_filter($cc, function($b) use ($today){ return $b['status']==='overdue' || ($b['due_date']<$today && $b['status']!=='paid'); }));

// ── WS10: STORE HEALTH ────────────────────────────────────────────────────────
$storeRows = $db->fetchAll("SELECT id, name FROM stores WHERE is_active=1 ORDER BY name");
$storeHealth = [];
foreach ($storeRows as $s) {
    $sid  = (int)$s['id'];
    $tot  = (int)$db->fetchColumn("SELECT COUNT(*) FROM bills WHERE store_id=$sid $archW");
    $paid = (int)$db->fetchColumn("SELECT COUNT(*) FROM bills WHERE store_id=$sid AND status='paid' $archW");
    $ovd  = (int)$db->fetchColumn("SELECT COUNT(*) FROM bills WHERE store_id=$sid AND (status='overdue' OR (due_date<'$today' AND status!='paid')) $archW");
    $rec  = $hasFreq ? (int)$db->fetchColumn("SELECT COUNT(*) FROM bills WHERE store_id=$sid AND frequency!='once' $archW") : 0;
    $dups = (int)$db->fetchColumn("SELECT COUNT(*) FROM (SELECT 1 FROM bills WHERE store_id=$sid $archW GROUP BY LOWER(TRIM(title)), amount, due_date HAVING COUNT(*)>1) t");
    $misCat  = $hasFinCat ? (int)$db->fetchColumn("SELECT COUNT(*) FROM bills WHERE store_id=$sid AND (finance_category IS NULL OR finance_category='other') $archW") : null;
    $misOwn  = $hasResp   ? (int)$db->fetchColumn("SELECT COUNT(*) FROM bills WHERE store_id=$sid AND responsible_user_id IS NULL $archW") : null;
    $penalty = min(100, $ovd*2 + $dups*3 + (int)($misCat??0) + (int)($misOwn??0));
    $score   = max(0, 100 - $penalty);
    $grade   = $score>=90?'A':($score>=75?'B':($score>=60?'C':($score>=40?'D':'F')));
    $storeHealth[] = ['store_id'=>$sid,'store_name'=>$s['name'],'total_bills'=>$tot,'paid'=>$paid,'overdue'=>$ovd,'recurring'=>$rec,'dup_groups'=>$dups,'missing_category'=>$misCat,'missing_owner'=>$misOwn,'health_score'=>$score,'grade'=>$grade];
}
usort($storeHealth, function($a,$b){ return $a['health_score'] - $b['health_score']; });

// ── OUTPUT ───────────────────────────────────────────────────────────────────
echo json_encode([
    'generated_at'  => date('c'),
    'today'         => $today,
    'php_version'   => PHP_VERSION,
    'schema' => [
        'columns'        => $cols,
        'bill_tables'    => $billTables,
        'total_bills'    => $totalBills,
        'active_bills'   => $activeBills,
        'archived_bills' => $totalBills - $activeBills,
        'has_columns' => [
            'finance_category'    => $hasFinCat,
            'frequency'           => $hasFreq,
            'responsible_user_id' => $hasResp,
            'checker_user_id'     => $hasChecker,
            'approver_user_id'    => $hasApprover,
            'verifier_user_id'    => $hasVerifier,
            'paid_at'             => $hasPaidAt,
            'reminded_at'         => $hasReminded,
            'workflow_status'     => $hasWS,
            'is_archived'         => $hasArch,
        ],
    ],
    'ws1_duplicates' => [
        'exact_group_count'      => count($exactDupes),
        'total_bills_to_archive' => $totalDupBills,
        'verdict'                => count($exactDupes) === 0 ? 'PASS' : 'FAIL',
        'groups'                 => $exactDupes,
    ],
    'ws2_recurrence'   => $ws2,
    'ws3_categories'   => [
        'distribution'          => $catDist,
        'missing_count'         => count($missingCatBills),
        'verdict'               => count($missingCatBills)===0 ? 'PASS' : 'WARN',
        'bills_needing_category'=> array_map(function($b) use ($stores){ return ['id'=>(int)$b['id'],'title'=>$b['title'],'store'=>isset($stores[$b['store_id']])?$stores[$b['store_id']]:'Store #'.$b['store_id'],'amount'=>(float)$b['amount'],'due_date'=>$b['due_date']]; }, $missingCatBills),
    ],
    'ws4_store_ownership' => [
        'no_store_count'      => count($noStore),
        'invalid_store_count' => count($badStore),
        'no_store'            => $noStore,
        'invalid_store'       => $badStore,
        'verdict'             => (count($noStore)+count($badStore))===0 ? 'PASS' : 'FAIL',
    ],
    'ws5_responsibility' => [
        'no_responsible_count' => count($noOwner),
        'no_checker_count'     => $noCheckerCt,
        'no_approver_count'    => $noApproverCt,
        'no_verifier_count'    => $noVerifierCt,
        'verdict'              => count($noOwner)===0 ? 'PASS' : 'WARN',
        'bills_no_owner'       => array_map(function($b) use ($stores){ return ['id'=>(int)$b['id'],'title'=>$b['title'],'store'=>isset($stores[$b['store_id']])?$stores[$b['store_id']]:'Store #'.$b['store_id'],'due_date'=>$b['due_date'],'status'=>$b['status']]; }, $noOwner),
    ],
    'ws6_payment_status' => [
        'by_status'            => $byStatus,
        'by_workflow_status'   => $byWS,
        'stuck_30d_count'      => count($stuck),
        'paid_without_paid_at' => $paidNoPaidAt,
        'verdict'              => count($stuck)===0 ? 'PASS' : 'WARN',
        'stuck_30d'            => array_map(function($b) use ($stores){ return ['id'=>(int)$b['id'],'title'=>$b['title'],'store'=>isset($stores[$b['store_id']])?$stores[$b['store_id']]:'Store #'.$b['store_id'],'due_date'=>$b['due_date'],'status'=>$b['status'],'days_overdue'=>(int)$b['days_over']]; }, $stuck),
    ],
    'ws7_dashboard' => [
        'kpis'   => $kpis,
        'status_vs_date_mismatch' => abs($overdueByStatus - $overdueByDate),
        'verdict' => $overdueByStatus === $overdueByDate ? 'PASS' : 'WARN',
    ],
    'ws8_reminders' => [
        'due_in_7d_total'       => count($due7),
        'due_in_7d_not_reminded'=> count($notReminded),
        'overdue_never_reminded'=> $overdueNeverReminded,
        'verdict'               => count($notReminded)===0 ? 'PASS' : 'WARN',
    ],
    'ws9_credit_card' => [
        'total_cc_bills'  => count($cc),
        'paid'            => $ccPaid,
        'overdue'         => $ccOverdue,
        'pending'         => count($cc) - $ccPaid - $ccOverdue,
        'duplicate_groups'=> count($ccDupGroups),
        'verdict'         => count($ccDupGroups)===0 ? 'PASS' : 'FAIL',
        'cc_bills'        => array_map(function($b) use ($stores){ return ['id'=>(int)$b['id'],'title'=>$b['title'],'store'=>isset($stores[$b['store_id']])?$stores[$b['store_id']]:'Store #'.$b['store_id'],'amount'=>(float)$b['amount'],'due_date'=>$b['due_date'],'status'=>$b['status']]; }, $cc),
    ],
    'ws10_store_health' => ['store_count'=>count($storeHealth), 'stores'=>$storeHealth],
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
