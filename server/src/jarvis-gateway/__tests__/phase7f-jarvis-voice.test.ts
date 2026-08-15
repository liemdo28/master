/**
 * Phase 7F — core voice test suite (`test:jarvis-voice`).
 *
 * Same isolated-tmpdir env pattern phase7c-jarvis-gateway.test.ts uses —
 * services.ts constructs canonical-service singletons at module-load time
 * using these env vars, so they must be set BEFORE any jarvis-gateway
 * module is required.
 */
import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function run(): Promise<void> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-7f-voice-'));
  process.env.MI_PERSONAL_OS_DIR = path.join(root, 'personal-os');
  process.env.MI_TASK_RUNTIME_DIR = path.join(root, 'task-runtime');
  process.env.MI_PROJECT_REGISTRY_DIR = path.join(root, 'project-registry');
  process.env.MI_PROJECT_REGISTRY_WORKSPACE_ROOTS = root;

  const { handleVoiceRequest } = require('../voice/voice-gateway');
  const { projectRegistry, taskEngine } = require('../services');

  let scenarios = 0;
  let passed = 0;
  const CALLER = { source: 'api_key' as const };

  const project = projectRegistry.registerProject({ displayName: 'Test Project', canonicalRoot: root });
  taskEngine.createTask({ userRequest: 'Fix the login bug', projectId: project.id });

  // ── Read question ────────────────────────────────────────────────────────
  {
    scenarios++;
    const res = await handleVoiceRequest({ transcript: 'what tasks are waiting on me', projectId: project.id, source: 'typed' }, CALLER);
    assert.strictEqual(res.safetyLabel, 'SAFE');
    assert.ok(res.gatewayResponse, 'must have a gateway response for a safe read');
    assert.strictEqual(res.gatewayResponse.intent, 'TASK_QUERY');
    assert.ok(res.spokenText.includes('Fix the login bug'));
    passed++;
  }

  // ── Project question ─────────────────────────────────────────────────────
  {
    scenarios++;
    const res = await handleVoiceRequest({ transcript: 'tell me about this project', projectId: project.id, source: 'typed' }, CALLER);
    assert.strictEqual(res.gatewayResponse.intent, 'PROJECT_QUERY');
    assert.ok(res.spokenText.includes('Test Project'));
    passed++;
  }

  // ── Knowledge (honest no-answer) ─────────────────────────────────────────
  {
    scenarios++;
    const res = await handleVoiceRequest({ transcript: 'find the documentation about deployment', projectId: project.id, source: 'typed' }, CALLER);
    assert.strictEqual(res.gatewayResponse.intent, 'KNOWLEDGE_SEARCH');
    assert.strictEqual(res.gatewayResponse.status, 'NO_SUPPORTED_ANSWER');
    passed++;
  }

  // ── Plan (advisory) ──────────────────────────────────────────────────────
  {
    scenarios++;
    const res = await handleVoiceRequest({ transcript: 'create a plan for the launch', projectId: project.id, source: 'typed', confidence: 0.9 }, CALLER);
    assert.strictEqual(res.gatewayResponse.intent, 'PLANNING');
    assert.notStrictEqual(res.gatewayResponse.status, 'WAITING_APPROVAL');
    passed++;
  }

  // ── Simulation ───────────────────────────────────────────────────────────
  {
    scenarios++;
    const res = await handleVoiceRequest({ transcript: 'simulate what would happen if I archived this project', projectId: project.id, source: 'typed', confidence: 0.9 }, CALLER);
    assert.strictEqual(res.gatewayResponse.intent, 'SIMULATION');
    assert.strictEqual(res.gatewayResponse.status, 'SIMULATED');
    assert.ok(res.spokenText.toLowerCase().includes('simulation'));
    passed++;
  }

  // ── Proposal preparation — always asks for exact fields, never approves ──
  {
    scenarios++;
    const res = await handleVoiceRequest({ transcript: 'draft an email to the team', source: 'typed', confidence: 0.9 }, CALLER);
    assert.strictEqual(res.gatewayResponse.intent, 'ACTION_PROPOSAL');
    assert.strictEqual(res.gatewayResponse.status, 'NEEDS_CLARIFICATION');
    passed++;
  }

  // ── Clarification: ambiguous/unresolvable project ───────────────────────
  {
    scenarios++;
    const res = await handleVoiceRequest({ transcript: 'fix a bug in a project that does not exist anywhere', source: 'typed', confidence: 0.9 }, CALLER);
    assert.strictEqual(res.gatewayResponse.status, 'NEEDS_CLARIFICATION');
    passed++;
  }

  // ── Low-confidence transcript on an action-shaped request — must NOT
  //    auto-progress, never reaches the Gateway at all ─────────────────────
  {
    scenarios++;
    const res = await handleVoiceRequest({ transcript: 'draft an email to the whole team about the merger', source: 'server_stt', confidence: 0.4 }, CALLER);
    assert.strictEqual(res.gatewayResponse, null, 'low-confidence action-shaped request must never reach the Gateway');
    assert.strictEqual(res.lowConfidenceClarification, true);
    passed++;
  }

  // ── Low-confidence transcript on a benign read — proceeds normally ───────
  {
    scenarios++;
    const res = await handleVoiceRequest({ transcript: 'what tasks are waiting on me', projectId: project.id, source: 'server_stt', confidence: 0.4 }, CALLER);
    assert.ok(res.gatewayResponse, 'benign read must still proceed even at low confidence');
    assert.strictEqual(res.lowConfidenceClarification, false);
    passed++;
  }

  // ── Unsupported/unknown language hint — still processed, language is
  //    diagnostic metadata only, never a routing/authority input ──────────
  {
    scenarios++;
    const res = await handleVoiceRequest({ transcript: 'what tasks are waiting on me', projectId: project.id, source: 'typed', language: 'xx-unsupported' }, CALLER);
    assert.ok(res.gatewayResponse);
    passed++;
  }

  // ── Voice-unavailable simulated (STT source, no confidence, no audio
  //    actually involved here since transcript-first — the contract itself
  //    never requires STT to have run) ──────────────────────────────────────
  {
    scenarios++;
    const res = await handleVoiceRequest({ transcript: 'what is the system health right now', source: 'typed' }, CALLER);
    assert.strictEqual(res.gatewayResponse.intent, 'SYSTEM_STATUS');
    passed++;
  }

  // ── TTS-unavailable path is exercised by the security/synthesize tests,
  //    not here — synthesizeVoiceOutput() gracefully reports { available:
  //    false } rather than throwing, checked in phase7f-jarvis-voice-security.test.ts.

  assert.strictEqual(passed, scenarios);
  console.log(`[phase7f-jarvis-voice] PASS — ${passed}/${scenarios} scenarios verified`);
}

run().catch(err => { console.error(err); process.exit(1); });
