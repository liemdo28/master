import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { ServiceHealth } from '@/lib/types';
import { DataBoundary } from '@/components/States';
import { StatusBadge } from '@/components/StatusBadge';

interface Integrity { integrityCheck: string; foreignKeyViolations: unknown[]; schemaVersion: number }

export function HealthPage() {
  const services = useQuery({ queryKey: ['operating', 'service-health'], queryFn: () => api.get<{ serviceHealth: ServiceHealth[] }>('/operating/service-health') });
  const integrity = useQuery({ queryKey: ['personal', 'integrity'], queryFn: () => api.get<Integrity>('/personal/integrity') });
  const connector = useQuery({ queryKey: ['intelligence', 'status'], queryFn: () => api.get<{ status: string; grantedScopes: string[] }>('/intelligence/status') });

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 text-xl font-semibold text-(--color-text)">Health</h1>
      <p className="mb-6 text-xs text-(--color-text-faint)">Read-only — nothing here restarts a service. See SelfHeal's own automatic monitor for that.</p>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-(--color-text)">Services (SelfHeal probes)</h2>
        <DataBoundary isLoading={services.isLoading} error={services.error} isEmpty={(services.data?.serviceHealth.length ?? 0) === 0} emptyTitle="No service health data.">
          <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {(services.data?.serviceHealth ?? []).map(s => (
              <li key={s.service} className="rounded-md border border-(--color-border) p-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="truncate text-(--color-text-dim)">{s.service}</span>
                  <StatusBadge status={s.status} />
                </div>
                {s.reason && <p className="mt-1 text-(--color-text-faint)">{s.reason}</p>}
              </li>
            ))}
          </ul>
        </DataBoundary>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-(--color-text)">Database integrity</h2>
        <DataBoundary isLoading={integrity.isLoading} error={integrity.error}>
          {integrity.data && (
            <div className="flex flex-wrap gap-4 text-sm">
              <span>Check: <StatusBadge status={integrity.data.integrityCheck === 'ok' ? 'HEALTHY' : 'DOWN'} label={integrity.data.integrityCheck} /></span>
              <span className="text-(--color-text-dim)">FK violations: {integrity.data.foreignKeyViolations.length}</span>
              <span className="text-(--color-text-dim)">Schema version: v{integrity.data.schemaVersion}</span>
            </div>
          )}
        </DataBoundary>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-(--color-text)">Google connector</h2>
        <DataBoundary isLoading={connector.isLoading} error={connector.error}>
          {connector.data && (
            <div className="text-sm text-(--color-text-dim)">
              <StatusBadge status={connector.data.status === 'READY' ? 'HEALTHY' : 'NOT_CONFIGURED'} label={connector.data.status} />
              {/* §23: OAuth configuration is masked — a count, never the raw scope URLs. */}
              {connector.data.grantedScopes?.length > 0 && (
                <p className="mt-2 text-xs text-(--color-text-faint)">{connector.data.grantedScopes.length} scope(s) granted</p>
              )}
            </div>
          )}
        </DataBoundary>
      </section>
    </div>
  );
}
