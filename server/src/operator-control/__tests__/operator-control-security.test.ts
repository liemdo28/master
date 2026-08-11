import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createOperatorControlRouter } from '../router';
import { dedupeOperatorItems, normalizeBlockedReason } from '../service';
import { hasSecretLeak, sanitizeRecord, sanitizeText } from '../redaction';
import type { OperatorItem } from '../types';

function main() {
  const router = createOperatorControlRouter({ personalOsRoot: fs.mkdtempSync(path.join(os.tmpdir(), 'phase6c-personal-')), taskRuntimeRoot: fs.mkdtempSync(path.join(os.tmpdir(), 'phase6c-task-')) });
  const methods = router.stack.map((layer: any) => Object.keys(layer.route?.methods ?? {})).flat();
  assert.ok(methods.length > 0, 'operator router exposes routes');
  assert.ok(methods.every(method => method === 'get'), 'operator router must be GET-only');

  const routerSource = fs.readFileSync(path.resolve(__dirname, '../router.ts'), 'utf8');
  for (const forbidden of ['router.post', 'router.patch', 'router.put', 'router.delete', 'approve', 'execute', 'bulk']) {
    assert.ok(!routerSource.includes(forbidden), `router must not include ${forbidden}`);
  }

  const indexSource = fs.readFileSync(path.resolve(__dirname, '../../index.ts'), 'utf8');
  assert.ok(indexSource.includes("requireRemoteAuth, operatorControlRouter"), 'Command Center operator bridge is session-auth gated');
  assert.ok(indexSource.includes("requireTaskRuntimeAuth, operatorControlRouter"), 'raw operator API is strict API-key gated');

  const bearerFixture = `Authorization: ${['Bearer', 'abcdefghijklmnopqrstuvwx'].join(' ')}`;
  const providerKeyFixture = `${['s', 'k'].join('')}-${'abcdefghijklmnop'}`;
  assert.strictEqual(sanitizeText(bearerFixture), 'Authorization: [redacted]');
  assert.strictEqual(sanitizeRecord({ apiKey: providerKeyFixture, title: 'ok' }).apiKey, '[redacted]');
  assert.strictEqual(hasSecretLeak({ text: sanitizeText(providerKeyFixture) }), false, 'sanitized output contains no secret-shaped token');

  const base = {
    sourceType: 'CONTROLLED_ACTION',
    sourceId: 'same',
    projectId: 'mi-core',
    title: 'x',
    summary: 'x',
    state: 'WAITING_ON_OPERATOR',
    urgency: 'HIGH',
    createdAt: '2026-08-11T00:00:00Z',
    updatedAt: '2026-08-11T00:00:00Z',
    expiresAt: null,
    actor: null,
    requestedBy: null,
    actionType: 'GMAIL_CREATE_DRAFT',
    targetSummary: 'same',
    risk: { effectClass: 'EXTERNAL_REVERSIBLE', riskClass: 'R2', approvalRequired: true, requiredApprovalLevel: 'STANDARD', governanceRequired: true, externalSystem: 'external', canExecuteWithoutHuman: false, canonicalRecheckRequired: true },
    authority: { actionType: 'GMAIL_CREATE_DRAFT', authorityClass: null, authoritySurfaceId: null, canonicalOwner: 'ControlledActionService', state: 'PER_ACTION_APPROVAL_REQUIRED', reason: 'WAITING_HUMAN_APPROVAL', details: [] },
    policyState: null,
    budgetState: null,
    killSwitchState: null,
    delegationState: null,
    planId: 'plan-1',
    stepId: null,
    blockedReason: 'WAITING_HUMAN_APPROVAL',
    evidenceRefs: [],
    allowedOperatorActions: ['open_controlled_action'],
  } satisfies OperatorItem;
  assert.strictEqual(dedupeOperatorItems([base, { ...base, id: 'duplicate', sourceType: 'ACTION_PLAN_STEP' }]).length, 1, 'linked plan/action items are deduped');
  assert.strictEqual(normalizeBlockedReason({ failureCode: 'PAYLOAD_HASH_MISMATCH' }), 'PAYLOAD_CHANGED');
  assert.strictEqual(normalizeBlockedReason({ failureCode: 'UNSUPPORTED_ACTION' }), 'FORBIDDEN_CAPABILITY');

  console.log('[operator-control-security] PASS');
}

main();
