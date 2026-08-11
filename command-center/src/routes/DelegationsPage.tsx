import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { DelegatedAuthority } from '@/lib/types';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';

export function DelegationsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['delegations'],
    queryFn: () => api.get<{ delegations: DelegatedAuthority[] }>('/delegations'),
    refetchInterval: 30_000,
  });

  if (isLoading) return <LoadingState label="Loading delegations" />;
  if (error) return <ErrorState error={error} />;
  const delegations = data?.delegations ?? [];

  const active = delegations.filter(d => d.status === 'ACTIVE');
  const waiting = delegations.filter(d => d.status === 'WAITING_APPROVAL');
  const paused = delegations.filter(d => d.status === 'PAUSED' || d.status === 'PAUSED_POLICY_CHANGED');
  const expired = delegations.filter(d => d.status === 'EXPIRED');
  const revoked = delegations.filter(d => d.status === 'REVOKED');
  const executionsRemaining = active.reduce((sum, d) => sum + Math.max(0, d.maxExecutions - d.usedExecutions), 0);
  const nearestExpiry = active.length ? active.reduce((a, b) => (new Date(a.expiresAt) < new Date(b.expiresAt) ? a : b)) : null;

  if (!delegations.length) {
    return <EmptyState title="No delegated authorities yet" hint="Create one via the delegation CLI or POST /api/delegations. A delegation must always be strongly approved by a human before it can execute anything." />;
  }

  return (
    <section className="mx-auto max-w-6xl space-y-5 p-5">
      <header>
        <h1 className="text-2xl font-semibold text-(--color-text)">Delegations</h1>
        <p className="mt-1 text-sm text-(--color-text-faint)">
          A delegation is not plan approval and not a single action approval — it pre-authorizes a narrow, time-limited,
          strongly-approved class of Controlled Actions in advance. Approving a delegation is a separate, much more
          significant decision than approving one plan or one action; see the detail page before granting one.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <OverviewCard label="Active" value={active.length} />
        <OverviewCard label="Executions remaining" value={executionsRemaining} />
        <OverviewCard label="Nearest expiry" value={nearestExpiry ? new Date(nearestExpiry.expiresAt).toLocaleString() : '—'} small />
        <OverviewCard label="Blocked / paused" value={paused.length} />
        <OverviewCard label="Waiting approval" value={waiting.length} />
      </div>

      <div className="overflow-hidden rounded-md border border-(--color-border)">
        <table className="w-full text-sm">
          <thead className="bg-(--color-surface) text-left text-xs uppercase text-(--color-text-faint)">
            <tr>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Project</th>
              <th className="px-3 py-2">Action types</th>
              <th className="px-3 py-2">Quota</th>
              <th className="px-3 py-2">Window</th>
            </tr>
          </thead>
          <tbody>
            {delegations.map(d => (
              <tr key={`${d.id}-${d.delegationVersion}`} className="border-t border-(--color-border) hover:bg-(--color-surface)">
                <td className="px-3 py-2">
                  <Link to={`/delegations/${d.id}`} className="font-medium text-(--color-text) underline">{d.title}</Link>
                  <span className="ml-1 text-xs text-(--color-text-faint)">v{d.delegationVersion}</span>
                </td>
                <td className="px-3 py-2"><StatusBadge status={d.status} /></td>
                <td className="px-3 py-2 text-(--color-text-dim)">{d.projectId}</td>
                <td className="px-3 py-2 text-(--color-text-dim)">{d.allowedActionTypes.join(', ')}</td>
                <td className="px-3 py-2 text-(--color-text-dim)">{d.usedExecutions}/{d.maxExecutions}</td>
                <td className="px-3 py-2 text-(--color-text-faint)">{new Date(d.startsAt).toLocaleString()} → {new Date(d.expiresAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(revoked.length > 0 || expired.length > 0) && (
        <p className="text-xs text-(--color-text-faint)">{revoked.length} revoked, {expired.length} expired (shown above, history preserved — a revoked or expired delegation can never be reactivated; a new one must be created instead).</p>
      )}
    </section>
  );
}

function OverviewCard({ label, value, small }: { label: string; value: string | number; small?: boolean }) {
  return (
    <div className="rounded-md border border-(--color-border) bg-(--color-surface) p-3">
      <div className="text-xs uppercase text-(--color-text-faint)">{label}</div>
      <div className={small ? 'mt-1 text-sm font-medium text-(--color-text)' : 'mt-1 text-xl font-semibold text-(--color-text)'}>{value}</div>
    </div>
  );
}
