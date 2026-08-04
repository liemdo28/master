/**
 * Deterministic AST edit operations.
 *
 * Each operation computes a text splice from AST positions rather than
 * re-printing the file. Re-printing through the TypeScript emitter would
 * normalise quotes, spacing and trailing commas across the whole file, turning
 * a two-line change into an unreviewable diff.
 *
 * The model never supplies code to be copied verbatim; it supplies an operation
 * and its parameters. For `extract_function` it supplies only a line range and a
 * name — Mi moves the exact statements, so the extracted body is the original
 * text, byte for byte.
 */

import * as fs from 'fs';
import * as ts from 'typescript';
import {
  collectDeclarations,
  findDeclaration,
  indentAt,
  loadFile,
  objectLiteralsIn,
  offsetOfLine,
  offsetOfLineEnd,
  responseObjectIn,
  type LoadOptions,
  type LoadedFile,
} from './locate';
import { EditOperationError, type EditOperation, type OperationResult } from './types';

interface Splice {
  start: number;
  end: number;
  text: string;
}

function applySplices(text: string, splices: Splice[]): string {
  // Apply right-to-left so earlier offsets stay valid.
  const ordered = [...splices].sort((a, b) => b.start - a.start);
  let out = text;
  for (const splice of ordered) {
    out = out.slice(0, splice.start) + splice.text + out.slice(splice.end);
  }
  return out;
}

function requireString(operation: EditOperation, key: string): string {
  const value = operation.parameters?.[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new EditOperationError('INVALID_PARAMETERS', `${operation.operationType} requires a "${key}" string parameter`);
  }
  return value;
}

