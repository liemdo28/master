import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { ActionPlan } from '@/lib/types';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';

export function PlansPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['orchestration-plans'],
    queryFn: () => api.get<{ plans: ActionPlan[] }>('/orchestration/plans'),
    refetchInterval: 30_000,
  });

  if (isLoading) return <LoadingState label="Loading plans" />;
  if (error) return <ErrorState error={error} />;
  const plans = data?.plans ?? [];
  if (!plans.length) return <EmptyState title="No action plans yet" hint="Create one via the plan-action CLI or POST /api/orchestration/plans." />;

  return (
    <section className="mx-auto max-w-6xl space-y-5 p-5">
      <header>
        <h1 className="text-2xl font-semibold text-(--color-text)">Plans</h1>
        <p className="mt-1 text-sm text-(--color-text-faint)">
          Governed multi-step action plans. Plan validation checks structure only — it never approves a Controlled Action.
          Approve individual proposed actions on the <Link to="/actions" className="underline">Actions</Link> page.
        </p>
      </header>
      <div className="overflow-hidden rounded-md border border-(--color-border)">
        <table className="w-full text-sm">
          <thead className="bg-(--color-surface) text-left text-xs uppercase text-(--color-text-faint)">
            <tr>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Version</th>
              <th className="px-3 py-2">Project</th>
              <th className="px-3 py-2">Updated</th>
            </tr>
          </thead>
          <tbody>
            {plans.map(plan => (
              <tr key={plan.id} className="border-t border-(--color-border) hover:bg-(--color-surface)">
                <td className="px-3 py-2">
                  <Link to={`/plans/${plan.id}`} className="font-medium text-(--color-text) underline">{plan.title}</Link>
                </td>
                <td className="px-3 py-2"><StatusBadge status={plan.status} /></td>
                <td className="px-3 py-2 text-(--color-text-dim)">v{plan.planVersion}{plan.previousVersionId ? ' (versioned)' : ''}</td>
                <td className="px-3 py-2 text-(--color-text-dim)">{plan.projectId ?? '—'}</td>
                <td className="px-3 py-2 text-(--color-text-faint)">{new Date(plan.updatedAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
