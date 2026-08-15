import type { AuthRequirement, AuthorityClass, AuthorityStatus, EffectClass, AuthoritySurface, DiscoveredRoute, LegacyDisposition } from './types';

type Rule = {
  id: string;
  pattern: RegExp;
  methods?: string[];
  authorityClass: AuthorityClass;
  effectClass: EffectClass;
  canonicalOwner: string;
  auth: AuthRequirement;
  status?: AuthorityStatus;
  capability: string;
  projectScoped?: boolean;
  externalSystem?: string | null;
  approvalRequired?: boolean;
  governanceRequired?: boolean;
  delegationEligible?: boolean;
  legacyReason?: string | null;
  migrationTarget?: string | null;
  phase6bDisposition?: LegacyDisposition | null;
  adapterTarget?: string | null;
  quarantineHandler?: string | null;
  canonicalReplacement?: string | null;
  evidence: string[];
};

const CANONICAL_PREFIXES = [
  '/api/task-runtime',
  '/api/coding',
  '/api/actions',
  '/api/governance',
  '/api/orchestration',
  '/api/delegations',
  '/api/goals',
  '/api/personal',
  '/api/knowledge-documents',
  '/api/operating',
  '/api/intelligence',
  '/api/projects',
  '/api/command-center',
];

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export const AUTHORITY_RULES: Rule[] = [
  // Phase 7B: /api/health/detail and /api/health/dependencies are authenticated
  // (requireRemoteAuth at /api/command-center, requireTaskRuntimeAuth at bare
  // /api — see server/src/health-truth/detail-router.ts) and must be classified
  // before the public-read rule below, whose (health|...)(\/.*)? pattern would
  // otherwise wildcard-match these subpaths as PUBLIC_READ. Labeled
  // STRICT_API_KEY to match the same dual-mount convention already used for
  // 'automation-simulation' below.
  rule('health-detail', /^\/api\/(command-center\/)?health\/(detail|dependencies)$/, {
    authorityClass: 'CANONICAL_READ', effectClass: 'READ_ONLY', canonicalOwner: 'Health Truth Model', auth: 'STRICT_API_KEY',
    capability: 'authenticated structured health/dependency read model — never mutates, never a source of recovery authority',
    evidence: ['server/src/health-truth/detail-router.ts', 'server/src/index.ts requireRemoteAuth/requireTaskRuntimeAuth mounts'],
  }),
  // Only the bare, exact /api/health liveness route is genuinely public — the
  // (\/.*)? suffix used to also (incorrectly) cover any future /api/health/*
  // subpath; narrowed to an exact match so a new subpath must be explicitly
  // classified rather than silently defaulting to PUBLIC_READ.
  rule('public-read', /^\/api\/health$|^\/api\/(remote\/health|remote\/qr-data|auth\/google\/status|auth\/google\/start|auth\/google\/callback)(\/.*)?$/, {
    authorityClass: 'CANONICAL_READ', effectClass: 'READ_ONLY', canonicalOwner: 'Public health/auth bootstrap', auth: 'PUBLIC_READ', capability: 'public read/bootstrap',
    evidence: ['server/src/index.ts public routes mounted before bare /api'],
  }),
  rule('auth-local-session', /^\/api\/(auth|remote)(\/.*)?$/, {
    authorityClass: 'ADAPTER_TO_CANONICAL', effectClass: 'LOCAL_REVERSIBLE', canonicalOwner: 'Remote Auth', auth: 'REMOTE_SESSION', capability: 'session and device management',
    approvalRequired: false, governanceRequired: false, migrationTarget: 'Remote Auth', evidence: ['server/src/routes/auth.ts', 'server/src/routes/remote.ts'],
  }),
  rule('remote-short-mounted-session', /^\/api\/(login|logout|config|devices)(\/.*)?$/, {
    authorityClass: 'ADAPTER_TO_CANONICAL', effectClass: 'LOCAL_REVERSIBLE', canonicalOwner: 'Remote Auth', auth: 'REMOTE_SESSION', capability: 'remote session/device/config compatibility mount',
    approvalRequired: false, governanceRequired: false, migrationTarget: 'Remote Auth', evidence: ['server/src/routes/remote.ts'],
  }),
  rule('authority-read', /^\/api\/(command-center\/)?authority(\/.*)?$/, {
    authorityClass: 'CANONICAL_READ', effectClass: 'READ_ONLY', canonicalOwner: 'Authority Control Plane', auth: 'REMOTE_SESSION', capability: 'authority inventory read model',
    evidence: ['server/src/authority-control-plane/router.ts'],
  }),
  rule('operator-control-read', /^\/api\/(command-center\/)?operator(\/.*)?$/, {
    authorityClass: 'CANONICAL_READ', effectClass: 'READ_ONLY', canonicalOwner: 'OperatorControlService', auth: 'REMOTE_SESSION', capability: 'operator pending authority read model',
    evidence: ['server/src/operator-control/router.ts', 'server/src/operator-control/service.ts'],
  }),
  rule('task-runtime', /^\/api\/(command-center\/)?task-runtime(\/.*)?$/, {
    authorityClass: 'CANONICAL_LOCAL_MUTATION', effectClass: 'LOCAL_REVERSIBLE', canonicalOwner: 'Task Runtime', auth: 'STRICT_API_KEY', capability: 'task state and read-only command evidence',
    projectScoped: true, evidence: ['server/src/routes/task-runtime.ts', 'server/src/task-runtime/engine.ts'],
  }),
  // Phase 7C — canonical Jarvis Gateway. Orchestrates read/plan/simulate/
  // propose against the already-classified canonical subsystems above; it
  // never dispatches to a real external system itself (no direct provider
  // call, no ControlledActionService.execute()/.approve() — see
  // docs/security/PHASE7C_JARVIS_BOUNDARY.md). Classified the same way
  // 'automation-simulation' below is: a POST that only ever mutates a
  // bounded, ephemeral, in-process request/response cache, never a real
  // external system. Must be ordered before 'legacy-sensitive-local'
  // (whose /api/jarvis(\/.*)? wildcard would otherwise misclassify this as
  // a generic legacy compatibility adapter).
  rule('jarvis-gateway-request', /^\/api\/(command-center\/)?jarvis\/request$/, {
    authorityClass: 'CANONICAL_LOCAL_MUTATION', effectClass: 'LOCAL_REVERSIBLE', canonicalOwner: 'JarvisGateway', auth: 'STRICT_API_KEY', methods: ['POST'],
    capability: 'canonical Jarvis conversational gateway — read/plan/simulate/propose only, dispatches to already-classified canonical subsystems exclusively, never executes directly',
    evidence: ['server/src/jarvis-gateway/router.ts', 'server/src/jarvis-gateway/gateway.ts'],
  }),
  rule('jarvis-gateway-request-get', /^\/api\/(command-center\/)?jarvis\/request\/.+$/, {
    authorityClass: 'CANONICAL_READ', effectClass: 'READ_ONLY', canonicalOwner: 'JarvisGateway', auth: 'STRICT_API_KEY', methods: ['GET'],
    capability: 'retrieve a previously-generated Jarvis Gateway response from the bounded in-process cache',
    evidence: ['server/src/jarvis-gateway/router.ts', 'server/src/jarvis-gateway/request-store.ts'],
  }),
  // Phase 7D — read-only, and only ever the CALLER'S OWN session: the route
  // takes no client-suppliable session id, it re-derives the session key
  // server-side from the same resolveSessionId() function POST uses (see
  // docs/architecture/PHASE7D_CANONICAL_JARVIS_SESSION.md).
  rule('jarvis-gateway-session-get', /^\/api\/(command-center\/)?jarvis\/session\/current$/, {
    authorityClass: 'CANONICAL_READ', effectClass: 'READ_ONLY', canonicalOwner: 'JarvisGateway', auth: 'STRICT_API_KEY', methods: ['GET'],
    capability: 'retrieve the caller\'s own bounded, in-process Jarvis conversation session',
    evidence: ['server/src/jarvis-gateway/router.ts', 'server/src/jarvis-gateway/session-store.ts'],
  }),
  // Phase 7F — voice is a second input/output modality over the exact same
  // Gateway; these three routes carry request bodies (transcript text,
  // uploaded audio, text-to-synthesize) so they are structurally POST, but
  // none of them dispatch to a real external system or grant new authority
  // — same LOCAL_REVERSIBLE/bounded-in-process classification Phase 7C's
  // own 'jarvis-gateway-request' rule already established for the analogous
  // POST /jarvis/request. See docs/security/PHASE7F_VOICE_SECURITY.md.
  rule('jarvis-gateway-voice-transcript', /^\/api\/(command-center\/)?jarvis\/voice\/transcript$/, {
    authorityClass: 'CANONICAL_LOCAL_MUTATION', effectClass: 'LOCAL_REVERSIBLE', canonicalOwner: 'JarvisGateway', auth: 'STRICT_API_KEY', methods: ['POST'],
    capability: 'canonical voice entrypoint — normalizes a transcript, safety-labels it, and dispatches to handleGatewayRequest() exactly like a typed request; never executes directly',
    evidence: ['server/src/jarvis-gateway/router.ts', 'server/src/jarvis-gateway/voice/voice-gateway.ts'],
  }),
  rule('jarvis-gateway-voice-audio-transcribe', /^\/api\/(command-center\/)?jarvis\/voice\/audio-transcribe$/, {
    authorityClass: 'CANONICAL_LOCAL_MUTATION', effectClass: 'LOCAL_REVERSIBLE', canonicalOwner: 'JarvisGateway', auth: 'STRICT_API_KEY', methods: ['POST'],
    capability: 'uploads an audio file and returns a transcript only — never calls the Gateway, never persists audio beyond the single request',
    evidence: ['server/src/jarvis-gateway/router.ts', 'server/src/jarvis-gateway/voice/audio-transcribe.ts'],
  }),
  rule('jarvis-gateway-voice-synthesize', /^\/api\/(command-center\/)?jarvis\/voice\/synthesize$/, {
    authorityClass: 'CANONICAL_LOCAL_MUTATION', effectClass: 'LOCAL_REVERSIBLE', canonicalOwner: 'JarvisGateway', auth: 'STRICT_API_KEY', methods: ['POST'],
    capability: 'synthesizes already-redacted text to speech and returns audio bytes directly — never persists synthesized audio beyond the single request',
    evidence: ['server/src/jarvis-gateway/router.ts', 'server/src/jarvis-gateway/voice/synthesize.ts'],
  }),
  rule('coding', /^\/api\/(command-center\/)?coding(\/.*)?$/, {
    authorityClass: 'CANONICAL_LOCAL_MUTATION', effectClass: 'CODE_EXECUTION', canonicalOwner: 'Coding Engine control plane', auth: 'STRICT_API_KEY', capability: 'coding workflow under project registry constraints',
    projectScoped: true, evidence: ['server/src/routes/coding.ts', 'server/src/coding/workflow.ts'],
  }),
  rule('controlled-actions', /^\/api\/(command-center\/)?actions(\/.*)?$/, {
    authorityClass: 'CANONICAL_CONTROLLED_ACTION', effectClass: 'EXTERNAL_REVERSIBLE', canonicalOwner: 'ControlledActionService', auth: 'STRICT_API_KEY', capability: 'governed external action proposal/approval/execution',
    approvalRequired: true, governanceRequired: true, delegationEligible: true, externalSystem: 'gmail/calendar/sandboxed providers', evidence: ['server/src/personal-os/actions/router.ts'],
  }),
  rule('governance', /^\/api\/(command-center\/)?governance(\/.*)?$/, {
    authorityClass: 'CANONICAL_LOCAL_MUTATION', effectClass: 'LOCAL_REVERSIBLE', canonicalOwner: 'ActionPolicyEngine', auth: 'STRICT_API_KEY', capability: 'policy/budget/kill-switch decisions',
    governanceRequired: true, evidence: ['server/src/personal-os/actions/governance/router.ts'],
  }),
  rule('orchestration', /^\/api\/(command-center\/)?orchestration(\/.*)?$/, {
    authorityClass: 'CANONICAL_GOVERNED_ORCHESTRATION', effectClass: 'LOCAL_REVERSIBLE', canonicalOwner: 'GovernedOrchestrationService', auth: 'STRICT_API_KEY', capability: 'governed action plan DAG',
    approvalRequired: true, governanceRequired: true, delegationEligible: true, evidence: ['server/src/personal-os/orchestration/router.ts'],
  }),
  rule('automation-simulation', /^\/api\/(command-center\/)?simulation(\/.*)?$/, {
    authorityClass: 'CANONICAL_LOCAL_MUTATION', effectClass: 'LOCAL_REVERSIBLE', canonicalOwner: 'AutomationSimulationService', auth: 'STRICT_API_KEY',
    capability: 'governed automation simulation — answers "what WOULD happen"; zero real external side effect, zero execution-ledger/budget/delegation mutation; results are ephemeral, in-process, never persisted',
    governanceRequired: false, approvalRequired: false, delegationEligible: false,
    evidence: ['server/src/personal-os/automation-simulation/router.ts', 'server/src/personal-os/automation-simulation/service.ts'],
  }),
  rule('delegation', /^\/api\/(command-center\/)?delegations(\/.*)?$/, {
    authorityClass: 'CANONICAL_DELEGATED_AUTHORITY', effectClass: 'LOCAL_REVERSIBLE', canonicalOwner: 'DelegationService', auth: 'STRICT_API_KEY', capability: 'bounded delegated authority',
    approvalRequired: true, governanceRequired: true, delegationEligible: false, evidence: ['server/src/personal-os/delegation/router.ts'],
  }),
  rule('personal-os', /^\/api\/(command-center\/)?(personal|goals|daily-brief|knowledge)(\/.*)?$/, {
    authorityClass: 'CANONICAL_LOCAL_MUTATION', effectClass: 'LOCAL_REVERSIBLE', canonicalOwner: 'PersonalOsStore', auth: 'STRICT_API_KEY', capability: 'personal context, goals, memory and knowledge records',
    projectScoped: true, evidence: ['server/src/personal-os/router.ts'],
  }),
  rule('knowledge-os', /^\/api\/(command-center\/)?knowledge-documents(\/.*)?$/, {
    authorityClass: 'CANONICAL_LOCAL_MUTATION', effectClass: 'LOCAL_REVERSIBLE', canonicalOwner: 'KnowledgeDocumentService', auth: 'STRICT_API_KEY', capability: 'approved-root document ingestion and retrieval',
    projectScoped: true, evidence: ['server/src/personal-os/documents/router.ts'],
  }),
  rule('operating-loop', /^\/api\/(command-center\/)?operating(\/.*)?$/, {
    authorityClass: 'CANONICAL_LOCAL_MUTATION', effectClass: 'LOCAL_REVERSIBLE', canonicalOwner: 'Daily Operating Loop', auth: 'STRICT_API_KEY', capability: 'operating briefs/plans/reviews',
    projectScoped: true, evidence: ['server/src/personal-os/operating/router.ts'],
  }),
  rule('intelligence-read-derived', /^\/api\/(command-center\/)?intelligence(\/.*)?$/, {
    authorityClass: 'CANONICAL_LOCAL_MUTATION', effectClass: 'LOCAL_REVERSIBLE', canonicalOwner: 'Read-only Intelligence', auth: 'STRICT_API_KEY', capability: 'read-only connector summaries and derived agendas/reviews',
    projectScoped: true, evidence: ['server/src/intelligence/router.ts', 'server/src/intelligence/service.ts'],
  }),
  rule('project-registry', /^\/api\/(command-center\/)?projects(\/.*)?$/, {
    authorityClass: 'CANONICAL_LOCAL_MUTATION', effectClass: 'LOCAL_REVERSIBLE', canonicalOwner: 'Project Registry', auth: 'STRICT_API_KEY', capability: 'project registry, maps, context packs',
    projectScoped: true, evidence: ['server/src/routes/projects.ts', 'server/src/project-registry/service.ts'],
  }),
  rule('legacy-approval', /^\/api\/approval(\/.*)?$/, {
    authorityClass: 'LEGACY_QUARANTINED', effectClass: 'LOCAL_REVERSIBLE', canonicalOwner: 'ControlledActionService', auth: 'REMOTE_SESSION', capability: 'legacy approval queue without direct execution',
    approvalRequired: true, governanceRequired: false, status: 'ADAPTED_TO_CANONICAL', legacyReason: 'Old approval route overlapped with Phase 5 Controlled Actions and formerly dispatched external writes.', migrationTarget: 'ControlledActionService',
    phase6bDisposition: 'ADAPT_WITH_BEHAVIOR_CHANGE', adapterTarget: 'LegacyAuthorityAdapter', quarantineHandler: 'legacyAuthorityAdapter.quarantine', canonicalReplacement: '/api/actions/*',
    evidence: ['server/src/routes/approval.ts'],
  }),
  rule('legacy-voice-browser', /^\/api\/(voice|browser)(\/.*)?$/, {
    authorityClass: 'LEGACY_QUARANTINED', effectClass: 'EXTERNAL_REVERSIBLE', canonicalOwner: 'ControlledActionService', auth: 'REMOTE_SESSION', capability: 'legacy voice/browser side-effect surfaces blocked or read-limited',
    approvalRequired: true, governanceRequired: true, status: 'QUARANTINED', legacyReason: 'Voice/browser mutation must not expand in Phase 6A.', migrationTarget: 'future governed adapter',
    phase6bDisposition: 'QUARANTINE_ONLY', quarantineHandler: 'legacyAuthorityAdapter.quarantine',
    evidence: ['server/src/routes/voice.ts', 'server/src/routes/browser-agent.ts'],
  }),
  rule('legacy-autonomy', /^\/api\/(company-os|autonomous|council|improvement|ceo)(\/.*)?$/, {
    authorityClass: 'LEGACY_QUARANTINED', effectClass: 'LOCAL_REVERSIBLE', canonicalOwner: 'GovernedOrchestrationService', auth: 'REMOTE_SESSION', capability: 'legacy autonomous/company/control surfaces',
    approvalRequired: true, governanceRequired: true, status: 'QUARANTINED', legacyReason: 'Legacy autonomous-style surfaces are outside Phase 5 canonical authority.', migrationTarget: 'GovernedOrchestrationService',
    phase6bDisposition: 'QUARANTINE_ONLY', quarantineHandler: 'legacyAuthorityAdapter.quarantine',
    evidence: ['server/src/company-os/company-os-router.ts', 'server/src/autonomous/autonomous-router.ts'],
  }),
  rule('legacy-coo-v4', /^\/api\/coo-v4(\/.*)?$/, {
    authorityClass: 'LEGACY_QUARANTINED', effectClass: 'LOCAL_REVERSIBLE', canonicalOwner: 'GovernedOrchestrationService', auth: 'REMOTE_SESSION', capability: 'legacy COO planning/execution surface',
    approvalRequired: true, governanceRequired: true, status: 'QUARANTINED', legacyReason: 'COO V4 execution authority is outside Phase 5 canonical control plane.', migrationTarget: 'GovernedOrchestrationService',
    phase6bDisposition: 'QUARANTINE_ONLY', quarantineHandler: 'legacyAuthorityAdapter.quarantine',
    evidence: ['server/src/routes/coo-v4-router.ts'],
  }),
  rule('legacy-node-process-control', /^\/api\/nodes(\/.*)?$/, {
    authorityClass: 'LEGACY_QUARANTINED', effectClass: 'PROCESS_CONTROL', canonicalOwner: 'Authority Control Plane', auth: 'INTERNAL_ONLY', capability: 'node registration, heartbeat and process-control compatibility surface',
    approvalRequired: true, governanceRequired: true, status: 'QUARANTINED', legacyReason: 'Node process-control mutation must not be remotely executable without a future governed adapter.', migrationTarget: 'future governed operations adapter',
    phase6bDisposition: 'QUARANTINE_ONLY', quarantineHandler: 'legacyAuthorityAdapter.quarantine',
    evidence: ['server/src/routes/nodes.ts'],
  }),
  rule('legacy-process-workflow', /^\/api\/(operations|workflows|n8n|gstack|engineering|ai)(\/.*)?$/, {
    authorityClass: 'LEGACY_QUARANTINED', effectClass: 'PROCESS_CONTROL', canonicalOwner: 'Authority Control Plane', auth: 'REMOTE_SESSION', capability: 'legacy workflow/process/service-control surfaces',
    approvalRequired: true, governanceRequired: true, status: 'QUARANTINED', legacyReason: 'Process and workflow mutation must be classified before execution authority is used.', migrationTarget: 'future governed operations adapter',
    phase6bDisposition: 'QUARANTINE_ONLY', quarantineHandler: 'legacyAuthorityAdapter.quarantine',
    evidence: ['server/src/routes/operations.ts', 'server/src/n8n/n8n-router.ts'],
  }),
  rule('legacy-sensitive-local', /^\/api\/(memory|briefing|graph|brain|visibility|chat|jarvis|qb-agent|qb|reminders|knowledge|whatsapp|models|agent-engine|integration-agent|data-analyst|skills|doordash-agent|doordash|bigdata|enterprise|mi|tasks|strategic|agenview|seo|telemetry|executive-intelligence|analytics|gbp|connectors|executive|workspace|ceo-observer)(\/.*)?$/, {
    authorityClass: 'ADAPTER_TO_CANONICAL', effectClass: 'LOCAL_REVERSIBLE', canonicalOwner: 'Legacy compatibility adapter', auth: 'REMOTE_SESSION', capability: 'legacy read/local compatibility surface',
    approvalRequired: false, governanceRequired: false, status: 'ADAPTED', legacyReason: 'Mounted pre-Phase-5 compatibility surface; must not become a second canonical owner.', migrationTarget: 'Phase 5 canonical stores as applicable',
    phase6bDisposition: 'QUARANTINE_ONLY', quarantineHandler: 'legacyAuthorityAdapter.quarantine', canonicalReplacement: 'Phase 5 canonical stores as applicable',
    evidence: ['server/src/index.ts legacy mounts'],
  }),
  rule('legacy-simulation', /^\/api\/digital-twin(\/.*)?$/, {
    authorityClass: 'ADAPTER_TO_CANONICAL', effectClass: 'LOCAL_REVERSIBLE', canonicalOwner: 'Digital Twin simulation read model', auth: 'REMOTE_SESSION', capability: 'local simulation only',
    approvalRequired: false, governanceRequired: false, status: 'ADAPTED', legacyReason: 'Simulation surface mutates no external system.', migrationTarget: 'read-focused simulation adapter',
    phase6bDisposition: 'ADAPT_SAFE', adapterTarget: 'LegacyAuthorityAdapter', canonicalReplacement: 'read-focused simulation adapter',
    evidence: ['server/src/digital-twin/digital-twin-router.ts'],
  }),
  rule('static-ui', /^\/(command-center|liveboard|mobile|voice|agenview)(\/.*)?$/, {
    authorityClass: 'CANONICAL_READ', effectClass: 'READ_ONLY', canonicalOwner: 'Static UI', auth: 'PUBLIC_READ', capability: 'static UI document',
    evidence: ['server/src/index.ts static UI mounts'],
  }),
];

