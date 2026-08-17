/**
 * Phase 8A security — structural proof that every 8A containment actually
 * landed in source, matching the hard targets: unsafeTargetAllowed=0,
 * unauthenticatedAllowed=0, browserWriteReachable=0,
 * financialExecutionReachable=0, legacyMutationBypass=0, unknownMutations=0,
 * unresolvedLegacyMutations=0.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';

const SERVER_ROOT = path.resolve(__dirname, '..', '..');

function read(relToServerRoot: string): string {
  return fs.readFileSync(path.join(SERVER_ROOT, relToServerRoot), 'utf8');
}

function run(): void {
  const indexSrc = read('src/index.ts');

  // ── unauthenticatedAllowed=0: every mount found bare (no auth middleware)
  // in Phase 8 discovery must now carry requireTaskRuntimeAuth (the
  // always-enforced check — requireAuth alone is a no-op while MI_PIN is
  // unset, see routes/auth.ts). Only the four genuinely intentional
  // exceptions remain bare: /api/remote and /api/whatsapp (own auth),
  // /api/auth and /api/health (must be public).
  const previouslyUnauthenticatedMounts = [
    '/api/qb', '/api/models', '/api/agent-engine', '/api/integration-agent',
    '/api/data-analyst', '/api/skills', '/api/browser', '/api/doordash-agent',
    '/api/doordash', '/api/bigdata', '/api/enterprise', '/api/voice', '/api/gstack',
    '/api/mi', '/api/memory', '/api/tasks', '/api/strategic', '/api/agenview',
    '/api/seo', '/api/coo-v4', '/api/company-os', '/api/autonomous', '/api/council',
    '/api/improvement', '/api/health-intel', '/api/digital-twin', '/api/n8n',
    '/api/seo/gsc', '/api/analytics', '/api/gbp', '/api/engineering', '/api/ai',
    '/api/connectors', '/api/ceo',
  ];
  for (const mount of previouslyUnauthenticatedMounts) {
    const mountLineRe = new RegExp(`app\\.use\\('${mount.replace(/\//g, '\\/')}',\\s*requireTaskRuntimeAuth,`);
    assert.ok(mountLineRe.test(indexSrc), `${mount} must be mounted behind requireTaskRuntimeAuth`);
  }
  // /api/jarvis was previously mounted behind the no-op requireAuth; Phase 8A
  // upgraded it to the always-enforced check (Priority #8, legacy 49-route router).
  assert.ok(/app\.use\('\/api\/jarvis',\s*requireTaskRuntimeAuth,/.test(indexSrc), '/api/jarvis must be mounted behind requireTaskRuntimeAuth (upgraded from the no-op requireAuth)');

  // Genuinely-intentional exceptions must remain exactly as documented —
  // this guards against someone "fixing" a public/self-authenticated route
  // into double auth, and against silently losing the public health route.
  assert.ok(/app\.use\('\/api\/health',\s*healthPublicRouter\)/.test(indexSrc), '/api/health must remain public liveness-only');
  assert.ok(/app\.use\('\/api\/whatsapp',\s*whatsappRouter\)/.test(indexSrc), '/api/whatsapp must remain on its own validateApiKey() check, not double-gated');

  // ── unsafeTargetAllowed=0 / SSRF containment wired at both call sites ─────
  const browserAgentSrc = read('src/routes/browser-agent.ts');
  assert.ok(browserAgentSrc.includes("import { validateTargetUrl } from '../security/ssrf-policy'"), 'browser-agent.ts must import validateTargetUrl');
  assert.ok(/browserAgentRouter\.post\('\/extract'[\s\S]{0,400}validateTargetUrl\(url\)/.test(browserAgentSrc), '/extract must call validateTargetUrl(url) before dispatch');

  const aiPlatformSrc = read('src/routes/ai-platform.ts');
  assert.ok(aiPlatformSrc.includes("import { validateTargetUrl } from '../security/ssrf-policy'"), 'ai-platform.ts must import validateTargetUrl');
  assert.ok(/aiPlatformRouter\.post\('\/browser\/run'[\s\S]{0,1000}validateTargetUrl\(url\)/.test(aiPlatformSrc), '/browser/run must call validateTargetUrl(url) before dispatch');
  assert.ok(/aiPlatformRouter\.post\('\/browser\/smoke'[\s\S]{0,400}validateTargetUrl\(url\)/.test(aiPlatformSrc), '/browser/smoke must call validateTargetUrl(url) before dispatch');

  // ── browserWriteReachable=0: /api/browser/write remains hard-quarantined,
  // and /api/ai/browser/run rejects every write-shaped action before it
  // ever reaches runBrowserTask().
  assert.ok(/browserAgentRouter\.post\('\/write'[\s\S]{0,200}denyAuthorityMutation/.test(browserAgentSrc), '/api/browser/write must still call denyAuthorityMutation()');
  assert.ok(aiPlatformSrc.includes("WRITE_SHAPED_ACTION_TYPES = new Set(['click', 'fill', 'evaluate'])"), 'ai-platform.ts must define the write-shaped action blocklist');
  assert.ok(/writeShaped[\s\S]{0,200}status\(403\)/.test(aiPlatformSrc), '/browser/run must reject write-shaped actions with 403 before dispatch');
  // Order matters: the write-action check must run BEFORE validateTargetUrl
  // so a malicious write payload is rejected on shape alone, not only when
  // its target also happens to be unsafe.
  const runHandlerMatch = aiPlatformSrc.match(/aiPlatformRouter\.post\('\/browser\/run'[\s\S]*?\n\}\);/);
  assert.ok(runHandlerMatch, '/browser/run handler must exist');
  const runHandlerBody = runHandlerMatch![0];
  assert.ok(runHandlerBody.indexOf('writeShaped') < runHandlerBody.indexOf('validateTargetUrl'), 'write-shaped rejection must run before SSRF validation in /browser/run');

  // ── financialExecutionReachable=0: /api/qb only proxies GET reads, no
  // mutation route exists anywhere in the router.
  const qbSrc = read('src/routes/qb-financial.ts');
  assert.ok(!/qbFinancialRouter\.(post|put|patch|delete)\(/.test(qbSrc), '/api/qb must expose no mutation route (GET-only financial proxy)');

  // ── legacyMutationBypass=0: autonomous-task-runner remains hard-blocked
  // (re-confirms Phase 7A.1 containment holds under Phase 8A's changes —
  // /api/jarvis POST /approvals/:id/approve is the only caller).
  const runnerSrc = read('src/jarvis/autonomous-task-runner.ts');
  assert.ok(!runnerSrc.includes("from 'child_process'") && !runnerSrc.includes("require('child_process')"), 'autonomous-task-runner.ts must not import child_process');
  assert.ok((runnerSrc.match(/QUARANTINED_PHASE_7A1/g) || []).length >= 2, 'both runApprovedTask and runL1Task must still report the quarantine reason');

  // ── unknownMutations=0 / unresolvedLegacyMutations=0: authority manifest
  // reconciled after all of the above.
  const manifest = JSON.parse(read('authority-manifest.json')) as { counts: Record<string, number>; surfaces: Array<{ id: string; authorityClass: string; status: string; authenticationRequired: string }> };
  assert.strictEqual(manifest.counts.unknownMutations, 0, 'unknownMutations must be 0 after Phase 8A reconciliation');
  assert.strictEqual(manifest.counts.unresolvedLegacyMutations, 0, 'unresolvedLegacyMutations must be 0 after Phase 8A reconciliation');

  // Manifest-vs-reality: the three previously-falsely-QUARANTINED browser
  // routes must now report the real, non-QUARANTINED, authenticated state.
  for (const id of ['http:POST:/api/browser/extract', 'http:POST:/api/ai/browser/run', 'http:POST:/api/ai/browser/smoke']) {
    const surface = manifest.surfaces.find(s => s.id === id);
    assert.ok(surface, `${id} must be present in the authority manifest`);
    assert.notStrictEqual(surface!.status, 'QUARANTINED', `${id} must not falsely claim QUARANTINED status — it now runs contained, not blocked`);
    assert.strictEqual(surface!.authenticationRequired, 'STRICT_API_KEY', `${id} must report STRICT_API_KEY now that requireTaskRuntimeAuth is enforced`);
  }
  // /api/browser/write must remain genuinely QUARANTINED (it is actually blocked).
  const writeSurface = manifest.surfaces.find(s => s.id === 'http:POST:/api/browser/write');
  assert.ok(writeSurface, 'http:POST:/api/browser/write must be present in the authority manifest');
  assert.strictEqual(writeSurface!.status, 'QUARANTINED', '/api/browser/write must remain genuinely QUARANTINED');

  console.log('[phase8a-security] PASS', {
    // 35 distinct paths in this array + /api/jarvis = 36 distinct routes;
    // /api/models is mounted on two separate app.use() lines (both fixed),
    // so the actual line count in index.ts is 37 — see PHASE8A doc §3.
    distinctRoutesFixed: previouslyUnauthenticatedMounts.length + 1,
    unsafeTargetAllowed: 0,
    browserWriteReachable: 0,
    financialExecutionReachable: 0,
    legacyMutationBypass: 0,
    unknownMutations: manifest.counts.unknownMutations,
    unresolvedLegacyMutations: manifest.counts.unresolvedLegacyMutations,
  });
}

run();
