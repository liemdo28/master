<?php
/**
 * seed_v9_data.php
 * Seeds test data for Task/Bill Finance V9 system.
 * Run via: php seed_v9_data.php
 * Or via browser: /seed_v9_data.php
 */

require_once __DIR__ . '/database.php';

$db = Database::getInstance();

// Only run if logged in as admin (for browser access)
if (php_sapi_name() !== 'cli' && (!isset($_SESSION['user_id']) || !canAdmin())) {
    die('Admin access required');
}

echo "=== V9 Seed Data ===\n\n";

// Helper: get a user
function seedUser($name) {
    global $db;
    return $db->fetch("SELECT id FROM users WHERE name LIKE ? LIMIT 1", ["%$name%"]);
}
function seedStore($name) {
    global $db;
    return $db->fetch("SELECT id FROM stores WHERE name LIKE ? LIMIT 1", ["%$name%"]);
}
function seedProject($name) {
    global $db;
    return $db->fetch("SELECT id FROM projects WHERE name LIKE ? LIMIT 1", ["%$name%"]);
}

// Get base data
$admin = seedUser('Admin') ?: $db->fetch("SELECT id FROM users LIMIT 1");
$store = seedStore('Raw') ?: $db->fetch("SELECT id FROM stores LIMIT 1");
$project = $db->fetch("SELECT id FROM projects LIMIT 1");

$adminId = $admin ? (int)$admin['id'] : 1;
$storeId = $store ? (int)$store['id'] : 1;
$projectId = $project ? (int)$project['id'] : 1;

echo "Using admin_id=$adminId, store_id=$storeId, project_id=$projectId\n\n";

// ── 1. Sample bills by category ──────────────────────────────────
echo "1. Creating sample bills...\n";

$bills = [
    // Payroll
    ['title' => 'Bi-weekly Payroll - Raw Stockton', 'category' => 'payroll', 'amount' => 8500, 'due' => date('Y-m-d', strtotime('+3 days'))],
    ['title' => 'Bi-weekly Payroll - Raw General', 'category' => 'payroll', 'amount' => 6200, 'due' => date('Y-m-d', strtotime('+3 days'))],
    ['title' => 'Monthly Payroll Tax Deposit', 'category' => 'payroll', 'amount' => 3200, 'due' => date('Y-m-d', strtotime('+10 days'))],
    // Tax
    ['title' => 'Quarterly State Tax - Q2 2026', 'category' => 'tax', 'amount' => 4500, 'due' => date('Y-m-d', strtotime('+15 days'))],
    ['title' => 'Federal Tax Estimate - Q2', 'category' => 'tax', 'amount' => 6800, 'due' => date('Y-m-d', strtotime('+15 days'))],
    ['title' => 'Sales Tax Filing - Monthly', 'category' => 'tax', 'amount' => 1200, 'due' => date('Y-m-d', strtotime('+5 days'))],
    // Rent
    ['title' => 'Rent - Raw Stockton Location', 'category' => 'rent', 'amount' => 5500, 'due' => date('Y-m-d', strtotime('+1 day'))],
    ['title' => 'Rent - Heo Downtown', 'category' => 'rent', 'amount' => 4200, 'due' => date('Y-m-d', strtotime('+7 days'))],
    // Utility
    ['title' => 'PGE Electric - Monthly', 'category' => 'utility', 'amount' => 890, 'due' => date('Y-m-d', strtotime('+2 days'))],
    ['title' => 'Water & Sewer - Monthly', 'category' => 'utility', 'amount' => 340, 'due' => date('Y-m-d', strtotime('+8 days'))],
    // Vendor
    ['title' => 'Food Supplier - Fresh Produce', 'category' => 'vendor', 'amount' => 2100, 'due' => date('Y-m-d', strtotime('+5 days'))],
    ['title' => 'Kitchen Equipment Repair', 'category' => 'vendor', 'amount' => 750, 'due' => date('Y-m-d', strtotime('+12 days'))],
    // Insurance
    ['title' => 'Liability Insurance - Monthly', 'category' => 'insurance', 'amount' => 480, 'due' => date('Y-m-d', strtotime('+20 days'))],
    ['title' => 'Workers Comp Insurance - Q2', 'category' => 'insurance', 'amount' => 1200, 'due' => date('Y-m-d', strtotime('+18 days'))],
    // Other
    ['title' => 'POS System Subscription', 'category' => 'other', 'amount' => 199, 'due' => date('Y-m-d', strtotime('+6 days'))],
];

$billStatuses = ['checking', 'checking', 'accepted', 'paid']; // weighted toward pending

foreach ($bills as $b) {
    $status = array_shift($billStatuses);
    if (empty($billStatuses)) $billStatuses = ['checking', 'checking', 'accepted', 'paid'];
    
    $existing = $db->fetch("SELECT id FROM bills WHERE title = ? LIMIT 1", [$b['title']]);
    if ($existing) {
        echo "  SKIP (exists): {$b['title']}\n";
        continue;
    }

    $db->insert(
        "INSERT INTO bills (store_id, title, amount, due_date, status, finance_category, workflow_status, created_at)
         VALUES (?, ?, ?, ?, 'pending', ?, ?, NOW())",
        [$storeId, $b['title'], $b['amount'], $b['due'], $b['category'], $status]
    );
    echo "  CREATED: {$b['title']} ({$b['category']})\n";
}

