import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { buildRepoGraph, type FileNode } from './retrieval/graph';
import type { StructuralRole } from './retrieval/types';
import { resolveWithinWorktree } from './llm/tools';

export interface ImpactNode {
  file: string;
  symbol: string | null;
  role: StructuralRole;
}

export type ImpactEdgeKind = 'imports' | 'calls' | 'returns' | 'consumes' | 'tests' | 'exposes';

export interface ImpactEdge {
  from: ImpactNode;
  to: ImpactNode;
  kind: ImpactEdgeKind;
  evidence: string;
}

export interface ImpactReport {
  changedFiles: string[];
  requiredFiles: string[];
  impactedSymbols: string[];
  impactedConsumers: string[];
  impactedTests: string[];
  riskLevel: 'low' | 'medium' | 'high';
  edges: ImpactEdge[];
  missingRequiredFiles: string[];
  rejectionReasons: string[];
}

export interface AnalyzeImpactInput {
  worktreePath: string;
  candidatePaths: string[];
  plannedFiles: string[];
  changedFiles?: string[];
  affectedSymbols?: string[];
  requireConsumerEdits?: boolean;
}

const SOURCE_FILE = /\.[cm]?[jt]sx?$/;

function normalise(value: string): string {
  return String(value).replace(/\\/g, '/').replace(/^\.\//, '').trim();
}

function nodeOf(file: FileNode, symbol: string | null = null): ImpactNode {
  return { file: file.path, symbol, role: file.role };
}

function symbolNames(file: FileNode): string[] {
  return file.symbols.map(symbol => symbol.symbolName);
}

function readSource(worktreePath: string, relative: string): string {
  const resolved = resolveWithinWorktree(worktreePath, relative);
  if (!resolved.ok || !resolved.absolute || !fs.existsSync(resolved.absolute)) return '';
  try {
    return fs.readFileSync(resolved.absolute, 'utf8');
  } catch {
    return '';
  }
}

function importsFrom(source: string, importedPath: string, importer: FileNode): string[] {
  const names = new Set<string>();
  for (const [binding, target] of Object.entries(importer.importBindings)) {
    if (normalise(target) === importedPath) names.add(binding);
  }
  if (names.size) return [...names];
  const base = path.posix.basename(importedPath).replace(/\.[cm]?[jt]sx?$/, '');
  return base ? [base] : [];
}

function callsImportedSymbol(worktreePath: string, importer: FileNode, importedPath: string, exportedSymbols: string[]): string[] {
  const source = readSource(worktreePath, importer.path);
  if (!source) return [];
  const names = importsFrom(source, importedPath, importer).filter(name => exportedSymbols.includes(name) || exportedSymbols.length === 0);
  if (!names.length) return [];

  const called = new Set<string>();
  let ast: ts.SourceFile | null = null;
  try {
    ast = ts.createSourceFile(importer.path, source, ts.ScriptTarget.Latest, true);
  } catch {
    ast = null;
  }

  if (ast) {
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) {
        const expression = node.expression;
        if (ts.isIdentifier(expression) && names.includes(expression.text)) called.add(expression.text);
        if (ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression) && names.includes(expression.expression.text)) {
          called.add(expression.expression.text);
        }
      }
      node.forEachChild(visit);
    };
    visit(ast);
  }

  for (const name of names) {
    if (new RegExp(`\\b${name}\\b`).test(source)) called.add(name);
  }
  return [...called];
}

function roleRequiresConsumer(file: FileNode): boolean {
  return file.role === 'SERVICE' || file.role === 'TYPE' || file.role === 'MODEL';
}

function addUnique<T>(items: T[], item: T, key: (value: T) => string): void {
  if (!items.some(existing => key(existing) === key(item))) items.push(item);
}