function optionalString(operation: EditOperation, key: string): string | null {
  const value = operation.parameters?.[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

function requireNumber(operation: EditOperation, key: string, fallback?: number): number {
  const value = operation.parameters?.[key] ?? fallback;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new EditOperationError('INVALID_PARAMETERS', `${operation.operationType} requires a numeric "${key}"`);
  }
  return parsed;
}

function countChangedLines(before: string, after: string): number {
  const a = before.split('\n');
  const b = after.split('\n');
  let same = 0;
  while (same < a.length && same < b.length && a[same] === b[same]) same += 1;
  let tailSame = 0;
  while (tailSame < a.length - same && tailSame < b.length - same && a[a.length - 1 - tailSame] === b[b.length - 1 - tailSame]) {
    tailSame += 1;
  }
  return Math.max(a.length - same - tailSame, b.length - same - tailSame);
}

function write(file: LoadedFile, updated: string): { bytesBefore: number; bytesAfter: number; changedLines: number } {
  if (updated === file.text) {
    throw new EditOperationError('NO_CHANGE', `operation produced no change in ${file.relative}`);
  }
  const restored = file.crlf ? updated.replace(/\r?\n/g, '\r\n') : updated;
  fs.writeFileSync(file.absolute, restored);
  return {
    bytesBefore: Buffer.byteLength(file.text, 'utf8'),
    bytesAfter: Buffer.byteLength(restored, 'utf8'),
    changedLines: countChangedLines(file.text, updated),
  };
}

// ── Individual operations ───────────────────────────────────────────────────

/** Inserts `name: value` into an object literal, matching its indentation. */
function addPropertyToObject(file: LoadedFile, operation: EditOperation, target?: ts.ObjectLiteralExpression): string {
  const propertyName = requireString(operation, 'property');
  const value = requireString(operation, 'value');

  let literal = target ?? null;
  if (!literal) {
    const symbol = operation.targetSymbol ?? operation.sourceLocation?.symbol;
    const scope = symbol ? findDeclaration(file, symbol, operation.sourceLocation).node : file.source;
    const literals = objectLiteralsIn(scope);
    if (!literals.length) {
      throw new EditOperationError('SYMBOL_NOT_FOUND', `no object literal found in ${symbol ?? file.relative}`);
    }
    // Prefer a literal that already looks like the response/result shape the
    // model named, otherwise the outermost one.
    const near = operation.sourceLocation?.near;
    literal = (near && literals.find(candidate => candidate.getText().includes(near))) || literals[0];
  }

  if (literal.properties.some(property => property.name?.getText?.().replace(/['"]/g, '') === propertyName)) {
    throw new EditOperationError('NO_CHANGE', `${propertyName} is already present in the object literal`);
  }

  const properties = literal.properties;
  if (!properties.length) {
    const insertAt = literal.getStart() + 1;
    return applySplices(file.text, [{ start: insertAt, end: insertAt, text: ` ${propertyName}: ${value} ` }]);
  }

  const last = properties[properties.length - 1];
  const afterLast = last.getEnd();
  const trailing = file.text.slice(afterLast, literal.getEnd() - 1);
  const hasTrailingComma = /^\s*,/.test(trailing);
  const insertAt = hasTrailingComma ? afterLast + trailing.indexOf(',') + 1 : afterLast;

  // A single-line literal must stay on one line; inserting a newline into
  // `{ a: 1, b: 2 }` produces a diff that looks like a reformat rather than an
  // addition, and reviewers rightly distrust that.
  const literalIsSingleLine =
    file.source.getLineAndCharacterOfPosition(literal.getStart()).line ===
    file.source.getLineAndCharacterOfPosition(literal.getEnd()).line;

  const insertion = literalIsSingleLine
    ? hasTrailingComma
      ? ` ${propertyName}: ${value},`
      : `, ${propertyName}: ${value}`
    : hasTrailingComma
      ? `\n${indentAt(file.text, last.getStart())}${propertyName}: ${value},`
      : `,\n${indentAt(file.text, last.getStart())}${propertyName}: ${value}`;

  return applySplices(file.text, [{ start: insertAt, end: insertAt, text: insertion }]);
}

/** Renames every reference to a declared symbol within the file. */
function renameSymbol(file: LoadedFile, operation: EditOperation): string {
  const from = operation.targetSymbol ?? requireString(operation, 'from');
  const to = requireString(operation, 'to');
  if (from === to) throw new EditOperationError('NO_CHANGE', 'rename source and target are identical');
  if (!/^[A-Za-z_$][\w$]*$/.test(to)) {
    throw new EditOperationError('INVALID_PARAMETERS', `"${to}" is not a valid identifier`);
  }

  // Confirm it is actually declared here, so a rename cannot silently rewrite
  // an unrelated identifier that merely shares the name.
  findDeclaration(file, from, operation.sourceLocation);

  const splices: Splice[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && node.text === from) {
      // Skip property names in object literals with shorthand semantics changes.
      const parent = node.parent;
      const isPropertyKey =
        parent && ts.isPropertyAssignment(parent) && parent.name === node;
      if (!isPropertyKey) splices.push({ start: node.getStart(), end: node.getEnd(), text: to });
    }
    node.forEachChild(visit);
  };
  visit(file.source);

  if (!splices.length) throw new EditOperationError('SYMBOL_NOT_FOUND', `no references to ${from}`);
  return applySplices(file.text, splices);
}

function updateFunctionReturnType(file: LoadedFile, operation: EditOperation): string {
  const symbol = operation.targetSymbol ?? requireString(operation, 'symbol');
  const returnType = requireString(operation, 'returnType');
  const declaration = findDeclaration(file, symbol, operation.sourceLocation);

  const node = declaration.node;
  const signature = ts.isVariableDeclaration(node) ? node.initializer : node;
  if (!signature || !('parameters' in (signature as object))) {
    throw new EditOperationError('INVALID_PARAMETERS', `${symbol} is not a function-like declaration`);
  }
  const fn = signature as ts.SignatureDeclaration;

  if (fn.type) {
    return applySplices(file.text, [{ start: fn.type.getStart(), end: fn.type.getEnd(), text: returnType }]);
  }
  // No annotation yet: insert after the parameter list.
  const closeParen = file.text.indexOf(')', fn.parameters.length ? fn.parameters[fn.parameters.length - 1].getEnd() : fn.getStart());
  if (closeParen === -1) throw new EditOperationError('INVALID_PARAMETERS', `could not locate the parameter list of ${symbol}`);
  return applySplices(file.text, [{ start: closeParen + 1, end: closeParen + 1, text: `: ${returnType}` }]);
}

/** Replaces one expression, located by its exact text inside a bounded scope. */
function replaceExpression(file: LoadedFile, operation: EditOperation): string {
  const from = requireString(operation, 'from');
  const to = requireString(operation, 'to');
  const symbol = operation.targetSymbol ?? operation.sourceLocation?.symbol;
  const scope = symbol ? findDeclaration(file, symbol, operation.sourceLocation).node : file.source;

  const matches: ts.Node[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isExpression(node) && node.getText() === from) matches.push(node);
    node.forEachChild(visit);
  };
  visit(scope);

  if (!matches.length) throw new EditOperationError('SYMBOL_NOT_FOUND', `expression "${from}" not found in ${symbol ?? file.relative}`);
  if (matches.length > 1) {
    throw new EditOperationError('SYMBOL_AMBIGUOUS', `expression "${from}" occurs ${matches.length} times; narrow the scope`);
  }
  return applySplices(file.text, [{ start: matches[0].getStart(), end: matches[0].getEnd(), text: to }]);
}

function insertStatement(file: LoadedFile, operation: EditOperation): string {
  const statement = requireString(operation, 'statement');
  const symbol = operation.targetSymbol ?? operation.sourceLocation?.symbol;
  const position = optionalString(operation, 'position') ?? 'start';

  const declaration = symbol ? findDeclaration(file, symbol, operation.sourceLocation) : null;
  const body = declaration?.body;
  if (!body) throw new EditOperationError('SYMBOL_NOT_FOUND', `${symbol ?? '(none)'} has no statement body`);

  const statements = body.statements;
  const anchor =
    position === 'end' && statements.length
      ? statements[statements.length - 1]
      : statements.length
        ? statements[0]
        : null;

  if (!anchor) {
    const insertAt = body.getStart() + 1;
    return applySplices(file.text, [{ start: insertAt, end: insertAt, text: `\n  ${statement}\n` }]);
  }

  const indent = indentAt(file.text, anchor.getStart());
  if (position === 'end') {
    return applySplices(file.text, [{ start: anchor.getEnd(), end: anchor.getEnd(), text: `\n${indent}${statement}` }]);
  }
  return applySplices(file.text, [{ start: anchor.getStart(), end: anchor.getStart(), text: `${statement}\n${indent}` }]);
}

function addImport(file: LoadedFile, operation: EditOperation): string {
  const moduleSpecifier = requireString(operation, 'module');
  const names = Array.isArray(operation.parameters?.names)
    ? (operation.parameters.names as unknown[]).filter((n): n is string => typeof n === 'string')
    : optionalString(operation, 'name')
      ? [optionalString(operation, 'name') as string]
      : [];
  if (!names.length) throw new EditOperationError('INVALID_PARAMETERS', 'add_import requires "names" or "name"');
  const typeOnly = operation.parameters?.typeOnly === true;

  const existing = file.source.statements.find(
    statement =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === moduleSpecifier
  ) as ts.ImportDeclaration | undefined;

  if (existing?.importClause?.namedBindings && ts.isNamedImports(existing.importClause.namedBindings)) {
    const bindings = existing.importClause.namedBindings;
    const present = new Set(bindings.elements.map(element => element.name.text));
    const missing = names.filter(name => !present.has(name));
    if (!missing.length) throw new EditOperationError('NO_CHANGE', `${names.join(', ')} already imported from ${moduleSpecifier}`);
    const last = bindings.elements[bindings.elements.length - 1];
    const insertAt = last ? last.getEnd() : bindings.getStart() + 1;
    return applySplices(file.text, [{ start: insertAt, end: insertAt, text: `, ${missing.join(', ')}` }]);
  }

  const clause = `import ${typeOnly ? 'type ' : ''}{ ${names.join(', ')} } from '${moduleSpecifier}';`;
  const lastImport = [...file.source.statements].reverse().find(ts.isImportDeclaration);
  if (lastImport) {
    return applySplices(file.text, [{ start: lastImport.getEnd(), end: lastImport.getEnd(), text: `\n${clause}` }]);
  }
  return applySplices(file.text, [{ start: 0, end: 0, text: `${clause}\n` }]);
}

function removeImport(file: LoadedFile, operation: EditOperation): string {
  const moduleSpecifier = optionalString(operation, 'module');
  const name = optionalString(operation, 'name');

  for (const statement of file.source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    if (moduleSpecifier && statement.moduleSpecifier.text !== moduleSpecifier) continue;

    const bindings = statement.importClause?.namedBindings;
    if (name && bindings && ts.isNamedImports(bindings)) {
      const element = bindings.elements.find(candidate => candidate.name.text === name);
      if (!element) continue;
      if (bindings.elements.length === 1) {
        const end = offsetOfLineEnd(file, file.source.getLineAndCharacterOfPosition(statement.getEnd()).line + 1);
        return applySplices(file.text, [{ start: statement.getFullStart(), end, text: '' }]);
      }
      const index = bindings.elements.indexOf(element);
      const start = index === 0 ? element.getStart() : bindings.elements[index - 1].getEnd();
      const end = index === 0 ? bindings.elements[1].getStart() : element.getEnd();
      return applySplices(file.text, [{ start, end, text: '' }]);
    }

    if (!name) {
      const end = offsetOfLineEnd(file, file.source.getLineAndCharacterOfPosition(statement.getEnd()).line + 1);
      return applySplices(file.text, [{ start: statement.getFullStart(), end, text: '' }]);
    }
  }
  throw new EditOperationError('SYMBOL_NOT_FOUND', `no import of ${name ?? moduleSpecifier} to remove`);
}

/** Adds a field to the object a route handler responds with. */
function updateRouteResponseField(file: LoadedFile, operation: EditOperation): string {
  const symbol = operation.targetSymbol ?? operation.sourceLocation?.symbol;
  const near = operation.sourceLocation?.near ?? optionalString(operation, 'route');

  let scope: ts.Node | null = null;
  if (symbol) {
    scope = findDeclaration(file, symbol, operation.sourceLocation).node;
  } else if (operation.sourceLocation?.startLine) {
    scope = file.source;
  }

  // Locate the route registration whose path matches, then its response object.
  let responseObject: ts.ObjectLiteralExpression | null = scope ? responseObjectIn(scope) : null;
  if (!responseObject) {
    const candidates: Array<{ routePath: string; node: ts.CallExpression }> = [];
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const method = node.expression.name.text.toLowerCase();
        const first = node.arguments[0];
        if (['get', 'post', 'put', 'patch', 'delete', 'all'].includes(method) && first && ts.isStringLiteralLike(first)) {
          candidates.push({ routePath: first.text, node });
        }
      }
      node.forEachChild(visit);
    };
    visit(file.source);

    const matching = near ? candidates.filter(candidate => candidate.routePath.includes(near.replace(/^\/+/, ''))) : candidates;
    if (!matching.length) {
      throw new EditOperationError('SYMBOL_NOT_FOUND', `no route handler matching ${near ?? '(any)'} in ${file.relative}`);
    }
    if (matching.length > 1) {
      throw new EditOperationError('SYMBOL_AMBIGUOUS', `${matching.length} routes match ${near}; name the handler symbol`, {
        routes: matching.map(candidate => candidate.routePath),
      });
    }
    responseObject = responseObjectIn(matching[0].node);
  }

  if (!responseObject) throw new EditOperationError('SYMBOL_NOT_FOUND', 'route handler has no JSON response object');

  const field = optionalString(operation, 'field') ?? requireString(operation, 'property');
  const value = requireString(operation, 'value');
  return addPropertyToObject(file, { ...operation, parameters: { property: field, value } }, responseObject);
}

