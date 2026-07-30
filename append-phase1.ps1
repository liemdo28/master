$routes = @'

// GET /stores — all stores overview
router.get('/stores', (_req: Request, res: Response) => {
  try {
    const companies = getCompanyFiles();
    const stores = companies.map(cf => {
      const accts = getAccounts(cf.company_file_id);
      const rcpts = getSalesReceipts(cf.company_file_id);
      const invs = getInvoices(cf.company_file_id);
      const bls = getBills(cf.company_file_id);
      const dep = getDeposits(cf.company_file_id);
      const chks = getChecks(cf.company_file_id);
      const sales = rcpts.reduce((s, n) => s + ((n.total_amount as number) || 0), 0) + invs.filter(i => i.is_paid).reduce((s, n) => s + ((n.total_amount as number) || 0), 0);
      const ar = invs.filter(i => !i.is_paid).reduce((s, n) => s + ((n.amount_due as number) || 0), 0);
      const ap = bls.filter(b => !b.is_paid).reduce((s, n) => s + ((n.amount_due as number) || 0), 0);
      const cash = dep.reduce((s, n) => s + ((n.total_amount as number) || 0), 0) + chks.reduce((s, n) => s + ((n.amount as number) || 0), 0);
      const pn = calcPnL(accts);
      return { company_file_id: cf.company_file_id, company_name: cf.company_name, store: storeLabel(cf.company_file_id), sales, ar, ap, cash, net_income: pn.net, synced_at: cf.last_sync_at };
    });
    res.json({ ok: true, count: stores.length, stores });
  } catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : String(err) }); }
});

// GET /store-report — per-store P&L + BS + Cash
router.get('/store-report', (req: Request, res: Response) => {
  try {
    const company = req.query.company as string | undefined;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const companies = getCompanyFiles();
    const companyInfo = company ? companies.find(c => c.company_file_id === company) : null;
    const accts = getAccounts(company);
    const invs = getInvoices(company, from, to);
    const rcpts = getSalesReceipts(company, from, to);
    const bls = getBills(company);
    const chks = getChecks(company, from, to);
    const dep = getDeposits(company, from, to);
    const ccCharge = getCreditCardCharges(company, from, to);
    const ccCredit = getCreditCardCredits(company, from, to);
    const pays = getPayments(company, from, to);
    const pn = calcPnL(accts);
    const bs = calcBS(accts);
    const unpaidInv = invs.filter(i => !i.is_paid);
    const unpaidBills = bls.filter(b => !b.is_paid);
    res.json({
      ok: true, company_file_id: company, company_name: companyInfo?.company_name, store: storeLabel(company || ''),
      period: { from, to },
      pl: { ...pn, income_accounts: accts.filter(a => a.account_type === 'Income' || a.account_type === 'OtherIncome') },
      balance_sheet: { ...bs },
      cash: {
        deposits: dep.reduce((s, n) => s + ((n.total_amount as number) || 0), 0),
        checks: chks.reduce((s, n) => s + ((n.amount as number) || 0), 0),
        cc_charges: ccCharge.reduce((s, n) => s + ((n.amount as number) || 0), 0),
        cc_credits: ccCredit.reduce((s, n) => s + ((n.amount as number) || 0), 0),
        payments_received: pays.reduce((s, n) => s + ((n.total_amount as