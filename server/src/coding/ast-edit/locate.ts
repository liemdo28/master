/**
 * AST location and validation.
 *
 * Every operation resolves its target here before anything is written, so an
 * invalid operation is refused rather than half-applied. The rules are the same
 * boundary rules the rest of the engine uses: inside the worktree, inside the
 * approved candidate set, never a generated file.
 */

import * as fs from 'fs';
import * as ts from 'typescript';
import { isGeneratedPath } from '../retrieval/graph';
import { resolveWithinWorktree } from '../llm/tools';
import { EditOperationError, type SourceLocation } from './types';

export interface LoadedFile {
  relative: string;
  absolute: string;
  text: string;
  source: ts.SourceFile;
  /** True when the file uses CRLF, so edits can restore it. */
  crlf: boolean;
}

export interface LoadOptions {
  worktreePath: string;
  /** Repo-relative paths the operation may touch. */
  allowedPaths: Set<string>;
}

const MAX_EDITABLE_BYTES = 512 * 1024;

export function loadFile(options: LoadOptions, targetFile: string): LoadedFile {
  const resolved = resolveWithinWorktree(options.worktreePath, targetFile);
  if (!resolved.ok) {
    throw new EditOperationError('PATH_ESCAPE', `target path rejected: ${targetFile} (${resolved.reason})`);
  }
  const relative = resolved.relative!;

  if (options.allowedPaths.size && !options.allowedPaths.has(relative)) {
    throw new EditOperationError('FILE_NOT_ALLOWED', `${relative} is outside the approved candidate set`);
  }
  if (isGeneratedPath(relative)) {
    throw new EditOperationError('GENERATED_FILE', `${relative} is generated output and is never an edit target`);
  }
  if (!fs.existsSync(resolved.absolute!)) {
    throw new EditOperationError('FILE_NOT_FOUND', `${relative} does not exist`);
  }

  const stat = fs.statSync(resolved.absolute!);
  if (!stat.isFile() || stat.size > MAX_EDITABLE_BYTES) {
    throw new EditOperationError('FILE_NOT_ALLOWED', `${relative} is not an editable source file`);
  }

  const text = fs.readFileSync(resolved.absolute!, 'utf8');
  let source: ts.SourceFile;
  try {
    source = ts.createSourceFile(resolved.absolute!, text, ts.ScriptTarget.Latest, true);
  } catch (err) {
    throw new EditOperationError('PARSE_FAILED', `${relative} could not be parsed: ${(err as Error).message}`);
  }

  return { relative, absolute: resolved.absolute!, text, source, crlf: text.includes('\r\n') };
}

export interface NamedDeclaration {
  node: ts.Node;
  name: string;
  /** Body of a function/method, when there is one. */
  body?: ts.Block;
  start: number;
  end: number;
  startLine: number;
  endLine: number;
}

function nameOf(node: ts.Node): string | null {
  const named = node as { name?: ts.Node };
  if (named.name && 'getText' in named.name) return (named.name as ts.Identifier).getText();
  return null;
}

/** All top-level-reachable named declarations in a file. */
export function collectDeclarations(file: LoadedFile): NamedDeclaration[] {
  const out: NamedDeclaration[] = [];

  const push = (node: ts.Node, name: string, body?: ts.Block): void => {
    out.push({
      node,
      name,
      body,
      start: node.getStart(),
      end: node.getEnd(),
      startLine: file.source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      endLine: file.source.getLineAndCharacterOfPosition(node.getEnd()).line + 1,
    });
  };

  const visit = (node: ts.Node): void => {
    if (ts.isFunctionDeclaration(node) && node.name) push(node, node.name.text, node.body);
    else if (ts.isMethodDeclaration(node) && node.name) push(node, node.name.getText(), node.body);
    else if (ts.isClassDeclaration(node) && node.name) push(node, node.name.text);
    else if (ts.isInterfaceDeclaration(node)) push(node, node.name.text);
    else if (ts.isTypeAliasDeclaration(node)) push(node, node.name.text);
    else if (ts.isEnumDeclaration(node)) push(node, node.name.text);
    else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const initializer = node.initializer;
      const body =
        initializer && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) && initializer.body && ts.isBlock(initializer.body)
          ? initializer.body
          : undefined;
      push(node, node.name.text, body);
    }
    node.forEachChild(visit);
  };
  visit(file.source);
  return out;
}

