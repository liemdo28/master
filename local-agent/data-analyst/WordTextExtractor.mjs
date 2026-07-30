/**
 * WordTextExtractor — extracts text from .docx files using mammoth.
 */

import { createRequire } from 'module';
import fs from 'fs';

const require = createRequire(import.meta.url);

export async function extractWordText(filePath) {
  if (!fs.existsSync(filePath)) {
    return { success: false, error: `File not found: ${filePath}` };
  }

  let mammoth;
  try {
    mammoth = require('mammoth');
  } catch {
    return {
      success: false,
      status: 'PARSER_NOT_AVAILABLE',
      error: 'mammoth not installed. Run: npm install mammoth',
    };
  }

  try {
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer });
    return {
      success: true,
      file_type: 'docx',
      text: result.value,
      messages: result.messages,
    };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}
