<?php
/**
 * Phase 13.5 — CLI Bill Audit
 * Usage: php scripts/cli_bill_audit.php > /tmp/bill-audit.json
 */
chdir(dirname(__DIR__));
require_once __DIR__ . '/../config/database.php';

$db    = Database::getInstance();
$today = date('Y-m-d');

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

$hasArch    = colE($db,'bills','is_archived');
$hasFinCat  = colE($db,'bills','finance_category');
$hasFreq    = colE($db,'bills','frequency');
$hasResp    = colE($db,'bills','responsible_user_id');
$hasChecker = colE($db,'bills','checker_user_id');
$hasApprover= colE($db,'bills','approver_user_id');
$hasVerifier= colE($db,'bills','verifier_user_id');
$hasPaidAt  = colE($db,'bills','paid_at');
$hasReminded= colE($db,'bills','reminded_at');
$hasWS      = colE($db,'bills','workflow_status');

$archW  = $hasArch  ? "AND COALESCE(is_archived,0)=0" : "";
$catCol = $hasFinCat ? 'finance_category' : 'NULL';
$catSel = $hasFinCat ? "COALESCE(finance_category,'') AS category" : "'' AS category";
$stores = storeMap($db);

// Schema
$cols = array_column($db->fetchAll("SHOW COLUMNS FROM bills"), 'Field');
$tables = array_map(function($r){ return array_values($r)[0]; }, $db->fetchAll("SHOW TABLES"));
$billTables = array_values(array_filter($tables, function($t){ return strpos($t,'bill')!==false||strpos($t,'payment')!==false||strpos($t,'vendor')!==false; }));
$totalBills  = (int)$db->fetchColumn("SELECT COUNT(*) FROM bills");
$activeBills = $hasArch ? (int)$db->fetchColumn("SELECT COUNT(*) FROM bills WHERE is_archived=0") : $totalBills;