/**
 * Resolves the declaration an operation targets.
 *
 * Ambiguity is an error rather than a guess: applying a rename or an extraction
 * to the wrong one of two same-named declarations is silent corruption.
 */
export function findDeclaration(file: LoadedFile, symbol: string, location?: SourceLocation): NamedDeclaration {
  const declarations = collectDeclarations(file).filter(declaration => declaration.name === symbol);

  if (!declarations.length) {
    const available = collectDeclarations(file).map(d => d.name);
    throw new EditOperationError('SYMBOL_NOT_FOUND', `${symbol} is not declared in ${file.relative}`, { available });
  }
  if (declarations.length === 1) return declarations[0];

  // Disambiguate by line range when the model supplied one.
  if (location?.startLine) {
    const inRange = declarations.filter(
      declaration => declaration.startLine <= location.startLine! && location.startLine! <= declaration.endLine
    );
    if (inRange.length === 1) return inRange[0];
  }
  throw new EditOperationError('SYMBOL_AMBIGUOUS', `${symbol} is declared ${declarations.length} times in ${file.relative}`);
}

/** Finds the enclosing declaration for a line, preferring a named one. */
export function declarationAtLine(file: LoadedFile, line: number): NamedDeclaration | null {
  const containing = collectDeclarations(file).filter(declaration => declaration.startLine <= line && line <= declaration.endLine);
  if (!containing.length) return null;
  return containing.reduce((smallest, current) =>
    current.endLine - current.startLine < smallest.endLine - smallest.startLine ? current : smallest
  );
}

/** Object literals inside a node, outermost first. */
export function objectLiteralsIn(node: ts.Node): ts.ObjectLiteralExpression[] {
  const out: ts.ObjectLiteralExpression[] = [];
  const visit = (current: ts.Node): void => {
    if (ts.isObjectLiteralExpression(current)) out.push(current);
    current.forEachChild(visit);
  };
  visit(node);
  return out;
}

/** The object literal passed to a response method such as `res.json({...})`. */
export function responseObjectIn(node: ts.Node): ts.ObjectLiteralExpression | null {
  let found: ts.ObjectLiteralExpression | null = null;
  const visit = (current: ts.Node): void => {
    if (found) return;
    if (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression)) {
      const method = current.expression.name.text;
      if (method === 'json' || method === 'send' || method === 'jsonp') {
        for (const argument of current.arguments) {
          if (ts.isObjectLiteralExpression(argument)) {
            found = argument;
            return;
          }
        }
      }
    }
    current.forEachChild(visit);
  };
  visit(node);
  return found;
}

/** Indentation of the line a position sits on. */
export function indentAt(text: string, position: number): string {
  const lineStart = text.lastIndexOf('\n', position - 1) + 1;
  const line = text.slice(lineStart, position);
  return /^\s*/.exec(line)?.[0] ?? '';
}

/** Character offset of the start of a 1-based line. */
export function offsetOfLine(file: LoadedFile, line: number): number {
  return file.source.getPositionOfLineAndCharacter(line - 1, 0);
}

/** Character offset just past the end of a 1-based line. */
export function offsetOfLineEnd(file: LoadedFile, line: number): number {
  const lines = file.text.split('\n');
  if (line > lines.length) throw new EditOperationError('INVALID_RANGE', `line ${line} is beyond ${file.relative}`);
  let offset = 0;
  for (let index = 0; index < line; index += 1) offset += lines[index].length + 1;
  return Math.min(offset, file.text.length);
}