export function analyzeChangeImpact(input: AnalyzeImpactInput): ImpactReport {
  const candidatePaths = [...new Set(input.candidatePaths.map(normalise).filter(path => SOURCE_FILE.test(path)))];
  const graph = buildRepoGraph({ worktreePath: input.worktreePath, filePaths: candidatePaths });
  const planned = new Set(input.plannedFiles.map(normalise));
  const changed = [...new Set((input.changedFiles ?? input.plannedFiles).map(normalise))];
  const changedSet = new Set(changed);
  const edges: ImpactEdge[] = [];
  const impactedConsumers = new Set<string>();
  const impactedTests = new Set<string>();
  const impactedSymbols = new Set(input.affectedSymbols ?? []);
  const requiredFiles = new Set<string>();

  const registerConsumer = (producer: FileNode, consumer: FileNode, kind: ImpactEdgeKind, evidence: string): void => {
    const edge: ImpactEdge = { from: nodeOf(producer), to: nodeOf(consumer), kind, evidence };
    addUnique(edges, edge, item => `${item.from.file}->${item.to.file}:${item.kind}:${item.evidence}`);
    if (consumer.isTest) impactedTests.add(consumer.path);
    else impactedConsumers.add(consumer.path);
  };

  for (const changedPath of changed) {
    const file = graph.files.get(changedPath);
    if (!file) continue;
    for (const symbol of symbolNames(file)) impactedSymbols.add(symbol);

    const exported = symbolNames(file);
    for (const importerPath of file.importedBy) {
      const importer = graph.files.get(importerPath);
      if (!importer) continue;
      const calls = callsImportedSymbol(input.worktreePath, importer, file.path, exported);
      const kind: ImpactEdgeKind = importer.isTest ? 'tests' : calls.length ? 'calls' : 'consumes';
      registerConsumer(file, importer, kind, calls.length ? `uses ${calls.join(', ')}` : `imports ${file.path}`);

      if (file.role === 'TYPE' || file.role === 'MODEL' || file.role === 'SERVICE') {
        requiredFiles.add(importer.path);
      }
    }

    if (file.routes.length) {
      for (const route of file.routes) {
        for (const test of graph.files.values()) {
          if (!test.isTest) continue;
          const source = readSource(input.worktreePath, test.path);
          if (!source) continue;
          if (source.includes(route.routePath) || source.includes(route.fullPath) || test.imports.includes(file.path)) {
            registerConsumer(file, test, 'tests', `covers route ${route.fullPath}`);
            impactedTests.add(test.path);
          }
        }
      }
    }
  }

  for (const consumerPath of [...impactedConsumers]) {
    const consumer = graph.files.get(consumerPath);
    if (!consumer) continue;
    if (consumer.role === 'ROUTE' || consumer.role === 'CONTROLLER') requiredFiles.add(consumer.path);
    for (const importerPath of consumer.importedBy) {
      const importer = graph.files.get(importerPath);
      if (!importer?.isTest) continue;
      registerConsumer(consumer, importer, 'tests', `tests impacted consumer ${consumer.path}`);
      impactedTests.add(importer.path);
    }
  }

  for (const testPath of impactedTests) requiredFiles.add(testPath);

  const missingRequiredFiles = [...requiredFiles].filter(file => {
    const node = graph.files.get(file);
    if (!node) return false;
    if (node.isTest) return !planned.has(file);
    return input.requireConsumerEdits ? !changedSet.has(file) : !planned.has(file);
  });

  const rejectionReasons: string[] = [];
  if (input.requireConsumerEdits) {
    const missingConsumers = missingRequiredFiles.filter(file => !graph.files.get(file)?.isTest);
    if (missingConsumers.length) {
      rejectionReasons.push(`producer changed while required consumer ignored: ${missingConsumers.join(', ')}`);
    }
  }
  const ignoredTests = missingRequiredFiles.filter(file => graph.files.get(file)?.isTest);
  if (ignoredTests.length) rejectionReasons.push(`impacted tests are missing from the plan: ${ignoredTests.join(', ')}`);

  const producerNeedingConsumers = changed
    .map(file => graph.files.get(file))
    .filter((file): file is FileNode => file !== undefined && roleRequiresConsumer(file));
  if (producerNeedingConsumers.length && impactedConsumers.size === 0 && input.requireConsumerEdits) {
    rejectionReasons.push(`producer files have no consumer analysis: ${producerNeedingConsumers.map(file => file.path).join(', ')}`);
  }

  const riskLevel: ImpactReport['riskLevel'] =
    impactedConsumers.size >= 2 || requiredFiles.size >= 4 ? 'high' :
      impactedConsumers.size || impactedTests.size ? 'medium' : 'low';

  return {
    changedFiles: changed,
    requiredFiles: [...requiredFiles],
    impactedSymbols: [...impactedSymbols],
    impactedConsumers: [...impactedConsumers],
    impactedTests: [...impactedTests],
    riskLevel,
    edges,
    missingRequiredFiles,
    rejectionReasons,
  };
}
