/**
 * Codegraph Intelligence — OSS Wave A adapter.
 *
 * This is intentionally an adapter into the existing Enterprise Brain Graph.
 * It does not introduce a second graph store or runtime engine.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import ts from 'typescript';
import { getEntity, getInEdges, getOutEdges, upsertEdge, upsertEntity, type Entity } from './graph-db';

const MI_CORE_ROOT = process.env.MI_CORE_ROOT || 'E:/Project/Master/mi-core';
const MASTER_ROOT = process.env.MASTER_ROOT || 'E:/Project/Master';
const DASHBOARD_ROOT = process.env.DASHBOARD_ROOT || process.env.DASHBOARD_PATH || path.join(MASTER_ROOT, 'Bakudan', 'dashboard.bakudanramen.com');
const CODEGRAPH_CACHE_DIR = path.join(MI_CORE_ROOT, '.local-agent-global', 'graph');
const CODEGRAPH_CACHE_FILE = path.join(CODEGRAPH_CACHE_DIR, 'codegraph-summary.json');
const CODEGRAPH_CACHE_TTL_MS = Number(process.env.CODEGRAPH_CACHE_TTL_MS || 10 * 60_000);

const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const API_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'use']);
const IGNORE_DIRS = new Set(['node_modules', 'dist', '.git', '.local-agent-global', 'data', 'logs', 'coverage']);

export interface CodegraphSummary {
  status: 'CODEGRAPH_READY' | 'CODEGRAPH_NO_SOURCE';
  generated_at: string;
  roots: string[];
  repositories: number;
  files: number;
  classes: number;
  functions: number;
  apis: number;
  dependencies: number;
  cache_path: string;
  graph_engine: 'enterprise-brain-graph';
}

interface FileFacts {
  projectId: string;
  projectName: string;
  repositoryId: string;
  fileId: string;
  absPath: string;
  relPath: string;
  imports: string[];
  classes: string[];
  functions: string[];
  apis: Array<{ method: string; route: string; name: string }>;
  impactsDashboard: boolean;
}

function hash(input: string): string {
  return crypto.createHash('sha1').update(input).digest('hex').slice(0, 16);
}

function id(kind: string, value: string): string {
  return `${kind}:${hash(value)}`;
}

function norm(file: string): string {
  return file.replace(/\\/g, '/');
}

function safeRel(root: string, file: string): string {
  const rel = path.relative(root, file);
  return rel && !rel.startsWith('..') ? norm(rel) : norm(file);
}

function existingRoots(): string[] {
  const configured = (process.env.CODEGRAPH_ROOTS || '')
    .split(';')
    .map(v => v.trim())
    .filter(Boolean);
  const candidates = configured.length ? configured : [
    DASHBOARD_ROOT,
    path.join(MASTER_ROOT, 'Bakudan', 'dashboard.bakudanramen.com'),
    path.join(MASTER_ROOT, 'dashboard.bakudanramen.com'),
    MI_CORE_ROOT,
  ];
  return [...new Set(candidates.map(p => path.resolve(p)).filter(p => fs.existsSync(p)))];
}

function walk(root: string, limit: number): string[] {
  const out: string[] = [];
  function visit(dir: string) {
    if (out.length >= limit) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (out.length >= limit) break;
      if (IGNORE_DIRS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (SOURCE_EXT.has(path.extname(entry.name).toLowerCase())) out.push(full);
    }
  }
  visit(root);
  return out;
}

function projectForRoot(root: string): { id: string; name: string } {
  const r = norm(root).toLowerCase();
  if (r.includes('dashboard.bakudanramen.com')) return { id: 'project:dashboard', name: 'Dashboard' };
  if (r.includes('mi-core')) return { id: 'project:mi-core', name: 'Mi-Core' };
  return { id: id('project', root), name: path.basename(root) };
}

function isDashboardSensitive(text: string, absPath: string, projectId: string): boolean {
  if (projectId === 'project:dashboard') return true;
  return /dashboard|DASHBOARD_|dashboard-bakudan|visibility_dashboard|Check Dashboard/i.test(text) ||
    /dashboard/i.test(absPath);
}

function literalArg(node: ts.Node | undefined): string | null {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}

function analyzeSource(root: string, file: string, repositoryId: string): FileFacts {
  const text = fs.readFileSync(file, 'utf8');
  const relPath = safeRel(root, file);
  const project = projectForRoot(root);
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const facts: FileFacts = {
    projectId: project.id,
    projectName: project.name,
    repositoryId,
    fileId: id('file', file),
    absPath: file,
    relPath,
    imports: [],
    classes: [],
    functions: [],
    apis: [],
    impactsDashboard: isDashboardSensitive(text, file, project.id),
  };

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      const moduleName = literalArg(node.moduleSpecifier);
      if (moduleName) facts.imports.push(moduleName);
    } else if (ts.isExportDeclaration(node)) {
      const moduleName = literalArg(node.moduleSpecifier);
      if (moduleName) facts.imports.push(moduleName);
    } else if (ts.isClassDeclaration(node) && node.name?.text) {
      facts.classes.push(node.name.text);
    } else if (ts.isFunctionDeclaration(node) && node.name?.text) {
      facts.functions.push(node.name.text);
    } else if (ts.isVariableStatement(node)) {
      for (const d of node.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))) {
          facts.functions.push(d.name.text);
        }
      }
    } else if (ts.isMethodDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
      facts.functions.push(node.name.text);
    } else if (ts.isCallExpression(node)) {
      const expr = node.expression;
      if (ts.isPropertyAccessExpression(expr)) {
        const method = expr.name.text.toLowerCase();
        const route = literalArg(node.arguments[0]);
        if (route && API_METHODS.has(method) && route.startsWith('/')) {
          facts.apis.push({ method: method.toUpperCase(), route, name: `${method.toUpperCase()} ${route}` });
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);

  facts.imports = [...new Set(facts.imports)].sort();
  facts.classes = [...new Set(facts.classes)].sort();
  facts.functions = [...new Set(facts.functions)].sort();
  facts.apis = facts.apis.filter((api, i, arr) => arr.findIndex(a => a.name === api.name) === i);
  return facts;
}

function upsertFacts(facts: FileFacts) {
  upsertEntity({
    id: facts.fileId,
    name: facts.relPath,
    type: 'file',
    description: `Source file in ${facts.projectName}`,
    metadata: {
      path: facts.absPath,
      relative_path: facts.relPath,
      project_id: facts.projectId,
      impacts_dashboard: facts.impactsDashboard,
      codegraph_source: true,
    },
  });
  upsertEdge({ from_id: facts.repositoryId, to_id: facts.fileId, relationship: 'contains', weight: 4, metadata: { source: 'codegraph' } });
  upsertEdge({ from_id: facts.projectId, to_id: facts.fileId, relationship: 'contains', weight: 4, metadata: { source: 'codegraph' } });

  for (const moduleName of facts.imports) {
    const depId = id('dependency', moduleName);
    upsertEntity({ id: depId, name: moduleName, type: 'dependency', description: `Imported module: ${moduleName}`, metadata: { module: moduleName, source: 'codegraph' } });
    upsertEdge({ from_id: facts.fileId, to_id: depId, relationship: 'imports', weight: 5, metadata: { module: moduleName, source: 'codegraph' } });
  }
  for (const className of facts.classes) {
    const classId = id('class', `${facts.absPath}#${className}`);
    upsertEntity({ id: classId, name: className, type: 'class', description: `Class declared in ${facts.relPath}`, metadata: { file: facts.absPath, project_id: facts.projectId, source: 'codegraph' } });
    upsertEdge({ from_id: facts.fileId, to_id: classId, relationship: 'declares', weight: 6, metadata: { source: 'codegraph' } });
  }
  for (const functionName of facts.functions) {
    const functionId = id('function', `${facts.absPath}#${functionName}`);
    upsertEntity({ id: functionId, name: functionName, type: 'function', description: `Function declared in ${facts.relPath}`, metadata: { file: facts.absPath, project_id: facts.projectId, source: 'codegraph' } });
    upsertEdge({ from_id: facts.fileId, to_id: functionId, relationship: 'declares', weight: 5, metadata: { source: 'codegraph' } });
  }
  for (const api of facts.apis) {
    const apiId = id('api', `${facts.absPath}#${api.name}`);
    upsertEntity({ id: apiId, name: api.name, type: 'api', description: `API route declared in ${facts.relPath}`, metadata: { file: facts.absPath, method: api.method, route: api.route, project_id: facts.projectId, source: 'codegraph' } });
    upsertEdge({ from_id: facts.fileId, to_id: apiId, relationship: 'declares', weight: 7, metadata: { source: 'codegraph' } });
    if (/dashboard/i.test(api.route) || facts.impactsDashboard) {
      upsertEdge({ from_id: apiId, to_id: 'project:dashboard', relationship: 'affects', weight: 7, metadata: { route: api.route, source: 'codegraph' } });
    }
  }
  if (facts.impactsDashboard) {
    upsertEdge({ from_id: facts.fileId, to_id: 'project:dashboard', relationship: 'affects', weight: facts.projectId === 'project:dashboard' ? 10 : 7, metadata: { source: 'codegraph' } });
  }
}

export function syncCodegraph(): CodegraphSummary {
  fs.mkdirSync(CODEGRAPH_CACHE_DIR, { recursive: true });
  if (fs.existsSync(CODEGRAPH_CACHE_FILE) && process.env.CODEGRAPH_FORCE_SYNC !== '1') {
    const stat = fs.statSync(CODEGRAPH_CACHE_FILE);
    if (Date.now() - stat.mtimeMs < CODEGRAPH_CACHE_TTL_MS) {
      return JSON.parse(fs.readFileSync(CODEGRAPH_CACHE_FILE, 'utf8')) as CodegraphSummary;
    }
  }
  const roots = existingRoots();
  const maxFiles = Math.max(50, Number(process.env.CODEGRAPH_MAX_FILES || 350));
  let files = 0;
  let classes = 0;
  let functions = 0;
  let apis = 0;
  const dependencies = new Set<string>();

  for (const root of roots) {
    const project = projectForRoot(root);
    const repositoryId = id('repository', root);
    upsertEntity({ id: repositoryId, name: root, type: 'repository', description: `Repository/source root indexed by codegraph adapter`, metadata: { path: root, source: 'codegraph' } });
    upsertEntity({ id: project.id, name: project.name, type: 'project', description: `${project.name} project codegraph root`, metadata: { codegraph_root: root } });
    upsertEdge({ from_id: repositoryId, to_id: project.id, relationship: 'contains', weight: 5, metadata: { source: 'codegraph' } });

    for (const file of walk(root, maxFiles - files)) {
      const facts = analyzeSource(root, file, repositoryId);
      upsertFacts(facts);
      files += 1;
      classes += facts.classes.length;
      functions += facts.functions.length;
      apis += facts.apis.length;
      facts.imports.forEach(d => dependencies.add(d));
      if (files >= maxFiles) break;
    }
  }

  const summary: CodegraphSummary = {
    status: files ? 'CODEGRAPH_READY' : 'CODEGRAPH_NO_SOURCE',
    generated_at: new Date().toISOString(),
    roots,
    repositories: roots.length,
    files,
    classes,
    functions,
    apis,
    dependencies: dependencies.size,
    cache_path: CODEGRAPH_CACHE_FILE,
    graph_engine: 'enterprise-brain-graph',
  };
  fs.writeFileSync(CODEGRAPH_CACHE_FILE, JSON.stringify(summary, null, 2));
  return summary;
}

function allFileEntities(): Entity[] {
  const db = require('./graph-db') as typeof import('./graph-db');
  return db.findEntities('file');
}

export function getDashboardImpactFiles(limit = 20) {
  syncCodegraph();
  return allFileEntities()
    .filter(e => (e.metadata as any).impacts_dashboard)
    .slice(0, limit)
    .map(e => ({
      file: e.name,
      path: (e.metadata as any).path,
      project_id: (e.metadata as any).project_id,
      reason: (e.metadata as any).project_id === 'project:dashboard' ? 'Dashboard source file' : 'References Dashboard/API visibility path',
    }));
}

function findFileByQuestion(question: string): Entity | null {
  syncCodegraph();
  const quoted = question.match(/[`"']([^`"']+\.(?:ts|tsx|js|jsx|mjs|cjs|html|css))[`"']/i)?.[1];
  const loose = quoted || question.match(/([\w./\\-]+\.(?:ts|tsx|js|jsx|mjs|cjs|html|css))/i)?.[1];
  if (!loose) return null;
  const needle = norm(loose).toLowerCase();
  return allFileEntities().find(e => {
    const p = norm(String((e.metadata as any).path || e.name)).toLowerCase();
    return p.endsWith(needle) || p.includes(needle) || e.name.toLowerCase().includes(needle);
  }) || null;
}

export function analyzeFileImpact(questionOrPath: string) {
  const file = findFileByQuestion(questionOrPath) || allFileEntities().find(e => norm(String((e.metadata as any).path || '')).toLowerCase().includes(norm(questionOrPath).toLowerCase()));
  if (!file) return null;
  const declared = getOutEdges(file.id, 'declares').map(e => getEntity(e.to_id)).filter(Boolean);
  const imports = getOutEdges(file.id, 'imports').map(e => getEntity(e.to_id)).filter(Boolean);
  const affects = getOutEdges(file.id, 'affects').map(e => getEntity(e.to_id)).filter(Boolean);
  const importedBy = getInEdges(file.id, 'imports').map(e => getEntity(e.from_id)).filter(Boolean);
  return {
    file: file.name,
    path: (file.metadata as any).path,
    project_id: (file.metadata as any).project_id,
    affects: affects.map(e => ({ id: e!.id, name: e!.name, type: e!.type })),
    declares: declared.map(e => ({ id: e!.id, name: e!.name, type: e!.type })),
    imports: imports.slice(0, 25).map(e => e!.name),
    imported_by: importedBy.slice(0, 25).map(e => ({ file: e!.name, path: (e!.metadata as any).path })),
    recommended_tests: recommendTestsForFile(String((file.metadata as any).path || file.name), String((file.metadata as any).project_id || '')),
  };
}

export function recommendTestsForFile(filePath: string, projectId = ''): string[] {
  const p = norm(filePath).toLowerCase();
  const tests = new Set<string>();
  if (p.includes('/graph/') || p.includes('\\graph\\')) tests.add('npm --workspace server run build && node tests/phase14-acceptance-test.mjs');
  if (p.includes('/health') || projectId.includes('health')) tests.add('npm --workspace server run build && node tests/phase18-25-acceptance-test.mjs');
  if (p.includes('/routes/') || p.includes('/enterprise-v6/')) tests.add('npm --workspace server run build');
  if (p.includes('dashboard') || projectId === 'project:dashboard') tests.add('Run Dashboard QA connector: GET /api/graph/codegraph/dashboard-impact then Dashboard smoke flow');
  if (!tests.size) tests.add('npm --workspace server run build');
  return [...tests];
}

export function answerCodegraphQuestion(question: string) {
  const q = question.toLowerCase();
  if (/sửa|sua|change|fix|ảnh hưởng gì|anh huong gi|cần test|can test|test gì|test gi/.test(q)) {
    const impact = analyzeFileImpact(question);
    if (impact) {
      return {
        answer: `${impact.file} declares ${impact.declares.length} code node(s), imports ${impact.imports.length} dependency node(s), affects ${impact.affects.map(a => a.name).join(', ') || 'no explicit project edge'}. Recommended tests: ${impact.recommended_tests.join(' | ')}.`,
        evidence: [impact],
        gaps: [],
      };
    }
    if (/dashboard.*connector|connector.*dashboard/.test(q)) {
      const tests = recommendTestsForFile('server/src/visibility/connectors/dashboard.ts', 'project:mi-core');
      return {
        answer: `Sau khi fix Dashboard connector, cần chạy: ${tests.join(' | ')}. Sau đó verify /api/visibility/sync/dashboard-bakudan và /api/visibility/freshness.`,
        evidence: [{ file: 'server/src/visibility/connectors/dashboard.ts', recommended_tests: tests }],
        gaps: [],
      };
    }
  }
  if (/file nào|files?.*dashboard|dashboard.*files?|ảnh hưởng dashboard|anh huong dashboard/.test(q)) {
    const files = getDashboardImpactFiles(12);
    return {
      answer: files.length
        ? `Codegraph tìm thấy ${files.length} file có khả năng ảnh hưởng Dashboard. Top: ${files.slice(0, 5).map(f => f.file).join(', ')}.`
        : 'Codegraph chưa tìm thấy file ảnh hưởng Dashboard trong source roots hiện tại.',
      evidence: files,
      gaps: files.length ? [] : ['No Dashboard source root or Dashboard references found'],
    };
  }
  return null;
}
