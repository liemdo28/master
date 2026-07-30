<?php
/**
 * Setup vendors + recurring bills from screenshot data
 * Run: php setup_vendors_bills.php
 *
 * Vendors identified:
 * 1. CPS Energy (electricity) - all B1/B2/B3 stores - monthly, due ~10th
 * 2. Amtrust (insurance) - Modesto + Raw Stockton - monthly
 * 3. PGE (electricity) - Raw Stockton - monthly
 * 4. ATT (phone) - monthly
 * 5. IRS / State Tax Portal (quarterly tax) - quarterly Apr/Jul/Oct/Jan
 * 6. QuickBooks (941/De9/De9C forms) - quarterly
 * 7. Mixed Beverage Tax Portal (Texas) - quarterly
 *
 * Stores:
 * ID 5 = Bakudan - The Rim (B1)
 * ID 6 = Bakudan - Stone Oak (B2)
 * ID 7 = Bakudan - Bandera (B3)
 * ID 4 = Raw (Raw Stockton)
 * ID 8 = IFT
 * ID 12 = Heo Holding
 * ID 11 = Modesto
 */
require_once __DIR__ . '/database.php';

$db = Database::getInstance();

// ─── Check vendors table ───────────────────────────────────────────────────
echo "=== VENDORS + RECURRING BILLS SETUP ===\n\n";

// Helper
function hasColumn($table, $col) {
    global $db;
    static $cache = [];
    $key = "$table.$col";
    if (isset($cache[$key])) return $cache[$key];
    $r = $db->fetch(
        "SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=? LIMIT 1",
        [$table, $col]
    );
    $cache[$key] = (bool)$r;
    return $cache[$key];
}

function ensureRepeatColumns() {
    global $db;
    $cols = [
        'repeat_type'    => "ALTER TABLE bills ADD COLUMN repeat_type VARCHAR(20) NOT NULL DEFAULT 'none'",
        'repeat_interval'=> "ALTER TABLE bills ADD COLUMN repeat_interval INT NULL DEFAULT 1",
        'repeat_day'     => "ALTER TABLE bills ADD COLUMN repeat_day TINYINT UNSIGNED NULL",
        'repeat_parent_id'=> "ALTER TABLE bills ADD COLUMN repeat_parent_id INT NULL",
    ];
    foreach ($cols as $col => $sql) {
        if (!hasColumn('bills', $col)) {
            try { $db->execute($sql); echo "  + Added column: $col\n"; } catch(Exception $e) { echo "  ! $col: ".$e->getMessage()."\n"; }
        }
    }
}

ensureRepeatColumns();

// ─── 1. VENDORS ──────────────────────────────────────────────────────────────
echo "[1] Creating vendors...\n";

$vendors = [
    [
        'name' => 'CPS Energy',
        'payment_url' => 'https://www.cpsenergy.com',
        'login_info' => 'Account portal: https://secure.cpsenergy.com/mma/wssHome.jsp',
        'notes' => 'Electricity provider for all Bakudan locations (B1/B2/B3). Accounts: B1=22506 N US Hwy 281 #106, B2=11309 BANDERA RD, B3=22506 N US Hwy 281 #106. Login: Bakudanramen // Ramenbar#123',
    ],
    [
        'name' => 'Amtrust Financial',
        'payment_url' => 'https://auth.amtrustgroup.com',
        'login_info' => 'Modesto and Stockton credentials are stored in the Credential Vault. Checking account x5005.',
        'notes' => 'Insurance payments. Modesto policy, Stockton policy. Express Login accounts.',
    ],
    [
        'name' => 'PGE',
        'payment_url' => 'https://www.pge.com',
        'login_info' => 'Raw Stockton: rawsushi / afroken',
        'notes' => 'Electricity for Raw Stockton location.',
    ],
    [
        'name' => 'AT&T',
        'payment_url' => 'https://www.att.com/acctsvcs/fastpay',
        'login_info' => 'Account 2096093886, zip 95219. Pay with Amex monthly.',
        'notes' => 'Phone bill for office. Monthly payment.',
    ],
    [
        'name' => 'IRS / EFTPS',
        'payment_url' => 'https://www.eftps.gov',
        'login_info' => 'Quarterly tax payments via EFTPS. Federal tax deposits.',
        'notes' => 'Federal payroll tax (941). Quarterly filings. Due Apr 30, Jul 31, Oct 31, Jan 31.',
    ],
    [
        'name' => 'Texas Comptroller (Mixed Beverage)',
        'payment_url' => 'https://comptroller.texas.gov',
        'login_info' => 'Mixed Beverage Sales Tax and Mixed Beverage Gross Receipts Tax portals for IFT and Heo Holding.',
        'notes' => 'Texas quarterly tax filings for bars/restaurants. Due 20th of month after quarter end: Apr 20, Jul 20, Oct 20, Jan 20.',
    ],
    [
        'name' => 'QuickBooks',
        'payment_url' => 'https://quickbooks.intuit.com',
        'login_info' => 'QuickBooks Online account for tax form filings: 941, De9, De9C.',
        'notes' => 'Quarterly form filings: 941 (Federal), De9 (Texas UI), De9C (Texas UI). Used for Raw Stockton.',
    ],
];

