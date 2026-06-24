/**
 * Phase 21 — Knowledge Universe
 * Scans local project directories, indexes documents, exposes search API.
 * Works without RAGFlow/Qdrant — uses in-memory index with JSON persistence.
 */

import fs from 'fs';
import path from 'path';

export interface KnowledgeDocument {
  id: string;
  title: string;
  source: string;          // file path or URL
  type: 'markdown' | 'json' | 'typescript' | 'javascript' | 'text' | 'report' | 'config' | 'pdf' | 'docx' | 'xlsx' | 'csv' | 'image' | 'video';
  category: 'project' | 'report' | 'config' | 'code' | 'documentation' | 'store' | 'finance' | 'media' | 'export' | 'archive';
  summary: string;
  keywords: string[];
  size_bytes: number;
  indexed_at: string;
  last_modified: string;
}

export interface KnowledgeCatalog {
  version: string;
  total_documents: number;
  last_indexed: string;
  sources: string[];
  documents: KnowledgeDocument[];
}

const CATALOG_PATH = path.join(process.env.APPDATA || 'C:/Users/liemdo/AppData/Roaming', '../Local/mi-core/knowledge-catalog.json');
const DEFAULT_INDEX_ROOTS = [
  'E:/Project/Master',
  'D:/',
  'F:/',
  'G:/My Drive',
];
const INDEX_ROOTS = (process.env.KNOWLEDGE_INDEX_ROOTS || DEFAULT_INDEX_ROOTS.join(';'))
  .split(/[;,]/)
  .map(r => r.trim())
  .filter(Boolean)
  .filter((r, i, arr) => arr.indexOf(r) === i);

const INCLUDE_EXTENSIONS = new Set([
  '.md', '.ts', '.tsx', '.js', '.jsx', '.json', '.txt', '.mjs',
  '.pdf', '.docx', '.xlsx', '.csv',
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.mp4', '.mov', '.avi', '.mkv',
]);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.next', 'coverage', '__pycache__', '.venv', 'build', '$recycle.bin', 'system volume information']);
const MAX_INDEX_DOCS = parseInt(process.env.KNOWLEDGE_MAX_INDEX_DOCS || '75000', 10);
const MAX_TEXT_BYTES = parseInt(process.env.KNOWLEDGE_MAX_TEXT_BYTES || String(2 * 1024 * 1024), 10);

let CATALOG: KnowledgeCatalog = {
  version: '1.0',
  total_documents: 0,
  last_indexed: new Date(0).toISOString(),
  sources: INDEX_ROOTS,
  documents: [],
};

function ensureDir(p: string) {
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadCatalog() {
  try {
    if (fs.existsSync(CATALOG_PATH)) {
      CATALOG = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf-8'));
    }
  } catch { /* fresh start */ }
}

function saveCatalog() {
  try {
    ensureDir(CATALOG_PATH);
    fs.writeFileSync(CATALOG_PATH, JSON.stringify(CATALOG, null, 2));
  } catch { /* non-critical */ }
}

function fileType(ext: string): KnowledgeDocument['type'] {
  if (ext === '.md') return 'markdown';
  if (ext === '.json') return 'json';
  if (ext === '.ts') return 'typescript';
  if (ext === '.js' || ext === '.mjs' || ext === '.jsx') return 'javascript';
  if (ext === '.pdf') return 'pdf';
  if (ext === '.docx') return 'docx';
  if (ext === '.xlsx') return 'xlsx';
  if (ext === '.csv') return 'csv';
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext)) return 'image';
  if (['.mp4', '.mov', '.avi', '.mkv'].includes(ext)) return 'video';
  return 'text';
}

function fileCategory(filePath: string): KnowledgeDocument['category'] {
  const p = filePath.toLowerCase();
  if (p.includes('/archive') || p.includes('\\archive') || p.includes('backup')) return 'archive';
  if (p.includes('/export') || p.includes('\\export')) return 'export';
  if (p.includes('/report') || p.includes('\\report')) return 'report';
  if (p.includes('store') || p.includes('stone_oak') || p.includes('bandera') || p.includes('bakudan')) return 'store';
  if (p.includes('finance') || p.includes('invoice') || p.includes('payroll') || p.includes('revenue')) return 'finance';
  if (p.includes('config') || p.includes('.env') || p.includes('package.json')) return 'config';
  if (p.includes('/src/') || p.includes('\\src\\')) return 'code';
  if (p.includes('readme') || p.includes('doc')) return 'documentation';
  if (/\.(png|jpe?g|webp|gif|mp4|mov|avi|mkv)$/i.test(p)) return 'media';
  return 'project';
}

