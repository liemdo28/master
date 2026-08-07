import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api-client';
import type { DailyPlan, PlanTaskRef } from '@/lib/types';
import { DataBoundary } from '@/components/States';
import { StatusBadge } from '@/components/StatusBadge';
import { EvidenceButton } from '@/components/EvidenceDrawer';

function usePlan() {
  return useQuery({
    queryKey: ['operating', 'plan'],
    queryFn: () => api.get<DailyPlan>('/operating/today/plan'),
    retry: false,
  });
}

export function PlanPage() {
  const { data: plan, isLoading, error, refetch } = usePlan();
  const queryClient = useQueryClient();

  const generate = useMutation({
    mutationFn: () => api.post<DailyPlan>('/operating/today/plan'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['operating', 'plan'] }),
  });
  const approve = useMutation({
    mutationFn: () => api.post<DailyPlan>('/operating/today/plan/approve', { planId: plan!.id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['operating', 'plan'] }),
  });
  const cancel = useMutation({
    mutationFn: () => api.post<DailyPlan>('/operating/today/plan/cancel', { planId: plan!.id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['operating', 'plan'] }),
  });

  const notFound = error && (error as { status?: number }).status === 404;

  return (
    <div className="mx-auto max-w-3xl p-6">
      <header className="mb-4">
        <Link to="/today" className="text-sm text-(--color-text-dim) hover:text-(--color-accent)">← Today</Link>
        <h1 className="mt-1 text-xl font-semibold text-(--color-text)">Daily Plan</h1>
        <div className="mt-3 rounded-md border border-(--color-accent)/30 bg-(--color-accent)/5 px-3 py-2 text-sm text-(--color-accent)">
          Plan approval does not execute tasks. Approving here only changes the plan's own status — no task starts, no coding runs, no calendar or email is written.
        </div>
      </header>

      {notFound ? (
        <div className="rounded-lg border border-dashed border-(--color-border) p-8 text-center">
          <p className="mb-3 text-(--color-text-dim)">No plan generated for today yet — a morning brief must exist first.</p>
          <button
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
            className="rounded-md bg-(--color-accent) px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {generate.isPending ? 'Generating…' : 'Generate plan'}
          </button>
        </div>
      ) : (
        <DataBoundary isLoading={isLoading} error={notFound ? null : error} onRetry={() => refetch()}>
          {plan && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <StatusBadge status={plan.status} />
                <div className="flex gap-2">
                  {plan.status === 'DRAFT' && (
                    <button
                      onClick={() => approve.mutate()}
                      disabled={approve.isPending}
                      className="rounded-md bg-(--color-accent) px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {approve.isPending ? 'Approving…' : 'Approve plan'}
                    </button>
                  )}
                  {(plan.status === 'DRAFT' || plan.status === 'APPROVED') && (
                    <button
                      onClick={() => cancel.mutate()}
                      disabled={cancel.isPending}
                      className="rounded-md border border-(--color-border) px-3 py-1.5 text-sm text-(--color-text-dim) hover:border-(--color-blocked) hover:text-(--color-blocked) disabled:opacity-50"
                    >
                      Cancel plan
                    </button>
                  )}
                </div>
              </div>

              <p className="text-sm text-(--color-text-dim)">{plan.objective}</p>

              <TaskGroup title="Fixed" tasks={plan.selectedTasks.filter(t => t.kind === 'FIXED')} />
              <TaskGroup title="Flexible" tasks={plan.selectedTasks.filter(t => t.kind === 'FLEXIBLE')} />
              <TaskGroup title="Optional" tasks={plan.selectedTasks.filter(t => t.kind === 'OPTIONAL')} />

              {plan.focusBlocks.length > 0 && (
                <section>
                  <h2 className="mb-2 text-sm font-semibold text-(--color-text)">Focus blocks</h2>
                  <ul className="space-y-1.5 text-sm text-(--color-text-dim)">
                    {plan.focusBlocks.map((b, i) => <li key={i}>{b.start}–{b.end} ({b.durationMinutes}m) — {b.reason}</li>)}
                  </ul>
                </section>
              )}

              {plan.requiredApprovals.length > 0 && (
                <section>
                  <h2 className="mb-2 text-sm font-semibold text-(--color-text)">Requires approval before it can run</h2>
                  <ul className="space-y-1">
                    {plan.requiredApprovals.map(id => (
                      <li key={id}><Link to="/approvals" className="text-sm text-(--color-approval) hover:underline">{id}</Link></li>
                    ))}
                  </ul>
                </section>
              )}

              {plan.risks.length > 0 && (
                <section>
                  <h2 className="mb-2 text-sm font-semibold text-(--color-unknown)">Risks</h2>
                  <ul className="space-y-1 text-sm text-(--color-text-dim)">{plan.risks.map((r, i) => <li key={i}>– {r}</li>)}</ul>
                </section>
              )}

              {plan.successCriteria.length > 0 && (
                <section>
                  <h2 className="mb-2 text-sm font-semibold text-(--color-fact)">Success criteria</h2>
                  <ul className="space-y-1 text-sm text-(--color-text-dim)">{plan.successCriteria.map((s, i) => <li key={i}>– {s}</li>)}</ul>
                </section>
              )}
            </div>
          )}
        </DataBoundary>
      )}
    </div>
  );
}

function TaskGroup({ title, tasks }: { title: string; tasks: PlanTaskRef[] }) {
  if (tasks.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-(--color-text)">{title} <span className="text-(--color-text-faint)">({tasks.length})</span></h2>
      <ul className="space-y-1.5">
        {tasks.map(t => (
          <li key={t.id} className="flex items-center justify-between rounded-md border border-(--color-border) px-3 py-2 text-sm">
            <div>
              <p className="text-(--color-text)">{t.title}</p>
              <p className="text-xs text-(--color-text-faint)">{t.reason}</p>
            </div>
            <EvidenceButton title={t.title} entries={[
              { label: 'Source type', value: t.sourceType },
              { label: 'Source id', value: t.sourceId ?? '—' },
              { label: 'Tier', value: t.tier },
            ]} />
          </li>
        ))}
      </ul>
    </section>
  );
}
