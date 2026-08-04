/**
 * Phase 4.5 retrieval tests.
 *
 * The whole suite runs against a synthetic repository about shipping berths.
 * No Mi Core filename, route or symbol appears in the assertions, so retrieval
 * cannot be passing by having learned this repository. The decoys are built to
 * reproduce the exact failure that motivated this phase: a file whose *name*
 * contains a request word, competing with the file the request is structurally
 * about.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { retrieve, clearRetrievalCache, parseCodingIntent, composeRoutePath, buildRepoGraph } from '../retrieval';
import type { RetrievalCandidate } from '../retrieval/types';

let checks = 0;
function check(label: string, condition: boolean, detail = ''): void {
  if (!condition) throw new Error(`FAILED: ${label} ${detail}`);
  checks += 1;
  console.log(`[retrieval] ok  ${label}`);
}

function write(root: string, relative: string, content: string): void {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function makeRepo(): { root: string; files: string[] } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-retrieval-'));

  // Entry point mounting two routers under different prefixes.
  write(root, 'src/index.ts', `
import express from 'express';
import { berthRouter } from './routes/berth-routes';
import { vesselRouter } from './routes/vessel-routes';

const app = express();
app.use('/api/berths', berthRouter);
app.use('/api/vessels', vesselRouter);
`);

  // The structurally correct target for a "manifest response" request.
  write(root, 'src/routes/berth-routes.ts', `
import { Router, Request, Response } from 'express';
import { BerthService } from '../services/berth-service';

export const berthRouter = Router();
const service = new BerthService();

berthRouter.get('/:code/manifest', (req: Request, res: Response) => {
  const record = service.findBerth(req.params.code);
  res.json({
    berthCode: record.berthCode,
    status: record.status,
    tonnage: record.tonnage,
  });
});

berthRouter.post('/:code/assign', (req: Request, res: Response) => {
  res.json({ assigned: true });
});
`);

  write(root, 'src/routes/vessel-routes.ts', `
import { Router, Request, Response } from 'express';

export const vesselRouter = Router();

vesselRouter.get('/:hullId', (req: Request, res: Response) => {
  res.json({ hullId: req.params.hullId });
});
`);

  // The decoy: filename contains "manifest", but it serves no route.
  write(root, 'src/lib/manifest.ts', `
export function buildManifest(rows: string[]): string {
  return rows.join(',');
}

export function parseManifest(raw: string): string[] {
  return raw.split(',');
}
`);

  // A second decoy whose name contains "tonnage".
  write(root, 'src/lib/tonnage.ts', `
export function normaliseTonnage(value: number): number {
  return Math.round(value);
}
`);

  write(root, 'src/services/berth-service.ts', `
import type { BerthRecord } from '../domain/berth-types';

export class BerthService {
  findBerth(code: string): BerthRecord {
    return { berthCode: code, status: 'FREE', tonnage: 0, pilotName: null };
  }
}
`);

  write(root, 'src/domain/berth-types.ts', `
export interface BerthRecord {
  berthCode: string;
  status: string;
  tonnage: number;
  pilotName: string | null;
}
`);

  write(root, 'test/berth-routes.test.ts', `
import { berthRouter } from '../src/routes/berth-routes';
const routePath = '/api/berths/:code/manifest';
export function run(): void { void berthRouter; void routePath; }
`);

  // A test with no relationship to anything the request touches.
  write(root, 'test/unrelated-clock.test.ts', `
export function run(): void { /* clock behaviour */ }
`);

  write(root, 'src/cli/harbour-cli.ts', `
export function main(argv: string[]): void {
  const cmd = argv[2];
  switch (cmd) {
    case 'drydock':
      return;
    case 'undock':
      return;
    default:
      return;
  }
}
`);

  write(root, 'src/config/settings.ts', `
