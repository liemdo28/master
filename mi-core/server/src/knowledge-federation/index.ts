/**
 * Knowledge Federation — unified search across ALL Mi knowledge sources.
 *
 * Sources federated:
 * 1. Executive Knowledge DB (SQLite FTS5)
 * 2. Executive Memory (owner + business + workflows)
 * 3. Project Registry (master workspace scan)
 * 4. Connector Caches (dashboard, websites, accounting, food-safety)
 * 5. Reports (markdown files)
 * 6. Workflow Registry
 *
 * Every result includes: source, confidence, timestamp, citation
 */

import fs from 'fs';
import path from 'path';
import { search as kbSearch } from '../knowledge/knowledge-db';

const GLOBAL_DIR  = process.env.GLOBAL_DIR  || 'E:/Project/Master/.local-agent-global';
const MASTER_ROOT = process.env.MASTER_ROOT || 'E:/Project/Master';

export interface FederatedResult {
  source: string;
  domain: string;
  title: string;
  snippet: string;
  confidence: number;      // 0-1
  timestamp?: string;
  file_path?: string;
  requires_disclaimer?: string;
  metadata?: Record<string, unknown>;
}

export interface FederatedSearchOptions {
  limit?: number;
  domains?: string[];
  min_confidence?: number;
  jurisdiction?: string;
  project?: string;
}

// ── Domain registry ────────────────────────────────────────────────────────
type Domain = 'knowledge-db' | 'executive-memory' | 'project-registry' |
              'connector-cache' | 'reports' | 'workflows' | 'compliance';

// ── Score a text match ────────────────────────────────────────────────────
function scoreMatch(text: string, query: string): number {
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const target = text.toLowerCase();
  if (!words.length) return 0;
  const hits = words.filter(w => target.includes(w)).length;
  const exactPhrase = target.includes(query.toLowerCase()) ? 0.3 : 0;
  return Math.min(1, hits / words.length * 0.7 + exactPhrase);
}

// ── Source 1: Executive Knowledge DB ─────────────────────────────────────
function searchKnowledgeDB(query: string, limit = 5): FederatedResult[] {
  try {
    const results = kbSearch(query, limit);
    return results.map(r => ({
      source: r.source || 'knowledge-db',
      domain: 'knowledge-db',
      title: r.title,
      snippet: r.snippet.slice(0, 300),
      confidence: 0.75,
      timestamp: undefined,
      file_path: r.file_path,
    }));
  } catch { return []; }
}

// ── Source 2: Executive Memory ────────────────────────────────────────────
function searchExecutiveMemory(query: string): FederatedResult[] {
  const memDir = path.join(GLOBAL_DIR, 'executive-memory-v2');
  const results: FederatedResult[] = [];
  if (!fs.existsSync(memDir)) return results;

  const files = fs.readdirSync(memDir).filter(f => f.endsWith('.json') && !f.includes('consent'));
  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(memDir, file), 'utf-8');
      const score = scoreMatch(content, query);
      if (score > 0.2) {
        results.push({
          source: 'executive-memory',
          domain: 'executive-memory',
          title: `Owner Memory: ${file.replace('.json', '')}`,
          snippet: content.slice(0, 300),
          confidence: score,
          file_path: path.join(memDir, file),
        });
      }
    } catch { /* skip */ }
  }
  return results;
}

// ── Source 3: Project Registry ────────────────────────────────────────────
function searchProjectRegistry(query: string, projectFilter?: string): FederatedResult[] {
  const registryPath = path.join(GLOBAL_DIR, 'mi-core', 'master-projects.json');
  if (!fs.existsSync(registryPath)) return [];
  try {
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
    const projects = Array.isArray(registry) ? registry : (registry.projects || []);
    const results: FederatedResult[] = [];

    for (const p of projects) {
      const text = `${p.name} ${p.type} ${p.framework} ${p.path} ${p.git_branch || ''}`;
      const score = scoreMatch(text, query);
      if (score > 0.2 && (!projectFilter || p.name.toLowerCase().includes(projectFilter.toLowerCase()))) {
        results.push({
          source: 'project-registry',
          domain: 'project-registry',
          title: `Project: ${p.name}`,
          snippet: `${p.type} | ${p.framework} | ${p.relative_path} | git: ${p.git_branch || 'none'} ${p.git_dirty ? '(dirty)' : ''}`,
          confidence: score,
          timestamp: p.last_scanned,
          metadata: { project_id: p.project_id, location: p.location, ports: p.ports },
        });
      }
    }
    return results;
  } catch { return []; }
}

