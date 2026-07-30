<?php
// Add B3 (Bandera) CPS bills - run: php add_b3_bills.php
require_once __DIR__ . '/database.php';
$db = Database::getInstance();
$b3 = 7; // Bakudan - Bandera (B3) store ID
$adminId = 1;
$bills = [
    [$b3, "CPS Energy B3", "CPS Energy", 1798.19, "2026-04-10", "paid", "Service: 22506 N US Highway 281 #106, File: B3"],
    [$b3, "CPS Energy B3 #2", "CPS Energy", 1798.19, "2026-04-10", "paid", "Service: 11309 BANDERA RD, File: B3"],
    [$b3, "CPS Energy B3 Monthly", "CPS Energy", 0, "2026-05-10", "pending", "Monthly electricity - B3 - Heo / x9390"],
];
foreach ($bills as $b) {
    list($storeId, $title, $vendor, $amount, $dueDate, $status, $note) = $b;
    $exists = $db->fetch("SELECT id FROM bills WHERE store_id=? AND title=? LIMIT 1", [$storeId, $title]);
    if ($exists) { echo "exists: $title\n"; continue; }
    $id = $db->insert(
        "INSERT INTO bills (store_id, title, vendor, amount, due_date, status, note, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())",
        [$storeId, $title, $vendor, $amount, $dueDate, $status, $note, $adminId]
    );
    echo "created($id): $title\n";
}
echo "Done.\n";