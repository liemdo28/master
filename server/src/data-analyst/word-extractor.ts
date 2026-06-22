/**
 * WordTextExtractor — TypeScript port. Uses mammoth (already installed).
 */

import fs from 'fs';

export interface WordResult {
  success: boolean;
  file_type?: string;
  text?: string;
  messages?: unknown[];
  status?: string;
  error?: string;
}

export async function extractWordText(filePath: string): Promise<WordResult> {
  if (!fs.existsSync(filePath)) return { success: false, error: `File not found: ${filePath}` };

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  let mammoth: { extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string; messages: unknown[] }> } | null;
  try { mammoth = require('mammoth'); }
  catch { return { success: false, status: 'PARSER_NOT_AVAILABLE', error: 'mammoth not installed. Run: npm install mammoth' }; }

  try {
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth!.extractRawText({ buffer });
    return { success: true, file_type: 'docx', text: result.value, messages: result.messages };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}
