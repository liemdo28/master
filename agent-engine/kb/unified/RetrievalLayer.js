// kb/unified/RetrievalLayer.js — Multi-source retrieval orchestration for Mi
// Before answering, Mi retrieves from: Knowledge DB → Project Registry → Memory → Source Maps → Workflow → Connectors → LLM fallback
import { openUKV, getUKVStats, listProjects, getProject, getMeta, getKnowledgeItem, queryKnowledgeItems } from './UnifiedKnowledgeDatabase.js';
import { searchKnowledge, searchProjects, searchReports, searchDecisions, searchSourceCode, getSourceMapForProject, fuzzySearchProjects } from './SearchEngine.js';
import { join, resolve, dirname } from 'path';
import { existsSync, readFileSync } from 'fs';

export class RetrievalLayer {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this._db = null;
  }

  get db() {
    if (!this._db) { this._db = openUKV(this.dbPath); }
    return this._db;
  }

  close() {
    if (this._db) { this._db.close(); this._db = null; }
  }

  /**
   * Multi-source retrieval: returns a structured result with evidence from each source.
   */
  retrieve(query, { topK = 5, includeContent = true, sources = ['knowledge', 'projects', 'source_map', 'connectors', 'reports', 'decisions'] } = {}) {
    const result = {
      query,
      sources: {},
      answer: null,
      timestamp: new Date().toISOString(),
    };

    // 1. Knowledge DB (full-text over all indexed content)
    if (sources.includes('knowledge')) {
      const start = Date.now();
      try {
        const items = searchKnowledge(this.db, query, { topK });
        result.sources.knowledge = {
          count: items.length,
          items: includeContent ? items : items.map(({ id, title, kind, score }) => ({ id, title, kind, score })),
          duration_ms: Date.now() - start,
        };
      } catch (e) { result.sources.knowledge = { error: e.message }; }
    }

    // 2. Project Registry
    if (sources.includes('projects')) {
      const start = Date.now();
      try {
        const projects = searchProjects(this.db, query);
        result.sources.projects = {
          count: projects.length,
          items: projects.slice(0, topK).map(p => ({
            id: p.id, name: p.name, root_path: p.root_path, type: p.project_type,
            status: p.status, file_count: p.file_count, stale: p.stale,
          })),
          duration_ms: Date.now() - start,
        };
      } catch (e) { result.sources.projects = { error: e.message }; }
    }

    // 3. Reports
    if (sources.includes('reports')) {
      const start = Date.now();
      try {
        const reports = searchReports(this.db, query, topK);
        result.sources.reports = {
          count: reports.length,
          items: includeContent ? reports : reports.map(({ id, title, score }) => ({ id, title, score })),
          duration_ms: Date.now() - start,
        };
      } catch (e) { result.sources.reports = { error: e.message }; }
    }

    // 4. Decisions
    if (sources.includes('decisions')) {
      const start = Date.now();
      try {
        const decisions = searchDecisions(this.db, query, topK);
        result.sources.decisions = {
          count: decisions.length,
          items: decisions.slice(0, topK),
          duration_ms: Date.now() - start,
        };
      } catch (e) { result.sources.decisions = { error: e.message }; }
    }

    // 5. Source Maps
    if (sources.includes('source_map')) {
      // try to identify which project from query
      const fuzzy = fuzzySearchProjects(this.db, query);
      if (fuzzy.length) {
        const start = Date.now();
        try {
          const sm = getSourceMapForProject(this.db, fuzzy[0].id);
          result.sources.source_map = {
            project: fuzzy[0].name,
            count: sm.length,
            items: sm.slice(0, 50), // limit
            duration_ms: Date.now() - start,
          };
        } catch (e) { result.sources.source_map = { error: e.message }; }
      }
    }

    // 6. Connectors (integration-system, whatsapp)
    if (sources.includes('connectors')) {
      const start = Date.now();
      try {
        const items = searchKnowledge(this.db, query, { topK: 3, kind: 'integration_system_data' });
        result.sources.connectors = {
          count: items.length,
          items: includeContent ? items : items.map(({ id, title, score }) => ({ id, title, score })),
          duration_ms: Date.now() - start,
        };
      } catch (e) { result.sources.connectors = { error: e.message }; }
    }

    // Aggregate duration
    result.total_duration_ms = Object.values(result.sources).reduce((acc, s) => acc + (s.duration_ms || 0), 0);

    return result;
  }

  /**
   * Context-aware prompt builder for Mi: assemble search results into an LLM-ready context block.
   */
  buildContext(query, opts = {}) {
    const retrieval = this.retrieve(query, { ...opts, includeContent: true });
    const parts = [`## Mi Knowledge Retrieval for: "${query}"\n`];

    if (retrieval.sources.knowledge?.items?.length) {
      parts.push(`### Knowledge DB (${retrieval.sources.knowledge.count} results)\n`);
      for (const item of retrieval.sources.knowledge.items.slice(0, 5)) {
        parts.push(`- [${item.kind}] **${item.title}** (score: ${item.score})`);
        if (item.snippet) parts.push(`  ${item.snippet}`);
        parts.push('');
      }
    }

    if (retrieval.sources.projects?.items?.length) {
      parts.push(`### Project Registry (${retrieval.sources.projects.count} results)\n`);
      for (const p of retrieval.sources.projects.items.slice(0, 5)) {
        parts.push(`- **${p.name}** — ${p.type}, ${p.file_count} files, status: ${p.status}${p.stale ? ' (STALE)' : ''}`);
      }
      parts.push('');
    }

    if (retrieval.sources.reports?.items?.length) {
      parts.push(`### Reports (${retrieval.sources.reports.count} results)\n`);
      for (const r of retrieval.sources.reports.items.slice(0, 5)) {
        parts.push(`- **${r.title}** — ${r.snippet?.slice(0, 150)}`);
      }
      parts.push('');
    }

    if (retrieval.sources.decisions?.items?.length) {
      parts.push(`### Decisions (${retrieval.sources.decisions.count} results)\n`);
      for (const d of retrieval.sources.decisions.items.slice(0, 5)) {
        parts.push(`- **${d.title}** — ${d.snippet?.slice(0, 150)}`);
      }
      parts.push('');
    }

    parts.push(`_Retrieval completed in ${retrieval.total_duration_ms}ms_`);

    return {
      contextBlock: parts.join('\n'),
      retrieval,
    };
  }

  /**
   * Simple QA answer using retrieved context.
   * Returns a prompt-ready answer based on what was retrieved.
   */
  answer(query) {
    const { contextBlock, retrieval } = this.buildContext(query);
    const hasData = Object.values(retrieval.sources).some(s => s?.items?.length > 0);
    if (!hasData) {
      return { answer: null, source: 'llm_fallback', note: 'No information found in Knowledge DB. Falling back to LLM.', contextBlock, retrieval };
    }
    return { answer: contextBlock, source: 'knowledge_db', contextBlock, retrieval };
  }
}

/**
 * Pre-built retrieval function for Mi to use directly.
 */
export function retrieveForMi(query, dbPath) {
  const layer = new RetrievalLayer(dbPath);
  const result = layer.retrieve(query);
  layer.close();
  return result;
}

export function answerForMi(query, dbPath) {
  const layer = new RetrievalLayer(dbPath);
  const result = layer.answer(query);
  layer.close();
  return result;
}
