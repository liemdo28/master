import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { OperatorAuthorityView, OperatorBackgroundWorkerView, OperatorItem, OperatorOverview } from '@/lib/types';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { StatusBadge } from '@/components/StatusBadge';

export function OperatorControlPage() {
  const overview = useQuery({ queryKey: ['operator', 'overview'], queryFn: () => api.get<OperatorOverview>('/operator/overview'), refetchInterval: 30_000 });
  const pending = useQuery({ queryKey: ['operator', 'pending'], queryFn: () => api.get<{ items: OperatorItem[] }>('/operator/pending'), refetchInterval: 30_000 });
  const blocked = useQuery({ queryKey: ['operator', 'blocked'], queryFn: () => api.get<{ items: OperatorItem[] }>('/operator/blocked'), refetchInterval: 30_000 });
  const authority = useQuery({ queryKey: ['operator', 'authority'], queryFn: () => api.get<OperatorAuthorityView>('/operator/authority'), refetchInterval: 60_000 });
  // Phase 9B — read-only background-worker observability. This query never triggers
  // any mutation; refetchInterval only re-reads the same GET endpoint.
  const backgroundWorkers = useQuery({ queryKey: ['operator', 'background-workers'], queryFn: () => api.get<OperatorBackgroundWorkerView>('/operator/background-workers'), refetchInterval: 30_000 });

  if (overview.isLoading || pending.isLoading || blocked.isLoading || authority.isLoading) return <LoadingState label="Loading operator center" />;
  const err = overview.error || pending.error || blocked.error || authority.error;
  if (err) return <section className="mx-auto max-w-7xl p-5"><ErrorState error={err} /></section>;
  if (!overview.data || !pending.data || !blocked.data || !authority.data) return <section className="mx-auto max-w-7xl p-5"><EmptyState title="No operator data" /></section>;

  const attention = [...pending.data.items, ...blocked.data.items].filter(item => item.state === 'EXPIRING' || item.urgency === 'CRITICAL');

  return (
    <section className="mx-auto max-w-7xl space-y-5 p-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-(--color-border) pb-4">
        <div>
          <h1 className="text-2xl font-semibold text-(--color-text)">Operator Control</h1>
          <p className="mt-1 text-sm text-(--color-text-faint)">Pending authority, blockers, and evidence from the canonical control plane.</p>
        </div>
        <Link to="/authority" className="rounded-md border border-(--color-border) px-3 py-1.5 text-sm text-(--color-text-dim) hover:border-(--color-accent) hover:text-(--color-accent)">Authority inventory</Link>
      </header>

      <section aria-label="Overview" className="grid gap-3 md:grid-cols-6">
        <Metric label="Total" value={overview.data.counts.total} />
        <Metric label="Waiting" value={overview.data.counts.WAITING_ON_OPERATOR} />
        <Metric label="Blocked" value={overview.data.counts.BLOCKED + overview.data.counts.QUARANTINED} />
        <Metric label="Critical" value={overview.data.criticalCount} />
        <Metric label="Expiring" value={overview.data.expiringCount} />
        <Metric label="Legacy" value={overview.data.legacyQuarantinedCount} />
      </section>

      <section aria-label="Waiting on Me" className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Panel title="Waiting on Me" count={pending.data.items.length}>
          <ItemList items={pending.data.items.slice(0, 12)} empty="Nothing is waiting." />
        </Panel>
        <Panel title="Active Authority" count={authority.data.effectiveActions.length}>
          <div className="space-y-2">
            {authority.data.effectiveActions.map(action => (
              <div key={action.actionType} className="rounded-md border border-(--color-border) p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-(--color-text)">{action.actionType}</span>
                  <StatusBadge status={action.state} label={action.state.replace(/_/g, ' ')} />
                </div>
                <p className="mt-2 text-xs text-(--color-text-faint)">
                  {action.canExecuteWithoutHuman ? 'Delegated with canonical re-check' : action.reason.replace(/_/g, ' ')}
                  {' '}· {action.remainingDelegatedExecutions} delegated execution(s) remaining
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section aria-label="Blocked" className="grid gap-4 lg:grid-cols-2">
        <Panel title="Blocked" count={blocked.data.items.length}>
          <ItemList items={blocked.data.items.slice(0, 12)} empty="No blocked authority items." />
        </Panel>
        <Panel title="Expiring / Needs Attention" count={attention.length}>
          <ItemList items={attention.slice(0, 8)} empty="No urgent expiring items." />
        </Panel>
      </section>

      <section aria-label="Legacy / Quarantined" className="rounded-md border border-(--color-border) bg-(--color-surface) p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-(--color-text)">Legacy / Quarantined</h2>
          <StatusBadge status={authority.data.legacy.unresolvedLegacyMutations === 0 ? 'QUARANTINED' : 'BLOCKED'} label={`${authority.data.legacy.quarantinedLegacy} quarantined`} />
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <Mini label="Legacy mutations" value={authority.data.legacy.legacyMutations} />
          <Mini label="Adapted" value={authority.data.legacy.adaptedLegacy} />
          <Mini label="Quarantined" value={authority.data.legacy.quarantinedLegacy} />
          <Mini label="Unresolved" value={authority.data.legacy.unresolvedLegacyMutations} />
        </div>
        <div className="mt-3 max-h-56 overflow-y-auto">
          {authority.data.legacy.sampleQuarantinedSurfaces.map(surface => (
            <div key={surface.id} className="grid gap-2 border-t border-(--color-border) py-2 text-xs text-(--color-text-dim) md:grid-cols-[5rem_1fr_14rem]">
              <span>{surface.method}</span>
              <span className="break-all">{surface.runtimeMount}</span>
              <span>{surface.canonicalOwner}</span>
            </div>
          ))}
        </div>
      </section>

      <BackgroundWorkersSection query={backgroundWorkers} />
    </section>
  );
}

/**
 * Phase 9B — strictly read-only observability. No restart button, no approve
 * button, no PM2 mutation control anywhere in this section, and the query
 * driving it only ever performs a GET (see OperatorControlService.
 * backgroundWorkers() and the permanent test proving that route is GET-only).
 */
function BackgroundWorkersSection({ query }: { query: ReturnType<typeof useQuery<OperatorBackgroundWorkerView>> }) {
  return (
    <section aria-label="Background Workers" className="rounded-md border border-(--color-border) bg-(--color-surface) p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-(--color-text)">Background Workers</h2>
        {query.data ? (
          <StatusBadge
            status={query.data.globalKillSwitchActive ? 'BLOCKED' : 'HEALTHY'}
            label={query.data.globalKillSwitchActive ? 'Global kill switch ACTIVE' : 'Kill switch inactive'}
          />
        ) : null}
      </div>

      {query.isLoading ? <LoadingState label="Loading background workers" /> : null}
      {query.error ? <ErrorState error={query.error} /> : null}
      {!query.isLoading && !query.error && !query.data ? <EmptyState title="No background-worker data" /> : null}

      {query.data ? (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-(--color-text-faint)">
                <tr>
                  <th className="pb-2 pr-3 font-medium">Service</th>
                  <th className="pb-2 pr-3 font-medium">Type</th>
                  <th className="pb-2 pr-3 font-medium">Intentional stop</th>
                  <th className="pb-2 pr-3 font-medium">Restart eligibility</th>
                  <th className="pb-2 font-medium">Restarts</th>
                </tr>
              </thead>
              <tbody>
                {query.data.services.map(svc => (
                  <tr key={svc.id} className="border-t border-(--color-border)">
                    <td className="py-2 pr-3 text-(--color-text)">{svc.name}</td>
                    <td className="py-2 pr-3 text-(--color-text-dim)">{svc.type}</td>
                    <td className="py-2 pr-3">
                      {svc.intentionallyStopped ? <StatusBadge status="INTENTIONALLY_DISABLED" label="Intentionally stopped" /> : <span className="text-(--color-text-faint)">—</span>}
                    </td>
                    <td className="py-2 pr-3">
                      {svc.restartEligibility ? <StatusBadge status={eligibilityBadgeStatus(svc.restartEligibility)} label={svc.restartEligibility.replace(/_/g, ' ')} /> : <span className="text-(--color-text-faint)">n/a</span>}
                    </td>
                    <td className="py-2 text-(--color-text-dim)">{svc.restartCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase text-(--color-text-faint)">Manifest / runtime classification</h3>
              <div className="max-h-64 overflow-y-auto">
                {query.data.workerClassifications.map(w => (
                  <div key={w.id} className="grid gap-2 border-t border-(--color-border) py-2 text-xs text-(--color-text-dim) md:grid-cols-[1fr_9rem]">
                    <span className="break-all">{w.id}</span>
                    {w.behavioralHardeningDebt
                      ? <StatusBadge status="ATTENTION" label="Hardening debt" />
                      : <StatusBadge status="HEALTHY" label={w.authorityClass.replace(/_/g, ' ')} />}
                  </div>
                ))}
              </div>
              {query.data.behavioralHardeningDebtSurfaces.length > 0 ? (
                <p className="mt-2 text-xs text-(--color-text-faint)">
                  {query.data.behavioralHardeningDebtSurfaces.length} surface(s) honestly reclassified in Phase 9A (no false enforcement claim) but not yet behaviorally hardened — deeper changes require separate review.
                </p>
              ) : null}
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase text-(--color-text-faint)">Recent restart evidence</h3>
              <div className="max-h-64 overflow-y-auto">
                {query.data.recentRestartEvidence.length === 0 ? (
                  <EmptyState title="No restart evidence yet" />
                ) : (
                  query.data.recentRestartEvidence.map((row, i) => (
                    <div key={`${row.serviceId}-${row.createdAt}-${i}`} className="border-t border-(--color-border) py-2 text-xs text-(--color-text-dim)">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-(--color-text)">{row.pm2Name || row.serviceId}</span>
                        <span className="text-(--color-text-faint)">{new Date(row.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="mt-0.5">{row.decision.replace(/_/g, ' ')}{row.outcome ? ` — ${row.outcome.replace(/_/g, ' ')}` : ''}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {query.data.scanLastRunAt ? (
            <p className="text-xs text-(--color-text-faint)">Last SelfHeal scan: {new Date(query.data.scanLastRunAt).toLocaleString()}</p>
          ) : (
            <p className="text-xs text-(--color-text-faint)">No SelfHeal scan has completed since this server process started.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}

function eligibilityBadgeStatus(eligibility: string): string {
  if (eligibility === 'eligible') return 'HEALTHY';
  if (eligibility === 'intentionally_stopped') return 'INTENTIONALLY_DISABLED';
  if (eligibility === 'kill_switch_blocked') return 'BLOCKED';
  if (eligibility === 'restart_limit_reached') return 'ATTENTION';
  return 'UNKNOWN';
}

function ItemList({ items, empty }: { items: OperatorItem[]; empty: string }) {
  if (!items.length) return <EmptyState title={empty} />;
  return (
    <div className="space-y-2">
      {items.map(item => (
        <article key={item.id} className="rounded-md border border-(--color-border) p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="break-words text-sm font-medium text-(--color-text)">{item.title}</h3>
              <p className="mt-1 line-clamp-2 text-xs text-(--color-text-faint)">{item.summary}</p>
            </div>
            <StatusBadge status={item.state} label={item.state.replace(/_/g, ' ')} />
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-(--color-text-faint)">
            <span>{item.sourceType.replace(/_/g, ' ')}</span>
            {item.projectId ? <Link to={`/projects/${item.projectId}`} className="text-(--color-accent) hover:underline">{item.projectId}</Link> : null}
            {item.actionType ? <span>{item.actionType}</span> : null}
            {item.blockedReason !== 'NONE' ? <span>{item.blockedReason.replace(/_/g, ' ')}</span> : null}
          </div>
          <div className="mt-3 flex gap-2">
            <ItemLink item={item} />
          </div>
        </article>
      ))}
    </div>
  );
}

function ItemLink({ item }: { item: OperatorItem }) {
  if (item.sourceType === 'TASK_APPROVAL') return <LinkButton to={`/tasks/${item.sourceId}`} label="Open task" />;
  if (item.sourceType === 'CONTROLLED_ACTION') return <LinkButton to="/actions" label="Open action" />;
  if (item.sourceType === 'DELEGATION') return <LinkButton to={`/delegations/${item.sourceId}`} label="Open delegation" />;
  if (item.sourceType === 'ACTION_PLAN' || item.sourceType === 'ACTION_PLAN_STEP') return <LinkButton to={item.planId ? `/plans/${item.planId}` : '/plans'} label="Open plan" />;
  if (item.sourceType === 'KNOWLEDGE_CONFIRMATION') return <LinkButton to="/memory" label="Open memory" />;
  return <LinkButton to="/authority" label="Open authority" />;
}

function LinkButton({ to, label }: { to: string; label: string }) {
  return <Link to={to} className="rounded-md border border-(--color-border) px-2.5 py-1 text-xs text-(--color-text-dim) hover:border-(--color-accent) hover:text-(--color-accent)">{label}</Link>;
}

function Panel({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section className="rounded-md border border-(--color-border) bg-(--color-surface) p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-(--color-text)">{title}</h2>
        <span className="text-xs text-(--color-text-faint)">{count}</span>
      </div>
      {children}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-(--color-border) bg-(--color-surface) p-3">
      <div className="text-xs uppercase text-(--color-text-faint)">{label}</div>
      <div className="mt-1 text-xl font-semibold text-(--color-text)">{value}</div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-xs uppercase text-(--color-text-faint)">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-(--color-text)">{value}</div>
    </div>
  );
}
