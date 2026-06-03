'use strict';

/**
 * test-evidence-chain.js
 * End-to-end Evidence Chain test for Agent OS.
 *
 * No hardcoded PASS. Status determined by actual results.
 *
 * Test sequence:
 *  1. Create taskId
 *  2. Create log artifact
 *  3. Register artifact
 *  4. Write journal event
 *  5. Read journal event by taskId
 *  6. Validate artifact exists
 *  7. Output result
 */

const fs = require('fs');
const path = require('path');

// ── Load engines ───────────────────────────────────────────────────────────────

let artifactEngine, journalEngine;

try {
  artifactEngine = require('../master-artifacts/artifact-engine');
} catch (e) {
  console.error('FATAL: Cannot load master-artifacts/artifact-engine:', e.message);
  process.exit(1);
}

try {
  journalEngine = require('./journal-engine');
} catch (e) {
  console.error('FATAL: Cannot load master-journal/journal-engine:', e.message);
  process.exit(1);
}

// ── Generate unique taskId ────────────────────────────────────────────────────

const taskId = `TASK-${new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)}-${Math.random().toString(16).slice(2, 6).toUpperCase()}`;

// ── Test steps ────────────────────────────────────────────────────────────────

const result = {
  status: 'FAIL',
  taskId,
  artifactId: null,
  journalEventId: null,
  artifactPath: null,
  journalPath: null,
  steps: [],
  errors: [],
};

function step(name, fn) {
  try {
    const val = fn();
    result.steps.push({ name, status: 'PASS' });
    return val;
  } catch (e) {
    result.steps.push({ name, status: 'FAIL', error: e.message });
    result.errors.push(`[${name}] ${e.message}`);
    return null;
  }
}

// ── Step 1: Create taskId ────────────────────────────────────────────────────

step('1. Create taskId', () => {
  if (!taskId || !taskId.startsWith('TASK-')) {
    throw new Error(`Invalid taskId generated: ${taskId}`);
  }
  return taskId;
});

// ── Step 2: Create execution artifact via artifact-engine ─────────────────────

const executionData = step('2. Create execution artifact', () => {
  return artifactEngine.createArtifact(taskId, 'validation', {
    startTime: new Date().toISOString(),
    endTime: new Date().toISOString(),
    exitCode: 0,
    command: 'node test-evidence-chain.js',
    stdout: 'Evidence chain test executed.',
    stderr: '',
    logs: ['Test log entry 1', 'Test log entry 2'],
    report: 'All checks passed.',
  });
});

// ── Step 3: Register log artifact with manifest ──────────────────────────────

let logFilePath = null;
let logArtifactId = null;

step('3. Create temp log file', () => {
  const tmpDir = path.join(__dirname, '..', 'master-artifacts', 'artifacts', 'logs');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  logFilePath = path.join(tmpDir, `${taskId}-evidence.log`);
  const content = [
    `[${new Date().toISOString()}] [INFO] Evidence chain test started`,
    `[${new Date().toISOString()}] [INFO] Task ID: ${taskId}`,
    `[${new Date().toISOString()}] [INFO] Validation: PASS`,
  ].join('\n') + '\n';
  fs.writeFileSync(logFilePath, content, 'utf8');
  return logFilePath;
});

step('4. Register log artifact with manifest', () => {
  if (!logFilePath) throw new Error('logFilePath not set');
  const registered = artifactEngine.registerArtifact(taskId, logFilePath, 'log', {
    source: 'test-evidence-chain',
  });
  logArtifactId = registered.artifactId;
  result.artifactId = registered.artifactId;
  result.artifactPath = registered.path;
  return registered;
});

// ── Step 5: Write journal event ───────────────────────────────────────────────

step('5. Write journal event', () => {
  if (!logArtifactId) throw new Error('logArtifactId not set');
  if (!executionData) throw new Error('executionData not set');

  const exitCode = executionData.exitCode;
  const status = exitCode === 0 ? 'PASS' : (exitCode ? 'FAIL' : 'UNKNOWN');

  const eventId = journalEngine.createValidationEvent({
    taskId,
    status,
    artifacts: [logArtifactId],
    data: {
      exitCode,
      validation: status,
      source: 'test-evidence-chain',
    },
    actor: 'test-evidence-chain',
    project: 'E:\\Project\\Master',
  });

  result.journalEventId = eventId;

  // Record where the event was written
  const today = new Date().toISOString().slice(0, 10);
  result.journalPath = path.join(__dirname, 'events', `${today}.jsonl`);

  return eventId;
});

// ── Step 6: Read journal event by taskId ─────────────────────────────────────

step('6. Read journal event by taskId', () => {
  if (!taskId) throw new Error('taskId not set');
  const events = journalEngine.getEventsByTaskId(taskId);
  if (!events || events.length === 0) {
    throw new Error(`No journal events found for taskId: ${taskId}`);
  }
  const found = events[0];
  if (found.eventId !== result.journalEventId) {
    throw new Error(
      `Event ID mismatch. Expected: ${result.journalEventId}, Got: ${found.eventId}`
    );
  }
  if (found.status !== 'PASS') {
    throw new Error(`Expected status PASS, got: ${found.status}`);
  }
  return found;
});

// ── Step 7: Validate artifact exists ─────────────────────────────────────────

step('7. Validate artifact exists', () => {
  if (!logArtifactId) throw new Error('logArtifactId not set');
  const valid = artifactEngine.validateArtifactExists(logArtifactId);
  if (!valid) {
    throw new Error(`Artifact ${logArtifactId} failed validation`);
  }
  return true;
});

// ── Determine overall status ──────────────────────────────────────────────────

const failedSteps = result.steps.filter(s => s.status === 'FAIL');
if (failedSteps.length === 0) {
  result.status = 'PASS';
}

// ── Output ───────────────────────────────────────────────────────────────────

console.log(JSON.stringify(result, null, 2));

// ── Cleanup ──────────────────────────────────────────────────────────────────
// Remove the temp log file used for registration (the copy stays in artifacts/logs)

if (logFilePath && fs.existsSync(logFilePath)) {
  try { fs.unlinkSync(logFilePath); } catch (_) {}
}

// Exit with proper code
process.exit(result.status === 'PASS' ? 0 : 1);
