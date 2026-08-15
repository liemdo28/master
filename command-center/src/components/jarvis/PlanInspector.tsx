import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api-client';
import type { ActionPlan, ActionPlanStep, ActionPlanEvidence } from '@/lib/types';
import { planTruthStatus } from '@/lib/jarvis-workspace';
import { TruthStatusBadge } from '@/components/TruthStatusBadge';
import { StatusBadge } from '@/components/StatusBadge';
import { LoadingState, ErrorState } from '@/components/States';

/**
 * Directive §9 — reuses Phase 5H orchestration exclusively via its existing
 * GET /orchestration/plans/:id and /:id/evidence routes. Observational only:
 * no approve/start/advance/pause/cancel control here (those remain on the
 * canonical /plans/:id page, linked out to below).
 */
export function PlanInspector({ planId }: { planId: string }) {
  const detail = useQuery({
    queryKey: ['orchestration-plan', planId],
    queryFn: () => api.get<{ plan: ActionPlan; steps: ActionPlanStep[] }>(`/orchestration/plans/${planId}`),
  });
  const evidence = useQuery({
    queryKey: ['orchestration-plan-evidence', planId],
    queryFn: () => api.get<{ evidence: ActionPlanEvidence[] }>(`/orchestration/plans/${planId}/evidence`),
  });

  if (detail.isLoading || evidence.isLoading) return <LoadingState label="Loading plan…" />;
  if (detail.isError || !detail.data) return <ErrorState error={detail.error} />;

  const { plan, steps } = detail.data;
  const evidenceRecords = evidence.data?.evidence ?? [];
  const truth = planTruthStatus(plan, evidenceRecords);

  return (
    <section aria-label="Plan" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <TruthStatusBadge status={truth} />
        <StatusBadge status={plan.status} />
        <span className="text-sm font-medium text-(--color-text)">{plan.title}</span>
      </div>
      <p className="text-sm text-(--color-text-dim)">{plan.objective}</p>
      {plan.blockedReason && (
        <p className="rounded border border-(--color-blocked)/30 bg-(--color-blocked)/5 p-2 text-xs text-(--color-blocked)">
          Blocked: {plan.blockedReason}
        </p>
      )}

      <ol className="space-y-1.5">
        {steps
          .slice()
          .sort((a, b) => a.stepIndex - b.stepIndex)
          .map(step => (
            <li key={step.id} className="rounded border border-(--color-border) p-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={step.status} />
                <span className="text-(--color-text-dim)">{step.description}</span>
              </div>
              {step.riskClass && <span className="mt-1 block text-(--color-text-faint)">Risk: {step.riskClass}</span>}
              {step.requiredApprovalLevel && step.requiredApprovalLevel !== 'NONE' && (
                <span className="mt-1 block text-(--color-approval)">Requires {step.requiredApprovalLevel} approval</span>
              )}
              {step.proposalId && (
                <Link to="/actions" className="mt-1 block text-(--color-accent) underline">
                  Open associated proposal in Actions
                </Link>
              )}
            </li>
          ))}
      </ol>

      <Link to={`/plans/${plan.id}`} className="block text-xs text-(--color-accent) underline">
        Open full plan detail (start/pause/cancel controls live there, never here)
      </Link>
    </section>
  );
}
