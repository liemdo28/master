"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseFinancialSummary = exports.getLastSyncStatus = exports.storeQbData = void 0;
/**
 * Stores raw QBXML responses from QBWC into SQLite for the workflow engine.
 */
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const logs_1 = require("../storage/logs");
const DATA_DIR = process.env.LOCAL_DB_PATH
    ? path_1.default.dirname(process.env.LOCAL_DB_PATH)
    : path_1.default.join(process.cwd(), 'data');
const QB_DATA_FILE = path_1.default.join(DATA_DIR, 'qb-raw-data.json');
const SYNC_STATUS_FILE = path_1.default.join(DATA_DIR, 'qb-sync-status.json');
let syncStatus = {
    last_sync: null,
    last_company_file: null,
    requests_received: 0,
    total_bytes: 0,
    error: null,
};
// Load existing status on startup
try {
    if (fs_1.default.existsSync(SYNC_STATUS_FILE)) {
        syncStatus = JSON.parse(fs_1.default.readFileSync(SYNC_STATUS_FILE, 'utf-8'));
    }
}
catch { /* ignore */ }
function storeQbData(requestIndex, companyFile, xmlResponse) {
    try {
        fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
        // Append to raw data file (keyed by request index + timestamp)
        let existing = {};
        if (fs_1.default.existsSync(QB_DATA_FILE)) {
            try {
                existing = JSON.parse(fs_1.default.readFileSync(QB_DATA_FILE, 'utf-8'));
            }
            catch {
                existing = {};
            }
        }
        const key = `req_${requestIndex}_${Date.now()}`;
        existing[key] = {
            request_index: requestIndex,
            company_file: companyFile,
            received_at: new Date().toISOString(),
            xml: xmlResponse,
        };
        fs_1.default.writeFileSync(QB_DATA_FILE, JSON.stringify(existing, null, 2));
        // Update sync status
        syncStatus.last_sync = new Date().toISOString();
        syncStatus.last_company_file = companyFile;
        syncStatus.requests_received++;
        syncStatus.total_bytes += xmlResponse.length;
        syncStatus.error = null;
        fs_1.default.writeFileSync(SYNC_STATUS_FILE, JSON.stringify(syncStatus, null, 2));
        logs_1.logger.info(`QB data stored: request ${requestIndex}, ${xmlResponse.length} bytes, file: ${companyFile}`);
    }
    catch (err) {
        logs_1.logger.error(`Failed to store QB data: ${err instanceof Error ? err.message : String(err)}`);
    }
}
exports.storeQbData = storeQbData;
function getLastSyncStatus() {
    return syncStatus;
}
exports.getLastSyncStatus = getLastSyncStatus;
// ── XML parser helpers ─────────────────────────────────────────────────────
function extractAll(xml, tag) {
    const results = [];
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
    let m;
    while ((m = re.exec(xml)) !== null)
        results.push(m[1].trim());
    return results;
}
function extractOne(xml, tag) {
    const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
    return m ? m[1].trim() : '';
}
function parseAmount(val) {
    const n = parseFloat(val.replace(/,/g, ''));
    return isNaN(n) ? 0 : n;
}
function parseFinancialSummary() {
    const status = syncStatus;
    const summary = {
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
    if (!fs_1.default.existsSync(QB_DATA_FILE))
        return summary;
    let raw = {};
    try {
        raw = JSON.parse(fs_1.default.readFileSync(QB_DATA_FILE, 'utf-8'));
    }
    catch {
        return summary;
    }
    for (const entry of Object.values(raw)) {
        const xml = entry.xml || '';
        // ── Accounts (request 0: income + expense) ──────────────────────────
        if (entry.request_index === 0) {
            const accountRets = extractAll(xml, 'AccountRet');
            for (const acct of accountRets) {
                const name = extractOne(acct, 'FullName') || extractOne(acct, 'Name');
                const type = extractOne(acct, 'AccountType');
                const balance = parseAmount(extractOne(acct, 'Balance') || extractOne(acct, 'TotalBalance'));
                if (!name)
                    continue;
                summary.accounts.push({ name, type, balance });
                if (type === 'Income' || type === 'OtherIncome')
                    summary.total_income += balance;
                if (type === 'Expense' || type === 'OtherExpense' || type === 'CostOfGoodsSold')
                    summary.total_expense += balance;
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
                    if (!isPaid)
                        summary.outstanding_invoices += total;
                }
            }
        }
    }
    summary.transaction_count = summary.sales_receipts_30d.length + summary.invoices_30d.length;
    return summary;
}
exports.parseFinancialSummary = parseFinancialSummary;
//# sourceMappingURL=qb-data-store.js.map