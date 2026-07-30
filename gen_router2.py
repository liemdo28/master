f=open(r'd:\Project\Master\mi-core\server\src\routes\qb-mirror-router.ts','a')
f.write(""", count: data.length, deposits: data });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get('/credit-card-charges', (req: Request, res: Response) => {
  try {
    const { company, from, to } = req.query as Record<string, string>;
    const data = getCreditCardCharges(company, from, to);
    res.json({ ok: true, count: data.length, credit_card_charges: data });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get('/credit-card-credits', (req: Request, res: Response) => {
  try {
    const { company, from, to } = req.query as Record<string, string>;
    const data = getCreditCardCredits(company, from, to);
    res.json({ ok: true, count: data.length, credit_card_credits: data });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get('/employees', (req: Request, res: Response) => {
  try {
    const company = req.query.company as string | undefined;
    const data = getEmployees(company).map(({ ssn, ...employee }) => employee);
    res.json({ ok: true, count: data.length, employees: data });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get('/payroll-checks', (req: Request, res: Response) => {
  try {
    const { company, from, to } = req.query as Record<string, string>;
    const data = getPayrollChecks(company, from, to);
    res.json({ ok: true, count: data.length, payroll_checks: data });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get('/sync-log', (req: Request, res: Response) => {
  try {
    const company = req.query.company as string | undefined;
    const limit = parseInt(req.query.limit as string || '50', 10);
    res.json({ ok: true, log: getSyncLog(company, limit) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── P&L snapshot (derived from accounts + transactions) ───────────────────

router.get('/pl', (req: Request, res: Response) => {
  try {
    const { company, from, to } = req.query as Record<string, string>;
    const accounts = getAccounts(company);
    const receipts = getSalesReceipts(company, from, to);
    const invoices = getInvoices(company, from, to);
    const bills = getBills(company);

    const income_accounts = accounts.filter(a => a.account_type === 'Income' || a.account_type === 'OtherIncome');
    const expense_accounts = accounts.filter(a =>
      a.account_type === 'Expense' || a.account_type === 'OtherExpense' || a.account_type === 'CostOfGoodsSold'
    );

    const total_income = income_accounts.reduce((s, a) => s + ((a.balance as number) || 0), 0);
    const total_expense = expense_accounts.reduce((s, a) => s + ((a.balance as number) || 0), 0);
    const total_sales = receipts.reduce((s, r) => s + ((r.total_amount as number) || 0), 0)
                      + invoices.filter(i => i.is_paid).reduce((s, i) => s + ((i.total_amount as number) || 0), 0);
    const outstanding_ar = invoices.filter(i => !i.is_paid).reduce((s, i) => s + ((i.amount_due as number) || 0), 0);
    const outstanding_ap = bills.filter(b => !b.is_paid).reduce((s, b) => s + ((b.amount_due as number) || 0), 0);

    res.json({
      ok: true,
      period: { from: from || null, to: to || null },
      income: { total: total_income, accounts: income_accounts },
      expense: { total: total_expense, accounts: expense_accounts },
      net_income: total_income - total_expense,
      total_sales,
      outstanding_ar,
      outstanding_ap,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export { router as qbMirrorRouter };

// ── Raw XML ingest — mounted at /api/qb/ingest for dev1's JS agent ─────────
const rawIngestRouter = Router();

const QBXML_RESPONSE_ENTITY_KEYS: Record<string, string> = {
  AccountQueryRs: 'accounts', CustomerQueryRs: 'customers', VendorQueryRs: 'vendors',
  ItemQueryRs: 'items', InvoiceQueryRs: 'invoices', SalesReceiptQueryRs: 'sales_receipts',
  BillQueryRs: 'bills', BillPaymentCheckQueryRs: 'bill_payments', ReceivePaymentQueryRs: 'payments',
  CheckQueryRs: 'checks', DepositQueryRs: 'deposits', CreditCardChargeQueryRs: 'credit_card_charges',
  CreditCardCreditQueryRs: 'credit_card_credits', CreditMemoQueryRs: 'credit_memos',
  PurchaseOrderQueryRs: 'purchase_orders', EmployeeQueryRs: 'employees',
  PayrollItemWageQueryRs: 'payroll_checks', PaycheckQueryRs: 'payroll_checks',
};

function detectQueriedEntityKeys(xml: string, requestName: string): string[] {
  const found = new Set<string>();
  for (const [tag, entityKey] of Object.entries(QBXML_RESPONSE_ENTITY_KEYS)) {
    if (xml.includes(`<${tag}`)) found.add(entityKey);
  }
  const normalizedRequestName = requestName.trim();
  const requestEntity = QBXML_RESPONSE_ENTITY_KEYS[normalizedRequestName]
    || QBXML_RESPONSE_ENTITY_KEYS[normalizedRequestName.replace(/Rq$/, 'Rs')]
    || QBXML_RESPONSE_ENTITY_KEYS[normalizedRequestName.replace(/Query$/, 'QueryRs')];
  if (requestEntity) found.add(requestEntity);
  return [...found];
}

rawIngestRouter.post('/ingest', (req: Request, res: Response) => {
  console.log(`[QB-INGEST-ENTRY] method=${req.method} ct="${req.headers['content-type']}"`);
  try {
    const apiKey = (req.headers['x-qb-api-key'] as string) || '';
    const expectedKey = process.env.QB_API_KEY || process.env.QBWC_PASS || '';
    if (expectedKey && apiKey !== expectedKey) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const xml: string = Buffer.isBuffer(req.body)
      ? req.body.toString('utf8')
      : typeof req.body === 'string' ? req.body : '';
    if (!xml) return res.status(400).json({ error: 'Empty body' });
    const requestName = (req.headers['x-qb-request-name'] as string) || '';
    const companyFilePath = (req.headers['x-company-file'] as string) || 'laptop1-default';
    const machine_id = (req.headers['x-machine-id'] as string) || 'laptop1';
    const company_file_id = Buffer.from(companyFilePath).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 32);
    upsertCompanyFile({ company_file_id, company_name: undefined, company_file_path: companyFilePath, machine_id, machine_hostname: machine_id });
    const entities = parseAllEntities(xml);
    const results: Record<string, number> = {};
    if (entities.accounts.length) { upsertAccounts(company_file_id, entities.accounts); results.accounts = entities.accounts.length; logSync(company_file_id, machine_id, 'accounts', entities.accounts.length); }
    if (entities.customers.length) { upsertCustomers(company_file_id, entities.customers); results.customers = entities.customers.length; logSync(company_file_id, machine_id, 'customers', entities.customers.length); }
    if (entities.vendors.length) { upsertVendors(company_file_id, entities.vendors); results.vendors = entities.vendors.length; logSync(company_file_id, machine_id, 'vendors', entities.vendors.length); }
    if (entities.items.length) { upsertItems(company_file_id, entities.items); results.items = entities.items.length; logSync(company_file_id, machine_id, 'items', entities.items.length); }
    if (entities.invoices.length) { upsertInvoices(company_file_id, entities.invoices); results.invoices = entities.invoices.length; logSync(company_file_id, machine_id, 'invoices', entities.invoices.length); }
    if (entities.sales_receipts.length) { upsertSalesReceipts(company_file_id, entities.sales_receipts); results.sales_receipts = entities.sales_receipts.length; logSync(company_file_id, machine_id, 'sales_receipts', entities.sales_receipts.length); }
    if (entities.bills.length) { upsertBills(company_file_id, entities.bills); results.bills = entities.bills.length; logSync(company_file_id, machine_id, 'bills', entities.bills.length); }
    if (entities.bill_payments.length) { upsertBillPayments(company_file_id, entities.bill_payments); results.bill_payments = entities.bill_payments.length; logSync(company_file_id, machine_id, 'bill_payments', entities.bill_payments.length); }
    if (entities.payments.length) { upsertPayments(company_file_id, entities.payments); results.payments = entities.payments.length; logSync(company_file_id, machine_id, 'payments', entities.payments.length); }
    if (entities.employees.length) { upsertEmployees(company_file_id, entities.employees); results.employees = entities.employees.length; logSync(company_file_id, machine_id, 'employees', entities.employees.length); }
    if (entities.checks.length) { upsertChecks(company_file_id, entities.checks); results.checks = entities.checks.length; logSync(company_file_id, machine_id, 'checks', entities.checks.length); }
    if (entities.deposits.length) { upsertDeposits(company_file_id, entities.deposits); results.deposits = entities.deposits.length; logSync(company_file_id, machine_id, 'deposits', entities.deposits.length); }
    if (entities.credit_card_charges.length) { upsertCreditCardCharges(company_file_id, entities.credit_card_charges); results.credit_card_charges = entities.credit_card_charges.length; logSync(company_file_id, machine_id, 'credit_card_charges', entities.credit_card_charges.length); }
    if (entities.credit_card_credits.length) { upsertCreditCardCredits(company_file_id, entities.credit_card_credits); results.credit_card_credits = entities.credit_card_credits.length; logSync(company_file_id, machine_id, 'credit_card_credits', entities.credit_card_credits.length); }
    if (entities.credit_memos.length) { upsertCreditMemos(company_file_id, entities.credit_memos); results.credit_memos = entities.credit_memos.length; logSync(company_file_id, machine_id, 'credit_memos', entities.credit_memos.length); }
    if (entities.purchase_orders.length) { upsertPurchaseOrders(company_file_id, entities.purchase_orders); results.purchase_orders = entities.purchase_orders.length; logSync(company_file_id, machine_id, 'purchase_orders', entities.purchase_orders.length); }
    if (entities.payroll_checks.length) { upsertPayrollChecks(company_file_id, entities.payroll_checks); results.payroll_checks = entities.payroll_checks.length; logSync(company_file_id, machine_id, 'payroll_checks', entities.payroll_checks.length); }
    for (const entityKey of detectQueriedEntityKeys(xml, requestName)) {
      if (results[entityKey] === undefined) { results[entityKey] = 0; logSync(company_file_id, machine_id, entityKey, 0); }
    }
    const total = Object.values(results).reduce((s, n) => s + n, 0);
    res.json({ status: 'ok', received: true, company_file_id, records_stored: total, breakdown: results });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export { rawIngestRouter as qbRawIngestRouter };
""")
f.close()
print('Done appending')
