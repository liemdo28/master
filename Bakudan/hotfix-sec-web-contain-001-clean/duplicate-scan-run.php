<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('html_errors', 0);

header('Content-Type: text/plain');
echo "alive\n";

try {
    $pdo = new PDO("mysql:host=mysql-taskflow.bakudanramen.com;dbname=taskflow_db;charset=utf8mb4", 'liemdo', 'liem@dt2155', [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_SILENT,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    echo "db_ok\n";

    // Tasks
    $r = $pdo->query("SELECT COUNT(*) AS cnt FROM tasks WHERE deleted_at IS NULL");
    $tasks = $r ? (int)$r->fetch()['cnt'] : 0;
    echo "tasks: $tasks\n";

    // Bills
    $r = $pdo->query("SELECT COUNT(*) AS cnt FROM bills WHERE (is_archived=0 OR is_archived IS NULL)");
    $bills = $r ? (int)$r->fetch()['cnt'] : 0;
    echo "bills: $bills\n";

    // Vendors
    $r = $pdo->query("SHOW TABLES LIKE 'vendors'");
    $hasVendors = $r && $r->fetch();
    $vendors = 0;
    if ($hasVendors) {
        $r = $pdo->query("SELECT COUNT(*) AS cnt FROM vendors");
        $vendors = $r ? (int)$r->fetch()['cnt'] : 0;
    }
    echo "vendors: $vendors (exists: " . ($hasVendors ? 'yes' : 'no') . ")\n";

    // Obligations
    $r = $pdo->query("SHOW TABLES LIKE 'obligations'");
    $hasObl = $r && $r->fetch();
    $obligations = 0;
    if ($hasObl) {
        $r = $pdo->query("SELECT COUNT(*) AS cnt FROM obligations WHERE active=1");
        $obligations = $r ? (int)$r->fetch()['cnt'] : 0;
    }
    echo "obligations: $obligations (exists: " . ($hasObl ? 'yes' : 'no') . ")\n";

    // Payments
    $r = $pdo->query("SHOW TABLES LIKE 'payments'");
    $hasPay = $r && $r->fetch();
    $payments = 0;
    if ($hasPay) {
        $r = $pdo->query("SELECT COUNT(*) AS cnt FROM payments");
        $payments = $r ? (int)$r->fetch()['cnt'] : 0;
    }
    echo "payments: $payments (exists: " . ($hasPay ? 'yes' : 'no') . ")\n";

    // Task duplicates: title + store + assignee
    $r = $pdo->query("SELECT t.title, COALESCE(s.name,'(none)') AS store, COALESCE(u.name,'(none)') AS assignee, COUNT(*) AS cnt, GROUP_CONCAT(t.id ORDER BY t.id) AS ids FROM tasks t LEFT JOIN stores s ON s.id=t.store_id LEFT JOIN users u ON u.id=t.assigned_to WHERE t.deleted_at IS NULL GROUP BY t.title, s.name, u.name HAVING COUNT(*) > 1");
    $taskDups = $r ? $r->fetchAll() : [];
    echo "task_duplicates: " . count($taskDups) . "\n";
    foreach ($taskDups as $d) echo "  [{$d['cnt']}] {$d['title']} | {$d['store']} | {$d['assignee']} | ids={$d['ids']}\n";

    // Bill duplicates: title + store + due_date
    $r = $pdo->query("SELECT b.title, s.name AS store, b.due_date, COUNT(*) AS cnt, GROUP_CONCAT(b.id ORDER BY b.id) AS ids FROM bills b JOIN stores s ON s.id=b.store_id WHERE (b.is_archived=0 OR b.is_archived IS NULL) GROUP BY b.title, s.name, b.due_date HAVING COUNT(*) > 1");
    $billDups = $r ? $r->fetchAll() : [];
    echo "bill_exact_duplicates: " . count($billDups) . "\n";
    foreach ($billDups as $d) echo "  [{$d['cnt']}] {$d['title']} | {$d['store']} | {$d['due_date']} | ids={$d['ids']}\n";

    // Bill soft duplicates: title + store + amount
    $r = $pdo->query("SELECT b.title, s.name AS store, b.amount, COUNT(*) AS cnt, GROUP_CONCAT(b.id ORDER BY b.id) AS ids FROM bills b JOIN stores s ON s.id=b.store_id WHERE (b.is_archived=0 OR b.is_archived IS NULL) GROUP BY b.title, s.name, b.amount HAVING COUNT(*) > 1");
    $billSoft = $r ? $r->fetchAll() : [];
    echo "bill_soft_duplicates: " . count($billSoft) . "\n";
    foreach ($billSoft as $d) echo "  [{$d['cnt']}] {$d['title']} | {$d['store']} | \${$d['amount']} | ids={$d['ids']}\n";

    // Vendor duplicates
    if ($hasVendors) {
        $r = $pdo->query("SELECT name, COUNT(*) AS cnt, GROUP_CONCAT(id ORDER BY id) AS ids FROM vendors GROUP BY name HAVING COUNT(*) > 1");
        $vendDups = $r ? $r->fetchAll() : [];
        echo "vendor_duplicates: " . count($vendDups) . "\n";
        foreach ($vendDups as $d) echo "  [{$d['cnt']}] {$d['name']} | ids={$d['ids']}\n";
    }

    // Obligation duplicates
    if ($hasObl) {
        $r = $pdo->query("SELECT name, store_name, COUNT(*) AS cnt, GROUP_CONCAT(id ORDER BY id) AS ids FROM obligations WHERE active=1 GROUP BY name, store_name HAVING COUNT(*) > 1");
        $oblDups = $r ? $r->fetchAll() : [];
        echo "obligation_duplicates: " . count($oblDups) . "\n";
        foreach ($oblDups as $d) echo "  [{$d['cnt']}] {$d['name']} | {$d['store_name']} | ids={$d['ids']}\n";
    }

    // Payment duplicates
    if ($hasPay) {
        $r = $pdo->query("SELECT bill_id, paid_at, COUNT(*) AS cnt, GROUP_CONCAT(id ORDER BY id) AS ids FROM payments GROUP BY bill_id, paid_at HAVING COUNT(*) > 1");
        $payDups = $r ? $r->fetchAll() : [];
        echo "payment_duplicates: " . count($payDups) . "\n";
        foreach ($payDups as $d) echo "  [{$d['cnt']}] bill_id={$d['bill_id']} | paid_at={$d['paid_at']} | ids={$d['ids']}\n";
    }

    echo "DONE\n";

} catch (Throwable $e) {
    echo "ERROR: " . $e->getMessage() . " at " . $e->getFile() . ":" . $e->getLine() . "\n";
}
