<?php
/**
 * Seed: Master Obligation Registry
 * CEO Compliance & Payment Operations — Phase 1
 *
 * Seeds the initial set of obligations per CEO directive:
 *   RENT      → Raw Stockton, Bakudan Bandera, Bakudan Stone Oak, Bakudan Rim
 *   UTILITIES → PG&E (Raw Stockton), Waste (Raw Stockton), CPS Energy (Bandera, Stone Oak, Rim)
 *   INSURANCE → Business Insurance, Workers Comp, Umbrella, EPLI (Monthly Review / Annual Renewal)
 *   TAX       → Payroll Tax (Quarterly), Sales Tax (Quarterly)
 *   LICENSE   → TABC (Annual)
 *
 * Idempotent — running multiple times won't duplicate.
 *
 * Usage:  php seed_obligations.php
 */

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/config/time.php';
require_once __DIR__ . '/models/Obligation.php';
require_once __DIR__ . '/service/ObligationService.php';

echo "\n=== SEED: Master Obligation Registry ===\n\n";

$db = Database::getInstance();

// ── 0. Verify schema exists ─────────────────────────────────────────────────
foreach (['obligation_categories', 'obligations', 'obligation_payments'] as $tbl) {
    if (!$db->tableExists($tbl)) {
        die("ERROR: Table `{$tbl}` not found. Run migration first:\n"
          . "  mysql ... < database/migrations/2026_06_04_obligation_registry.sql\n\n");
    }
}

// ── 1. Find admin/manager users for default reviewer/approver ───────────────
$admin = $db->fetch("SELECT id, name FROM users WHERE role = 'admin' AND is_active = 1 ORDER BY id LIMIT 1");
$manager = $db->fetch("SELECT id, name FROM users WHERE role IN ('manager','ceo') AND is_active = 1 ORDER BY id LIMIT 1");
if (!$admin) {
    die("ERROR: No admin user found.\n");
}
$adminId   = (int)$admin['id'];
$reviewerId = $manager ? (int)$manager['id'] : $adminId;
$approverId = $adminId;
echo "Admin ID: {$adminId} | Reviewer (Manager): {$reviewerId} | Approver (Admin): {$approverId}\n\n";

// ── 2. Find existing stores by name (case-insensitive) ──────────────────────
$storeMap = []; // label => id
foreach ($db->fetchAll("SELECT id, name FROM stores WHERE is_active = 1") as $s) {
    $storeMap[strtolower(trim($s['name']))] = (int)$s['id'];
}
echo "Stores found: " . count($storeMap) . "\n";
foreach ($storeMap as $name => $id) {
    echo "  - {$name} (id={$id})\n";
}

// Map CEO store names to DB store names
$storeAliases = [
    'raw stockton'  => ['raw stockton', 'raw', 'rawsushi stockton'],
    'bandera'       => ['bandera', 'bakudan bandera', 'bakudan - bandera', 'b1', 'b2'],
    'stone oak'     => ['stone oak', 'bakudan stone oak', 'bakudan - stone oak', 'b3', 'b4'],
    'rim'           => ['rim', 'bakudan rim', 'bakudan - rim', 'bakudan - the rim'],
];

function findStoreId(array $storeMap, array $aliases): ?int {
    foreach ($aliases as $alias) {
        if (isset($storeMap[strtolower($alias)])) {
            return $storeMap[strtolower($alias)];
        }
    }
    return null;
}

$storeIds = [
    'raw_stockton' => findStoreId($storeMap, $storeAliases['raw stockton']),
    'bandera'      => findStoreId($storeMap, $storeAliases['bandera']),
    'stone_oak'    => findStoreId($storeMap, $storeAliases['stone oak']),
    'rim'          => findStoreId($storeMap, $storeAliases['rim']),
];

foreach ($storeIds as $key => $id) {
    echo "  Store '{$key}' mapped to: " . ($id ? "id={$id}" : "NOT FOUND (will be created)") . "\n";
}

// Auto-create missing stores so obligations always have a place to live
function ensureStore(string $name, string $color): int {
    $db = Database::getInstance();
    $existing = $db->fetch("SELECT id FROM stores WHERE LOWER(name) = LOWER(?)", [$name]);
    if ($existing) return (int)$existing['id'];
    $id = $db->insert(
        "INSERT INTO stores (name, color, is_active, created_at) VALUES (?, ?, 1, NOW())",
        [$name, $color, $color]
    );
    echo "  + Created store: {$name} (id={$id})\n";
    return (int)$id;
}

