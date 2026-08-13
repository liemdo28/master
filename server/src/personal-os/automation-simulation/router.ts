/**
 * Phase 6F simulation API — §31/§32. Every route here only ever mutates
 * simulation-local, in-process, ephemeral state (a bounded result cache) — never
 * production authority/external systems. Schema stays v10: no persistence (§7/§43).
 */
import express, { Router } from 'express';
import { assertPlainPayload } from '../store';
import { AutomationSimulationService } from './service';
import type { SimulationInput, SimulationRun, SimulationStepInput } from './types';

export const simulationJsonParser = express.json({ limit: '256kb' });

const router = Router();
const service = new AutomationSimulationService();

const SIM_ID = /^sim-[0-9a-f-]{36}$/i;
const MAX_STEPS = 100;
const MAX_CACHE = 200;

// Bounded, in-process, ephemeral only — cleared on process restart, never a DB table.
const resultCache = new Map<string, SimulationRun>();
function cacheResult(run: SimulationRun): void {
  resultCache.set(run.simulationId, run);
  if (resultCache.size > MAX_CACHE) {
    const oldest = resultCache.keys().next().value;
    if (oldest) resultCache.delete(oldest);
  }
}

const ACTION_TYPES = new Set(['GMAIL_CREATE_DRAFT', 'CALENDAR_EVENT_PROPOSAL', 'CALENDAR_CREATE_EVENT', 'GMAIL_SEND_DRAFT']);
const STEP_TYPES = new Set(['READ_ONLY', 'LOCAL_COMPUTE', 'CONTROLLED_ACTION']);
const KIND_VALUES = new Set(['EXISTING_PLAN_SNAPSHOT', 'PROPOSED_PLAN', 'SINGLE_PROPOSAL', 'DELEGATED_CANDIDATE', 'POLICY_WHAT_IF']);
const SCENARIO_VALUES = new Set(['SUCCESS', 'VALIDATION_ERROR', 'TIMEOUT', 'RATE_LIMIT', 'UNAVAILABLE', 'AMBIGUOUS_RESULT', 'PARTIAL_FAILURE']);

/**
 * Strict, allowlist-only parsing (§32): a request may only ever select an already
 *-known action type / step type / provider scenario string from a fixed enum. There
 * is no field anywhere in this shape that names a module, class, function, shell
 * command, or URL — a malformed or hostile body can shape a bad simulation input, but
 * it can never make the simulator load or call anything beyond what's coded here.
 */
function parseSimulationInput(body: unknown): SimulationInput {
  assertPlainPayload(body);
  const raw = body as Record<string, unknown>;
  const kind = typeof raw.kind === 'string' && KIND_VALUES.has(raw.kind) ? raw.kind as SimulationInput['kind'] : 'SINGLE_PROPOSAL';
  const projectId = typeof raw.projectId === 'string' ? raw.projectId.slice(0, 120) : null;
  if (!Array.isArray(raw.steps) || raw.steps.length === 0) throw new Error('steps must be a non-empty array');
  if (raw.steps.length > MAX_STEPS) throw new Error(`steps must not exceed ${MAX_STEPS}`);

  const steps: SimulationStepInput[] = raw.steps.map((s, i) => {
    if (!s || typeof s !== 'object') throw new Error(`step[${i}] must be an object`);
    const step = s as Record<string, unknown>;
    const key = typeof step.key === 'string' && step.key.trim() ? step.key.trim().slice(0, 80) : `step-${i}`;
    const type = typeof step.type === 'string' && STEP_TYPES.has(step.type) ? step.type as SimulationStepInput['type'] : 'READ_ONLY';
    const description = typeof step.description === 'string' ? step.description.slice(0, 500) : `Step ${key}`;
    const actionType = typeof step.actionType === 'string' && ACTION_TYPES.has(step.actionType) ? step.actionType as SimulationStepInput['actionType'] : null;
    const providerScenario = typeof step.providerScenario === 'string' && SCENARIO_VALUES.has(step.providerScenario) ? step.providerScenario as SimulationStepInput['providerScenario'] : undefined;
    const dependsOnKeys = Array.isArray(step.dependsOnKeys) ? step.dependsOnKeys.filter((k): k is string => typeof k === 'string').slice(0, 20) : [];
    const actionPayload = step.actionPayload && typeof step.actionPayload === 'object' ? JSON.parse(JSON.stringify(step.actionPayload)) : null;
    return {
      key, type, description, dependsOnKeys, projectId: typeof step.projectId === 'string' ? step.projectId.slice(0, 120) : projectId,
      actionType, actionPayload,
      forbiddenCandidate: step.forbiddenCandidate === true,
      legacyQuarantinedSurfaceId: typeof step.legacyQuarantinedSurfaceId === 'string' ? step.legacyQuarantinedSurfaceId.slice(0, 200) : null,
      providerScenario,
      killSwitchOverrides: Array.isArray(step.killSwitchOverrides) ? step.killSwitchOverrides.slice(0, 5) as any : undefined,
      budgetOverrides: Array.isArray(step.budgetOverrides) ? step.budgetOverrides.slice(0, 5) as any : undefined,
      delegationOverride: step.delegationOverride && typeof step.delegationOverride === 'object' ? step.delegationOverride as any : null,
      concurrentCandidateCount: typeof step.concurrentCandidateCount === 'number' ? Math.max(1, Math.min(10, Math.round(step.concurrentCandidateCount))) : undefined,
    };
  });

  return { kind, projectId, steps };
}

router.post('/simulation/run', async (req, res) => {
  try {
    const input = parseSimulationInput(req.body);
    const run = await service.run(input);
    cacheResult(run);
    return res.status(200).json(run);
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get('/simulation/:id', (req, res) => {
  if (!SIM_ID.test(req.params.id)) return res.status(400).json({ error: 'invalid simulation id' });
  const run = resultCache.get(req.params.id);
  return run ? res.json(run) : res.status(404).json({ error: 'simulation run not found (ephemeral results are not persisted across restarts)' });
});

router.post('/simulation/compare', (req, res) => {
  try {
    assertPlainPayload(req.body);
    const ids = (req.body as { ids?: unknown }).ids;
    if (!Array.isArray(ids) || ids.length < 2 || ids.length > 10) {
      return res.status(400).json({ error: 'ids must be an array of 2-10 simulation ids' });
    }
    const runs = ids.map(id => {
      if (typeof id !== 'string' || !SIM_ID.test(id)) throw new Error('invalid simulation id in ids array');
      const run = resultCache.get(id);
      if (!run) throw new Error(`simulation run not found: ${id}`);
      return run;
    });
    return res.json({
      runs: runs.map(r => ({ simulationId: r.simulationId, overallOutcome: r.overallOutcome, inputHash: r.inputHash, sideEffectCount: r.sideEffectCount, blockedCount: r.blockedCount })),
      identicalInput: new Set(runs.map(r => r.inputHash)).size === 1,
      identicalOutcome: new Set(runs.map(r => r.overallOutcome)).size === 1,
    });
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export const automationSimulationRouter = router;
