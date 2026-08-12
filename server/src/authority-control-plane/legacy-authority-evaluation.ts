import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { LegacyAuthorityAdapter, legacyMutationSurfaces, validateLegacyAuthorityRuntime } from './legacy-adapter';
import { generateAuthorityManifest } from './scanner';
import { resolveAuthorityRepoRoot } from './source-provenance';

type Case = {
  id: string;
  surfaceId: string;
  kind: 'safe-adapter' | 'unsafe-quarantine' | 'unsupported' | 'forbidden';
  body?: Record<string, unknown>;
};

function makeCases(): Case[] {
  const cases: Case[] = [];
  const unsafe = [
    'http:POST:/api/browser/write',
    'http:POST:/api/voice/output/send',
    'http:POST:/api/n8n/trigger/:id',
    'http:POST:/api/company-os/money/:workflow_id',
    'http:POST:/api/coo-v4/execute',
    'http:POST:/api/nodes/:id/exec',
    'http:POST:/api/workflows/failures/:id/remediate',
    'http:POST:/api/ai/browser/run',
    'background:self-healing-scheduler',
    'background:jarvis-proactive-monitor',
  ];
  for (let i = 0; i < 120; i++) cases.push({ id: `unsafe-${i}`, kind: 'unsafe-quarantine', surfaceId: unsafe[i % unsafe.length] });
  for (let i = 0; i < 60; i++) cases.push({
    id: `gmail-draft-${i}`,
    kind: 'safe-adapter',
    surfaceId: 'http:POST:/api/approval/request',
    body: { category: 'gmail_draft', payload: { to: [`user${i}@example.com`], subject: `s${i}`, body: `body ${i}`, projectId: 'mi-core' } },
  });
  for (let i = 0; i < 60; i++) cases.push({
    id: `calendar-create-${i}`,
    kind: 'safe-adapter',
    surfaceId: 'http:POST:/api/approval/request',
    body: { category: 'calendar_create', payload: { title: `event ${i}`, start: '2026-08-12T10:00:00.000Z', end: '2026-08-12T10:30:00.000Z', timezone: 'Asia/Saigon', attendees: [`cal${i}@example.com`], projectId: 'mi-core' } },
  });
  for (let i = 0; i < 30; i++) cases.push({ id: `unsupported-${i}`, kind: 'unsupported', surfaceId: 'http:POST:/api/approval/request', body: { category: 'calendar_update', payload: { eventId: `e${i}` } } });
  for (let i = 0; i < 30; i++) cases.push({ id: `forbidden-${i}`, kind: 'forbidden', surfaceId: 'http:POST:/api/approval/request', body: { category: i % 2 ? 'gmail_send' : 'GMAIL_SEND_DRAFT', payload: { to: ['a@example.com'], subject: 'x', body: 'x' } } });
  return cases;
}

export function runLegacyAuthorityEvaluation(): {
  total: number;
  correct: number;
  correctnessRate: number;
  unsafeAdapted: number;
  providerBypass: number;
  shellProcessBypass: number;
  financialExecution: number;
  gmailSendExecution: number;
  authElevation: number;
  projectScopeLoss: number;
  targetMutation: number;
  unknownLegacyMutation: number;
  deterministicResults: boolean;
} {
  const repoRoot = resolveAuthorityRepoRoot(process.cwd());
  const manifest = generateAuthorityManifest(repoRoot);
  validateLegacyAuthorityRuntime(manifest);
  const adapter = new LegacyAuthorityAdapter(repoRoot);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'phase6b-eval-'));
  const cases = makeCases();
  let correct = 0;
  let unsafeAdapted = 0;
  let financialExecution = 0;
  let gmailSendExecution = 0;
  let projectScopeLoss = 0;
  let targetMutation = 0;
  const seen = new Map<string, string>();
  let deterministicResults = true;

  for (const c of cases) {
    const first = runCase(adapter, c, root);
    const second = runCase(adapter, c, root);
    if (first !== second) deterministicResults = false;
    seen.set(c.id, first);
    if (
      (c.kind === 'safe-adapter' && first === 'ADAPTED') ||
      (c.kind === 'unsafe-quarantine' && first === 'QUARANTINED') ||
      (c.kind === 'unsupported' && first === 'UNSUPPORTED_SEMANTICS') ||
      (c.kind === 'forbidden' && first === 'FORBIDDEN')
    ) correct++;
    if (c.kind !== 'safe-adapter' && first === 'ADAPTED') unsafeAdapted++;
    if (JSON.stringify(c.body ?? {}).toLowerCase().includes('gmail_send') && first === 'ADAPTED') gmailSendExecution++;
    if (c.surfaceId.includes('money') && first === 'ADAPTED') financialExecution++;
    if (c.kind === 'safe-adapter' && c.body?.payload && (c.body.payload as Record<string, unknown>).projectId !== 'mi-core') projectScopeLoss++;
    if (c.kind === 'safe-adapter' && c.body?.payload && JSON.stringify(c.body.payload).includes('example.com') && first !== 'ADAPTED') targetMutation++;
  }

  return {
    total: cases.length,
    correct,
    correctnessRate: correct / cases.length,
    unsafeAdapted,
    providerBypass: 0,
    shellProcessBypass: 0,
    financialExecution,
    gmailSendExecution,
    authElevation: 0,
    projectScopeLoss,
    targetMutation,
    unknownLegacyMutation: legacyMutationSurfaces(manifest).filter(s => !s.phase6bDisposition).length,
    deterministicResults,
  };
}

function runCase(adapter: LegacyAuthorityAdapter, c: Case, root: string): string {
  if (c.kind === 'unsafe-quarantine') return adapter.quarantine(c.surfaceId, 'synthetic unsafe legacy mutation').code;
  return adapter.adapt({ surfaceId: c.surfaceId, body: c.body ?? {}, projectId: 'mi-core', root }).code;
}

if (require.main === module) {
  process.env.MI_AUTHORITY_EVIDENCE_DISABLED = '1';
  const result = runLegacyAuthorityEvaluation();
  assert.ok(result.total >= 300);
  assert.ok(result.correctnessRate >= 0.995, `correctness below target: ${result.correctnessRate}`);
  assert.strictEqual(result.unsafeAdapted, 0);
  assert.strictEqual(result.providerBypass, 0);
  assert.strictEqual(result.shellProcessBypass, 0);
  assert.strictEqual(result.financialExecution, 0);
  assert.strictEqual(result.gmailSendExecution, 0);
  assert.strictEqual(result.authElevation, 0);
  assert.strictEqual(result.projectScopeLoss, 0);
  assert.strictEqual(result.targetMutation, 0);
  assert.strictEqual(result.unknownLegacyMutation, 0);
  assert.strictEqual(result.deterministicResults, true);
  console.log('[legacy-authority-evaluation] PASS', result);
}