// Create vendors table if not exists
try { $db->execute("CREATE TABLE IF NOT EXISTS vendors (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NOT NULL, payment_url VARCHAR(500) NULL, login_info TEXT NULL, notes TEXT NULL, is_active TINYINT(1) DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"); } catch(Exception $e) {}

$vendorIds = [];
foreach ($vendors as $v) {
    $existing = $db->fetch("SELECT id FROM vendors WHERE LOWER(TRIM(name)) = LOWER(?) LIMIT 1", [$v['name']]);
    if ($existing) {
        $db->execute("UPDATE vendors SET payment_url=?, login_info=?, notes=?, updated_at=NOW() WHERE id=?", [$v['payment_url'], $v['login_info'], $v['notes'], $existing['id']]);
        $vendorIds[$v['name']] = (int)$existing['id'];
        echo "  = {$v['name']} (ID={$existing['id']})\n";
    } else {
        $id = $db->insert("INSERT INTO vendors (name, payment_url, login_info, notes, is_active, created_at) VALUES (?, ?, ?, ?, 1, NOW())", [$v['name'], $v['payment_url'], $v['login_info'], $v['notes']]);
        $vendorIds[$v['name']] = (int)$id;
        echo "  + {$v['name']} (ID=$id)\n";
    }
}

// Link vendor_id column to bills
if (hasColumn('bills', 'vendor') && !hasColumn('bills', 'vendor_id')) {
    try { $db->execute("ALTER TABLE bills ADD COLUMN vendor_id INT NULL AFTER vendor"); echo "  + Added vendor_id to bills\n"; } catch(Exception $e) { echo "  ! vendor_id: ".$e->getMessage()."\n"; }
}

// ─── 2. LINK VENDORS TO EXISTING BILLS ───────────────────────────────────────
echo "\n[2] Linking vendors to existing bills...\n";

$vendorLinkMap = [
    'CPS Energy B1' => $vendorIds['CPS Energy'],
    'CPS Energy B1 #2' => $vendorIds['CPS Energy'],
    'CPS Energy B2' => $vendorIds['CPS Energy'],
    'CPS Energy B2 #2' => $vendorIds['CPS Energy'],
    'CPS Energy B3' => $vendorIds['CPS Energy'],
    'CPS Energy B3 #2' => $vendorIds['CPS Energy'],
];

foreach ($vendorLinkMap as $title => $vendorId) {
    $affected = $db->execute(
        "UPDATE bills SET vendor_id=? WHERE LOWER(TRIM(title)) LIKE LOWER(?) AND (vendor_id IS NULL OR vendor_id=0)",
        [$vendorId, "%$title%"]
    );
    if ($affected > 0) echo "  ~ Linked '$title' → vendor_id=$vendorId ($affected row(s))\n";
}

// ─── 3. RECURRING BILLS ───────────────────────────────────────────────────────
echo "\n[3] Setting up recurring bills...\n";

/**
 * Create a recurring bill source (repeat_parent_id = NULL, repeat_type != 'none')
 * For CPS Energy: monthly, due day 10
 * For Amtrust: monthly, due ~2nd-5th
 * For PGE: monthly, due ~27th
 * For ATT: monthly, due ~7th
 * For Tax portals: quarterly
 */
