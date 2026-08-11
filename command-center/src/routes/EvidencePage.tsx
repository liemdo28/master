import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { DailyAuditDigest, EvidenceRecord, HealthMetric } from '@/lib/types';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { StatusBadge } from '@/components/StatusBadge';

const today = () => new Date().toISOString().slice(0, 10);

export function EvidencePage() {
  const [category, setCategory] = useState<string>('');
  const [sourceSystem, setSourceSystem] = useState<string>('');

  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (sourceSystem) params.set('sourceSystem', sourceSystem);
  const query = params.toString();

  const evidence = useQuery({
    queryKey: ['evidence', 'list', category, sourceSystem],
    queryFn: () => api.get<{ evidence: EvidenceRecord[] }>(`/evidence${query ? `?${query}` : ''}`),
    refetchInterval: 30_000,
  });
  const conflicts = useQuery({
    queryKey: ['evidence', 'conflicts'],
    queryFn: () => api.get<{ conflicts: EvidenceRecord[] }>('/evidence/conflicts'),
    refetchInterval: 30_000,
  });
  const health = useQuery({
    queryKey: ['evidence', 'health'],
    queryFn: () => api.get<{ health: HealthMetric[] }>('/evidence/health'),
    refetchInterval: 30_000,
  });
  const digest = useQuery({
    queryKey: ['evidence', 'digest'],
    queryFn: () => api.get<{ digest: DailyAuditDigest }>(`/evidence/digest/${today()}`),
    refetchInterval: 60_000,
  });

  if (evidence.isLoading || conflicts.isLoading || health.isLoading || digest.isLoading) return <LoadingState label="Loading evidence" />;
  const err = evidence.error || conflicts.error || health.error || digest.error;
  if (err) return <section className="mx-auto max-w-7xl p-5"><ErrorState error={err} /></section>;

  const records = evidence.data?.evidence ?? [];
  const openConflicts = conflicts.data?.conflicts ?? [];
  const healthMetrics = health.data?.health ?? [];
  const d = digest.data?.digest;

  return (
    <section className="mx-auto max-w-7xl space-y-5 p-5">
      <header className="border-b border-(--color-border) pb-4">
        <h1 className="text-2xl font-semibold text-(--color-text)">Evidence &amp; Audit</h1>
        <p className="mt-1 text-sm text-(--color-text-faint)">
          A read-through, read-only view over every existing decision/approval/execution/conflict/health
          record in the system — facts, inferences, assumptions, and unknowns are always shown distinctly,
          never upgraded past what their own source committed to. There is no action to take from this
          screen; go to Approvals, Actions, Plans, or Delegations to act on something shown here.
        </p>
      </header>

      {d && (
        <section aria-label="Today's digest" className="grid gap-3 md:grid-cols-6">
          <Metric label="Decisions" value={d.decisions} />
          <Metric label="Approvals" value={d.approvals} />
          <Metric label="Executions" value={d.executions} />
          <Metric label="Denials" value={d.denials} />
          <Metric label="Open conflicts" value={d.openConflicts} />
          <Metric label="Health degradations" value={d.healthDegradations} />
        </section>
      )}

      <section aria-label="Conflicts" className="rounded-md border border-(--color-border) bg-(--color-surface) p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-(--color-text)">Open Conflicts</h2>
          <span className="text-xs text-(--color-text-faint)">{openConflicts.length}</span>
        </div>
        <p className="mb-3 text-xs text-(--color-text-faint)">
          A conflict stays listed here until its own source system marks it resolved — this screen never
          silently picks a winner between disagreeing sources.
        </p>
        {!openConflicts.length ? <EmptyState title="No open conflicts" /> : (
          <div className="space-y-2">
            {openConflicts.map(c => (
              <article key={c.id} className="rounded-md border border-(--color-border) p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm text-(--color-text)">{c.claim}</p>
                  <StatusBadge status="ATTENTION" label="OPEN" />
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-(--color-text-faint)">
                  <span>{c.sourceSystem}</span>
                  {c.projectId && <span>{c.projectId}</span>}
                  {c.relatedEvidence.map(r => <span key={r}>{r}</span>)}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section aria-label="Health" className="rounded-md border border-(--color-border) bg-(--color-surface) p-4">
        <h2 className="mb-3 text-sm font-semibold text-(--color-text)">Health</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {healthMetrics.map(h => (
            <div key={h.dimension} className="rounded-md border border-(--color-border) p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase text-(--color-text-faint)">{h.dimension.replace(/_/g, ' ')}</span>
                <StatusBadge status={h.status === 'OK' ? 'HEALTHY' : h.status === 'ATTENTION' ? 'ATTENTION' : h.status === 'CRITICAL' ? 'DOWN' : 'UNKNOWN'} label={h.status} />
              </div>
              <div className="mt-1 text-lg font-semibold text-(--color-text)">{h.value}</div>
              <p className="mt-1 text-xs text-(--color-text-faint)">{h.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-label="Evidence stream" className="rounded-md border border-(--color-border) bg-(--color-surface) p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-(--color-text)">Evidence Stream</h2>
          <div className="flex gap-2">
            <select value={category} onChange={e => setCategory(e.target.value)} className="rounded border border-(--color-border) bg-transparent px-2 py-1 text-xs">
              <option value="">All categories</option>
              {['FACT', 'INFERENCE', 'ASSUMPTION', 'UNKNOWN', 'CONFLICT', 'DECISION', 'SIDE_EFFECT', 'HEALTH', 'POLICY', 'APPROVAL', 'EXECUTION', 'SOURCE_REFERENCE'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select value={sourceSystem} onChange={e => setSourceSystem(e.target.value)} className="rounded border border-(--color-border) bg-transparent px-2 py-1 text-xs">
              <option value="">All sources</option>
              {['CONTROLLED_ACTIONS', 'GOVERNANCE', 'ORCHESTRATION', 'DELEGATION', 'KNOWLEDGE', 'TASK_RUNTIME'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
        {!records.length ? <EmptyState title="No evidence matches this filter" /> : (
          <div className="max-h-[32rem] space-y-1 overflow-y-auto">
            {records.slice(0, 200).map(r => (
              <div key={r.id} className="grid grid-cols-[6rem_7rem_1fr_5rem] items-center gap-2 border-t border-(--color-border) py-2 text-xs">
                <span className="font-mono text-(--color-text-faint)">{new Date(r.observedAt).toLocaleTimeString()}</span>
                <CategoryChip category={r.category} confidence={r.confidence} />
                <span className="truncate text-(--color-text-dim)">{r.claim}</span>
                <FreshnessChip freshness={r.freshness} />
              </div>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function CategoryChip({ category, confidence }: { category: string; confidence: string }) {
  // Fact/inference/assumption/unknown are always shown with their confidence alongside
  // the category label — never just a bare category name that could be mistaken for a
  // stronger claim than the source actually made (§6D.3).
  return (
    <span className="text-(--color-text-faint)">
      {category}
      {['FACT', 'INFERENCE', 'ASSUMPTION', 'UNKNOWN'].includes(category) && <span className="ml-1 opacity-70">({confidence})</span>}
    </span>
  );
}

function FreshnessChip({ freshness }: { freshness: string }) {
  const color = freshness === 'FRESH' ? 'text-(--color-healthy)' : freshness === 'AGING' ? 'text-(--color-attention)' : freshness === 'STALE' ? 'text-(--color-down)' : 'text-(--color-text-faint)';
  return <span className={color}>{freshness}</span>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-(--color-border) bg-(--color-surface) p-3">
      <div className="text-xs uppercase text-(--color-text-faint)">{label}</div>
      <div className="mt-1 text-xl font-semibold text-(--color-text)">{value}</div>
    </div>
  );
}
