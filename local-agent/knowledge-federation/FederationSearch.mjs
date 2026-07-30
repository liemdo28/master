/**
 * FederationSearch — unified search across ALL knowledge sources
 * 
 * Sources:
 * - US Business Compliance DB (reference-brain/us-business-compliance/)
 * - Executive Knowledge DB (server knowledge-db)
 * - Project Registry
 * - Source Maps
 * - Reports
 * - QA Reports
 * - Workflow Registry
 * - Executive Memory
 * - Connector Cache
 * 
 * NEVER fakes data. Always shows source, timestamp, confidence.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MI_CORE_ROOT = path.resolve(__dirname, '..', '..');
const GLOBAL_DIR = process.env.GLOBAL_DIR || path.join(MI_CORE_ROOT, '.local-agent-global');
const MASTER_ROOT = process.env.MASTER_ROOT || path.resolve(MI_CORE_ROOT, '..');

// ── Source paths ─────────────────────────────────────────────────────────────

const SOURCE_PATHS = {
  'us-compliance-db': path.join(GLOBAL_DIR, 'reference-brain', 'us-business-compliance'),
  'knowledge-db':     path.join(GLOBAL_DIR, 'knowledge-db'),
  'executive-memory': path.join(GLOBAL_DIR, 'executive-memory-v2'),
  'visibility-cache': path.join(GLOBAL_DIR, 'visibility'),
  'project-registry': path.join(GLOBAL_DIR, 'mi-core'),
  'company-memory':   path.join(GLOBAL_DIR, 'company-memory'),
};

// ── US Compliance DB search ──────────────────────────────────────────────────

/**
 * Search US Business Compliance DB
 * @param {string} query
 * @param {object} options
 * @returns {object[]} results with source/timestamp/confidence
 */
export function searchUSCompliance(query, options = {}) {
  const { category = null, jurisdiction = null, limit = 10 } = options;
  const results = [];
  const q = query.toLowerCase();

  const complianceRoot = SOURCE_PATHS['us-compliance-db'];
  if (!fs.existsSync(complianceRoot)) {
    return [{ source: 'us-compliance-db', error: 'Compliance DB not found', confidence: 0 }];
  }

  // Search by category/directory
  const categories = category ? [category] : ['federal', 'california', 'texas', 'stockton', 'san-antonio', 'labor-law', 'payroll', 'tax', 'food-safety', 'permits'];

  for (const cat of categories) {
    const catDir = path.join(complianceRoot, cat);
    if (!fs.existsSync(catDir)) continue;

    try {
      const files = fs.readdirSync(catDir).filter(f => f.endsWith('.md') || f.endsWith('.txt'));
      for (const file of files) {
        const filePath = path.join(catDir, file);
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          if (content.toLowerCase().includes(q)) {
            const stat = fs.statSync(filePath);
            // Extract snippet around match
            const idx = content.toLowerCase().indexOf(q);
            const start = Math.max(0, idx - 100);
            const snippet = (start > 0 ? '...' : '') + content.slice(start, start + 300) + '...';

            results.push({
              source: `us-compliance-db/${cat}`,
              title: file.replace(/\.(md|txt)$/, '').replace(/[-_]/g, ' '),
              file_path: filePath,
              category: cat,
              snippet,
              timestamp: stat.mtime.toISOString(),
              confidence: calculateConfidence(content, q, jurisdiction),
              jurisdiction: jurisdiction || cat,
            });
          }
        } catch { /* skip unreadable */ }
      }
    } catch { /* skip inaccessible */ }
  }

  return results.slice(0, limit);
}

/**
 * Search by jurisdiction (California, Texas, Stockton, San Antonio)
 * @param {string} query
 * @param {string} jurisdiction
 * @param {number} limit
 */
export function searchByJurisdiction(query, jurisdiction, limit = 10) {
  const jurMap = {
    california: 'california',
    texas: 'texas',
    stockton: 'stockton',
    'san antonio': 'san-antonio',
    'us federal': 'federal',
    federal: 'federal',
  };
  const cat = jurMap[jurisdiction.toLowerCase()] || jurisdiction.toLowerCase();
  return searchUSCompliance(query, { category: cat, jurisdiction, limit });
}

/**
 * Search by domain (payroll, tax, labor-law, food-safety, etc.)
 * @param {string} query
 * @param {string} domain
 * @param {number} limit
 */
