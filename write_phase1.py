#!/usr/bin/env python3
import os

ts = """/**
 * QB Mirror Phase 1 — Per-Store Reports Router
 * GET /api/qb/mirror/stores         — All stores overview
 * GET /api/qb/mirror/store-report   — Per-store P&L + BS + Cash
 * GET /api/qb/mirror/store-revenue  — Per-store revenue by month
 * GET /api/qb/mirror/store-compare — Store comparison grid
 */
import { Router, Request, Response } from 'express';
import { getCompanyFiles, getAccounts, getInvoices, getSalesReceipts, getBills, getChecks, getDeposits, getCreditCardCharges, getCreditCardCredits, getPayments } from '../quickbooks/qb-mirror-db';

const router = Router();

const STORE_LABELS: Record<string, string> = {
  'bakudan-b1': 'Bakudan B1', 'bakudan-b2': 'Bakudan B2', 'bakudan-b3': 'Bakudan B3',
  'copper': 'The Coppers', 'ift': 'IFT / New Tea House', 'jinya': 'Jinya', 'raw-stockton': 'Raw Stockton'
};

function storeLabel(code: string): string { return STORE_LABELS[code] || code || 'Unassigned'; }

function calcPnL(accts: Record<string, unknown>[]) {
  const income = accts.filter(a => a.account_type === 'Income' || a.account_type === 'OtherIncome');
  const cogs = accts.filter(a => a.account_type === 'CostOfGoodsSold');
  const exp = accts.filter(a => ['Expense', 'OtherExpense'].includes(a.account_type as string));
  const tI = income.reduce((s, a) => s + ((a.balance as number) || 0), 0);
  const tC = cogs.reduce((s, a) => s + ((a.balance as number) || 0), 0);
  const tE = exp.reduce((s, a) => s + ((a.balance as number) || 0), 0);
  return { income: tI, cogs: tC, expense: tE, net: tI - tC - tE };
}

function calcBS(accts: Record<string, unknown>[]) {
  const assets = accts.filter(a => ['AccountsReceivable','Bank','OtherCurrentAsset','FixedAsset','OtherAsset'].includes(a.account_type as string));
  const liab = accts.filter(a => ['AccountsPayable','CreditCard','OtherCurrentLiability','LongTermLiability'].includes(a.account_type as string));
  const equity = accts.filter(a => ['Equity','RetainedEarnings'].includes(a.account_type as string));
  const tA = assets.reduce((s, a) => s + ((a.total_balance as number) || (a.balance as number) || 0), 0);
  const tL = liab.reduce((s, a) => s + ((a.total_balance as number) || (a.balance as number) || 0), 0);
  const tE = equity.reduce((s, a) => s + ((a.total_balance as number) || (a.balance as number) || 0), 0);
  return { assets: tA, liabilities: tL, equity: tE };
}

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
      const sales = rcpts.reduce((s, n) => s + ((n.total_amount as number) || 0), 0)
        + invs.filter(i => i.is_paid).reduce((s, n) => s + ((n.total_amount as number) || 0), 0);
      const ar = invs.filter(i => !i.is_paid).reduce((s, n) => s + ((n.amount_due as number) || 0), 0);
      const ap = bls.filter(b => !b.is_paid).reduce((s, n) => s + ((n.amount_due as number) || 0), 0);
      const cash = dep.reduce((s, n) => s + ((n.total_amount as number) || 0), 0)
        + chks.reduce((s, n) => s + ((n.amount as number) || 0), 0);
      const pn = calcPnL(accts);
      return { company_file_id: cf.company_file_id, company_name: cf.company_name, store: storeLabel(cf.company_file_id), sales, ar, ap, cash, net_income: pn.net, synced_at: cf.last_sync_at };
    });
    res.json({ ok: true, count: stores.length, stores });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
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
        payments_received: pays.reduce((s, n) => s + ((n.total_amount as number) || 0), 0)
      },
      ar: { total: unpaidInv.reduce((s, n) => s + ((n.amount_due as number) || 0), 0), count: unpaidInv.length, invoices: unpaidInv },
      ap: { total: unpaidBills.reduce((s, n) => s + ((n.amount_due as number) || 0), 0), count: unpaidBills.length, bills: unpaidBills }
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// GET /store-revenue — per-store revenue by month
router.get('/store-revenue', (req: Request, res: Response) => {
  try {
    const company = req.query.company as string | undefined;
    const companies = getCompanyFiles();
    const companyInfo = company ? companies.find(c => c.company_file_id === company) : null;
    const rcpts = getSalesReceipts(company);
    const invs = getInvoices(company);
    const byMonth: Record<string, { receipts: number; paid_invoices: number; total: number }> = {};
    rcpts.forEach(r => {
      const m = (r.txn_date as string || '').slice(0, 7);
      if (!byMonth[m]) byMonth[m] = { receipts: 0, paid_invoices: 0, total: 0 };
      byMonth[m].receipts += (r.total_amount as number) || 0;
      byMonth[m].total += (r.total_amount as number) || 0;
    });
    invs.filter(i => i.is_paid).forEach(i => {
      const m = (i.txn_date as string || '').slice(0, 7);
      if (!byMonth[m]) byMonth[m] = { receipts: 0, paid_invoices: 0, total: 0 };
      byMonth[m].paid_invoices += (i.total_amount as number) || 0;
      byMonth[m].total += (i.total_amount as number) || 0;
    });
    const months = Object.keys(byMonth).sort();
    const grandTotal = Object.values(byMonth).reduce((s, m) => s + m.total, 0);
    res.json({ ok: true, company_file_id: company, company_name: companyInfo?.company_name, store: storeLabel(company || ''), grand_total: grandTotal, months: months.map(m => ({ month: m, ...byMonth[m] })) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// GET /store-compare — all stores comparison
router.get('/store-compare', (_req: Request, res: Response) => {
  try {
    const companies = getCompanyFiles();
    const rows = companies.map(cf => {
      const accts = getAccounts(cf.company_file_id);
      const rcpts = getSalesReceipts(cf.company_file_id);
      const invs = getInvoices(cf.company_file_id);
      const bls = getBills(cf.company_file_id);
     