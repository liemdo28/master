import fs from 'fs';
import path from 'path';
import type { AuthorityManifest, AuthoritySurface, DiscoveredRoute } from './types';
import { classifyDiscoveredRoute, isMutation } from './registry';

const ROUTE_RE = /([A-Za-z0-9_]+)\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g;
const IMPORT_RE = /import\s+(?:\{([^}]+)\}|([A-Za-z0-9_]+))\s+from\s+['"]([^'"]+)['"]/g;
const MOUNT_RE = /app\.use\(\s*['"`]([^'"`]+)['"`]([\s\S]*?)\);/g;
const APP_GET_RE = /app\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g;

export function generateAuthorityManifest(repoRoot = process.cwd()): AuthorityManifest {
  const serverRoot = resolveServerRoot(repoRoot);
  const routes = discoverMountedRoutes(serverRoot);
  const surfaces = [
    ...routes.map(classifyDiscoveredRoute),
    ...discoverNonHttpSurfaces(serverRoot),
  ].sort((a, b) => a.id.localeCompare(b.id));
  const mutations = surfaces.filter(item => isMutation(item.method, item.effectClass));
  const legacyMutations = mutations.filter(item => item.legacyReason || item.authorityClass === 'LEGACY_QUARANTINED');
  return {
    generatedAt: 'GENERATED_AT_RUNTIME',
    version: 'phase6a-v1',
    surfaces,
    counts: {
      total: surfaces.length,
      readOnly: surfaces.length - mutations.length,
      mutations: mutations.length,
      canonical: surfaces.filter(s => s.authorityClass.startsWith('CANONICAL')).length,
      adapters: surfaces.filter(s => s.authorityClass === 'ADAPTER_TO_CANONICAL').length,
      quarantined: surfaces.filter(s => s.authorityClass === 'LEGACY_QUARANTINED').length,
      forbidden: surfaces.filter(s => s.authorityClass === 'FORBIDDEN').length,
      internalTest: surfaces.filter(s => s.authorityClass === 'INTERNAL_TEST_ONLY').length,
      unknownMutations: mutations.filter(s => s.canonicalOwner === 'UNREGISTERED').length,
      legacyMutations: legacyMutations.length,
      adaptedLegacy: legacyMutations.filter(s => s.phase6bDisposition === 'ADAPT_SAFE' || s.phase6bDisposition === 'ADAPT_WITH_BEHAVIOR_CHANGE').length,
      quarantinedLegacy: legacyMutations.filter(s => s.phase6bDisposition === 'QUARANTINE_ONLY' || s.phase6bDisposition === 'REQUIRES_FUTURE_AUTHORIZATION').length,
      disabledDeadLegacy: legacyMutations.filter(s => s.phase6bDisposition === 'DEAD_UNWIRED').length,
      unresolvedLegacyMutations: legacyMutations.filter(s => !s.phase6bDisposition).length,
    },
  };
}

function resolveServerRoot(repoRoot: string): string {
  if (fs.existsSync(path.join(repoRoot, 'src', 'index.ts'))) return repoRoot;
  const nestedServerRoot = path.join(repoRoot, 'server');
  if (fs.existsSync(path.join(nestedServerRoot, 'src', 'index.ts'))) return nestedServerRoot;
  return repoRoot;
}

export function discoverNonHttpSurfaces(repoRoot = process.cwd()): AuthoritySurface[] {
  const pkgPath = path.join(repoRoot, 'package.json');
  const pkg = fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { scripts?: Record<string, string> } : { scripts: {} };
  const scripts = Object.entries(pkg.scripts ?? {}).filter(([name]) =>
    /^(personal-os|coding|project-registry|delegation|phase5|test:|agentic-coding)/.test(name)
  );
  const cliSurfaces = scripts.map(([name, command]) => {
    const mutating = /(^|:)(acceptance|personal-os|coding|delegation|project-registry)$/.test(name) || /^phase5/.test(name);
    return {
      id: `cli:${name}`,
      kind: 'CLI_COMMAND' as const,
      sourcePath: 'server/package.json',
      runtimeMount: name,
      method: 'CLI',
      capability: command,
      effectClass: mutating ? 'LOCAL_REVERSIBLE' as const : 'READ_ONLY' as const,
      authorityClass: mutating ? 'ADAPTER_TO_CANONICAL' as const : 'INTERNAL_TEST_ONLY' as const,
      canonicalOwner: mutating ? canonicalOwnerForCli(name) : 'Test Harness',
      projectScoped: /coding|project/.test(name),
      externalSystem: null,
      approvalRequired: false,
      governanceRequired: /^phase5[fghi]|delegation/.test(name),
      delegationEligible: false,
      authenticationRequired: 'INTERNAL_ONLY' as const,
      status: mutating ? 'ADAPTED' as const : 'TEST_ONLY' as const,
      legacyReason: null,
      migrationTarget: null,
      phase6bDisposition: mutating ? 'ADAPT_SAFE' as const : null,
      adapterTarget: mutating ? 'LegacyAuthorityAdapter' : null,
      quarantineHandler: null,
      canonicalReplacement: mutating ? canonicalOwnerForCli(name) : null,
      lastAuthorityEvidence: null,
      evidence: ['server/package.json scripts'],
    };
  });

  const background: AuthoritySurface[] = [
    worker('background:scheduler', 'server/src/cron/sync-scheduler.ts', 'startScheduler', 'READ_ONLY', 'CANONICAL_READ', 'Connector Registry', 'scheduled connector sync/read model'),
    worker('background:burn-in', 'server/src/operations/burn-in.ts', 'startBurnInScheduler', 'LOCAL_REVERSIBLE', 'ADAPTER_TO_CANONICAL', 'Operations evidence', 'burn-in evidence snapshots'),
    worker('background:self-healing-scheduler', 'server/src/operations/self-healing.ts', 'startSelfHealingScheduler', 'SERVICE_CONTROL', 'LEGACY_QUARANTINED', 'Authority Control Plane', 'self-healing process/service-control observation (read-only PM2 checks + local metrics-reset POST to itself)'),
    // Phase 9A: this surface's runtime enforcement is now code-verified, not merely
    // labeled — see evaluateRestartEligibility/RESTART_ALLOWLIST/isGlobalKillSwitchActive
    // in self-healing-monitor.ts and their permanent regression coverage. It is no
    // longer counted as an unresolved legacy mutation (legacyReason: null,
    // phase6bDisposition: 'ADAPT_WITH_BEHAVIOR_CHANGE' — resolved, behavior changed).
    worker('background:self-healing-monitor', 'server/src/company-os/self-healing-monitor.ts', 'startSelfHealingMonitor', 'SERVICE_CONTROL', 'CANONICAL_LOCAL_MUTATION', 'Company OS Self-Healing Monitor', 'deterministic, service-allowlisted PM2 restart with intentional-stop exclusion, global kill-switch gate, and durable evidence (Phase 9A)', {
      approvalRequired: false,
      governanceRequired: false,
      status: 'ACTIVE',
      legacyReason: null,
      migrationTarget: null,
      // Fully resolved out of the legacy-mutation tracking system, like any other
      // CANONICAL_* surface — not adapted via LegacyAuthorityAdapter (adapterTarget
      // stays null) and not quarantined, so no phase6bDisposition is needed.
      phase6bDisposition: null,
      adapterTarget: null,
      quarantineHandler: 'selfHealingMonitor.evaluateRestartEligibility',
      canonicalReplacement: null,
      evidence: ['server/src/index.ts startup wiring', 'server/src/company-os/self-healing-monitor.ts evaluateRestartEligibility/RESTART_ALLOWLIST/isGlobalKillSwitchActive', 'server/src/company-os/__tests__/self-healing-restart-authority.test.ts'],
    }),
    worker('background:jarvis-proactive-monitor', 'server/src/jarvis/proactive-monitor.ts', 'startProactiveMonitor', 'EXTERNAL_REVERSIBLE', 'LEGACY_QUARANTINED', 'Daily Operating Loop', 'legacy proactive notifications (autonomous WhatsApp send)'),
    worker('background:daily-briefing-scheduler', 'server/src/jarvis/daily-briefing-scheduler.ts', 'startDailyBriefingScheduler', 'EXTERNAL_REVERSIBLE', 'LEGACY_QUARANTINED', 'Daily Operating Loop', 'legacy daily WhatsApp briefing (autonomous WhatsApp send)'),
    worker('background:leader-heartbeat', 'server/src/nodes/leader-lock-persistent.ts', 'startLeaderHeartbeat', 'LOCAL_REVERSIBLE', 'ADAPTER_TO_CANONICAL', 'Node leader lock', 'leader heartbeat (local lock file only; failover branch sends a proactive WhatsApp notification, not itself lock-mutating)'),
    worker('background:qb-online-watcher', 'server/src/jarvis/qb-online-watcher.ts', 'startQbOnlineWatcher', 'EXTERNAL_REVERSIBLE', 'LEGACY_QUARANTINED', 'Authority Control Plane', 'legacy QuickBooks online watcher (DB command insert that drives a remote machine + autonomous WhatsApp send)'),
  ];

  return [...cliSurfaces, ...background];
}

interface WorkerOverrides {
  approvalRequired?: boolean;
  governanceRequired?: boolean;
  status?: AuthoritySurface['status'];
  legacyReason?: string | null;
  migrationTarget?: string | null;
  phase6bDisposition?: AuthoritySurface['phase6bDisposition'];
  adapterTarget?: string | null;
  quarantineHandler?: string | null;
  canonicalReplacement?: string | null;
  evidence?: string[];
}

/**
 * Phase 9A: `approvalRequired` and `quarantineHandler` used to be derived purely
 * from `authorityClass === 'LEGACY_QUARANTINED'`, for every BACKGROUND_WORKER
 * surface uniformly. That was a false claim: `legacyAuthorityAdapter.quarantine()`
 * is Express middleware — it can intercept an HTTP request/response cycle, but a
 * `kind: 'BACKGROUND_WORKER'` surface (`method: 'BACKGROUND'`, started from a
 * `setInterval` at process boot, see server/src/index.ts) has no such cycle for
 * anything to intercept. No BACKGROUND_WORKER surface may claim `approvalRequired:
 * true` or a `quarantineHandler` unless a `WorkerOverrides` argument explicitly
 * supplies one that names a real, code-verified runtime guard (see
 * background:self-healing-monitor above for the one surface currently fixed this
 * way). `governanceRequired` is a distinct, honest, forward-looking flag — "this
 * should eventually route through canonical governance" — and is not itself a
 * claim that current enforcement exists, so it is left keyed to `authorityClass`.
 */
function worker(id: string, sourcePath: string, runtimeMount: string, effectClass: AuthoritySurface['effectClass'], authorityClass: AuthoritySurface['authorityClass'], owner: string, capability: string, overrides: WorkerOverrides = {}): AuthoritySurface {
  return {
    id,
    kind: 'BACKGROUND_WORKER',
    sourcePath,
    runtimeMount,
    method: 'BACKGROUND',
    capability,
    effectClass,
    authorityClass,
    canonicalOwner: owner,
    projectScoped: false,
    externalSystem: effectClass.startsWith('EXTERNAL') ? 'notification/provider' : null,
    approvalRequired: overrides.approvalRequired ?? false,
    governanceRequired: overrides.governanceRequired ?? (authorityClass === 'LEGACY_QUARANTINED'),
    delegationEligible: false,
    authenticationRequired: 'INTERNAL_ONLY',
    status: overrides.status ?? (authorityClass === 'LEGACY_QUARANTINED' ? 'QUARANTINED' : authorityClass === 'INTERNAL_TEST_ONLY' ? 'TEST_ONLY' : authorityClass === 'ADAPTER_TO_CANONICAL' ? 'ADAPTED' : 'ACTIVE'),
    legacyReason: overrides.legacyReason !== undefined ? overrides.legacyReason : (authorityClass === 'LEGACY_QUARANTINED' ? 'Background mutation has no HTTP request/response cycle for the quarantine boundary to intercept; must be adapted to a canonical owner or given a code-verified runtime guard before its manifest entry may claim active enforcement.' : null),
    migrationTarget: overrides.migrationTarget !== undefined ? overrides.migrationTarget : (authorityClass === 'LEGACY_QUARANTINED' ? owner : null),
    phase6bDisposition: overrides.phase6bDisposition !== undefined ? overrides.phase6bDisposition : (authorityClass === 'LEGACY_QUARANTINED' ? 'QUARANTINE_ONLY' : authorityClass === 'ADAPTER_TO_CANONICAL' ? 'ADAPT_SAFE' : null),
    adapterTarget: overrides.adapterTarget !== undefined ? overrides.adapterTarget : (authorityClass === 'ADAPTER_TO_CANONICAL' ? 'LegacyAuthorityAdapter' : null),
    quarantineHandler: overrides.quarantineHandler !== undefined ? overrides.quarantineHandler : null,
    canonicalReplacement: overrides.canonicalReplacement !== undefined ? overrides.canonicalReplacement : (authorityClass === 'LEGACY_QUARANTINED' ? owner : authorityClass === 'ADAPTER_TO_CANONICAL' ? owner : null),
    lastAuthorityEvidence: null,
    evidence: overrides.evidence ?? ['server/src/index.ts startup wiring'],
  };
}

function canonicalOwnerForCli(name: string): string {
  if (name.includes('coding')) return 'Coding Engine control plane';
  if (name.includes('project-registry')) return 'Project Registry';
  if (name.includes('delegation')) return 'DelegationService';
  if (name.includes('phase5f')) return 'ControlledActionService';
  if (name.includes('phase5g')) return 'ActionPolicyEngine';
  if (name.includes('phase5h')) return 'GovernedOrchestrationService';
  if (name.includes('phase5i')) return 'DelegationService';
  return 'Personal OS';
}

export function discoverMountedRoutes(repoRoot = process.cwd()): DiscoveredRoute[] {
  const srcRoot = path.join(repoRoot, 'src');
  const indexPath = path.join(srcRoot, 'index.ts');
  const index = fs.readFileSync(indexPath, 'utf8');
  const imports = importedRouters(index);
  const routes: DiscoveredRoute[] = [];

  for (const appRoute of index.matchAll(APP_GET_RE)) {
    routes.push({
      method: appRoute[1].toUpperCase(),
      runtimeMount: normaliseRoute(appRoute[2]),
      sourcePath: 'src/index.ts',
      routerName: 'app',
      routePath: appRoute[2],
      line: lineOf(index, appRoute.index ?? 0),
    });
  }

  for (const mount of index.matchAll(MOUNT_RE)) {
    const prefix = mount[1];
    const args = mount[2];
    const routerName = [...imports.keys()].find(name => new RegExp(`\\b${name}\\b`).test(args));
    if (!routerName) continue;
    const sourcePath = imports.get(routerName);
    if (!sourcePath) continue;
    const abs = path.join(srcRoot, `${sourcePath}.ts`);
    if (!fs.existsSync(abs)) continue;
    const routerSource = fs.readFileSync(abs, 'utf8');
    for (const sub of routerSource.matchAll(ROUTE_RE)) {
      routes.push({
        method: sub[2].toUpperCase(),
        runtimeMount: normaliseRoute(`${prefix}/${sub[3]}`),
        sourcePath: `src/${sourcePath}.ts`.replace(/\\/g, '/'),
        routerName,
        routePath: sub[3],
        line: lineOf(routerSource, sub.index ?? 0),
      });
    }
  }

  return dedupe(routes);
}

export function assertAuthorityManifest(manifest: AuthorityManifest): void {
  const mutationUnknowns = manifest.surfaces.filter(item => isMutation(item.method, item.effectClass) && item.canonicalOwner === 'UNREGISTERED');
  if (mutationUnknowns.length) {
    throw new Error(`AUTHORITY_SURFACE_UNREGISTERED: ${mutationUnknowns.map(item => item.id).join(', ')}`);
  }
  const forbiddenMounted = manifest.surfaces.filter(item => item.authorityClass === 'FORBIDDEN' && item.status !== 'FORBIDDEN');
  if (forbiddenMounted.length) throw new Error(`AUTHORITY_FORBIDDEN_MOUNTED: ${forbiddenMounted.map(item => item.id).join(', ')}`);
  const externalBypass = manifest.surfaces.filter(item =>
    item.effectClass.startsWith('EXTERNAL') &&
    item.authorityClass !== 'CANONICAL_CONTROLLED_ACTION' &&
    item.authorityClass !== 'LEGACY_QUARANTINED' &&
    item.method !== 'GET'
  );
  if (externalBypass.length) throw new Error(`AUTHORITY_EXTERNAL_WRITE_BYPASS: ${externalBypass.map(item => item.id).join(', ')}`);
  const unresolvedLegacy = manifest.surfaces.filter(item =>
    isMutation(item.method, item.effectClass) &&
    (item.legacyReason || item.authorityClass === 'LEGACY_QUARANTINED') &&
    !item.phase6bDisposition
  );
  if (unresolvedLegacy.length) throw new Error(`LEGACY_AUTHORITY_UNRESOLVED: ${unresolvedLegacy.map(item => item.id).join(', ')}`);
  const adaptedWithoutTarget = manifest.surfaces.filter(item =>
    item.phase6bDisposition &&
    ['ADAPT_SAFE', 'ADAPT_WITH_BEHAVIOR_CHANGE'].includes(item.phase6bDisposition) &&
    !item.adapterTarget
  );
  if (adaptedWithoutTarget.length) throw new Error(`LEGACY_AUTHORITY_ADAPTER_MISSING: ${adaptedWithoutTarget.map(item => item.id).join(', ')}`);
  // Phase 9A: a BACKGROUND_WORKER surface has no HTTP request/response cycle for
  // legacyAuthorityAdapter.quarantine() to intercept — it cannot be required to
  // name that handler the way an HTTP_ROUTE surface legitimately can.
  const quarantinedWithoutHandler = manifest.surfaces.filter(item =>
    item.kind !== 'BACKGROUND_WORKER' &&
    item.phase6bDisposition &&
    ['QUARANTINE_ONLY', 'REQUIRES_FUTURE_AUTHORIZATION'].includes(item.phase6bDisposition) &&
    !item.quarantineHandler
  );
  if (quarantinedWithoutHandler.length) throw new Error(`LEGACY_AUTHORITY_QUARANTINE_HANDLER_MISSING: ${quarantinedWithoutHandler.map(item => item.id).join(', ')}`);
  // Phase 9A: no BACKGROUND_WORKER surface may claim approvalRequired: true or name
  // the HTTP-only quarantine handler — both are structurally false for a kind that
  // has nothing resembling a request/response cycle to gate. This is the permanent
  // guardrail against the exact manifest-vs-enforcement mismatch the Phase 9
  // discovery audit found recurring for any future background surface.
  const backgroundFalseEnforcementClaim = manifest.surfaces.filter(item =>
    item.kind === 'BACKGROUND_WORKER' &&
    (item.approvalRequired === true || item.quarantineHandler === 'legacyAuthorityAdapter.quarantine')
  );
  if (backgroundFalseEnforcementClaim.length) throw new Error(`LEGACY_AUTHORITY_BACKGROUND_FALSE_ENFORCEMENT_CLAIM: ${backgroundFalseEnforcementClaim.map(item => item.id).join(', ')}`);
}

function importedRouters(index: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const match of index.matchAll(IMPORT_RE)) {
    const named = match[1]?.split(',').map(v => v.trim().split(/\s+as\s+/).pop() || '').filter(Boolean) ?? [];
    const def = match[2] ? [match[2]] : [];
    const mod = match[3];
    for (const name of [...named, ...def]) {
      if (name.endsWith('Router') || name === 'companyOsRouter' || name === 'ceoObjectiveRouter') out.set(name, stripDotSlash(mod));
    }
  }
  return out;
}

function stripDotSlash(value: string): string {
  return value.replace(/^\.\//, '').replace(/^\.\.\//, '');
}

function normaliseRoute(value: string): string {
  return value.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
}

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split(/\r?\n/).length;
}

function dedupe(routes: DiscoveredRoute[]): DiscoveredRoute[] {
  const seen = new Set<string>();
  return routes.filter(route => {
    const key = `${route.method}:${route.runtimeMount}:${route.sourcePath}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
