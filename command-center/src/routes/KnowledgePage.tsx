import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api-client';
import type { KnowledgeDocument, KnowledgeQualitySummary, IngestionJobSummary } from '@/lib/types';
import { DataBoundary } from '@/components/States';
import { StatusBadge } from '@/components/StatusBadge';
import { shortChecksum, formatDate } from '@/lib/format';

interface SearchResult {
  documentId: string; chunkId: string; title: string; sourceUri: string;
  headingPath: string[]; excerpt: string; score: number; isStale: boolean;
}
interface ConflictRecord {
  id: string; status: string; chunkIds: string[]; description?: string; projectIds: string[];
}

const TABS = ['Search', 'Documents', 'Stale', 'Conflicts', 'Quality'] as const;

export function KnowledgePage() {
  const [tab, setTab] = useState<typeof TABS[number]>('Search');
  const [query, setQuery] = useState('');
  const [projectIds, setProjectIds] = useState('mi-core');
  const [submittedQuery, setSubmittedQuery] = useState<{ text: string; projectIds: string[] } | null>(null);

  const search = useMutation({
    mutationFn: (body: { text: string; projectIds: string[] }) => api.post<{ results: SearchResult[] }>('/knowledge-documents/search', { text: body.text, projectIds: body.projectIds, limit: 10 }),
  });

  const documents = useQuery({
    queryKey: ['knowledge-documents'],
    queryFn: () => api.get<{ documents: KnowledgeDocument[] }>('/knowledge-documents'),
    enabled: tab === 'Documents',
  });
  const stale = useQuery({
    queryKey: ['knowledge-documents', 'stale'],
    queryFn: () => api.get<{ stale: KnowledgeDocument[] }>('/knowledge-documents/stale'),
    enabled: tab === 'Stale',
  });
  const conflicts = useQuery({
    queryKey: ['knowledge-documents', 'conflicts'],
    queryFn: () => api.get<{ conflicts: ConflictRecord[] }>('/knowledge-documents/conflicts'),
    enabled: tab === 'Conflicts',
  });
  const quality = useQuery({
    queryKey: ['knowledge-documents', 'quality-summary'],
    queryFn: () => api.get<KnowledgeQualitySummary>('/knowledge-documents/quality-summary'),
    enabled: tab === 'Quality',
  });
  const failedJobs = useQuery({
    queryKey: ['knowledge-documents', 'ingestion-jobs', 'FAILED'],
    queryFn: () => api.get<{ jobs: IngestionJobSummary[] }>('/knowledge-documents/ingestion-jobs?status=FAILED'),
    enabled: tab === 'Quality',
  });

  function onSearch() {
    const ids = projectIds.split(',').map(s => s.trim()).filter(Boolean);
    if (!query.trim() || ids.length === 0) return;
    const body = { text: query.trim(), projectIds: ids };
    setSubmittedQuery(body);
    search.mutate(body);
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-4 text-xl font-semibold text-(--color-text)">Knowledge</h1>
      <div className="mb-4 flex gap-1 border-b border-(--color-border)">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`border-b-2 px-3 py-2 text-sm ${tab === t ? 'border-(--color-accent) text-(--color-accent)' : 'border-transparent text-(--color-text-dim) hover:text-(--color-text)'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Search' && (
        <div>
          <div className="mb-4 flex gap-2">
            <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && onSearch()} placeholder="Search knowledge…" className="flex-1 rounded-md border border-(--color-border) bg-(--color-surface) px-3 py-1.5 text-sm outline-none focus-visible:border-(--color-accent)" />
            <input value={projectIds} onChange={e => setProjectIds(e.target.value)} placeholder="project ids, comma-separated" className="w-56 rounded-md border border-(--color-border) bg-(--color-surface) px-3 py-1.5 text-sm outline-none focus-visible:border-(--color-accent)" />
            <button onClick={onSearch} disabled={search.isPending} className="rounded-md bg-(--color-accent) px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">Search</button>
          </div>
          {submittedQuery && (
            <DataBoundary isLoading={search.isPending} error={search.error} isEmpty={(search.data?.results.length ?? 0) === 0} emptyTitle="No matching knowledge.">
              <ul className="space-y-2">
                {(search.data?.results ?? []).map(r => (
                  <li key={r.chunkId}>
                    <Link to={`/knowledge/documents/${r.documentId}`} className="block rounded-lg border border-(--color-border) p-3 hover:border-(--color-accent)">
                      <div className="mb-1 flex items-center justify-between">
                        <p className="font-medium text-(--color-text)">{r.title}</p>
                        {r.isStale && <StatusBadge status="STALE" />}
                      </div>
                      <p className="text-sm text-(--color-text-dim)">{r.excerpt}</p>
                      <p className="mt-1 text-xs text-(--color-text-faint)">{r.sourceUri} {r.headingPath?.length ? `· ${r.headingPath.join(' > ')}` : ''}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </DataBoundary>
          )}
        </div>
      )}

      {tab === 'Documents' && (
        <DataBoundary isLoading={documents.isLoading} error={documents.error} isEmpty={(documents.data?.documents.length ?? 0) === 0} emptyTitle="No documents indexed.">
          <DocList docs={documents.data?.documents ?? []} />
        </DataBoundary>
      )}

      {tab === 'Stale' && (
        <DataBoundary isLoading={stale.isLoading} error={stale.error} isEmpty={(stale.data?.stale.length ?? 0) === 0} emptyTitle="Nothing is stale.">
          <DocList docs={stale.data?.stale ?? []} />
        </DataBoundary>
      )}

      {tab === 'Conflicts' && (
        <DataBoundary isLoading={conflicts.isLoading} error={conflicts.error} isEmpty={(conflicts.data?.conflicts.length ?? 0) === 0} emptyTitle="No open conflicts.">
          <ul className="space-y-2">
            {(conflicts.data?.conflicts ?? []).map(c => (
              <li key={c.id} className="rounded-lg border border-(--color-unknown)/30 bg-(--color-unknown)/5 p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-mono text-xs text-(--color-text-faint)">{c.id}</span>
                  <StatusBadge status={c.status} />
                </div>
                <p className="text-sm text-(--color-text-dim)">{c.description ?? `${c.chunkIds.length} conflicting chunk(s) across ${c.projectIds.join(', ')}`}</p>
              </li>
            ))}
          </ul>
        </DataBoundary>
      )}

      {tab === 'Quality' && (
        <DataBoundary isLoading={quality.isLoading} error={quality.error} isEmpty={false}>
          {quality.data && (
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <QualityStat label="Documents" value={quality.data.documents} />
              <QualityStat label="Chunks" value={quality.data.chunks} />
              <QualityStat label="Projects" value={quality.data.projects} />
              <QualityStat label="Stale" value={quality.data.staleDocuments} />
              <QualityStat label="Open conflicts" value={quality.data.openConflicts} />
              <QualityStat label="Failed ingestion" value={quality.data.failedIngestion} />
              <QualityStat label="Retryable" value={quality.data.retryableIngestion} />
              <QualityStat label="Blocked" value={quality.data.blockedIngestion} />
              <div className="col-span-2 flex items-center gap-2 rounded-lg border border-(--color-border) p-3 sm:col-span-4">
                <span className="text-sm text-(--color-text-dim)">Index health</span>
                <StatusBadge status={quality.data.indexHealth} />
              </div>
            </div>
          )}
          <h2 className="mb-2 text-sm font-medium text-(--color-text)">Failed ingestion</h2>
          <DataBoundary isLoading={failedJobs.isLoading} error={failedJobs.error} isEmpty={(failedJobs.data?.jobs.length ?? 0) === 0} emptyTitle="No failed ingestion jobs.">
            <ul className="space-y-2">
              {(failedJobs.data?.jobs ?? []).map(j => (
                <li key={j.id} className="rounded-lg border border-(--color-border) p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-mono text-xs text-(--color-text-faint)">{j.id}</span>
                    <StatusBadge status={j.status} />
                  </div>
                  <p className="text-sm text-(--color-text-dim)">{j.errorCode ?? 'UNKNOWN_ERROR'}{j.safeError ? ` — ${j.safeError}` : ''}</p>
                </li>
              ))}
            </ul>
          </DataBoundary>
        </DataBoundary>
      )}
    </div>
  );
}

function QualityStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-(--color-border) p-3">
      <p className="text-lg font-semibold text-(--color-text)">{value}</p>
      <p className="text-xs text-(--color-text-faint)">{label}</p>
    </div>
  );
}

function DocList({ docs }: { docs: KnowledgeDocument[] }) {
  return (
    <ul className="space-y-2">
      {docs.map(d => (
        <li key={d.id}>
          <Link to={`/knowledge/documents/${d.id}`} className="flex items-center justify-between rounded-lg border border-(--color-border) p-3 hover:border-(--color-accent)">
            <div className="min-w-0">
              <p className="truncate font-medium text-(--color-text)">{d.title}</p>
              <p className="truncate text-xs text-(--color-text-faint)">{d.sourceUri} · v{d.version} · {shortChecksum(d.checksum)} · indexed {formatDate(d.indexedAt)}</p>
            </div>
            <StatusBadge status={d.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
