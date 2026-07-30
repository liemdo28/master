/**
 * PDF Worker — extract text from PDF files, generate PDF reports.
 * Read uses pdf-parse. Generate uses LibreOffice headless (if available).
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = path.join(
  process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global',
  'action-outputs', 'pdf'
);

function ensureDir() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

export async function extractPdfText(filePath: string): Promise<{ text: string; pages: number }> {
  try {
    const pdfParse = require('pdf-parse');
    const buf = fs.readFileSync(filePath);
    const data = await pdfParse(buf);
    return { text: data.text.slice(0, 10000), pages: data.numpages };
  } catch {
    return { text: '[pdf-parse not available — install: npm install pdf-parse]', pages: 0 };
  }
}

export async function convertToPdf(inputPath: string): Promise<{ pdf_path: string | null; method: string }> {
  ensureDir();
  return new Promise(resolve => {
    // Try LibreOffice headless
    const proc = spawn('soffice', ['--headless', '--convert-to', 'pdf', '--outdir', OUTPUT_DIR, inputPath], { timeout: 60_000 });
    let stderr = '';
    proc.stderr.on('data', d => stderr += d.toString());
    proc.on('close', code => {
      if (code === 0) {
        const base = path.basename(inputPath, path.extname(inputPath));
        const pdf_path = path.join(OUTPUT_DIR, base + '.pdf');
        resolve({ pdf_path: fs.existsSync(pdf_path) ? pdf_path : null, method: 'libreoffice' });
      } else {
        resolve({ pdf_path: null, method: `libreoffice-failed: ${stderr.slice(0, 200)}` });
      }
    });
    proc.on('error', () => resolve({ pdf_path: null, method: 'libreoffice-not-installed' }));
  });
}
