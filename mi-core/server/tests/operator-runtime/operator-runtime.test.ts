import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { evaluatePolicy } from '../../src/operator-runtime/policy-guard';
import { redactSensitiveText } from '../../src/operator-runtime/redaction';
import { runOperatorTask } from '../../src/operator-runtime/task-runner';
import { OperatorTaskInput } from '../../src/operator-runtime/types';

async function run() {
  const blocked = evaluatePolicy({
    task_id: 'OPS-BLOCK',
    objective_id: 'OBJ-BLOCK',
    mode: 'PRODUCTION_WRITE',
    adapter: 'playwright',
    target: { type: 'web', url: 'https://doordash.com' },
    actions: [],
    evidence_required: true,
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.status, 'BLOCKED_BY_POLICY');

  const redacted = redactSensitiveText('email me at test@example.com. cookie: abc authorization: bearer sometoken12345678901234567890. card 4111 1111 1111 1111');
  assert(redacted.redacted.includes('[REDACTED:email]'));
  assert(redacted.redactions.includes('cookie'));
  assert(redacted.redactions.includes('credit_card'));

  const publicReadTask: OperatorTaskInput = {
    task_id: 'OPS-0001',
    objective_id: 'OBJ-0001',
    mode: 'READ_ONLY',
    adapter: 'playwright',
    target: { type: 'web', url: 'https://example.com' },
    actions: [
      { type: 'navigate', url: 'https://example.com' },
      { type: 'read_title' },
      { type: 'screenshot' },
      { type: 'extract_links' },
    ],
    evidence_required: true,
  };

  const result = await runOperatorTask(publicReadTask);
  assert.equal(result.task_id, 'OPS-0001');
  assert(result.status === 'DONE' || result.status === 'FAILED');
  if (result.status === 'FAILED') {
    assert((result.errors || []).some((e) => String(e).includes('Playwright not initialized')));
  }
  assert(Array.isArray(result.evidence));

  const logPath = (result.evidence || []).find((p) => String(p).endsWith('log.json'));
  assert(logPath && fs.existsSync(logPath));

  const htmlPath = path.join(process.cwd(), '.local-agent-global', 'operator-runtime', 'html', 'OPS-0001.html');
  if (result.status === 'DONE') {
    assert(fs.existsSync(htmlPath));
  }

  console.log(JSON.stringify({ ok: true, blocked, redacted: redacted.redacted, result }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
