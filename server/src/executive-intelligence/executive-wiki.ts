/**
 * Executive Wiki — Phase 21
 *
 * Compiled, durable knowledge vault for the Executive Intelligence Layer.
 * Stores curated facts as markdown + JSON with claims, evidence references,
 * contradictions, and open questions.
 *
 * Pattern inspired by OpenClaw's memory-wiki: structured claims with
 * provenance, not just raw data dumps.
 *
 * Storage: {WIKI_ROOT}/  (markdown + json per domain page)
 */

import fs from 'node:fs';
import path from 'node:path';

// ── Configuration ─────────────────────────────────────────────────────────────

const MI_CORE_ROOT = path.resolve(__dirname, '..', '..', '..');
const WIKI_ROOT = process.env.WIKI_ROOT || path.join(MI_CORE_ROOT, 'data', 'wiki');

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WikiClaim {
  id: string;
  text: string;
  evidenceRefs: string[];
  confidence: number;
  contradictedBy: string[];
  createdAt: string;
  updatedAt: string;
}

export interface WikiPage {
  domain: string;
  title: string;
  claims: WikiClaim[];
  openQuestions: string[];
  lastUpdated: string;
  version: number;
}

export interface WikiPageJSON {
  domain: string;
  title: string;
  claims: WikiClaim[];
  openQuestions: string[];
  lastUpdated: string;
  version: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureDir(): void {
  fs.mkdirSync(WIKI_ROOT, { recursive: true });
}

function domainFilePath(domain: string): string {
  return path.join(WIKI_ROOT, `${domain}.json`);
}

function domainMarkdownPath(domain: string): string {
  return path.join(WIKI_ROOT, `${domain}.md`);
}

function generateClaimId(): string {
  return `claim-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// ── Public API ────────────────────────────────────────────────────────────────

export const executiveWiki = {
  /**
   * Initialize the wiki directory.
   */
  init(): void {
    ensureDir();
  },

  /**
   * Upsert a wiki page for a domain.
   * If the domain already exists, merges claims (adds new, updates existing).
   */
  upsertPage(domain: string, page: Partial<WikiPage>): WikiPage {
    ensureDir();
    const existing = this.getPage(domain);

    const now = new Date().toISOString();

    if (existing) {
      // Merge: add new claims, update open questions
      const existingClaimTexts = new Set(existing.claims.map(c => c.text));
      const newClaims = (page.claims || []).filter(c => !existingClaimTexts.has(c.text));
      const updatedClaims = [...existing.claims, ...newClaims];

      const merged: WikiPage = {
        domain,
        title: page.title || existing.title,
        claims: updatedClaims,
        openQuestions: page.openQuestions || existing.openQuestions,
        lastUpdated: now,
        version: existing.version + 1,
      };

      this.writePage(merged);
      return merged;
    }

    // New page
    const wikiPage: WikiPage = {
      domain,
      title: page.title || domain,
      claims: page.claims || [],
      openQuestions: page.openQuestions || [],
      lastUpdated: now,
      version: 1,
    };

    this.writePage(wikiPage);
    return wikiPage;
  },

  /**
   * Get a wiki page by domain.
   */
  getPage(domain: string): WikiPage | null {
    const jsonPath = domainFilePath(domain);
    if (!fs.existsSync(jsonPath)) return null;

    try {
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as WikiPageJSON;
      return data as WikiPage;
    } catch {
      return null;
    }
  },

  /**
   * List all wiki domains.
   */
  listDomains(): string[] {
    ensureDir();
    return fs.readdirSync(WIKI_ROOT)
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));
  },

  /**
   * Search claims across all domains by keyword.
   */
  searchClaims(query: string): Array<{ domain: string; claim: WikiClaim }> {
    const q = query.toLowerCase();
    const results: Array<{ domain: string; claim: WikiClaim }> = [];

    for (const domain of this.listDomains()) {
      const page = this.getPage(domain);
      if (!page) continue;

      for (const claim of page.claims) {
        if (
          claim.text.toLowerCase().includes(q) ||
          claim.evidenceRefs.some(ref => ref.toLowerCase().includes(q))
        ) {
          results.push({ domain, claim });
        }
      }
    }

    return results;
  },

  /**
   * Find claims that haven't been updated recently.
   */
  getStaleClaims(maxAgeMs: number): Array<{ domain: string; claim: WikiClaim; ageMs: number }> {
    const now = Date.now();
    const results: Array<{ domain: string; claim: WikiClaim; ageMs: number }> = [];

    for (const domain of this.listDomains()) {
      const page = this.getPage(domain);
      if (!page) continue;

      for (const claim of page.claims) {
        const age = now - new Date(claim.updatedAt).getTime();
        if (age > maxAgeMs) {
          results.push({ domain, claim, ageMs: age });
        }
      }
    }

    return results.sort((a, b) => b.ageMs - a.ageMs);
  },

  /**
   * Add a claim to an existing domain page.
   */
  addClaim(domain: string, text: string, evidenceRefs: string[] = [], confidence: number = 0.5): WikiClaim | null {
    const page = this.getPage(domain);
    if (!page) return null;

    const now = new Date().toISOString();
    const claim: WikiClaim = {
      id: generateClaimId(),
      text,
      evidenceRefs,
      confidence,
      contradictedBy: [],
      createdAt: now,
      updatedAt: now,
    };

    page.claims.push(claim);
    page.lastUpdated = now;
    page.version++;

    this.writePage(page);
    return claim;
  },

  /**
   * Get a summary of all wiki pages (for executive context).
   */
  getWikiSummary(): string {
    const domains = this.listDomains();
    const lines = ['📚 *Executive Wiki — Compiled Knowledge*'];

    for (const domain of domains) {
      const page = this.getPage(domain);
      if (!page) continue;
      lines.push(`\n*${page.title}* (v${page.version}, ${page.claims.length} claims)`);
      const topClaims = page.claims
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 3);
      for (const c of topClaims) {
        lines.push(`  • ${c.text.slice(0, 100)}${c.text.length > 100 ? '…' : ''} (${Math.round(c.confidence * 100)}%)`);
      }
      if (page.openQuestions.length > 0) {
        lines.push(`  ❓ ${page.openQuestions.length} open question(s)`);
      }
    }

    return lines.join('\n');
  },

  // ── Internal ──────────────────────────────────────────────────────────────

  writePage(page: WikiPage): void {
    ensureDir();
    const jsonPath = domainFilePath(page.domain);
    const mdPath = domainMarkdownPath(page.domain);

    // Write JSON (machine-readable)
    fs.writeFileSync(jsonPath, JSON.stringify(page, null, 2));

    // Write Markdown (human-readable)
    const md = [
      `# ${page.title}`,
      '',
      `*Version ${page.version} — Updated ${page.lastUpdated}*`,
      '',
      '## Claims',
      '',
      ...page.claims.map(c => {
        const confidence = Math.round(c.confidence * 100);
        const refs = c.evidenceRefs.length > 0 ? ` [refs: ${c.evidenceRefs.join(', ')}]` : '';
        const contradictions = c.contradictedBy.length > 0 ? ` ⚠️ contradicted by: ${c.contradictedBy.join(', ')}` : '';
        return `- [${confidence}%] ${c.text}${refs}${contradictions}`;
      }),
      '',
      '## Open Questions',
      '',
      ...page.openQuestions.map(q => `- ❓ ${q}`),
      '',
    ].join('\n');

    fs.writeFileSync(mdPath, md);
  },
};
