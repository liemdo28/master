f=open(r'd:\Project\Master\mi-core\server\src\routes\qb-mirror-router.ts','w')
f.write("""/**
 * QB Mirror Router — receives QB data from qb-ops-agent on each laptop
 * and serves query endpoints for reports/dashboards without opening QB Enterprise.
 *
 * Raw XML ingest (from dev1's agent):
 *   POST /api/qb/ingest          ← raw QBXML, header X-QB-API-Key
 *
 * Structured ingest (from TypeScript agent):
 *   POST /api/qb/mirror/ingest
 *
 * Query:  GET  /api/qb/mirror/summary
 *         GET  /api/qb/mirror/companies
 *         GET  /api/qb/mirror/accounts
 *         GET  /api/qb/mirror/customers
 *         GET  /api/qb/mirror/vendors
 *         GET  /api/qb/mirror/invoices
 *         GET  /api/qb/mirror/receipts
 *         GET  /api/qb/mirror/bills
 *         GET  /api/qb/mirror/payments
 *         GET  /api/qb/mirror/checks
 *         GET  /api/qb/mirror/employees
 *         GET  /api/qb/mirror/sync-log
 */
import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import path from 'path';
import {
  upsertCompanyFile, logSync,
  upsertAccounts, upsertCustomers, upsertVendors, upsertItems,
  upsertInvoices, upsertSalesReceipts, upsertBills, upsertBillPayments,
  upsertPayments, upsertChecks, upsertDeposits, upsertCreditCardCharges,
  upsertCreditCardCredits, upsertCreditMemos, upsertPurchaseOrders,
  upsertEmployees, upsertPayrollChecks,
  getCompanyFiles, getAccounts, getCustomers, getVendors,
  getInvoices, getSalesReceipts, getBills, getSyncLog,
  getChecks, getPayments, getDeposits, getCreditCardCharges, getCreditCardCredits,
  getEmployees, getPayrollChecks,
  getMirrorSummary, getMirrorCoverage, getMirrorAllReport,
} from '../quickbooks/qb-mirror-db';
import { parseAllEntities } from '../quickbooks/qb-xml-parser';

const router = Router();
const MI_CORE_ROOT = process.env.MI_CORE_ROOT || path.resolve(__dirname, '../../..');
const DATA_DIR = process.env.MI_DATA_DIR || path.join(MI_CORE_ROOT, 'data');
const QB_AGENT_DB_PATH = path.join(DATA_DIR, 'qb-agent.db');

// ── Ingest (called by qb-ops-agent on each laptop after QBWC sync) ─────────

router.post('/ingest', (req: Request, res: Response) => {
  try {
    const { company_file_id, company_name, company_file_path, machine_id, machine_hostname, entity_type, records } = req.body as {
      company_file_id: string;
      company_name?: string;
      company_file_path?: string;
      machine_id?: string;
      machine_hostname?: string;
      entity_type: string;
      records: Record<string, unknown>[];
    };

    if (!company_file_id || !entity_type || !Array.isArray(records)) {
      return res.status(400).json({ error: 'company_file_id, entity_type, and records[] are required' });
    }

    upsertCompanyFile({ company_file_id, company_name, company_file_path, machine_id, machine_hostname });

    const upsertFns: Record<string, (cfid: string, rows: Record<string, unknown>[]) => number> = {
      accounts: upsertAccounts,
      customers: upsertCustomers,
      vendors: upsertVendors,
      items: upsertItems,
      invoices: upsertInvoices,
      sales_receipts: upsertSalesReceipts,
      bills: upsertBills,
      bill_payments: upsertBillPayments,
      payments: upsertPayments,
      checks: upsertChecks,
      deposits: upsertDeposits,
      credit_card_charges: upsertCreditCardCharges,
      credit_card_credits: upsertCreditCardCredits,
      credit_memos: upsertCreditMemos,
      purchase_orders: upsertPurchaseOrders,
      employees: upsertEmployees,
      payroll_checks: upsertPayrollChecks,
    };

    const fn = upsertFns[entity_type];
    if (!fn) return res.status(400).json({ error: `Unknown entity_type: ${entity_type}` });

    const count = fn(company_file_id, records);
    logSync(company_file_id, machine_id || '', entity_type, count);

    res.json({ ok: true, entity_type, records_upserted: count });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── Query endpoints ────────────────────────────────────────────────────────

router.get('/summary', (_req: Request, res: Response) => {
  try {
    const company = _req.query.company as string | undefined;
    res.json({ ok: true, summary: getMirrorSummary(company), companies: getCompanyFiles() });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get('/coverage', (req: Request, res: Response) => {
  try {
    const company = req.query.company as string | undefined;
    res.json({ ok: true, coverage: getMirrorCoverage(company) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get('/report', (req: Request, res: Response) => {
  try {
    const company = req.query.company as string | undefined;
    res.json({ ok: true, report: getMirrorAllReport(company) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get('/companies', (_req: Request, res: Response) => {
  try {
    res.json({ ok: true, companies: getCompanyFiles() });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get('/store-sync', (req: Request, res: Response) => {
  try {
    const machineId = req.query.machine_id as string | undefined;
    const allMachines = !machineId || machineId === 'all';
    const db = new Database(QB_AGENT_DB_PATH, { readonly: true, fileMustExist: true });
    try {
      const machines = db.prepare('SELECT * FROM machines ORDER BY last_seen_at DESC').all();
      const files = allMachines
        ? db.prepare('SELECT * FROM qb_files ORDER BY machine_id, enabled DESC, store_code, file_id').all()
        : db.prepare('SELECT * FROM qb_files WHERE machine_id = ? ORDER BY enabled DESC, store_code, file_id').all(machineId);
      const cycles = allMachines
        ? db.prepare('SELECT * FROM sync_cycles ORDER BY started_at DESC LIMIT 100').all()
        : db.prepare('SELECT * FROM sync_cycles WHERE machine_id = ? ORDER BY started_at DESC LIMIT 50').all(machineId);
      const statusRow = db.prepare(`
        SELECT
          (SELECT COUNT(*) FROM machines) AS total_machines,
          (SELECT COUNT(*) FROM machines WHERE status='online') AS online_machines,
          (SELECT COUNT(*) FROM commands WHERE status='pending') AS pending_commands
      `).get() as Record<string, unknown>;
      const recent_errors = db.prepare('SELECT * FROM error_reports ORDER BY received_at DESC LIMIT 10').all();
      res.json({
        ok: true,
        machine_id: allMachines ? 'all' : machineId,
        status: { ...statusRow, recent_errors, timestamp: new Date().toISOString() },
        machines,
        files,
        cycles,
        mirror_companies: getCompanyFiles(),
      });
    } finally {
      db.close();
    }
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.get('/accounts', (req: Request, res: Response) => {
  try {
    const company = req.query.company as string | undefined;
    const data = getAccounts(company);
    res.json({ ok: true, count: data.length, accounts: data });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get('/customers', (req: Request, res: Response) => {
  try {
    const company = req.query.company as string | undefined;
    const data = getCustomers(company);
    res.json({ ok: true, count: data.length, customers: data });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get('/vendors', (req: Request, res: Response) => {
  try {
    const company = req.query.company as string | undefined;
    const data = getVendors(company);
    res.json({ ok: true, count: data.length, vendors: data });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get('/invoices', (req: Request, res: Response) => {
  try {
    const { company, from, to, unpaid } = req.query as Record<string, string>;
    const data = getInvoices(company, from, to, unpaid === '1' || unpaid === 'true');
    const total_amount = data.reduce((s, r) => s + ((r.total_amount as number) || 0), 0);
    const outstanding = data.filter(r => !r.is_paid).reduce((s, r) => s + ((r.amount_due as number) || 0), 0);
    res.json({ ok: true, count: data.length, total_amount, outstanding, invoices: data });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get('/receipts', (req: Request, res: Response) => {
  try {
    const { company, from, to } = req.query as Record<string, string>;
    const data = getSalesReceipts(company, from, to);
    const total = data.reduce((s, r) => s + ((r.total_amount as number) || 0), 0);
    res.json({ ok: true, count: data.length, total_amount: total, receipts: data });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get('/bills', (req: Request, res: Response) => {
  try {
    const { company, unpaid } = req.query as Record<string, string>;
    const data = getBills(company, unpaid === '1' || unpaid === 'true');
    const total_due = data.filter(r => !r.is_paid).reduce((s, r) => s + ((r.amount_due as number) || 0), 0);
    res.json({ ok: true, count: data.length, total_due, bills: data });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get('/checks', (req: Request, res: Response) => {
  try {
    const { company, from, to } = req.query as Record<string, string>;
    const data = getChecks(company, from, to);
    res.json({ ok: true, count: data.length, checks: data });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get('/payments', (req: Request, res: Response) => {
  try {
    const { company, from, to } = req.query as Record<string, string>;
    const data = getPayments(company, from, to);
    res.json({ ok: true, count: data.length, payments: data });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get('/deposits', (req: Request, res: Response) => {
  try {
    const { company, from, to } = req.query as Record<string, string>;
    const data = getDeposits(company, from, to);
    res.json({ ok: true