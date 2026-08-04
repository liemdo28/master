/**
 * Phase 4.8 AST edit operation tests.
 *
 * Synthetic fixtures throughout: a warehouse picking module with invented
 * symbols. No Mi Core path, no benchmark fixture symbol, and no operation is
 * specialised to either.
 *
 * The extract_function cases are the point of the layer: they prove the model
 * never has to reproduce the moved body, which is the step every local model
 * failed at.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';

import { applyEditPlan, applyOperation, EditOperationError, SUPPORTED_OPERATIONS } from '../ast-edit';
import type { EditOperation } from '../ast-edit/types';

let checks = 0;
function check(label: string, condition: boolean, detail = ''): void {
  if (!condition) throw new Error(`FAILED: ${label} ${detail}`);
  checks += 1;
  console.log(`[ast-edit] ok  ${label}`);
}

let root = '';
function reset(): void {
  if (root) {
    try {
      fs.rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    } catch {
      /* best-effort */
    }
  }
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-ast-'));
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });

  fs.writeFileSync(
    path.join(root, 'src', 'picking.ts'),
    `import { loadBin } from './bins';

export interface PickTicket {
  ticketId: string;
  binCode: string;
}

export function buildPickList(orders: string[], warehouse: string): string {
  let output = '';
  output += warehouse.toUpperCase() + '\\n';

  let widest = 0;
  for (const order of orders) {
    if (order.length > widest) widest = order.length;
  }

  for (const order of orders) {
    let label = order;
    while (label.length < widest) label = label + ' ';
    output += label + ' | ' + loadBin(order) + '\\n';
  }

  return output;
}

export function summarise(ticket: PickTicket) {
  return { ticketId: ticket.ticketId, binCode: ticket.binCode };
}
`
  );

  fs.writeFileSync(path.join(root, 'src', 'bins.ts'), `export function loadBin(code: string): string {\n  return 'BIN-' + code;\n}\n`);
  fs.writeFileSync(
    path.join(root, 'src', 'single.ts'),
    `export function formatRows(rows: string[]): string {\n  let output = '';\n  for (const row of rows) {\n    output += row.toUpperCase();\n  }\n  return output;\n}\n`
  );

  fs.writeFileSync(
    path.join(root, 'src', 'routes.ts'),
    `import { Router, Request, Response } from 'express';

export const pickRouter = Router();

pickRouter.get('/tickets/:id/status', (req: Request, res: Response) => {
  res.json({
    ticketId: req.params.id,
    state: 'OPEN',
  });
});

pickRouter.get('/bins/:code', (req: Request, res: Response) => {
  res.json({ binCode: req.params.code });
});
`
  );

  fs.writeFileSync(path.join(root, 'dist', 'picking.js'), 'exports.x = 1;\n');
}

const opts = () => ({ worktreePath: root, allowedPaths: new Set(['src/picking.ts', 'src/routes.ts', 'src/bins.ts', 'src/single.ts']) });
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

function expectReject(label: string, operation: EditOperation, code: string): void {
  try {
    applyOperation(opts(), operation);
    check(label, false, 'operation was accepted');
  } catch (err) {
    check(label, err instanceof EditOperationError && err.code === code, err instanceof EditOperationError ? err.code : String(err));
  }
}

