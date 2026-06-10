/**
 * ExcelReader — TypeScript port. Uses xlsx package (already installed).
 */

import fs from 'fs';
import path from 'path';

export interface ExcelResult {
  success: boolean;
  file?: string;
  file_path?: string;
  file_type?: string;
  sheet_name?: string;
  sheet_names?: string[];
  headers?: string[];
  rows?: Record<string, string>[];
  row_count?: number;
  status?: string;
  error?: string;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
function loadXLSX(): typeof import('xlsx') | null {
  try { return require('xlsx'); }
  catch { return null; }
}

export function readExcelFile(filePath: string, options: { sheetName?: string } = {}): ExcelResult {
  if (!fs.existsSync(filePath)) return { success: false, error: `File not found: ${filePath}` };

  const XLSX = loadXLSX();
  if (!XLSX) return { success: false, status: 'PARSER_NOT_AVAILABLE', error: 'xlsx not installed. Run: npm install xlsx' };

  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = options.sheetName || workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return { success: false, error: `Sheet "${sheetName}" not found. Available: ${workbook.SheetNames.join(', ')}` };

    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];
    if (rawRows.length === 0) return { success: true, headers: [], rows: [], row_count: 0, file: path.basename(filePath), file_type: 'xlsx' };

    const headers = (rawRows[0] as unknown[]).map(h => String(h).trim());
    const dataRows = rawRows.slice(1);

    const rows = dataRows.map(rawRow => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        let val: unknown = (rawRow as unknown[])[i];
        if (typeof val === 'number' && h.toLowerCase().includes('date')) {
          try {
            const d = (XLSX.SSF as unknown as { parse_date_code: (n: number) => { y: number; m: number; d: number } }).parse_date_code(val);
            val = `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
          } catch { /**/ }
        }
        obj[h] = (val !== undefined && val !== null) ? String(val).trim() : '';
      });
      return obj;
    }).filter(r => Object.values(r).some(v => v !== ''));

    return { success: true, file: path.basename(filePath), file_path: filePath, file_type: 'xlsx', sheet_name: sheetName, sheet_names: workbook.SheetNames, headers, rows, row_count: rows.length };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export function getSheetNames(filePath: string): string[] {
  const XLSX = loadXLSX();
  if (!XLSX) return [];
  try { return (XLSX.readFile(filePath)).SheetNames; }
  catch { return []; }
}