export function classifyDiscoveredRoute(route: DiscoveredRoute): AuthoritySurface {
  const mount = route.runtimeMount.replace(/\/+/g, '/');
  const match = AUTHORITY_RULES.find(item => item.pattern.test(mount) && (!item.methods || item.methods.includes(route.method)));
  if (!match) {
    return surfaceFrom(route, {
      authorityClass: route.method === 'GET' ? 'CANONICAL_READ' : 'FORBIDDEN',
      effectClass: route.method === 'GET' ? 'READ_ONLY' : 'LOCAL_REVERSIBLE',
      canonicalOwner: 'UNREGISTERED',
      auth: 'DISABLED',
      capability: 'unregistered runtime surface',
      status: route.method === 'GET' ? 'ACTIVE' : 'FORBIDDEN',
      legacyReason: route.method === 'GET' ? null : 'Mutation route is not registered in the authority control plane.',
      migrationTarget: null,
      evidence: ['AUTHORITY_SURFACE_UNREGISTERED'],
    });
  }
  const authorityClass = route.method === 'GET' && !CANONICAL_PREFIXES.some(p => mount.startsWith(p)) && match.authorityClass !== 'LEGACY_QUARANTINED'
    ? 'CANONICAL_READ'
    : match.authorityClass;
  const effectClass = route.method === 'GET' ? 'READ_ONLY' : match.effectClass;
  return surfaceFrom(route, { ...match, authorityClass, effectClass, status: match.status ?? statusFor(authorityClass) });
}