// ── 2. Sample payments ─────────────────────────────────────────────
echo "\n2. Creating sample payments...\n";

$paidBills = $db->fetchAll(
    "SELECT id, amount, finance_category FROM bills WHERE workflow_status = 'paid' LIMIT 5"
);
$checkingBills = $db->fetchAll(
    "SELECT id, amount, finance_category FROM bills WHERE workflow_status IN ('checking','accepted') LIMIT 5"
);

$paymentMethods = ['bank_transfer', 'cash', 'check', 'card'];

foreach ($paidBills as $bill) {
    $existing = $db->fetch("SELECT id FROM payments WHERE bill_id = ? LIMIT 1", [(int)$bill['id']]);
    if ($existing) continue;
    
    $db->insert(
        "INSERT INTO payments (bill_id, amount, paid_at, method, created_by)
         VALUES (?, ?, ?, ?, ?)",
        [(int)$bill['id'], (float)$bill['amount'], date('Y-m-d H:i:s', strtotime('-3 days')), $paymentMethods[array_rand($paymentMethods)], $adminId]
    );
    echo "  PAYMENT: Bill #{$bill['id']} ({$bill['finance_category']})\n";
}

foreach ($checkingBills as $bill) {
    $existing = $db->fetch("SELECT id FROM payments WHERE bill_id = ? LIMIT 1", [(int)$bill['id']]);
    if ($existing) continue;
    
    $partialAmount = (float)$bill['amount'] * 0.5;
    $db->insert(
        "INSERT INTO payments (bill_id, amount, paid_at, method, created_by)
         VALUES (?, ?, ?, ?, ?)",
        [(int)$bill['id'], $partialAmount, date('Y-m-d H:i:s', strtotime('-1 day')), 'bank_transfer', $adminId]
    );
    echo "  PARTIAL: Bill #{$bill['id']} ({$bill['finance_category']}) = " . number_format($partialAmount, 2) . "\n";
}

// ── 3. Sample tasks by category ──────────────────────────────────
echo "\n3. Creating sample tasks...\n";

$taskCategories = ['payroll', 'tax', 'sale_receipt', 'bill', 'payment', 'store_operation', 'admin'];
$taskTitles = [
    'payroll' => [
        'Process bi-weekly payroll',
        'Submit payroll tax forms',
        'Review payroll deductions',
        'File quarterly payroll reports',
    ],
    'tax' => [
        'Prepare quarterly tax estimate',
        'File monthly sales tax return',
        'Review tax deductions',
        'Submit CDTFA quarterly filing',
    ],
    'sale_receipt' => [
        'Enter daily sale receipts - Heo',
        'Enter weekly POS reconciliation',
        'Submit monthly revenue report',
        'Record cash receipts',
    ],
    'bill' => [
        'Review vendor invoice #1234',
        'Approve utility payment',
        'Process insurance renewal',
        'Match PO to vendor bill',
    ],
    'payment' => [
        'Record bank transfer payment',
        'Reconcile credit card payments',
        'Process ACH vendor payment',
        'Record cash payment',
    ],
    'store_operation' => [
        'Weekly inventory count',
        'Staff schedule review',
        'Equipment maintenance check',
        'Health inspection prep',
    ],
    'admin' => [
        'Review monthly financials',
        'Update employee records',
        'Board meeting prep',
        'Policy review Q2',
    ],
];

// Ensure task_category column exists
$hasCategory = $db->columnExists('tasks', 'task_category');

$assignees = $db->fetchAll("SELECT id FROM users WHERE is_active = 1 LIMIT 5");
$assigneeIds = array_column($assignees, 'id');
if (empty($assigneeIds)) $assigneeIds = [$adminId];

foreach ($taskTitles as $cat => $titles) {
    foreach ($titles as $i => $title) {
        $due = date('Y-m-d', strtotime("+" . ($i * 2 + 1) . " days"));
        $assigneeId = $assigneeIds[array_rand($assigneeIds)];
        
        $existing = $db->fetch("SELECT id FROM tasks WHERE title = ? AND due_date = ? LIMIT 1", [$title, $due]);
        if ($existing) {
            echo "  SKIP: $title\n";
            continue;
        }

        $sql = "INSERT INTO tasks (project_id, title, assignee_id, due_date, priority, status, created_by, visibility, accepted_at";
        $val = "VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW()";
        $params = [$projectId, $title, $assigneeId, $due, 'medium', 'todo', $adminId, 'public'];

        if ($hasCategory) {
            $sql .= ", task_category";
            $val .= ", ?";
            $params[] = $cat;
        }

        $sql .= ") " . $val . ")";
        $db->insert($sql, $params);
        echo "  TASK: [$cat] $title\n";
    }
}

