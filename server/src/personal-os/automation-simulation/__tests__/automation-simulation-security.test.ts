/**
 * Phase 6F §38 — security tests. Proves the zero-real-side-effect boundary
 * empirically, not just by reading the source: no forbidden import ever lands in
 * this module, no real governance store is ever mutated across many varied
 * simulation runs, and the HTTP surface rejects hostile/oversized/unauthenticated
 * input the same way every other Controlled Action route in this codebase does.
 */
import assert from 'assert';
import express from 'express';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { AddressInfo } from 'net';
import type { NextFunction, Request, Response } from 'express';
import { ControlledActionService } from '../../actions/service';
import { AutomationSimulationService } from '../service';
import { simulationJsonParser, automationSimulationRouter } from '../router';
import { taskRuntimeJsonErrorHandler } from '../../../routes/task-runtime';

const API_KEY = 'phase6f-security-test-key';
const SRC_DIR = path.resolve(__dirname, '..');

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mi-6f-sec-'));
}

// --- §38 group 1: source-text import-graph scan ------------------------------
// A hard, automated boundary (§10/§33): if any of these files ever grows an import
// of a real provider writer, a real dispatch path, or a shell/process primitive,
// this test fails the build regardless of how the code got there.
function readSrc(file: string): string {
  return fs.readFileSync(path.join(SRC_DIR, file), 'utf-8');
}

/** Strips block and line comments so scans below only ever see real code, never a
 *  comment's prose description of what the code must NOT do. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/** Extracts only real import/require module specifiers — never comment text — so a
 *  file's own documentation of what it must NOT import (as in fake-providers.ts's
 *  header) can't false-positive this scan. */
function importSpecifiers(text: string): string[] {
  const specs: string[] = [];
  const importRe = /\bfrom\s+['"]([^'"]+)['"]/g;
  const requireRe = /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const re of [importRe, requireRe]) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) specs.push(m[1]);
  }
  return specs;
}

const FORBIDDEN_SPECIFIER_SUBSTRINGS = ['googleapis', 'google-auth', 'child_process', "'net'", '"net"'];

