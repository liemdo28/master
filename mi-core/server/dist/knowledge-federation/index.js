"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchAll = searchAll;
exports.searchByDomain = searchByDomain;
exports.searchByJurisdiction = searchByJurisdiction;
exports.searchByProject = searchByProject;
exports.retrieveWithCitations = retrieveWithCitations;
exports.buildAnswerContext = buildAnswerContext;
exports.getFederatedContext = getFederatedContext;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const knowledge_db_1 = require("../knowledge/knowledge-db");
const reference_brain_path_1 = require("../knowledge/reference-brain-path");
const MI_CORE_ROOT = path_1.default.resolve(__dirname, '..', '..', '..');
const GLOBAL_DIR = process.env.GLOBAL_DIR || path_1.default.join(MI_CORE_ROOT, '.local-agent-global');
const MASTER_ROOT = process.env.MASTER_ROOT || path_1.default.resolve(MI_CORE_ROOT, '..');
// ── Score a text match ────────────────────────────────────────────────────
function scoreMatch(text, query) {
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const target = text.toLowerCase();
    if (!words.length)
        return 0;
    const hits = words.filter(w => target.includes(w)).length;
    const exactPhrase = target.includes(query.toLowerCase()) ? 0.3 : 0;
    return Math.min(1, hits / words.length * 0.7 + exactPhrase);
}
// ── Source 1: Executive Knowledge DB ─────────────────────────────────────
function searchKnowledgeDB(query, limit = 5) {
    try {
        const results = (0, knowledge_db_1.search)(query, limit);
        return results.map(r => ({
            source: r.source || 'knowledge-db',
            domain: 'knowledge-db',
            title: r.title,
            snippet: r.snippet.slice(0, 300),
            confidence: 0.75,
            timestamp: undefined,
            file_path: r.file_path,
        }));
    }
    catch {
        return [];
    }
}
// ── Source 2: Executive Memory ────────────────────────────────────────────
function searchExecutiveMemory(query) {
    const memDir = path_1.default.join(GLOBAL_DIR, 'executive-memory-v2');
    const results = [];
    if (!fs_1.default.existsSync(memDir))
        return results;
    const files = fs_1.default.readdirSync(memDir).filter(f => f.endsWith('.json') && !f.includes('consent'));
    for (const file of files) {
        try {
            const content = fs_1.default.readFileSync(path_1.default.join(memDir, file), 'utf-8');
            const score = scoreMatch(content, query);
            if (score > 0.2) {
                results.push({
                    source: 'executive-memory',
                    domain: 'executive-memory',
                    title: `Owner Memory: ${file.replace('.json', '')}`,
                    snippet: content.slice(0, 300),
                    confidence: score,
                    file_path: path_1.default.join(memDir, file),
                });
            }
        }
        catch { /* skip */ }
    }
    return results;
}
// ── Source 3: Project Registry ────────────────────────────────────────────
function searchProjectRegistry(query, projectFilter) {
    const registryPath = path_1.default.join(GLOBAL_DIR, 'mi-core', 'master-projects.json');
    if (!fs_1.default.existsSync(registryPath))
        return [];
    try {
        const registry = JSON.parse(fs_1.default.readFileSync(registryPath, 'utf-8'));
        const projects = Array.isArray(registry) ? registry : (registry.projects || []);
        const results = [];
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
    }
    catch {
        return [];
    }
}
// ── Source 4: Connector Caches ────────────────────────────────────────────
function searchConnectorCaches(query) {
    const results = [];
    const cacheDir = path_1.default.join(GLOBAL_DIR, 'mi-core', 'connectors');
    if (!fs_1.default.existsSync(cacheDir))
        return results;
    const walk = (dir) => {
        try {
            for (const f of fs_1.default.readdirSync(dir)) {
                const fp = path_1.default.join(dir, f);
                if (fs_1.default.statSync(fp).isDirectory()) {
                    walk(fp);
                    continue;
                }
                if (!f.endsWith('.json'))
                    continue;
                try {
                    const content = fs_1.default.readFileSync(fp, 'utf-8');
                    const score = scoreMatch(content, query);
                    if (score > 0.25) {
                        results.push({
                            source: `connector-cache/${path_1.default.relative(cacheDir, fp)}`,
                            domain: 'connector-cache',
                            title: `Connector Cache: ${path_1.default.basename(f, '.json')}`,
                            snippet: content.slice(0, 250),
                            confidence: score * 0.8,
                            file_path: fp,
                        });
                    }
                }
                catch { /* skip */ }
            }
        }
        catch { /* skip */ }
    };
    walk(cacheDir);
    // Also check visibility caches
    const visDir = path_1.default.join(GLOBAL_DIR, 'visibility');
    if (fs_1.default.existsSync(visDir))
        walk(visDir);
    return results.slice(0, 8);
}
// ── Source 5: Reports (markdown) ──────────────────────────────────────────
function searchReports(query) {
    const results = [];
    const searchDirs = [
        MASTER_ROOT,
        path_1.default.join(MASTER_ROOT, 'mi-core'),
        path_1.default.join(GLOBAL_DIR, 'reports'),
    ].filter(d => fs_1.default.existsSync(d));
    for (const dir of searchDirs) {
        try {
            const files = fs_1.default.readdirSync(dir).filter(f => (f.endsWith('.md') || f.endsWith('.txt')) &&
                (f.includes('REPORT') || f.includes('READY') || f.includes('AUDIT') || f.includes('REGISTRY')));
            for (const f of files) {
                try {
                    const content = fs_1.default.readFileSync(path_1.default.join(dir, f), 'utf-8');
                    const score = scoreMatch(content, query);
                    if (score > 0.2) {
                        results.push({
                            source: `reports/${f}`,
                            domain: 'reports',
                            title: f.replace(/[_-]/g, ' ').replace('.md', ''),
                            snippet: content.slice(0, 300),
                            confidence: score * 0.7,
                            file_path: path_1.default.join(dir, f),
                        });
                    }
                }
                catch { /* skip */ }
            }
        }
        catch { /* skip */ }
    }
    return results.slice(0, 5);
}
// ── Source 6: Workflows ───────────────────────────────────────────────────
function searchWorkflows(query) {
    const wfPath = path_1.default.join(GLOBAL_DIR, 'executive-memory-v2', 'workflow_memory.json');
    if (!fs_1.default.existsSync(wfPath))
        return [];
    try {
        const wf = JSON.parse(fs_1.default.readFileSync(wfPath, 'utf-8'));
        const results = [];
        const workflows = wf.common_workflows || {};
        for (const [key, w] of Object.entries(workflows)) {
            const wflow = w;
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
    }
    catch {
        return [];
    }
}
// ── Source 7: US Compliance DB ────────────────────────────────────────────
function searchUSComplianceDB(query, jurisdiction) {
    const complianceRoot = (0, reference_brain_path_1.getUSComplianceDBPath)();
    if (!complianceRoot)
        return [];
    const results = [];
    const categories = jurisdiction
        ? [jurisdiction.toLowerCase()]
        : ['federal', 'california', 'texas', 'stockton', 'san-antonio', 'labor-law', 'payroll', 'tax', 'food-safety', 'permits', 'accounting'];
    for (const cat of categories) {
        const catDir = path_1.default.join(complianceRoot, cat);
        if (!fs_1.default.existsSync(catDir))
            continue;
        try {
            const files = fs_1.default.readdirSync(catDir).filter(f => f.endsWith('.md') || f.endsWith('.txt'));
            for (const file of files.slice(0, 10)) {
                try {
                    const filePath = path_1.default.join(catDir, file);
                    const content = fs_1.default.readFileSync(filePath, 'utf-8');
                    const score = scoreMatch(content, query);
                    if (score > 0.25) {
                        const idx = content.toLowerCase().indexOf(query.toLowerCase().split(' ')[0]);
                        const start = Math.max(0, idx - 100);
                        const snippet = (start > 0 ? '...' : '') + content.slice(start, start + 300) + '...';
                        results.push({
                            source: `us-compliance/${cat}`,
                            domain: 'compliance',
                            title: file.replace(/\.(md|txt)$/, '').replace(/[-_]/g, ' '),
                            snippet,
                            confidence: score * 0.9,
                            timestamp: fs_1.default.statSync(filePath).mtime.toISOString(),
                            file_path: filePath,
                            requires_disclaimer: 'Verify with CPA/legal professional before filing or taking action',
                            metadata: { jurisdiction: cat },
                        });
                    }
                }
                catch { /* skip */ }
            }
        }
        catch { /* skip */ }
    }
    return results.slice(0, 8);
}
// ── Main federation functions ─────────────────────────────────────────────
function searchAll(query, opts = {}) {
    const { limit = 10, domains, min_confidence = 0.15, project } = opts;
    const allResults = [];
    const shouldSearch = (d) => !domains?.length || domains.includes(d);
    if (shouldSearch('knowledge-db'))
        allResults.push(...searchKnowledgeDB(query, 5));
    if (shouldSearch('compliance'))
        allResults.push(...searchUSComplianceDB(query, opts.jurisdiction));
    if (shouldSearch('executive-memory'))
        allResults.push(...searchExecutiveMemory(query));
    if (shouldSearch('project-registry'))
        allResults.push(...searchProjectRegistry(query, project));
    if (shouldSearch('connector-cache'))
        allResults.push(...searchConnectorCaches(query));
    if (shouldSearch('reports'))
        allResults.push(...searchReports(query));
    if (shouldSearch('workflows'))
        allResults.push(...searchWorkflows(query));
    return allResults
        .filter(r => r.confidence >= min_confidence)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, limit);
}
function searchByDomain(query, domain, limit = 5) {
    return searchAll(query, { domains: [domain], limit });
}
function searchByJurisdiction(query, jurisdiction, limit = 5) {
    const enriched = `${query} ${jurisdiction}`;
    return searchAll(enriched, { limit });
}
function searchByProject(query, project, limit = 5) {
    return searchAll(query, { project, limit });
}
function retrieveWithCitations(query, limit = 8) {
    const results = searchAll(query, { limit });
    const citations = results
        .map((r, i) => `[${i + 1}] ${r.title} — ${r.source}${r.timestamp ? ` (${new Date(r.timestamp).toLocaleDateString()})` : ''}`)
        .join('\n');
    return { results, citations };
}
function buildAnswerContext(query) {
    const results = searchAll(query, { limit: 8 });
    if (!results.length)
        return `No knowledge found for: "${query}"`;
    const blocks = results.map((r, i) => `[${i + 1}] ${r.title} (${r.source}, confidence: ${Math.round(r.confidence * 100)}%)\n${r.snippet}`).join('\n\n');
    const needsDisclaimer = results.some(r => r.requires_disclaimer);
    return blocks + (needsDisclaimer ? '\n\n⚖️ Note: Legal/compliance info may change. Verify with CPA/attorney.' : '');
}
// ── Quick search for pipeline injection ───────────────────────────────────
function getFederatedContext(query, maxTokens = 1500) {
    const results = searchAll(query, { limit: 6 });
    if (!results.length)
        return '';
    let ctx = `[Knowledge Federation — ${results.length} sources]\n`;
    let chars = 0;
    for (const r of results) {
        const block = `• [${r.domain}] ${r.title}\n  ${r.snippet.slice(0, 200)}\n  Source: ${r.source}\n`;
        if (chars + block.length > maxTokens)
            break;
        ctx += block;
        chars += block.length;
    }
    return ctx;
}