// ── 4. Tasks with workflow states ─────────────────────────────────
echo "\n4. Creating workflow task samples...\n";

$workflowTasks = [
    ['title' => 'Submit Q2 Tax Filing - Verified', 'cat' => 'tax', 'stage' => 'submitted'],
    ['title' => 'Payroll Tax Submitted - Pending Check', 'cat' => 'payroll', 'stage' => 'submitted'],
    ['title' => 'Sales Tax Accepted by Manager', 'cat' => 'tax', 'stage' => 'checking'],
    ['title' => 'Vendor Invoice Checked', 'cat' => 'bill', 'stage' => 'checking'],
    ['title' => 'Rent Payment Accepted', 'cat' => 'bill', 'stage' => 'accepted'],
    ['title' => 'Insurance Filing Approved', 'cat' => 'payroll', 'stage' => 'accepted'],
    ['title' => 'Tax Filing Rejected - Missing Form', 'cat' => 'tax', 'stage' => 'rejected'],
];

$statusMap = [
    'submitted' => ['submitted_at' => date('Y-m-d H:i:s', strtotime('-2 days')), 'submitted_by' => $adminId],
    'checking' => ['submitted_at' => date('Y-m-d H:i:s', strtotime('-3 days')), 'submitted_by' => $adminId,
                   'checked_at' => date('Y-m-d H:i:s', strtotime('-1 day')), 'checked_by' => $adminId],
    'accepted' => ['submitted_at' => date('Y-m-d H:i:s', strtotime('-5 days')), 'submitted_by' => $adminId,
                   'checked_at' => date('Y-m-d H:i:s', strtotime('-3 days')), 'checked_by' => $adminId,
                   'accepted_workflow_at' => date('Y-m-d H:i:s', strtotime('-1 day')), 'accepted_workflow_by' => $adminId],
    'rejected' => ['submitted_at' => date('Y-m-d H:i:s', strtotime('-4 days')), 'submitted_by' => $adminId,
                   'rejected_at' => date('Y-m-d H:i:s', strtotime('-2 days')), 'rejected_by' => $adminId, 'rejection_reason' => 'Missing supporting documentation'],
];

foreach ($workflowTasks as $t) {
    $existing = $db->fetch("SELECT id FROM tasks WHERE title = ? LIMIT 1", [$t['title']]);
    if ($existing) {
        echo "  SKIP: {$t['title']}\n";
        continue;
    }

    $wf = $statusMap[$t['stage']] ?? $statusMap['submitted'];
    $assigneeId = $assigneeIds[array_rand($assigneeIds)];

    $sql = "INSERT INTO tasks (project_id, title, assignee_id, due_date, priority, status, created_by, visibility, accepted_at";
    $params = [$projectId, $t['title'], $assigneeId, date('Y-m-d', strtotime('+7 days')), 'high', 'review', $adminId, 'public', date('Y-m-d H:i:s', strtotime('-7 days'))];

    if ($hasCategory) {
        $sql .= ", task_category";
        $params[] = $t['cat'];
    }

    $wfFields = ['submitted_at','submitted_by','checked_at','checked_by','accepted_workflow_at','accepted_workflow_by','rejected_at','rejected_by','rejection_reason'];
    foreach ($wfFields as $f) {
        if (isset($wf[$f])) {
            $sql .= ", $f";
            $params[] = $wf[$f];
        }
    }

    $sql .= ") " . str_repeat("?,", count($params) - 1) . "?)";
    $db->insert($sql, $params);
    echo "  WORKFLOW TASK: [{$t['stage']}] {$t['title']}\n";
}

// ── 5. Intentional duplicate tasks for testing ─────────────────────
echo "\n5. Creating duplicate task samples...\n";

$dupTitles = [
    'Enter daily sale receipts',
    'Process payroll',
    'Submit tax filing',
];

foreach ($dupTitles as $title) {
    // Create 2-3 tasks with same title, assignee, due date
    $due = date('Y-m-d', strtotime('+5 days'));
    for ($i = 0; $i < 2; $i++) {
        $existing = $db->fetch(
            "SELECT id FROM tasks WHERE title = ? AND due_date = ? LIMIT 1",
            [$title, $due]
        );
        if (!$existing) {
            $db->insert(
                "INSERT INTO tasks (project_id, title, assignee_id, due_date, priority, status, created_by, visibility, accepted_at, is_completed)
                 VALUES (?, ?, ?, ?, 'medium', 'todo', ?, 'private', NOW(), 0)",
                [$projectId, $title, $assigneeIds[0], $due, $adminId]
            );
            echo "  DUPLICATE: $title (due: $due)\n";
        }
    }
}

echo "\n=== Seed Complete ===\n";
echo "Visit /admin/tasks/duplicates to see duplicate audit.\n";
echo "Visit /admin/tasks/workflow to see workflow stages.\n";
echo "Visit /admin/tasks/all to see all tasks CEO view.\n";