if (!$storeIds['raw_stockton']) $storeIds['raw_stockton'] = ensureStore('Raw Stockton', '#FF6B6B');
if (!$storeIds['bandera'])      $storeIds['bandera']      = ensureStore('Bakudan Bandera', '#DC2626');
if (!$storeIds['stone_oak'])    $storeIds['stone_oak']    = ensureStore('Bakudan Stone Oak', '#7C3AED');
if (!$storeIds['rim'])          $storeIds['rim']          = ensureStore('Bakudan Rim', '#2563EB');

// ── 3. Seed categories ──────────────────────────────────────────────────────
echo "\n[1/5] Categories\n";
$catRent       = (int)(new Obligation())->upsertCategory('Rent',       'Lease & rent payments',                    10);
$catUtility    = (int)(new Obligation())->upsertCategory('Utility',    'Electricity, gas, water, waste, internet',  20);
$catInsurance  = (int)(new Obligation())->upsertCategory('Insurance',  'Business, workers comp, umbrella, EPLI',    30);
$catTax        = (int)(new Obligation())->upsertCategory('Tax',        'Sales, payroll, federal, state filings',    40);
$catLicense    = (int)(new Obligation())->upsertCategory('License',    'TABC, business licenses, permits',          50);
$catCompliance = (int)(new Obligation())->upsertCategory('Compliance', 'Other compliance & regulatory obligations', 60);
echo "  + Rent (#{$catRent})\n";
echo "  + Utility (#{$catUtility})\n";
echo "  + Insurance (#{$catInsurance})\n";
echo "  + Tax (#{$catTax})\n";
echo "  + License (#{$catLicense})\n";
echo "  + Compliance (#{$catCompliance})\n";

// ── 4. Seed obligations ─────────────────────────────────────────────────────
echo "\n[2/5] Obligations\n";

$today = app_today();
$oblModel = new Obligation();

