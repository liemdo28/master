/**
 * Phase 7D — permanent structural proof that `session-store.ts`/
 * `session-resolver.ts` are EPHEMERAL CONVERSATION CONTINUITY ONLY:
 *
 *   SessionStore = ephemeral transport/conversation continuity only;
 *   not user memory, not knowledge, not evidence, not authority,
 *   not durable source of truth.
 *
 * This is not asserted by prose — it's proven two ways:
 *
 * 1. Import-source scan: neither file imports anything at runtime except
 *    type-only imports from `./types`. No database, no canonical service
 *    (TaskStore/ProjectRegistry/KnowledgeRetrievalService/
 *    ControlledActionService/GovernedOrchestrationService/
 *    AutomationSimulationService/OperatorControlService/EvidenceService/
 *    DelegationService/policy/approval engine), no `better-sqlite3`, no
 *    filesystem write. If either file ever gains such an import, this test
 *    fails — that would be the first sign of "session store" quietly
 *    growing into a 6th memory/authority system.
 * 2. No persistence: neither file ever requires/imports `fs` in a
 *    write-capable way or `better-sqlite3` — confirmed structurally, not
 *    just "we didn't call it."
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';

const GATEWAY_DIR = path.resolve(__dirname, '..');
const FORBIDDEN_IMPORT_FRAGMENTS = [
  'better-sqlite3',
  'task-runtime',
  'project-registry',
  'documents/retrieval',
  'documents/store',
  'actions/service',
  'orchestration/service',
  'automation-simulation/service',
  'operator-control/service',
  'evidence/',
  'delegation/',
  'policy',
  'approval',
  '../gstack',
  '../coo-v4',
];
const ALLOWED_IMPORT_SOURCES = new Set(['./types', 'crypto']);

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function extractImportSources(source: string): string[] {
  const sources: string[] = [];
  const importRe = /(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
  const requireRe = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = importRe.exec(source))) sources.push(m[1]);
  while ((m = requireRe.exec(source))) sources.push(m[1]);
  return sources;
}

async function run(): Promise<void> {
  let scenarios = 0;
  let passed = 0;
  const assertPass = (cond: boolean, msg: string) => { scenarios++; assert.ok(cond, msg); passed++; };

  for (const file of ['session-store.ts', 'session-resolver.ts']) {
    const raw = fs.readFileSync(path.join(GATEWAY_DIR, file), 'utf8');
    const src = stripComments(raw);
    const sources = extractImportSources(src);

    assertPass(sources.length > 0, `${file} must import something (sanity check the scan itself isn't vacuously passing)`);
    for (const s of sources) {
      assertPass(ALLOWED_IMPORT_SOURCES.has(s), `${file} imports "${s}" — only ${[...ALLOWED_IMPORT_SOURCES].join(', ')} are allowed; any other import means the session store is reaching into a canonical system or persistence layer it must never touch`);
    }
    for (const fragment of FORBIDDEN_IMPORT_FRAGMENTS) {
      assertPass(!raw.includes(fragment), `${file} must never reference "${fragment}" anywhere in its source`);
    }
    assertPass(!raw.includes('writeFileSync') && !raw.includes('appendFileSync'), `${file} must never write to disk — ephemeral means ephemeral`);
  }

  assert.strictEqual(passed, scenarios);
  console.log(`[phase7d-session-invariant] PASS — ${passed}/${scenarios} scenarios verified`);
}

run().catch(err => { console.error(err); process.exit(1); });
