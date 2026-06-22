/**
 * CSVReader — TypeScript port of CSVReader.mjs
 */

import fs from 'fs';
import path from 'path';

export interface ParseResult {
  success: boolean;
  file?: string;
  file_path?: string;
  file_type?: string;
  headers?: string[];
  rows?: Record<string, string>[];
  row_count?: number;
  errors?: Array<{ row: number; message: string }>;
  delimiter?: string;
  error?: string;
}

export function parseCSVText(text: string, options: { delimiter?: string; hasHeader?: boolean } = {}): ParseResult {
  const { delimiter = null, hasHeader = true } = options;
  const delim = delimiter || detectDelimiter(text);
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const nonEmpty = lines.filter(l => l.trim().length > 0);
  if (nonEmpty.length === 0) return { success: true, headers: [], rows: [], row_count: 0, errors: [] };

  const errors: Array<{ row: number; message: string }> = [];
  const rawRows = nonEmpty.map(line => splitCSVLine(line, delim));
  const maxCols = Math.max(...rawRows.map(r => r.length));

  let headers: string[];
  let dataRows: string[][];

  if (hasHeader && rawRows.length > 0) {
    headers = rawRows[0].map(h => h.trim());
    dataRows = rawRows.slice(1);
  } else {
    headers = Array.from({ length: maxCols }, (_, i) => `col_${i + 1}`);
    dataRows = rawRows;
  }

  const rows = dataRows.map((rawRow, idx) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = rawRow[i]?.trim() ?? ''; });
    if (rawRow.length !== headers.length) {
      errors.push({ row: idx + 2, message: `Column count mismatch: expected ${headers.length}, got ${rawRow.length}` });
    }
    return obj;
  });

  return { success: true, headers, rows, row_count: rows.length, errors, delimiter: delim };
}

export function readCSVFile(filePath: string): ParseResult {
  if (!fs.existsSync(filePath)) return { success: false, error: `File not found: ${filePath}` };
  try {
    const text = fs.readFileSync(filePath, 'utf-8');
    const result = parseCSVText(text);
    return { ...result, file: path.basename(filePath), file_path: filePath, file_type: 'csv' };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

function detectDelimiter(text: string): string {
  const sample = text.slice(0, 2000);
  const counts: Record<string, number> = {
    ',':  (sample.match(/,/g)  || []).length,
    '\t': (sample.match(/\t/g) || []).length,
    ';':  (sample.match(/;/g)  || []).length,
    '|':  (sample.match(/\|/g) || []).length,
  };
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function splitCSVLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === delimiter && !inQuotes) {
      fields.push(current); current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}
