/**
 * PDFTextExtractor — TypeScript port. Uses pdf-parse if installed.
 */

import fs from 'fs';

export interface PdfResult {
  success: boolean;
  file_type?: string;
  text?: string;
  pages?: number;
  info?: Record<string, unknown>;
  status?: string;
  error?: string;
  recommendation?: string;
}

export async function extractPDFText(filePath: string): Promise<PdfResult> {
  if (!fs.existsSync(filePath)) return { success: false, error: `File not found: ${filePath}` };

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  let pdfParse: ((buf: Buffer) => Promise<{ text: string; numpages: number; info: Record<string, unknown> }>) | null;
  try { pdfParse = require('pdf-parse'); }
  catch {
    return {
      success: false, status: 'PARSER_NOT_AVAILABLE',
      error: 'pdf-parse not installed. Run: npm install pdf-parse',
      recommendation: 'Convert PDF to CSV/Excel first, or share the file with Mi for manual review.',
    };
  }

  try {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse!(buffer);
    return { success: true, file_type: 'pdf', text: data.text, pages: data.numpages, info: data.info };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}
