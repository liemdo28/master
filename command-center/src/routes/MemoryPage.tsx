import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { KnowledgeRecord, KnowledgeStatus } from '@/lib/types';
import { DataBoundary } from '@/components/States';
import { StatusBadge } from '@/components/StatusBadge';
import { formatRelative } from '@/lib/format';

const STATUSES: Array<KnowledgeStatus | 'ALL'> = ['ALL', 'ACTIVE', 'NEEDS_CONFIRMATION', 'SUPERSEDED', 'EXPIRED', 'DELETED'];

const PROVENANCE_LABEL: Record<string, string> = {
  'user-stated': 'User-stated',
  confirmed: 'Confirmed',
  inferred: 'Inferred',
};

export function MemoryPage() {
  const [filter, setFilter] = useState<KnowledgeStatus | 'ALL'>('NEEDS_CONFIRMATION');
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['knowledge', 'all'],
    queryFn: () => api.get<{ knowledge: KnowledgeRecord[] }>('/knowledge?includeInactive=true'),
  });
  const queryClient = useQueryClient();

  const confirm = useMutation({
    mutationFn: (id: string) => api.post(`/knowledge/${id}/confirm`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['knowledge', 'all'] }),
  });
  const del = useMutation({
    mutationFn: (id: string) => api.del(`/knowledge/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['knowledge', 'all'] }),
  });

  const records = (data?.knowledge ?? []).filter(r => filter === 'ALL' || r.status === filter);

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-4 text-xl font-semibold text-(--color-text)">Memory</h1>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {STATUSES.map(s => (
          <button key={s} onClick={() => setFilter(s)} className={`rounded-full px-2.5 py-1 text-xs ${filter === s ? 'bg-(--color-accent)/20 text-(--color-accent)' : 'text-(--color-text-dim) hover:bg-white/5'}`}>
            {s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      <DataBoundary isLoading={isLoading} error={error} isEmpty={records.length === 0} emptyTitle="Nothing in this filter." onRetry={() => refetch()}>
        <ul className="space-y-2">
          {records.map(r => (
            <li key={r.id} className="rounded-lg border border-(--color-border) p-3">
              <div className="mb-1 flex items-center justify-between">
                <p className="font-medium text-(--color-text)">{r.title}</p>
                <StatusBadge status={r.status} />
              </div>
              <p className="text-sm text-(--color-text-dim)">{r.summary}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-(--color-text-faint)">
                <span>{r.kind}</span>
                {r.provenance && <span className="rounded bg-white/5 px-1.5 py-0.5">{PROVENANCE_LABEL[r.provenance] ?? r.provenance}</span>}
                {r.scope && <span>{r.scope}</span>}
                <span>updated {formatRelative(r.updatedAt)}</span>
              </div>
              {r.status === 'NEEDS_CONFIRMATION' && (
                <div className="mt-2 flex gap-2">
                  <button onClick={() => confirm.mutate(r.id)} disabled={confirm.isPending} className="rounded-md bg-(--color-accent) px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50">Confirm</button>
                  <button onClick={() => del.mutate(r.id)} disabled={del.isPending} className="rounded-md border border-(--color-border) px-2.5 py-1 text-xs text-(--color-text-dim) hover:border-(--color-blocked) hover:text-(--color-blocked) disabled:opacity-50">Dismiss</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </DataBoundary>
    </div>
  );
}
