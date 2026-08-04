/**
 * Symbol-level context extraction.
 *
 * Handing a model whole files answers "what does this code look like" but not
 * "what members does this type actually have". A local model given
 * `routes/coding.ts` will happily write `task.engineId` because the request said
 * "engine id" — it never saw that `TaskRecord` declares `codingEngine`. Dumping
 * the defining file too would cost thousands of tokens to convey one field list.
 *
 * This extracts compact symbol summaries instead: exported interfaces, type
 * aliases, classes, enums and function signatures, with their member names and
 * types, resolved across import edges.
 *
 * Nothing here is aware of any particular type, file or task. It is driven
 * entirely by what the candidate files import and what the compiler complains
 * about.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { isBinaryPath, resolveWithinWorktree } from './tools';

export type SymbolKind = 'interface' | 'type' | 'class' | 'function' | 'enum' | 'const';

export interface SymbolMember {
  name: string;
  type: string;
  optional: boolean;
  /** Method/property distinction helps a model call things correctly. */
  kind: 'property' | 'method';
}

export interface SymbolSummary {
  symbolName: string;
  kind: SymbolKind;
  /** Repo-relative path of the file declaring the symbol. */
  sourcePath: string;
  signature: string;
  members: SymbolMember[];
  /** Repo-relative candidate files that import or declare this symbol. */
  importedBy: string[];
  relevanceReason: string;
  bytes: number;
}

export interface SymbolContextLimits {
  maxSymbols: number;
  maxBytes: number;
  maxMembersPerSymbol: number;
}

export const DEFAULT_SYMBOL_LIMITS: SymbolContextLimits = {
  maxSymbols: 24,
  maxBytes: 16 * 1024,
  maxMembersPerSymbol: 60,
};

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];
const MAX_PARSE_BYTES = 512 * 1024;

