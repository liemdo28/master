/**
 * US Compliance DB Retrieval — WS4
 *
 * Fast keyword-based search over compliance markdown files.
 * Avoids loading the 979MB search_index.json — searches files directly.
 *
 * DB location: mi-core/.local-agent-global/reference-brain/us-business-compliance/
 */

import fs from 'fs';
import path from 'path';
import { getUSComplianceDBPath } from './reference-brain-path';

export interface ComplianceResult {
  source_id: string;
  title: string;
  jurisdiction: string;
  domain: string;
  content: string;       // relevant excerpt
  score: number;         // relevance 0-1
  file_path: string;
  disclaimer: string;
}

// Domain directories in the compliance DB
const DOMAIN_DIRS = ['payroll', 'tax', 'labor-law', 'food-safety', 'permits', 'accounting', 'restaurant-operations'];
const JURISDICTION_DIRS = ['federal', 'texas', 'california', 'san-antonio', 'stockton'];

// Query → domain hints
const DOMAIN_HINTS: Record<string, string[]> = {
  'payroll': ['payroll', 'texas', 'california', 'federal'],
  'tax': ['tax', 'texas', 'california', 'federal'],
  'sales tax': ['tax', 'texas', 'california', 'san-antonio', 'stockton'],
  'minimum wage': ['labor-law', 'texas', 'california', 'federal'],
  'overtime': ['labor-law', 'texas', 'california', 'federal'],
  'meal break': ['labor-law', 'california', 'federal'],
  'food safety': ['food-safety', 'texas', 'california', 'federal'],
  'permit': ['permits', 'san-antonio', 'stockton', 'texas', 'california'],
  'business license': ['permits', 'san-antonio', 'stockton'],
  'alcohol': ['permits', 'texas', 'california'],
  'workers comp': ['payroll', 'texas', 'california'],
  'sick leave': ['labor-law', 'california', 'texas'],
};

function getSearchDirs(query: string, jurisdiction?: string): string[] {
  const dbPath = getUSComplianceDBPath();
  if (!dbPath) return [];

  const q = query.toLowerCase();
  const dirs = new Set<string>();

  // Add jurisdiction-specific dirs
  if (jurisdiction) {
    const jDir = path.join(dbPath, jurisdiction);
    if (fs.existsSync(jDir)) dirs.add(jDir);
  }

  // Add domain dirs based on query content
  for (const [hint, hintDirs] of Object.entries(DOMAIN_HINTS)) {
    if (q.includes(hint)) {
      for (const d of hintDirs) {
        if (!jurisdiction || d === jurisdiction || DOMAIN_DIRS.includes(d)) {
          const full = path.join(dbPath, d);
          if (fs.existsSync(full)) dirs.add(full);
        }
      }
    }
  }

  // If no specific match, search jurisdiction + federal
  if (dirs.size === 0) {
    const fallbacks = jurisdiction
      ? [jurisdiction, 'federal']
      : ['federal', 'texas', 'california'];
    for (const d of fallbacks) {
      const full = path.join(dbPath, d);
      if (fs.existsSync(full)) dirs.add(full);
    }
  }

  return Array.from(dirs);
}

function scoreDocument(content: string, query: string): number {
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const lower = content.toLowerCase();
  if (!words.length) return 0;

  let score = 0;
  for (const word of words) {
    const count = (lower.match(new RegExp(word, 'g')) || []).length;
    score += Math.min(count / 5, 1) * (1 / words.length);
  }

  // Boost exact phrase match
  if (lower.includes(query.toLowerCase())) score += 0.4;

  // Boost title/header matches (first 500 chars)
  const titleArea = lower.slice(0, 500);
  for (const word of words) {
    if (titleArea.includes(word)) score += 0.1;
  }

  return Math.min(score, 1);
}

function extractRelevantExcerpt(content: string, query: string, maxChars = 1500): string {
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const lines = content.split('\n');

  // Score each line
  const lineScores = lines.map((line, i) => {
    const lower = line.toLowerCase();
    const score = words.filter(w => lower.includes(w)).length;
    return { line, score, i };
  });

  // Find best window of lines
  const topLines = lineScores.filter(l => l.score > 0).slice(0, 10);
  if (topLines.length === 0) {
    // Return first chunk if no keyword match
    return content.slice(0, maxChars);
  }

  // Build excerpt around best matching lines
  const firstHit = topLines[0].i;
  const start = Math.max(0, firstHit - 3);
  const excerpt = lines.slice(start, start + 30).join('\n');
  return excerpt.length > maxChars ? excerpt.slice(0, maxChars) + '...' : excerpt;
}

function getMetaFromContent(content: string): { title: string; jurisdiction: string; domain: string } {
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const jurisdictionMatch = content.match(/jurisdiction:\s*(\w[\w-]*)/i);
  const domainMatch = content.match(/domain:\s*(\w[\w-]*)/i);
  return {
    title: titleMatch?.[1]?.trim() || 'Compliance Document',
    jurisdiction: jurisdictionMatch?.[1]?.trim() || 'federal',
    domain: domainMatch?.[1]?.trim() || 'general',
  };
}

// ── Main search function ───────────────────────────────────────────────────

export interface ComplianceSearchOptions {
  limit?: number;
  jurisdiction?: string;
  min_score?: number;
}

export function searchCompliance(query: string, options: ComplianceSearchOptions = {}): ComplianceResult[] {
  const { limit = 3, jurisdiction, min_score = 0.05 } = options;
  const dbPath = getUSComplianceDBPath();
  if (!dbPath) return [];

  const searchDirs = getSearchDirs(query, jurisdiction);
  const results: ComplianceResult[] = [];

  for (const dir of searchDirs) {
    let files: string[];
    try {
      files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
    } catch {
      continue;
    }

    for (const file of files) {
      const filePath = path.join(dir, file);
      let content: string;
      try {
        content = fs.readFileSync(filePath, 'utf-8');
      } catch {
        continue;
      }

      const score = scoreDocument(content, query);
      if (score < min_score) continue;

      const meta = getMetaFromContent(content);
      const dirName = path.basename(dir);
      const sourceId = `${dirName}/${file.replace('.md', '')}`;

      results.push({
        source_id: sourceId,
        title: meta.title,
        jurisdiction: meta.jurisdiction || dirName,
        domain: meta.domain,
        content: extractRelevantExcerpt(content, query),
        score,
        file_path: filePath.replace(/\\/g, '/'),
        disclaimer: 'Verify with CPA/legal professional before filing or taking action.',
      });
    }
  }

  // Sort by score descending, take top N
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ── Format for AI context injection ───────────────────────────────────────
export function formatComplianceContext(results: ComplianceResult[], query: string): string {
  if (results.length === 0) {
    return `[US Compliance DB] No results found for: "${query}". Advise CEO to consult CPA/legal professional.`;
  }

  const blocks = results.map((r, i) =>
    `[Compliance Source ${i + 1}] ${r.title} (${r.jurisdiction}/${r.domain})\n${r.content}`
  );

  return `=== US COMPLIANCE REFERENCE DATA ===
Query: "${query}"
Sources found: ${results.length}

${blocks.join('\n\n---\n\n')}

⚠️ DISCLAIMER: ${results[0].disclaimer}
===`;
}

// ── Quick health check ─────────────────────────────────────────────────────
export function isComplianceDBAvailable(): boolean {
  return getUSComplianceDBPath() !== null;
}
