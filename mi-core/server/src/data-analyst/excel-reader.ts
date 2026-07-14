/**
 * ExcelReader — disabled until a maintained XLS/XLSX parser is selected.
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

export function readExcelFile(filePath: string, options: { sheetName?: string } = {}): ExcelResult {
  if (!fs.existsSync(filePath)) return { success: false, error: `File not found: ${filePath}` };
  void options;
  return {
    success: false,
    file: path.basename(filePath),
    file_path: filePath,
    file_type: 'xlsx',
    status: 'PARSER_DISABLED_SECURITY',
    error: 'Excel parsing is disabled because the previous xlsx dependency has unresolved high-severity advisories. Use CSV, JSON, PDF, or DOCX until a safe parser replacement is approved.',
  };
}

export function getSheetNames(filePath: string): string[] {
  void filePath;
  return [];
}
