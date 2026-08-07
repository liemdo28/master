import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { Goal } from '@/lib/types';
import { DataBoundary } from '@/components/States';
import { StatusBadge } from '@/components/StatusBadge';

export function GoalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: goal, isLoading, error, refetch } = useQuery({
    queryKey: ['goals', id],
    queryFn: () => api.get<Goal>(`/goals/${id}`),
    enabled: !!id,
  });

  const progress = useQuery({
    queryKey: ['goals', id, 'progress'],
    queryFn: () => api.get<Record<string, unknown>>(`/goals/${id}/progress`),
    enabled: !!id,
  });

  const pause = useMutation({
    mutationFn: () => api.post(`/goals/${id}/pause`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['goals', id] }),
  });
  const activate = useMutation({
    mutationFn: () => api.post(`/goals/${id}/activate`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['goals', id] }),
  });
  const generatePlan = useMutation({
    mutationFn: () => api.post(`/goals/${id}/plan`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['goals', id] }),
  });

  return (
    <div className="mx-auto max-w-3xl p-6">
      <Link to="/goals" className="text-sm text-(--color-text-dim) hover:text-(--color-accent)">← Goals</Link>

      <DataBoundary isLoading={isLoading} error={error} onRetry={() => refetch()}>
        {goal && (
          <div className="mt-2 space-y-6">
            <header>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold text-(--color-text)">{goal.title}</h1>
                <StatusBadge status={goal.status} />
              </div>
              <p className="mt-1 text-sm text-(--color-text-dim)">{goal.description}</p>
              <div className="mt-3 flex gap-2">
                {goal.status !== 'PAUSED' && goal.status !== 'COMPLETED' && goal.status !== 'CANCELLED' && (
                  <button onClick={() => pause.mutate()} disabled={pause.isPending} className="rounded-md border border-(--color-border) px-3 py-1.5 text-sm hover:border-(--color-accent) disabled:opacity-50">
                    Pause
                  </button>
                )}
                {goal.status !== 'ACTIVE' && goal.status !== 'COMPLETED' && goal.status !== 'CANCELLED' && (
                  <button onClick={() => activate.mutate()} disabled={activate.isPending} className="rounded-md border border-(--color-border) px-3 py-1.5 text-sm hover:border-(--color-accent) disabled:opacity-50">
                    Activate
                  </button>
                )}
                <button onClick={() => generatePlan.mutate()} disabled={generatePlan.isPending} className="rounded-md bg-(--color-accent) px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
                  {generatePlan.isPending ? 'Generating…' : 'Generate plan'}
                </button>
              </div>
            </header>

            <section>
              <h2 className="mb-1 text-sm font-semibold text-(--color-text)">Linked projects</h2>
              <div className="flex flex-wrap gap-2">
                {goal.projectIds.length === 0 && <span className="text-sm text-(--color-text-faint)">None</span>}
                {goal.projectIds.map(p => (
                  <Link key={p} to={`/projects/${p}`} className="rounded-md border border-(--color-border) px-2 py-1 text-xs text-(--color-text-dim) hover:border-(--color-accent)">{p}</Link>
                ))}
              </div>
            </section>

            {goal.successCriteria.length > 0 && (
              <section>
                <h2 className="mb-1 text-sm font-semibold text-(--color-fact)">Success criteria</h2>
                <ul className="space-y-1 text-sm text-(--color-text-dim)">{goal.successCriteria.map((s, i) => <li key={i}>– {s}</li>)}</ul>
              </section>
            )}

            {goal.constraints.length > 0 && (
              <section>
                <h2 className="mb-1 text-sm font-semibold text-(--color-unknown)">Constraints</h2>
                <ul className="space-y-1 text-sm text-(--color-text-dim)">{goal.constraints.map((s, i) => <li key={i}>– {s}</li>)}</ul>
              </section>
            )}

            <section>
              <h2 className="mb-1 text-sm font-semibold text-(--color-text)">Progress</h2>
              {progress.isLoading && <p className="text-sm text-(--color-text-faint)">Loading…</p>}
              {progress.data && (
                <pre className="overflow-x-auto rounded-md border border-(--color-border) bg-(--color-surface) p-3 text-xs text-(--color-text-dim)">
                  {JSON.stringify(progress.data, null, 2)}
                </pre>
              )}
            </section>
          </div>
        )}
      </DataBoundary>
    </div>
  );
}
