import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { AuthorityManifest, AuthoritySurface } from '@/lib/types';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { StatusBadge } from '@/components/StatusBadge';

const FILTERS = ['ALL', 'CANONICAL', 'ADAPTER', 'QUARANTINED', 'FORBIDDEN'] as const;

export function AuthorityPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ['authority-manifest'],
    queryFn: () => api.get<AuthorityManifest>('/authority/manifest'),
    refetchInterval: 60_000,
  });

  const surfaces = useMemo(() => {
    const items = data?.surfaces ?? [];
    if (filter === 'CANONICAL') return items.filter(item => item.authorityClass.startsWith('CANONICAL'));
    if (filter === 'ADAPTER') return items.filter(item => item.authorityClass === 'ADAPTER_TO_CANONICAL');
    if (filter === 'QUARANTINED') return items.filter(item => item.authorityClass === 'LEGACY_QUARANTINED');
    if (filter === 'FORBIDDEN') return items.filter(item => item.authorityClass === 'FORBIDDEN');
    return items;
  }, [data, filter]);

  const selected = surfaces.find(item => item.id === selectedId) ?? surfaces[0] ?? null;

  if (isLoading) return <LoadingState label="Loading authority inventory" />;
  if (error) return <ErrorState error={error} />;
  if (!data) return <EmptyState title="No authority manifest" hint="The control plane manifest will appear after startup validation." />;

  return (
    <section className="mx-auto flex max-w-7xl gap-4 p-5">
      <div className="w-96 shrink-0">
        <header className="mb-4">
          <h1 className="text-2xl font-semibold text-(--color-text)">Authority</h1>
          <p className="mt-1 text-sm text-(--color-text-faint)">Control-plane inventory for runtime routes, CLI commands, workers, and legacy surfaces.</p>
        </header>

        <section className="mb-4 grid grid-cols-2 gap-2">
          <Metric label="Surfaces" value={data.counts.total} />
          <Metric label="Mutations" value={data.counts.mutations} />
          <Metric label="Canonical" value={data.counts.canonical} />
          <Metric label="Unknown" value={data.counts.unknownMutations} />
          <Metric label="Adapters" value={data.counts.adapters} />
          <Metric label="Quarantined" value={data.counts.quarantined} />
        </section>

        <div className="mb-3 flex rounded-md border border-(--color-border) p-1">
          {FILTERS.map(item => (
            <button
              key={item}
              onClick={() => { setFilter(item); setSelectedId(null); }}
              className={`flex-1 rounded px-2 py-1 text-xs ${filter === item ? 'bg-(--color-accent) text-white' : 'text-(--color-text-dim) hover:bg-white/5'}`}
            >
              {item === 'ALL' ? 'All' : item[0] + item.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <div className="max-h-[calc(100vh-22rem)] space-y-2 overflow-y-auto pr-1">
          {surfaces.slice(0, 250).map(surface => (
            <button
              key={surface.id}
              onClick={() => setSelectedId(surface.id)}
              className={`w-full rounded-md border p-3 text-left ${selected?.id === surface.id ? 'border-(--color-accent) bg-(--color-accent)/10' : 'border-(--color-border) bg-(--color-surface)'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="break-all text-sm font-medium text-(--color-text)">{surface.runtimeMount}</span>
                <StatusBadge status={surface.status} />
              </div>
              <div className="mt-2 text-xs text-(--color-text-faint)">{surface.method} · {surface.effectClass}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        {selected ? <AuthorityDetail surface={selected} /> : <EmptyState title="Select a surface" hint="Route, owner, auth, governance, and evidence details will show here." />}
      </div>
    </section>
  );
}

function AuthorityDetail({ surface }: { surface: AuthoritySurface }) {
  return (
    <article className="space-y-4">
      <header className="border-b border-(--color-border) pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="break-all text-xl font-semibold text-(--color-text)">{surface.runtimeMount}</h2>
            <p className="mt-1 text-sm text-(--color-text-dim)">{surface.capability}</p>
          </div>
          <StatusBadge status={surface.status} />
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <Info label="Method" value={surface.method} />
        <Info label="Kind" value={surface.kind} />
        <Info label="Effect" value={surface.effectClass} />
        <Info label="Authority" value={surface.authorityClass} />
        <Info label="Owner" value={surface.canonicalOwner} />
        <Info label="Auth" value={surface.authenticationRequired} />
        <Info label="Approval" value={surface.approvalRequired ? 'required' : 'not required'} />
        <Info label="Governance" value={surface.governanceRequired ? 'required' : 'not required'} />
        <Info label="Delegation" value={surface.delegationEligible ? 'eligible' : 'not eligible'} />
      </section>

      <section className="rounded-md border border-(--color-border) bg-(--color-surface) p-4">
        <h3 className="mb-2 text-sm font-semibold text-(--color-text)">Source</h3>
        <p className="break-all text-sm text-(--color-text-dim)">{surface.sourcePath}</p>
        {surface.legacyReason ? <p className="mt-3 text-sm text-(--color-approval)">{surface.legacyReason}</p> : null}
        {surface.migrationTarget ? <p className="mt-2 text-sm text-(--color-text-dim)">Migration target: {surface.migrationTarget}</p> : null}
      </section>

      <section className="rounded-md border border-(--color-border) bg-(--color-surface) p-4">
        <h3 className="mb-2 text-sm font-semibold text-(--color-text)">Evidence</h3>
        <ul className="space-y-2 text-sm text-(--color-text-dim)">
          {surface.evidence.map(item => <li key={item}>{item}</li>)}
        </ul>
      </section>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-(--color-border) bg-(--color-surface) p-3">
      <div className="text-xs uppercase text-(--color-text-faint)">{label}</div>
      <div className="mt-1 text-lg font-semibold text-(--color-text)">{value}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-(--color-border) bg-(--color-surface) p-3">
      <div className="text-xs uppercase text-(--color-text-faint)">{label}</div>
      <div className="mt-1 break-words text-sm text-(--color-text)">{value}</div>
    </div>
  );
}
