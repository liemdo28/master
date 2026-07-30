/**
 * LocalFileVisibilityConnector.mjs
 * Searches local PC files within allowed directories.
 * Security: blocks sensitive files (.env, private keys, credentials).
 */

import fs from 'fs';
import path from 'path';

const MASTER_ROOT = process.env.MASTER_ROOT || 'E:/Project/Master';
const GLOBAL_DIR  = process.env.GLOBAL_DIR  || 'E:/Project/Master/.local-agent-global';

// Allowed search roots
const SEARCH_ROOTS = [
  MASTER_ROOT,
  path.join(GLOBAL_DIR, 'reports'),
];

// Blocked file patterns (security)
const BLOCKED_PATTERNS = [
  /\.env$/i, /\.env\./i,
  /private[_-]?key/i, /id_rsa/i, /\.pem$/i,
  /credentials\.json$/i, /token\.json$/i, /google-tokens\.json$/i,
  /secret/i, /password/i,
];

// Blocked directories
const BLOCKED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.ssh',
  'remote-access', 'security',
]);

function isBlocked(filePath) {
  const basename = path.basename(filePath).toLowerCase();
  if (BLOCKED_PATTERNS.some(p => p.test(basename))) return true;
  const parts = filePath.split(path.sep);
  return parts.some(p => BLOCKED_DIRS.has(p.toLowerCase()));
}

function scoreFile(filePath, queryWords) {
  const name = path.basename(filePath).toLowerCase();
  const hits = queryWords.filter(w => name.includes(w)).length;
  const phraseBonus = queryWords.length > 1 && name.includes(queryWords.join(' ')) ? 0.3 : 0;
  return (hits / queryWords.length) + phraseBonus;
}

function walkDir(dir, ext, maxDepth = 4, depth = 0) {
  const results = [];
  if (depth > maxDepth || !fs.existsSync(dir)) return results;
  try {
    for (const entry of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, entry);
      if (BLOCKED_DIRS.has(entry.toLowerCase())) continue;
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          results.push(...walkDir(fullPath, ext, maxDepth, depth + 1));
        } else if (!ext || fullPath.endsWith(ext)) {
          results.push(fullPath);
        }
      } catch { /* skip permission errors */ }
    }
  } catch { /* skip */ }
  return results;
}

export class LocalFileVisibilityConnector {
  constructor() {
    this.id = 'local-files';
    this.name = 'Local PC Files';
  }

  /**
   * Search for files by name/keyword
   * Returns up to 10 results, ordered by relevance then recency
   */
  searchFiles(query, opts = {}) {
    const { extensions = [], maxResults = 10, includeContent = false } = opts;
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 1);

    const allFiles = [];
    for (const root of SEARCH_ROOTS) {
      if (fs.existsSync(root)) {
        allFiles.push(...walkDir(root, null, 4));
      }
    }

    // Score and filter
    const scored = allFiles
      .filter(f => !isBlocked(f))
      .filter(f => extensions.length === 0 || extensions.some(e => f.endsWith(e)))
      .map(f => {
        const score = scoreFile(f, queryWords);
        let mtime = 0;
        try { mtime = fs.statSync(f).mtimeMs; } catch { /* skip */ }
        return { path: f, score, mtime, name: path.basename(f) };
      })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score || b.mtime - a.mtime)
      .slice(0, maxResults);

    return {
      status: 'ok',
      source: 'local-filesystem',
      query,
      count: scored.length,
      files: scored.map(r => ({
        name: r.name,
        path: r.path,
        score: Math.round(r.score * 100),
        modified: new Date(r.mtime).toISOString().split('T')[0],
        type: path.extname(r.name).slice(1) || 'file',
        blocked: false,
      })),
    };
  }

  /**
   * Get the most recent file matching a pattern (e.g. "payroll" + "may" + ".xlsx")
   */
  findLatest(query, opts = {}) {
    const result = this.searchFiles(query, { ...opts, maxResults: 5 });
    if (result.count === 0) return null;
    return result.files[0]; // already sorted by mtime desc
  }

  /**
   * Security check — would this file be blocked?
   */
  isFileBlocked(filePath) {
    return isBlocked(filePath);
  }

  /**
   * Get file info (size, modified date, type)
   */
  getFileInfo(filePath) {
    if (isBlocked(filePath)) {
      return { blocked: true, reason: 'Security: sensitive file pattern' };
    }
    try {
      const stat = fs.statSync(filePath);
      return {
        path: filePath,
        name: path.basename(filePath),
        size_kb: Math.round(stat.size / 1024),
        modified: new Date(stat.mtimeMs).toISOString(),
        type: path.extname(filePath).slice(1) || 'file',
        blocked: false,
      };
    } catch (e) {
      return { error: e.message, path: filePath };
    }
  }

  getSummaryText() {
    return `💾 Local Files: Ready — searching in ${SEARCH_ROOTS.join(', ')}`;
  }
}

export const localFileConnector = new LocalFileVisibilityConnector();
