/**
 * FileIngestionService — TypeScript port of FileDataIngestionService.mjs
 */

import fs from 'fs';
import path from 'path';
import { readCSVFile } from './csv-reader';
import { readExcelFile } from './excel-reader';
import { extractPDFText } from './pdf-extractor';
import { extractWordText } from './word-extractor';
import { mapColumns } from './column-mapper';
import { checkDataQuality } from './data-quality-checker';
import { addDataset } from './dataset-catalog';

const BLOCKED_FILENAMES = [
  '.env', '.env.local', '.env.production', 'private_key', 'id_rsa', 'id_rsa.pub',
  'credentials.json', 'google-tokens.json', 'service-account.json',
  'secret', 'secrets', 'password', 'passwords',
];

const BLOCKED_EXTENSIONS = ['.pem', '.key', '.p12', '.pfx', '.jks'];

export interface IngestionResult {
  success: boolean;
  dataset_id?: string;
  file?: string;
  file_type?: string;
  row_count?: number;
  headers?: string[];
  mapping?: Record<string, string>;
  quality?: { quality_score: number; total_rows: number; issues: unknown[] };
  blocked?: boolean;
  reason?: string;
  text_preview?: string;
  error?: string;
}

function isBlocked(filePath: string): { blocked: boolean; reason?: string } {
  const name = path.basename(filePath).toLowerCase();
  const ext = path.extname(filePath).toLowerCase();
  if (BLOCKED_FILENAMES.includes(name) || BLOCKED_FILENAMES.some(b => name.includes(b))) {
    return { blocked: true, reason: `Sensitive filename blocked: ${name}` };
  }
  if (BLOCKED_EXTENSIONS.includes(ext)) {
    return { blocked: true, reason: `Sensitive file extension blocked: ${ext}` };
  }
  return { blocked: false };
}

export async function ingestFile(filePath: string): Promise<IngestionResult> {
  if (!fs.existsSync(filePath)) return { success: false, error: `File not found: ${filePath}` };

  const check = isBlocked(filePath);
  if (check.blocked) return { success: false, blocked: true, reason: check.reason };

  const ext = path.extname(filePath).toLowerCase();
  const name = path.basename(filePath);

  try {
    if (ext === '.csv') {
      const result = readCSVFile(filePath);
      if (!result.success || !result.rows || !result.headers) return { success: false, error: result.error };
      const mapResult = mapColumns(result.headers);
      const quality = checkDataQuality(result.rows, mapResult.mapping);
      const entry = addDataset({
        name, file_path: filePath, file_type: 'csv',
        row_count: result.row_count || 0, headers: result.headers,
        mapping: mapResult.mapping, quality_score: quality.quality_score,
      });
      return { success: true, dataset_id: entry.id, file: name, file_type: 'csv', row_count: result.row_count, headers: result.headers, mapping: mapResult.mapping, quality };
    }

    if (ext === '.xlsx' || ext === '.xls') {
      const result = readExcelFile(filePath);
      if (!result.success || !result.rows || !result.headers) return { success: false, error: result.error };
      const mapResult = mapColumns(result.headers);
      const quality = checkDataQuality(result.rows, mapResult.mapping);
      const entry = addDataset({
        name, file_path: filePath, file_type: 'xlsx',
        row_count: result.row_count || 0, headers: result.headers,
        mapping: mapResult.mapping, quality_score: quality.quality_score,
      });
      return { success: true, dataset_id: entry.id, file: name, file_type: 'xlsx', row_count: result.row_count, headers: result.headers, mapping: mapResult.mapping, quality };
    }

    if (ext === '.pdf') {
      const result = await extractPDFText(filePath);
      if (!result.success) return { success: false, error: result.error, reason: result.status };
      return { success: true, file: name, file_type: 'pdf', text_preview: result.text?.slice(0, 500) };
    }

    if (ext === '.docx' || ext === '.doc') {
      const result = await extractWordText(filePath);
      if (!result.success) return { success: false, error: result.error };
      return { success: true, file: name, file_type: 'docx', text_preview: result.text?.slice(0, 500) };
    }

    if (ext === '.json') {
      const text = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(text);
      const rows = Array.isArray(data) ? data : (data.data || data.rows || data.records || []);
      if (rows.length > 0 && typeof rows[0] === 'object') {
        const headers = Object.keys(rows[0]);
        const strRows = rows.map((r: Record<string, unknown>) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v ?? '')])));
        const mapResult = mapColumns(headers);
        const quality = checkDataQuality(strRows, mapResult.mapping);
        const entry = addDataset({
          name, file_path: filePath, file_type: 'json',
          row_count: rows.length, headers,
          mapping: mapResult.mapping, quality_score: quality.quality_score,
        });
        return { success: true, dataset_id: entry.id, file: name, file_type: 'json', row_count: rows.length, headers, mapping: mapResult.mapping, quality };
      }
      return { success: true, file: name, file_type: 'json', text_preview: text.slice(0, 500) };
    }

    return { success: false, error: `Unsupported file type: ${ext}. Supported: .csv, .xlsx, .xls, .json, .pdf, .docx` };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export async function ingestFiles(filePaths: string[]): Promise<IngestionResult[]> {
  const results: IngestionResult[] = [];
  for (const fp of filePaths) results.push(await ingestFile(fp));
  return results;
}

export function getFileRows(filePath: string): Record<string, string>[] {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.csv') {
    const result = readCSVFile(filePath);
    return result.rows || [];
  }
  if (ext === '.xlsx' || ext === '.xls') {
    const result = readExcelFile(filePath);
    return result.rows || [];
  }
  if (ext === '.json') {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const arr = Array.isArray(data) ? data : (data.data || data.rows || []);
      return arr.map((r: Record<string, unknown>) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v ?? '')])));
    } catch { return []; }
  }
  return [];
}
