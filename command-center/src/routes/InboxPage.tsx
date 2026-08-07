import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { EmailContext, FollowUpCandidate } from '@/lib/types';
import { DataBoundary, NotConfiguredState } from '@/components/States';
import { EvidenceButton } from '@/components/EvidenceDrawer';
import { maskEmail, formatRelative, truncate } from '@/lib/format';

export function InboxPage() {
  const [query, setQuery] = useState('');
  const status = useQuery({ queryKey: ['intelligence', 'status'], queryFn: () => api.get<{ status: string }>('/intelligence/status') });

  const followUps = useQuery({
    queryKey: ['intelligence', 'follow-ups'],
    queryFn: () => api.get<{ followUps: FollowUpCandidate[] }>('/intelligence/follow-ups?limit=30'),
    enabled: status.data?.status === 'READY',
  });

  const search = useMutation({
    mutationFn: (q: string) => api.post<{ results: EmailContext[] }>('/intelligence/email/search', { query: q, maxResults: 10 }),
  });

  if (status.data && status.data.status !== 'READY') {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="mb-4 text-xl font-semibold text-(--color-text)">Inbox</h1>
        <NotConfiguredState hint={`Google connector status: ${status.data.status}. Read-only — Command Center never sends, replies, or modifies Gmail.`} />
      </div>
    );
  }

  const emailFollowUps = (followUps.data?.followUps ?? []).filter(f => f.sourceType === 'EMAIL');

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 text-xl font-semibold text-(--color-text)">Inbox</h1>
      <p className="mb-4 text-xs text-(--color-text-faint)">Read-only bounded Gmail intelligence — no send, reply, draft, archive, delete, or label mutation exists here.</p>

      <div className="mb-4 flex gap-2">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && query.trim()) search.mutate(query.trim()); }}
          placeholder="Search email (bounded, evidence-linked)…"
          className="flex-1 rounded-md border border-(--color-border) bg-(--color-surface) px-3 py-1.5 text-sm outline-none focus-visible:border-(--color-accent)"
        />
        <button onClick={() => query.trim() && search.mutate(query.trim())} disabled={search.isPending || !query.trim()} className="rounded-md bg-(--color-accent) px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
          Search
        </button>
      </div>

      {search.data && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-(--color-text)">Search results</h2>
          <EmailList emails={search.data.results} />
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-(--color-text)">Follow-up candidates</h2>
        <DataBoundary isLoading={followUps.isLoading} error={followUps.error} isEmpty={emailFollowUps.length === 0} emptyTitle="No email follow-ups detected.">
          <ul className="space-y-2">
            {emailFollowUps.map(f => (
              <li key={f.id} className="rounded-lg border border-(--color-border) p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium uppercase text-(--color-suggestion)">{f.kind.replace(/_/g, ' ')}</span>
                  <EvidenceButton title={f.summary} entries={[{ label: 'Reason', value: f.reason }, { label: 'Confidence', value: String(f.confidence) }, { label: 'Evidence', value: f.evidenceReference }]} />
                </div>
                <p className="text-sm text-(--color-text-dim)">{f.summary}</p>
                {f.dueAt && <p className="mt-1 text-xs text-(--color-approval)">Due {f.dueAt}</p>}
              </li>
            ))}
          </ul>
        </DataBoundary>
      </section>
    </div>
  );
}

function EmailList({ emails }: { emails: EmailContext[] }) {
  if (emails.length === 0) return <p className="text-sm text-(--color-text-faint)">No matches.</p>;
  return (
    <ul className="space-y-2">
      {emails.map(e => (
        <li key={e.messageId} className="rounded-lg border border-(--color-border) p-3">
          <div className="mb-1 flex items-center justify-between">
            <p className="font-medium text-(--color-text)">{e.subject || '(no subject)'}</p>
            <EvidenceButton title={e.subject || e.messageId} entries={[{ label: 'From', value: maskEmail(e.from) }, { label: 'Received', value: e.receivedAt }, { label: 'Evidence', value: e.evidenceReference }]} />
          </div>
          <p className="text-xs text-(--color-text-faint)">{maskEmail(e.from)} · {formatRelative(e.receivedAt)}</p>
          <p className="mt-1 text-sm text-(--color-text-dim)">{truncate(e.bodySummary, 220)}</p>
        </li>
      ))}
    </ul>
  );
}