/** Values that look like credentials are never surfaced in a symbol summary. */
const SECRET_VALUE = /(sk-[A-Za-z0-9_-]{8,}|gh[pousr]_[A-Za-z0-9]{8,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|AKIA[0-9A-Z]{12,})/;
const SECRET_NAME = /(api[_-]?key|secret|password|passwd|token|credential|private[_-]?key)/i;

function truncate(value: string, max = 200): string {
  const flat = value.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

/** Redacts a type/initialiser that carries what looks like a real credential. */
function safeType(name: string, typeText: string): string {
  if (SECRET_VALUE.test(typeText)) return '<redacted>';
  if (SECRET_NAME.test(name) && /['"][^'"]{12,}['"]/.test(typeText)) return '<redacted>';
  return truncate(typeText, 120);
}

function parseSource(absolutePath: string, text: string): ts.SourceFile | null {
  try {
    return ts.createSourceFile(absolutePath, text, ts.ScriptTarget.Latest, true);
  } catch {
    // Malformed source must degrade to "no symbols", never throw into the engine.
    return null;
  }
}

function readIfSource(absolutePath: string): string | null {
  try {
    const stat = fs.statSync(absolutePath);
    if (!stat.isFile() || stat.size > MAX_PARSE_BYTES) return null;
    return fs.readFileSync(absolutePath, 'utf8');
  } catch {
    return null;
  }
}

function isExported(node: ts.Node): boolean {
  const modifiers = (node as { modifiers?: ts.NodeArray<ts.ModifierLike> }).modifiers;
  return Boolean(modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword));
}

function memberFrom(member: ts.TypeElement | ts.ClassElement, limits: SymbolContextLimits): SymbolMember | null {
  const nameNode = (member as { name?: ts.PropertyName }).name;
  if (!nameNode) return null;
  const name = nameNode.getText?.() ?? String((nameNode as ts.Identifier).escapedText ?? '');
  if (!name) return null;

  if (ts.isPropertySignature(member) || ts.isPropertyDeclaration(member)) {
    const typeText = member.type?.getText?.() ?? 'unknown';
    return { name, type: safeType(name, typeText), optional: Boolean(member.questionToken), kind: 'property' };
  }
  if (ts.isMethodSignature(member) || ts.isMethodDeclaration(member)) {
    const params = member.parameters.map(p => p.getText?.() ?? '').join(', ');
    const returns = member.type?.getText?.() ?? 'void';
    return { name, type: safeType(name, `(${params}) => ${returns}`), optional: Boolean(member.questionToken), kind: 'method' };
  }
  return null;
}

/** Extracts every exported symbol declared in one source file. */
export function extractSymbols(relativePath: string, absolutePath: string, limits = DEFAULT_SYMBOL_LIMITS): SymbolSummary[] {
  const text = readIfSource(absolutePath);
  if (text === null) return [];
  const source = parseSource(absolutePath, text);
  if (!source) return [];

  const out: SymbolSummary[] = [];
  const push = (
    symbolName: string,
    kind: SymbolKind,
    signature: string,
    members: SymbolMember[]
  ) => {
    if (!symbolName) return;
    const capped = members.slice(0, limits.maxMembersPerSymbol);
    const summary: SymbolSummary = {
      symbolName,
      kind,
      sourcePath: relativePath,
      signature: truncate(signature, 220),
      members: capped,
      importedBy: [],
      relevanceReason: '',
      bytes: 0,
    };
    summary.bytes = Buffer.byteLength(renderSymbol(summary), 'utf8');
    out.push(summary);
  };

  for (const statement of source.statements) {
    if (!isExported(statement)) continue;

    if (ts.isInterfaceDeclaration(statement)) {
      const members = statement.members.map(m => memberFrom(m, limits)).filter((m): m is SymbolMember => !!m);
      push(statement.name.text, 'interface', `interface ${statement.name.text}`, members);
    } else if (ts.isTypeAliasDeclaration(statement)) {
      const alias = statement.type;
      const members = ts.isTypeLiteralNode(alias)
        ? alias.members.map(m => memberFrom(m, limits)).filter((m): m is SymbolMember => !!m)
        : [];
      push(statement.name.text, 'type', `type ${statement.name.text} = ${alias.getText?.() ?? ''}`, members);
    } else if (ts.isClassDeclaration(statement) && statement.name) {
      const isPrivate = (member: ts.ClassElement): boolean => {
        const modifiers = (member as { modifiers?: ts.NodeArray<ts.ModifierLike> }).modifiers;
        return Boolean(modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.PrivateKeyword));
      };
      const members = statement.members
        .filter(member => !isPrivate(member))
        .map(member => memberFrom(member, limits))
        .filter((m): m is SymbolMember => !!m);
      push(statement.name.text, 'class', `class ${statement.name.text}`, members);
    } else if (ts.isEnumDeclaration(statement)) {
      const members = statement.members.map(m => ({
        name: m.name.getText?.() ?? '',
        type: safeType('', m.initializer?.getText?.() ?? ''),
        optional: false,
        kind: 'property' as const,
      }));
      push(statement.name.text, 'enum', `enum ${statement.name.text}`, members);
    } else if (ts.isFunctionDeclaration(statement) && statement.name) {
      const params = statement.parameters.map(p => p.getText?.() ?? '').join(', ');
      const returns = statement.type?.getText?.() ?? '';
      push(statement.name.text, 'function', `function ${statement.name.text}(${params})${returns ? `: ${returns}` : ''}`, []);
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        const name = declaration.name.getText?.() ?? '';
        const typeText = declaration.type?.getText?.() ?? declaration.initializer?.getText?.() ?? '';
        push(name, 'const', `const ${name}${typeText ? `: ${safeType(name, typeText)}` : ''}`, []);
      }
    }
  }
  return out;
}

export interface ImportEdge {
  /** Symbol names pulled in from the module. */
  names: string[];
  moduleSpecifier: string;
  /** Repo-relative path the specifier resolved to, when local and inside the worktree. */
  resolvedPath: string | null;
}

