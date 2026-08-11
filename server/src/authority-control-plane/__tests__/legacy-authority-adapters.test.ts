import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import express from 'express';
import type { AddressInfo } from 'net';
import { LegacyAuthorityAdapter, legacyMutationSurfaces } from '../legacy-adapter';
import { denyAuthorityMutation } from '../guard';
import { ControlledActionService } from '../../personal-os/actions/service';

async function run(): Promise<void> {
  process.env.MI_AUTHORITY_EVIDENCE_DISABLED = '1';
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'phase6b-adapter-'));
  const service = new ControlledActionService(root);
  try {
    const adapter = new LegacyAuthorityAdapter(process.cwd());
    const summary = adapter.migrationSummary();
    assert.strictEqual(summary.unresolved, 0, 'legacy mutation inventory has no unresolved items');
    assert.ok(summary.adapted > 0, 'at least one legacy mutation is adapted');
    assert.ok(summary.quarantined > 0, 'unsafe legacy mutations are quarantined');
    assert.strictEqual(legacyMutationSurfaces(adapter.manifest).filter(s => s.phase6bDisposition === null).length, 0);

    const draftA = adapter.adapt({
      surfaceId: 'http:POST:/api/approval/request',
      actor: 'test',
      root,
      service,
      projectId: 'mi-core',
      body: {
        risk_level: 2,
        category: 'gmail_draft',
        description: 'Create a draft',
        target: 'gmail',
        payload: {
          to: ['customer@example.com'],
          subject: 'Follow-up',
          body: 'Thanks for the call.',
          projectId: 'mi-core',
          sensitivity: 'PRIVATE',
        },
      },
    });
    assert.strictEqual(draftA.code, 'ADAPTED');
    assert.strictEqual(draftA.status, 201);
    assert.strictEqual(draftA.canonicalActionType, 'GMAIL_CREATE_DRAFT');
    assert.ok(draftA.canonicalProposalId?.startsWith('action-'));
    const proposal = service.get(draftA.canonicalProposalId!);
    assert.strictEqual(proposal.status, 'WAITING_APPROVAL');
    assert.strictEqual(proposal.actionType, 'GMAIL_CREATE_DRAFT');
    assert.strictEqual(proposal.projectId, 'mi-core');

    const draftB = adapter.adapt({
      surfaceId: 'http:POST:/api/approval/request',
      actor: 'test',
      root,
      service,
      projectId: 'mi-core',
      body: {
        risk_level: 2,
        category: 'gmail_draft',
        description: 'Create a draft',
        target: 'gmail',
        payload: {
          to: ['customer@example.com'],
          subject: 'Follow-up',
          body: 'Thanks for the call.',
          projectId: 'mi-core',
          sensitivity: 'PRIVATE',
        },
      },
    });
    assert.strictEqual(draftB.code, 'ADAPTED');
    assert.strictEqual(draftB.canonicalPayloadHash, draftA.canonicalPayloadHash, 'same normalized request has same canonical payload hash');

    const calendar = adapter.adapt({
      surfaceId: 'http:POST:/api/approval/request',
      actor: 'test',
      root,
      service,
      projectId: 'mi-core',
      body: {
        risk_level: 2,
        category: 'calendar_create',
        description: 'Create a calendar event',
        target: 'calendar',
        payload: {
          title: 'Ops review',
          start: '2026-08-12T09:00:00.000Z',
          end: '2026-08-12T09:30:00.000Z',
          timezone: 'Asia/Saigon',
          attendees: ['ops@example.com'],
          projectId: 'mi-core',
        },
      },
    });
    assert.strictEqual(calendar.code, 'ADAPTED');
    assert.strictEqual(calendar.canonicalActionType, 'CALENDAR_CREATE_EVENT');
    assert.strictEqual(service.get(calendar.canonicalProposalId!).requestedOperation, 'events.insert');

    const malformed = adapter.adapt({ surfaceId: 'http:POST:/api/approval/request', root, service, body: { category: 'gmail_draft', payload: { subject: 'x' } } });
    assert.strictEqual(malformed.code, 'CANONICAL_VALIDATION_FAILED');

    const missingProject = adapter.adapt({ surfaceId: 'http:POST:/api/approval/request', root, service, body: { category: 'calendar_create', payload: { title: 'x', start: 'bad', end: 'bad' } } });
    assert.strictEqual(missingProject.code, 'CANONICAL_VALIDATION_FAILED');

    const unsupported = adapter.adapt({ surfaceId: 'http:POST:/api/approval/request', root, service, body: { category: 'drive_upload', payload: { file: 'x' } } });
    assert.strictEqual(unsupported.code, 'UNSUPPORTED_SEMANTICS');

    const forbidden = adapter.adapt({ surfaceId: 'http:POST:/api/approval/request', root, service, body: { category: 'gmail_send', payload: { to: ['x@example.com'], subject: 'x', body: 'send now' } } });
    assert.strictEqual(forbidden.code, 'FORBIDDEN');
    assert.strictEqual(forbidden.canonicalProposalId, null);

    const quarantined = adapter.quarantine('http:POST:/api/browser/write', 'browser write blocked');
    assert.strictEqual(quarantined.code, 'QUARANTINED');
    assert.strictEqual(quarantined.legacyCompatible.error, 'LEGACY_AUTHORITY_QUARANTINED');

    const app = express();
    app.post('/browser-write', (_req, res) => denyAuthorityMutation(res, 'http:POST:/api/browser/write', 'browser write blocked'));
    const server = await new Promise<{ url: string; close: () => Promise<void> }>(resolve => {
      const s = app.listen(0, () => resolve({
        url: `http://127.0.0.1:${(s.address() as AddressInfo).port}`,
        close: () => new Promise<void>((done, fail) => s.close(err => err ? fail(err) : done())),
      }));
    });
    try {
      const res = await fetch(`${server.url}/browser-write`, { method: 'POST' });
      assert.strictEqual(res.status, 409);
      const body = await res.json() as { error: string; adapter: { code: string; surfaceId: string } };
      assert.strictEqual(body.error, 'LEGACY_AUTHORITY_QUARANTINED');
      assert.strictEqual(body.adapter.code, 'QUARANTINED');
      assert.strictEqual(body.adapter.surfaceId, 'http:POST:/api/browser/write');
    } finally {
      await server.close();
    }

    console.log('[legacy-authority-adapters] PASS', summary);
  } finally {
    service.close();
  }
}

run().catch(err => {
  console.error('[legacy-authority-adapters] FAIL:', err);
  process.exitCode = 1;
});