function upsertRecurringBill($storeId, $title, $vendorId, $amount, $dueDay, $repeatType, $repeatInterval, $repeatAnchor, $note, $color = null) {
    global $db;

    // Check if this recurring source already exists (parent bill)
    $existing = $db->fetch(
        "SELECT id, repeat_type FROM bills WHERE store_id=? AND LOWER(TRIM(title))=LOWER(?) AND (repeat_parent_id IS NULL OR repeat_parent_id=id) LIMIT 1",
        [$storeId, $title]
    );

    if ($existing) {
        echo "  = $title (store=$storeId) already exists as recurring\n";
        return (int)$existing['id'];
    }

    $id = $db->insert(
        "INSERT INTO bills (store_id, title, vendor_id, amount, due_date, status, note, color, created_by, created_at, repeat_type, repeat_interval, repeat_day, repeat_parent_id)
         VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, 1, NOW(), ?, ?, ?, NULL)",
        [$storeId, $title, $vendorId, $amount, $dueDay, $note, $color, $repeatType, $repeatInterval, $repeatAnchor]
    );
    echo "  + $title (store=$storeId, repeat=$repeatType, day=$repeatAnchor) ID=$id\n";
    return (int)$id;
}

$todayYear = (int)date('Y');
$todayMonth = (int)date('n');

// CPS Energy monthly - due day 10 each month
// B1 store=5, B2 store=6, B3 store=7
foreach ([
    [5, 'CPS Energy - B1 (22506 N US Hwy)'],
    [6, 'CPS Energy - B2 (11309 Bandera)'],
    [7, 'CPS Energy - B3 (22506 N US Hwy)'],
] as [$sid, $title]) {
    upsertRecurringBill($sid, $title, $vendorIds['CPS Energy'], 0, "$todayYear-" . sprintf('%02d', $todayMonth) . "-10", 'monthly', 1, 10,
        'Monthly electricity - auto-generated', '#ffea00');
}

// Amtrust monthly
upsertRecurringBill(11, 'Amtrust - Modesto', $vendorIds['Amtrust Financial'], 0, "$todayYear-" . sprintf('%02d', $todayMonth) . "-02", 'monthly', 1, 2,
    'Monthly insurance premium - Modesto', '#ff6b2b');
upsertRecurringBill(4, 'Amtrust - Stockton', $vendorIds['Amtrust Financial'], 0, "$todayYear-" . sprintf('%02d', $todayMonth) . "-05", 'monthly', 1, 5,
    'Monthly insurance premium - Stockton', '#ff6b2b');

// PGE monthly
upsertRecurringBill(4, 'PGE - Stockton', $vendorIds['PGE'], 0, "$todayYear-" . sprintf('%02d', $todayMonth) . "-27", 'monthly', 1, 27,
    'Monthly electricity - Stockton PGE', '#2979ff');

// ATT monthly
upsertRecurringBill(11, 'AT&T Phone Bill', $vendorIds['AT&T'], 10, "$todayYear-" . sprintf('%02d', $todayMonth) . "-07", 'monthly', 1, 7,
    'Monthly AT&T phone payment. Pay with Amex.', '#b6ff00');

// Quarterly: Sale Tax (Texas) - IFT + Heo Holding
// Quarterly due dates: Q1=Jan20, Q2=Apr20, Q3=Jul20, Q4=Oct20
// Auto-determine current quarter
$quarter = ceil($todayMonth / 3);
$quarterDueMonths = [1 => '01-20', 2 => '04-20', 3 => '07-20', 4 => '10-20'];
$thisQuarterDue = sprintf('%d-%s', $todayYear, $quarterDueMonths[$quarter]);

upsertRecurringBill(8,  'Texas Sale Tax - IFT (Quarterly)',    $vendorIds['Texas Comptroller (Mixed Beverage)'], 0, $thisQuarterDue, 'quarterly', 3, 20,
    'Quarterly Mixed Beverage Sales Tax + Gross Receipts Tax. File via Texas Comptroller portal.', '#6C5CE7');
upsertRecurringBill(12, 'Texas Sale Tax - Heo Holding (Quarterly)', $vendorIds['Texas Comptroller (Mixed Beverage)'], 0, $thisQuarterDue, 'quarterly', 3, 20,
    'Quarterly Mixed Beverage Sales Tax + Gross Receipts Tax. File via Texas Comptroller portal.', '#00B894');