$obligationsToCreate = [
    // ────── RENT ──────
    [
        'name'      => 'Monthly Rent - Raw Stockton',
        'category_id' => $catRent,
        'vendor'    => 'Raw Stockton',
        'store_id'  => $storeIds['raw_stockton'],
        'store_name'=> 'Raw Stockton',
        'frequency' => 'monthly',
        'due_day'   => 1,
        'grace_days'=> 5,
        'amount'    => null,
        'account_info' => "Lease agreement on file. Pay via wire or check to landlord.",
        'compliance_note' => "Confirm landlord banking details every January.",
        'priority'  => 'urgent',
    ],
    [
        'name'      => 'Monthly Rent - Bakudan Bandera',
        'category_id' => $catRent,
        'vendor'    => 'Bandera Landlord',
        'store_id'  => $storeIds['bandera'],
        'store_name'=> 'Bakudan Bandera',
        'frequency' => 'monthly',
        'due_day'   => 1,
        'grace_days'=> 5,
        'amount'    => null,
        'account_info' => "Lease agreement on file.",
        'priority'  => 'urgent',
    ],
    [
        'name'      => 'Monthly Rent - Bakudan Stone Oak',
        'category_id' => $catRent,
        'vendor'    => 'Stone Oak Landlord',
        'store_id'  => $storeIds['stone_oak'],
        'store_name'=> 'Bakudan Stone Oak',
        'frequency' => 'monthly',
        'due_day'   => 1,
        'grace_days'=> 5,
        'amount'    => null,
        'account_info' => "Lease agreement on file.",
        'priority'  => 'urgent',
    ],
    [
        'name'      => 'Monthly Rent - Bakudan Rim',
        'category_id' => $catRent,
        'vendor'    => 'Rim Landlord',
        'store_id'  => $storeIds['rim'],
        'store_name'=> 'Bakudan Rim',
        'frequency' => 'monthly',
        'due_day'   => 1,
        'grace_days'=> 5,
        'amount'    => null,
        'account_info' => "Lease agreement on file.",
        'priority'  => 'urgent',
    ],

    // ────── UTILITIES ──────
    [
        'name'      => 'PG&E - Raw Stockton',
        'category_id' => $catUtility,
        'vendor'    => 'PG&E',
        'store_id'  => $storeIds['raw_stockton'],
        'store_name'=> 'Raw Stockton',
        'frequency' => 'monthly',
        'due_day'   => 15,
        'grace_days'=> 7,
        'account_info' => "Account: rawsushi / afroken\nhttps://www.pge.com/",
        'compliance_note' => "Compare MoM usage variance > 25% and flag.",
        'priority'  => 'high',
    ],
    [
        'name'      => 'Waste - Raw Stockton',
        'category_id' => $catUtility,
        'vendor'    => 'Waste Management',
        'store_id'  => $storeIds['raw_stockton'],
        'store_name'=> 'Raw Stockton',
        'frequency' => 'monthly',
        'due_day'   => 20,
        'grace_days'=> 5,
        'priority'  => 'medium',
    ],
    [
        'name'      => 'CPS Energy - Bakudan Bandera',
        'category_id' => $catUtility,
        'vendor'    => 'CPS Energy',
        'store_id'  => $storeIds['bandera'],
        'store_name'=> 'Bakudan Bandera',
        'frequency' => 'monthly',
        'due_day'   => 10,
        'grace_days'=> 5,
        'account_info' => "Account: see Vendor record",
        'priority'  => 'high',
    ],
    [
        'name'      => 'CPS Energy - Bakudan Stone Oak',
        'category_id' => $catUtility,
        'vendor'    => 'CPS Energy',
        'store_id'  => $storeIds['stone_oak'],
        'store_name'=> 'Bakudan Stone Oak',
        'frequency' => 'monthly',
        'due_day'   => 10,
        'grace_days'=> 5,
        'priority'  => 'high',
    ],
    [
        'name'      => 'CPS Energy - Bakudan Rim',
        'category_id' => $catUtility,
        'vendor'    => 'CPS Energy',
        'store_id'  => $storeIds['rim'],
        'store_name'=> 'Bakudan Rim',
        'frequency' => 'monthly',
        'due_day'   => 10,
        'grace_days'=> 5,
        'priority'  => 'high',
    ],

    // ────── INSURANCE (Monthly Review / Annual Renewal) ──────
    [
        'name'      => 'Business Insurance - Review',
        'category_id' => $catInsurance,
        'vendor'    => 'Amtrust',
        'frequency' => 'monthly',
        'due_day'   => 5,
        'grace_days'=> 7,
        'account_info' => "Amtrust — login: see Vendor record",
        'compliance_note' => "Monthly: review premium & coverage; verify payment posted.\nAnnual: policy renewal due 12 months from issue.",
        'priority'  => 'high',
    ],
    [
        'name'      => 'Workers Comp Insurance - Review',
        'category_id' => $catInsurance,
        'vendor'    => 'Amtrust (WC)',
        'frequency' => 'monthly',
        'due_day'   => 5,
        'grace_days'=> 7,
        'compliance_note' => "Workers Comp audit annually; verify payroll class codes.",
        'priority'  => 'high',
    ],
    [
        'name'      => 'Umbrella Insurance - Review',
        'category_id' => $catInsurance,
        'vendor'    => 'Amtrust (Umbrella)',
        'frequency' => 'monthly',
        'due_day'   => 5,
        'grace_days'=> 7,
        'priority'  => 'high',
    ],
    [
        'name'      => 'EPLI Insurance - Review',
        'category_id' => $catInsurance,
        'vendor'    => 'Amtrust (EPLI)',
        'frequency' => 'monthly',
        'due_day'   => 5,
        'grace_days'=> 7,
        'priority'  => 'high',
    ],

    // ────── TAX (Quarterly) ──────
    [
        'name'      => 'Quarterly Payroll Tax Filing',
        'category_id' => $catTax,
        'vendor'    => 'IRS / EDD / FTB',
        'frequency' => 'quarterly',
        'due_day'   => 15,
        'due_month' => 1,  // rolled forward to next quarter end + 1
        'grace_days'=> 5,
        'account_info' => "Use QuickBooks. Fill De9, De9C, 941.\nCDTFA for sales/payroll.",
        'compliance_note' => "Q1 due Apr 15, Q2 due Jul 15, Q3 due Oct 15, Q4 due Jan 15.\nFile via QB and state portals.",
        'priority'  => 'urgent',
    ],
    [
        'name'      => 'Quarterly Sales Tax Filing',
        'category_id' => $catTax,
        'vendor'    => 'CDTFA',
        'frequency' => 'quarterly',
        'due_day'   => 25,
        'grace_days'=> 3,
        'account_info' => "Express Login: a372846u\nAccount: 103025103",
        'compliance_note' => "File via CDTFA online portal. Include prepayment if applicable.",
        'priority'  => 'urgent',
    ],

    // ────── LICENSE / COMPLIANCE (Annual) ──────
    [
        'name'      => 'TABC License - Annual Renewal',
        'category_id' => $catLicense,
        'vendor'    => 'TABC',
        'frequency' => 'annual',
        'due_day'   => 31,
        'due_month' => 8,  // August — Texas TABC renewal cycle
        'grace_days'=> 30,
        'compliance_note' => "Until verified — confirm exact renewal date with TABC for each location.",
        'priority'  => 'high',
    ],
];

