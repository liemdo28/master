import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { generateAuthorityManifest, assertAuthorityManifest } from './scanner';
import { LegacyAuthorityAdapter, legacyMutationSurfaces, validateLegacyAuthorityRuntime } from './legacy-adapter';
import { runLegacyAuthorityEvaluation } from './legacy-authority-evaluation';
import { ControlledActionService } from '../personal-os/actions/service';
import { resolveAuthorityRepoRoot } from './source-provenance';

function run(): void {
  process.env.MI_AUTHORITY_EVIDENCE_DISABLED = '1';
  const repoRoot = resolveAuthorityRepoRoot(process.cwd());
  const manifest = generateAuthorityManifest(repoRoot);
  assertAuthorityManifest(manifest);
  validateLegacyAuthorityRuntime(manifest);
  assert.strictEqual(manifest.counts.unknownMutations, 0, 'Phase 6A registry has zero unknown mutations');
  assert.strictEqual(manifest.counts.unresolvedLegacyMutations, 0, 'legacy mutations all resolved');

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'phase6b-acceptance-'));
  const service = new ControlledActionService(root);
  try {
    const adapter = new LegacyAuthorityAdapter(process.cwd());
    const legacy = legacyMutationSurfaces(manifest);
    assert.ok(legacy.length >= 50, 'legacy mutation inventory present');
    assert.ok(manifest.counts.adaptedLegacy > 0, 'some legacy surfaces adapted');
    assert.ok(manifest.counts.quarantinedLegacy > 0, 'unsafe legacy surfaces quarantined');

    const safe = adapter.adapt({
      surfaceId: 'http:POST:/api/approval/request',
      service,
      root,
      projectId: 'mi-core',
      body: {
        risk_level: 2,
        category: 'gmail_draft',
        description: 'Draft only',
        target: 'gmail',
        payload: { to: ['owner@example.com'], subject: 'Draft only', body: 'Draft body only.', projectId: 'mi-core' },
      },
    });
    assert.strictEqual(safe.code, 'ADAPTED');
    assert.strictEqual(safe.canonicalActionType, 'GMAIL_CREATE_DRAFT');
    assert.strictEqual(service.get(safe.canonicalProposalId!).status, 'WAITING_APPROVAL');

    const gmailSend = adapter.adapt({ surfaceId: 'http:POST:/api/approval/request', root, service, body: { category: 'gmail_send', payload: { to: ['x@example.com'], subject: 'x', body: 'x' } } });
    assert.strictEqual(gmailSend.code, 'FORBIDDEN');
    assert.strictEqual(gmailSend.canonicalProposalId, null);

    const calendar = adapter.adapt({
      surfaceId: 'http:POST:/api/approval/request',
      root,
      service,
      projectId: 'mi-core',
      body: {
        category: 'calendar_create',
        risk_level: 2,
        description: 'Calendar create',
        target: 'calendar',
        payload: { title: 'Review', start: '2026-08-12T12:00:00.000Z', end: '2026-08-12T12:30:00.000Z', timezone: 'Asia/Saigon', attendees: [], projectId: 'mi-core' },
      },
    });
    assert.strictEqual(calendar.code, 'ADAPTED');
    assert.strictEqual(service.get(calendar.canonicalProposalId!).actionType, 'CALENDAR_CREATE_EVENT');

    for (const [surfaceId, label] of [
      ['http:POST:/api/company-os/money/:workflow_id', 'financial execution'],
      ['http:POST:/api/nodes/:id/exec', 'process control'],
      ['http:POST:/api/browser/write', 'browser write'],
      ['http:POST:/api/voice/output/send', 'voice send'],
      ['http:POST:/api/n8n/trigger/:id', 'n8n generic trigger'],
    ] as const) {
      const result = adapter.quarantine(surfaceId, `${label} denied`);
      assert.strictEqual(result.code, 'QUARANTINED', label);
      assert.strictEqual(result.canonicalProposalId, null, label);
    }

    const fake = JSON.parse(JSON.stringify(manifest));
    const firstLegacyMutation = legacyMutationSurfaces(fake)[0];
    firstLegacyMutation.phase6bDisposition = null;
    assert.throws(() => validateLegacyAuthorityRuntime(fake), /LEGACY_AUTHORITY_UNRESOLVED/);

    const evaluation = runLegacyAuthorityEvaluation();
    assert.ok(evaluation.total >= 300);
    assert.strictEqual(evaluation.unsafeAdapted, 0);
    assert.strictEqual(evaluation.providerBypass, 0);
    assert.strictEqual(evaluation.shellProcessBypass, 0);
    assert.strictEqual(evaluation.financialExecution, 0);
    assert.strictEqual(evaluation.gmailSendExecution, 0);
    assert.strictEqual(evaluation.unknownLegacyMutation, 0);
    assert.strictEqual(evaluation.deterministicResults, true);

    console.log('[phase6b-acceptance] PASS', {
      total: manifest.counts.total,
      mutations: manifest.counts.mutations,
      legacyMutations: manifest.counts.legacyMutations,
      adapted: manifest.counts.adaptedLegacy,
      quarantined: manifest.counts.quarantinedLegacy,
      unresolved: manifest.counts.unresolvedLegacyMutations,
      evaluation,
    });
  } finally {
    service.close();
  }
}

run();
