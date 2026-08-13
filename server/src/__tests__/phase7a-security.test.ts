/**
 * Phase 7A security — structural (import-graph/source-text) proof that the
 * three closed bypasses cannot regress silently, plus the standing global
 * invariants (no Gmail SEND, no financial action, no arbitrary shell
 * Controlled Action) still hold after Phase 7A's edits.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const SERVER_ROOT = path.resolve(__dirname, '..', '..');

function read(relToRepoRoot: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relToRepoRoot), 'utf8');
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function run(): void {
  // ── 7A.1: node-agent.mjs must never call execSync/child_process again ─────
  const nodeAgentSrc = stripComments(read('node-agent.mjs'));
  assert.ok(!nodeAgentSrc.includes('execSync'), 'node-agent.mjs must not call execSync anywhere');
  assert.ok(!nodeAgentSrc.includes("require('child_process')"), 'node-agent.mjs must not require child_process anywhere');
  assert.ok(nodeAgentSrc.includes('EXEC_RETIRED'), 'node-agent.mjs /exec must report EXEC_RETIRED');

  // ── 7A.2: autonomous-task-runner.ts must never import a shell primitive ───
  const runnerSrc = stripComments(read('server/src/jarvis/autonomous-task-runner.ts'));
  assert.ok(!runnerSrc.includes("from 'child_process'"), 'autonomous-task-runner.ts must not import child_process');
  assert.ok(!runnerSrc.includes('execAsync') && !runnerSrc.includes('execSync'), 'autonomous-task-runner.ts must not call any exec primitive');
  assert.ok((runnerSrc.match(/QUARANTINED_PHASE_7A1/g) || []).length >= 2, 'both runApprovedTask and runL1Task must report the quarantine reason');

  // ── 7A.3: approval/gate.ts must never import a provider/exec module ───────
  const gateSrc = stripComments(read('server/src/approval/gate.ts'));
  for (const forbidden of ['child_process', 'googleapis', 'whatsapp-sender', 'google-executor', 'gmail-action-adapter']) {
    assert.ok(!gateSrc.includes(forbidden), `approval/gate.ts must not import/reference ${forbidden}`);
  }

  // ── Standing invariants (unchanged by Phase 7A, re-verified) ───────────────
  const controlled = read('server/src/personal-os/actions/service.ts');
  assert.ok(controlled.includes("sendUpdates: 'none'"), 'calendar create keeps sendUpdates none');
  assert.ok(controlled.includes('GMAIL_SEND_DRAFT is documented but not implemented'), 'Gmail SEND remains hard-blocked');

  const actionTypes = read('server/src/personal-os/actions/types.ts');
  for (const forbidden of ['GMAIL_REPLY', 'GMAIL_FORWARD', 'FINANCIAL_TRANSFER', 'PURCHASE', 'SHELL_EXEC', 'RUN_COMMAND']) {
    assert.ok(!actionTypes.includes(forbidden), `forbidden action type absent from canonical ActionType union: ${forbidden}`);
  }

  // No arbitrary shell Controlled Action: the canonical governed pipeline's
  // provider dispatch (fake-providers.ts's real counterpart, service.ts) must
  // never itself shell out either.
  assert.ok(!stripComments(controlled).includes('child_process'), 'personal-os/actions/service.ts must not import child_process — no shell Controlled Action exists');

  // ── Authority manifest still clean after the Phase 7A edits ───────────────
  const manifestPath = path.join(SERVER_ROOT, 'authority-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { counts: Record<string, number> };
  assert.strictEqual(manifest.counts.unknownMutations, 0, 'unknownMutations must remain 0 after Phase 7A');
  assert.strictEqual(manifest.counts.unresolvedLegacyMutations, 0, 'unresolvedLegacyMutations must remain 0 after Phase 7A');

  console.log('[phase7a-security] PASS', {
    nodeAgentExecCallsRemaining: 0,
    autonomousRunnerExecCallsRemaining: 0,
    gateForbiddenImportsFound: 0,
    unknownMutations: manifest.counts.unknownMutations,
    unresolvedLegacyMutations: manifest.counts.unresolvedLegacyMutations,
  });
}

run();
