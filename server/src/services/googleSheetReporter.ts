/**
 * googleSheetReporter.ts
 * ========================
 * Google Sheets writer for Mi-core QB Agent reporting.
 *
 * Manages a single Google Sheet with the following tabs:
 *   - Dashboard        (summary per machine)
 *   - Machines         (all registered QB agent machines)
 *   - QB Files         (all QB company files per machine)
 *   - 12H Sync Cycles  (each 12h cycle record)
 *   - Daily Activity Log
 *   - Activity Timeline
 *   - Errors & Warnings
 *   - Remote Commands
 *   - Store Summary
 *
 * Auth: Uses OAuth2 refresh token or Service Account JSON.
 * Config via env vars:
 *   GOOGLE_SHEET_ID            — the spreadsheet ID
 *   GOOGLE_SERVICE_ACCOUNT_JSON — base64-encoded service account JSON (preferred)
 *   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN — OAuth2 fallback
 */

import { google, sheets_v4 } from 'googleapis';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SheetWriteResult {
  ok: boolean;
  tab: string;
  rows_written?: number;
  error?: string;
}

// ── Tab definitions ──────────────────────────────────────────────────────────

export const SHEET_TABS = {
  DASHBOARD:         'Dashboard',
  MACHINES:          'Machines',
  QB_FILES:          'QB Files',
  SYNC_CYCLES:       '12H Sync Cycles',
  ACTIVITY_LOG:      'Daily Activity Log',
  TIMELINE:          'Activity Timeline',
  ERRORS:            'Errors & Warnings',
  REMOTE_COMMANDS:   'Remote Commands',
  STORE_SUMMARY:     'Store Summary',
} as const;

export const TAB_HEADERS: Record<string, string[]> = {
  [SHEET_TABS.DASHBOARD]: [
    'Machine ID', 'Machine Name', 'Store Code', 'Status', 'QB Open',
    'QB Company', 'Last Heartbeat', 'App Version', 'Updated At',
  ],
  [SHEET_TABS.MACHINES]: [
    'Machine ID', 'Machine Name', 'Store Code', 'Store Name', 'Location',
    'App Version', 'OS Version', 'Hostname', 'Status',
    'Registered At', 'Last Heartbeat', 'Last Seen At',
  ],
  [SHEET_TABS.QB_FILES]: [
    'Machine ID', 'Laptop Name', 'QB File ID', 'Store Code',
    'Company File Path', 'Expected Company', 'Enabled',
    'Last Status', 'Last Synced At', 'Next Sync At', 'Last Error',
  ],
  [SHEET_TABS.SYNC_CYCLES]: [
    'Cycle ID', 'Machine ID', 'Started At', 'Finished At',
    'Total Files', 'Pass Count', 'Warning Count', 'Error Count', 'Next Cycle At',
  ],
  [SHEET_TABS.ACTIVITY_LOG]: [
    'Machine ID', 'Store Code', 'File ID', 'Business Date',
    'Total Transactions', 'Total Amount',
    'Latest Sales Receipt Date', 'Latest Bank Txn Date', 'Latest Reconcile Date',
    'Duration MS', 'Generated At', 'Received At',
  ],
  [SHEET_TABS.TIMELINE]: [
    'Machine ID', 'Store Code', 'File ID', 'Business Date',
    'Event Count', 'Generated At', 'Received At',
  ],
  [SHEET_TABS.ERRORS]: [
    'Machine ID', 'Store Code', 'Severity', 'Component',
    'Message', 'Exception', 'Occurred At', 'Received At',
  ],
  [SHEET_TABS.REMOTE_COMMANDS]: [
    'Command ID', 'Machine ID', 'Command Type', 'Status',
    'Created At', 'Acked At', 'Completed At', 'Error',
  ],
  [SHEET_TABS.STORE_SUMMARY]: [
    'Date', 'Machine ID', 'Store Code', 'QB File ID',
    'Sync Status', 'Latest Sales Receipt', 'Latest Bank Transaction',
    'Latest Reconcile', 'Total Transactions', 'Total Amount',
  ],
};