/** Resolves a relative module specifier to a file inside the worktree. */
export function resolveModule(worktreePath: string, fromRelative: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;
  const baseDir = path.posix.dirname(fromRelative.replace(/\\/g, '/'));
  const joined = path.posix.normalize(path.posix.join(baseDir, specifier));

  const candidates = [
    joined,
    ...SOURCE_EXTENSIONS.map(ext => `${joined.replace(/\.[cm]?[jt]sx?$/, '')}${ext}`),
    ...SOURCE_EXTENSIONS.map(ext => `${joined}/index${ext}`),
  ];

  for (const candidate of candidates) {
    if (isBinaryPath(candidate)) continue;
    const resolved = resolveWithinWorktree(worktreePath, candidate);
    if (!resolved.ok) continue;
    try {
      if (fs.statSync(resolved.absolute!).isFile()) return resolved.relative!;
    } catch {
      // keep looking
    }
  }
  return null;
}

/** Reads the import edges of one file. */
export function extractImports(worktreePath: string, relativePath: string): ImportEdge[] {
  const resolved = resolveWithinWorktree(worktreePath, relativePath);
  if (!resolved.ok) return [];
  const text = readIfSource(resolved.absolute!);
  if (text === null) return [];
  const source = parseSource(resolved.absolute!, text);
  if (!source) return [];

  const edges: ImportEdge[] = [];
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const specifier = statement.moduleSpecifier.text;

    const names: string[] = [];
    const clause = statement.importClause;
    if (clause?.name) names.push(clause.name.text);
    if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) names.push(element.name.text);
    }
    edges.push({ names, moduleSpecifier: specifier, resolvedPath: resolveModule(worktreePath, relativePath, specifier) });
  }

  // CommonJS `require` is common in the fixtures and in older Mi code.
  for (const match of text.matchAll(/require\(\s*['"](\.[^'"]+)['"]\s*\)/g)) {
    const specifier = match[1];
    edges.push({ names: [], moduleSpecifier: specifier, resolvedPath: resolveModule(worktreePath, relativePath, specifier) });
  }
  return edges;
}

export interface BuildSymbolContextInput {
  worktreePath: string;
  /** Repo-relative candidate files the engine is working from. */
  candidatePaths: string[];
  /** Tokens from the user request, used to score relevance. */
  requestHints: string[];
  /** Symbol and member names named by compiler errors, if any. */
  errorSymbols?: string[];
  errorMembers?: string[];
  limits?: SymbolContextLimits;
}

/**
 * Builds the symbol context for a task: symbols declared by the candidates,
 * plus the definitions of everything the candidates import. Selection is capped
 * and every inclusion records why it happened.
 */
