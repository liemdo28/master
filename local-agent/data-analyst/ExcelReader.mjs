/**
 * ExcelReader — reads XLSX/XLS files using the 'xlsx' npm package.
 * Returns PARSER_NOT_AVAILABLE if xlsx not installed.
 */

import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);

function loadXLSX() {
  try {
    return require('xlsx');
  } catch {
    return null;
  }
}

export function readExcelFile(filePath, options = {}) {
  if (!fs.existsSync(filePath)) {
    return { success: false, error: `File not found: ${filePath}` };
  }

  const XLSX = loadXLSX();
  if (!XLSX) {
    return {
      success: false,
      status: 'PARSER_NOT_AVAILABLE',
      error: 'xlsx package not installed. Run: npm install xlsx',
    };
  }

  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = options.sheetName || workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) {
      return { success: false, error: `Sheet "${sheetName}" not found. Available: ${workbook.SheetNames.join(', ')}` };
    }

    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (rawRows.length === 0) {
      return { success: true, headers: [], rows: [], row_count: 0, file: path.basename(filePath), file_type: 'xlsx' };
    }

    const headers = (rawRows[0] || []).map(h => String(h).trim());
    const dataRows = rawRows.slice(1);

    const rows = dataRows.map(rawRow => {
      const obj = {};
      headers.forEach((h, i) => {
        let val = rawRow[i];
        // Convert Excel date serial numbers
        if (typeof val === 'number' && h.toLowerCase().includes('date')) {
          try {
            const d = XLSX.SSF.parse_date_code(val);
            val = `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
          } catch {}
        }
        obj[h] = val !== undefined && val !== null ? String(val).trim() : '';
      });
      return obj;
    }).filter(r => Object.values(r).some(v => v !== ''));

    return {
      success: true,
      file: path.basename(filePath),
      file_path: filePath,
      file_type: 'xlsx',
      sheet_name: sheetName,
      sheet_names: workbook.SheetNames,
      headers,
      rows,
      row_count: rows.length,
    };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export function getSheetNames(filePath) {
  const XLSX = loadXLSX();
  if (!XLSX) return [];
  try {
    const wb = XLSX.readFile(filePath);
    return wb.SheetNames;
  } catch {
    return [];
  }
}