/**
 * Extracts a statement range into a new function and replaces it with a call.
 *
 * This is the operation the whole layer exists for. The extracted body is the
 * original text moved verbatim, so the model never transcribes it — which is
 * exactly the step every model failed at.
 *
 * Parameters and the return value are derived from the AST: identifiers read
 * inside the range but declared outside it become parameters, and a variable
 * declared inside the range and used after it becomes the return value.
 */
function extractFunction(file: LoadedFile, operation: EditOperation): string {
  const newName = requireString(operation, 'newFunctionName');
  if (!/^[A-Za-z_$][\w$]*$/.test(newName)) {
    throw new EditOperationError('INVALID_PARAMETERS', `"${newName}" is not a valid function name`);
  }

  const startLine = requireNumber(operation, 'startLine', operation.sourceLocation?.startLine);
  const endLine = requireNumber(operation, 'endLine', operation.sourceLocation?.endLine);
  if (endLine < startLine) throw new EditOperationError('INVALID_RANGE', 'endLine precedes startLine');

  const sourceSymbol =
    operation.targetSymbol ??
    operation.sourceLocation?.symbol ??
    optionalString(operation, 'sourceSymbol') ??
    inferBodyDeclarationForRange(file, startLine, endLine);
  const declaration = findDeclaration(file, sourceSymbol, operation.sourceLocation);
  const body = declaration.body;
  if (!body) throw new EditOperationError('SYMBOL_NOT_FOUND', `${sourceSymbol} has no statement body to extract from`);

  // Select whole statements inside the range; a partial statement cannot move.
  const selected = body.statements.filter(statement => {
    const from = file.source.getLineAndCharacterOfPosition(statement.getStart()).line + 1;
    const to = file.source.getLineAndCharacterOfPosition(statement.getEnd()).line + 1;
    return from >= startLine && to <= endLine;
  });
  if (!selected.length) {
    throw new EditOperationError('INVALID_RANGE', `no complete statements of ${sourceSymbol} lie within lines ${startLine}-${endLine}`);
  }
  if (selected.length === 1 && ts.isVariableStatement(selected[0])) {
    throw new EditOperationError('INVALID_RANGE', `extracting lines ${startLine}-${endLine} would only move a variable declaration; choose the complete logic block`);
  }
  if (selected.length === body.statements.length) {
    throw new EditOperationError('INVALID_RANGE', 'the range covers the entire function body; extraction would be a rename');
  }

  const rangeStart = selected[0].getStart();
  const rangeEnd = selected[selected.length - 1].getEnd();
  const extractedText = file.text.slice(rangeStart, rangeEnd);

  // Names declared before the range but inside the function, plus parameters.
  const declaredBefore = new Set<string>();
  const collectNames = (node: ts.Node, into: Set<string>): void => {
    const visit = (current: ts.Node): void => {
      if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name)) into.add(current.name.text);
      if (ts.isParameter(current) && ts.isIdentifier(current.name)) into.add(current.name.text);
      current.forEachChild(visit);
    };
    visit(node);
  };
  const signature = ts.isVariableDeclaration(declaration.node) ? declaration.node.initializer : declaration.node;
  if (signature && 'parameters' in (signature as object)) {
    for (const parameter of (signature as ts.SignatureDeclaration).parameters) {
      if (ts.isIdentifier(parameter.name)) declaredBefore.add(parameter.name.text);
    }
  }
  for (const statement of body.statements) {
    if (statement.getEnd() <= rangeStart) collectNames(statement, declaredBefore);
  }

  // Names declared inside the range.
  const declaredInside = new Set<string>();
  for (const statement of selected) collectNames(statement, declaredInside);

  // Identifiers read inside the range.
  const readInside = new Set<string>();
  for (const statement of selected) {
    const visit = (current: ts.Node): void => {
      if (ts.isIdentifier(current)) {
        const parent = current.parent;
        const isDeclarationName =
          (ts.isVariableDeclaration(parent) && parent.name === current) ||
          (ts.isParameter(parent) && parent.name === current) ||
          (ts.isPropertyAssignment(parent) && parent.name === current) ||
          (ts.isPropertyAccessExpression(parent) && parent.name === current);
        if (!isDeclarationName) readInside.add(current.text);
      }
      current.forEachChild(visit);
    };
    visit(statement);
  }

  const parameters = [...readInside].filter(name => declaredBefore.has(name) && !declaredInside.has(name)).sort();

  // A variable declared inside the range and referenced after it must come back.
  //
  // Names that the later statements *re-declare* do not count: a loop variable
  // named `order` in the extracted block and another `order` in a later loop are
  // different bindings, and treating them as one made extraction demand two
  // return values for a range that needs none.
  const usedAfter = new Set<string>();
  const declaredAfter = new Set<string>();
  const writtenAfter = new Set<string>();
  for (const statement of body.statements) {
    if (statement.getStart() < rangeEnd) continue;
    collectNames(statement, declaredAfter);
    const visit = (current: ts.Node): void => {
      if (ts.isIdentifier(current)) usedAfter.add(current.text);
      if (isWriteIdentifier(current)) writtenAfter.add(current.text);
      current.forEachChild(visit);
    };
    visit(statement);
  }
  const returned = [...declaredInside].filter(name => usedAfter.has(name) && !declaredAfter.has(name)).sort();
  if (returned.length > 1) {
    throw new EditOperationError(
      'INVALID_RANGE',
      `extracting lines ${startLine}-${endLine} would need to return ${returned.length} values (${returned.join(', ')}); choose a narrower range`
    );
  }

  const explicitParams = Array.isArray(operation.parameters?.parameters)
    ? (operation.parameters.parameters as unknown[]).filter((p): p is string => typeof p === 'string')
    : null;
  const finalParams = explicitParams?.length ? explicitParams : parameters;
  const returnType = optionalString(operation, 'returnType');

  const bodyIndent = indentAt(file.text, rangeStart);
  const functionIndent = indentAt(file.text, declaration.node.getStart());

  // Re-indent the moved statements to the new function's body level.
  const reindented = extractedText
    .split('\n')
    .map((line, index) => {
      if (index === 0) return `  ${line.trim()}`;
      if (!line.trim()) return line;
      const stripped = line.startsWith(bodyIndent) ? line.slice(bodyIndent.length) : line.replace(/^\s+/, '');
      return `  ${stripped}`;
    })
    .join('\n');

  const returnLine = returned.length ? `\n  return ${returned[0]};` : '';
  const signatureText = `${functionIndent}function ${newName}(${finalParams.join(', ')})${returnType ? `: ${returnType}` : ''} {`;
  const newFunction = `${signatureText}\n${reindented}${returnLine}\n${functionIndent}}\n\n`;

  const returnDeclaration = returned.length && writtenAfter.has(returned[0]) ? 'let' : 'const';
  const call = returned.length
    ? `${bodyIndent}${returnDeclaration} ${returned[0]} = ${newName}(${finalParams.join(', ')});`
    : `${bodyIndent}${newName}(${finalParams.join(', ')});`;

  // Insert the new function immediately before the source declaration, and
  // replace the moved statements with the call.
  const insertAt = declaration.node.getStart() - functionIndent.length;
  return applySplices(file.text, [
    { start: insertAt, end: insertAt, text: newFunction },
    { start: rangeStart, end: rangeEnd, text: call.trimStart() },
  ]);
}

