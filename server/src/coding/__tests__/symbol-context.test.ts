/**
 * Symbol-level context tests.
 *
 * Everything here uses synthetic source with invented type names. Nothing
 * references TaskRecord, codingEngine, routes/coding.ts or any Mi Core symbol —
 * if these tests only passed for the pilot's types, the layer would be
 * task-specific by construction.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  buildSymbolContext,
  extractImports,
  extractSymbols,
  memberExists,
  membersOf,
  renderSymbolContext,
  requestAddsNewMember,
  resolveModule,
  symbolsFromCompilerErrors,
  DEFAULT_SYMBOL_LIMITS,
} from '../llm/symbols';

let checks = 0;
function check(label: string, condition: boolean, detail = ''): void {
  if (!condition) throw new Error(`FAILED: ${label} ${detail}`);
  checks += 1;
  console.log(`[symbol-context] ok  ${label}`);
}

function write(root: string, relative: string, content: string): void {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function makeRepo(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-symbols-'));

  write(root, 'src/domain/types.ts', `
export interface VesselRecord {
  hullId: string;
  displayName: string;
  berthCode: string | null;
  tonnage: number;
  decommissionedAt?: string;
}

export type BerthStatus = 'FREE' | 'OCCUPIED' | 'CLOSED';

export type BerthAssignment = {
  berthCode: string;
  status: BerthStatus;
  since: string;
};

export enum HullClass {
  Coastal = 'coastal',
  Ocean = 'ocean',
}
`);

  write(root, 'src/domain/registry.ts', `
import { VesselRecord, BerthStatus } from './types';

export class BerthRegistry {
  private secretKey = 'fake-secret-value-for-symbol-test';
  public capacity = 12;

  assign(vessel: VesselRecord, status: BerthStatus): boolean {
    return status === 'FREE';
  }

  release(hullId: string): void {}
}

export function summariseVessel(vessel: VesselRecord): string {
  return vessel.displayName;
}

export const DEFAULT_BERTH_LIMIT: number = 40;
`);

  write(root, 'src/routes/berth-routes.ts', `
import { BerthRegistry, summariseVessel } from '../domain/registry';
import type { VesselRecord } from '../domain/types';

export function handleAssign(vessel: VesselRecord): { ok: boolean } {
  const registry = new BerthRegistry();
  return { ok: registry.assign(vessel, 'FREE') };
}
`);

  write(root, 'src/config/credentials.ts', `
export const API_KEY = 'fake-secret-value-for-symbol-context-test';
export interface CredentialBundle {
  apiKey: string;
  password: string;
}
`);

  write(root, 'src/broken/malformed.ts', 'export interface Broken { name: string;\n  // deliberately unterminated\n');

  write(root, 'other-project/src/secrets.ts', `
export interface OtherProjectType {
  shouldNotAppear: string;
}
`);

  return root;
}

function run(): void {
  const root = makeRepo();

  // ── 1. interface + type alias + enum extraction ───────────────────────────
  const typeSymbols = extractSymbols('src/domain/types.ts', path.join(root, 'src/domain/types.ts'));
  const vessel = typeSymbols.find(s => s.symbolName === 'VesselRecord');
  check('exported interface is extracted', Boolean(vessel) && vessel!.kind === 'interface');
  check(
    'interface members and types are captured',
    vessel!.members.map(m => m.name).join(',') === 'hullId,displayName,berthCode,tonnage,decommissionedAt',
    vessel!.members.map(m => m.name).join(',')
  );
  check('member types are captured', vessel!.members.find(m => m.name === 'tonnage')?.type === 'number');
  check('optional members are marked', vessel!.members.find(m => m.name === 'decommissionedAt')?.optional === true);
  check('required members are not marked optional', vessel!.members.find(m => m.name === 'hullId')?.optional === false);

  const berthStatus = typeSymbols.find(s => s.symbolName === 'BerthStatus');
  check('union type alias is extracted', Boolean(berthStatus) && berthStatus!.kind === 'type');
  check('union alias keeps its signature', berthStatus!.signature.includes("'FREE'"), berthStatus!.signature);

  const assignment = typeSymbols.find(s => s.symbolName === 'BerthAssignment');
  check('object type alias exposes members', assignment!.members.map(m => m.name).join(',') === 'berthCode,status,since');

  const hullClass = typeSymbols.find(s => s.symbolName === 'HullClass');
  check('enum is extracted with members', hullClass?.kind === 'enum' && hullClass.members.length === 2);

  // ── 2. class member extraction ────────────────────────────────────────────
  const registrySymbols = extractSymbols('src/domain/registry.ts', path.join(root, 'src/domain/registry.ts'));
  const registry = registrySymbols.find(s => s.symbolName === 'BerthRegistry');
  check('exported class is extracted', registry?.kind === 'class');
  const memberNames = registry!.members.map(m => m.name);
  check('public class members are captured', memberNames.includes('capacity') && memberNames.includes('assign'));
  check('methods are distinguished from properties', registry!.members.find(m => m.name === 'assign')?.kind === 'method');
  check('private class members are excluded', !memberNames.includes('secretKey'), memberNames.join(','));

  const fn = registrySymbols.find(s => s.symbolName === 'summariseVessel');
  check('exported function signature is extracted', fn?.kind === 'function' && fn.signature.includes('VesselRecord'));
  check('exported const is extracted', registrySymbols.some(s => s.symbolName === 'DEFAULT_BERTH_LIMIT'));

  // ── 3. secret exclusion ───────────────────────────────────────────────────
  const credentials = extractSymbols('src/config/credentials.ts', path.join(root, 'src/config/credentials.ts'));
  const rendered = renderSymbolContext(credentials);
  check('credential literal is not surfaced', !rendered.includes('fake-secret-value-for-symbol-context-test'), rendered);
  check('redaction marker is used instead', rendered.includes('<redacted>'), rendered);
  const registryRendered = renderSymbolContext(registrySymbols);
  check('private credential field never reaches output', !registryRendered.includes('fake-secret-value-for-symbol-test'));

  // ── 4. malformed source degrades quietly ──────────────────────────────────
  let malformed: unknown;
  try {
    malformed = extractSymbols('src/broken/malformed.ts', path.join(root, 'src/broken/malformed.ts'));
  } catch (err) {
    throw new Error(`malformed source threw instead of degrading: ${String(err)}`);
  }
  check('malformed source returns an array without throwing', Array.isArray(malformed));
  check('missing file returns empty', extractSymbols('nope.ts', path.join(root, 'nope.ts')).length === 0);

  // ── 5. import resolution ──────────────────────────────────────────────────
  check(
    'relative import resolves to a real file',
    resolveModule(root, 'src/routes/berth-routes.ts', '../domain/registry') === 'src/domain/registry.ts'
  );
  check(
    'extensionless type import resolves',
    resolveModule(root, 'src/routes/berth-routes.ts', '../domain/types') === 'src/domain/types.ts'
  );
  check('bare package specifier does not resolve', resolveModule(root, 'src/routes/berth-routes.ts', 'express') === null);
  check(
    'import escaping the worktree does not resolve',
    resolveModule(root, 'src/routes/berth-routes.ts', '../../../../etc/passwd') === null
  );

  const edges = extractImports(root, 'src/routes/berth-routes.ts');
  const registryEdge = edges.find(e => e.moduleSpecifier === '../domain/registry');
  check('import edge names imported symbols', registryEdge!.names.includes('BerthRegistry'));
  check('import edge records resolved path', registryEdge!.resolvedPath === 'src/domain/registry.ts');

  // ── 6. dependency-aware symbol context ────────────────────────────────────
  const context = buildSymbolContext({
    worktreePath: root,
    candidatePaths: ['src/routes/berth-routes.ts'],
    requestHints: ['vessel', 'berth'],
  });
  const names = context.map(s => s.symbolName);
  check('imported interface is resolved across the import edge', names.includes('VesselRecord'), names.join(','));
  check('imported class is resolved across the import edge', names.includes('BerthRegistry'), names.join(','));
  check('symbols declared by the candidate itself are included', names.includes('handleAssign'), names.join(','));
  check(
    'unimported symbols from other modules are not pulled in',
    !names.includes('CredentialBundle') && !names.includes('OtherProjectType'),
    names.join(',')
  );
  const vesselInContext = context.find(s => s.symbolName === 'VesselRecord');
  check('resolved symbol records its source file', vesselInContext!.sourcePath === 'src/domain/types.ts');
  check('resolved symbol records who imported it', vesselInContext!.importedBy.includes('src/routes/berth-routes.ts'));
  check('resolved symbol records a relevance reason', vesselInContext!.relevanceReason.length > 0);

  // ── 7. cross-project isolation ────────────────────────────────────────────
  const isolated = buildSymbolContext({
    worktreePath: path.join(root, 'src'),
    candidatePaths: ['routes/berth-routes.ts'],
    requestHints: [],
  });
  check(
    'symbols outside the worktree root are never reachable',
    !isolated.some(s => s.symbolName === 'OtherProjectType'),
    isolated.map(s => s.symbolName).join(',')
  );

  // ── 8. size limits ────────────────────────────────────────────────────────
  const capped = buildSymbolContext({
    worktreePath: root,
    candidatePaths: ['src/routes/berth-routes.ts'],
    requestHints: [],
    limits: { ...DEFAULT_SYMBOL_LIMITS, maxSymbols: 2 },
  });
  check('symbol count limit is enforced', capped.length <= 2, String(capped.length));

  const byteCapped = buildSymbolContext({
    worktreePath: root,
    candidatePaths: ['src/routes/berth-routes.ts'],
    requestHints: [],
    limits: { ...DEFAULT_SYMBOL_LIMITS, maxBytes: 80 },
  });
  const totalBytes = byteCapped.reduce((sum, s) => sum + s.bytes, 0);
  check('symbol byte budget is enforced', totalBytes <= 80, `${totalBytes} bytes`);

  const memberCapped = extractSymbols('src/domain/types.ts', path.join(root, 'src/domain/types.ts'), {
    ...DEFAULT_SYMBOL_LIMITS,
    maxMembersPerSymbol: 2,
  });
  check(
    'per-symbol member limit is enforced',
    memberCapped.find(s => s.symbolName === 'VesselRecord')!.members.length === 2
  );

  // ── 9. compiler-error-driven expansion ────────────────────────────────────
  const missingProperty = symbolsFromCompilerErrors(
    "src/routes/berth-routes.ts(9,20): error TS2339: Property 'berthLabel' does not exist on type 'VesselRecord'."
  );
  check('missing-property error yields the member', missingProperty.members.includes('berthLabel'));
  check('missing-property error yields the type', missingProperty.symbols.includes('VesselRecord'));

  const notExported = symbolsFromCompilerErrors(
    `src/routes/berth-routes.ts(2,10): error TS2459: Module '"../domain/registry"' declares 'BerthStatus' locally, but it is not exported.`
  );
  check('wrong-import error yields the symbol', notExported.symbols.includes('BerthStatus'));

  const noMember = symbolsFromCompilerErrors(
    `error TS2305: Module '"../domain/types"' has no exported member 'MissingType'.`
  );
  check('missing-export error yields the symbol', noMember.symbols.includes('MissingType'));

  const incompatible = symbolsFromCompilerErrors(
    "error TS2345: Argument of type 'BerthAssignment' is not assignable to parameter of type 'VesselRecord'."
  );
  check(
    'incompatible-type error yields both types',
    incompatible.symbols.includes('BerthAssignment') && incompatible.symbols.includes('VesselRecord'),
    incompatible.symbols.join(',')
  );
  check('empty compiler output yields nothing', symbolsFromCompilerErrors('').symbols.length === 0);

  // An error naming a type reachable only through imports must pull it in.
  const expanded = buildSymbolContext({
    worktreePath: root,
    candidatePaths: ['src/routes/berth-routes.ts'],
    requestHints: [],
    errorSymbols: ['BerthAssignment'],
    errorMembers: [],
  });
  check(
    'error-named symbol is pulled into context',
    expanded.some(s => s.symbolName === 'BerthAssignment'),
    expanded.map(s => s.symbolName).join(',')
  );
  check(
    'error-named symbol is marked as such',
    expanded.find(s => s.symbolName === 'BerthAssignment')!.relevanceReason === 'named by a compiler error'
  );

  // ── 10. plan gate primitives ──────────────────────────────────────────────
  check('known member is recognised', memberExists(context, 'VesselRecord', 'berthCode') === true);
  check('invented member is rejected', memberExists(context, 'VesselRecord', 'berthLabel') === false);
  check('unknown symbol yields no opinion', memberExists(context, 'NotInContext', 'anything') === null);
  check('member list is reported for correction', membersOf(context, 'VesselRecord').includes('displayName'));
  check('additive requests are exempt from the gate', requestAddsNewMember('Add a berthLabel field to the vessel record'));
  check('non-additive requests are gated', !requestAddsNewMember('The endpoint reports the wrong berth code'));

  console.log(`\n[symbol-context] PASS — ${checks} assertions`);

  try {
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  } catch {
    // temp cleanup is best-effort
  }
}

try {
  run();
} catch (err) {
  console.error(`[symbol-context] FAIL: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
