import assert from 'assert';
import fs from 'fs';
import { generateAuthorityManifest } from '../scanner';
import { isMutation } from '../registry';

function run(): void {
  const manifest = generateAuthorityManifest(process.cwd());
  const mutations = manifest.surfaces.filter(s => isMutation(s.method, s.effectClass));

  assert.strictEqual(manifest.counts.unknownMutations, 0);
  assert.strictEqual(mutations.filter(s => s.authenticationRequired === 'PUBLIC_READ').length, 0, 'mutation surface cannot be public');
  assert.strictEqual(mutations.filter(s => s.canonicalOwner === 'UNREGISTERED').length, 0, 'no unregistered mutation owner');
  assert.strictEqual(mutations.filter(s => s.authorityClass === 'FORBIDDEN' && s.status !== 'FORBIDDEN').length, 0);
  assert.strictEqual(mutations.filter(s => s.effectClass.startsWith('EXTERNAL') && s.authorityClass !== 'CANONICAL_CONTROLLED_ACTION' && s.authorityClass !== 'LEGACY_QUARANTINED').length, 0);
  assert.ok(manifest.surfaces.some(s => s.runtimeMount.includes('/api/browser/write') && s.authorityClass === 'LEGACY_QUARANTINED'));
  assert.ok(manifest.surfaces.some(s => s.runtimeMount.includes('/api/voice/output/send') && s.authorityClass === 'LEGACY_QUARANTINED'));
  assert.ok(manifest.surfaces.some(s => s.runtimeMount.includes('/api/company-os/money') && s.authorityClass === 'LEGACY_QUARANTINED'));
  assert.ok(manifest.surfaces.some(s => s.runtimeMount.includes('/api/n8n/trigger') && s.authorityClass === 'LEGACY_QUARANTINED'));

  const approvalRoute = fs.readFileSync('src/routes/approval.ts', 'utf8');
  assert.ok(!approvalRoute.includes('executeApprovedAction'), 'legacy approval route must not import direct provider executor');
  assert.ok(!approvalRoute.includes('markExecuted'), 'legacy approval route must not mark direct execution');

  const actionTypes = fs.readFileSync('src/personal-os/actions/types.ts', 'utf8');
  for (const forbidden of ['GMAIL_REPLY', 'GMAIL_FORWARD', 'FINANCIAL_TRANSFER', 'PURCHASE']) {
    assert.ok(!actionTypes.includes(forbidden), `no new action type ${forbidden}`);
  }

  const controlled = fs.readFileSync('src/personal-os/actions/service.ts', 'utf8');
  assert.ok(controlled.includes('GMAIL_SEND_DRAFT is documented but not implemented'), 'Gmail send stays blocked in ControlledActionService');
  assert.ok(controlled.includes("sendUpdates: 'none'"), 'Calendar write keeps sendUpdates none');

  console.log('[authority-control-plane-security] PASS', manifest.counts);
}

run();
