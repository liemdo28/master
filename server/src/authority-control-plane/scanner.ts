import fs from 'fs';
import path from 'path';
import type { AuthorityManifest, AuthoritySurface, DiscoveredRoute } from './types';
import { classifyDiscoveredRoute, isMutation } from './registry';

const ROUTE_RE = /([A-Za-z0-9_]+)\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g;
const IMPORT_RE = /import\s+(?:\{([^}]+)\}|([A-Za-z0-9_]+))\s+from\s+['"]([^'"]+)['"]/g;
const MOUNT_RE = /app\.use\(\s*['"`]([^'"`]+)['"`]([\s\S]*?)\);/g;
const APP_GET_RE = /app\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g;

export function generateAuthorityManifest(repoRoot = process.cwd()): AuthorityManifest {
  const routes = discoverMountedRoutes(repoRoot);
  const surfaces = [
    ...routes.map(classifyDiscoveredRoute),
    ...discoverNonHttpSurfaces(repoRoot),
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
    worker('background:self-healing-scheduler', 'server/src/operations/self-healing.ts', 'startSelfHealingScheduler', 'SERVICE_CONTROL', 'LEGACY_QUARANTINED', 'Authority Control Plane', 'self-healing process/service-control observation'),
    worker('background:self-healing-monitor', 'server/src/company-os/self-healing-monitor.ts', 'startSelfHealingMonitor', 'SERVICE_CONTROL', 'LEGACY_QUARANTINED', 'Authority Control Plane', 'legacy service monitor'),
    worker('background:jarvis-proactive-monitor', 'server/src/jarvis/proactive-monitor.ts', 'startProactiveMonitor', 'EXTERNAL_REVERSIBLE', 'LEGACY_QUARANTINED', 'Daily Operating Loop', 'legacy proactive notifications'),
    worker('background:daily-briefing-scheduler', 'server/src/jarvis/daily-briefing-scheduler.ts', 'startDailyBriefingScheduler', 'EXTERNAL_REVERSIBLE', 'LEGACY_QUARANTINED', 'Daily Operating Loop', 'legacy daily WhatsApp briefing'),
    worker('background:leader-heartbeat', 'server/src/nodes/leader-lock-persistent.ts', 'startLeaderHeartbeat', 'LOCAL_REVERSIBLE', 'ADAPTER_TO_CANONICAL', 'Node leader lock', 'leader heartbeat'),
    worker('background:qb-online-watcher', 'server/src/jarvis/qb-online-watcher.ts', 'startQbOnlineWatcher', 'EXTERNAL_REVERSIBLE', 'LEGACY_QUARANTINED', 'Authority Control Plane', 'legacy QuickBooks online watcher notification'),
  ];

  return [...cliSurfaces, ...background];
}

function worker(id: string, sourcePath: string, runtimeMount: string, effectClass: AuthoritySurface['effectClass'], authorityClass: AuthoritySurface['authorityClass'], owner: string, capability: string): AuthoritySurface {
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
    approvalRequired: authorityClass === 'LEGACY_QUARANTINED',
    governanceRequired: authorityClass === 'LEGACY_QUARANTINED',
    delegationEligible: false,
    authenticationRequired: 'INTERNAL_ONLY',
    status: authorityClass === 'LEGACY_QUARANTINED' ? 'QUARANTINED' : authorityClass === 'INTERNAL_TEST_ONLY' ? 'TEST_ONLY' : authorityClass === 'ADAPTER_TO_CANONICAL' ? 'ADAPTED' : 'ACTIVE',
    legacyReason: authorityClass === 'LEGACY_QUARANTINED' ? 'Background mutation must be adapted to a canonical owner before expanding authority.' : null,
    migrationTarget: authorityClass === 'LEGACY_QUARANTINED' ? owner : null,
    phase6bDisposition: authorityClass === 'LEGACY_QUARANTINED' ? 'QUARANTINE_ONLY' : authorityClass === 'ADAPTER_TO_CANONICAL' ? 'ADAPT_SAFE' : null,
    adapterTarget: authorityClass === 'ADAPTER_TO_CANONICAL' ? 'LegacyAuthorityAdapter' : null,
    quarantineHandler: authorityClass === 'LEGACY_QUARANTINED' ? 'legacyAuthorityAdapter.quarantine' : null,
    canonicalReplacement: authorityClass === 'LEGACY_QUARANTINED' ? owner : authorityClass === 'ADAPTER_TO_CANONICAL' ? owner : null,
    lastAuthorityEvidence: null,
    evidence: ['server/src/index.ts startup wiring'],
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
  const quarantinedWithoutHandler = manifest.surfaces.filter(item =>
    item.phase6bDisposition &&
    ['QUARANTINE_ONLY', 'REQUIRES_FUTURE_AUTHORIZATION'].includes(item.phase6bDisposition) &&
    !item.quarantineHandler
  );
  if (quarantinedWithoutHandler.length) throw new Error(`LEGACY_AUTHORITY_QUARANTINE_HANDLER_MISSING: ${quarantinedWithoutHandler.map(item => item.id).join(', ')}`);
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
