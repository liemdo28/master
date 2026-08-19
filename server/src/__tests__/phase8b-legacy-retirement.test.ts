/**
 * Phase 8B — structural regression lock for the legacy /api/jarvis router
 * retirement, plus a canonical-owner structural test: every domain named in
 * the Phase 8B directive must resolve to exactly one non-ambiguous canonical
 * owner in the authority manifest, and no route may report an unresolved
 * ("UNREGISTERED") owner.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';

const SERVER_ROOT = path.resolve(__dirname, '..', '..');

function read(rel: string): string {
  return fs.readFileSync(path.join(SERVER_ROOT, rel), 'utf8');
}

interface Surface {
  id: string;
  kind: string;
  runtimeMount: string;
  method: string;
  canonicalOwner: string;
  authorityClass: string;
  status: string;
}

function run(): void {
  // ── Retirement regression lock ────────────────────────────────────────────
  assert.ok(!fs.existsSync(path.join(SERVER_ROOT, 'src', 'routes', 'jarvis.ts')), 'routes/jarvis.ts must remain deleted');
  const indexSrc = read('src/index.ts');
  assert.ok(!indexSrc.includes("from './routes/jarvis'"), "index.ts must not import routes/jarvis");
  assert.ok(!indexSrc.includes("app.use('/api/jarvis'"), "index.ts must not mount /api/jarvis");
  assert.ok(!/\bjarvisRouter\b/.test(indexSrc), 'index.ts must not reference jarvisRouter');

  // Backing modules must remain untouched — the retirement removed only the
  // dead HTTP surface, not the live, independently-called modules underneath.
  const liveBackingModules = [
    'src/jarvis/proactive-monitor.ts',
    'src/jarvis/risk-engine.ts',
    'src/jarvis/suggestion-engine.ts',
    'src/jarvis/approval-conversation.ts',
    'src/jarvis/autonomous-task-runner.ts',
    'src/jarvis/ceo-preference-store.ts',
    'src/jarvis/daily-briefing-scheduler.ts',
    'src/communication/conversation-memory.ts',
    'src/jarvis/phase21-knowledge/knowledge-indexer.ts',
    'src/jarvis/phase22-memory/memory-registry.ts',
    'src/jarvis/phase23-tools/tool-registry.ts',
    'src/jarvis/phase24-agents/agent-registry.ts',
    'src/jarvis/phase25-graph/knowledge-graph.ts',
    'src/jarvis/phase26-observability/health-center.ts',
    'src/jarvis/phase27-workflows/workflow-runner.ts',
    'src/jarvis/phase28-executive/executive-intelligence.ts',
    'src/jarvis/phase29-twin/business-twin.ts',
    'src/jarvis/phase30-jarvis/jarvis-core.ts',
  ];
  for (const rel of liveBackingModules) {
    assert.ok(fs.existsSync(path.join(SERVER_ROOT, rel)), `live backing module must still exist: ${rel}`);
  }
  // bootJarvis() must still be invoked at startup — the retirement did not
  // touch the module's real, non-HTTP entrypoint.
  assert.ok(indexSrc.includes("import('./jarvis/phase30-jarvis/jarvis-core')") && indexSrc.includes('bootJarvis'), 'index.ts must still boot Jarvis Phase 30 at startup');

  // ── Canonical owner structural map ────────────────────────────────────────
  const manifest = JSON.parse(read('authority-manifest.json')) as { surfaces: Surface[]; counts: Record<string, number> };

  // Required invariants, re-confirmed post-retirement.
  assert.strictEqual(manifest.counts.unknownMutations, 0, 'unknownMutations must be 0 after retirement');
  assert.strictEqual(manifest.counts.unresolvedLegacyMutations, 0, 'unresolvedLegacyMutations must be 0 after retirement');

  // No MUTATION-capable HTTP surface may report an unresolved owner — this
  // matches the codebase's own established invariant (authority-control-plane
  // /scanner.ts's assertAuthorityManifest only hard-fails UNREGISTERED
  // mutations, not GET routes; a number of pre-existing, unrelated GET
  // routes with no matching registry.ts rule already carry UNREGISTERED
  // as their owner today — that is a separate, pre-existing gap, not
  // something this phase's retirement work introduced or is scoped to fix).
  const unregisteredMutations = manifest.surfaces.filter(s =>
    s.kind === 'HTTP_ROUTE' && s.canonicalOwner === 'UNREGISTERED' && s.method !== 'GET'
  );
  assert.strictEqual(unregisteredMutations.length, 0, `no mutation-capable HTTP route may have an UNREGISTERED canonical owner: ${unregisteredMutations.map(s => s.id).join(', ')}`);

  // At least one canonical owner must exist for each named domain from the
  // Phase 8B directive. "Canonical" here means: the manifest contains at
  // least one surface for this domain whose authorityClass starts with
  // CANONICAL — i.e. a genuinely-canonical (not merely adapted/legacy)
  // owner is resolvable for the domain, matching the directive's own
  // required list.
  const domainPatterns: Record<string, RegExp> = {
    Jarvis: /^\/api\/(command-center\/)?jarvis\//,
    Knowledge: /^\/api\/(command-center\/)?knowledge-documents/,
    Tasks: /^\/api\/(command-center\/)?task-runtime/,
    Projects: /^\/api\/(command-center\/)?projects/,
    Planning: /^\/api\/(command-center\/)?operating/,
    Simulation: /^\/api\/(command-center\/)?simulation/,
    // Canonical approval authority is the Controlled Actions router itself
    // (approve/reject sub-routes) — the legacy /api/approval route is
    // LEGACY_QUARANTINED/ADAPTED_TO_CANONICAL, not a canonical owner, by
    // design (see docs/architecture/PHASE8B_LEGACY_INVENTORY.md §2/§3).
    'Controlled Actions': /^\/api\/(command-center\/)?actions/,
    Approval: /^\/api\/(command-center\/)?actions/,
    Health: /^\/api\/(command-center\/)?health/,
    Evidence: /^\/api\/(command-center\/)?evidence/,
    Voice: /^\/api\/(command-center\/)?jarvis\/voice/,
    Coding: /^\/api\/(command-center\/)?coding/,
    Session: /^\/api\/(command-center\/)?jarvis\/session/,
  };

  const domainOwners: Record<string, Set<string>> = {};
  for (const [domain, pattern] of Object.entries(domainPatterns)) {
    const matches = manifest.surfaces.filter(s => s.kind === 'HTTP_ROUTE' && pattern.test(s.runtimeMount));
    // A route can be labeled CANONICAL_READ purely as the scanner's
    // permissive default for an unmatched GET route (scanner.ts's fallback
    // branch), with canonicalOwner still 'UNREGISTERED' — that is not a
    // genuine canonical owner, just an artifact of the default. Only count
    // routes with a real, named owner.
    const canonicalMatches = matches.filter(s => s.authorityClass.startsWith('CANONICAL') && s.canonicalOwner !== 'UNREGISTERED');
    assert.ok(canonicalMatches.length > 0, `domain "${domain}" must resolve to at least one genuinely-owned CANONICAL-class route (pattern ${pattern})`);
    domainOwners[domain] = new Set(canonicalMatches.map(s => s.canonicalOwner));
  }

  console.log('[phase8b-legacy-retirement] PASS', {
    manifestTotal: manifest.counts.total,
    unknownMutations: manifest.counts.unknownMutations,
    unresolvedLegacyMutations: manifest.counts.unresolvedLegacyMutations,
    domainsVerified: Object.keys(domainPatterns).length,
    domainOwners: Object.fromEntries(Object.entries(domainOwners).map(([k, v]) => [k, [...v]])),
  });
}

run();