export const SETTINGS = { maxBerths: 12 };
`);

  // Generated output that lexically matches strongly.
  write(root, 'dist/manifest.js', 'exports.manifest = function () { return "manifest"; };');
  write(root, 'src/generated/manifest-schema.ts', '// @generated\nexport const MANIFEST_SCHEMA = { berthCode: "string" };');

  // Secret-bearing config that must never be offered.
  write(root, 'src/config/credentials.ts', `export const API_KEY = 'fake-secret-value-for-retrieval-test';`);
  write(root, '.env', 'API_KEY=fake-secret-value-that-should-never-appear');

  // A second project with an identically named route file.
  write(root, 'other-project/src/routes/berth-routes.ts', `
import { Router } from 'express';
export const otherRouter = Router();
otherRouter.get('/:code/manifest', (req: any, res: any) => res.json({ berthCode: 1 }));
`);

  const files = [
    'src/index.ts',
    'src/routes/berth-routes.ts',
    'src/routes/vessel-routes.ts',
    'src/lib/manifest.ts',
    'src/lib/tonnage.ts',
    'src/services/berth-service.ts',
    'src/domain/berth-types.ts',
    'test/berth-routes.test.ts',
    'test/unrelated-clock.test.ts',
    'src/cli/harbour-cli.ts',
    'src/config/settings.ts',
    'src/config/credentials.ts',
    'dist/manifest.js',
    'src/generated/manifest-schema.ts',
    'other-project/src/routes/berth-routes.ts',
  ];
  return { root, files };
}

function rankOf(candidates: RetrievalCandidate[], target: string): number {
  return candidates.find(candidate => candidate.path === target)?.rank ?? Number.MAX_SAFE_INTEGER;
}

function scoreOf(candidates: RetrievalCandidate[], target: string): number {
  return candidates.find(candidate => candidate.path === target)?.score ?? 0;
}

function run(): void {
  const { root, files } = makeRepo();
  const ask = (userRequest: string, allowed?: string[]) => {
    clearRetrievalCache();
    return retrieve({
      projectId: 'harbour',
      sourceSha: 'sha-1',
      worktreePath: root,
      userRequest,
      filePaths: files,
      allowedPaths: allowed,
    });
  };

  // ── A. exact route match outranks filename token collision ────────────────
  const manifest = ask('Add the pilot name to the berth manifest endpoint response.');
  check(
    'A. route handler outranks the same-named library file',
    rankOf(manifest.candidates, 'src/routes/berth-routes.ts') < rankOf(manifest.candidates, 'src/lib/manifest.ts'),
    `routes=${rankOf(manifest.candidates, 'src/routes/berth-routes.ts')} lib=${rankOf(manifest.candidates, 'src/lib/manifest.ts')}`
  );
  check('A2. the handler is ranked first', rankOf(manifest.candidates, 'src/routes/berth-routes.ts') === 1);
  check(
    'A3. the filename-only decoy is not selected',
    !manifest.selected.some(candidate => candidate.path === 'src/lib/manifest.ts'),
    manifest.selected.map(c => c.path).join(',')
  );

  // ── B. handler outranks unrelated implementation ──────────────────────────
  check(
    'B. handler outranks an unrelated library matching another token',
    scoreOf(manifest.candidates, 'src/routes/berth-routes.ts') > scoreOf(manifest.candidates, 'src/lib/tonnage.ts')
  );

  // ── C. related route test is included ─────────────────────────────────────
  check(
    'C. the test covering the route is selected',
    manifest.selected.some(candidate => candidate.path === 'test/berth-routes.test.ts'),
    manifest.selected.map(c => c.path).join(',')
  );

  // ── D. imported service ranked behind handler, above unrelated ────────────
  const serviceRank = rankOf(manifest.candidates, 'src/services/berth-service.ts');
  check(
    'D. imported service is behind the handler',
    serviceRank > rankOf(manifest.candidates, 'src/routes/berth-routes.ts'),
    String(serviceRank)
  );
  check(
    'D2. imported service is ahead of an unrelated library',
    serviceRank < rankOf(manifest.candidates, 'src/lib/tonnage.ts'),
    `${serviceRank} vs ${rankOf(manifest.candidates, 'src/lib/tonnage.ts')}`
  );

  // ── E. exact symbol match outranks directory match ────────────────────────
  const symbolAsk = ask('The BerthRecord interface is missing a field used by callers.');
  check(
    'E. file declaring the named symbol ranks first',
    rankOf(symbolAsk.candidates, 'src/domain/berth-types.ts') === 1,
    symbolAsk.candidates.slice(0, 3).map(c => `${c.rank}:${c.path}`).join(' ')
  );

  // ── F. response-field request prioritises the handler ─────────────────────
  check('F. response-field intent is detected', manifest.intent.artifactType === 'HTTP_RESPONSE', manifest.intent.artifactType);
  check('F2. action is detected as ADD', manifest.intent.action === 'ADD');

  // ── G. type-error request prioritises the type definition ─────────────────
  const typeAsk = ask("Property 'pilotName' does not exist on type 'BerthRecord'. Fix the type error.");
  check(
    'G. type definition is ranked first for a type error',
    rankOf(typeAsk.candidates, 'src/domain/berth-types.ts') === 1,
    typeAsk.candidates.slice(0, 3).map(c => `${c.rank}:${c.path}`).join(' ')
  );

  // ── H. CLI request prioritises the CLI registration ───────────────────────
  const cliAsk = ask('The drydock CLI command should accept an extra option.');
  check('H. CLI intent is detected', cliAsk.intent.artifactType === 'CLI', cliAsk.intent.artifactType);
  check(
    'H2. the CLI file ranks first',
    rankOf(cliAsk.candidates, 'src/cli/harbour-cli.ts') === 1,
    cliAsk.candidates.slice(0, 3).map(c => `${c.rank}:${c.path}`).join(' ')
  );

  // ── I. same filename in two projects stays isolated ───────────────────────
  const scoped = ask('Add the pilot name to the berth manifest endpoint response.', files.filter(f => !f.startsWith('other-project/')));
  check(
    'I. a path outside the allowed set is never returned',
    !scoped.candidates.some(candidate => candidate.path.startsWith('other-project/')),
    scoped.candidates.map(c => c.path).join(',')
  );

  // ── J. no unrelated padding ───────────────────────────────────────────────
  check('J. selection is small rather than padded to the cap', manifest.selected.length <= 6, String(manifest.selected.length));
  check(
    'J2. every selected candidate has structural or dependency evidence',
    manifest.selected.every(candidate =>
      candidate.evidence.some(item =>
        ['EXACT_ROUTE', 'EXACT_SYMBOL', 'EXACT_RESPONSE_KEY', 'EXPLICIT_PATH', 'ROUTE_DEFINITION', 'ARTIFACT_ROLE', 'DIRECT_IMPORT', 'RELATED_TEST', 'SYMBOL_DEFINITION', 'CLI_DEFINITION'].includes(item.kind)
      )
    ),
    manifest.selected.map(c => `${c.path}[${c.evidence.map(e => e.kind).join('|')}]`).join(' ')
  );

  // ── K. an unrelated request yields little, not padding ────────────────────
  const noise = ask('Improve the quarterly financial reconciliation ledger export.');
  check(
    'K. an unrelated request does not select the whole repository',
    noise.selected.length < files.length / 2,
    String(noise.selected.length)
  );

  // ── L. generated and excluded files are penalised ─────────────────────────
  check(
    'L. build output is not selected',
    !manifest.selected.some(candidate => candidate.path.startsWith('dist/')),
    manifest.selected.map(c => c.path).join(',')
  );
  check(
    'L2. generated source is not selected',
    !manifest.selected.some(candidate => candidate.path.includes('generated/')),
    manifest.selected.map(c => c.path).join(',')
  );
  check(
    'L3. generated files carry a negative exclusion reason',
    manifest.candidates.find(c => c.path === 'dist/manifest.js')?.exclusionReasons.length !== 0 ||
      scoreOf(manifest.candidates, 'dist/manifest.js') <= 0
  );

  // ── M. route prefix composition ───────────────────────────────────────────
  check('M. prefix and path compose', composeRoutePath('/api/berths', '/:code/manifest') === '/api/berths/:code/manifest');
  check('M2. duplicate slashes collapse', composeRoutePath('/api/', '/x') === '/api/x');
  check('M3. empty prefix is handled', composeRoutePath('', '/x') === '/x');
  const graph = buildRepoGraph({ worktreePath: root, filePaths: files });
  const composed = graph.routes.find(route => route.filePath === 'src/routes/berth-routes.ts' && route.routePath === '/:code/manifest');
  check('M4. the mounted router inherits its prefix', composed?.fullPath === '/api/berths/:code/manifest', composed?.fullPath ?? 'none');
  const otherComposed = graph.routes.find(route => route.filePath === 'src/routes/vessel-routes.ts');
  check(
    'M5. a prefix is not applied to a router it does not mount',
    otherComposed?.fullPath === '/api/vessels/:hullId',
    otherComposed?.fullPath ?? 'none'
  );

  // ── N. stem normalisation does not create noise ───────────────────────────
  const britishAsk = ask('Normalise the tonnage value before returning it.');
  check(
    'N. a stem match still finds the right file',
    rankOf(britishAsk.candidates, 'src/lib/tonnage.ts') <= 3,
    String(rankOf(britishAsk.candidates, 'src/lib/tonnage.ts'))
  );
  check(
    'N2. stem matching does not select everything',
    britishAsk.selected.length <= 6,
    String(britishAsk.selected.length)
  );

  // ── O. malicious paths cannot manipulate ranking ──────────────────────────
  const malicious = ask('Update ../../../../etc/passwd and $(rm -rf /) and ..\\..\\windows\\system32 handling.');
  check(
    'O. traversal strings never yield an out-of-tree candidate',
    malicious.candidates.every(candidate => !candidate.path.includes('..') && !path.isAbsolute(candidate.path)),
    malicious.candidates.map(c => c.path).join(',')
  );
  check('O2. shell metacharacters do not crash retrieval', Array.isArray(malicious.candidates));

  // ── P. limits are respected ───────────────────────────────────────────────
  const capped = retrieve({
    projectId: 'harbour',
    sourceSha: 'sha-1',
    worktreePath: root,
    userRequest: 'Add the pilot name to the berth manifest endpoint response.',
    filePaths: files,
    limits: { topK: 2, maxFilesIndexed: 4000, maxFileBytes: 256 * 1024, minScore: 1 },
  });
  check('P. topK is enforced', capped.selected.length <= 2, String(capped.selected.length));

  // ── Q. secrets are excluded ───────────────────────────────────────────────
  const secretAsk = ask('Where is the API key configured?');
  check(
    'Q. .env is never a candidate',
    !secretAsk.candidates.some(candidate => candidate.path.includes('.env')),
    secretAsk.candidates.map(c => c.path).join(',')
  );

  // ── R. determinism ────────────────────────────────────────────────────────
  const first = ask('Add the pilot name to the berth manifest endpoint response.');
  const second = ask('Add the pilot name to the berth manifest endpoint response.');
  check(
    'R. identical request and SHA produce identical ranking',
    JSON.stringify(first.candidates.map(c => [c.rank, c.path, c.score])) ===
      JSON.stringify(second.candidates.map(c => [c.rank, c.path, c.score]))
  );

  // Cache behaviour: a second call with the same key reuses the graph.
  const cachedRun = retrieve({
    projectId: 'harbour',
    sourceSha: 'sha-1',
    worktreePath: root,
    userRequest: 'Add the pilot name to the berth manifest endpoint response.',
    filePaths: files,
  });
  check('R2. repeated retrieval reports a cache hit', cachedRun.stats.cacheHit === true);

  // Intent parsing is deterministic and structural on its own.
  const intent = parseCodingIntent('Add engineId to the GET /tasks/:id/plan response');
  check('intent extracts the route path', intent.routePaths.includes('/tasks/:id/plan'), JSON.stringify(intent.routePaths));
  check('intent extracts the symbol', intent.symbols.includes('engineId'), JSON.stringify(intent.symbols));
  check('intent classifies an HTTP response', intent.artifactType === 'HTTP_RESPONSE', intent.artifactType);

  console.log(`\n[retrieval] PASS — ${checks} assertions`);

  try {
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  } catch {
    // temp cleanup is best-effort
  }
}

try {
  run();
} catch (err) {
  console.error(`[retrieval] FAIL: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