function extractSummary(filePath: string, ext: string): string {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > MAX_TEXT_BYTES || ['.pdf', '.docx', '.xlsx', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.mp4', '.mov', '.avi', '.mkv'].includes(ext)) {
      return `${path.basename(filePath)} (${ext.replace('.', '').toUpperCase()}, ${stat.size} bytes) at ${filePath}`;
    }
    const content = fs.readFileSync(filePath, 'utf-8').slice(0, 1200);
    if (ext === '.md') {
      // Extract first heading + paragraph
      const lines = content.split('\n').filter(l => l.trim());
      return lines.slice(0, 3).join(' ').slice(0, 200);
    }
    if (ext === '.json') {
      const obj = JSON.parse(content);
      if (obj.name) return `${obj.name}: ${obj.description || obj.version || ''}`;
      return content.slice(0, 100);
    }
    if (ext === '.csv') {
      return content.split(/\r?\n/).slice(0, 5).join(' ').slice(0, 240);
    }
    return content.slice(0, 200).replace(/\s+/g, ' ');
  } catch {
    return '';
  }
}

function extractKeywords(filePath: string, summary: string): string[] {
  const parts = filePath.toLowerCase().replace(/[\\\/\-_.]/g, ' ').split(' ')
    .filter(p => p.length > 3 && !['node', 'modules', 'dist', 'src', 'com', 'server'].includes(p));
  const summaryWords = summary.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(' ')
    .filter(w => w.length > 4);
  return [...new Set([...parts, ...summaryWords])].slice(0, 20);
}

let _scanRunning = false;

// Load persisted catalog on module init so stats/search work immediately
loadCatalog();

function yieldLoop(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}

export async function indexKnowledge(): Promise<{ indexed: number; duration_ms: number }> {
  if (_scanRunning) return { indexed: 0, duration_ms: 0 };
  _scanRunning = true;
  const start = Date.now();
  const docs: KnowledgeDocument[] = [];
  let count = 0;

  async function scanDir(dir: string, depth = 0): Promise<void> {
    if (depth > 8) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      // Yield after each directory read to keep event loop responsive
      await yieldLoop();
      for (const entry of entries) {
        if (SKIP_DIRS.has(entry.name.toLowerCase())) continue;
        if (count >= MAX_INDEX_DOCS) return;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await scanDir(full, depth + 1);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (!INCLUDE_EXTENSIONS.has(ext)) continue;
          try {
            const stat = fs.statSync(full);
            if (stat.size > 100 * 1024 * 1024) continue; // skip > 100MB
            const summary = extractSummary(full, ext);
            const keywords = extractKeywords(full, summary);
            docs.push({
              id: Buffer.from(full).toString('base64').slice(0, 32),
              title: entry.name,
              source: full,
              type: fileType(ext),
              category: fileCategory(full),
              summary,
              keywords,
              size_bytes: stat.size,
              indexed_at: new Date().toISOString(),
              last_modified: stat.mtime.toISOString(),
            });
            count++;
            if (count >= MAX_INDEX_DOCS) return; // safety cap
          } catch { /* skip unreadable */ }
        }
      }
    } catch { /* skip inaccessible dirs */ }
  }

  for (const root of INDEX_ROOTS) {
    if (count >= MAX_INDEX_DOCS) break;
    if (fs.existsSync(root)) await scanDir(root);
  }

  CATALOG = {
    version: '1.0',
    total_documents: docs.length,
    last_indexed: new Date().toISOString(),
    sources: INDEX_ROOTS,
    documents: docs,
  };
  saveCatalog();
  _scanRunning = false;
  return { indexed: docs.length, duration_ms: Date.now() - start };
}

export function getCatalog(): KnowledgeCatalog {
  return CATALOG;
}

export function searchKnowledge(query: string, limit = 10): KnowledgeDocument[] {
  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  if (!terms.length) return CATALOG.documents.slice(0, limit);

  const scored = CATALOG.documents.map(doc => {
    let score = 0;
    for (const term of terms) {
      if (doc.title.toLowerCase().includes(term)) score += 3;
      if (doc.summary.toLowerCase().includes(term)) score += 2;
      if (doc.keywords.some(k => k.includes(term))) score += 1;
      if (doc.source.toLowerCase().includes(term)) score += 2;
    }
    return { doc, score };
  }).filter(r => r.score > 0).sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map(r => r.doc);
}

export function getKnowledgeStats(): Record<string, unknown> {
  const byCategory: Record<string, number> = {};
  const byType: Record<string, number> = {};
  for (const doc of CATALOG.documents) {
    byCategory[doc.category] = (byCategory[doc.category] || 0) + 1;
    byType[doc.type] = (byType[doc.type] || 0) + 1;
  }
  return {
    total: CATALOG.documents.length,
    last_indexed: CATALOG.last_indexed,
    by_category: byCategory,
    by_type: byType,
    sources: CATALOG.sources,
    index_age_hours: Math.round((Date.now() - new Date(CATALOG.last_indexed).getTime()) / 3600000),
  };
}

// Load on startup
loadCatalog();
// Background index on startup (non-blocking)
setTimeout(() => indexKnowledge().catch(() => {}), 5000);
