/**
 * Local File Agent — search and read approved folders only.
 * No unrestricted filesystem access.
 * Approved roots: MASTER_ROOT, GLOBAL_DIR, and explicit allowlist.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const MASTER_ROOT = process.env.MASTER_ROOT || 'D:/Project/Master';
const GLOBAL_DIR = process.env.GLOBAL_DIR || 'D:/Project/Master/.local-agent-global';

// Only these roots are searchable
const ALLOWED_ROOTS = [
  MASTER_ROOT,
  GLOBAL_DIR,
  path.join(MASTER_ROOT, 'mi-core', 'reports'),
  path.join(MASTER_ROOT, 'mi-core', 'logs'),
];

const MAX_FILE_SIZE = 500_000; // 500KB read cap

function isAllowedPath(filePath: string): boolean {
  const normalized = path.resolve(filePath).replace(/\\/g, '/');
  return ALLOWED_ROOTS.some(root => normalized.startsWith(path.resolve(root).replace(/\\/g, '/')));
}

export interface LocalFileResult {
  path: string;
  name: string;
  size: number;
  modified: string;
  type: 'file' | 'directory';
}

export async function searchLocalFiles(query: string, folder?: string): Promise<LocalFileResult[]> {
  const searchRoot = folder && isAllowedPath(folder) ? folder : MASTER_ROOT;
  const results: LocalFileResult[] = [];

  function walk(dir: string, depth = 0) {
    if (depth > 4) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') && depth > 0) continue;
        if (['node_modules', 'dist', '.git', '__pycache__'].includes(entry.name)) continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.name.toLowerCase().includes(query.toLowerCase()) ||
            fullPath.toLowerCase().includes(query.toLowerCase())) {
          const stat = fs.statSync(fullPath);
          results.push({
            path: fullPath, name: entry.name, size: stat.size,
            modified: stat.mtime.toISOString(), type: entry.isDirectory() ? 'directory' : 'file',
          });
          if (results.length >= 20) return;
        }
        if (entry.isDirectory()) walk(fullPath, depth + 1);
      }
    } catch { /* skip inaccessible */ }
  }

  walk(searchRoot);
  return results;
}

export async function readLocalFile(filePath: string): Promise<{ content: string; size: number; type: string }> {
  if (!isAllowedPath(filePath)) throw new Error(`Access denied: path not in allowed roots`);
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);

  const stat = fs.statSync(filePath);
  if (stat.size > MAX_FILE_SIZE) throw new Error(`File too large (${stat.size} bytes). Max: ${MAX_FILE_SIZE}`);

  const ext = path.extname(filePath).toLowerCase();
  let content = '';
  let type = 'text';

  if (['.txt', '.md', '.json', '.csv', '.log', '.ts', '.js', '.py', '.env.example'].includes(ext)) {
    content = fs.readFileSync(filePath, 'utf8');
    type = ext.slice(1);
  } else if (ext === '.pdf') {
    // Use pdf-parse if available
    try {
      const pdfParse = require('pdf-parse');
      const buf = fs.readFileSync(filePath);
      const data = await pdfParse(buf);
      content = data.text.slice(0, 5000);
      type = 'pdf';
    } catch { content = '[PDF — install pdf-parse for text extraction]'; }
  } else if (['.xlsx', '.xls'].includes(ext)) {
    const xlsx = require('xlsx');
    const wb = xlsx.readFile(filePath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    content = xlsx.utils.sheet_to_csv(ws).slice(0, 5000);
    type = 'excel';
  } else if (['.docx'].includes(ext)) {
    try {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      content = result.value.slice(0, 5000);
      type = 'word';
    } catch { content = '[DOCX — mammoth extraction failed]'; }
  } else {
    content = `[Binary file: ${ext}]`;
    type = 'binary';
  }

  return { content, size: stat.size, type };
}
