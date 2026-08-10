import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { queryClient } from '@/lib/queryClient';
import type { GovernanceStatus, GovernanceAnomaly, KillSwitch } from '@/lib/types';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';

export function GovernancePage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['governance-status'],
    queryFn: () => api.get<GovernanceStatus>('/governance/status'),
    refetchInterval: 30_000,
  });
  const { data: anomalies } = useQuery({ queryKey: ['governance-anomalies'], queryFn: () => api.get<{ anomalies: GovernanceAnomaly[] }>('/governance/anomalies') });
  const { data: audit } = useQuery({ queryKey: ['governance-audit'], queryFn: () => api.get<{ events: Array<{ id: string; eventType: string; createdAt: string; reasons: string[] }> }>('/governance/audit') });
  const lockdown = useMutation({
    mutationFn: () => api.post<KillSwitch>('/governance/kill-switches', { scope: 'GLOBAL', reason: 'Manual Command Center lockdown', activatedBy: 'command-center' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['governance-status'] }),
  });
  const disable = useMutation({
    mutationFn: (id: string) => api.post<KillSwitch>(`/governance/kill-switches/${id}/disable`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['governance-status'] }),
  });

  if (isLoading) return <LoadingState label="Loading governance" />;
  if (error) return <ErrorState error={error} />;
  if (!data) return <EmptyState title="No governance data" hint="Policy state will appear after the first governance evaluation." />;

  return (
    <section className="mx-auto max-w-7xl space-y-5 p-5">
      {data.killSwitchState.active ? (
        <div className="rounded-md border border-red-500/50 bg-red-500/10 p-3 text-sm font-medium text-red-100">
          LOCKDOWN ACTIVE
        </div>
      ) : null}

      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-(--color-text)">Governance</h1>
          <p className="mt-1 text-sm text-(--color-text-faint)">Policy, budget, kill-switch, anomaly, and audit state for controlled actions.</p>
        </div>
        <button onClick={() => lockdown.mutate()} className="rounded-md border border-red-500/60 px-3 py-2 text-sm font-medium text-red-100">LOCKDOWN</button>
      </header>

      <section className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Metric label="Pending" value={data.pendingActions} />
        <Metric label="Executed Today" value={data.actionsExecutedToday} />
        <Metric label="Policy Blocks" value={data.blockedByPolicy} />
        <Metric label="Budget Blocks" value={data.blockedByBudget} />
        <Metric label="Anomalies" value={data.anomalies} />
        <Metric label="Policy" value={data.currentGlobalPolicy?.version ?? 'none'} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Policies" items={data.currentGlobalPolicy ? [`${data.currentGlobalPolicy.version}`, data.currentGlobalPolicy.contentHash.slice(0, 16), data.currentGlobalPolicy.status] : ['No active policy']} />
        <Panel title="Budgets" items={data.budgets.map(b => `${b.actionType}: ${b.currentUsage.executions}/${b.maxExecutions} executions · resets ${new Date(b.resetsAt).toLocaleString()}`)} />
        <section className="rounded-md border border-(--color-border) bg-(--color-surface) p-4">
          <h2 className="mb-2 text-sm font-semibold text-(--color-text)">Kill Switches</h2>
          <ul className="space-y-2 text-sm text-(--color-text-dim)">
            {data.killSwitchState.switches.length ? data.killSwitchState.switches.map(item => (
              <li key={item.id} className="flex items-center justify-between gap-3">
                <span>{item.enabled ? 'ON' : 'OFF'} · {item.scope} · {item.reason}</span>
                {item.enabled ? <button onClick={() => disable.mutate(item.id)} className="rounded border border-(--color-border) px-2 py-1 text-xs">Disable</button> : null}
              </li>
            )) : <li>None</li>}
          </ul>
        </section>
        <Panel title="Anomalies" items={(anomalies?.anomalies ?? []).map(a => `${a.severity}: ${a.description}`)} />
        <Panel title="Audit Log" items={(audit?.events ?? []).slice(0, 20).map(e => `${e.eventType} · ${new Date(e.createdAt).toLocaleString()}`)} />
      </section>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-(--color-border) bg-(--color-surface) p-3">
      <div className="text-xs uppercase text-(--color-text-faint)">{label}</div>
      <div className="mt-1 text-lg font-semibold text-(--color-text)">{value}</div>
    </div>
  );
}

function Panel({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-md border border-(--color-border) bg-(--color-surface) p-4">
      <h2 className="mb-2 text-sm font-semibold text-(--color-text)">{title}</h2>
      <ul className="space-y-2 text-sm text-(--color-text-dim)">
        {(items.length ? items : ['None']).map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}
      </ul>
    </section>
  );
}
