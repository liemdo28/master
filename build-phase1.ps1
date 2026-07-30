$file = 'd:\Project\Master\mi-core\server\src\routes\qb-mirror-phase1.ts'
$code = @'
/**
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
  return { income: tI, cogs: tC, expense: tE, net: tI - tC -