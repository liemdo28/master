/**
 * SIMULATION — directive §17. "Simulation-first side-effect path": any
 * request implying a side effect is represented through the canonical
 * Phase 6F AutomationSimulationService, never executed. Simulation must
 * never become execution — this handler only ever calls `.run()`, never
 * anything on ControlledActionService.
 *
 * Deliberately conservative: extracting a full structured CONTROLLED_ACTION
 * step (recipient/subject/body, or event title/start/end) from unstructured
 * free text without guessing security-sensitive fields is out of scope for
 * this phase (§27 — never guess a target field). This handler always runs a
 * real READ_ONLY POLICY_WHAT_IF simulation of the request text itself,
 * proving the simulation pathway is genuinely wired to the canonical
 * simulator rather than fabricated, and directs the caller to the
 * Simulation page for a fully structured what-if.
 */
import { simulation, cacheSimulationResultForPublicRoute } from '../services';
import type { JarvisResponse } from '../types';
import { baseResponse } from '../response';

export async function handleSimulation(requestId: string, text: string, projectId: string | null): Promise<JarvisResponse> {
  const response = baseResponse(requestId, 'SIMULATION', projectId);

  const run = await simulation.run({
    kind: 'POLICY_WHAT_IF',
    projectId,
    steps: [{ key: 'gateway-what-if', type: 'READ_ONLY', description: text }],
  });
  // service.run() only computes the result — it never caches it. The real
  // GET /simulation/:id route only ever reads from its own module-level
  // cache, populated explicitly by whoever calls .run(). Found during
  // Phase 7E: a Jarvis-created simulationId was otherwise invisible to the
  // Simulation Inspector's own fetch of the exact same id.
  cacheSimulationResultForPublicRoute(run);

  response.simulation = { simulationId: run.simulationId, overallOutcome: run.overallOutcome };
  response.answer = `Simulation ${run.simulationId}: ${run.overallOutcome}. This is a read-only what-if of your request text — it never executes anything. For a fully structured simulation of a specific governed action, use Command Center → Simulation.`;
  response.evidenceRefs = run.evidenceRefs;
  response.facts = run.facts.map(f => ({ kind: 'FACT' as const, statement: f }));
  response.unknowns = run.unknowns;
  response.status = 'SIMULATED';
  return response;
}
