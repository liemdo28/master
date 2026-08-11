export type AuthorityClass =
  | 'CANONICAL_READ'
  | 'CANONICAL_LOCAL_MUTATION'
  | 'CANONICAL_CONTROLLED_ACTION'
  | 'CANONICAL_GOVERNED_ORCHESTRATION'
  | 'CANONICAL_DELEGATED_AUTHORITY'
  | 'ADAPTER_TO_CANONICAL'
  | 'LEGACY_QUARANTINED'
  | 'FORBIDDEN'
  | 'INTERNAL_TEST_ONLY';

export type EffectClass =
  | 'READ_ONLY'
  | 'LOCAL_REVERSIBLE'
  | 'LOCAL_IRREVERSIBLE'
  | 'EXTERNAL_REVERSIBLE'
  | 'EXTERNAL_IRREVERSIBLE'
  | 'PROCESS_CONTROL'
  | 'CODE_EXECUTION'
  | 'SERVICE_CONTROL';

export type AuthRequirement =
  | 'PUBLIC_READ'
  | 'STRICT_API_KEY'
  | 'REMOTE_SESSION'
  | 'INTERNAL_ONLY'
  | 'DISABLED';

export type AuthorityStatus = 'ACTIVE' | 'ADAPTED' | 'QUARANTINED' | 'FORBIDDEN' | 'TEST_ONLY';

export interface AuthoritySurface {
  id: string;
  kind: 'HTTP_ROUTE' | 'CLI_COMMAND' | 'BACKGROUND_WORKER' | 'EXECUTOR' | 'CONNECTOR' | 'STATIC_UI';
  sourcePath: string;
  runtimeMount: string;
  method: string;
  capability: string;
  effectClass: EffectClass;
  authorityClass: AuthorityClass;
  canonicalOwner: string;
  projectScoped: boolean;
  externalSystem: string | null;
  approvalRequired: boolean;
  governanceRequired: boolean;
  delegationEligible: boolean;
  authenticationRequired: AuthRequirement;
  status: AuthorityStatus;
  legacyReason: string | null;
  migrationTarget: string | null;
  evidence: string[];
}

export interface DiscoveredRoute {
  method: string;
  runtimeMount: string;
  sourcePath: string;
  routerName: string;
  routePath: string;
  line: number;
}

export interface AuthorityManifest {
  generatedAt: string;
  version: 'phase6a-v1';
  surfaces: AuthoritySurface[];
  counts: {
    total: number;
    readOnly: number;
    mutations: number;
    canonical: number;
    adapters: number;
    quarantined: number;
    forbidden: number;
    internalTest: number;
    unknownMutations: number;
  };
}
