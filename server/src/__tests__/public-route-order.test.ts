/**
 * Regression test for the route-shadowing bug found during Phase 5E (see
 * docs/security/PHASE5E_UI_SECURITY.md): Express runs app.use('/api', ...,
 * requireTaskRuntimeAuth, ...) middleware for every '/api/*' path, and that
 * middleware 401s without calling next() — so any "intentionally public" route
 * registered AFTER a bare '/api' mount is permanently unreachable without the raw
 * API key, no matter what its own auth logic says. This is a fast, structural
 * (source-position) check rather than booting the full server, since index.ts
 * starts many long-running schedulers/services as a side effect of import.
 */
import assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

function run(): void {
  const source = fs.readFileSync(path.join(__dirname, '..', 'index.ts'), 'utf8');

  // The first bare '/api' catch-all mount — anything registered after this point
  // is shadowed for any path that isn't more specific than '/api' itself.
  // Anchored to line start (only actual statements, not this file's own explanatory
  // comments about the pattern, which would otherwise self-match).
  const bareApiMounts = [...source.matchAll(/^app\.use\('\/api',/gm)].map(m => m.index!);
  assert.ok(bareApiMounts.length > 0, 'expected at least one bare app.use(\'/api\', ...) mount to exist');
  const firstBareApiMount = Math.min(...bareApiMounts);

  for (const publicRoute of ['/api/remote', '/api/auth', '/api/health']) {
    const mountPattern = new RegExp(`app\\.use\\('${publicRoute.replace('/', '\\/')}'`);
    const match = source.match(mountPattern);
    assert.ok(match, `expected an app.use('${publicRoute}', ...) mount to exist`);
    const position = match!.index!;
    assert.ok(
      position < firstBareApiMount,
      `${publicRoute} must be mounted before the first bare '/api' catch-all — otherwise it is unreachable without the raw API key (see PHASE5E_UI_SECURITY.md)`,
    );
  }

  // Same rule applies to the Command Center bridge: '/api/command-center/*' also
  // starts with '/api', so it must be mounted before the bare catch-all too.
  const bridgeMount = source.match(/app\.use\('\/api\/command-center'/);
  assert.ok(bridgeMount, "expected the Command Center bridge mount to exist");
  assert.ok(
    bridgeMount!.index! < firstBareApiMount,
    "the Command Center bridge must be mounted before the first bare '/api' catch-all",
  );

  console.log('[public-route-order] PASS');
}

run();
