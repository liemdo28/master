/**
 * Phase 7G §3 — final broadened legacy authority scan.
 *
 * PHASE7C_LEGACY_MUTATION_SCAN already proves the Gateway/voice import
 * closure never reaches the specific fragments named in 7A/7C/7F's own
 * threat models (gstack, coo-v4 orchestrator/agents, autonomous-task-runner,
 * whatsapp-sender, council). This file widens that same technique to the
 * exact category list the Phase 7G directive names explicitly, and records
 * three genuine findings surfaced by manually tracing reachability during
 * this scan (none required a code change — all three were already
 * unreachable, but none had a permanent regression lock before this):
 *
 * 1. `actions/google-executor.ts` (`executeGmailSend()` → real
 *    `gmail.users.messages.send()`, and its dispatcher
 *    `executeApprovedAction()`) has ZERO callers anywhere in the source
 *    tree — fully dead code, not wired to any route.
 * 2. `actions/gmail-action-adapter.ts`'s `sendEmail()` (real
 *    `gmail.users.drafts.send()`) has ZERO callers — `action-router.ts`
 *    only dynamically imports `searchGmail`/`readGmail`/`draftEmail` from
 *    the same file, never `sendEmail`.
 * 3. `action-router.ts` type-declares a `gmail_send` category (and gives it
 *    a risk level) but its `switch` has no `case 'gmail_send'` arm — it
 *    falls through to `default: { ok: false, error: '... requires
 *    approval — not yet approved.' }`, a safe no-op. `routes/actions.ts`
 *    (the only file that imports `action-router.ts` for live HTTP use) is
 *    itself not mounted anywhere in `index.ts` — a second, independent
 *    layer of unreachability on top of the missing case arm.
 *
 * All three are locked below so a future, well-intentioned change (e.g.
 * "just wire up the gmail_send case, the risk level is already there")
 * cannot silently reintroduce a live Gmail SEND path without this test
 * failing first.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';

const SRC_ROOT = path.resolve(__dirname, '..', '..');

function readIfExists(absPath: string): string | null {
  try { return fs.readFileSync(absPath, 'utf8'); } catch { return null; }
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const IMPORT_RE = /(?:require\(\s*['"`]([^'"`]+)['"`]\s*\)|from\s+['"`]([^'"`]+)['"`])/g;

function resolveSpecifier(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), specifier);
  for (const candidate of [`${base}.ts`, path.join(base, 'index.ts'), base]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function transitiveImportClosure(entryFile: string): Set<string> {
  const visited = new Set<string>();
  const queue = [entryFile];
  while (queue.length > 0) {
    const current = queue.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);
    const source = readIfExists(current);
    if (!source) continue;
    const stripped = stripComments(source);
    for (const match of stripped.matchAll(IMPORT_RE)) {
      const specifier = match[1] ?? match[2];
      const resolved = specifier ? resolveSpecifier(current, specifier) : null;
      if (resolved && !visited.has(resolved)) queue.push(resolved);
    }
  }
  return visited;
}

// Every category the Phase 7G directive names explicitly, mapped to the
// concrete file-path fragments in THIS codebase that can perform it. Some
// entries (e.g. gmail-action-adapter, google-executor) contain a mix of
// legitimate read-only exports and dangerous ones — those are handled by
// the call-based scan below instead of a blanket import ban, so a future
// legitimate read-only use is not blocked by this test.
const BROADENED_FORBIDDEN_FRAGMENTS = [
  // browser write
  'coo-v4/agents/browser-operator',
  'coo-v4/skill-marketplace',
  'engineering/browser/browser-agent',
  'routes/browser-agent',
  // PM2 mutation
  'operations/self-healing',
  'operations/dev2-operations',
  'operations/burn-in',
  'routes/operations',
  'auto-task-engine',
  'company-os/tool-registry',
  'gstack/role-agents/release-agent',
  'gstack/skills/skill-registry',
  // git mutation (execSync git in these files, confirmed via source grep)
  'coding/benchmark/review-benchmark',
  'coo-v4/agents/ai-developer-agent',
  'projects/connectors/bakudan-website-connector',
  'projects/connectors/dashboard-connector',
  'projects/connectors/raw-website-connector',
  'projects/project-scanner',
  // direct provider writer (dead-but-dangerous Gmail SEND capability)
  'actions/google-executor',
];

// Specific execution-authority function CALLS (source-text, comments
// stripped) that must never appear in a live conversational adapter or in
// the Gateway/voice module itself.
const BROADENED_FORBIDDEN_CALLS = [
  'sendEmail(',           // gmail-action-adapter.ts — real drafts.send()
  'executeGmailSend(',    // google-executor.ts — real messages.send()
  'executeApprovedAction(', // google-executor.ts dispatcher
  '.drafts.send(',
  '.messages.send(',
  'pm2.restart(', 'pm2.stop(', 'pm2.delete(',
  "execSync('pm2", 'execSync("pm2',
  "execSync('git push", 'execSync("git push',
  "execSync('git commit", 'execSync("git commit',
  "execSync('git merge", 'execSync("git merge',
];

const LIVE_CONVERSATIONAL_ADAPTERS = [
  'jarvis/phase30-jarvis/jarvis-core.ts',
  'jarvis/executive/executive-personality.ts',
  'communication/mi-human-assistant.ts',
  'communication/natural-conversation-engine.ts',
  'communication/whatsapp-action-router.ts',
  'routes/chat.ts',
  'routes/whatsapp.ts',
  'pipeline/response-pipeline.ts',
  ...fs.readdirSync(path.join(SRC_ROOT, 'jarvis-gateway'))
    .filter(f => f.endsWith('.ts') && !/-(acceptance|evaluation)\.ts$/.test(f))
    .map(f => `jarvis-gateway/${f}`),
  ...fs.readdirSync(path.join(SRC_ROOT, 'jarvis-gateway', 'handlers')).map(f => `jarvis-gateway/handlers/${f}`),
  ...fs.readdirSync(path.join(SRC_ROOT, 'jarvis-gateway', 'voice'))
    .filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map(f => `jarvis-gateway/voice/${f}`),
];

async function run(): Promise<void> {
  let scenarios = 0;
  let passed = 0;

  // ── Broadened STRICT closure scan: Gateway + Router + every voice file ──
  const strictEntries = [
    path.join(SRC_ROOT, 'jarvis-gateway', 'gateway.ts'),
    path.join(SRC_ROOT, 'jarvis-gateway', 'router.ts'),
    ...fs.readdirSync(path.join(SRC_ROOT, 'jarvis-gateway', 'voice'))
      .filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'))
      .map(f => path.join(SRC_ROOT, 'jarvis-gateway', 'voice', f)),
  ];
  for (const entry of strictEntries) {
    scenarios++;
    const closure = transitiveImportClosure(entry);
    const violations: string[] = [];
    for (const file of closure) {
      const relative = path.relative(SRC_ROOT, file).replace(/\\/g, '/');
      for (const fragment of BROADENED_FORBIDDEN_FRAGMENTS) {
        if (relative.includes(fragment)) violations.push(`${relative} (forbidden: ${fragment})`);
      }
    }
    const relEntry = path.relative(SRC_ROOT, entry).replace(/\\/g, '/');
    assert.strictEqual(violations.length, 0, `${relEntry}'s import closure reached forbidden module(s): ${violations.join(', ')}`);
    passed++;
  }

  // ── Broadened call-based scan across every live conversational adapter ──
  for (const relativePath of LIVE_CONVERSATIONAL_ADAPTERS) {
    scenarios++;
    const absPath = path.join(SRC_ROOT, relativePath);
    const source = readIfExists(absPath);
    assert.ok(source, `expected adapter file to exist: ${relativePath}`);
    const stripped = stripComments(source!);
    const found = BROADENED_FORBIDDEN_CALLS.filter(call => stripped.includes(call));
    assert.strictEqual(found.length, 0, `${relativePath} contains forbidden call(s): ${found.join(', ')}`);
    passed++;
  }

  // ── Named regression lock: the 3 genuine findings from this scan ────────
  {
    scenarios++;
    const src = stripComments(readIfExists(path.join(SRC_ROOT, 'actions', 'google-executor.ts'))!);
    // executeGmailSend/executeApprovedAction are DEFINED here (that's fine —
    // the file exists and its functions have real send capability) but must
    // have ZERO callers anywhere else in the source tree.
    const callers = execSyncFreeGrepCallers('executeGmailSend(', ['actions/google-executor.ts'])
      + execSyncFreeGrepCallers('executeApprovedAction(', ['actions/google-executor.ts']);
    assert.strictEqual(callers, 0, 'google-executor.ts\'s send-capable functions must have zero external callers');
    void src;
    passed++;
  }
  {
    scenarios++;
    const callers = execSyncFreeGrepCallers('sendEmail(', ['actions/gmail-action-adapter.ts']);
    assert.strictEqual(callers, 0, 'gmail-action-adapter.ts\'s sendEmail() must have zero external callers');
    passed++;
  }
  {
    scenarios++;
    const actionRouterSrc = stripComments(readIfExists(path.join(SRC_ROOT, 'actions', 'action-router.ts'))!);
    assert.ok(!/case\s+'gmail_send'\s*:/.test(actionRouterSrc), 'action-router.ts must have no case handler for gmail_send');
    const indexSrc = stripComments(readIfExists(path.join(SRC_ROOT, 'index.ts'))!);
    assert.ok(!indexSrc.includes("routes/actions'") && !indexSrc.includes('routes/actions"'), 'routes/actions.ts (the only importer of action-router.ts) must not be mounted in index.ts');
    passed++;
  }

  assert.strictEqual(passed, scenarios);
  console.log(`[phase7g-legacy-authority-scan] PASS — ${passed}/${scenarios} scenarios verified (${strictEntries.length} strict closures, ${LIVE_CONVERSATIONAL_ADAPTERS.length} adapters, 3 named regression locks)`);
}

/** Counts source-text occurrences of `needle` across the whole `src/` tree,
 *  excluding the definition site(s) themselves and test/acceptance/
 *  evaluation files (which legitimately reference function names as
 *  strings for scanning purposes, not as real calls). */
function execSyncFreeGrepCallers(needle: string, excludeFiles: string[]): number {
  let count = 0;
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith('.ts')) continue;
      const relative = path.relative(SRC_ROOT, full).replace(/\\/g, '/');
      if (excludeFiles.includes(relative)) continue;
      if (/-(acceptance|evaluation)\.ts$|\.test\.ts$/.test(entry.name)) continue;
      const source = readIfExists(full);
      if (source && stripComments(source).includes(needle)) count++;
    }
  };
  walk(SRC_ROOT);
  return count;
}

run().catch(err => { console.error(err); process.exit(1); });
