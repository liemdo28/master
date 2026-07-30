#!/usr/bin/env node
/**
 * Phase 14 — Bill & Payment Governance Audit (Node.js)
 * Connects directly to production MySQL and outputs JSON report.
 */
import mysql from 'mysql2/promise';
import { writeFileSync } from 'fs';

const db = await mysql.createConnection({
  host: process.env.DB_HOST || 'mysql-taskflow.bakudanramen.com',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'liemdo',
  password: process.env.DB_PASS || 'liem@dt2155',
  database: process.env.DB_NAME || 'taskflow_db',
  charset: 'utf8mb4',
  timezone: '+07:00',
});

const q = async (sql, params = []) => {
  const [rows] = await db.execute(sql, params);
  return rows;
};
const col = async (sql, params = []) => {
  const rows = await q(sql, params);
  return rows[0] ? Object.values(rows[0])[0] : 0;
};

const report = { audit_date: new Date().toISOString(), database: 'taskflow_db' };

// 1. Stores
report.stores = await q("SELECT id, name, is_active FROM stores WHERE is_active = 1 ORDER BY name");

// 2. Bills by store
report.bills_by_store = await q(`
  SELECT b.store_id, s.name AS store_name,
    COUNT(*) AS total_bills,
    SUM(CASE WHEN b.status='pending' THEN 1 ELSE 0 END) AS pending,
    SUM(CASE WHEN b.status='overdue' THEN 1 ELSE 0 END) AS overdue,
    SUM(CASE WHEN b.status='paid' THEN 1 ELSE 0 END) AS paid,
    COALESCE(SUM(b.amount),0) AS total_amount,
    COALESCE(SUM(CASE WHEN b.status='paid' THEN b.amount ELSE 0 END),0) AS paid_amount,
    COALESCE(SUM(CASE WHEN b.status IN ('pending','overdue') THEN b.amount ELSE 0 END),0) AS unpaid_amount
  FROM bills b JOIN stores s ON s.id=b.store_id
  WHERE (b.is_archived=0 OR b.is_archived IS NULL)
  GROUP BY b.store_id, s.name ORDER BY s.name
`);

// 3. Bills by category
report.bills_by_category = await q(`
  SELECT COALESCE(b.category,b.finance_category,'UNCATEGORIZED') AS category,
    b.store_id, s.name AS store_name, COUNT(*) AS count, COALESCE(SUM(b.amount),0) AS amount
  FROM bills b JOIN stores s ON s.id=b.store_id
  WHERE (b.is_archived=0 OR b.is_archived IS NULL)
  GROUP BY category, b.store_id, s.name ORDER BY s.name, category
`);

// 4. Recurring templates
report.recurring_templates = await q(`
  SELECT b.id, b.title, s.name AS store_name, COALESCE(b.category,b.finance_category,'none') AS category,
    b.repeat_type, b.repeat_interval, b.due_date, b.amount, b.status,
    (SELECT COUNT(*) FROM bills c WHERE c.repeat_parent_id=b.id) AS child_count
  FROM bills b JOIN stores s ON s.id=b.store_id
  WHERE b.repeat_parent_id IS NULL AND b.repeat_type<>'none' AND (b.is_archived=0 OR b.is_archived IS NULL)
  ORDER BY s.name, b.title
`);

// 5. Duplicates (same title + store + due_date)
report.duplicates = await q(`
  SELECT b.title, b.store_id, s.name AS store_name, b.due_date,
    COUNT(*) AS cnt, GROUP_CONCAT(b.id ORDER BY b.id) AS ids,
    GROUP_CONCAT(b.amount ORDER BY b.id) AS amounts,
    GROUP_CONCAT(b.status ORDER BY b.id) AS statuses
  FROM bills b JOIN stores s ON s.id=b.store_id
  WHERE (b.is_archived=0 OR b.is_archived IS NULL)
  GROUP BY b.title, b.store_id, s.name, b.due_date HAVING COUNT(*)>1
  ORDER BY s.name, b.title
`);
report.duplicate_count = report.duplicates.length;

// 6. Uncategorized
report.uncategorized = await q(`
  SELECT b.id, b.title, s.name AS store_name, b.due_date, b.amount
  FROM bills b JOIN stores s ON s.id=b.store_id
  WHERE (b.category IS NULL OR b.category='') AND (b.finance_category IS NULL OR b.finance_category='')
    AND (b.is_archived=0 OR b.is_archived IS NULL) ORDER BY s.name, b.due_date
`);
report.uncategorized_count = report.uncategorized.length;

// 7. No owner
report.no_owner = await q(`
  SELECT b.id, b.title, s.name AS store_name, b.due_date
  FROM bills b JOIN stores s ON s.id=b.store_id
  WHERE (b.created_by IS NULL OR b.created_by=0) AND (b.is_archived=0 OR b.is_archived IS NULL)
`);
report.no_owner_count = report.no_owner.length;

// 8. Payments by method
report.payments_by_method = await q(`
  SELECT method, COUNT(*) AS cnt, COALESCE(SUM(amount),0) AS total, ROUND(AVG(amount),2) AS avg_amount
  FROM payments GROUP BY method ORDER BY total DESC
`);