// Quarterly: QB Tax forms - Raw Stockton
upsertRecurringBill(4, 'QB Tax Forms - Raw (Quarterly)', $vendorIds['QuickBooks'], 0, $thisQuarterDue, 'quarterly', 3, 8,
    'Quarterly 941, De9, De9C filings on QuickBooks. Due ~8th of month after quarter.', '#ff2bd6');

// ─── 4. GENERATE RECURRING BILLS FOR CURRENT MONTH ──────────────────────────
echo "\n[4] Generating recurring bills for " . date('F Y') . "...\n";

// Trigger monthly generation for each store that has recurring bills
$storeIds = [4, 5, 6, 7, 8, 11, 12];
foreach ($storeIds as $sid) {
    $created = 0;
    $sources = $db->fetchAll(
        "SELECT * FROM bills WHERE store_id=? AND repeat_type<>'none' AND (repeat_parent_id IS NULL OR repeat_parent_id=id)",
        [$sid]
    );
    foreach ($sources as $src) {
        // Generate one occurrence for this month
        $monthStart = new DateTimeImmutable(sprintf('%04d-%02d-01 00:00:00', $todayYear, $todayMonth));
        $monthEnd = $monthStart->modify('+1 month');
        $anchorDay = (int)($src['repeat_day'] ?? 10);
        $targetDay = min($anchorDay, (int)$monthStart->format('t'));

        // For quarterly, only generate if current month is in the quarter
        $isQuarterly = ($src['repeat_type'] ?? '') === 'quarterly';
        if ($isQuarterly) {
            $q = ceil((int)$monthStart->format('n') / 3);
            $qMonths = $q == 1 ? 1 : ($q == 2 ? 4 : ($q == 3 ? 7 : 10));
            if ((int)$monthStart->format('n') !== $qMonths) continue;
        }

        $occDate = sprintf('%04d-%02d-%02d', $todayYear, $todayMonth, $targetDay);
        $exists = $db->fetch(
            "SELECT id FROM bills WHERE store_id=? AND due_date=? AND ((repeat_parent_id=?) OR (id=?)) LIMIT 1",
            [$sid, $occDate, $src['id'], $src['id']]
        );
        if ($exists) continue;

        $id = $db->insert(
            "INSERT INTO bills (store_id, title, vendor_id, amount, due_date, status, note, color, created_by, created_at, repeat_type, repeat_interval, repeat_day, repeat_parent_id)
             VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, 1, NOW(), 'none', 1, ?, ?)",
            [$sid, $src['title'], $src['vendor_id'], $src['amount'], $occDate, $src['note'], $src['color'], $src['repeat_day'], $src['id']]
        );
        $created++;
    }
    if ($created > 0) echo "  ~ Generated $created recurring bill(s) for store $sid\n";
}

// ─── 5. SUMMARY ──────────────────────────────────────────────────────────────
echo "\n=== SETUP COMPLETE ===\n";
echo "\n[Vendors created/updated]\n";
foreach ($vendorIds as $name => $id) { echo "  $name (ID=$id)\n"; }

echo "\n[Recurring bills]\n";
$recurring = $db->fetchAll(
    "SELECT b.id, b.title, s.name as store, b.repeat_type, b.repeat_day
     FROM bills b JOIN stores s ON s.id=b.store_id
     WHERE b.repeat_type<>'none' AND (b.repeat_parent_id IS NULL OR b.repeat_parent_id=b.id)
     ORDER BY s.name, b.title"
);
foreach ($recurring as $r) { echo "  [{$r['id']}] {$r['title']} @ {$r['store']} - {$r['repeat_type']} day {$r['repeat_day']}\n"; }

echo "\n[Upcoming bills this month]\n";
$upcoming = $db->fetchAll(
    "SELECT b.id, b.title, s.name as store, b.due_date, b.amount, b.status
     FROM bills b JOIN stores s ON s.id=b.store_id
     WHERE b.due_date >= ? AND b.due_date <= LAST_DAY(?)
     ORDER BY b.due_date LIMIT 20",
    ["$todayYear-" . sprintf('%02d', $todayMonth) . "-01", "$todayYear-" . sprintf('%02d', $todayMonth) . "-31"]
);
foreach ($upcoming as $b) { echo "  {$b['due_date']} | {$b['store']} | {$b['title']} | \${$b['amount']} | {$b['status']}\n"; }
echo "\n";