function tscCheck(relative: string): { ok: boolean; output: string } {
  const tsc = path.resolve(__dirname, '..', '..', '..', 'node_modules', 'typescript', 'bin', 'tsc');
  try {
    execFileSync(process.execPath, [tsc, '--noEmit', '--skipLibCheck', '--target', 'ES2020', '--moduleResolution', 'node', path.join(root, relative)], {
      encoding: 'utf8',
      timeout: 120_000,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, output: '' };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string };
    return { ok: false, output: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

function run(): void {
  check('all ten operations are registered', SUPPORTED_OPERATIONS.length === 10, SUPPORTED_OPERATIONS.join(','));

  // ── add_property_to_object ────────────────────────────────────────────────
  reset();
  applyOperation(opts(), {
    operationType: 'add_property_to_object',
    targetFile: 'src/picking.ts',
    targetSymbol: 'summarise',
    parameters: { property: 'pickedAt', value: 'Date.now()' },
    reason: 'expose the pick time',
  });
  const added = read('src/picking.ts');
  check('property is inserted into the object literal', added.includes('pickedAt: Date.now()'), added.slice(-160));
  check('existing properties survive', added.includes('ticketId: ticket.ticketId') && added.includes('binCode: ticket.binCode'));
  // `summarise` returns a single-line literal, so the addition must stay inline.
  check('a single-line literal stays on one line', /return \{ ticketId: ticket\.ticketId, binCode: ticket\.binCode, pickedAt: Date\.now\(\) \};/.test(added), JSON.stringify(added.slice(-140)));
  check('the rest of the file is untouched', added.includes('export function buildPickList(orders: string[], warehouse: string): string {'));

  expectReject(
    'adding a property that already exists is refused',
    { operationType: 'add_property_to_object', targetFile: 'src/picking.ts', targetSymbol: 'summarise', parameters: { property: 'pickedAt', value: '1' }, reason: 'dup' },
    'NO_CHANGE'
  );

  // ── update_route_response_field ───────────────────────────────────────────
  reset();
  applyOperation(opts(), {
    operationType: 'update_route_response_field',
    targetFile: 'src/routes.ts',
    sourceLocation: { near: 'status' },
    parameters: { field: 'binCode', value: "'B-1'" },
    reason: 'response should carry the bin',
  });
  const routed = read('src/routes.ts');
  check('the matching route response gains the field', /state: 'OPEN',\n\s+binCode: 'B-1'/.test(routed), routed);
  check('the other route is untouched', routed.includes("res.json({ binCode: req.params.code });"));

  expectReject(
    'an ambiguous route reference is refused',
    { operationType: 'update_route_response_field', targetFile: 'src/routes.ts', parameters: { field: 'x', value: '1' }, reason: 'ambiguous' },
    'SYMBOL_AMBIGUOUS'
  );

  // ── rename_symbol ─────────────────────────────────────────────────────────
  reset();
  applyOperation(opts(), {
    operationType: 'rename_symbol',
    targetFile: 'src/picking.ts',
    targetSymbol: 'buildPickList',
    parameters: { to: 'renderPickList' },
    reason: 'clearer name',
  });
  const renamed = read('src/picking.ts');
  check('the declaration is renamed', renamed.includes('export function renderPickList('));
  check('the old name is gone', !renamed.includes('buildPickList'));
  check('unrelated symbols keep their names', renamed.includes('export function summarise('));

  expectReject(
    'renaming an undeclared symbol is refused',
    { operationType: 'rename_symbol', targetFile: 'src/picking.ts', targetSymbol: 'notThere', parameters: { to: 'x' }, reason: 'bad' },
    'SYMBOL_NOT_FOUND'
  );
  expectReject(
    'renaming to an invalid identifier is refused',
    { operationType: 'rename_symbol', targetFile: 'src/picking.ts', targetSymbol: 'summarise', parameters: { to: '2bad name' }, reason: 'bad' },
    'INVALID_PARAMETERS'
  );

  // ── update_function_return_type ───────────────────────────────────────────
  reset();
  applyOperation(opts(), {
    operationType: 'update_function_return_type',
    targetFile: 'src/picking.ts',
    targetSymbol: 'summarise',
    parameters: { returnType: 'PickTicket' },
    reason: 'annotate the return',
  });
  check('a missing return type is added', read('src/picking.ts').includes('export function summarise(ticket: PickTicket): PickTicket {'));

  applyOperation(opts(), {
    operationType: 'update_function_return_type',
    targetFile: 'src/picking.ts',
    targetSymbol: 'buildPickList',
    parameters: { returnType: 'string | null' },
    reason: 'widen',
  });
  check('an existing return type is replaced', read('src/picking.ts').includes('warehouse: string): string | null {'));

  // ── replace_expression ────────────────────────────────────────────────────
  reset();
  applyOperation(opts(), {
    operationType: 'replace_expression',
    targetFile: 'src/picking.ts',
    targetSymbol: 'buildPickList',
    parameters: { from: 'warehouse.toUpperCase()', to: 'warehouse.trim().toUpperCase()' },
    reason: 'trim first',
  });
  check('the expression is replaced', read('src/picking.ts').includes('warehouse.trim().toUpperCase()'));

  expectReject(
    'an absent expression is refused',
    { operationType: 'replace_expression', targetFile: 'src/picking.ts', targetSymbol: 'buildPickList', parameters: { from: 'nope()', to: 'x()' }, reason: 'bad' },
    'SYMBOL_NOT_FOUND'
  );

  // ── insert_statement ──────────────────────────────────────────────────────
  reset();
  applyOperation(opts(), {
    operationType: 'insert_statement',
    targetFile: 'src/picking.ts',
    targetSymbol: 'summarise',
    parameters: { statement: 'const now = Date.now();', position: 'start' },
    reason: 'capture time',
  });
  check('a statement is inserted at the start of the body', /summarise\(ticket: PickTicket\) \{\n\s+const now = Date\.now\(\);/.test(read('src/picking.ts')));

  // ── add_import / remove_import ────────────────────────────────────────────
  reset();
  applyOperation(opts(), {
    operationType: 'add_import',
    targetFile: 'src/picking.ts',
    parameters: { module: './bins', names: ['reserveBin'] },
    reason: 'need reserveBin',
  });
  check('a name is merged into an existing import', read('src/picking.ts').includes("import { loadBin, reserveBin } from './bins';"));

  applyOperation(opts(), {
    operationType: 'add_import',
    targetFile: 'src/picking.ts',
    parameters: { module: './audit', names: ['writeAudit'] },
    reason: 'new module',
  });
  check('a new import declaration is added', read('src/picking.ts').includes("import { writeAudit } from './audit';"));

  applyOperation(opts(), {
    operationType: 'remove_import',
    targetFile: 'src/picking.ts',
    parameters: { module: './bins', name: 'reserveBin' },
    reason: 'no longer needed',
  });
  const afterRemove = read('src/picking.ts');
  check('a single named import is removed', !afterRemove.includes('reserveBin'), afterRemove.split('\n')[0]);
  check('the sibling import survives', afterRemove.includes('loadBin'));

  // ── extract_function — the operation this layer exists for ────────────────
  reset();
  const before = read('src/picking.ts');
  const widestBlockStart = before.split('\n').findIndex(line => line.includes('let widest = 0;')) + 1;
  const widestBlockEnd = before.split('\n').findIndex(line => line.includes('if (order.length > widest)')) + 2;

  const result = applyOperation(opts(), {
    operationType: 'extract_function',
    targetFile: 'src/picking.ts',
    targetSymbol: 'buildPickList',
    parameters: { newFunctionName: 'widestOrderLength', startLine: widestBlockStart, endLine: widestBlockEnd },
    reason: 'the width calculation is a separate concern',
  });
  const extracted = read('src/picking.ts');

  check('a new function is created', extracted.includes('function widestOrderLength('), extracted);
  check('the caller now calls it', /const widest = widestOrderLength\(orders\);/.test(extracted), extracted);
  check('a free variable became a parameter', /function widestOrderLength\(orders\)/.test(extracted));
  check('the moved body is the original text', extracted.includes('if (order.length > widest) widest = order.length;'));
  check('the extracted function returns the used variable', /return widest;/.test(extracted));
  check('the original loop no longer appears inline twice', extracted.split('let widest = 0;').length === 2);
  check('surrounding code is preserved', extracted.includes("output += warehouse.toUpperCase() + '\\n';"));
  check('the edit is small', result.changedLines < 20, String(result.changedLines));
  check('unrelated exports survive', extracted.includes('export function summarise('));

  const compiled = tscCheck('src/picking.ts');
  check('the file still compiles after extraction', compiled.ok, compiled.output.slice(0, 300));

  reset();
  applyOperation(opts(), {
    operationType: 'extract_function',
    targetFile: 'src/single.ts',
    parameters: { newFunctionName: 'appendRows', startLine: 3, endLine: 5 },
    reason: 'line range is enough when there is one function body',
  });
  const inferred = read('src/single.ts');
  check('single-body extraction infers the source symbol', inferred.includes('function appendRows('), inferred);

  expectReject(
    'extracting the whole body is refused',
    {
      operationType: 'extract_function',
      targetFile: 'src/picking.ts',
      targetSymbol: 'summarise',
      parameters: { newFunctionName: 'x', startLine: 1, endLine: 999 },
      reason: 'too broad',
    },
    'INVALID_RANGE'
  );
  reset();
  expectReject(
    'an empty statement range is refused',
    {
      operationType: 'extract_function',
      targetFile: 'src/picking.ts',
      targetSymbol: 'buildPickList',
      parameters: { newFunctionName: 'x', startLine: 2, endLine: 2 },
      reason: 'no statements',
    },
    'INVALID_RANGE'
  );
  reset();
  expectReject(
    'a declaration-only extraction is refused',
    {
      operationType: 'extract_function',
      targetFile: 'src/picking.ts',
      targetSymbol: 'buildPickList',
      parameters: { newFunctionName: 'widestOnly', startLine: widestBlockStart, endLine: widestBlockStart },
      reason: 'not a complete logic block',
    },
    'INVALID_RANGE'
  );

  // ── move_function ─────────────────────────────────────────────────────────
  reset();
  applyOperation(opts(), {
    operationType: 'move_function',
    targetFile: 'src/picking.ts',
    targetSymbol: 'summarise',
    parameters: { before: 'buildPickList' },
    reason: 'group helpers first',
  });
  const moved = read('src/picking.ts');
  check('the function moved above its anchor', moved.indexOf('function summarise(') < moved.indexOf('function buildPickList('));
  check('nothing was lost in the move', moved.includes('buildPickList') && moved.includes('summarise'));

  // ── Boundary rejections ───────────────────────────────────────────────────
  reset();
  expectReject(
    'a path escaping the worktree is refused',
    { operationType: 'add_import', targetFile: '../../../etc/passwd', parameters: { module: 'x', names: ['y'] }, reason: 'escape' },
    'PATH_ESCAPE'
  );
  expectReject(
    'a file outside the candidate set is refused',
    { operationType: 'add_import', targetFile: 'src/unlisted.ts', parameters: { module: 'x', names: ['y'] }, reason: 'not allowed' },
    'FILE_NOT_ALLOWED'
  );
  expectReject(
    'a generated file is refused',
    {
      operationType: 'add_import',
      targetFile: 'dist/picking.js',
      parameters: { module: 'x', names: ['y'] },
      reason: 'generated',
    },
    'PATH_ESCAPE'
  );
  expectReject(
    'a missing file is refused',
    { operationType: 'add_import', targetFile: 'src/bins.ts', parameters: {}, reason: 'no params' },
    'INVALID_PARAMETERS'
  );
  expectReject(
    'an unknown operation is refused',
    { operationType: 'delete_everything' as never, targetFile: 'src/picking.ts', parameters: {}, reason: 'bad' },
    'UNSUPPORTED_OPERATION'
  );

  // ── Plan-level rollback ───────────────────────────────────────────────────
  reset();
  const original = read('src/picking.ts');
  let rolledBack = false;
  try {
    applyEditPlan({
      worktreePath: root,
      allowedPaths: opts().allowedPaths,
      plan: {
        operations: [
          { operationType: 'add_property_to_object', targetFile: 'src/picking.ts', targetSymbol: 'summarise', parameters: { property: 'a', value: '1' }, reason: 'ok' },
          { operationType: 'rename_symbol', targetFile: 'src/picking.ts', targetSymbol: 'doesNotExist', parameters: { to: 'x' }, reason: 'fails' },
        ],
        affectedSymbols: [],
        expectedValidation: [],
        risks: [],
      },
    });
  } catch {
    rolledBack = true;
  }
  check('a failing plan throws', rolledBack);
  check('a failing plan rolls back every earlier operation', read('src/picking.ts') === original);

  reset();
  const good = applyEditPlan({
    worktreePath: root,
    allowedPaths: opts().allowedPaths,
    plan: {
      operations: [
        { operationType: 'add_property_to_object', targetFile: 'src/picking.ts', targetSymbol: 'summarise', parameters: { property: 'a', value: '1' }, reason: 'ok' },
        { operationType: 'add_import', targetFile: 'src/picking.ts', parameters: { module: './audit', names: ['writeAudit'] }, reason: 'ok' },
      ],
      affectedSymbols: ['summarise'],
      expectedValidation: ['npm test'],
      risks: [],
    },
  });
  check('a valid multi-operation plan applies', good.results.length === 2 && good.changedFiles.includes('src/picking.ts'));
  check('the plan reports its changed-line total', good.totalChangedLines > 0);

  let overBudget = false;
  try {
    applyEditPlan({
      worktreePath: root,
      allowedPaths: opts().allowedPaths,
      plan: {
        operations: [{ operationType: 'add_property_to_object', targetFile: 'src/picking.ts', targetSymbol: 'summarise', parameters: { property: 'b', value: '2' }, reason: 'ok' }],
        affectedSymbols: [],
        expectedValidation: [],
        risks: [],
      },
      maxChangedLines: 0,
    });
  } catch (err) {
    overBudget = err instanceof EditOperationError && err.code === 'UNRELATED_CHANGE';
  }
  check('a plan over its changed-line budget is refused', overBudget);

  console.log(`\n[ast-edit] PASS — ${checks} assertions`);
  try {
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  } catch {
    /* best-effort */
  }
}

try {
  run();
} catch (err) {
  console.error(`[ast-edit] FAIL: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