export function buildSymbolContext(input: BuildSymbolContextInput): SymbolSummary[] {
  const limits = input.limits ?? DEFAULT_SYMBOL_LIMITS;
  const byKey = new Map<string, SymbolSummary>();
  const errorSymbols = new Set((input.errorSymbols ?? []).map(s => s.toLowerCase()));
  const errorMembers = new Set((input.errorMembers ?? []).map(s => s.toLowerCase()));
  const hints = input.requestHints.map(h => h.toLowerCase());

  const add = (summary: SymbolSummary, importedBy: string, reason: string) => {
    const key = `${summary.sourcePath}#${summary.symbolName}`;
    const existing = byKey.get(key);
    if (existing) {
      if (!existing.importedBy.includes(importedBy)) existing.importedBy.push(importedBy);
      return;
    }
    summary.importedBy = [importedBy];
    summary.relevanceReason = reason;
    byKey.set(key, summary);
  };

  for (const candidatePath of input.candidatePaths) {
    const resolvedCandidate = resolveWithinWorktree(input.worktreePath, candidatePath);
    if (!resolvedCandidate.ok) continue;

    // Symbols the candidate declares itself.
    for (const summary of extractSymbols(candidatePath, resolvedCandidate.absolute!, limits)) {
      add(summary, candidatePath, 'declared in a candidate file');
    }

    // Symbols the candidate imports, resolved to their defining file.
    for (const edge of extractImports(input.worktreePath, candidatePath)) {
      if (!edge.resolvedPath) continue;
      const resolvedModule = resolveWithinWorktree(input.worktreePath, edge.resolvedPath);
      if (!resolvedModule.ok) continue;

      const declared = extractSymbols(edge.resolvedPath, resolvedModule.absolute!, limits);
      const wanted = new Set(edge.names);
      for (const summary of declared) {
        const importedByName = wanted.has(summary.symbolName);
        const namedByError = errorSymbols.has(summary.symbolName.toLowerCase());
        const declaresErrorMember =
          errorMembers.size > 0 && summary.members.some(m => errorMembers.has(m.name.toLowerCase()));
        if (!importedByName && !namedByError && !declaresErrorMember) continue;

        const reason = namedByError || declaresErrorMember
          ? 'named by a compiler error'
          : `imported by ${candidatePath}`;
        add(summary, candidatePath, reason);
      }
    }
  }

  // Second hop: types named in the signatures of symbols already included.
  //
  // A candidate that imports `TaskStore` never imports `TaskRecord`, yet
  // `store.getTask()` returns one — so the type whose members the model most
  // needs is exactly the one a single import hop cannot reach. Depth is capped
  // at one: that covers "the type this API hands me" without walking the whole
  // type graph.
  const firstPass = [...byKey.values()];
  const referenced = new Set<string>();
  for (const summary of firstPass) {
    const surface = [summary.signature, ...summary.members.map(member => member.type)].join(' ');
    for (const match of surface.matchAll(/\b([A-Z][A-Za-z0-9_]{2,})\b/g)) referenced.add(match[1]);
  }
  for (const summary of firstPass) referenced.delete(summary.symbolName);

  if (referenced.size) {
    const sourceFiles = new Set(firstPass.map(summary => summary.sourcePath));
    for (const sourcePath of sourceFiles) {
      // Look through the declaring file's own imports for those type names.
      for (const edge of extractImports(input.worktreePath, sourcePath)) {
        if (!edge.resolvedPath) continue;
        const resolvedModule = resolveWithinWorktree(input.worktreePath, edge.resolvedPath);
        if (!resolvedModule.ok) continue;
        for (const summary of extractSymbols(edge.resolvedPath, resolvedModule.absolute!, limits)) {
          if (!referenced.has(summary.symbolName)) continue;
          add(summary, sourcePath, `referenced by the API of ${sourcePath}`);
        }
      }
    }
  }

  // Rank: compiler errors first, then request-hint matches, then the rest.
  const score = (summary: SymbolSummary): number => {
    let value = 0;
    if (summary.relevanceReason === 'named by a compiler error') value += 100;
    const lower = summary.symbolName.toLowerCase();
    if (hints.some(hint => lower.includes(hint) || hint.includes(lower))) value += 10;
    if (summary.members.length) value += 2;
    return value;
  };

  const ranked = [...byKey.values()].sort((a, b) => score(b) - score(a) || a.symbolName.localeCompare(b.symbolName));

  const chosen: SymbolSummary[] = [];
  let bytes = 0;
  for (const summary of ranked) {
    if (chosen.length >= limits.maxSymbols) break;
    if (bytes + summary.bytes > limits.maxBytes) continue;
    chosen.push(summary);
    bytes += summary.bytes;
  }
  return chosen;
}

/** Compact, token-cheap rendering of one symbol. */
export function renderSymbol(summary: SymbolSummary): string {
  const header = `${summary.signature}   // ${summary.sourcePath}`;
  if (!summary.members.length) return header;
  const members = summary.members
    .map(member => `  ${member.name}${member.optional ? '?' : ''}: ${member.type}`)
    .join('\n');
  return `${header}\n${members}`;
}