function isWriteIdentifier(node: ts.Node): node is ts.Identifier {
  if (!ts.isIdentifier(node)) return false;
  const parent = node.parent;
  if (ts.isBinaryExpression(parent) && parent.left === node) {
    return parent.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && parent.operatorToken.kind <= ts.SyntaxKind.LastAssignment;
  }
  if ((ts.isPrefixUnaryExpression(parent) || ts.isPostfixUnaryExpression(parent)) && parent.operand === node) {
    return parent.operator === ts.SyntaxKind.PlusPlusToken || parent.operator === ts.SyntaxKind.MinusMinusToken;
  }
  return false;
}

function inferBodyDeclarationForRange(file: LoadedFile, startLine: number, endLine: number): string {
  const containing = collectDeclarations(file).filter(declaration =>
    declaration.body && declaration.startLine <= startLine && declaration.endLine >= endLine
  );
  if (containing.length === 1) return containing[0].name;

  const declarations = collectDeclarations(file).filter(declaration => declaration.body);
  if (declarations.length === 1) return declarations[0].name;
  throw new EditOperationError('INVALID_PARAMETERS', 'extract_function requires targetSymbol when no single function contains the requested line range');
}

/** Moves a function declaration to another position in the same file. */
function moveFunction(file: LoadedFile, operation: EditOperation): string {
  const symbol = operation.targetSymbol ?? requireString(operation, 'symbol');
  const before = optionalString(operation, 'before');
  const position = optionalString(operation, 'position');
  const declaration = findDeclaration(file, symbol, operation.sourceLocation);

  const startLine = file.source.getLineAndCharacterOfPosition(declaration.node.getStart()).line + 1;
  const endLine = file.source.getLineAndCharacterOfPosition(declaration.node.getEnd()).line + 1;
  const blockStart = offsetOfLine(file, startLine);
  const blockEnd = offsetOfLineEnd(file, endLine);
  const block = file.text.slice(blockStart, blockEnd);

  let insertAt: number;
  if (before) {
    const anchor = findDeclaration(file, before, undefined);
    insertAt = offsetOfLine(file, file.source.getLineAndCharacterOfPosition(anchor.node.getStart()).line + 1);
    if (insertAt >= blockStart && insertAt <= blockEnd) {
      throw new EditOperationError('INVALID_RANGE', `${symbol} cannot be moved before itself`);
    }
  } else if (position === 'end') {
    insertAt = file.text.length;
  } else {
    throw new EditOperationError('INVALID_PARAMETERS', 'move_function requires "before" or position:"end"');
  }

  const withoutBlock = file.text.slice(0, blockStart) + file.text.slice(blockEnd);
  const adjusted = insertAt > blockEnd ? insertAt - block.length : insertAt;
  return withoutBlock.slice(0, adjusted) + block + (block.endsWith('\n') ? '' : '\n') + withoutBlock.slice(adjusted);
}

