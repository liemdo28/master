/**
 * FileDataIngestionService — main orchestrator for ingesting data files.
 * Supports: CSV, XLSX/XLS, JSON, TXT, DOCX (with mammoth), PDF (with pdf-parse).
 */

import fs from 'fs';
import path from 'path';
import { readCSVFile } from './CSVReader.mjs';
import { readExcelFile } from './ExcelReader.mjs';
import { extractPDFText } from './PDFTextExtractor.mjs';
import { extractWordText } from './WordTextExtractor.mjs';
import { mapColumns } from './ColumnMapper.mjs';
import { checkDataQuality } from './DataQualityChecker.mjs';
import { addDataset } from './DatasetCatalog.mjs';

const SENSITIVE_PATTERNS = [
  /\.env$/i, /private[_-]?key/i, /id_rsa/i, /credentials\.json$/i,
  /google-tokens/i, /\.pem$/i, /secret/i,
];

function isFileSensitive(filePath) {
  const name = path.basename(filePath).toLowerCase();
  return SENSITIVE_PATTERNS.some(p => p.test(name));
}

/**
 * Ingest a local file and return normalized dataset.
 * Returns: { success, dataset_id, rows, headers, mapping, quality, file_info } or { success: false, error }
 */
export async function ingestFile(filePath, options = {}) {
  if (!fs.existsSync(filePath)) {
    return { success: false, error: `File not found: ${filePath}` };
  }

  if (isFileSensitive(filePath)) {
    return { success: false, error: `Security: "${path.basename(filePath)}" là file nhạy cảm, không thể phân tích.` };
  }

  const ext = path.extname(filePath).toLowerCase().slice(1);
  const stats = fs.statSync(filePath);

  let parseResult;

  switch (ext) {
    case 'csv':
    case 'txt':
      parseResult = readCSVFile(filePath);
      break;

    case 'xlsx':
    case 'xls':
      parseResult = readExcelFile(filePath, options);
      break;

    case 'json':
      parseResult = readJSONFile(filePath);
      break;

    case 'pdf':
      const pdfResult = await extractPDFText(filePath);
      if (!pdfResult.success) return pdfResult;
      // Try to parse structured data from PDF text
      parseResult = await parseTextAsCSV(pdfResult.text);
      parseResult.file = path.basename(filePath);
      parseResult.file_type = 'pdf';
      break;

    case 'docx':
    case 'doc':
      const wordResult = await extractWordText(filePath);
      if (!wordResult.success) return wordResult;
      parseResult = await parseTextAsCSV(wordResult.text);
      parseResult.file = path.basename(filePath);
      parseResult.file_type = 'docx';
      break;

    default:
      return { success: false, status: 'PARSER_NOT_AVAILABLE', error: `File type ".${ext}" not supported. Supported: csv, xlsx, xls, json, txt, pdf, docx` };
  }

  if (!parseResult.success) return parseResult;
  if (!parseResult.rows || parseResult.rows.length === 0) {
    return { success: false, error: 'File parsed but contains no data rows' };
  }

  // Map columns
  const columnMap = mapColumns(parseResult.headers);

  // Quality check
  const quality = checkDataQuality(parseResult.rows, columnMap.mapping);

  // Auto-detect store and period
  const store = options.store || detectStore(filePath) || '';
  const period = options.period || detectPeriod(filePath, parseResult.rows, columnMap.mapping) || '';

  // Register in catalog
  const entry = addDataset({
    source_type: 'local_file',
    source_path: filePath,
    file_name: path.basename(filePath),
    file_type: parseResult.file_type || ext,
    modified_at: stats.mtime.toISOString(),
    row_count: parseResult.rows.length,
    column_count: parseResult.headers.length,
    detected_columns: columnMap.detected_fields,
    confidence: columnMap.confidence,
    mapping: columnMap.mapping,
    quality_score: quality.quality_score,
    store,
    period,
    tags: buildTags(filePath, store, period),
  });

  return {
    success: true,
    dataset_id: entry.dataset_id,
    file: path.basename(filePath),
    file_type: parseResult.file_type || ext,
    row_count: parseResult.rows.length,
    headers: parseResult.headers,
    rows: parseResult.rows,
    mapping: columnMap.mapping,
    confidence: columnMap.confidence,
    unmapped: columnMap.unmapped,
    quality,
    store,
    period,
  };
}

