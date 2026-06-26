/**
 * Excel Worker — create, read, and export Excel files using xlsx.
 * Output saved to approved workspace output folder.
 */

import path from 'path';
import fs from 'fs';

const OUTPUT_DIR = path.join(
  process.env.GLOBAL_DIR || 'D:/Project/Master/.local-agent-global',
  'action-outputs', 'excel'
);

function ensureDir() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

export interface ExcelCreateParams {
  filename: string;
  sheets: Array<{
    name: string;
    headers: string[];
    rows: (string | number | null)[][];
  }>;
  title?: string;
}

export interface ExcelResult {
  path: string;
  filename: string;
  sheets: number;
  rows_total: number;
}

export async function createExcel(params: ExcelCreateParams): Promise<ExcelResult> {
  ensureDir();
  const xlsx = require('xlsx');
  const wb = xlsx.utils.book_new();
  let totalRows = 0;

  for (const sheet of params.sheets) {
    const data = [sheet.headers, ...sheet.rows];
    const ws = xlsx.utils.aoa_to_sheet(data);

    // Auto column widths
    const colWidths = sheet.headers.map((h, i) => ({
      wch: Math.max(h.length, ...sheet.rows.map(r => String(r[i] ?? '').length), 10),
    }));
    ws['!cols'] = colWidths;

    xlsx.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
    totalRows += sheet.rows.length;
  }

  const safe = params.filename.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
  const filename = safe.endsWith('.xlsx') ? safe : safe + '.xlsx';
  const filePath = path.join(OUTPUT_DIR, filename);
  xlsx.writeFile(wb, filePath);

  return { path: filePath, filename, sheets: params.sheets.length, rows_total: totalRows };
}

export async function readExcelSummary(filePath: string): Promise<{ sheets: string[]; preview: string }> {
  const xlsx = require('xlsx');
  const wb = xlsx.readFile(filePath);
  const preview: string[] = [];
  for (const name of wb.SheetNames.slice(0, 3)) {
    const csv = xlsx.utils.sheet_to_csv(wb.Sheets[name]).slice(0, 500);
    preview.push(`--- ${name} ---\n${csv}`);
  }
  return { sheets: wb.SheetNames, preview: preview.join('\n') };
}