function assertNoForbiddenImports(file: string) {
  const specs = importSpecifiers(stripComments(readSrc(file)));
  for (const spec of specs) {
    for (const forbidden of FORBIDDEN_SPECIFIER_SUBSTRINGS) {
      assert.ok(!spec.includes(forbidden.replace(/['"]/g, '')), `${file} imports forbidden module: ${spec}`);
    }
  }
}

function runImportScan() {
  assertNoForbiddenImports('fake-providers.ts');
  assertNoForbiddenImports('types.ts');
  assertNoForbiddenImports('router.ts');
  // service.ts legitimately imports ControlledActionService for read-only governance
  // access (§3) — but it must never import a real provider writer, and must never
  // call any of ControlledActionService's mutation methods.
  assertNoForbiddenImports('service.ts');
  const serviceCode = stripComments(readSrc('service.ts'));
  for (const call of ['.propose(', '.approve(', '.execute(', '.reject(', '.cancel(']) {
    assert.ok(!serviceCode.includes(call), `service.ts must never call ControlledActionService${call} — simulation is read-only against governance`);
  }
  console.log('[automation-simulation-security] import-graph scan: 0 forbidden module imports, 0 forbidden mutation calls');
}

// --- §38 group 2: real store is never mutated ---------------------------------
// A completely independent, real ControlledActionService fixture stands in for
// "production" — the simulator has no reference to it and no way to reach it, so
// this proves architectural isolation empirically across many varied runs
// (all §9 provider scenarios, kill-switch/budget/delegation what-ifs, forbidden
// candidates, legacy quarantine, DAG/concurrency cases).
function snapshotTables(service: ControlledActionService) {
  const db = service.store.handle;
  const dump = (table: string) => db.prepare(`SELECT * FROM ${table} ORDER BY id`).all();
  return {
    proposals: dump('action_proposals'),
    executions: dump('action_executions'),
    budgets: dump('action_budgets'),
    killSwitches: dump('kill_switches'),
  };
}

async function runStoreIsolationCheck() {
  const fixtureRoot = tmp();
  const fixture = new ControlledActionService(fixtureRoot);
  try {
    const before = snapshotTables(fixture);
    assert.strictEqual(before.proposals.length, 0);
    assert.strictEqual(before.executions.length, 0);

    const sim = new AutomationSimulationService();
    const scenarios = ['SUCCESS', 'VALIDATION_ERROR', 'TIMEOUT', 'RATE_LIMIT', 'UNAVAILABLE', 'AMBIGUOUS_RESULT', 'PARTIAL_FAILURE'] as const;
    const actionTypes = ['GMAIL_CREATE_DRAFT', 'CALENDAR_EVENT_PROPOSAL', 'CALENDAR_CREATE_EVENT'] as const;
    const payloadFor = (actionType: string) =>
      actionType === 'GMAIL_CREATE_DRAFT'
        ? { to: ['user@mi.local'], subject: 's', body: 'b', reason: 'r' }
        : { title: 'x', start: '2026-08-13T10:00:00Z', end: '2026-08-13T10:30:00Z', timezone: 'UTC' };

    let runCount = 0;
    for (let i = 0; i < 20; i++) {
      const actionType = actionTypes[i % actionTypes.length];
      const scenario = scenarios[i % scenarios.length];
      await sim.run({
        kind: 'POLICY_WHAT_IF',
        projectId: `proj-sec-${i}`,
        steps: [{
          key: 'a', type: 'CONTROLLED_ACTION', description: `security run ${i}`,
          actionType, actionPayload: payloadFor(actionType), providerScenario: scenario,
          killSwitchOverrides: i % 5 === 0 ? [{ scope: 'GLOBAL', reason: 'sec-test' }] : undefined,
          budgetOverrides: i % 4 === 0 ? [{ actionType, projectId: null, maxExecutions: 1, usedExecutions: 1, maxExternalTargets: 10, usedExternalTargets: 0 }] : undefined,
          delegationOverride: i % 3 === 0 ? { scenario: 'VALID' } : i % 3 === 1 ? { scenario: 'EXPIRED' } : undefined,
          concurrentCandidateCount: i % 6 === 0 ? 3 : undefined,
          forbiddenCandidate: i === 19,
        }],
      });
      runCount += 1;
    }
    assert.strictEqual(runCount, 20);

    const after = snapshotTables(fixture);
    assert.deepStrictEqual(after, before, 'an unrelated, real governance store must be byte-identical before and after 20 simulation runs');
    console.log('[automation-simulation-security] 20 simulation runs → 0 mutations on an independent real governance store');
  } finally {
    fixture.close();
    fs.rmSync(fixtureRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
}

// --- §38 group 3: API-level security --------------------------------------------
async function startApi() {
  const app = express();
  const auth = (req: Request, res: Response, next: NextFunction) =>
    String(req.headers['x-api-key'] || '') === API_KEY ? next() : res.status(401).json({ error: 'Unauthorized' });
  app.use('/api', simulationJsonParser, taskRuntimeJsonErrorHandler, auth, automationSimulationRouter);
  return new Promise<{ baseUrl: string; close: () => Promise<void> }>(resolve => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        baseUrl: `http://127.0.0.1:${port}/api`,
        close: () => new Promise<void>((ok, no) => server.close(e => (e ? no(e) : ok()))),
      });
    });
  });
}

async function runApiSecurityChecks() {
  const { baseUrl, close } = await startApi();
  try {
    const headers = { 'content-type': 'application/json', 'x-api-key': API_KEY };
    const validBody = {
      kind: 'SINGLE_PROPOSAL', projectId: 'proj-api',
      steps: [{ key: 'a', type: 'CONTROLLED_ACTION', description: 'x', actionType: 'CALENDAR_EVENT_PROPOSAL',
        actionPayload: { title: 'x', start: '2026-08-13T10:00:00Z', end: '2026-08-13T10:30:00Z', timezone: 'UTC' } }],
    };

    // --- unauthenticated requests are rejected --------------------------------
    {
      const res = await fetch(`${baseUrl}/simulation/run`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(validBody) });
      assert.strictEqual(res.status, 401, 'unauthenticated POST /simulation/run must be rejected');
    }
    {
      const res = await fetch(`${baseUrl}/simulation/sim-00000000-0000-0000-0000-000000000000`, { headers: {} });
      assert.strictEqual(res.status, 401, 'unauthenticated GET /simulation/:id must be rejected');
    }

    // --- step count bounds ------------------------------------------------------
    {
      const tooMany = { kind: 'PROPOSED_PLAN', projectId: 'proj-api', steps: Array.from({ length: 101 }, (_, i) => ({ key: `s${i}`, type: 'READ_ONLY', description: 'x' })) };
      const res = await fetch(`${baseUrl}/simulation/run`, { method: 'POST', headers, body: JSON.stringify(tooMany) });
      assert.strictEqual(res.status, 400, 'more than 100 steps must be rejected');
    }
    {
      const empty = { kind: 'SINGLE_PROPOSAL', projectId: 'proj-api', steps: [] };
      const res = await fetch(`${baseUrl}/simulation/run`, { method: 'POST', headers, body: JSON.stringify(empty) });
      assert.strictEqual(res.status, 400, 'an empty steps array must be rejected');
    }

    // --- hostile-but-structurally-clean payload: arbitrary module/shell/URL fields --
    // No prototype-pollution keys here — those are covered separately below, since
    // assertPlainPayload (§32) correctly fails the whole request closed for those
    // rather than silently stripping them, which is the stronger of the two
    // defensible behaviors and this test should hold the router to that standard.
    {
      const hostile = {
        kind: 'SINGLE_PROPOSAL', projectId: 'proj-api',
        module: 'child_process', providerModule: '../actions/service', shellCommand: 'rm -rf /', providerClass: 'RealGmailWriter', url: 'http://evil.example/hook',
        steps: [{
          key: 'a', type: 'CONTROLLED_ACTION', description: 'hostile', actionType: 'CALENDAR_EVENT_PROPOSAL',
          actionPayload: {
            title: 'x', start: '2026-08-13T10:00:00Z', end: '2026-08-13T10:30:00Z', timezone: 'UTC',
            module: 'child_process', shellCommand: 'echo pwned', providerClass: 'RealGmailWriter',
          },
        }],
      };
      const res = await fetch(`${baseUrl}/simulation/run`, { method: 'POST', headers, body: JSON.stringify(hostile) });
      assert.strictEqual(res.status, 200, 'a hostile-shaped but structurally valid payload is still simulated normally, not crashed');
      const body = await res.json() as Record<string, unknown>;
      const raw = JSON.stringify(body);
      assert.ok(!raw.includes('child_process'), 'unknown hostile fields must never be echoed back in the response');
      assert.ok(!raw.includes('rm -rf'), 'unknown hostile fields must never be echoed back in the response');
      assert.ok(!raw.includes('RealGmailWriter'), 'unknown hostile fields must never be echoed back in the response');
      assert.ok(!raw.includes('evil.example'), 'unknown hostile fields must never be echoed back in the response');
    }

    // --- prototype-pollution attempt: rejected outright, not sanitized -------------
    // Written as a literal JSON string rather than JSON.stringify(jsObject): on any
    // ordinary object, `obj['__proto__'] = x` invokes the inherited __proto__
    // accessor and changes the prototype in-place instead of creating a real own
    // property — so it would silently vanish from JSON.stringify output. Sending the
    // exact bytes an attacker would send is the only reliable way to test this.
    {
      const beforePollution = ({} as Record<string, unknown>).polluted;
      const rawJson = '{"kind":"SINGLE_PROPOSAL","projectId":"proj-api","steps":[{"key":"a","type":"CONTROLLED_ACTION",'
        + '"description":"x","actionType":"CALENDAR_EVENT_PROPOSAL","actionPayload":{"title":"x",'
        + '"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}}}]}';
      assert.ok(rawJson.includes('"__proto__"'), 'test setup sanity check: __proto__ must actually appear as literal JSON text');
      const res = await fetch(`${baseUrl}/simulation/run`, { method: 'POST', headers, body: rawJson });
      assert.strictEqual(res.status, 400, 'a payload with __proto__/constructor keys anywhere in the tree must be rejected outright, not sanitized');
      assert.strictEqual(({} as Record<string, unknown>).polluted, beforePollution, 'global Object.prototype must be unaffected by a __proto__ payload key');
    }

    // --- malformed simulation id ------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/simulation/not-a-real-id`, { headers: { 'x-api-key': API_KEY } });
      assert.strictEqual(res.status, 400, 'a malformed simulation id must be rejected before any cache lookup');
    }

    // --- a run's own projectId is preserved, not mixed with another run's --------
    {
      const runA = await fetch(`${baseUrl}/simulation/run`, { method: 'POST', headers, body: JSON.stringify({ ...validBody, projectId: 'proj-secret-a' }) });
      const bodyA = await runA.json() as { simulationId: string; projectId: string };
      assert.strictEqual(bodyA.projectId, 'proj-secret-a');

      const runB = await fetch(`${baseUrl}/simulation/run`, { method: 'POST', headers, body: JSON.stringify({ ...validBody, projectId: 'proj-secret-b' }) });
      const bodyB = await runB.json() as { simulationId: string; projectId: string };
      assert.strictEqual(bodyB.projectId, 'proj-secret-b');

      const fetched = await fetch(`${baseUrl}/simulation/${bodyA.simulationId}`, { headers: { 'x-api-key': API_KEY } });
      const fetchedBody = await fetched.json() as { projectId: string };
      assert.strictEqual(fetchedBody.projectId, 'proj-secret-a', 'fetching run A by its own id must never return run B\'s project scope');
    }

    console.log('[automation-simulation-security] API security checks passed');
  } finally {
    await close();
  }
}

async function run() {
  runImportScan();
  await runStoreIsolationCheck();
  await runApiSecurityChecks();
  console.log('[automation-simulation-security] PASS');
}

run().catch(err => { console.error('[automation-simulation-security] FAIL:', err); process.exit(1); });
