/**
 * Excel Worker — Excel generation/reading disabled until a safe parser/writer
 * replacement is selected.
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
  void params;
  ensureDir();
  throw new Error('Excel generation is disabled because the previous xlsx dependency has unresolved high-severity advisories. Generate CSV instead until a safe writer replacement is approved.');
}

export async function readExcelSummary(filePath: string): Promise<{ sheets: string[]; preview: string }> {
  void filePath;
  return {
    sheets: [],
    preview: 'Excel reading is disabled because the previous xlsx dependency has unresolved high-severity advisories. Export to CSV for preview.',
  };
}