// WS1
$groups = $db->fetchAll("
    SELECT MIN(id) AS canonical_id, GROUP_CONCAT(id ORDER BY id SEPARATOR ',') AS all_ids,
           COUNT(*) AS cnt, title, store_id, amount, due_date, $catSel
    FROM bills WHERE 1=1 $archW
    GROUP BY LOWER(TRIM(title)), store_id, amount, due_date HAVING COUNT(*) > 1
    ORDER BY cnt DESC, canonical_id
");
$exact = []; $totalDup = 0;
foreach ($groups as $g) {
    $ids = explode(',', $g['all_ids']);
    $dupes = array_values(array_filter($ids, function($id) use ($g){ return (int)$id !== (int)$g['canonical_id']; }));
    $totalDup += count($dupes);
    $exact[] = ['canonical_id'=>(int)$g['canonical_id'],'duplicate_ids'=>array_map('intval',$dupes),'dup_count'=>count($dupes),'title'=>$g['title'],'store'=>$stores[$g['store_id']]??'Store #'.$g['store_id'],'amount'=>(float)$g['amount'],'due_date'=>$g['due_date'],'category'=>$g['category'],'match_reason'=>'Exact: title+store+amount+due_date'];
}

// WS2
$ws2 = ['status'=>'SCHEMA_MISSING'];
if ($hasFreq) {
    $rec = $db->fetchAll("SELECT id,title,store_id,amount,due_date,frequency,status FROM bills WHERE frequency!='once' $archW ORDER BY store_id,title,due_date DESC");
    $ovdRec = array_filter($rec, function($b) use ($today){ return $b['due_date']<$today && $b['status']!=='paid'; });
    $ws2 = ['total_recurring'=>count($rec),'overdue_recurring_count'=>count($ovdRec),'verdict'=>count($ovdRec)===0?'PASS':'WARN'];
}

// WS3
$catDist = $db->fetchAll("SELECT COALESCE($catCol,'MISSING') AS category, COUNT(*) AS cnt FROM bills WHERE 1=1 $archW GROUP BY category ORDER BY cnt DESC");
$misCat  = $db->fetchAll("SELECT id,title,store_id,amount,due_date FROM bills WHERE ($catCol IS NULL OR $catCol='' OR $catCol='other') $archW ORDER BY due_date DESC LIMIT 100");

// WS4
$noStore  = $db->fetchAll("SELECT id,title,amount,due_date FROM bills WHERE store_id IS NULL $archW");
$badStore = $db->fetchAll("SELECT b.id,b.title,b.store_id,b.amount,b.due_date FROM bills b LEFT JOIN stores s ON b.store_id=s.id WHERE b.store_id IS NOT NULL AND s.id IS NULL $archW");

// WS5
$noOwner = $hasResp ? $db->fetchAll("SELECT id,title,store_id,due_date,status FROM bills WHERE responsible_user_id IS NULL $archW ORDER BY due_date LIMIT 100") : [];

// WS6
$byStatus = $db->fetchAll("SELECT status, COUNT(*) AS cnt FROM bills WHERE 1=1 $archW GROUP BY status");
$stuck    = $db->fetchAll("SELECT id,title,store_id,amount,due_date,status,DATEDIFF(NOW(),due_date) AS days_over FROM bills WHERE status IN ('pending','overdue') AND due_date < DATE_SUB(NOW(),INTERVAL 30 DAY) $archW ORDER BY days_over DESC LIMIT 50");

// WS7
$kpis = [
    'total_active'      => (int)$db->fetchColumn("SELECT COUNT(*) FROM bills WHERE 1=1 $archW"),
    'overdue_by_status' => (int)$db->fetchColumn("SELECT COUNT(*) FROM bills WHERE status='overdue' $archW"),
    'overdue_by_date'   => (int)$db->fetchColumn("SELECT COUNT(*) FROM bills WHERE due_date<'$today' AND status!='paid' $archW"),
    'pending'           => (int)$db->fetchColumn("SELECT COUNT(*) FROM bills WHERE status='pending' $archW"),
    'paid'              => (int)$db->fetchColumn("SELECT COUNT(*) FROM bills WHERE status='paid' $archW"),
    'due_7d'            => (int)$db->fetchColumn("SELECT COUNT(*) FROM bills WHERE due_date BETWEEN '$today' AND DATE_ADD('$today',INTERVAL 7 DAY) AND status='pending' $archW"),
    'due_30d'           => (int)$db->fetchColumn("SELECT COUNT(*) FROM bills WHERE due_date BETWEEN '$today' AND DATE_ADD('$today',INTERVAL 30 DAY) AND status='pending' $archW"),
    'overdue_amount'    => round((float)$db->fetchColumn("SELECT COALESCE(SUM(amount),0) FROM bills WHERE (status='overdue' OR (due_date<'$today' AND status!='paid')) $archW"),2),
    'pending_amount'    => round((float)$db->fetchColumn("SELECT COALESCE(SUM(amount),0) FROM bills WHERE status='pending' $archW"),2),
];

// WS8
$due7 = $db->fetchAll("SELECT id,title,store_id,amount,due_date,".($hasReminded?'reminded_at':'NULL AS reminded_at')." FROM bills WHERE due_date BETWEEN '$today' AND DATE_ADD('$today',INTERVAL 7 DAY) AND status='pending' $archW ORDER BY due_date");
$notRem = array_filter($due7, function($b){ return empty($b['reminded_at']); });

// WS9
$catWhere = $hasFinCat ? "finance_category='credit_card'" : "LOWER(title) LIKE '%credit card%'";
$cc = $db->fetchAll("SELECT id,title,store_id,amount,due_date,status FROM bills WHERE $catWhere $archW ORDER BY store_id,due_date DESC");
$ccDups = $db->fetchAll("SELECT MIN(id) AS canonical_id, GROUP_CONCAT(id ORDER BY id) AS all_ids, COUNT(*) AS cnt, title, store_id, amount, due_date FROM bills WHERE $catWhere $archW GROUP BY LOWER(TRIM(title)), store_id, amount, due_date HAVING COUNT(*) > 1");

// WS10
$storeRows = $db->fetchAll("SELECT id, name FROM stores WHERE is_active=1 ORDER BY name");
$storeHealth = [];
foreach ($storeRows as $s) {
    $sid = (int)$s['id'];
    $tot = (int)$db->fetchColumn("SELECT COUNT(*) FROM bills WHERE store_id=$sid $archW");
    $paid= (int)$db->fetchColumn("SELECT COUNT(*) FROM bills WHERE store_id=$sid AND status='paid' $archW");
    $ovd = (int)$db->fetchColumn("SELECT COUNT(*) FROM bills WHERE store_id=$sid AND (status='overdue' OR (due_date<'$today' AND status!='paid')) $archW");
    $dups= (int)$db->fetchColumn("SELECT COUNT(*) FROM (SELECT 1 FROM bills WHERE store_id=$sid $archW GROUP BY LOWER(TRIM(title)),amount,due_date HAVING COUNT(*)>1) t");
    $miC = $hasFinCat ? (int)$db->fetchColumn("SELECT COUNT(*) FROM bills WHERE store_id=$sid AND (finance_category IS NULL OR finance_category='other') $archW") : 0;
    $miO = $hasResp   ? (int)$db->fetchColumn("SELECT COUNT(*) FROM bills WHERE store_id=$sid AND responsible_user_id IS NULL $archW") : 0;
    $score = max(0, 100 - min(100, $ovd*2 + $dups*3 + $miC + $miO));
    $grade = $score>=90?'A':($score>=75?'B':($score>=60?'C':($score>=40?'D':'F')));
    $storeHealth[] = ['store_id'=>$sid,'store_name'=>$s['name'],'total_bills'=>$tot,'paid'=>$paid,'overdue'=>$ovd,'dup_groups'=>$dups,'missing_category'=>$miC,'missing_owner'=>$miO,'health_score'=>$score,'grade'=>$grade];
}
usort($storeHealth, function($a,$b){ return $a['health_score']-$b['health_score']; });

echo json_encode([
    'generated_at' => date('c'), 'today' => $today, 'php_version' => PHP_VERSION,
    'schema' => ['columns'=>$cols,'bill_tables'=>$billTables,'total_bills'=>$totalBills,'active_bills'=>$activeBills,'archived_bills'=>$totalBills-$activeBills,'has_columns'=>['finance_category'=>$hasFinCat,'frequency'=>$hasFreq,'responsible_user_id'=>$hasResp,'checker_user_id'=>$hasChecker,'approver_user_id'=>$hasApprover,'verifier_user_id'=>$hasVerifier,'paid_at'=>$hasPaidAt,'reminded_at'=>$hasReminded,'workflow_status'=>$hasWS,'is_archived'=>$hasArch]],
    'ws1_duplicates' => ['exact_group_count'=>count($exact),'total_bills_to_archive'=>$totalDup,'verdict'=>count($exact)===0?'PASS':'FAIL','groups'=>$exact],
    'ws2_recurrence' => $ws2,
    'ws3_categories' => ['distribution'=>$catDist,'missing_count'=>count($misCat),'verdict'=>count($misCat)===0?'PASS':'WARN','bills_needing_category'=>array_map(function($b) use ($stores){ return ['id'=>(int)$b['id'],'title'=>$b['title'],'store'=>$stores[$b['store_id']]??'Store #'.$b['store_id'],'amount'=>(float)$b['amount'],'due_date'=>$b['due_date']]; },$misCat)],
    'ws4_store_ownership' => ['no_store_count'=>count($noStore),'invalid_store_count'=>count($badStore),'verdict'=>(count($noStore)+count($badStore))===0?'PASS':'FAIL'],
    'ws5_responsibility' => ['no_responsible_count'=>count($noOwner),'no_checker_count'=>$hasChecker?(int)$db->fetchColumn("SELECT COUNT(*) FROM bills WHERE checker_user_id IS NULL $archW"):null,'no_approver_count'=>$hasApprover?(int)$db->fetchColumn("SELECT COUNT(*) FROM bills WHERE approver_user_id IS NULL $archW"):null,'verdict'=>count($noOwner)===0?'PASS':'WARN'],
    'ws6_payment_status' => ['by_status'=>$byStatus,'stuck_30d_count'=>count($stuck),'verdict'=>count($stuck)===0?'PASS':'WARN','stuck_30d'=>array_map(function($b) use ($stores){ return ['id'=>(int)$b['id'],'title'=>$b['title'],'store'=>$stores[$b['store_id']]??'Store #'.$b['store_id'],'due_date'=>$b['due_date'],'status'=>$b['status'],'days_overdue'=>(int)$b['days_over']]; },$stuck)],
    'ws7_dashboard' => ['kpis'=>$kpis,'overdue_status_vs_date_delta'=>abs($kpis['overdue_by_status']-$kpis['overdue_by_date']),'verdict'=>$kpis['overdue_by_status']===$kpis['overdue_by_date']?'PASS':'WARN'],
    'ws8_reminders' => ['due_in_7d_total'=>count($due7),'due_in_7d_not_reminded'=>count($notRem),'verdict'=>count($notRem)===0?'PASS':'WARN'],
    'ws9_credit_card' => ['total_cc_bills'=>count($cc),'paid'=>count(array_filter($cc,function($b){return $b['status']==='paid';})),'overdue'=>count(array_filter($cc,function($b) use ($today){return $b['status']==='overdue'||($b['due_date']<$today&&$b['status']!=='paid');})),'duplicate_groups'=>count($ccDups),'verdict'=>count($ccDups)===0?'PASS':'FAIL','cc_bills'=>array_map(function($b) use ($stores){return ['id'=>(int)$b['id'],'title'=>$b['title'],'store'=>$stores[$b['store_id']]??'Store #'.$b['store_id'],'amount'=>(float)$b['amount'],'due_date'=>$b['due_date'],'status'=>$b['status']];},$cc)],
    'ws10_store_health' => ['store_count'=>count($storeHealth),'stores'=>$storeHealth],
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
