/**
 * file-search.ts
 * Local file search for pipeline. Blocks sensitive patterns.
 * Returns top-5 matches with confidence scoring.
 */

import fs from 'fs';
import path from 'path';

const MASTER_ROOT = process.env.MASTER_ROOT || 'D:/Project/Master';

const BLOCKED = [
  /\.env$/i, /\.env\./i, /private[_-]?key/i, /id_rsa/i, /\.pem$/i,
  /credentials\.json$/i, /token\.json$/i, /google-tokens/i, /secret/i,
];
const BLOCKED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.ssh', 'remote-access', 'security',
]);

function isBlocked(p: string): boolean {
  const base = path.basename(p).toLowerCase();
  if (BLOCKED.some(r => r.test(base))) return true;
  return p.split(path.sep).some(part => BLOCKED_DIRS.has(part.toLowerCase()));
}

function walk(dir: string, depth = 0, maxDepth = 4): string[] {
  const results: string[] = [];
  if (depth > maxDepth || !fs.existsSync(dir)) return results;
  try {
    for (const entry of fs.readdirSync(dir)) {
      if (BLOCKED_DIRS.has(entry.toLowerCase())) continue;
      const full = path.join(dir, entry);
      try {
        const stat = fs.statSync(full);
        if (stat.isDirectory()) results.push(...walk(full, depth + 1, maxDepth));
        else results.push(full);
      } catch { /* skip */ }
    }
  } catch { /* skip */ }
  return results;
}

function score(filePath: string, words: string[]): number {
  const name = path.basename(filePath).toLowerCase();
  const hits = words.filter(w => name.includes(w)).length;
  const bonus = words.length > 1 && name.includes(words.join(' ')) ? 0.3 : 0;
  return Math.min(1, (hits / words.length) * 0.7 + bonus);
}

export interface FileSearchResult {
  name: string;
  path: string;
  score: number;
  modified: string;
  type: string;
  blocked: false;
}

export function searchLocalFiles(query: string, maxResults = 5): FileSearchResult[] | { blocked: true; reason: string } {
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 1);
  const files = walk(MASTER_ROOT);
  const results = files
    .filter(f => !isBlocked(f))
    .map(f => {
      const s = score(f, words);
      let mtime = 0;
      try { mtime = fs.statSync(f).mtimeMs; } catch { /* skip */ }
      return { path: f, score: s, mtime };
    })
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score || b.mtime - a.mtime)
    .slice(0, maxResults);

  return results.map(r => ({
    name: path.basename(r.path),
    path: r.path,
    score: Math.round(r.score * 100),
    modified: new Date(r.mtime).toISOString().split('T')[0],
    type: path.extname(r.path).slice(1) || 'file',
    blocked: false as const,
  }));
}

export function checkFileBlocked(filePath: string): { blocked: boolean; reason?: string } {
  if (isBlocked(filePath)) {
    return { blocked: true, reason: `🚫 Security: "${path.basename(filePath)}" is a sensitive file — cannot be shared or sent.` };
  }
  return { blocked: false };
}

export function formatFileResults(results: FileSearchResult[], query: string): string {
  if (results.length === 0) {
    return `Em không tìm thấy file nào liên quan đến "${query}". Anh muốn tìm cụ thể hơn không?`;
  }
  const lines = [`📁 Tìm thấy ${results.length} file cho "${query}":\n`];
  for (const f of results) {
    lines.push(`• ${f.score}% — **${f.name}**\n  📂 ${f.path}\n  📅 ${f.modified}`);
  }
  if (results.length === 1) {
    lines.push(`\nAnh có muốn em gửi file này không? Cho em biết tên/email người nhận.`);
  }
  return lines.join('\n');
}
