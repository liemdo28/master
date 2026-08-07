import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { KnowledgeDocument } from '@/lib/types';
import { DataBoundary } from '@/components/States';
import { StatusBadge } from '@/components/StatusBadge';
import { shortChecksum, formatDateTime } from '@/lib/format';

interface Chunk {
  id: string;
  headingPath: string[];
  text: string;
  lineStart: number | null;
  lineEnd: number | null;
}

export function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const doc = useQuery({
    queryKey: ['knowledge-documents', id],
    queryFn: () => api.get<KnowledgeDocument>(`/knowledge-documents/${id}`),
    enabled: !!id,
  });
  const chunks = useQuery({
    queryKey: ['knowledge-documents', id, 'chunks'],
    queryFn: () => api.get<{ chunks: Chunk[] }>(`/knowledge-documents/${id}/chunks`),
    enabled: !!id,
  });

  const reindex = useMutation({
    mutationFn: () => api.post(`/knowledge-documents/${id}/reindex`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['knowledge-documents', id] }),
  });
  const del = useMutation({
    mutationFn: () => api.del(`/knowledge-documents/${id}`),
    onSuccess: () => navigate('/knowledge'),
  });

  const d = doc.data;

  return (
    <div className="mx-auto max-w-3xl p-6">
      <Link to="/knowledge" className="text-sm text-(--color-text-dim) hover:text-(--color-accent)">← Knowledge</Link>

      <DataBoundary isLoading={doc.isLoading} error={doc.error} onRetry={() => doc.refetch()}>
        {d && (
          <div className="mt-2 space-y-6">
            <header className="flex items-start justify-between">
              <div>
                <h1 className="text-lg font-semibold text-(--color-text)">{d.title}</h1>
                <p className="mt-1 text-sm text-(--color-text-faint)">{d.sourceUri}</p>
              </div>
              <StatusBadge status={d.status} />
            </header>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Type" value={d.type ?? '—'} />
              <Field label="Projects" value={d.projectIds.join(', ') || '—'} />
              <Field label="Version" value={String(d.version)} />
              <Field label="Checksum" value={shortChecksum(d.checksum)} />
              <Field label="Indexed" value={formatDateTime(d.indexedAt)} />
              <Field label="Size" value={d.sizeBytes ? `${Math.round(d.sizeBytes / 1024)} KB` : '—'} />
            </dl>

            <div className="flex gap-2">
              <button onClick={() => reindex.mutate()} disabled={reindex.isPending} className="rounded-md border border-(--color-border) px-3 py-1.5 text-sm hover:border-(--color-accent) disabled:opacity-50">
                {reindex.isPending ? 'Reindexing…' : 'Reindex'}
              </button>
              <button onClick={() => { if (confirm('Delete this document? This cannot be undone.')) del.mutate(); }} disabled={del.isPending} className="rounded-md border border-(--color-blocked)/40 px-3 py-1.5 text-sm text-(--color-blocked) hover:bg-(--color-blocked)/10 disabled:opacity-50">
                Delete
              </button>
            </div>

            <section>
              <h2 className="mb-2 text-sm font-semibold text-(--color-text)">Chunks / citation anchors</h2>
              <DataBoundary isLoading={chunks.isLoading} error={chunks.error} isEmpty={(chunks.data?.chunks.length ?? 0) === 0} emptyTitle="No chunks indexed.">
                <ul className="space-y-2">
                  {(chunks.data?.chunks ?? []).map(c => (
                    <li key={c.id} className="rounded-md border border-(--color-border) p-3 text-sm">
                      <p className="mb-1 text-xs text-(--color-text-faint)">
                        {c.headingPath.join(' > ') || '(no heading)'}{c.lineStart != null ? ` · lines ${c.lineStart}-${c.lineEnd}` : ''}
                      </p>
                      <p className="text-(--color-text-dim)">{c.text.slice(0, 300)}</p>
                    </li>
                  ))}
                </ul>
              </DataBoundary>
            </section>
          </div>
        )}
      </DataBoundary>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-(--color-text-faint)">{label}</dt>
      <dd className="text-(--color-text)">{value}</dd>
    </div>
  );
}