// 9. Orphan payments
report.orphan_payments = await q(`
  SELECT p.id, p.bill_id, p.amount, p.paid_at, p.method
  FROM payments p LEFT JOIN bills b ON b.id=p.bill_id WHERE b.id IS NULL
`);
report.orphan_payment_count = report.orphan_payments.length;

// 10. Overpayments
report.overpaid = await q(`
  SELECT b.id, b.title, s.name AS store_name, b.amount AS bill_amount,
    COALESCE(SUM(p.amount),0) AS total_paid
  FROM bills b JOIN stores s ON s.id=b.store_id
  LEFT JOIN payments p ON p.bill_id=b.id
  WHERE (b.is_archived=0 OR b.is_archived IS NULL)
  GROUP BY b.id, b.title, s.name, b.amount
  HAVING total_paid > bill_amount
`);
report.overpaid_count = report.overpaid.length;

// 11. Paid bills without attachment
try {
  report.paid_no_attachment = await q(`
    SELECT b.id, b.title, s.name AS store_name, b.due_date
    FROM bills b JOIN stores s ON s.id=b.store_id
    LEFT JOIN bill_attachments ba ON ba.bill_id=b.id
    WHERE (b.is_archived=0 OR b.is_archived IS NULL) AND ba.id IS NULL
      AND b.status IN ('paid','accepted') ORDER BY s.name
  `);
  report.paid_no_attachment_count = report.paid_no_attachment.length;
} catch { report.paid_no_attachment_count = 'N/A (no bill_attachments table)'; }

// 12. Obligations
try {
  report.active_obligations = await q(`
    SELECT o.id, o.name, o.vendor, o.store_name, o.frequency, o.due_day, o.amount, o.active,
      c.name AS category_name, o.next_due_date
    FROM obligations o LEFT JOIN obligation_categories c ON o.category_id=c.id
    WHERE o.active=1 ORDER BY c.sort_order, o.name
  `);
  report.obligation_count = report.active_obligations.length;

  report.recent_obligation_payments = await q(`
    SELECT op.id, op.obligation_id, op.due_date, op.amount, op.status, op.paid_amount, op.paid_date,
      o.name AS obligation_name, o.store_name, c.name AS category_name
    FROM obligation_payments op
    JOIN obligations o ON op.obligation_id=o.id
    LEFT JOIN obligation_categories c ON o.category_id=c.id
    ORDER BY op.due_date DESC LIMIT 200
  `);
  report.obligation_payment_count = report.recent_obligation_payments.length;
} catch { report.obligation_error = 'obligations table not accessible'; }

// 13. Category coverage
const expected = ['rent','utility','insurance','tax','licensing','credit_card','loan','subscription','vendor'];
report.expected_categories = expected;
report.category_coverage = [];
for (const store of report.stores) {
  const cats = await q(
    "SELECT DISTINCT LOWER(TRIM(COALESCE(category,finance_category,''))) AS c FROM bills WHERE store_id=? AND (is_archived=0 OR is_archived IS NULL)",
    [store.id]
  );
  const existing = cats.map(r => r.c).filter(Boolean);
  const missing = expected.filter(e => !existing.includes(e));
  report.category_coverage.push({
    store: store.name, existing, missing,
    coverage: `${existing.length}/${expected.length}`
  });
}

// 14. Totals
report.totals = {
  active_bills: await col("SELECT COUNT(*) FROM bills WHERE (is_archived=0 OR is_archived IS NULL)"),
  archived_bills: await col("SELECT COUNT(*) FROM bills WHERE is_archived=1"),
  total_payments: await col("SELECT COUNT(*) FROM payments"),
};

// 15. All bills inventory (for BILL_INVENTORY_MASTER)
report.all_bills = await q(`
  SELECT b.id, b.title, s.name AS store_name, b.due_date, b.amount, b.status,
    COALESCE(b.category, b.finance_category, 'UNCATEGORIZED') AS category,
    b.repeat_type, b.repeat_parent_id,
    COALESCE(v.name, b.vendor) AS vendor_name,
    b.created_by, b.created_at
  FROM bills b
  JOIN stores s ON s.id=b.store_id
  LEFT JOIN vendors v ON b.vendor_id=v.id
  WHERE (b.is_archived=0 OR b.is_archived IS NULL)
  ORDER BY s.name, b.due_date, b.title
`);

// Verdict
let v = 'PASS';
const blockers = [];
if (report.duplicate_count > 0) { v = 'FAIL'; blockers.push(`${report.duplicate_count} duplicate bill sets`); }
if (report.uncategorized_count > 0) blockers.push(`${report.uncategorized_count} uncategorized bills`);
if (report.no_owner_count > 0) blockers.push(`${report.no_owner_count} bills without owner`);
if (report.orphan_payment_count > 0) { v = 'FAIL'; blockers.push(`${report.orphan_payment_count} orphan payments`); }
if (report.overpaid_count > 0) { v = 'FAIL'; blockers.push(`${report.overpaid_count} overpaid bills`); }
report.verdict = v;
report.blockers = blockers;

// Write output
const outPath = 'reports/bill-governance-audit.json';
writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

await db.end();
