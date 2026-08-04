/**
 * Compiler diagnostic contract for type repair.
 *
 * The previous strategy handed the model the whole file and the raw compiler
 * output and asked for a patch. It produced well-formed patches that did not
 * address the diagnostic, because nothing connected the error to the exact
 * expression that caused it.
 *
 * This parses diagnostics into structured records and builds a focused context:
 * the failing line, its containing function, and the type definitions the error
 * names. The model is then asked for one minimal correction per diagnostic
 * rather than a free-form rewrite.
 *
 * Nothing here knows any particular type, file or error instance.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { resolveWithinWorktree } from '../llm/tools';
import { buildSymbolContext, renderSymbolContext, type SymbolSummary } from '../llm/symbols';

export interface CompilerDiagnostic {
  /** Repo-relative path, normalised to forward slashes. */
  file: string;
  line: number;
  column: number;
  code: string;
  message: string;
  /** Type or symbol names the message references. */
  symbols: string[];
  /** Member names the message references. */
  members: string[];
  expectedType: string | null;
  actualType: string | null;
}

export interface DiagnosticFocus {
  diagnostic: CompilerDiagnostic;
  /** The offending line, verbatim. */
  failingLine: string;
  /** The enclosing function or block, bounded. */
  enclosingSource: string;
  enclosingName: string | null;
  startLine: number;
  endLine: number;
}

export interface DiagnosticRepairContext {
  diagnostics: CompilerDiagnostic[];
  focuses: DiagnosticFocus[];
  symbols: SymbolSummary[];
  /** Files the diagnostics point at. */
  files: string[];
}

/** `src/pricing.ts(23,45): error TS2339: Property 'x' does not exist on type 'Y'.` */
const DIAGNOSTIC_LINE = /^(.+?)[(](\d+),(\d+)[)]:\s*error\s+(TS\d+):\s*(.+)$/;
/** `src/pricing.ts:23:45 - error TS2339: ...` (pretty format) */
const DIAGNOSTIC_LINE_ALT = /^(.+?):(\d+):(\d+)\s*-\s*error\s+(TS\d+):\s*(.+)$/;

function extractQuoted(message: string): string[] {
  return [...message.matchAll(/'([^']+)'/g)].map(match => match[1]);
}

function classifyQuoted(message: string): { symbols: string[]; members: string[]; expectedType: string | null; actualType: string | null } {
  const symbols = new Set<string>();
  const members = new Set<string>();
  let expectedType: string | null = null;
  let actualType: string | null = null;

  for (const match of message.matchAll(/Property '([^']+)' does not exist on type '([^']+)'/g)) {
    members.add(match[1]);
    symbols.add(match[2]);
  }
  for (const match of message.matchAll(/Object literal may only specify known properties, and '([^']+)' does not exist in type '([^']+)'/g)) {
    members.add(match[1]);
    symbols.add(match[2]);
  }
  for (const match of message.matchAll(/[Tt]ype '([^']+)' is not assignable to (?:parameter of )?type '([^']+)'/g)) {
    actualType = match[1];
    expectedType = match[2];
  }
  for (const match of message.matchAll(/Argument of type '([^']+)' is not assignable to parameter of type '([^']+)'/g)) {
    actualType = match[1];
    expectedType = match[2];
  }
  for (const match of message.matchAll(/declares '([^']+)' locally, but it is not exported/g)) symbols.add(match[1]);
  for (const match of message.matchAll(/has no exported member '([^']+)'/g)) symbols.add(match[1]);

  // Anything else quoted and identifier-shaped is a plausible symbol.
  for (const quoted of extractQuoted(message)) {
    const bare = quoted.replace(/[\[\]<>|&()., ]/g, ' ').trim().split(/\s+/)[0] ?? '';
    if (/^[A-Z][A-Za-z0-9_]*$/.test(bare)) symbols.add(bare);
  }

  return {
    symbols: [...symbols].filter(name => /^[A-Za-z_$][\w$]*$/.test(name)),
    members: [...members].filter(name => /^[A-Za-z_$][\w$]*$/.test(name)),
    expectedType,
    actualType,
  };
}

