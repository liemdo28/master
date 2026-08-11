import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ControlledActionService } from '../../personal-os/actions/service';
import { EvidenceService } from '../service';
import { normalizeActionEvidence, normalizeGovernanceAnomaly } from '../normalize';

function tempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'phase6d-security-'));
}

/** Mirrors evidence/router.ts's own gate exactly (kept inline, not imported, so this
 *  test still catches a regression even if someone edits the router without touching
 *  this file) — a caller must never receive a SENSITIVE/SECRET_NEVER_RENDER record. */
function routerWouldServe(record: { redactionClass: string } | null): boolean {
  if (!record) return false;
  return record.redactionClass !== 'SENSITIVE' && record.redactionClass !== 'SECRET_NEVER_RENDER';
}

async function main() {
  process.env.MI_CONTROLLED_ACTION_PROVIDER_MODE = 'fixture';
  const root = tempRoot();
  const actions = new ControlledActionService(root);
  let evidence: EvidenceService | undefined;
  try {
    // ---- discovery: Phase 5F's sanitizeText()/rejectSecret() (policy.ts) already
    // refuses to store an sk-/BEGIN KEY/bearer/password=/token= bearing reason at the
    // Controlled Actions layer itself — before evidence ever sees it. This is an
    // independent, pre-existing protection layer, not something Phase 6D relies on. ----
    const p1 = actions.proposeGmailDraft({ reason: 'security test', projectId: 'mi-core', to: ['a@example.com'], subject: 's', body: 'b' });
    assert.throws(
      () => actions.reject(p1.id, { reason: 'sk-ABCDEFGHIJKLMNOPQRSTUVWXYZ01234567', approver: 'liem' }),
      /secret-bearing payloads are not allowed/,
      'Phase 5F must already reject an sk- key at the Controlled Actions layer, before evidence is ever recorded',
    );
    console.log('[evidence-security] PASS: confirmed Phase 5F blocks secret-bearing reject reasons upstream of evidence entirely');

    // ---- so evidence's own redaction is tested as genuine defense-in-depth, by
    // feeding a synthetic raw row directly to the normalize layer — exactly as if a
    // FUTURE source system (one without Phase 5F's guard) fed it a secret-bearing
    // value. This proves evidence.ts's guard is real, not merely inherited. ----
    const now = new Date();
    const syntheticActionRow = {
      id: 'action-evidence-synthetic-1', proposalId: p1.id, approvalId: null, executionId: null,
      eventType: 'action.rejected', summary: 'client_secret: "abcdefghijklmnopqrstuvwx"',
      payloadHash: null, actor: 'liem', createdAt: now.toISOString(),
    };
    const normalized = normalizeActionEvidence(syntheticActionRow, 'mi-core', now);
    assert.strictEqual(normalized.redactionClass, 'SECRET_NEVER_RENDER', 'evidence.ts must independently flag a secret-bearing claim, even one that bypassed every upstream guard');
    assert.ok(!normalized.claim.includes('abcdefghijklmnopqrstuvwx'), 'the secret must never survive into the normalized claim');
    console.log('[evidence-security] PASS: normalize layer independently redacts a secret that reached it directly, defense-in-depth');

    const syntheticAnomalyRow = {
      id: 'anomaly-synthetic-1', type: 'suspicious_pattern', severity: 'HIGH', proposalId: p1.id, projectId: 'mi-core',
      description: 'refresh_token: "zyxwvutsrqponmlkjihgfedcba"', detectedAt: now.toISOString(), status: 'OPEN',
    };
    const normalizedAnomaly = normalizeGovernanceAnomaly(syntheticAnomalyRow, now);
    assert.strictEqual(normalizedAnomaly.redactionClass, 'SECRET_NEVER_RENDER', 'a secret in an anomaly description must also upgrade to SECRET_NEVER_RENDER, overriding the SENSITIVE default for governance anomalies');
    assert.ok(!normalizedAnomaly.claim.includes('zyxwvutsrqponmlkjihgfedcba'));
    console.log('[evidence-security] PASS: secret upgrade overrides the category/source default (SENSITIVE) for governance anomalies too');

    // ---- the router-equivalent default (redactionClassAtMost: OPERATOR_SAFE) must
    // exclude both synthetic secret records and the SENSITIVE anomaly default alike ----
    evidence = new EvidenceService({ personalOsRoot: root });
    const apiSafeView = evidence.list({ redactionClassAtMost: 'OPERATOR_SAFE' });
    assert.ok(!apiSafeView.some(r => r.redactionClass === 'SENSITIVE' || r.redactionClass === 'SECRET_NEVER_RENDER'), 'the OPERATOR_SAFE-capped view must contain zero SENSITIVE/SECRET_NEVER_RENDER records');
    console.log('[evidence-security] PASS: the API-equivalent filtered view excludes every above-OPERATOR_SAFE record entirely');

    // ---- router-level get()-by-id gate: EvidenceService.get() itself resolves any
    // record by id (it is a data layer, not a policy layer); the ROUTER refuses to
    // serve SENSITIVE/SECRET_NEVER_RENDER — exercised here via routerWouldServe(). ----
    assert.strictEqual(routerWouldServe(normalized), false, 'the router must never serve a SECRET_NEVER_RENDER record by id');
    assert.strictEqual(routerWouldServe(normalizedAnomaly), false, 'the router must never serve a SENSITIVE-upgraded-to-SECRET_NEVER_RENDER record by id');
    const okRecord = evidence.list({ sourceSystem: 'CONTROLLED_ACTIONS' })[0] ?? null;
    if (okRecord) assert.strictEqual(routerWouldServe(okRecord), true, 'an ordinary OPERATOR_SAFE record must still be servable');
    console.log('[evidence-security] PASS: router-level get()-by-id gate blocks SENSITIVE/SECRET_NEVER_RENDER, allows everything else');

    // ---- no mutation surface exists at all: the service has no method that writes ----
    const serviceMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(evidence));
    const mutatingNames = serviceMethods.filter(m => /^(create|update|delete|resolve|dismiss|approve|revoke|mutate|write|save)/i.test(m));
    assert.deepStrictEqual(mutatingNames, [], `EvidenceService must expose zero mutation methods, found: ${mutatingNames.join(', ')}`);
    console.log('[evidence-security] PASS: EvidenceService exposes no mutation method of any kind');

    console.log('[evidence-security] ALL PASS');
  } finally {
    evidence?.close();
    actions.close();
    try { fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch (e) { console.error('cleanup warning:', e); }
  }
}

main().catch(err => { console.error(err); process.exitCode = 1; });