// ── Auth ─────────────────────────────────────────────────────────────────────

function getAuthClient() {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    const sa = JSON.parse(
      serviceAccountJson.startsWith('{')
        ? serviceAccountJson
        : Buffer.from(serviceAccountJson, 'base64').toString('utf8')
    );
    return new google.auth.GoogleAuth({
      credentials: sa,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
  }

  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (clientId && clientSecret && refreshToken) {
    const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
    oauth2.setCredentials({ refresh_token: refreshToken });
    return oauth2;
  }

  return null;
}

async function getSheetsClient(): Promise<sheets_v4.Sheets | null> {
  const auth = getAuthClient();
  if (!auth) return null;
  return google.sheets({ version: 'v4', auth: auth as any });
}

// ── Sheet bootstrap ───────────────────────────────────────────────────────────

const _ensuredTabs = new Set<string>();

async function ensureTab(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  tabName: string
): Promise<void> {
  if (_ensuredTabs.has(tabName)) return;

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = (meta.data.sheets || []).map(s => s.properties?.title);

  if (!existing.includes(tabName)) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          addSheet: { properties: { title: tabName } },
        }],
      },
    });
    // Write header row
    const headers = TAB_HEADERS[tabName];
    if (headers) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${tabName}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [headers] },
      });
    }
  }
  _ensuredTabs.add(tabName);
}

// ── Append row helper ─────────────────────────────────────────────────────────

async function appendRows(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  tabName: string,
  rows: (string | number | boolean | null)[][]
): Promise<void> {
  await ensureTab(sheets, spreadsheetId, tabName);
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${tabName}!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rows },
  });
}

// ── Upsert by key (find row with matching key col, update, else append) ───────