/**
 * Ingest multiple files and return combined dataset
 */
export async function ingestFiles(filePaths, options = {}) {
  const results = await Promise.all(filePaths.map(f => ingestFile(f, options)));
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  if (successful.length === 0) {
    return { success: false, error: 'No files ingested successfully', failed };
  }

  // Combine rows if headers match
  const allRows = successful.flatMap(r => r.rows);
  const headers = successful[0].headers;

  return {
    success: true,
    file_count: successful.length,
    failed_count: failed.length,
    row_count: allRows.length,
    headers,
    rows: allRows,
    mapping: successful[0].mapping,
    confidence: Math.min(...successful.map(r => r.confidence)),
    datasets: successful.map(r => r.dataset_id),
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function readJSONFile(filePath) {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    // Handle array of objects
    if (Array.isArray(data)) {
      if (data.length === 0) return { success: true, headers: [], rows: [], row_count: 0, file_type: 'json' };
      const headers = Object.keys(data[0]);
      return { success: true, headers, rows: data, row_count: data.length, file_type: 'json', file: path.basename(filePath) };
    }
    // Handle { data: [...] } pattern
    if (data.data && Array.isArray(data.data)) {
      const headers = data.data.length > 0 ? Object.keys(data.data[0]) : [];
      return { success: true, headers, rows: data.data, row_count: data.data.length, file_type: 'json', file: path.basename(filePath) };
    }
    return { success: false, error: 'JSON file does not contain an array of records' };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

async function parseTextAsCSV(text) {
  // Try to find CSV-like lines in unstructured text
  const lines = text.split('\n').filter(l => l.includes(',') || l.includes('\t'));
  if (lines.length < 2) {
    return { success: false, error: 'Could not find structured data in text file' };
  }
  // Return raw lines as single-column dataset
  const rows = lines.slice(1).map((l, i) => ({ row: i + 1, content: l.trim() }));
  return { success: true, headers: ['content'], rows, row_count: rows.length };
}

function detectStore(filePath) {
  const name = filePath.toLowerCase();
  if (name.includes('raw') || name.includes('sushi')) return 'raw-sushi';
  if (name.includes('bakudan') || name.includes('ramen')) return 'bakudan';
  return '';
}

function detectPeriod(filePath, rows, mapping) {
  const name = path.basename(filePath).toLowerCase();

  // From filename
  const dateMatch = name.match(/(\d{4}[-_]?\d{2}[-_]?\d{2}|\w+\d{4}|week\d+|month\d+)/);
  if (dateMatch) return dateMatch[1];

  // From data
  if (mapping['date'] && rows.length > 0) {
    const dates = rows.map(r => r[mapping['date']]).filter(Boolean).sort();
    if (dates.length > 0) {
      return `${dates[0]} to ${dates[dates.length - 1]}`;
    }
  }

  return '';
}

function buildTags(filePath, store, period) {
  const tags = [];
  const name = path.basename(filePath).toLowerCase();

  if (store) tags.push(store);
  if (period) tags.push(period);
  if (name.includes('sales') || name.includes('revenue') || name.includes('doanh')) tags.push('sales');
  if (name.includes('payroll') || name.includes('employee')) tags.push('payroll');
  if (name.includes('inventory')) tags.push('inventory');
  if (name.includes('week')) tags.push('weekly');
  if (name.includes('month')) tags.push('monthly');
  if (name.includes('daily') || name.includes('day')) tags.push('daily');

  return [...new Set(tags)];
}
