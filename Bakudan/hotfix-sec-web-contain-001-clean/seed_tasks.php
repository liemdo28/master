<?php
/**
 * Seed script: creates Modesto + IFT + Heo Holding stores, projects, tasks, and CPS bills
 * Run: php seed_tasks.php
 */
require_once __DIR__ . '/database.php';

// ─────────────────────────────────────────────
// Helper functions
// ─────────────────────────────────────────────
function getAdminId() {
    $db = Database::getInstance();
    $user = $db->fetch("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    return $user ? (int)$user['id'] : null;
}

function getManagerId() {
    $db = Database::getInstance();
    // Try 'manager' role first, fall back to Hoang Le (id=3) if role = 'member'
    $user = $db->fetch("SELECT id FROM users WHERE role = 'manager' LIMIT 1");
    if (!$user) {
        $user = $db->fetch("SELECT id FROM users WHERE name LIKE '%Hoang%' AND role = 'member' LIMIT 1");
    }
    return $user ? (int)$user['id'] : null;
}

function storeExists($name) {
    $db = Database::getInstance();
    $s = $db->fetch("SELECT id FROM stores WHERE LOWER(name) = LOWER(?)", [$name]);
    return $s ? (int)$s['id'] : null;
}

function createStore($name, $address = null, $color = null) {
    $db = Database::getInstance();
    $id = $db->insert(
        "INSERT INTO stores (name, address, color, is_active, created_at) VALUES (?, ?, ?, 1, NOW())",
        [$name, $address, $color]
    );
    echo "  + Store: $name (ID=$id)\n";
    return (int)$id;
}

function projectExists($name, $storeId) {
    $db = Database::getInstance();
    $p = $db->fetch(
        "SELECT id FROM projects WHERE LOWER(name) = LOWER(?) AND store_id = ?",
        [$name, $storeId]
    );
    return $p ? (int)$p['id'] : null;
}

function createProject($name, $storeId, $ownerId, $description = null, $color = null) {
    $db = Database::getInstance();
    $id = $db->insert(
        "INSERT INTO projects (name, store_id, owner_id, description, color, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'active', NOW())",
        [$name, $storeId, $ownerId, $description, $color]
    );
    echo "    + Project: $name (ID=$id)\n";
    return (int)$id;
}

function taskExists($title, $projectId) {
    $db = Database::getInstance();
    $t = $db->fetch(
        "SELECT id FROM tasks WHERE LOWER(title) = LOWER(?) AND project_id = ? LIMIT 1",
        [$title, $projectId]
    );
    return $t ? (int)$t['id'] : null;
}

function createTask($data) {
    $db = Database::getInstance();

    $fields = ['title','project_id','assignee_id','created_by','due_date','status',
               'is_completed','completed_at','priority','description','created_at'];
    $placeholders = array_fill(0, count($fields), '?');
    $params = [
        $data['title'], $data['project_id'], $data['assignee_id'],
        $data['assignee_id'],                         // created_by
        $data['due_date'], $data['status'] ?? 'pending',
        $data['is_completed'] ?? 0,
        $data['completed_at'] ?? null,
        $data['priority'] ?? 'medium',
        $data['description'] ?? null,
        date('Y-m-d H:i:s'),
    ];

    $id = $db->insert(
        "INSERT INTO tasks (" . implode(',', $fields) . ") VALUES (" . implode(',', $placeholders) . ")",
        $params
    );

    // Add watcher (Manager)
    if (!empty($data['watcher_id'])) {
        $db->insert(
            "INSERT INTO task_watchers (task_id, user_id, created_at) VALUES (?, ?, NOW())
             ON DUPLICATE KEY UPDATE task_id=task_id",
            [$id, $data['watcher_id']]
        );
    }

    return (int)$id;
}

function addWatcher($taskId, $userId) {
    $db = Database::getInstance();
    $db->insert(
        "INSERT IGNORE INTO task_watchers (task_id, user_id, created_at) VALUES (?, ?, NOW())",
        [$taskId, $userId]
    );
}

function createBill($data) {
    $db = Database::getInstance();
    $fields = ['store_id','title','vendor','amount','due_date','status','note','created_by','created_at'];
    $placeholders = array_fill(0, count($fields), '?');
    $params = [
        $data['store_id'], $data['title'], $data['vendor'] ?? null,
        $data['amount'] ?? null, $data['due_date'],
        $data['status'] ?? 'pending',
        $data['note'] ?? null,
        $data['created_by'] ?? getAdminId(),
        date('Y-m-d H:i:s'),
    ];
    return (int)$db->insert(
        "INSERT INTO bills (" . implode(',', $fields) . ") VALUES (" . implode(',', $placeholders) . ")",
        $params
    );
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────
echo "\n=== SEED: Stores / Tasks / Bills ===\n\n";

$adminId = getAdminId();
$managerId = getManagerId();

if (!$adminId) { echo "ERROR: No admin user found.\n"; exit(1); }
if (!$managerId) { echo "ERROR: No manager user found.\n"; exit(1); }

echo "Admin ID: $adminId | Manager ID: $managerId\n\n";

// ─── 1. STORES ─────────────────────────────────────────────────────────────────
echo "[1/5] Stores\n";

$sidModesto = storeExists('Modesto');
if ($sidModesto) {
    echo "  = Modesto already exists (ID=$sidModesto)\n";
} else {
    $sidModesto = createStore('Modesto', 'Modesto, CA', '#FF6B6B');
}
echo "  Store 'Raw' (Bakudan 2 & 3 - CPS): " . (storeExists('Raw') ? 'exists' : '(add manually or via existing)') . "\n";
echo "  Store 'IFT': " . ($iftSid = storeExists('IFT') ? "exists ID=$iftSid" : "NOT FOUND - will create") . "\n";
echo "  Store 'Heo Holding': " . ($hhSid = storeExists('Heo Holding') ? "exists ID=$hhSid" : "NOT FOUND - will create") . "\n";

$sidRaw = storeExists('Raw');
$sidBakudan1 = storeExists('Bakudan 1');
$sidBakudan2 = storeExists('Bakudan 2');
$sidBakudan3 = storeExists('Bakudan 3');

// ─── 2. MODESTO STORE + TASKS ─────────────────────────────────────────────────
echo "\n[2/5] Modesto Store + Amtrust Tasks\n";
if (!$sidModesto) {
    $sidModesto = createStore('Modesto', 'Modesto, CA', '#FF6B6B');
}

// Projects under Modesto
$pidAmtrust = projectExists('Amtrust', $sidModesto);
if (!$pidAmtrust) {
    $pidAmtrust = createProject('Amtrust', $sidModesto, $adminId, 'Amtrust insurance payments for Modesto location');
}

echo "  Tasks for Amtrust Modesto:\n";
$t = 'Pay Amtrust Modesto';
if (!taskExists($t, $pidAmtrust)) {
    $tid = createTask([
        'title' => $t,
        'project_id' => $pidAmtrust,
        'assignee_id' => $adminId,
        'watcher_id' => $managerId,
        'due_date' => '2026-04-02',
        'status' => 'completed',
        'is_completed' => 1,
        'completed_at' => '2026-04-01 14:00:00',
        'priority' => 'high',
        'description' => "Log on to make payment on policy.\n\nhttps://auth.amtrustgroup.com/AuthServer/account/login\n\nCredential is stored in the Credential Vault.",
    ]);
    addWatcher($tid, $managerId);
    echo "    + Task: $t (ID=$tid) - COMPLETED\n";
} else {
    echo "    = Task exists: $t\n";
}

// ─── 3. RAW STORE + TASKS ─────────────────────────────────────────────────────
echo "\n[3/5] Raw Store + Tax/Utility Tasks\n";

if (!$sidRaw) {
    echo "  ERROR: 'Raw' store not found. Please create it manually in the dashboard.\n";
} else {
    echo "  Raw store ID: $sidRaw\n";

    // Projects under Raw
    $pidRawStockton = projectExists('Raw Stockton', $sidRaw);
    if (!$pidRawStockton) {
        $pidRawStockton = createProject('Raw Stockton', $sidRaw, $adminId, 'Raw Stockton location financials');
    }

    $pidRawGeneral = projectExists('Raw General', $sidRaw);
    if (!$pidRawGeneral) {
        $pidRawGeneral = createProject('Raw General', $sidRaw, $adminId, 'Raw general tasks');
    }

    // 3a. Raw Stockton - Amtrust (image 3)
    echo "  Tasks for Raw Stockton - Amtrust:\n";
    $t = 'Amtrust Stockton payment';
    if (!taskExists($t, $pidRawStockton)) {
        $tid = createTask([
            'title' => $t,
            'project_id' => $pidRawStockton,
            'assignee_id' => $adminId,
            'watcher_id' => $managerId,
            'due_date' => '2026-04-05',
            'status' => 'completed',
            'is_completed' => 1,
            'completed_at' => '2026-04-05 10:00:00',
            'priority' => 'high',
            'description' => "Make payment base on schedule. Using 9804 account please send email to notify Hoang of pending payment and checking account balance.\n\nLogin ID: rawstockton209\nPassword: Rawsushi\$2\n\nhttps://auth.amtrustgroup.com/AuthServer/account/login",
        ]);
        addWatcher($tid, $managerId);
        echo "    + Task: $t (ID=$tid) - COMPLETED\n";
    } else {
        echo "    = Task exists: $t\n";
    }

    // 3b. Raw - Sale Tax Q2 / Quarterly Forms (image 7 + 9)
    echo "  Tasks for Raw - Sale Tax:\n";
    $t = 'Raw Venture - Fill Tax';
    if (!taskExists($t, $pidRawStockton)) {
        $tid = createTask([
            'title' => $t,
            'project_id' => $pidRawStockton,
            'assignee_id' => $adminId,
            'watcher_id' => $managerId,
            'due_date' => '2026-04-08',
            'status' => 'completed',
            'is_completed' => 1,
            'completed_at' => '2026-04-08 15:00:00',
            'priority' => 'high',
            'description' => "Express Login: a372846u\nAccount Number: 103025103\n\nFile Q2 quarterly tax on QuickBooks",
        ]);
        addWatcher($tid, $managerId);
        echo "    + Task: $t (ID=$tid) - COMPLETED\n";
    } else {
        echo "    = Task exists: $t\n";
    }

    // 3c. Raw - Sale Tax Quarterly (separate project)
    $pidRawSaleTax = projectExists('Raw Sale Tax', $sidRaw);
    if (!$pidRawSaleTax) {
        $pidRawSaleTax = createProject('Raw Sale Tax', $sidRaw, $adminId, 'Raw sale tax filings');
    }

    $t = 'Raw - Sale Tax';
    if (!taskExists($t, $pidRawSaleTax)) {
        $tid = createTask([
            'title' => $t,
            'project_id' => $pidRawSaleTax,
            'assignee_id' => $adminId,
            'watcher_id' => $managerId,
            'due_date' => '2026-04-25',    // ~25th of month after Q2
            'status' => 'pending',
            'is_completed' => 0,
            'priority' => 'high',
            'description' => "Quarterly Sale Tax filing for Raw Stockton. Use QB for form filling. Due: Apr 25 (for Q2 Apr-Jun cycle).",
        ]);
        addWatcher($tid, $managerId);
        echo "    + Task: $t (ID=$tid) - PENDING\n";
    } else {
        echo "    = Task exists: $t\n";
    }

    // 3d. Stockon - Prepayment Sale & Use Tax (image 8)
    echo "  Tasks for Stockton - Prepayment:\n";
    $pidPrepay = projectExists('Stockton - Prepayment', $sidRaw);
    if (!$pidPrepay) {
        $pidPrepay = createProject('Stockton - Prepayment', $sidRaw, $adminId, 'Stockton prepayment tax');
    }

    $t = 'Stockton - Prepayment Tax';
    if (!taskExists($t, $pidPrepay)) {
        $tid = createTask([
            'title' => $t,
            'project_id' => $pidPrepay,
            'assignee_id' => $adminId,
            'watcher_id' => $managerId,
            'due_date' => '2026-04-08',
            'status' => 'completed',
            'is_completed' => 1,
            'completed_at' => '2026-04-08 14:00:00',
            'priority' => 'high',
            'description' => "Express Login: t663382h\nAccount Number: 100772059\n\nhttps://online.amtrustgroup.com/live/webapp-insureds/login",
        ]);
        addWatcher($tid, $managerId);
        echo "    + Task: $t (ID=$tid) - COMPLETED\n";
    } else {
        echo "    = Task exists: $t\n";
    }

    // 3e. Raw - Fill De9, De9C, 941 Form - QB (image 6)
    $pidQBTax = projectExists('Raw QB Tax', $sidRaw);
    if (!$pidQBTax) {
        $pidQBTax = createProject('Raw QB Tax', $sidRaw, $adminId, 'QuickBooks tax forms for Raw');
    }

    $t = 'Fill De9 (UIC), De9C (UIC) and 941 Form - QB';
    if (!taskExists($t, $pidQBTax)) {
        $tid = createTask([
            'title' => $t,
            'project_id' => $pidQBTax,
            'assignee_id' => $adminId,
            'watcher_id' => $managerId,
            'due_date' => '2026-04-08',
            'status' => 'completed',
            'is_completed' => 1,
            'completed_at' => '2026-04-08 16:00:00',
            'priority' => 'high',
            'description' => "Fill De9 (UIC), De9C (UIC) and 941 Form on QuickBooks. Due by end of Q2 reporting period.",
        ]);
        addWatcher($tid, $managerId);
        echo "    + Task: $t (ID=$tid) - COMPLETED\n";
    } else {
        echo "    = Task exists: $t\n";
    }

    // 3f. PGE of Raw (image 10)
    $pidPGE = projectExists('Raw PGE', $sidRaw);
    if (!$pidPGE) {
        $pidPGE = createProject('Raw PGE', $sidRaw, $adminId, 'PGE utility payments for Raw Stockton');
    }

    $t = 'Stockton - PGE';
    if (!taskExists($t, $pidPGE)) {
        $tid = createTask([
            'title' => $t,
            'project_id' => $pidPGE,
            'assignee_id' => $adminId,
            'watcher_id' => $managerId,
            'due_date' => '2026-04-27',
            'status' => 'pending',
            'is_completed' => 0,
            'priority' => 'medium',
            'description' => "PGE payment for Raw Stockton. Account: rawsushi / afroken",
        ]);
        addWatcher($tid, $managerId);
        echo "    + Task: $t (ID=$tid) - PENDING\n";
    } else {
        echo "    = Task exists: $t\n";
    }
}

// ─── 4. BAKUDAN 2 & 3 - CPS ENERGY BILLS ──────────────────────────────────────
echo "\n[4/5] CPS Energy Bills (Bakudan 2 & 3)\n";

// Map store names from DB to IDs
$b2Sid = $sidBakudan2 ?: storeExists('B2');
$b3Sid = $sidBakudan3 ?: storeExists('Bakudan - Bandera (B3)');
$b1Sid = $sidBakudan1 ?: storeExists('Bakudan - The Rim (B1)');
$b1HpSid = storeExists('Bakudan - HP');

if (!$b2Sid) { echo "  Bakudan 2 not found in DB - skipping B2 bills.\n"; }
if (!$b3Sid) { echo "  Bakudan 3 not found in DB - skipping B3 bills.\n"; }
if (!$b1Sid) { echo "  Bakudan 1 not found in DB - skipping B1 bills.\n"; }
if (!$b1HpSid) { echo "  Bakudan 1 - HP not found in DB - skipping B1-HP bills.\n"; }

// Helper to check if bill already exists
function billExists($storeId, $title) {
    $db = Database::getInstance();
    $b = $db->fetch(
        "SELECT id FROM bills WHERE store_id = ? AND LOWER(title) = LOWER(?) LIMIT 1",
        [$storeId, $title]
    );
    return $b ? (int)$b['id'] : null;
}

function upsertBill($data) {
    $existing = billExists($data['store_id'], $data['title']);
    if ($existing) {
        echo "    = Bill exists: {$data['title']} (ID=$existing)\n";
        return $existing;
    }
    $id = createBill($data);
    echo "    + Bill: {$data['title']} (ID=$id)\n";
    return $id;
}

if ($b1Sid) {
    echo "  B1 Bills:\n";
    upsertBill(['store_id'=>$b1Sid,'title'=>'CPS Energy B1','vendor'=>'CPS Energy',
        'amount'=>2806.64,'due_date'=>'2026-04-10','status'=>'paid',
        'note'=>'Service: 22506 N US Highway 281 #106','created_by'=>$adminId]);
    upsertBill(['store_id'=>$b1Sid,'title'=>'CPS Energy B1 #2','vendor'=>'CPS Energy',
        'amount'=>1145.21,'due_date'=>'2026-04-10','status'=>'paid',
        'note'=>'Service: 11309 BANDERA RD','created_by'=>$adminId]);
    upsertBill(['store_id'=>$b1Sid,'title'=>'CPS Energy B1 Monthly','vendor'=>'CPS Energy',
        'amount'=>0,'due_date'=>'2026-05-10','status'=>'pending',
        'note'=>'Monthly electricity bill - service address TBD','created_by'=>$adminId]);
}

if ($b1HpSid) {
    echo "  B1-HP Bills:\n";
    upsertBill(['store_id'=>$b1HpSid,'title'=>'CPS Energy B1-HP','vendor'=>'CPS Energy',
        'amount'=>1649.79,'due_date'=>'2026-04-10','status'=>'paid',
        'note'=>'Service: 10640 CULEBRA RD','created_by'=>$adminId]);
}

if ($b2Sid) {
    echo "  B2 Bills:\n";
    upsertBill(['store_id'=>$b2Sid,'title'=>'CPS Energy B2','vendor'=>'CPS Energy',
        'amount'=>2116.74,'due_date'=>'2026-04-10','status'=>'paid',
        'note'=>'Service: 22506 N US Highway 281 #106, File: B2','created_by'=>$adminId]);
    upsertBill(['store_id'=>$b2Sid,'title'=>'CPS Energy B2 #2','vendor'=>'CPS Energy',
        'amount'=>2116.74,'due_date'=>'2026-04-10','status'=>'paid',
        'note'=>'Service: 11309 BANDERA RD, File: B2','created_by'=>$adminId]);
    upsertBill(['store_id'=>$b2Sid,'title'=>'CPS Energy B2 Monthly','vendor'=>'CPS Energy',
        'amount'=>0,'due_date'=>'2026-05-10','status'=>'pending',
        'note'=>'Monthly electricity - B2 - Heo / x8816','created_by'=>$adminId]);
}

if ($b3Sid) {
    echo "  B3 Bills:\n";
    upsertBill(['store_id'=>$b3Sid,'title'=>'CPS Energy B3','vendor'=>'CPS Energy',
        'amount'=>1798.19,'due_date'=>'2026-04-10','status'=>'paid',
        'note'=>'Service: 22506 N US Highway 281 #106, File: B3','created_by'=>$adminId]);
    upsertBill(['store_id'=>$b3Sid,'title'=>'CPS Energy B3 #2','vendor'=>'CPS Energy',
        'amount'=>1798.19,'due_date'=>'2026-04-10','status'=>'paid',
        'note'=>'Service: 11309 BANDERA RD, File: B3','created_by'=>$adminId]);
    upsertBill(['store_id'=>$b3Sid,'title'=>'CPS Energy B3 Monthly','vendor'=>'CPS Energy',
        'amount'=>0,'due_date'=>'2026-05-10','status'=>'pending',
        'note'=>'Monthly electricity - B3 - Heo / x9390','created_by'=>$adminId]);
}

// ─── 5. IFT + HEO HOLDING STORES ──────────────────────────────────────────────
echo "\n[5/5] IFT + Heo Holding Sale Tax Tasks\n";

// IFT store
$sidIFT = storeExists('IFT');
if (!$sidIFT) {
    $sidIFT = createStore('IFT', 'San Antonio, TX', '#6C5CE7');
}

$pidIFTTax = projectExists('IFT Sale Tax', $sidIFT);
if (!$pidIFTTax) {
    $pidIFTTax = createProject('IFT Sale Tax', $sidIFT, $adminId, 'IFT quarterly sale tax filings');
}

$t = 'IFT - Sale Tax';
if (!taskExists($t, $pidIFTTax)) {
    $tid = createTask([
        'title' => $t,
        'project_id' => $pidIFTTax,
        'assignee_id' => $adminId,
        'watcher_id' => $managerId,
        'due_date' => '2026-04-25',
        'status' => 'pending',
        'is_completed' => 0,
        'priority' => 'high',
        'description' => "Quarterly Sale Tax filing for IFT. Check Mixed Beverage Sales Tax portal and Mixed Beverage Gross Receipts Tax portal. File by Apr 25.",
    ]);
    addWatcher($tid, $managerId);
    echo "  + Task: $t (ID=$tid) - PENDING\n";
} else {
    echo "  = Task exists: $t\n";
}

// Heo Holding store
$sidHeo = storeExists('Heo Holding');
if (!$sidHeo) {
    $sidHeo = createStore('Heo Holding', 'San Antonio, TX', '#00B894');
}

$pidHeoTax = projectExists('Heo Holding Sale Tax', $sidHeo);
if (!$pidHeoTax) {
    $pidHeoTax = createProject('Heo Holding Sale Tax', $sidHeo, $adminId, 'Heo Holding quarterly sale tax filings');
}

$t = 'Heo Holding - Sale Tax';
if (!taskExists($t, $pidHeoTax)) {
    $tid = createTask([
        'title' => $t,
        'project_id' => $pidHeoTax,
        'assignee_id' => $adminId,
        'watcher_id' => $managerId,
        'due_date' => '2026-04-25',
        'status' => 'pending',
        'is_completed' => 0,
        'priority' => 'high',
        'description' => "Quarterly Sale Tax filing for Heo Holding (Bakudan locations). Use the state tax portal. File by Apr 25 for Q2 cycle.",
    ]);
    addWatcher($tid, $managerId);
    echo "  + Task: $t (ID=$tid) - PENDING\n";
} else {
    echo "  = Task exists: $t\n";
}

echo "\n=== SEED COMPLETE ===\n";
echo "\nNext steps:\n";
echo "1. Visit dashboard.bakudanramen.com/bills - check CPS bills are listed\n";
echo "2. Visit dashboard.bakudanramen.com/overview - check Modesto, IFT, Heo Holding stores\n";
echo "3. Check Executive Dashboard for pending Sale Tax tasks\n";
echo "\n";