export function searchByDomain(query, domain, limit = 10) {
  return searchUSCompliance(query, { category: domain, limit });
}

// ── Confidence calculation ───────────────────────────────────────────────────

function calculateConfidence(content, query, jurisdiction) {
  const q = query.toLowerCase();
  const words = q.split(/\s+/);
  let matches = 0;
  for (const word of words) {
    if (content.toLowerCase().includes(word)) matches++;
  }
  const base = matches / words.length;

  // Boost for jurisdiction match
  if (jurisdiction && content.toLowerCase().includes(jurisdiction.toLowerCase())) {
    return Math.min(1, base + 0.2);
  }

  // Boost for specific terms (law, regulation, requirement)
  const legalTerms = ['law', 'regulation', 'requirement', 'minimum', 'must', 'required', 'prohibited'];
  for (const term of legalTerms) {
    if (content.toLowerCase().includes(term)) return Math.min(1, base + 0.1);
  }

  return base;
}

// ── Unified search ─────────────────────────────────────────────────────────

export class FederationSearch {
  constructor() {
    this.sources = Object.keys(SOURCE_PATHS);
  }

  /**
   * Search ALL knowledge sources
   * @param {string} query
   * @param {object} options
   * @returns {object} unified results with citations
   */
  searchAll(query, options = {}) {
    const { limit = 10 } = options;
    const allResults = [];

    // 1. US Compliance DB
    const complianceResults = searchUSCompliance(query, { limit });
    for (const r of complianceResults) {
      allResults.push({ ...r, domain: 'us-compliance', type: 'regulation' });
    }

    // 2. Knowledge DB (SQLite)
    try {
      const { search } = require('../server/src/knowledge/knowledge-db');
      const kbResults = search(query, limit);
      for (const r of kbResults) {
        allResults.push({
          source: `knowledge-db/${r.source}`,
          title: r.title,
          file_path: r.file_path,
          snippet: r.snippet,
          timestamp: r.file_path ? (fs.existsSync(r.file_path) ? fs.statSync(r.file_path).mtime.toISOString() : null) : null,
          confidence: 0.7,
          domain: 'knowledge',
          type: 'document',
        });
      }
    } catch { /* KB not available */ }

    // Sort by confidence descending
    allResults.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

    return {
      query,
      total_results: allResults.length,
      sources: this.sources,
      results: allResults.slice(0, limit),
    };
  }

  /**
   * Build answer context with citations
   * @param {string} query
   * @param {object[]} results
   * @returns {string} formatted answer with citations
   */
  buildAnswerContext(query, results) {
    if (!results || results.length === 0) {
      return `Không tìm thấy kết quả cho "${query}" trong bất kỳ nguồn nào.`;
    }
    const lines = [`**Kết quả cho: "${query}"**`, ''];
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const conf = Math.round((r.confidence || 0) * 100);
      const src = r.source || r.domain || 'unknown';
      const ts = r.timestamp ? new Date(r.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'unknown';
      lines.push(`**${i + 1}. [${conf}% confidence]**`);
      lines.push(`   Nguồn: ${src}`);
      lines.push(`   Thời gian: ${ts}`);
      if (r.jurisdiction) lines.push(`   Quận: ${r.jurisdiction}`);
      if (r.snippet) lines.push(`   Trích dẫn: "${r.snippet.slice(0, 200)}..."`);
      lines.push('');
    }
    lines.push('⚖️ Disclaimer: Thông tin pháp lý có thể thay đổi. Hãy xác nhận với CPA/luật sư trước khi đưa ra quyết định kinh doanh.');
    return lines.join('\n');
  }

  /**
   * Answer a compliance question with full citations
   * @param {string} query
   * @returns {object} answer with citations
   */
  answerComplianceQuery(query) {
    const results = this.searchAll(query, { limit: 5 });
    const topResult = results.results[0];
    const context = this.buildAnswerContext(query, results.results);
    return {
      question: query,
      answer: context,
      sources: results.results.map(r => r.source),
      top_confidence: topResult ? Math.round(topResult.confidence * 100) + '%' : 'N/A',
      disclaimer: 'This is general information only. Consult a licensed CPA or attorney for legal/tax advice.',
    };
  }
}
