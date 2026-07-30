/**
 * Stores raw QBXML responses from QBWC into SQLite for the workflow engine.
 */
import fs from 'fs';
import path from 'path';
import { logger } from '../storage/logs';

const DATA_DIR = process.env.LOCAL_DB_PATH
  ? path.dirname(process.env.LOCAL_DB_PATH)
  : path.join(process.cwd(), 'data');

const QB_DATA_FILE = path.join(DATA_DIR, 'qb-raw-data.json');
const SYNC_STATUS_FILE = path.join(DATA_DIR, 'qb-sync-status.json');

interface SyncStatus {
  last_sync: string | null;
  last_company_file: string | null;
  requests_received: number;
  total_bytes: number;
  error: string | null;
}

let syncStatus: SyncStatus = {
  last_sync: null,
  last_company_file: null,
  requests_received: 0,
  total_bytes: 0,
  error: null,
};

// Load existing status on startup
try {
  if (fs.existsSync(SYNC_STATUS_FILE)) {
    syncStatus = JSON.parse(fs.readFileSync(SYNC_STATUS_FILE, 'utf-8'));
  }
} catch { /* ignore */ }

export function storeQbData(requestIndex: number, companyFile: string, xmlResponse: string): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });

    // Append to raw data file (keyed by request index + timestamp)
    let existing: Record<string, unknown> = {};
    if (fs.existsSync(QB_DATA_FILE)) {
      try { existing = JSON.parse(fs.readFileSync(QB_DATA_FILE, 'utf-8')); } catch { existing = {}; }
    }

    const key = `req_${requestIndex}_${Date.now()}`;
    existing[key] = {
      request_index: requestIndex,
      company_file: companyFile,
      received_at: new Date().toISOString(),
      xml: xmlResponse,
    };

    fs.writeFileSync(QB_DATA_FILE, JSON.stringify(existing, null, 2));

    // Update sync status
    syncStatus.last_sync = new Date().toISOString();
    syncStatus.last_company_file = companyFile;
    syncStatus.requests_received++;
    syncStatus.total_bytes += xmlResponse.length;
    syncStatus.error = null;

    fs.writeFileSync(SYNC_STATUS_FILE, JSON.stringify(syncStatus, null, 2));

    logger.info(`QB data stored: request ${requestIndex}, ${xmlResponse.length} bytes, file: ${companyFile}`);
  } catch (err) {
    logger.error(`Failed to store QB data: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export function getLastSyncStatus(): SyncStatus {
  return syncStatus;
}

// ── XML parser helpers ─────────────────────────────────────────────────────

function extractAll(xml: string, tag: string): string[] {
  const results: string[] = [];
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  let m;
  while ((m = re.exec(xml)) !== null) results.push(m[1].trim());
  return results;
}

function extractOne(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? m[1].trim() : '';
}

function parseAmount(val: string): number {
  const n = parseFloat(val.replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

export interface FinancialSummary {
  last_sync: string | null;
  last_company_file: string | null;
  requests_received: number;
  accounts: { name: string; type: string; balance: number }[];
  total_income: number;
  total_expense: number;
  net_income: number;
  sales_receipts_30d: { date: string; total: number; customer: string }[];
  total_sales_30d: number;
  invoices_30d: { date: string; total: number; customer: string; status: string }[];
  total_invoices_30d: number;
  outstanding_invoices: number;
  transaction_count: number;
}

export function parseFinancialSummary(): FinancialSummary {
  const status = syncStatus;
  const summary: FinancialSummary = {
    last_sync: status.last_sync,
    last_company_file: status.last_company_file,
    requests_received: status.requests_received,
    accounts: [],
    total_income: 0,
    total_expense: 0,
    net_income: 0,
    sales_receipts_30d: [],
    total_sales_30d: 0,
    invoices_30d: [],
    total_invoices_30d: 0,
    outstanding_invoices: 0,
    transaction_count: 0,
  };

  if (!fs.existsSync(QB_DATA_FILE)) return summary;

  let raw: Record<string, { request_index: number; xml: string }> = {};
  try { raw = JSON.parse(fs.readFileSync(QB_DATA_FILE, 'utf-8')); } catch { return summary; }

  for (const entry of Object.values(raw)) {
    const xml = entry.xml || '';

    // ── Accounts (request 0: income + expense) ──────────────────────────
    if (entry.request_index === 0) {
      const accountRets = extractAll(xml, 'AccountRet');
      for (const acct of accountRets) {
        const name = extractOne(acct, 'FullName') || extractOne(acct, 'Name');
        const type = extractOne(acct, 'AccountType');
        const balance = parseAmount(extractOne(acct, 'Balance') || extractOne(acct, 'TotalBalance'));
        if (!name) continue;
        summary.accounts.push({ name, type, balance });
        if (type === 'Income' || type === 'OtherIncome') summary.total_income += balance;
        if (type === 'Expense' || type === 'OtherExpense' || type === 'CostOfGoodsSold') summary.total_expense += balance;
      }
      summary.net_income = summary.total_income - summary.total_expense;
    }

    // ── Sales Receipts (request 1) ───────────────────────────────────────
    if (entry.request_index === 1) {
      const receipts = extractAll(xml, 'SalesReceiptRet');
      for (const r of receipts) {
        const date = extractOne(r, 'TxnDate');
        const total = parseAmount(extractOne(r, 'TotalAmount') || extractOne(r, 'SubTotal'));
        const customer = extractOne(r, 'FullName') || extractOne(r, 'ListID') || 'Unknown';
        if (total > 0) {
          summary.sales_receipts_30d.push({ date, total, customer });
          summary.total_sales_30d += total;
        }
      }
    }

    // ── Invoices (request 2) ─────────────────────────────────────────────
    if (entry.request_index === 2) {
      const invoices = extractAll(xml, 'InvoiceRet');
      for (const inv of invoices) {
        const date = extractOne(inv, 'TxnDate');
        const total = parseAmount(extractOne(inv, 'TotalAmount') || extractOne(inv, 'SubTotal'));
        const customer = extractOne(extractOne(inv, 'CustomerRef'), 'FullName') || 'Unknown';
        const isPaid = extractOne(inv, 'IsPaid') === 'true';
        const status = isPaid ? 'paid' : 'outstanding';
        if (total > 0) {
          summary.invoices_30d.push({ date, total, customer, status });
          summary.total_invoices_30d += total;
          if (!isPaid) summary.outstanding_invoices += total;
        }
      }
    }
  }

  summary.transaction_count = summary.sales_receipts_30d.length + summary.invoices_30d.length;
  return summary;
}