export function isMutation(method: string, effectClass: EffectClass): boolean {
  return MUTATION_METHODS.has(method) || effectClass !== 'READ_ONLY';
}

function rule(id: string, pattern: RegExp, input: Omit<Rule, 'id' | 'pattern' | 'projectScoped' | 'externalSystem' | 'approvalRequired' | 'governanceRequired' | 'delegationEligible' | 'legacyReason' | 'migrationTarget'> & Partial<Pick<Rule, 'projectScoped' | 'externalSystem' | 'approvalRequired' | 'governanceRequired' | 'delegationEligible' | 'legacyReason' | 'migrationTarget' | 'status' | 'methods'>>): Rule {
  return {
    id,
    pattern,
    projectScoped: false,
    externalSystem: null,
    approvalRequired: false,
    governanceRequired: false,
    delegationEligible: false,
    legacyReason: null,
    migrationTarget: null,
    ...input,
  };
}

function surfaceFrom(route: DiscoveredRoute, rule: Omit<Rule, 'id' | 'pattern' | 'methods'>): AuthoritySurface {
  const disposition = rule.phase6bDisposition ?? defaultDisposition(route, rule);
  const quarantineHandler = rule.quarantineHandler ?? (rule.authorityClass === 'LEGACY_QUARANTINED' ? 'legacyAuthorityAdapter.quarantine' : null);
  const adapterTarget = rule.adapterTarget ?? (rule.authorityClass === 'ADAPTER_TO_CANONICAL' || rule.status === 'ADAPTED_TO_CANONICAL' ? 'LegacyAuthorityAdapter' : null);
  return {
    id: `http:${route.method}:${route.runtimeMount}`,
    kind: 'HTTP_ROUTE',
    sourcePath: route.sourcePath,
    runtimeMount: route.runtimeMount,
    method: route.method,
    capability: rule.capability,
    effectClass: rule.effectClass,
    authorityClass: rule.authorityClass,
    canonicalOwner: rule.canonicalOwner,
    projectScoped: rule.projectScoped ?? false,
    externalSystem: rule.externalSystem ?? null,
    approvalRequired: rule.approvalRequired ?? false,
    governanceRequired: rule.governanceRequired ?? false,
    delegationEligible: rule.delegationEligible ?? false,
    authenticationRequired: route.runtimeMount.startsWith('/api/command-center')
      ? 'REMOTE_SESSION'
      : rule.auth,
    status: rule.status ?? statusFor(rule.authorityClass),
    legacyReason: rule.legacyReason ?? null,
    migrationTarget: rule.migrationTarget ?? null,
    phase6bDisposition: disposition,
    adapterTarget,
    quarantineHandler,
    canonicalReplacement: rule.canonicalReplacement ?? rule.migrationTarget ?? null,
    lastAuthorityEvidence: null,
    evidence: rule.evidence,
  };
}

export function defaultDisposition(route: DiscoveredRoute, rule: Omit<Rule, 'id' | 'pattern' | 'methods'>): LegacyDisposition | null {
  if (!rule.legacyReason && rule.authorityClass !== 'LEGACY_QUARANTINED' && rule.authorityClass !== 'ADAPTER_TO_CANONICAL') return null;
  if (rule.authorityClass === 'LEGACY_QUARANTINED') return 'QUARANTINE_ONLY';
  if (rule.authorityClass === 'ADAPTER_TO_CANONICAL') return 'ADAPT_SAFE';
  if (route.method === 'GET' || rule.effectClass === 'READ_ONLY') return 'ADAPT_SAFE';
  return null;
}

function statusFor(authorityClass: AuthorityClass): AuthorityStatus {
  if (authorityClass === 'FORBIDDEN') return 'FORBIDDEN';
  if (authorityClass === 'LEGACY_QUARANTINED') return 'QUARANTINED';
  if (authorityClass === 'ADAPTER_TO_CANONICAL') return 'ADAPTED';
  if (authorityClass === 'INTERNAL_TEST_ONLY') return 'TEST_ONLY';
  return 'ACTIVE';
}