$createdObligationIds = [];

foreach ($obligationsToCreate as $data) {
    // Idempotency: skip if an obligation with same name + category + store already exists
    $existing = $db->fetch(
        "SELECT id FROM obligations
         WHERE LOWER(name) = LOWER(?) AND (store_id = ? OR (store_id IS NULL AND ? IS NULL))
         LIMIT 1",
        [$data['name'], $data['store_id'] ?? null, $data['store_id'] ?? null]
    );
    if ($existing) {
        echo "  = Exists: {$data['name']} (id={$existing['id']})\n";
        $createdObligationIds[] = (int)$existing['id'];
        continue;
    }

    $data['reviewer_id'] = $reviewerId;
    $data['approver_id'] = $approverId;
    $data['active']      = 1;
    $id = $oblModel->create($data);
    if ($id) {
        echo "  + Created: {$data['name']} (id={$id})\n";
        $createdObligationIds[] = $id;
    } else {
        echo "  ! Failed to create: {$data['name']}\n";
    }
}

// ── 5. Auto-generate occurrences (limited to current month) ────────────────
echo "\n[3/5] Auto-generate due occurrences (this period)\n";

$service = new ObligationService();
// Force next_due_date for monthly obligations that haven't been seeded
$db->execute(
    "UPDATE obligations
     SET next_due_date = COALESCE(next_due_date, ?)
     WHERE frequency = 'monthly' AND next_due_date IS NULL",
    [$today]
);
$db->execute(
    "UPDATE obligations
     SET next_due_date = COALESCE(next_due_date, ?)
     WHERE frequency IN ('quarterly','annual','semi_annual') AND next_due_date IS NULL",
    [$today]
);

$generated = $service->generateDueOccurrences();
echo "  Generated {$generated} payment + task pair(s)\n";

// ── 6. Backfill the next 60 days for monthly obligations ──────────────────
echo "\n[4/5] Backfill next 60 days (idempotent)\n";

$today_dt = new DateTimeImmutable($today);
$backfill = 0;
foreach ($oblModel->findActive() as $obl) {
    if ($obl['frequency'] !== 'monthly') continue;

    // Generate occurrences for the next 2 months beyond current
    $cursor = $today;
    for ($m = 0; $m < 2; $m++) {
        $next = $oblModel->computeNextDueDate(
            'monthly',
            (int)($obl['due_day'] ?? 1),
            null,
            $cursor
        );
        if ($next === $cursor) break;
        $oblTmp = $obl;
        $oblTmp['next_due_date'] = $next;
        if ($service->generateForObligation($oblTmp, $next)) {
            $backfill++;
        }
        $cursor = $next;
    }
}
echo "  Backfilled {$backfill} additional occurrences\n";

// ── 7. Report ──────────────────────────────────────────────────────────────
echo "\n[5/5] Summary\n";

$counts = $db->fetch("
    SELECT
        (SELECT COUNT(*) FROM obligations WHERE active = 1) AS active_obligations,
        (SELECT COUNT(*) FROM obligations WHERE active = 0) AS inactive_obligations,
        (SELECT COUNT(*) FROM obligation_categories WHERE is_active = 1) AS categories,
        (SELECT COUNT(*) FROM obligation_payments WHERE status = 'pending') AS payments_pending,
        (SELECT COUNT(*) FROM obligation_payments WHERE status = 'paid') AS payments_paid,
        (SELECT COUNT(*) FROM obligation_payments) AS payments_total,
        (SELECT COUNT(*) FROM tasks WHERE id IN (SELECT task_id FROM obligation_payments WHERE task_id IS NOT NULL)) AS tasks_linked
");

echo "  Categories:           {$counts['categories']}\n";
echo "  Active obligations:   {$counts['active_obligations']}\n";
echo "  Inactive obligations: {$counts['inactive_obligations']}\n";
echo "  Payments pending:     {$counts['payments_pending']}\n";
echo "  Payments paid:        {$counts['payments_paid']}\n";
echo "  Payments total:       {$counts['payments_total']}\n";
echo "  Tasks auto-generated: {$counts['tasks_linked']}\n";

echo "\n=== SEED COMPLETE ===\n";
echo "\nNext steps:\n";
echo "1. Visit /obligations              → manage registry\n";
echo "2. Visit /obligations/reviewer     → reviewer workspace\n";
echo "3. Visit /obligations/approver     → approver workspace\n";
echo "4. Visit /overview                 → CEO dashboard widgets\n";
echo "5. POST /obligations/generate      → force task generation\n\n";
