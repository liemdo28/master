import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { SimulationRun } from '@/lib/types';
import { simulationTruthStatus } from '@/lib/jarvis-workspace';
import { TruthStatusBadge } from '@/components/TruthStatusBadge';
import { LoadingState, ErrorState } from '@/components/States';

/**
 * Directive §10 — reuses Phase 6F Governed Automation Simulation exclusively
 * via GET /simulation/:id. Every render carries the mandatory
 * "SIMULATION — NO LIVE EXECUTION" banner; simulationTruthStatus() always
 * returns PROPOSED by construction — a simulation result can never be
 * presented as EXECUTED (see docs/security/PHASE6F_SIMULATION_BOUNDARY.md).
 */
export function SimulationInspector({ simulationId }: { simulationId: string }) {
  const query = useQuery({
    queryKey: ['simulation', simulationId],
    queryFn: () => api.get<SimulationRun>(`/simulation/${simulationId}`),
  });

  if (query.isLoading) return <LoadingState label="Loading simulation…" />;
  if (query.isError || !query.data) return <ErrorState error={query.error} />;

  const run = query.data;
  const truth = simulationTruthStatus(run);

  return (
    <section aria-label="Simulation" className="space-y-3">
      <div className="rounded border border-(--color-suggestion)/40 bg-(--color-suggestion)/10 p-2 text-center text-xs font-semibold uppercase tracking-wide text-(--color-suggestion)">
        Simulation — no live execution
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <TruthStatusBadge status={truth} />
        <span className="text-sm font-medium text-(--color-text)">{run.overallOutcome}</span>
      </div>

      <dl className="grid grid-cols-2 gap-2 text-xs text-(--color-text-dim)">
        <div><dt className="text-(--color-text-faint)">Approvals needed</dt><dd>{run.approvalCount}</dd></div>
        <div><dt className="text-(--color-text-faint)">Side effects</dt><dd>{run.sideEffectCount}</dd></div>
        <div><dt className="text-(--color-text-faint)">Blocked steps</dt><dd>{run.blockedCount}</dd></div>
        <div><dt className="text-(--color-text-faint)">Uncertain steps</dt><dd>{run.uncertainCount}</dd></div>
      </dl>

      <ol className="space-y-1.5">
        {run.steps.map(step => (
          <li key={step.stepId} className="rounded border border-(--color-border) p-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-(--color-text-dim)">{step.result}</span>
              {step.actionType && <span className="text-(--color-text-faint)">{step.actionType}</span>}
            </div>
            <p className="mt-1 text-(--color-text-faint)">{step.targetSummary}</p>
            {step.policyDecision && <p className="mt-1 text-(--color-text-faint)">Policy: {step.policyDecision}</p>}
            {step.riskClass && <p className="text-(--color-text-faint)">Risk: {step.riskClass}</p>}
            {step.reason && <p className="mt-1 text-(--color-text-dim)">{step.reason}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}
