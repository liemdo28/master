import assert from 'assert';
import { generateAuthorityManifest, assertAuthorityManifest } from './scanner';

function run(): void {
  const manifest = generateAuthorityManifest(process.cwd());
  assertAuthorityManifest(manifest);

  const byId = new Map(manifest.surfaces.map(surface => [surface.id, surface]));
  assert.ok(manifest.counts.total > 1000, 'authority registry loads and runtime routes are inventoried');
  assert.strictEqual(manifest.counts.unknownMutations, 0, 'every mutation classified');
  assert.ok(byId.get('http:GET:/api/health')?.effectClass === 'READ_ONLY', 'safe read routes unaffected');
  assert.ok(byId.get('http:POST:/api/task-runtime/tasks')?.canonicalOwner === 'Task Runtime', 'canonical task mutation allowed through Task Runtime');
  assert.ok(byId.get('http:POST:/api/projects/:id/map')?.canonicalOwner === 'Project Registry', 'project mutation uses Project Registry');
  assert.ok(byId.get('http:POST:/api/actions/:id/execute')?.canonicalOwner === 'ControlledActionService', 'external write chain terminates at ControlledActionService');
  assert.ok(byId.get('http:POST:/api/governance/evaluate')?.canonicalOwner === 'ActionPolicyEngine', 'governance chain intact');
  assert.ok(byId.get('http:POST:/api/delegations/evaluate')?.canonicalOwner === 'DelegationService', 'delegation chain intact');
  assert.ok(byId.get('http:POST:/api/approval/:id/approve')?.authorityClass === 'LEGACY_QUARANTINED', 'legacy adapter/quarantine active');
  assert.ok(byId.get('http:POST:/api/browser/write')?.authorityClass === 'LEGACY_QUARANTINED', 'browser write rejected');
  assert.ok(byId.get('http:POST:/api/n8n/trigger/:id')?.authorityClass === 'LEGACY_QUARANTINED', 'process/workflow exposure rejected');
  assert.ok(![...byId.keys()].some(id => id.includes('gmail_send')), 'no Gmail SEND route');
  assert.ok(manifest.surfaces.every(s => s.authorityClass !== 'FORBIDDEN'), 'forbidden routes are not mounted');

  console.log('[phase6a-acceptance] PASS', manifest.counts);
}

run();
