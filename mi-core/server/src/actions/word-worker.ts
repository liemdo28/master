/**
 * Word Worker — create Word (.docx) documents using python-docx via subprocess,
 * or basic HTML-to-docx via mammoth-compatible approach.
 * Output saved to approved workspace output folder.
 */

import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';

const OUTPUT_DIR = path.join(
  process.env.GLOBAL_DIR || 'D:/Project/Master/.local-agent-global',
  'action-outputs', 'word'
);
const PYTHON_BIN = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');

function ensureDir() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

export interface WordCreateParams {
  filename: string;
  title: string;
  sections: Array<{ heading?: string; text: string }>;
  author?: string;
}

export interface WordResult {
  path: string;
  filename: string;
  method: 'python-docx' | 'txt-fallback';
}

function buildDocxScript(params: WordCreateParams, outputPath: string): string {
  const sections = JSON.stringify(params.sections);
  return `
import sys, json
try:
    from docx import Document
    from docx.shared import Pt
    doc = Document()
    doc.add_heading(${JSON.stringify(params.title)}, 0)
    for s in ${sections}:
        if s.get('heading'):
            doc.add_heading(s['heading'], 1)
        doc.add_paragraph(s['text'])
    doc.save(${JSON.stringify(outputPath.replace(/\\/g, '/'))})
    print('ok')
except ImportError:
    print('no-python-docx')
except Exception as e:
    print('error:' + str(e))
`.trim();
}

export async function createWord(params: WordCreateParams): Promise<WordResult> {
  ensureDir();
  const safe = params.filename.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
  const filename = safe.endsWith('.docx') ? safe : safe + '.docx';
  const filePath = path.join(OUTPUT_DIR, filename);

  // Try python-docx
  const result = await new Promise<string>((resolve) => {
    const script = buildDocxScript(params, filePath);
    const proc = spawn(PYTHON_BIN, ['-c', script], { timeout: 30_000 });
    let out = '';
    proc.stdout.on('data', d => out += d.toString());
    proc.on('close', () => resolve(out.trim()));
    proc.on('error', () => resolve('error'));
  });

  if (result === 'ok') {
    return { path: filePath, filename, method: 'python-docx' };
  }

  // Fallback: write as .txt with .docx extension (readable by Word)
  const txtPath = filePath.replace('.docx', '.txt');
  const content = [
    params.title,
    '='.repeat(params.title.length),
    '',
    ...params.sections.map(s => [s.heading ? `\n## ${s.heading}\n` : '', s.text].join('')),
  ].join('\n');
  fs.writeFileSync(txtPath, content, 'utf8');

  return { path: txtPath, filename: filename.replace('.docx', '.txt'), method: 'txt-fallback' };
}
