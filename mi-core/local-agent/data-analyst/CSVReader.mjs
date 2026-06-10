/**
 * CSVReader — pure-JS CSV parser, no dependencies.
 * Handles: comma/tab/semicolon delimiters, quoted fields, UTF-8.
 */

import fs from 'fs';
import path from 'path';

/**
 * Parse CSV text into array of objects.
 * Returns { headers, rows, raw_rows, row_count, errors }
 */
export function parseCSVText(text, options = {}) {
  const { delimiter = null, hasHeader = true } = options;

  // Auto-detect delimiter
  const delim = delimiter || detectDelimiter(text);

  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const nonEmpty = lines.filter(l => l.trim().length > 0);

  if (nonEmpty.length === 0) return { headers: [], rows: [], raw_rows: [], row_count: 0, errors: [] };

  const errors = [];
  const rawRows = nonEmpty.map(line => splitCSVLine(line, delim));
  const maxCols = Math.max(...rawRows.map(r => r.length));

  let headers = [];
  let dataRows = rawRows;

  if (hasHeader && rawRows.length > 0) {
    headers = rawRows[0].map(h => h.trim());
    dataRows = rawRows.slice(1);
  } else {
    headers = Array.from({ length: maxCols }, (_, i) => `col_${i + 1}`);
  }

  const rows = dataRows.map((rawRow, idx) => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = rawRow[i]?.trim() ?? '';
    });
    // Check column count mismatch
    if (rawRow.length !== headers.length) {
      errors.push({ row: idx + 2, message: `Column count mismatch: expected ${headers.length}, got ${rawRow.length}` });
    }
    return obj;
  });

  return { headers, rows, raw_rows: rawRows, row_count: rows.length, errors, delimiter: delim };
}

export function readCSVFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return { success: false, error: `File not found: ${filePath}` };
  }
  try {
    const text = fs.readFileSync(filePath, 'utf-8');
    const result = parseCSVText(text);
    return {
      success: true,
      file: path.basename(filePath),
      file_path: filePath,
      file_type: 'csv',
      ...result,
    };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

function detectDelimiter(text) {
  const sample = text.slice(0, 2000);
  const counts = {
    ',': (sample.match(/,/g) || []).length,
    '\t': (sample.match(/\t/g) || []).length,
    ';': (sample.match(/;/g) || []).length,
    '|': (sample.match(/\|/g) || []).length,
  };
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function splitCSVLine(line, delimiter) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}
