/**
 * PDFTextExtractor — extracts text from PDF files.
 * Uses pdf-parse if available, else returns PARSER_NOT_AVAILABLE.
 */

import { createRequire } from 'module';
import fs from 'fs';

const require = createRequire(import.meta.url);

export async function extractPDFText(filePath) {
  if (!fs.existsSync(filePath)) {
    return { success: false, error: `File not found: ${filePath}` };
  }

  // Try pdf-parse
  let pdfParse;
  try {
    pdfParse = require('pdf-parse');
  } catch {
    return {
      success: false,
      status: 'PARSER_NOT_AVAILABLE',
      error: 'pdf-parse not installed. Run: npm install pdf-parse',
      recommendation: 'Convert PDF to CSV/Excel first, or share the file with Mi for manual review.',
    };
  }

  try {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return {
      success: true,
      file_type: 'pdf',
      text: data.text,
      pages: data.numpages,
      info: data.info,
    };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}