/** Parses `tsc` output into structured diagnostics. */
export function parseDiagnostics(compilerOutput: string, worktreePath: string): CompilerDiagnostic[] {
  const out: CompilerDiagnostic[] = [];
  if (!compilerOutput) return out;

  for (const rawLine of compilerOutput.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = DIAGNOSTIC_LINE.exec(line) ?? DIAGNOSTIC_LINE_ALT.exec(line);
    if (!match) continue;

    const [, rawFile, lineNo, columnNo, code, message] = match;
    // tsc reports relative to its own cwd, which may be a subdirectory.
    const normalized = rawFile.replace(/\\/g, '/').replace(/^\.\//, '');
    const classified = classifyQuoted(message);

    out.push({
      file: normalized,
      line: Number(lineNo),
      column: Number(columnNo),
      code,
      message: message.trim(),
      ...classified,
    });
  }

  // De-duplicate identical diagnostics; tsc repeats them across projects.
  const seen = new Set<string>();
  return out.filter(diagnostic => {
    const key = `${diagnostic.file}:${diagnostic.line}:${diagnostic.column}:${diagnostic.code}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Resolves a diagnostic path against the worktree, tolerating the compiler
 * running from a subdirectory (its paths are relative to its own cwd).
 */
function resolveDiagnosticFile(worktreePath: string, file: string, searchRoots: string[]): { relative: string; absolute: string } | null {
  const attempts = [file, ...searchRoots.map(root => path.posix.join(root, file))];
  for (const attempt of attempts) {
    const resolved = resolveWithinWorktree(worktreePath, attempt);
    if (resolved.ok && fs.existsSync(resolved.absolute!)) {
      return { relative: resolved.relative!, absolute: resolved.absolute! };
    }
  }
  return null;
}

/**
 * Finds the declaration enclosing a line.
 *
 * Prefers the smallest *named* declaration. The genuinely smallest node is
 * often an anonymous callback — a `.filter((x) => ...)` on the failing line —
 * which is true but useless: it names nothing the model can orient by, and its
 * one-line range hides the signature that explains the type.
 */
function enclosingRange(source: ts.SourceFile, targetLine: number): { start: number; end: number; name: string | null } {
  let smallest: { start: number; end: number; name: string | null } | null = null;
  let smallestNamed: { start: number; end: number; name: string } | null = null;

  const visit = (node: ts.Node): void => {
    const start = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
    const end = source.getLineAndCharacterOfPosition(node.getEnd()).line + 1;
    const isDeclaration =
      ts.isFunctionDeclaration(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isArrowFunction(node) ||
      ts.isFunctionExpression(node) ||
      ts.isClassDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isVariableStatement(node);

    if (isDeclaration && start <= targetLine && targetLine <= end) {
      const rawName = (node as { name?: ts.Node }).name?.getText?.() ?? null;
      if (!smallest || end - start < smallest.end - smallest.start) {
        smallest = { start, end, name: rawName };
      }
      if (rawName && (!smallestNamed || end - start < smallestNamed.end - smallestNamed.start)) {
        smallestNamed = { start, end, name: rawName };
      }
    }
    node.forEachChild(visit);
  };
  visit(source);

  if (smallestNamed) return smallestNamed;
  if (smallest) return smallest;
  return { start: Math.max(1, targetLine - 6), end: targetLine + 6, name: null };
}

export interface BuildRepairContextInput {
  worktreePath: string;
  compilerOutput: string;
  /** Directories the compiler may have run from, e.g. ['', 'server']. */
  searchRoots?: string[];
  maxDiagnostics?: number;
  maxEnclosingLines?: number;
}

export function buildDiagnosticRepairContext(input: BuildRepairContextInput): DiagnosticRepairContext {
  const searchRoots = input.searchRoots ?? ['', 'server'];
  const maxDiagnostics = input.maxDiagnostics ?? 8;
  const maxEnclosingLines = input.maxEnclosingLines ?? 60;

  const diagnostics = parseDiagnostics(input.compilerOutput, input.worktreePath).slice(0, maxDiagnostics);
  const focuses: DiagnosticFocus[] = [];
  const files = new Set<string>();

  for (const diagnostic of diagnostics) {
    const resolved = resolveDiagnosticFile(input.worktreePath, diagnostic.file, searchRoots);
    if (!resolved) continue;
    diagnostic.file = resolved.relative;
    files.add(resolved.relative);

    let text: string;
    try {
      text = fs.readFileSync(resolved.absolute, 'utf8');
    } catch {
      continue;
    }

    const lines = text.split(/\r?\n/);
    const failingLine = lines[diagnostic.line - 1] ?? '';

    let range: { start: number; end: number; name: string | null };
    try {
      const source = ts.createSourceFile(resolved.absolute, text, ts.ScriptTarget.Latest, true);
      range = enclosingRange(source, diagnostic.line);
    } catch {
      range = { start: Math.max(1, diagnostic.line - 6), end: diagnostic.line + 6, name: null };
    }

    // Keep the excerpt bounded; a huge enclosing class defeats the purpose.
    if (range.end - range.start > maxEnclosingLines) {
      range = {
        start: Math.max(range.start, diagnostic.line - Math.floor(maxEnclosingLines / 2)),
        end: Math.min(range.end, diagnostic.line + Math.floor(maxEnclosingLines / 2)),
        name: range.name,
      };
    }

    focuses.push({
      diagnostic,
      failingLine,
      enclosingName: range.name,
      startLine: range.start,
      endLine: range.end,
      enclosingSource: lines
        .slice(range.start - 1, range.end)
        .map((content, index) => `${String(range.start + index).padStart(4)} | ${content}`)
        .join('\n'),
    });
  }

  // Type definitions the diagnostics name, resolved through the import graph.
  const symbols = files.size
    ? buildSymbolContext({
        worktreePath: input.worktreePath,
        candidatePaths: [...files],
        requestHints: [],
        errorSymbols: diagnostics.flatMap(diagnostic => diagnostic.symbols),
        errorMembers: diagnostics.flatMap(diagnostic => diagnostic.members),
      })
    : [];

  return { diagnostics, focuses, symbols, files: [...files] };
}

/** Renders the focused repair context for the prompt. */
export function renderDiagnosticContext(context: DiagnosticRepairContext): string {
  if (!context.focuses.length) return '';

  const blocks = context.focuses.map((focus, index) => {
    const { diagnostic } = focus;
    return [
      `DIAGNOSTIC ${index + 1} — ${diagnostic.code} at ${diagnostic.file}:${diagnostic.line}:${diagnostic.column}`,
      `  ${diagnostic.message}`,
      diagnostic.expectedType ? `  expected type: ${diagnostic.expectedType}` : '',
      diagnostic.actualType ? `  actual type:   ${diagnostic.actualType}` : '',
      `  failing line:  ${focus.failingLine.trim()}`,
      focus.enclosingName ? `  inside:        ${focus.enclosingName}` : '',
      '',
      `  CONTAINING CODE (${focus.startLine}-${focus.endLine}):`,
      focus.enclosingSource,
    ]
      .filter(Boolean)
      .join('\n');
  });

  const symbolBlock = context.symbols.length
    ? `\n\nTYPE DEFINITIONS NAMED BY THESE DIAGNOSTICS:\n${renderSymbolContext(context.symbols)}`
    : '';

  return `${blocks.join('\n\n')}${symbolBlock}`;
}

/** Patterns a type-repair patch must never use to silence a diagnostic. */
const FORBIDDEN_SUPPRESSIONS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /@ts-ignore|@ts-expect-error|@ts-nocheck/, reason: 'suppresses the diagnostic instead of fixing it' },
  { pattern: /\bas\s+any\b/, reason: 'casts to any instead of fixing the type' },
  { pattern: /:\s*any\b/, reason: 'annotates as any instead of fixing the type' },
  { pattern: /\bas\s+unknown\s+as\b/, reason: 'double cast bypasses the type system' },
  { pattern: /<any>/, reason: 'casts to any instead of fixing the type' },
];

export interface SuppressionCheck {
  ok: boolean;
  violations: string[];
}

/**
 * Rejects a type-repair patch that silences the compiler rather than fixing it.
 * Only new content is inspected, so pre-existing `any` in a file is not blamed
 * on this change.
 */
export function checkNoSuppression(addedText: string): SuppressionCheck {
  const violations: string[] = [];
  for (const { pattern, reason } of FORBIDDEN_SUPPRESSIONS) {
    if (pattern.test(addedText)) violations.push(`${pattern.source}: ${reason}`);
  }
  return { ok: violations.length === 0, violations };
}

/** True when the diagnostic set changed, used to detect a no-op repair. */
export function diagnosticsSignature(diagnostics: CompilerDiagnostic[]): string {
  return diagnostics
    .map(diagnostic => `${diagnostic.file}:${diagnostic.line}:${diagnostic.code}`)
    .sort()
    .join('|');
}
