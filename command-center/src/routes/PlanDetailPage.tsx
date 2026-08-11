import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { queryClient } from '@/lib/queryClient';
import type { ActionPlan, ActionPlanEvidence, ActionPlanStep, PlanValidationResult } from '@/lib/types';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';

const STEP_TYPE_LABEL: Record<string, string> = {
  READ_ONLY: 'Read-only',
  LOCAL_COMPUTE: 'Local compute (safe)',
  CONTROLLED_ACTION: 'Controlled Action (external)',
};

export function PlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useQuery({
    queryKey: ['orchestration-plan', id],
    queryFn: () => api.get<{ plan: ActionPlan; steps: ActionPlanStep[] }>(`/orchestration/plans/${id}`),
    enabled: !!id,
    refetchInterval: 30_000,
  });
  const { data: evidenceData } = useQuery({
    queryKey: ['orchestration-plan-evidence', id],
    queryFn: () => api.get<{ evidence: ActionPlanEvidence[] }>(`/orchestration/plans/${id}/evidence`),
    enabled: !!id,
  });

  const validate = useMutation({
    mutationFn: () => api.post<PlanValidationResult>(`/orchestration/plans/${id}/validate`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orchestration-plan', id] }),
  });
  const start = useMutation({
    mutationFn: () => api.post<ActionPlan>(`/orchestration/plans/${id}/start`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orchestration-plan', id] }),
  });
  const advance = useMutation({
    mutationFn: () => api.post(`/orchestration/plans/${id}/advance`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['orchestration-plan', id] }); queryClient.invalidateQueries({ queryKey: ['orchestration-plan-evidence', id] }); },
  });
  const pause = useMutation({
    mutationFn: () => api.post<ActionPlan>(`/orchestration/plans/${id}/pause`, { reason: 'Paused from Command Center' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orchestration-plan', id] }),
  });
  const resume = useMutation({
    mutationFn: () => api.post<ActionPlan>(`/orchestration/plans/${id}/resume`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orchestration-plan', id] }),
  });
  const cancel = useMutation({
    mutationFn: () => api.post<ActionPlan>(`/orchestration/plans/${id}/cancel`, { reason: 'Cancelled from Command Center' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orchestration-plan', id] }),
  });

  if (isLoading) return <LoadingState label="Loading plan" />;
  if (error) return <ErrorState error={error} />;
  if (!data) return <EmptyState title="Plan not found" />;

  const { plan, steps } = data;
  const waitingSteps = steps.filter(s => s.status === 'WAITING_APPROVAL' && s.proposalId);

  return (
    <section className="mx-auto max-w-6xl space-y-5 p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-(--color-text)">{plan.title}</h1>
          <p className="mt-1 text-sm text-(--color-text-faint)">{plan.objective}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-(--color-text-dim)">
            <StatusBadge status={plan.status} />
            <span>version {plan.planVersion}{plan.previousVersionId ? ` (supersedes a prior version)` : ''}</span>
            <span>project {plan.projectId ?? '—'}</span>
            {plan.policyVersion ? <span>policy {plan.policyVersion} ({plan.policyHash?.slice(0, 12)}…)</span> : null}
            <span title={plan.planHash}>plan hash {plan.planHash.slice(0, 12)}…</span>
          </div>
          {plan.failureReason ? <p className="mt-2 text-sm text-red-300">Failure: {plan.failureReason}</p> : null}
          {plan.blockedReason ? <p className="mt-2 text-sm text-amber-300">Blocked: {plan.blockedReason}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {plan.status === 'DRAFT' ? <button onClick={() => validate.mutate()} className="rounded-md border border-(--color-border) px-3 py-2 text-sm">Validate structure</button> : null}
          {plan.status === 'VALIDATED' ? <button onClick={() => start.mutate()} className="rounded-md border border-(--color-border) px-3 py-2 text-sm">Start</button> : null}
          {['READY', 'RUNNING', 'WAITING_APPROVAL'].includes(plan.status) ? <button onClick={() => advance.mutate()} className="rounded-md border border-(--color-border) px-3 py-2 text-sm">Advance</button> : null}
          {['READY', 'RUNNING', 'WAITING_APPROVAL'].includes(plan.status) ? <button onClick={() => pause.mutate()} className="rounded-md border border-(--color-border) px-3 py-2 text-sm">Pause</button> : null}
          {plan.status === 'PAUSED' ? <button onClick={() => resume.mutate()} className="rounded-md border border-(--color-border) px-3 py-2 text-sm">Resume</button> : null}
          {!['COMPLETED', 'CANCELLED', 'FAILED'].includes(plan.status) ? <button onClick={() => cancel.mutate()} className="rounded-md border border-red-500/50 px-3 py-2 text-sm text-red-200">Cancel plan</button> : null}
        </div>
      </header>

      <div className="rounded-md border border-blue-500/40 bg-blue-500/10 p-3 text-sm text-blue-100">
        <strong>Validating or starting this plan only governs its structure — it never approves a Controlled Action.</strong>{' '}
        {waitingSteps.length > 0 ? (
          <>
            {waitingSteps.length} step{waitingSteps.length > 1 ? 's are' : ' is'} waiting on a separate, per-action approval —
            review and approve each one individually on the <Link to="/actions" className="underline">Actions</Link> page.
            Approving one action never authorizes any other step.
          </>
        ) : (
          'No step here has an "Approve" button — external actions are only ever approved on the Actions page.'
        )}
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-(--color-text)">Steps ({steps.length})</h2>
        <ol className="space-y-2">
          {steps.map(step => (
            <li key={step.id} className="rounded-md border border-(--color-border) bg-(--color-surface) p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-(--color-text-faint)">#{step.stepIndex + 1}</span>
                  <span className="font-medium text-(--color-text)">{step.key}</span>
                  <span className={`rounded px-1.5 py-0.5 text-xs ${step.type === 'CONTROLLED_ACTION' ? 'bg-amber-500/20 text-amber-200' : 'bg-emerald-500/20 text-emerald-200'}`}>
                    {STEP_TYPE_LABEL[step.type] ?? step.type}
                  </span>
                </div>
                <StatusBadge status={step.status} />
              </div>
              <p className="mt-1 text-sm text-(--color-text-dim)">{step.description}</p>
              {step.dependsOnStepIds.length ? (
                <p className="mt-1 text-xs text-(--color-text-faint)">depends on: {step.dependsOnStepIds.map(depId => steps.find(s => s.id === depId)?.key ?? depId).join(', ')}</p>
              ) : null}
              {step.type === 'CONTROLLED_ACTION' ? (
                <p className="mt-1 text-xs text-(--color-text-faint)">
                  {step.actionType} · risk {step.riskClass ?? '—'} · approval {step.requiredApprovalLevel ?? '—'}
                  {step.proposalId ? (
                    <> · proposal <Link to="/actions" className="underline">{step.proposalId.slice(0, 18)}…</Link></>
                  ) : null}
                </p>
              ) : null}
              {step.failureReason ? <p className="mt-1 text-xs text-red-300">{step.failureReason}</p> : null}
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-(--color-text)">Evidence</h2>
        <ul className="space-y-1.5 text-sm text-(--color-text-dim)">
          {(evidenceData?.evidence ?? []).length ? evidenceData!.evidence.map(e => (
            <li key={e.id} className="rounded border border-(--color-border) px-2 py-1.5">
              <span className="font-mono text-xs text-(--color-text-faint)">{new Date(e.createdAt).toLocaleString()}</span>{' '}
              <span className="font-medium">{e.eventType}</span> — {e.summary}
            </li>
          )) : <li>No evidence yet.</li>}
        </ul>
      </section>
    </section>
  );
}
