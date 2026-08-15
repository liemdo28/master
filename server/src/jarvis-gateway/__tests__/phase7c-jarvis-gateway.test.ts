/**
 * Phase 7C — core Jarvis Gateway test suite (`test:jarvis-gateway`).
 *
 * Sets MI_PERSONAL_OS_DIR/MI_TASK_RUNTIME_DIR/MI_PROJECT_REGISTRY_DIR to an
 * isolated tmpdir BEFORE requiring any jarvis-gateway module (whose
 * services.ts constructs canonical-service singletons at module-load time
 * using these env vars) — matching the same env-var-before-import isolation
 * pattern project-registry/acceptance.ts already uses. Never touches
 * production data.
 */
import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function run(): Promise<void> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-7c-gateway-'));
  process.env.MI_PERSONAL_OS_DIR = path.join(root, 'personal-os');
  process.env.MI_TASK_RUNTIME_DIR = path.join(root, 'task-runtime');
  process.env.MI_PROJECT_REGISTRY_DIR = path.join(root, 'project-registry');
  process.env.MI_PROJECT_REGISTRY_WORKSPACE_ROOTS = root;

  const { handleGatewayRequest } = require('../gateway');
  const { projectRegistry, taskEngine, taskStore } = require('../services');

  let scenarios = 0;
  let passed = 0;
  const CALLER = { source: 'api_key' as const };

  // Seed a project and a task to query against.
  const project = projectRegistry.registerProject({ displayName: 'Test Project', canonicalRoot: root });
  taskEngine.createTask({ userRequest: 'Fix the login bug', projectId: project.id });

  // ── INFORMATION (may degrade if no provider reachable — both are valid) ──
  {
    scenarios++;
    const res = await handleGatewayRequest({ text: 'hello there' }, CALLER);
    assert.strictEqual(res.intent, 'INFORMATION');
    assert.ok(res.status === 'ANSWERED' || res.status === 'DEGRADED', `unexpected status ${res.status}`);
    passed++;
  }

  // ── TASK_QUERY ───────────────────────────────────────────────────────────
  {
    scenarios++;
    const res = await handleGatewayRequest({ text: 'what tasks are waiting on me', projectId: project.id }, CALLER);
    assert.strictEqual(res.intent, 'TASK_QUERY');
    assert.strictEqual(res.status, 'ANSWERED');
    assert.ok(res.answer.includes('Fix the login bug'));
    passed++;
  }

  // ── PROJECT_QUERY ────────────────────────────────────────────────────────
  {
    scenarios++;
    const res = await handleGatewayRequest({ text: 'tell me about this project', projectId: project.id }, CALLER);
    assert.strictEqual(res.intent, 'PROJECT_QUERY');
    assert.strictEqual(res.status, 'ANSWERED');
    assert.ok(res.answer.includes('Test Project'));
    passed++;
  }

  // ── GOAL_QUERY (no goals seeded — must answer honestly, not fabricate) ──
  {
    scenarios++;
    const res = await handleGatewayRequest({ text: 'what are my goals', projectId: project.id }, CALLER);
    assert.strictEqual(res.intent, 'GOAL_QUERY');
    assert.strictEqual(res.answer, 'No goals found for this project.');
    passed++;
  }

  // ── SYSTEM_STATUS ────────────────────────────────────────────────────────
  {
    scenarios++;
    const res = await handleGatewayRequest({ text: 'what is the system health' }, CALLER);
    assert.strictEqual(res.intent, 'SYSTEM_STATUS');
    assert.ok(res.healthImpact, 'must report healthImpact');
    passed++;
  }

  // ── OPERATOR_QUERY ───────────────────────────────────────────────────────
  {
    scenarios++;
    const res = await handleGatewayRequest({ text: 'what is pending approval' }, CALLER);
    assert.strictEqual(res.intent, 'OPERATOR_QUERY');
    assert.strictEqual(res.status, 'ANSWERED');
    passed++;
  }

  // ── PLANNING (advisory, no plans exist) ─────────────────────────────────
  {
    scenarios++;
    const res = await handleGatewayRequest({ text: 'create a plan for the launch', projectId: project.id }, CALLER);
    assert.strictEqual(res.intent, 'PLANNING');
    assert.strictEqual(res.status, 'NO_SUPPORTED_ANSWER');
    assert.ok(res.suggestedNextSteps.length > 0);
    passed++;
  }

  // ── SIMULATION ───────────────────────────────────────────────────────────
  {
    scenarios++;
    const res = await handleGatewayRequest({ text: 'simulate what would happen if I archived this project', projectId: project.id }, CALLER);
    assert.strictEqual(res.intent, 'SIMULATION');
    assert.strictEqual(res.status, 'SIMULATED');
    assert.ok(res.simulation?.simulationId);
    passed++;
  }

  // ── SIMULATION result is genuinely visible through the real public route's ──
  // ── own cache lookup — regression lock for a real bug Phase 7E found: two ──
  // ── separately-constructed AutomationSimulationService instances (one in ──
  // ── jarvis-gateway/services.ts, one in the router) never saw each other's ──
  // ── in-memory-only results, so a Jarvis-created simulationId 404'd when ──
  // ── fetched back through GET /simulation/:id. ──────────────────────────────
  {
    scenarios++;
    const { getCachedResult } = require('../../personal-os/automation-simulation/router');
    const res = await handleGatewayRequest({ text: 'simulate what would happen if I archived this project', projectId: project.id }, CALLER);
    const cached = getCachedResult(res.simulation!.simulationId);
    assert.ok(cached, 'a Jarvis-created simulation must be retrievable via the exact same lookup GET /simulation/:id uses');
    assert.strictEqual(cached.simulationId, res.simulation!.simulationId);
    passed++;
  }

  // ── ACTION_PROPOSAL — never guesses a target field ─────────────────────
  {
    scenarios++;
    const res = await handleGatewayRequest({ text: 'draft an email to the team' }, CALLER);
    assert.strictEqual(res.intent, 'ACTION_PROPOSAL');
    assert.strictEqual(res.status, 'NEEDS_CLARIFICATION');
    assert.deepStrictEqual(res.unknowns, ['to', 'subject', 'body']);
    passed++;
  }

  // ── CODING — needs a project ─────────────────────────────────────────────
  {
    scenarios++;
    const res = await handleGatewayRequest({ text: 'fix the login bug' }, CALLER);
    assert.strictEqual(res.intent, 'CODING');
    assert.strictEqual(res.status, 'NEEDS_CLARIFICATION');
    assert.deepStrictEqual(res.unknowns, ['projectId']);
    passed++;
  }

  // ── CODING — resolved project never mutates (creates no task/worktree) ──
  {
    scenarios++;
    const before = taskStore.listTasks().length;
    const res = await handleGatewayRequest({ text: 'fix the login bug', projectId: project.id }, CALLER);
    assert.strictEqual(res.intent, 'CODING');
    assert.strictEqual(res.status, 'ANSWERED');
    const after = taskStore.listTasks().length;
    assert.strictEqual(after, before, 'CODING must never create a task record');
    passed++;
  }

  // ── KNOWLEDGE_SEARCH — honest NO_SUPPORTED_ANSWER, no fabrication ───────
  {
    scenarios++;
    const res = await handleGatewayRequest({ text: 'find the documentation about deployment', projectId: project.id }, CALLER);
    assert.strictEqual(res.intent, 'KNOWLEDGE_SEARCH');
    assert.strictEqual(res.status, 'NO_SUPPORTED_ANSWER');
    assert.strictEqual(res.facts.length, 0, 'must never fabricate a fact when nothing was indexed');
    passed++;
  }

  // ── Clarification: unresolvable project name ────────────────────────────
  {
    scenarios++;
    const res = await handleGatewayRequest({ text: 'fix a bug in a project that does not exist anywhere' }, CALLER);
    assert.strictEqual(res.intent, 'CODING');
    assert.strictEqual(res.status, 'NEEDS_CLARIFICATION');
    passed++;
  }

  // ── Determinism: identical input twice → same intent/status ────────────
  {
    scenarios++;
    const a = await handleGatewayRequest({ text: 'what tasks are waiting on me', projectId: project.id }, CALLER);
    const b = await handleGatewayRequest({ text: 'what tasks are waiting on me', projectId: project.id }, CALLER);
    assert.strictEqual(a.intent, b.intent);
    assert.strictEqual(a.status, b.status);
    assert.strictEqual(a.answer, b.answer);
    passed++;
  }

  assert.strictEqual(passed, scenarios);
  console.log(`[phase7c-jarvis-gateway] PASS — ${passed}/${scenarios} scenarios verified`);
}

run().catch(err => { console.error(err); process.exit(1); });