export function renderSymbolContext(symbols: SymbolSummary[]): string {
  if (!symbols.length) return '';
  return symbols.map(renderSymbol).join('\n\n');
}

/**
 * Pulls symbol and member names out of compiler diagnostics.
 *
 * Handles the shapes that actually matter in practice: a missing property on a
 * type, a symbol declared but not exported, a bad import, and an incompatible
 * assignment.
 */
export function symbolsFromCompilerErrors(output: string): { symbols: string[]; members: string[] } {
  const symbols = new Set<string>();
  const members = new Set<string>();
  if (!output) return { symbols: [], members: [] };

  // TS2339: Property 'x' does not exist on type 'Y'.
  for (const match of output.matchAll(/Property '([^']+)' does not exist on type '([^']+)'/g)) {
    members.add(match[1]);
    symbols.add(match[2].replace(/[\[\]<>|&(). ]/g, ' ').trim().split(/\s+/)[0] ?? match[2]);
  }
  // TS2459: Module '"x"' declares 'Y' locally, but it is not exported.
  for (const match of output.matchAll(/declares '([^']+)' locally, but it is not exported/g)) {
    symbols.add(match[1]);
  }
  // TS2305 / TS2724: Module '"x"' has no exported member 'Y'.
  for (const match of output.matchAll(/has no exported member '([^']+)'/g)) {
    symbols.add(match[1]);
  }
  // TS2551: Property 'x' does not exist ... Did you mean 'y'?
  for (const match of output.matchAll(/Did you mean '([^']+)'/g)) {
    members.add(match[1]);
  }
  // TS2322/TS2345: Type 'A' is not assignable to type 'B'.
  for (const match of output.matchAll(/[Tt]ype '([^']+)' is not assignable to (?:parameter of )?type '([^']+)'/g)) {
    for (const raw of [match[1], match[2]]) {
      const name = raw.replace(/[\[\]<>|&(). ]/g, ' ').trim().split(/\s+/)[0];
      if (name && /^[A-Z]/.test(name)) symbols.add(name);
    }
  }
  // Cannot find name 'X'.
  for (const match of output.matchAll(/Cannot find name '([^']+)'/g)) {
    symbols.add(match[1]);
  }

  return {
    symbols: [...symbols].filter(name => /^[A-Za-z_$][\w$]*$/.test(name)),
    members: [...members].filter(name => /^[A-Za-z_$][\w$]*$/.test(name)),
  };
}

/**
 * Whether a symbol declares a member.
 *
 * Returns `null` when the symbol is not in context, which means "no opinion" —
 * the gate must not reject a plan on the basis of a type it never saw.
 *
 * This is deliberately a check against the *plan's* declared target rather than
 * a scan of patch text. Scanning a diff for `x.y` accesses cannot distinguish a
 * field on a known type from `array.map`, so it either floods with false
 * positives or is tuned per-type — and tuning per-type is exactly the
 * task-specific logic this phase forbids.
 */
export function memberExists(symbols: SymbolSummary[], symbolName: string, memberName: string): boolean | null {
  const summary = symbols.find(item => item.symbolName === symbolName);
  if (!summary || !summary.members.length) return null;
  return summary.members.some(member => member.name === memberName);
}

/** Member names the given symbol declares, for a corrective error message. */
export function membersOf(symbols: SymbolSummary[], symbolName: string): string[] {
  return symbols.find(item => item.symbolName === symbolName)?.members.map(member => member.name) ?? [];
}

/**
 * Whether the request is asking to introduce new API surface, in which case a
 * member absent from the current type is the point of the task rather than a
 * mistake.
 */
export function requestAddsNewMember(userRequest: string): boolean {
  return /\b(add|introduce|create|new|extend|expose|support)\b/i.test(userRequest);
}
