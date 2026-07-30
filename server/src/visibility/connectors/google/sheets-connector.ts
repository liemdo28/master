/**
 * Google Sheets Connector — certification-only read/write support.
 * Uses the existing Google OAuth token and writes only to a Mi-owned test sheet.
 */

import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { getAuthedClient, loadTokens } from './google-auth';

const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const CACHE_DIR = path.join(GLOBAL_DIR, 'visibility', 'google-sheets');
const DATA_PATH = path.join(CACHE_DIR, 'data.json');
const LAST_SYNC_PATH = path.join(CACHE_DIR, 'last_sync.json');
const REQUIRED_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

export interface GoogleSheetsCertification {
  synced_at: string;
  status: 'ready' | 'needs_reconsent' | 'error';
  has_required_scope: boolean;
  required_scope: string;
  spreadsheet_id?: string;
  spreadsheet_url?: string;
  read_test: {
    ok: boolean;
    range?: string;
    rows?: number;
    values?: unknown[][];
    error?: string;
  };
  update_test: {
    ok: boolean;
    range?: string;
    updated_cells?: number;
    error?: string;
  };
  reconsent_url?: string;
  error?: string;
}

function ensureDir() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function hasSheetsScope(): boolean {
  const tokens = loadTokens();
  return Boolean(tokens?.scope?.split(/\s+/).includes(REQUIRED_SCOPE));
}

function saveCache(result: GoogleSheetsCertification) {
  ensureDir();
  fs.writeFileSync(DATA_PATH, JSON.stringify(result, null, 2));
  fs.writeFileSync(LAST_SYNC_PATH, JSON.stringify({ last_sync: result.synced_at }, null, 2));
}

function getReconsentUrl(): string {
  return 'http://127.0.0.1:4001/api/auth/google/start';
}

export function getCachedGoogleSheets(): GoogleSheetsCertification | null {
  try {
    return JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

export async function certifyGoogleSheets(): Promise<GoogleSheetsCertification> {
  const syncedAt = new Date().toISOString();
  if (!hasSheetsScope()) {
    const result: GoogleSheetsCertification = {
      synced_at: syncedAt,
      status: 'needs_reconsent',
      has_required_scope: false,
      required_scope: REQUIRED_SCOPE,
      read_test: { ok: false, error: 'Google token does not include Sheets scope.' },
      update_test: { ok: false, error: 'Google token does not include Sheets scope.' },
      reconsent_url: getReconsentUrl(),
    };
    saveCache(result);
    return result;
  }

  try {
    const auth = await getAuthedClient();
    const sheets = google.sheets({ version: 'v4', auth: auth as any });
    const title = `Mi Sheets Certification ${new Date().toISOString().slice(0, 10)}`;
    const create = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title },
        sheets: [{ properties: { title: 'certification' } }],
      },
      fields: 'spreadsheetId,spreadsheetUrl',
    });
    const spreadsheetId = create.data.spreadsheetId || '';
    const spreadsheetUrl = create.data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
    const range = 'certification!A1:D2';
    const values = [
      ['source', 'status', 'synced_at', 'purpose'],
      ['mi-core', 'GOOGLE_SHEETS_READY', syncedAt, 'Dev3 workspace production certification'],
    ];

    const update = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });

    const read = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const result: GoogleSheetsCertification = {
      synced_at: syncedAt,
      status: 'ready',
      has_required_scope: true,
      required_scope: REQUIRED_SCOPE,
      spreadsheet_id: spreadsheetId,
      spreadsheet_url: spreadsheetUrl,
      read_test: {
        ok: true,
        range,
        rows: read.data.values?.length || 0,
        values: read.data.values || [],
      },
      update_test: {
        ok: true,
        range: update.data.updatedRange || range,
        updated_cells: update.data.updatedCells || 0,
      },
    };
    saveCache(result);
    return result;
  } catch (e) {
    const result: GoogleSheetsCertification = {
      synced_at: syncedAt,
      status: 'error',
      has_required_scope: true,
      required_scope: REQUIRED_SCOPE,
      read_test: { ok: false, error: e instanceof Error ? e.message : String(e) },
      update_test: { ok: false, error: e instanceof Error ? e.message : String(e) },
      error: e instanceof Error ? e.message : String(e),
    };
    saveCache(result);
    return result;
  }
}
