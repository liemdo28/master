/**
 * GoogleSheetReader — reads Google Sheets via Sheets API or public CSV export.
 * Requires Google OAuth tokens (from visibility connector).
 */

import fs from 'fs';
import path from 'path';
import { parseCSVText } from './CSVReader.mjs';

const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const TOKEN_PATH = path.join(GLOBAL_DIR, 'visibility', 'google-tokens.json');

function hasTokens() {
  return fs.existsSync(TOKEN_PATH);
}

/**
 * Export a Google Sheet to CSV and parse it.
 * Public sheets: use CSV export URL directly.
 * Private sheets: requires googleapis (server-side).
 */
export async function readGoogleSheet(sheetIdOrUrl, options = {}) {
  if (!hasTokens()) {
    return {
      success: false,
      status: 'CONNECTOR_NOT_CONFIGURED',
      message: 'Google không được kết nối. Truy cập /api/auth/google/start để kết nối.',
      setup: 'http://localhost:4001/api/auth/google/start',
    };
  }

  // Extract sheet ID from URL if needed
  const sheetId = extractSheetId(sheetIdOrUrl);
  if (!sheetId) {
    return { success: false, error: 'Invalid Google Sheet ID or URL' };
  }

  // Try CSV export URL (works for sheets with view access)
  const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;

  try {
    const res = await fetch(exportUrl, {
      headers: { 'User-Agent': 'Mi-Core-DataAnalyst/1.0' },
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      return { success: false, error: `Google Sheets export failed: HTTP ${res.status}. Sheet may be private.` };
    }

    const csvText = await res.text();
    const parsed = parseCSVText(csvText);

    return {
      success: true,
      source: 'google_sheet',
      sheet_id: sheetId,
      file_type: 'gsheet',
      ...parsed,
    };
  } catch (e) {
    return { success: false, error: `Failed to read Google Sheet: ${e.message}` };
  }
}

function extractSheetId(input) {
  if (!input) return null;
  // Full URL: https://docs.google.com/spreadsheets/d/ID/edit
  const urlMatch = input.match(/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (urlMatch) return urlMatch[1];
  // Just ID
  if (/^[a-zA-Z0-9_-]{20,}$/.test(input)) return input;
  return null;
}
