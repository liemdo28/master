/**
 * Phase 7C — permanent structural gate: `JarvisGateway -> canonical
 * subsystem only`. Not just an HTTP-route check (that's what
 * legacyAuthorityBoundary/authority-manifest already cover) — this
 * traverses the actual static import/require graph reachable from every
 * production Jarvis/Gateway entrypoint and fails the build if a quarantined
 * or legacy mutation owner becomes reachable in-process, the exact class of
 * bug this phase's component audit found (docs/architecture/
 * PHASE7C_COMPONENT_AUDIT.md §2): Express middleware cannot intercept a
 * direct function call, so HTTP-layer quarantine alone is not a sufficient
 * proof.
 *
 * Two tiers, matching the actual risk shape:
 *
 * 1. STRICT (server/src/jarvis-gateway/**): brand-new code with zero reason
 *    to touch anything legacy — its transitive import closure must contain
 *    NONE of the forbidden module fragments, full stop.
 * 2. FUNCTION-CALL SCAN (the pre-existing live conversational adapters —
 *    jarvis-core.ts, executive-personality.ts, communication/*, chat.ts,
 *    whatsapp.ts, response-pipeline.ts): these legitimately import some
 *    legacy modules for already-audited, read-only/advisory features (e.g.
 *    jarvis-core.ts reads coo-v4/agent-council-v4.ts's report formatter),
 *    so a blanket import ban would break real functionality. Instead this
 *    scans each file's own source text (comments stripped) for a direct
 *    CALL to one of the specific forbidden execution-authority functions.
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

/** Resolves a relative import specifier against the importing file's
 *  directory to an absolute .ts path, trying index.ts for directories. */
function resolveSpecifier(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null; // only trace in-repo relative imports
  const base = path.resolve(path.dirname(fromFile), specifier);
  for (const candidate of [`${base}.ts`, path.join(base, 'index.ts'), base]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** BFS over the static import graph starting from `entryFile`. Returns the
 *  full set of absolute file paths transitively reachable (including the
 *  entry itself). Pure text-based (regex extraction), matching the same
 *  technique authority-control-plane/scanner.ts already uses elsewhere in
 *  this codebase — safe, fast, deterministic, no module execution. */
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
      const resolved = resolveSpecifier(current, specifier);
      if (resolved && !visited.has(resolved)) queue.push(resolved);
    }
  }
  return visited;
}

// Module path fragments that must never appear in the Jarvis Gateway's own
// transitive import closure — the Gateway is brand-new code with no reason
// to touch any of these.
const STRICT_FORBIDDEN_FRAGMENTS = [
  'gstack/gstack-orchestrator',
  'gstack/connectors/raw-website-connector',
  'coo-v4/coo-orchestrator',
  'coo-v4/agents/ai-developer-agent',
  'coo-v4/agents/creative-agents',
  'coo-v4/production-governor',
  'coo-v4/agent-council-v4',
  'jarvis/autonomous-task-runner',
  'jarvis/approval-conversation',
  'services/whatsapp-sender',
  'autonomous/autonomous-execution-engine',
  'council/multi-agent-council',
];

// Specific execution-authority function CALLS that must never appear
// (source-text, comments stripped) in any live conversational adapter —
// these are the exact functions that, if invoked, dispatch a real mutation
// or make a real authority decision outside canonical governance. Adapters
// may still legitimately import the surrounding module for other
// (read-only/advisory) exports — see PHASE7C_COMPONENT_AUDIT.md §2's
// containment-decision table for which calls stayed intentionally allowed
// (getRunningWorkflows, runCouncilV4-as-report, classify-as-advisory, etc.)
const FORBIDDEN_CALLS = [
  'cooExecute(',
  'handleCeoSignal(',
  'processGStackRequest(',
  'createApproval(',
  '.execute(', // ControlledActionService.execute() — only the canonical Controlled Actions UI/API may call this
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
  'jarvis-gateway/gateway.ts',
  'jarvis-gateway/router.ts',
  ...fs.readdirSync(path.join(SRC_ROOT, 'jarvis-gateway', 'handlers')).map(f => `jarvis-gateway/handlers/${f}`),
];

async function run(): Promise<void> {
  let scenarios = 0;
  let passed = 0;

  // ── Tier 1: strict transitive-closure scan of the Gateway itself ────────
  {
    scenarios++;
    const entry = path.join(SRC_ROOT, 'jarvis-gateway', 'gateway.ts');
    const closure = transitiveImportClosure(entry);
    const violations: string[] = [];
    for (const file of closure) {
      const relative = path.relative(SRC_ROOT, file).replace(/\\/g, '/');
      for (const fragment of STRICT_FORBIDDEN_FRAGMENTS) {
        if (relative.includes(fragment)) violations.push(`${relative} (forbidden: ${fragment})`);
      }
    }
    assert.strictEqual(violations.length, 0, `JarvisGateway's import closure reached forbidden legacy module(s): ${violations.join(', ')}`);
    passed++;
  }

  // ── Tier 1b: router.ts entrypoint too (separate closure root, since
  //    router.ts and gateway.ts could in principle diverge) ───────────────
  {
    scenarios++;
    const entry = path.join(SRC_ROOT, 'jarvis-gateway', 'router.ts');
    const closure = transitiveImportClosure(entry);
    const violations: string[] = [];
    for (const file of closure) {
      const relative = path.relative(SRC_ROOT, file).replace(/\\/g, '/');
      for (const fragment of STRICT_FORBIDDEN_FRAGMENTS) {
        if (relative.includes(fragment)) violations.push(`${relative} (forbidden: ${fragment})`);
      }
    }
    assert.strictEqual(violations.length, 0, `jarvis-gateway/router.ts's import closure reached forbidden legacy module(s): ${violations.join(', ')}`);
    passed++;
  }

  // ── Tier 2: forbidden-call source scan across every live conversational
  //    adapter, including the Gateway's own files (defense in depth — a
  //    forbidden call could in principle appear without a matching import
  //    specifier this scanner's regex catches, e.g. a dynamically computed
  //    require path) ─────────────────────────────────────────────────────
  for (const relativePath of LIVE_CONVERSATIONAL_ADAPTERS) {
    scenarios++;
    const absPath = path.join(SRC_ROOT, relativePath);
    const source = readIfExists(absPath);
    assert.ok(source, `expected adapter file to exist: ${relativePath}`);
    const stripped = stripComments(source!);
    const found = FORBIDDEN_CALLS.filter(call => stripped.includes(call));
    assert.strictEqual(found.length, 0, `${relativePath} contains forbidden execution-authority call(s): ${found.join(', ')}`);
    passed++;
  }

  // ── Explicit named check: neither known-historical bypass site can
  //    silently regress even if the generic scans above are ever weakened ──
  {
    scenarios++;
    const gstackSite = stripComments(readIfExists(path.join(SRC_ROOT, 'jarvis', 'executive', 'executive-personality.ts'))!);
    const coov4Site = stripComments(readIfExists(path.join(SRC_ROOT, 'jarvis', 'phase30-jarvis', 'jarvis-core.ts'))!);
    assert.ok(!gstackSite.includes('processGStackRequest('));
    assert.ok(!coov4Site.includes('cooExecute(') && !coov4Site.includes('handleCeoSignal('));
    passed++;
  }

  assert.strictEqual(passed, scenarios);
  console.log(`[phase7c-legacy-mutation-scan] PASS — ${passed}/${scenarios} scenarios verified (${LIVE_CONVERSATIONAL_ADAPTERS.length} adapters scanned)`);
}

run().catch(err => { console.error(err); process.exit(1); });
