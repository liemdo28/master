import assert from 'assert';
import express from 'express';
import type { AddressInfo } from 'net';
import { generateAuthorityManifest, assertAuthorityManifest } from '../scanner';
import { denyUnregisteredMutation } from '../guard';

async function run(): Promise<void> {
  const manifest = generateAuthorityManifest(process.cwd());
  assertAuthorityManifest(manifest);

  assert.ok(manifest.counts.total >= 900, 'runtime route/worker inventory should be broad');
  assert.ok(manifest.counts.mutations > 0, 'mutation surfaces should be detected');
  assert.strictEqual(manifest.counts.unknownMutations, 0, 'no unknown mutation surfaces');
  assert.ok(manifest.surfaces.some(s => s.id === 'http:POST:/api/actions/:id/execute' && s.canonicalOwner === 'ControlledActionService'));
  assert.ok(manifest.surfaces.some(s => s.id === 'http:POST:/api/orchestration/plans/:id/advance' && s.authorityClass === 'CANONICAL_GOVERNED_ORCHESTRATION'));
  assert.ok(manifest.surfaces.some(s => s.id === 'http:POST:/api/delegations/:id/approve' && s.canonicalOwner === 'DelegationService'));
  assert.ok(manifest.surfaces.some(s => s.id === 'http:POST:/api/approval/:id/approve' && s.authorityClass === 'LEGACY_QUARANTINED'));
  assert.ok(manifest.surfaces.some(s => s.id === 'background:self-healing-scheduler' && s.authorityClass === 'LEGACY_QUARANTINED'));
  assert.ok(manifest.surfaces.some(s => s.id === 'cli:phase5i:acceptance' && s.canonicalOwner === 'DelegationService'));

  const app = express();
  app.post('/mutation', denyUnregisteredMutation);
  const server = await new Promise<{ url: string; close: () => Promise<void> }>(resolve => {
    const s = app.listen(0, () => {
      const port = (s.address() as AddressInfo).port;
      resolve({ url: `http://127.0.0.1:${port}`, close: () => new Promise<void>((res, rej) => s.close(err => err ? rej(err) : res())) });
    });
  });
  try {
    const res = await fetch(`${server.url}/mutation`, { method: 'POST' });
    assert.strictEqual(res.status, 403);
    const body = await res.json() as { error: string };
    assert.strictEqual(body.error, 'LEGACY_AUTHORITY_QUARANTINED');
  } finally {
    await server.close();
  }

  console.log('[authority-control-plane] PASS', manifest.counts);
}

run().catch(err => {
  console.error('[authority-control-plane] FAIL:', err);
  process.exitCode = 1;
});
