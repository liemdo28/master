/**
 * Phase 4.6 strategy tests.
 *
 * Synthetic types and diagnostics throughout. Nothing here references a fixture
 * symbol, a Mi Core path, or any error instance the engine has actually seen.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  addedTextOf,
  buildDiagnosticRepairContext,
  checkNoSuppression,
  checkPatchBounds,
  classifyTask,
  diagnosticsSignature,
  FailureMemory,
  looksLikeWholeFunctionRewrite,
  parseDiagnostics,
  policyFor,
} from '../strategy';
import { shouldUseAstEditPlan } from '../llm/engine';
import type { ModelPatch } from '../llm/types';

let checks = 0;
function check(label: string, condition: boolean, detail = ''): void {
  if (!condition) throw new Error(`FAILED: ${label} ${detail}`);
  checks += 1;
  console.log(`[strategy] ok  ${label}`);
}

function makeRepo(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-strategy-'));
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'src', 'freight.ts'),
    `import type { CrateRecord } from './crate-types';

export function totalMass(crates: CrateRecord[]): number {
  return crates.reduce((sum, crate) => sum + crate.massKg, 0);
}

export function eligibleCrates(crates: CrateRecord[], floor: number): CrateRecord[] {
  return crates.filter((crate) => crate.massKg >= crate.minimumMassKg);
}

export function describeCrate(crate: CrateRecord): string {
  return crate.label + ' ' + crate.carrierName;
}
`
  );
  fs.writeFileSync(
    path.join(root, 'src', 'crate-types.ts'),
    `export interface CrateRecord {
  label: string;
  massKg: number;
  minimumMassKg?: number;
}
`
  );
  return root;
}

function run(): void {
  // ── Task classification ───────────────────────────────────────────────────
  const typeTask = classifyTask('The pricing module no longer compiles. Diagnose the TypeScript errors and fix them properly.');
  check('type errors classify as TYPE_REPAIR', typeTask.taskClass === 'TYPE_REPAIR', typeTask.taskClass);
  check('type repair uses the diagnostic strategy', typeTask.strategy === 'DIAGNOSTIC_GUIDED');
  check('type repair confidence is high', typeTask.confidence >= 0.8, String(typeTask.confidence));

  const refactorTask = classifyTask('The report formatter has one long function with duplicated logic. Refactor it into smaller helpers without changing behaviour.');
  check('refactor requests classify as BEHAVIOR_REFACTOR', refactorTask.taskClass === 'BEHAVIOR_REFACTOR', refactorTask.taskClass);
  check('refactor uses the decomposed strategy', refactorTask.strategy === 'DECOMPOSED');
  check('refactor uses the AST edit plan path', shouldUseAstEditPlan(refactorTask));
  check(
    'refactor budget is smaller than the unknown-class budget',
    refactorTask.maxChangedLines < policyFor('UNKNOWN').maxChangedLines
  );

  const featureTask = classifyTask('Add minimum quantity filtering to the route and the service, and make the pending test pass.');
  check('multi-layer requests classify as MULTI_FILE_FEATURE', featureTask.taskClass === 'MULTI_FILE_FEATURE', featureTask.taskClass);
  check('multi-layer work can use the AST edit plan path', shouldUseAstEditPlan(featureTask));

  const editTask = classifyTask('The overlap check rejects a slot that ends exactly when the next begins. Fix the boundary.');
  check('a narrow bug fix is a targeted edit', editTask.taskClass === 'TARGETED_EDIT', editTask.taskClass);
  check('targeted bug fix stays on the anchored patch path', !shouldUseAstEditPlan(editTask));

  const safeTargetedTask = classifyTask('Add pilotName to the berth manifest endpoint response.');
  check('safe targeted response edits use the AST edit plan path', shouldUseAstEditPlan(safeTargetedTask));

  const configTask = classifyTask('Raise the configured maximum number of workers in the settings file.');
  check('configuration requests classify as CONFIG_CHANGE', configTask.taskClass === 'CONFIG_CHANGE', configTask.taskClass);

  check('every class has an output budget', (['TARGETED_EDIT', 'TYPE_REPAIR', 'MULTI_FILE_FEATURE', 'BEHAVIOR_REFACTOR', 'TEST_REPAIR', 'CONFIG_CHANGE', 'UNKNOWN'] as const).every(cls => policyFor(cls).maxOutputTokens > 0));

  // ── Diagnostic parsing ────────────────────────────────────────────────────
  const raw = [
    "src/freight.ts(8,52): error TS18048: 'crate.minimumMassKg' is possibly 'undefined'.",
    "src/freight.ts(12,32): error TS2339: Property 'carrierName' does not exist on type 'CrateRecord'.",
    "src/freight.ts(12,32): error TS2339: Property 'carrierName' does not exist on type 'CrateRecord'.",
    'Found 2 errors.',
  ].join('\n');

  const root = makeRepo();
  const parsed = parseDiagnostics(raw, root);
  check('diagnostics parse from compiler output', parsed.length === 2, String(parsed.length));
  check('duplicate diagnostics are collapsed', parsed.filter(d => d.code === 'TS2339').length === 1);
  check('file, line and column are captured', parsed[0].file === 'src/freight.ts' && parsed[0].line === 8 && parsed[0].column === 52);
  check('error code is captured', parsed[0].code === 'TS18048');
  check('the named type is extracted', parsed[1].symbols.includes('CrateRecord'), JSON.stringify(parsed[1].symbols));
  check('the named member is extracted', parsed[1].members.includes('carrierName'), JSON.stringify(parsed[1].members));

  const assignability = parseDiagnostics(
    "src/x.ts(3,1): error TS2345: Argument of type 'CrateRecord' is not assignable to parameter of type 'PalletRecord'.",
    root
  );
  check('expected type is captured', assignability[0].expectedType === 'PalletRecord', String(assignability[0].expectedType));
  check('actual type is captured', assignability[0].actualType === 'CrateRecord', String(assignability[0].actualType));
  check('pretty-format diagnostics also parse', parseDiagnostics('src/x.ts:4:9 - error TS2304: Cannot find name \'Foo\'.', root).length === 1);
  check('non-diagnostic output yields nothing', parseDiagnostics('Compilation complete. Watching for changes.', root).length === 0);

  // ── Focused repair context ────────────────────────────────────────────────
  const context = buildDiagnosticRepairContext({ worktreePath: root, compilerOutput: raw });
  check('a focus is built per diagnostic', context.focuses.length === 2, String(context.focuses.length));
  check('the failing line is captured verbatim', context.focuses[0].failingLine.includes('minimumMassKg'), context.focuses[0].failingLine);
  check(
    'the enclosing function is identified',
    context.focuses[0].enclosingName === 'eligibleCrates',
    String(context.focuses[0].enclosingName)
  );
  check(
    'the enclosing excerpt is bounded and numbered',
    context.focuses[0].enclosingSource.includes('|') && context.focuses[0].enclosingSource.split('\n').length < 40
  );
  check(
    'the type definition behind the diagnostic is resolved',
    context.symbols.some(symbol => symbol.symbolName === 'CrateRecord'),
    context.symbols.map(s => s.symbolName).join(',')
  );
  check(
    'the resolved type carries its real members',
    context.symbols.find(s => s.symbolName === 'CrateRecord')?.members.map(m => m.name).join(',') === 'label,massKg,minimumMassKg'
  );
  check('the diagnostic signature is stable', diagnosticsSignature(parsed) === diagnosticsSignature([...parsed].reverse()));

  // ── Suppression rejection ─────────────────────────────────────────────────
  for (const bad of [
    'return crate.minimumMassKg as any;',
    '// @ts-ignore\nreturn crate.minimumMassKg;',
    'const x: any = crate;',
    'return crate as unknown as number;',
    'return <any>crate;',
  ]) {
    check(`suppression rejected: ${bad.split('\n')[0].slice(0, 34)}`, !checkNoSuppression(bad).ok);
  }
  check('a real fix is accepted', checkNoSuppression('return crate.massKg >= (crate.minimumMassKg ?? 0);').ok);
  check('the word "many" is not mistaken for any', checkNoSuppression('// handles many crates').ok);

  // ── Patch bounds ──────────────────────────────────────────────────────────
  const smallPatch: ModelPatch = {
    summary: 'minimal',
    edits: [{ path: 'src/freight.ts', op: 'replace', search: 'a', replace: 'b' }],
  };
  check('a minimal patch is within budget', checkPatchBounds(smallPatch, typeTask).ok);

  const hugePatch: ModelPatch = {
    summary: 'rewrite',
    edits: [{ path: 'src/freight.ts', op: 'replace', search: 'x'.repeat(1), replace: Array.from({ length: 200 }, () => 'line').join('\n') }],
  };
  const hugeResult = checkPatchBounds(hugePatch, typeTask);
  check('an oversized patch is refused for type repair', !hugeResult.ok, hugeResult.violations.join(';'));
  check('the violation names the budget', hugeResult.violations.join(' ').includes('budget'));

  const wholeFile: ModelPatch = {
    summary: 'replace file',
    edits: [{ path: 'src/freight.ts', op: 'create', content: Array.from({ length: 100 }, () => 'x').join('\n') }],
  };
  check('a whole-file write is refused', !checkPatchBounds(wholeFile, refactorTask).ok);

  check('added text is collected for inspection', addedTextOf(smallPatch) === 'b');

  check(
    'a rewrite is detected by size growth',
    looksLikeWholeFunctionRewrite([{ path: 'a.ts', op: 'replace', applied: true, bytesBefore: 100, bytesAfter: 400 }])
  );
  check(
    'a proportionate edit is not flagged as a rewrite',
    !looksLikeWholeFunctionRewrite([{ path: 'a.ts', op: 'replace', applied: true, bytesBefore: 100, bytesAfter: 120 }])
  );

  // ── Failure memory ────────────────────────────────────────────────────────
  const memory = new FailureMemory();
  check('empty memory renders no constraints', memory.renderConstraints() === '');
  memory.record('OUTPUT_TRUNCATED', 'BEHAVIOR_REFACTOR', 'patch output truncated');
  memory.record('OUTPUT_TRUNCATED', 'BEHAVIOR_REFACTOR', 'patch output truncated');
  check('duplicate notes are collapsed', memory.all.length === 1);
  check('truncation produces a size constraint', memory.renderConstraints().includes('ONE small edit'));
  memory.record('SUPPRESSED_DIAGNOSTIC', 'TYPE_REPAIR', 'as any');
  check('suppression produces a no-any constraint', memory.renderConstraints().includes('Do not use any'));
  check('memory reports what it holds', memory.has('OUTPUT_TRUNCATED') && !memory.has('INVENTED_MEMBER'));
  check(
    'memory stores no reasoning, only shapes',
    memory.all.every(note => note.detail.length <= 200)
  );

  console.log(`\n[strategy] PASS — ${checks} assertions`);
  try {
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  } catch {
    // best-effort
  }
}

try {
  run();
} catch (err) {
  console.error(`[strategy] FAIL: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
