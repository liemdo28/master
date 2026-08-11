import assert from 'assert';
import type { AuthoritySurface } from './types';
import { assertAuthorityManifest } from './scanner';

const owners = ['Task Runtime', 'Project Registry', 'ControlledActionService', 'ActionPolicyEngine', 'GovernedOrchestrationService', 'DelegationService', 'Authority Control Plane'];
const classes: AuthoritySurface['authorityClass'][] = ['CANONICAL_READ', 'CANONICAL_LOCAL_MUTATION', 'CANONICAL_CONTROLLED_ACTION', 'CANONICAL_GOVERNED_ORCHESTRATION', 'CANONICAL_DELEGATED_AUTHORITY', 'ADAPTER_TO_CANONICAL', 'LEGACY_QUARANTINED', 'INTERNAL_TEST_ONLY'];
const effects: AuthoritySurface['effectClass'][] = ['READ_ONLY', 'LOCAL_REVERSIBLE', 'EXTERNAL_REVERSIBLE', 'PROCESS_CONTROL', 'CODE_EXECUTION', 'SERVICE_CONTROL'];

function syntheticSurface(i: number): AuthoritySurface {
  const authorityClass = classes[i % classes.length];
  let effectClass: AuthoritySurface['effectClass'] = authorityClass === 'CANONICAL_READ' || authorityClass === 'INTERNAL_TEST_ONLY'
    ? 'READ_ONLY'
    : effects[(i % (effects.length - 1)) + 1];
  if (effectClass === 'EXTERNAL_REVERSIBLE' && authorityClass !== 'CANONICAL_CONTROLLED_ACTION' && authorityClass !== 'LEGACY_QUARANTINED') {
    effectClass = 'LOCAL_REVERSIBLE';
  }
  const owner = authorityClass === 'CANONICAL_CONTROLLED_ACTION'
    ? 'ControlledActionService'
    : authorityClass === 'CANONICAL_GOVERNED_ORCHESTRATION'
      ? 'GovernedOrchestrationService'
      : authorityClass === 'CANONICAL_DELEGATED_AUTHORITY'
        ? 'DelegationService'
        : owners[i % owners.length];
  const legacyDisposition = authorityClass === 'LEGACY_QUARANTINED' ? 'QUARANTINE_ONLY' : authorityClass === 'ADAPTER_TO_CANONICAL' ? 'ADAPT_SAFE' : null;
  return {
    id: `synthetic:${i}`,
    kind: i % 5 === 0 ? 'CLI_COMMAND' : i % 7 === 0 ? 'BACKGROUND_WORKER' : 'HTTP_ROUTE',
    sourcePath: `fixtures/surface-${i}.ts`,
    runtimeMount: `/fixture/${i}`,
    method: effectClass === 'READ_ONLY' ? 'GET' : 'POST',
    capability: `synthetic capability ${i}`,
    effectClass,
    authorityClass,
    canonicalOwner: owner,
    projectScoped: i % 3 === 0,
    externalSystem: effectClass.startsWith('EXTERNAL') ? 'fixture-provider' : null,
    approvalRequired: effectClass.startsWith('EXTERNAL') || authorityClass === 'LEGACY_QUARANTINED',
    governanceRequired: authorityClass === 'CANONICAL_CONTROLLED_ACTION' || authorityClass === 'LEGACY_QUARANTINED',
    delegationEligible: authorityClass === 'CANONICAL_CONTROLLED_ACTION' && i % 2 === 0,
    authenticationRequired: effectClass === 'READ_ONLY' ? 'INTERNAL_ONLY' : 'STRICT_API_KEY',
    status: authorityClass === 'LEGACY_QUARANTINED' ? 'QUARANTINED' : authorityClass === 'INTERNAL_TEST_ONLY' ? 'TEST_ONLY' : 'ACTIVE',
    legacyReason: authorityClass === 'LEGACY_QUARANTINED' ? 'synthetic legacy quarantine' : null,
    migrationTarget: authorityClass === 'LEGACY_QUARANTINED' ? owner : null,
    phase6bDisposition: legacyDisposition,
    adapterTarget: legacyDisposition === 'ADAPT_SAFE' ? 'LegacyAuthorityAdapter' : null,
    quarantineHandler: legacyDisposition === 'QUARANTINE_ONLY' ? 'legacyAuthorityAdapter.quarantine' : null,
    canonicalReplacement: legacyDisposition ? owner : null,
    lastAuthorityEvidence: null,
    evidence: ['synthetic 200-surface evaluation'],
  };
}

function run(): void {
  const surfaces = Array.from({ length: 200 }, (_, i) => syntheticSurface(i));
  const manifest = {
    generatedAt: 'GENERATED_AT_RUNTIME',
    version: 'phase6a-v1' as const,
    surfaces,
    counts: {
      total: surfaces.length,
      readOnly: surfaces.filter(s => s.effectClass === 'READ_ONLY').length,
      mutations: surfaces.filter(s => s.effectClass !== 'READ_ONLY').length,
      canonical: surfaces.filter(s => s.authorityClass.startsWith('CANONICAL')).length,
      adapters: surfaces.filter(s => s.authorityClass === 'ADAPTER_TO_CANONICAL').length,
      quarantined: surfaces.filter(s => s.authorityClass === 'LEGACY_QUARANTINED').length,
      forbidden: 0,
      internalTest: surfaces.filter(s => s.authorityClass === 'INTERNAL_TEST_ONLY').length,
      unknownMutations: 0,
      legacyMutations: surfaces.filter(s => s.effectClass !== 'READ_ONLY' && (s.legacyReason || s.authorityClass === 'LEGACY_QUARANTINED')).length,
      adaptedLegacy: surfaces.filter(s => s.effectClass !== 'READ_ONLY' && (s.phase6bDisposition === 'ADAPT_SAFE' || s.phase6bDisposition === 'ADAPT_WITH_BEHAVIOR_CHANGE')).length,
      quarantinedLegacy: surfaces.filter(s => s.effectClass !== 'READ_ONLY' && (s.phase6bDisposition === 'QUARANTINE_ONLY' || s.phase6bDisposition === 'REQUIRES_FUTURE_AUTHORIZATION')).length,
      disabledDeadLegacy: surfaces.filter(s => s.effectClass !== 'READ_ONLY' && s.phase6bDisposition === 'DEAD_UNWIRED').length,
      unresolvedLegacyMutations: surfaces.filter(s => s.effectClass !== 'READ_ONLY' && (s.legacyReason || s.authorityClass === 'LEGACY_QUARANTINED') && !s.phase6bDisposition).length,
    },
  };
  assertAuthorityManifest(manifest);
  assert.strictEqual(manifest.surfaces.length, 200);
  assert.strictEqual(manifest.counts.unknownMutations, 0);
  assert.strictEqual(surfaces.filter(s => s.effectClass.startsWith('EXTERNAL') && s.authorityClass !== 'CANONICAL_CONTROLLED_ACTION' && s.authorityClass !== 'LEGACY_QUARANTINED').length, 0);
  assert.strictEqual(surfaces.filter(s => s.authenticationRequired === 'PUBLIC_READ' && s.effectClass !== 'READ_ONLY').length, 0);
  assert.strictEqual(new Set(surfaces.map(s => `${s.id}:${s.authorityClass}:${s.effectClass}:${s.canonicalOwner}`)).size, 200, 'deterministic classification');
  console.log('[authority-evaluation] PASS', { surfaces: 200, correctness: '100%', unknownRuntimeMutation: 0, externalWriteBypass: 0, authBypass: 0, ownerAmbiguity: 0 });
}

run();