async function upsertRow(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  tabName: string,
  keyColIndex: number,
  keyValue: string,
  row: (string | number | boolean | null)[]
): Promise<void> {
  await ensureTab(sheets, spreadsheetId, tabName);

  const get = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!A:A`,
  });

  const values = get.data.values || [];
  let matchRow = -1;
  for (let i = 1; i < values.length; i++) {
    if (values[i]?.[keyColIndex] === keyValue) {
      matchRow = i + 1; // 1-indexed
      break;
    }
  }

  if (matchRow > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tabName}!A${matchRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] },
    });
  } else {
    await appendRows(sheets, spreadsheetId, tabName, [row]);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || '';

export async function isConfigured(): Promise<boolean> {
  return !!SPREADSHEET_ID && !!getAuthClient();
}

export async function writeMachineHeartbeat(data: {
  machine_id: string;
  machine_name?: string;
  store_code?: string;
  status?: string;
  qb_open?: boolean;
  qb_company?: string;
  app_version?: string;
  last_heartbeat?: string;
}): Promise<SheetWriteResult> {
  if (!SPREADSHEET_ID) return { ok: false, tab: SHEET_TABS.DASHBOARD, error: 'GOOGLE_SHEET_ID not set' };
  try {
    const sheets = await getSheetsClient();
    if (!sheets) return { ok: false, tab: SHEET_TABS.DASHBOARD, error: 'Google auth not configured' };

    const now = new Date().toISOString();
    const row = [
      data.machine_id, data.machine_name || '', data.store_code || '',
      data.status || 'online', data.qb_open ? 'YES' : 'NO',
      data.qb_company || '', data.last_heartbeat || now,
      data.app_version || '', now,
    ];

    await upsertRow(sheets, SPREADSHEET_ID, SHEET_TABS.DASHBOARD, 0, data.machine_id, row);
    return { ok: true, tab: SHEET_TABS.DASHBOARD, rows_written: 1 };
  } catch (e: any) {
    return { ok: false, tab: SHEET_TABS.DASHBOARD, error: String(e?.message || e) };
  }
}

export async function writeMachineRegistration(data: Record<string, any>): Promise<SheetWriteResult> {
  if (!SPREADSHEET_ID) return { ok: false, tab: SHEET_TABS.MACHINES, error: 'GOOGLE_SHEET_ID not set' };
  try {
    const sheets = await getSheetsClient();
    if (!sheets) return { ok: false, tab: SHEET_TABS.MACHINES, error: 'Google auth not configured' };

    const row = [
      data.machine_id, data.machine_name || '', data.store_code || '',
      data.store_name || '', data.location || '',
      data.app_version || '', data.os_version || '', data.hostname || '',
      'online', data.registered_at || '', data.last_heartbeat || '', data.last_seen_at || '',
    ];

    await upsertRow(sheets, SPREADSHEET_ID, SHEET_TABS.MACHINES, 0, data.machine_id, row);
    return { ok: true, tab: SHEET_TABS.MACHINES, rows_written: 1 };
  } catch (e: any) {
    return { ok: false, tab: SHEET_TABS.MACHINES, error: String(e?.message || e) };
  }
}

export async function writeQbFile(machineId: string, laptopName: string, file: Record<string, any>): Promise<SheetWriteResult> {
  if (!SPREADSHEET_ID) return { ok: false, tab: SHEET_TABS.QB_FILES, error: 'GOOGLE_SHEET_ID not set' };
  try {
    const sheets = await getSheetsClient();
    if (!sheets) return { ok: false, tab: SHEET_TABS.QB_FILES, error: 'Google auth not configured' };

    const key = `${machineId}|${file.file_id}`;
    const row = [
      machineId, laptopName, file.file_id || '', file.store_code || '',
      file.company_file_path || '', file.expected_company_name || '',
      file.enabled ? 'YES' : 'NO',
      file.last_status || '', file.last_synced_at || '',
      file.next_sync_at || '', file.last_error || '',
    ];

    // Use a composite key search (col A = machine_id, col C = file_id)
    await appendRows(sheets, SPREADSHEET_ID, SHEET_TABS.QB_FILES, [row]);
    return { ok: true, tab: SHEET_TABS.QB_FILES, rows_written: 1 };
  } catch (e: any) {
    return { ok: false, tab: SHEET_TABS.QB_FILES, error: String(e?.message || e) };
  }
}

export async function writeSyncCycle(data: Record<string, any>): Promise<SheetWriteResult> {
  if (!SPREADSHEET_ID) return { ok: false, tab: SHEET_TABS.SYNC_CYCLES, error: 'GOOGLE_SHEET_ID not set' };
  try {
    const sheets = await getSheetsClient();
    if (!sheets) return { ok: false, tab: SHEET_TABS.SYNC_CYCLES, error: 'Google auth not configured' };

    const row = [
      data.cycle_id || '', data.machine_id || '',
      data.started_at || '', data.finished_at || '',
      data.total_files || 0, data.pass_count || 0,
      data.warning_count || 0, data.error_count || 0,
      data.next_cycle_at || '',
    ];

    await appendRows(sheets, SPREADSHEET_ID, SHEET_TABS.SYNC_CYCLES, [row]);
    return { ok: true, tab: SHEET_TABS.SYNC_CYCLES, rows_written: 1 };
  } catch (e: any) {
    return { ok: false, tab: SHEET_TABS.SYNC_CYCLES, error: String(e?.message || e) };
  }
}

export async function writeActivityLog(data: Record<string, any>): Promise<SheetWriteResult> {
  if (!SPREADSHEET_ID) return { ok: false, tab: SHEET_TABS.ACTIVITY_LOG, error: 'GOOGLE_SHEET_ID not set' };
  try {
    const sheets = await getSheetsClient();
    if (!sheets) return { ok: false, tab: SHEET_TABS.ACTIVITY_LOG, error: 'Google auth not configured' };

    const row = [
      data.machine_id || '', data.store_code || '', data.file_id || '',
      data.business_date || '', data.total_transactions || 0, data.total_amount || 0,
      data.latest_sales_receipt_date || '', data.latest_bank_transaction_date || '',
      data.latest_reconcile_date || '', data.duration_ms || 0,
      data.generated_at || '', data.received_at || '',
    ];

    await appendRows(sheets, SPREADSHEET_ID, SHEET_TABS.ACTIVITY_LOG, [row]);

    // Also update Store Summary
    await writeStoreSummaryRow(data);

    return { ok: true, tab: SHEET_TABS.ACTIVITY_LOG, rows_written: 1 };
  } catch (e: any) {
    return { ok: false, tab: SHEET_TABS.ACTIVITY_LOG, error: String(e?.message || e) };
  }
}

export async function writeTimeline(data: Record<string, any>): Promise<SheetWriteResult> {
  if (!SPREADSHEET_ID) return { ok: false, tab: SHEET_TABS.TIMELINE, error: 'GOOGLE_SHEET_ID not set' };
  try {
    const sheets = await getSheetsClient();
    if (!sheets) return { ok: false, tab: SHEET_TABS.TIMELINE, error: 'Google auth not configured' };

    const events = Array.isArray(data.events) ? data.events : [];
    const row = [
      data.machine_id || '', data.store_code || '', data.file_id || '',
      data.business_date || '', events.length,
      data.generated_at || '', data.received_at || '',
    ];

    await appendRows(sheets, SPREADSHEET_ID, SHEET_TABS.TIMELINE, [row]);
    return { ok: true, tab: SHEET_TABS.TIMELINE, rows_written: 1 };
  } catch (e: any) {
    return { ok: false, tab: SHEET_TABS.TIMELINE, error: String(e?.message || e) };
  }
}

export async function writeError(data: Record<string, any>): Promise<SheetWriteResult> {
  if (!SPREADSHEET_ID) return { ok: false, tab: SHEET_TABS.ERRORS, error: 'GOOGLE_SHEET_ID not set' };
  try {
    const sheets = await getSheetsClient();
    if (!sheets) return { ok: false, tab: SHEET_TABS.ERRORS, error: 'Google auth not configured' };

    const row = [
      data.machine_id || '', data.store_code || '',
      data.severity || '', data.component || '',
      data.message || '', data.exception || '',
      data.occurred_at || '', data.received_at || '',
    ];

    await appendRows(sheets, SPREADSHEET_ID, SHEET_TABS.ERRORS, [row]);
    return { ok: true, tab: SHEET_TABS.ERRORS, rows_written: 1 };
  } catch (e: any) {
    return { ok: false, tab: SHEET_TABS.ERRORS, error: String(e?.message || e) };
  }
}

export async function writeRemoteCommand(data: Record<string, any>): Promise<SheetWriteResult> {
  if (!SPREADSHEET_ID) return { ok: false, tab: SHEET_TABS.REMOTE_COMMANDS, error: 'GOOGLE_SHEET_ID not set' };
  try {
    const sheets = await getSheetsClient();
    if (!sheets) return { ok: false, tab: SHEET_TABS.REMOTE_COMMANDS, error: 'Google auth not configured' };

    const row = [
      data.command_id || '', data.machine_id || '',
      data.command_type || '', data.status || '',
      data.created_at || '', data.acked_at || '',
      data.completed_at || '', data.error || '',
    ];

    await appendRows(sheets, SPREADSHEET_ID, SHEET_TABS.REMOTE_COMMANDS, [row]);
    return { ok: true, tab: SHEET_TABS.REMOTE_COMMANDS, rows_written: 1 };
  } catch (e: any) {
    return { ok: false, tab: SHEET_TABS.REMOTE_COMMANDS, error: String(e?.message || e) };
  }
}

async function writeStoreSummaryRow(data: Record<string, any>): Promise<void> {
  try {
    const sheets = await getSheetsClient();
    if (!sheets || !SPREADSHEET_ID) return;

    const row = [
      data.business_date || '', data.machine_id || '', data.store_code || '',
      data.file_id || '', data.status || 'PASS',
      data.latest_sales_receipt_date || '',
      data.latest_bank_transaction_date || '',
      data.latest_reconcile_date || '',
      data.total_transactions || 0, data.total_amount || 0,
    ];

    await appendRows(sheets, SPREADSHEET_ID, SHEET_TABS.STORE_SUMMARY, [row]);
  } catch {
    // non-fatal
  }
}
