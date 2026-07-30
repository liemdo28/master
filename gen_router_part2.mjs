const fs=require('fs');
const p='d:/Project/Master/mi-core/server/src/routes/qb-mirror-router.ts';
const part2=[
"    if (entities.bill_payments.length) { upsertBillPayments(company_file_id, entities.bill_payments); results.bill_payments = entities.bill_payments.length; logSync(company_file_id, machine_id, 'bill_payments', entities.bill_payments.length); }",
"    if (entities.payments.length) { upsertPayments(company_file_id, entities.payments); results.payments = entities.payments.length; logSync(company_file_id, machine_id, 'payments', entities.payments.length); }",
"    if (entities.employees.length) { upsertEmployees(company_file_id, entities.employees); results.employees = entities.employees.length; logSync(company_file_id, machine_id, 'employees', entities.employees.length); }",
"    if (entities.checks.length) { upsertChecks(company_file_id, entities.checks); results.checks = entities.checks.length; logSync(company_file_id, machine_id, 'checks', entities.checks.length); }",
"    if (entities.deposits.length) { upsertDeposits(company_file_id, entities.deposits); results.deposits = entities.deposits.length; logSync(company_file_id, machine_id, 'deposits', entities.deposits.length); }",
"    if (entities.credit_card_charges.length) { upsertCreditCardCharges(company_file_id, entities.credit_card_charges); results.credit_card_charges = entities.credit_card_charges.length; logSync(company_file_id, machine_id, 'credit_card_charges', entities.credit_card_charges.length); }",
"    if (entities.credit_card_credits.length) { upsertCreditCardCredits(company_file_id, entities.credit_card_credits); results.credit_card_credits = entities.credit_card_credits.length; logSync(company_file_id, machine_id, 'credit_card_credits', entities.credit_card_credits.length); }",
"    if (entities.credit_memos.length) { upsertCreditMemos(company_file_id, entities.credit_memos); results.credit_memos = entities.credit_memos.length; logSync(company_file_id, machine_id, 'credit_memos', entities.credit_memos.length); }",
"    if (entities.purchase_orders.length) { upsertPurchaseOrders(company_file_id, entities.purchase_orders); results.purchase_orders = entities.purchase_orders.length; logSync(company_file_id, machine_id, 'purchase_orders', entities.purchase_orders.length); }",
"    if (entities.payroll_checks.length) { upsertPayrollChecks(company_file_id, entities.payroll_checks); results.payroll_checks = entities.payroll_checks.length; logSync(company_file_id, machine_id, 'payroll_checks', entities.payroll_checks.length); }",
"    for (const entityKey of detectQueriedEntityKeys(xml, requestName)) { if (results[entityKey] === undefined) { results[entityKey] = 0; logSync(company_file_id, machine_id, entityKey, 0); } }",
"    const total = Object.values(results).reduce((s, n) => s + n, 0);",
"    res.json({ status: 'ok', received: true, company_file_id, records_stored: total, breakdown: results });",
"  } catch (err) { res.status(500).json({ error: err.message || String(err) }); }",
"});",
"export { rawIngestRouter as qbRawIngestRouter };",
];
// Read existing content
const existing = fs.readFileSync(p, 'utf8');
const lastLine = existing.trim().split('\n').pop() || '';
// If last line is cut off, fix it
let fixed = existing;
if (!lastLine.includes(';') && !lastLine.includes('}')) {
  // Try to find where the cut happened
  const cutPoint = existing.lastIndexOf('entities.');
  if (cutPoint > 0) {
    const before = existing.substring(0, cutPoint);
    fixed = before + part2.join('\n');
  }
} else {
  fixed = existing + '\n' + part2.join('\n');
}
fs.writeFileSync(p, fixed + '\n');
console.log('Router restored, lines:', fixed.split('\n').length);