// ── Dispatch ────────────────────────────────────────────────────────────────

const HANDLERS: Record<string, (file: LoadedFile, operation: EditOperation) => string> = {
  add_property_to_object: (file, operation) => addPropertyToObject(file, operation),
  rename_symbol: renameSymbol,
  update_function_return_type: updateFunctionReturnType,
  replace_expression: replaceExpression,
  insert_statement: insertStatement,
  add_import: addImport,
  remove_import: removeImport,
  update_route_response_field: updateRouteResponseField,
  extract_function: extractFunction,
  move_function: moveFunction,
};

export const SUPPORTED_OPERATIONS = Object.keys(HANDLERS);

export function applyOperation(options: LoadOptions, operation: EditOperation): OperationResult {
  const handler = HANDLERS[operation.operationType];
  if (!handler) {
    throw new EditOperationError('UNSUPPORTED_OPERATION', `${operation.operationType} is not a supported operation`);
  }

  const file = loadFile(options, operation.targetFile);
  const updated = handler(file, operation);

  // A relocation changes many line positions while changing no content, so it
  // is verified by content preservation rather than by a diff-size ceiling.
  if (operation.operationType === 'move_function') {
    const normalise = (text: string): string =>
      text
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .sort()
        .join('\n');
    if (normalise(file.text) !== normalise(updated)) {
      throw new EditOperationError('UNRELATED_CHANGE', `move_function altered content in ${file.relative}, not just position`);
    }
  } else {
    // Reject an operation that rewrote the file wholesale; that is the failure
    // mode this layer exists to prevent.
    const changed = countChangedLines(file.text, updated);
    const totalLines = file.text.split('\n').length;
    if (totalLines > 12 && changed > totalLines * 0.6) {
      throw new EditOperationError(
        'UNRELATED_CHANGE',
        `${operation.operationType} would rewrite ${changed} of ${totalLines} lines in ${file.relative}`
      );
    }
  }

  const stats = write(file, updated);
  return {
    operation,
    applied: true,
    changedFiles: [file.relative],
    bytesBefore: stats.bytesBefore,
    bytesAfter: stats.bytesAfter,
    changedLines: stats.changedLines,
  };
}

export { collectDeclarations, findDeclaration, loadFile };
