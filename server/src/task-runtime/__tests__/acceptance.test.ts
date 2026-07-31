// Phase 1 acceptance test for the task runtime — run directly with tsx, not jest
// (matching this repo's existing tests/ convention, see CLAUDE.md "How to Test").
//
// Run: cd mi-core/server && npx tsx src/task-runtime/__tests__/acceptance.test.ts
//
// Scenario (matches the target architecture's Phase 1 acceptance test):
//   inspect a repository -> run a safe command -> store output as evidence ->
//   complete the task -> restart (new process/store instance) -> retrieve the
//   completed task and its evidence unchanged.

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import assert from 'assert';
import { TaskStore } from '../store';
import { TaskEngine } from '../engine';

function log(msg: string) {
  console.log(`[acceptance] ${msg}`);
}

function run() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-task-runtime-acceptance-'));
  log(`using isolated data dir: ${tmpDir}`);

  // ── Run 1: create, plan, execute, complete ────────────────────────────────
  let store = new TaskStore(tmpDir);
  let engine = new TaskEngine(store);

  const task = engine.createTask({
    userRequest: 'Inspect repository and report the Node.js version',
    repository: 'mi-core-system/master',
    workingDirectory: process.cwd(),
    riskLevel: 'read-only',
  });
  assert.strictEqual(task.status, 'CREATED');

  // Prove the state machine rejects illegal jumps before it accepts a legal path.
  assert.throws(() => engine.transition(task.id, 'COMPLETED'), /Illegal transition/);
  log('confirmed illegal transition CREATED -> COMPLETED is rejected');

  engine.transition(task.id, 'CONTEXT_BUILDING');
  engine.transition(task.id, 'PLANNING');
  engine.transition(task.id, 'READY');
  engine.transition(task.id, 'RUNNING');

  const { evidenceId, relativePath, exitCode } = engine.runCommandStep(task.id, 'node', ['--version']);
  assert.strictEqual(exitCode, 0, 'node --version should exit 0');
  const evidencePath = path.join(tmpDir, 'evidence', relativePath);
  assert.ok(fs.existsSync(evidencePath), 'evidence file should exist on disk');
  assert.strictEqual(evidenceId, 'step-1-command');

  const evidenceContent = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
  assert.ok(evidenceContent.stdout.trim().startsWith('v'), 'captured stdout should look like a node version string');
  log(`captured command evidence: ${evidenceContent.stdout.trim()}`);

  engine.transition(task.id, 'VALIDATING');
  engine.completeTask(task.id, 'Reported Node.js version successfully.');

  const eventsBeforeRestart = store.listEvents(task.id);
  assert.ok(eventsBeforeRestart.some(e => e.type === 'command.completed'), 'expected a command.completed event');
  assert.ok(eventsBeforeRestart.some(e => e.type === 'task.completed'), 'expected a task.completed event');

  // Simulate the process ending.
  store.close();
  log('closed store (simulated process end)');

  // ── Run 2: simulate restart with a fresh store instance over the same dir ─
  store = new TaskStore(tmpDir);
  const recovered = store.getTask(task.id);
  assert.ok(recovered, 'task should be retrievable after restart');
  assert.strictEqual(recovered!.status, 'COMPLETED', 'task status should survive restart');
  assert.strictEqual(recovered!.resultSummary, 'Reported Node.js version successfully.');
  assert.ok(recovered!.completedAt, 'completedAt should be set');

  const eventsAfterRestart = store.listEvents(task.id);
  assert.strictEqual(eventsAfterRestart.length, eventsBeforeRestart.length, 'event timeline should be unchanged after restart');

  assert.ok(fs.existsSync(evidencePath), 'evidence file should still exist after restart');
  const evidenceAfterRestart = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
  assert.deepStrictEqual(evidenceAfterRestart, evidenceContent, 'evidence content should be unchanged after restart');

  store.close();
  log('PASS — task created, executed, completed, and recovered intact after simulated restart');
  log(`evidence relative path: ${relativePath}`);

  fs.rmSync(tmpDir, { recursive: true, force: true });
}

try {
  run();
  process.exit(0);
} catch (err) {
  console.error('[acceptance] FAIL:', err);
  process.exit(1);
}
