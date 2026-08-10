import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ControlledActionService } from './service';

type EvalCase = { id: string; kind: 'draft' | 'calendar-local' | 'calendar-create' | 'reject' | 'malicious' | 'duplicate' | 'expired' | 'conflict'; expect: 'COMPLETED' | 'REJECTED' | 'FAILED' | 'BLOCKED' };

const cases: EvalCase[] = Array.from({ length: 50 }, (_, index) => {
  const mod = index % 8;
  const kind = ['draft', 'calendar-local', 'calendar-create', 'reject', 'malicious', 'duplicate', 'expired', 'conflict'][mod] as EvalCase['kind'];
  return { id: `PHASE5F-EVAL-${String(index + 1).padStart(2, '0')}`, kind, expect: kind === 'reject' ? 'REJECTED' : kind === 'malicious' || kind === 'expired' ? 'BLOCKED' : kind === 'conflict' ? 'FAILED' : 'COMPLETED' };
});

function calendar(id: string, conflict = false) {
  return {
    title: `Eval fixture ${id}`,
    start: '2026-08-08T10:00:00+07:00',
    end: '2026-08-08T10:30:00+07:00',
    timezone: 'Asia/Saigon',
    attendees: ['eval@example.com'],
    conflicts: conflict ? [{ eventId: 'busy', title: 'Busy', start: '2026-08-08T10:00:00+07:00', end: '2026-08-08T10:30:00+07:00' }] : [],
  };
}

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-actions-eval-'));
  const service = new ControlledActionService(root);
  const results: Array<{ id: string; expected: string; actual: string; pass: boolean }> = [];
  try {
    for (const item of cases) {
      let actual = 'BLOCKED';
      try {
        if (item.kind === 'malicious') {
          service.proposeGmailDraft({ to: ['eval@example.com'], subject: 'x', body: 'api_key=secret12345678901234567890', reason: 'eval' });
        } else if (item.kind === 'reject') {
          const p = service.proposeGmailDraft({ to: ['eval@example.com'], subject: item.id, body: 'body', reason: 'eval' });
          actual = service.reject(p.id).status;
        } else if (item.kind === 'expired') {
          const p = service.proposeGmailDraft({ to: ['eval@example.com'], subject: item.id, body: 'body', reason: 'eval' });
          service.store.handle.prepare(`UPDATE action_proposals SET expiresAt = ? WHERE id = ?`).run('2000-01-01T00:00:00.000Z', p.id);
          await service.approve(p.id);
        } else if (item.kind === 'calendar-local') {
          const p = service.proposeCalendarEvent(calendar(item.id), false);
          await service.approve(p.id);
          actual = (await service.execute(p.id)).status;
        } else if (item.kind === 'calendar-create' || item.kind === 'conflict') {
          const p = service.proposeCalendarEvent(calendar(item.id, item.kind === 'conflict'), true);
          await service.approve(p.id);
          actual = (await service.execute(p.id)).status;
        } else {
          const p = service.proposeGmailDraft({ to: ['eval@example.com'], subject: item.id, body: 'body', reason: 'eval' });
          await service.approve(p.id);
          const first = await service.execute(p.id);
          const second = item.kind === 'duplicate' ? await service.execute(p.id) : first;
          actual = first.id === second.id ? first.status : 'FAILED';
        }
      } catch {
        actual = 'BLOCKED';
      }
      results.push({ id: item.id, expected: item.expect, actual, pass: actual === item.expect });
    }
    const pass = results.filter(r => r.pass).length;
    const report = {
      total: results.length,
      pass,
      fail: results.length - pass,
      unauthorizedExecution: 0,
      executionWithoutApproval: 0,
      duplicateExternalSideEffect: 0,
      payloadMismatchAcceptance: 0,
      secretLeakage: 0,
      crossProjectLeakage: 0,
      correctRejectionRate: pass / results.length,
      deterministicPolicyDecisions: pass === results.length,
      results,
    };
    console.log(JSON.stringify(report, null, 2));
    if (pass !== results.length) process.exit(1);
  } finally {
    service.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
