import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { DependencyHealth, DependencyId, SystemHealth } from '@/lib/types';
import { DataBoundary } from '@/components/States';
import { StatusBadge } from '@/components/StatusBadge';

/** Phase 7B — read-only health/dependency truth model view. No restart, no
 *  start-service, no mutation control of any kind lives on this page; see
 *  docs/security/PHASE7B_HEALTH_BOUNDARY.md for why observation and recovery
 *  authority are kept separate. */

const GROUPS: Array<{ title: string; ids: DependencyId[] }> = [
  { title: 'Core', ids: ['CORE', 'DATABASE', 'AUTHORITY'] },
  { title: 'AI / Knowledge', ids: ['KNOWLEDGE', 'PYTHON_AI', 'LOCAL_MODEL'] },
  { title: 'Connectors', ids: ['GOOGLE_CONNECTORS', 'NODE_AGENT'] },
  { title: 'Background services', ids: ['ACCOUNTING', 'QB_AGENT', 'WHATSAPP', 'N8N', 'CEO_OBSERVER'] },
];

function DependencyCard({ dep }: { dep: DependencyHealth }) {
  return (
    <li className="rounded-md border border-(--color-border) p-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-(--color-text)">{dep.id.replace(/_/g, ' ')}</span>
        <StatusBadge status={dep.state} />
      </div>
      <p className="mt-1 text-(--color-text-faint)">{dep.criticality.replace(/_/g, ' ').toLowerCase()}</p>
      {dep.detail && <p className="mt-1.5 text-(--color-text-dim)">{dep.detail}</p>}
      {dep.capabilityImpact.length > 0 && (
        <ul className="mt-1.5 list-inside list-disc text-(--color-text-faint)">
          {dep.capabilityImpact.map((impact, i) => <li key={i}>{impact}</li>)}
        </ul>
      )}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-(--color-text-faint)">
        <span>checked: {dep.lastCheckedAt ? new Date(dep.lastCheckedAt).toLocaleTimeString() : 'unknown'}</span>
        <span>last healthy: {dep.lastHealthyAt ? new Date(dep.lastHealthyAt).toLocaleTimeString() : 'unknown'}</span>
      </div>
    </li>
  );
}

export function HealthPage() {
  const health = useQuery({
    queryKey: ['health', 'detail'],
    queryFn: () => api.get<SystemHealth>('/health/detail'),
    refetchInterval: 30_000,
  });

  const byId = new Map((health.data?.dependencies ?? []).map(d => [d.id, d]));

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 text-xl font-semibold text-(--color-text)">Health</h1>
      <p className="mb-6 text-xs text-(--color-text-faint)">
        Read-only — reports actual state, never claims healthy to hide a real problem or unhealthy for a
        dependency that's intentionally off. Nothing here starts, stops, or restarts a service.
      </p>

      <DataBoundary
        isLoading={health.isLoading}
        error={health.error}
        isEmpty={(health.data?.dependencies.length ?? 0) === 0}
        emptyTitle="No health data."
        onRetry={() => health.refetch()}
      >
        {health.data && (
          <>
            <section className="mb-6 flex items-center justify-between rounded-md border border-(--color-border) p-3">
              <div>
                <div className="text-sm font-semibold text-(--color-text)">Overall</div>
                <div className="mt-0.5 text-xs text-(--color-text-faint)">{health.data.overallReason.replace(/_/g, ' ').toLowerCase()}</div>
              </div>
              <StatusBadge status={health.data.overall} />
            </section>

            {GROUPS.map(group => {
              const deps = group.ids.map(id => byId.get(id)).filter((d): d is DependencyHealth => !!d);
              if (deps.length === 0) return null;
              return (
                <section key={group.title} className="mb-6">
                  <h2 className="mb-2 text-sm font-semibold text-(--color-text)">{group.title}</h2>
                  <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {deps.map(dep => <DependencyCard key={dep.id} dep={dep} />)}
                  </ul>
                </section>
              );
            })}

            <p className="text-xs text-(--color-text-faint)">
              Generated at {new Date(health.data.generatedAt).toLocaleString()}
            </p>
          </>
        )}
      </DataBoundary>
    </div>
  );
}
