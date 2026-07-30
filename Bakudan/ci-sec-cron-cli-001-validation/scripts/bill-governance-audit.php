<?php
/**
 * Phase 14 — Bill & Payment Governance Audit
 * Reads production data via DB connection and outputs a JSON report.
 * Run: C:\xampp\php\php.exe scripts/bill-governance-audit.php
 */
require_once __DIR__ . '/../config/database.php';
header('Content-Type: application/json; charset=utf-8');

$db = Database::getInstance();

$report = [
    'audit_date' => date('Y-m-d H:i:s'),
    'database'   => DB_NAME,
    'host'       => DB_HOST,
];

// ── 1. All active stores ──
$stores = $db->fetchAll("SELECT id, name, is_active FROM stores WHERE is_active = 1 ORDER BY name");
$report['stores'] = $stores;

// ── 2. Bills summary per store ──
$billsByStore = $db->fetchAll("
    SELECT
        b.store_id,
        s.name AS store_name,
        COUNT(*) AS total_bills,
        SUM(CASE WHEN b.status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
        SUM(CASE WHEN b.status = 'overdue' THEN 1 ELSE 0 END) AS overdue_count,
        SUM(CASE WHEN b.status = 'paid' THEN 1 ELSE 0 END) AS paid_count,
        COALESCE(SUM(b.amount), 0) AS total_amount,
        COALESCE(SUM(CASE WHEN b.status = 'paid' THEN b.amount ELSE 0 END), 0) AS paid_amount,
        COALESCE(SUM(CASE WHEN b.status IN ('pending','overdue') THEN b.amount ELSE 0 END), 0) AS unpaid_amount
    FROM bills b
    JOIN stores s ON s.id = b.store_id
    WHERE (b.is_archived = 0 OR b.is_archived IS NULL)
    GROUP BY b.store_id, s.name
    ORDER BY s.name
");
$report['bills_by_store'] = $billsByStore;

// ── 3. Bills by category ──
$billsByCategory = $db->fetchAll("
    SELECT
        COALESCE(b.category, b.finance_category, 'UNCATEGORIZED') AS category,
        b.store_id,
        s.name AS store_name,
        COUNT(*) AS bill_count,
        COALESCE(SUM(b.amount), 0) AS total_amount
    FROM bills b
    JOIN stores s ON s.id = b.store_id
    WHERE (b.is_archived = 0 OR b.is_archived IS NULL)
    GROUP BY category, b.store_id, s.name
    ORDER BY s.name, category
");
$report['bills_by_category'] = $billsByCategory;

// ── 4. Recurring bills (template parents) ──
$recurringBills = $db->fetchAll("
    SELECT
        b.id, b.title, b.store_id, s.name AS store_name,
        b.category, b.finance_category, b.repeat_type,
        b.repeat_interval, b.due_date, b.amount, b.status,
        (SELECT COUNT(*) FROM bills c WHERE c.repeat_parent_id = b.id) AS child_count
    FROM bills b
    JOIN stores s ON s.id = b.store_id
    WHERE b.repeat_parent_id IS NULL
      AND b.repeat_type <> 'none'
      AND (b.is_archived = 0 OR b.is_archived IS NULL)
    ORDER BY s.name, b.title
");
$report['recurring_bills'] = $recurringBills;

// ── 5. Duplicate detection (same title + same store + same due_date) ──
$duplicates = $db->fetchAll("
    SELECT
        b.title, b.store_id, s.name AS store_name, b.due_date,
        COUNT(*) AS duplicate_count,
        GROUP_CONCAT(b.id ORDER BY b.id) AS bill_ids,
        GROUP_CONCAT(b.amount ORDER BY b.id) AS amounts,
        GROUP_CONCAT(b.status ORDER BY b.id) AS statuses
    FROM bills b
    JOIN stores s ON s.id = b.store_id
    WHERE (b.is_archived = 0 OR b.is_archived IS NULL)
    GROUP BY b.title, b.store_id, s.name, b.due_date
    HAVING COUNT(*) > 1
    ORDER BY s.name, b.title
");
$report['duplicate_bills'] = $duplicates;
$report['duplicate_bill_count'] = count($duplicates);

// ── 6. Bills with no category ──
$uncategorizedBills = $db->fetchAll("
    SELECT b.id, b.title, b.store_id, s.name AS store_name, b.due_date, b.amount
    FROM bills b
    JOIN stores s ON s.id = b.store_id
    WHERE (b.category IS NULL OR b.category = '')
      AND (b.finance_category IS NULL OR b.finance_category = '')
      AND (b.is_archived = 0 OR b.is_archived IS NULL)
    ORDER BY s.name, b.due_date
");
$report['uncategorized_bills'] = $uncategorizedBills;
$report['uncategorized_bill_count'] = count($uncategorizedBills);

// ── 7. Bills with no owner (created_by) ──
$orphanBills = $db->fetchAll("
    SELECT b.id, b.title, b.store_id, s.name AS store_name, b.due_date, b.created_by
    FROM bills b
    JOIN stores s ON s.id = b.store_id
    WHERE (b.created_by IS NULL OR b.created_by = 0)
      AND (b.is_archived = 0 OR b.is_archived IS NULL)
");
$report['bills_no_owner'] = $orphanBills;
$report['bills_no_owner_count'] = count($orphanBills);

// ── 8. Payments summary ──
$paymentsSummary = $db->fetchAll("
    SELECT
        p.method,
        COUNT(*) AS payment_count,
        COALESCE(SUM(p.amount), 0) AS total_amount,
        AVG(p.amount) AS avg_amount
    FROM payments p
    GROUP BY p.method
    ORDER BY total_amount DESC
");
$report['payments_by_method'] = $paymentsSummary;

// ── 9. Orphan payments (bill_id references a non-existent or archived bill) ──
$orphanPayments = $db->fetchAll("
    SELECT p.id, p.bill_id, p.amount, p.paid_at, p.method, p.created_by
    FROM payments p
    LEFT JOIN bills b ON b.id = p.bill_id
    WHERE b.id IS NULL
");
$report['orphan_payments'] = $orphanPayments;
$report['orphan_payment_count'] = count($orphanPayments);

// ── 10. Payments per bill (overpayment check) ──
$overpayments = $db->fetchAll("
    SELECT
        b.id AS bill_id, b.title, b.store_id, s.name AS store_name,
        b.amount AS bill_amount,
        COALESCE(SUM(p.amount), 0) AS total_paid,
        CASE
            WHEN COALESCE(SUM(p.amount), 0) > b.amount THEN 'OVERPAID'
            WHEN COALESCE(SUM(p.amount), 0) = b.amount THEN 'SETTLED'
            WHEN COALESCE(SUM(p.amount), 0) > 0 THEN 'PARTIAL'
            ELSE 'UNPAID'
        END AS payment_status
    FROM bills b
    JOIN stores s ON s.id = b.store_id
    LEFT JOIN payments p ON p.bill_id = b.id
    WHERE (b.is_archived = 0 OR b.is_archived IS NULL)
    GROUP BY b.id, b.title, b.store_id, s.name, b.amount
    HAVING total_paid > 0
    ORDER BY payment_status, s.name, b.title
");
$report['payment_status_detail'] = $overpayments;
$overpaidList = array_filter($overpayments, fn($r) => $r['payment_status'] === 'OVERPAID');
$report['overpaid_bills'] = array_values($overpaidList);
$report['overpaid_bill_count'] = count($overpaidList);

// ── 11. Bills with attachments ──
$hasAttachments = $db->tableExists('bill_attachments');
$report['bill_attachments_table_exists'] = $hasAttachments;
if ($hasAttachments) {
    $billsWithAttach = $db->fetchAll("
        SELECT b.id, b.title, b.store_id, s.name AS store_name,
               COUNT(ba.id) AS attachment_count
        FROM bills b
        JOIN stores s ON s.id = b.store_id
        LEFT JOIN bill_attachments ba ON ba.bill_id = b.id
        WHERE (b.is_archived = 0 OR b.is_archived IS NULL)
        GROUP BY b.id, b.title, b.store_id, s.name
        HAVING attachment_count > 0
    ");
    $report['bills_with_attachments'] = count($billsWithAttach);

    $billsNoAttach = $db->fetchAll("
        SELECT b.id, b.title, b.store_id, s.name AS store_name, b.due_date, b.status
        FROM bills b
        JOIN stores s ON s.id = b.store_id
        LEFT JOIN bill_attachments ba ON ba.bill_id = b.id
        WHERE (b.is_archived = 0 OR b.is_archived IS NULL)
          AND ba.id IS NULL
          AND b.status IN ('paid','accepted')
        ORDER BY s.name, b.title
    ");
    $report['paid_bills_no_attachment'] = $billsNoAttach;
    $report['paid_bills_no_attachment_count'] = count($billsNoAttach);
}

// ── 12. Obligations summary ──
$hasObligations = $db->tableExists('obligations');
$report['obligations_table_exists'] = $hasObligations;
if ($hasObligations) {
    $obligations = $db->fetchAll("
        SELECT
            o.id, o.name, o.vendor, o.store_id, o.store_name,
            o.frequency, o.due_day, o.amount, o.active,
            c.name AS category_name,
            o.next_due_date
        FROM obligations o
        LEFT JOIN obligation_categories c ON o.category_id = c.id
        WHERE o.active = 1
        ORDER BY c.sort_order, o.name
    ");
    $report['active_obligations'] = $obligations;
    $report['active_obligation_count'] = count($obligations);

    // Obligation payments
    $oblPayments = $db->fetchAll("
        SELECT op.*, o.name AS obligation_name, o.store_name, c.name AS category_name
        FROM obligation_payments op
        JOIN obligations o ON op.obligation_id = o.id
        LEFT JOIN obligation_categories c ON o.category_id = c.id
        ORDER BY op.due_date DESC
        LIMIT 200
    ");
    $report['recent_obligation_payments'] = $oblPayments;
    $report['obligation_payment_count'] = count($oblPayments);
}

// ── 13. Expected categories per store (CEO audit) ──
$expectedCategories = ['rent', 'utility', 'insurance', 'tax', 'licensing', 'credit_card', 'loan', 'subscription', 'vendor'];
$report['expected_categories'] = $expectedCategories;

$coverageCheck = [];
foreach ($stores as $store) {
    $storeCats = $db->fetchAll("
        SELECT DISTINCT COALESCE(category, finance_category, '') AS cat
        FROM bills
        WHERE store_id = ? AND (is_archived = 0 OR is_archived IS NULL)
    ", [$store['id']]);
    $existingCats = array_map(fn($r) => strtolower(trim($r['cat'])), $storeCats);
    $existingCats = array_filter($existingCats);
    $missing = array_diff($expectedCategories, $existingCats);
    $coverageCheck[] = [
        'store_id'    => $store['id'],
        'store_name'  => $store['name'],
        'existing'    => array_values($existingCats),
        'missing'     => array_values($missing),
        'coverage'    => count($existingCats) . '/' . count($expectedCategories),
    ];
}
$report['category_coverage'] = $coverageCheck;

// ── 14. Overall counts ──
$totalBills = $db->fetchColumn("SELECT COUNT(*) FROM bills WHERE (is_archived = 0 OR is_archived IS NULL)");
$totalPayments = $db->fetchColumn("SELECT COUNT(*) FROM payments");
$totalArchived = $db->fetchColumn("SELECT COUNT(*) FROM bills WHERE is_archived = 1");
$report['totals'] = [
    'total_active_bills' => (int)$totalBills,
    'total_payments'     => (int)$totalPayments,
    'total_archived'     => (int)$totalArchived,
];

// ── 15. Verdict ──
$verdict = 'PASS';
$blockers = [];

if ($report['duplicate_bill_count'] > 0) {
    $verdict = 'FAIL';
    $blockers[] = "{$report['duplicate_bill_count']} duplicate bill sets detected";
}
if ($report['uncategorized_bill_count'] > 0) {
    $blockers[] = "{$report['uncategorized_bill_count']} bills have no category";
}
if ($report['bills_no_owner_count'] > 0) {
    $blockers[] = "{$report['bills_no_owner_count']} bills have no owner";
}
if ($report['orphan_payment_count'] > 0) {
    $verdict = 'FAIL';
    $blockers[] = "{$report['orphan_payment_count']} orphan payments (bill not found)";
}
if ($report['overpaid_bill_count'] > 0) {
    $verdict = 'FAIL';
    $blockers[] = "{$report['overpaid_bill_count']} bills are overpaid";
}

$report['verdict'] = $verdict;
$report['blockers'] = $blockers;

echo json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
