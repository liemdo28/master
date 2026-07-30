<?php
/**
 * Migration: Add recurring bills support
 * - Add repeat_rule column to bills
 * - Create recurring_bill_history table
 * - Mark existing recurring templates
 */
error_reporting(E_ALL);
ini_set('display_errors', 1);
header('Content-Type: text/plain');

require_once __DIR__ . '/config/database.php';
$db = Database::getInstance();

echo "=== RECURRING BILLS MIGRATION ===\n\n";

try {
    // 1. Add repeat_rule column
    echo "1. Adding repeat_rule column to bills...\n";
    $db->exec("ALTER TABLE bills ADD COLUMN repeat_rule VARCHAR(20) DEFAULT NULL AFTER category");
    echo "   OK\n\n";
} catch (Exception $e) {
    echo "   Skipped: " . $e->getMessage() . "\n\n";
}

try {
    // 2. Create recurring_bill_history table
    echo "2. Creating recurring_bill_history table...\n";
    $db->exec("CREATE TABLE IF NOT EXISTS recurring_bill_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        template_bill_id INT NOT NULL,
        generated_bill_id INT DEFAULT NULL,
        recurrence_period VARCHAR(20) NOT NULL,
        original_due_date DATE NOT NULL,
        new_due_date DATE NOT NULL,
        generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_template (template_bill_id),
        INDEX idx_generated (generated_bill_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    echo "   OK\n\n";
} catch (Exception $e) {
    echo "   Skipped: " . $e->getMessage() . "\n\n";
}

// 3. Show current bills for manual marking
echo "3. Current active bills (need repeat_rule assignment):\n";
$billNames = [
    1 => 'Amtrust',
    2 => 'Heo Holding Sale Tax',
    3 => 'IFT Sale Tax',
    4 => 'Raw General',
    5 => 'Raw PGE',
    6 => 'Raw QB Tax',
    7 => 'Raw Sale Tax',
    8 => 'Stockton - Prepayment',
    9 => 'Fire',
    10 => 'Fire',
    11 => 'Fire',
];

$stores = [
    2 => 'Raw Stockton',
    5 => 'B1',
    6 => 'B2',
    7 => 'B3',
    8 => 'IFT',
    11 => 'Modesto',
    12 => 'Heo Holding',
];

$dates = [
    1 => '2026-04-23',
    2 => '2026-05-20',
    3 => '2026-05-20',
    4 => '2026-05-01',
    5 => '2026-05-20',
    6 => '2026-05-20',
    7 => '2026-05-20',
    8 => '2026-05-01',
    9 => '2026-03-31',
    10 => '2026-01-31',
    11 => '2026-10-31',
];

echo "\nProposed repeat_rule assignments:\n";
echo str_repeat("-", 80) . "\n";
printf("%-30s %-15s %-12s %-10s\n", "Bill Name", "Store", "Due Date", "Repeat");
echo str_repeat("-", 80) . "\n";

foreach ($billNames as $i => $name) {
    $store = $stores[5 + ($i % 4)] ?? 'Unknown';
    $date = $dates[$i] ?? 'Unknown';
    
    // Determine repeat_rule based on patterns
    if (in_array($name, ['Raw General', 'Stockton - Prepayment'])) {
        $repeat = 'monthly';
    } elseif ($name === 'Fire') {
        $repeat = 'annual';
    } else {
        $repeat = 'monthly';
    }
    
    printf("%-30s %-15s %-12s %-10s\n", $name, $store, $date, $repeat);
}

echo "\n=== MIGRATION COMPLETE ===\n";
echo "Next: Update bills SET repeat_rule='...' based on patterns above\n";