// ── Source 4: Connector Caches ────────────────────────────────────────────
function searchConnectorCaches(query: string): FederatedResult[] {
  const results: FederatedResult[] = [];
  const cacheDir = path.join(GLOBAL_DIR, 'mi-core', 'connectors');
  if (!fs.existsSync(cacheDir)) return results;

  const walk = (dir: string) => {
    try {
      for (const f of fs.readdirSync(dir)) {
        const fp = path.join(dir, f);
        if (fs.statSync(fp).isDirectory()) { walk(fp); continue; }
        if (!f.endsWith('.json')) continue;
        try {
          const content = fs.readFileSync(fp, 'utf-8');
          const score = scoreMatch(content, query);
          if (score > 0.25) {
            results.push({
              source: `connector-cache/${path.relative(cacheDir, fp)}`,
              domain: 'connector-cache',
              title: `Connector Cache: ${path.basename(f, '.json')}`,
              snippet: content.slice(0, 250),
              confidence: score * 0.8,
              file_path: fp,
            });
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  };
  walk(cacheDir);

  // Also check visibility caches
  const visDir = path.join(GLOBAL_DIR, 'visibility');
  if (fs.existsSync(visDir)) walk(visDir);

  return results.slice(0, 8);
}

// ── Source 5: Reports (markdown) ──────────────────────────────────────────
function searchReports(query: string): FederatedResult[] {
  const results: FederatedResult[] = [];
  const searchDirs = [
    MASTER_ROOT,
    path.join(MASTER_ROOT, 'mi-core'),
    path.join(GLOBAL_DIR, 'reports'),
  ].filter(d => fs.existsSync(d));

  for (const dir of searchDirs) {
    try {
      const files = fs.readdirSync(dir).filter(f =>
        (f.endsWith('.md') || f.endsWith('.txt')) &&
        (f.includes('REPORT') || f.includes('READY') || f.includes('AUDIT') || f.includes('REGISTRY'))
      );
      for (const f of files) {
        try {
          const content = fs.readFileSync(path.join(dir, f), 'utf-8');
          const score = scoreMatch(content, query);
          if (score > 0.2) {
            results.push({
              source: `reports/${f}`,
              domain: 'reports',
              title: f.replace(/[_-]/g, ' ').replace('.md', ''),
              snippet: content.slice(0, 300),
              confidence: score * 0.7,
              file_path: path.join(dir, f),
            });
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }
  return results.slice(0, 5);
}

// ── Source 6: Workflows ───────────────────────────────────────────────────
function searchWorkflows(query: string): FederatedResult[] {
  const wfPath = path.join(GLOBAL_DIR, 'executive-memory-v2', 'workflow_memory.json');
  if (!fs.existsSync(wfPath)) return [];
  try {
    const wf = JSON.parse(fs.readFileSync(wfPath, 'utf-8'));
    const results: FederatedResult[] = [];
    const workflows = wf.common_workflows || {};
    for (const [key, w] of Object.entries(workflows)) {
      const wflow = w as { trigger: string; steps: string[] };
      const text = `${key} ${wflow.trigger} ${wflow.steps.join(' ')}`;
      const score = scoreMatch(text, query);
      if (score > 0.2) {
        results.push({
          source: 'workflow-registry',
          domain: 'workflows',
          title: `Workflow: ${key.replace(/_/g, ' ')}`,
          snippet: `Trigger: ${wflow.trigger}\nSteps: ${wflow.steps.slice(0, 3).join(' → ')}`,
          confidence: score * 0.8,
        });
      }
    }
    return results;
  } catch { return []; }
}

// ── Main federation functions ─────────────────────────────────────────────

export function searchAll(query: string, opts: FederatedSearchOptions = {}): FederatedResult[] {
  const { limit = 10, domains, min_confidence = 0.15, project } = opts;

  const allResults: FederatedResult[] = [];

  const shouldSearch = (d: Domain) => !domains?.length || domains.includes(d);

  if (shouldSearch('knowledge-db'))      allResults.push(...searchKnowledgeDB(query, 5));
  if (shouldSearch('executive-memory'))  allResults.push(...searchExecutiveMemory(query));
  if (shouldSearch('project-registry'))  allResults.push(...searchProjectRegistry(query, project));
  if (shouldSearch('connector-cache'))   allResults.push(...searchConnectorCaches(query));
  if (shouldSearch('reports'))           allResults.push(...searchReports(query));
  if (shouldSearch('workflows'))         allResults.push(...searchWorkflows(query));

  return allResults
    .filter(r => r.confidence >= min_confidence)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit);
}

export function searchByDomain(query: string, domain: string, limit = 5): FederatedResult[] {
  return searchAll(query, { domains: [domain as Domain], limit });
}

export function searchByJurisdiction(query: string, jurisdiction: string, limit = 5): FederatedResult[] {
  const enriched = `${query} ${jurisdiction}`;
  return searchAll(enriched, { limit });
}

export function searchByProject(query: string, project: string, limit = 5): FederatedResult[] {
  return searchAll(query, { project, limit });
}

export function retrieveWithCitations(query: string, limit = 8): { results: FederatedResult[]; citations: string } {
  const results = searchAll(query, { limit });
  const citations = results
    .map((r, i) => `[${i+1}] ${r.title} — ${r.source}${r.timestamp ? ` (${new Date(r.timestamp).toLocaleDateString()})` : ''}`)
    .join('\n');
  return { results, citations };
}

export function buildAnswerContext(query: string): string {
  const results = searchAll(query, { limit: 8 });
  if (!results.length) return `No knowledge found for: "${query}"`;

  const blocks = results.map((r, i) =>
    `[${i+1}] ${r.title} (${r.source}, confidence: ${Math.round(r.confidence*100)}%)\n${r.snippet}`
  ).join('\n\n');

  const needsDisclaimer = results.some(r => r.requires_disclaimer);

  return blocks + (needsDisclaimer ? '\n\n⚖️ Note: Legal/compliance info may change. Verify with CPA/attorney.' : '');
}

// ── Quick search for pipeline injection ───────────────────────────────────
export function getFederatedContext(query: string, maxTokens = 1500): string {
  const results = searchAll(query, { limit: 6 });
  if (!results.length) return '';

  let ctx = `[Knowledge Federation — ${results.length} sources]\n`;
  let chars = 0;
  for (const r of results) {
    const block = `• [${r.domain}] ${r.title}\n  ${r.snippet.slice(0, 200)}\n  Source: ${r.source}\n`;
    if (chars + block.length > maxTokens) break;
    ctx += block;
    chars += block.length;
  }
  return ctx;
}
