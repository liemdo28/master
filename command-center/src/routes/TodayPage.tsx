import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api-client';
import type { DailyOperatingBrief } from '@/lib/types';
import { DataBoundary } from '@/components/States';
import { StatusBadge } from '@/components/StatusBadge';
import { CategoryList } from '@/components/CategoryList';
import { EvidenceButton } from '@/components/EvidenceDrawer';
import { formatDateTime, formatTime, formatRelative } from '@/lib/format';

function useBrief() {
  return useQuery({
    queryKey: ['operating', 'today'],
    queryFn: () => api.get<DailyOperatingBrief>('/operating/today'),
  });
}

export function TodayPage() {
  const { data: brief, isLoading, error, refetch } = useBrief();
  const queryClient = useQueryClient();

  const generate = useMutation({
    mutationFn: () => api.post<DailyOperatingBrief>('/operating/today/generate'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['operating', 'today'] }),
  });
  const refresh = useMutation({
    mutationFn: () => api.post('/operating/today/refresh'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['operating', 'today'] }),
  });

  return (
    <div className="mx-auto max-w-4xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-(--color-text)">Today</h1>
          {brief && <p className="text-sm text-(--color-text-dim)">{brief.date} · {brief.timezone} · generated {formatRelative(brief.generatedAt)}{brief.refreshedAt ? `, refreshed ${formatRelative(brief.refreshedAt)}` : ''}</p>}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending}
            className="rounded-md border border-(--color-border) px-3 py-1.5 text-sm text-(--color-text-dim) hover:border-(--color-accent) disabled:opacity-50"
          >
            {refresh.isPending ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
            className="rounded-md bg-(--color-accent) px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {generate.isPending ? 'Generating…' : brief ? 'Regenerate' : 'Generate morning brief'}
          </button>
        </div>
      </header>

      <DataBoundary
        isLoading={isLoading}
        error={error}
        isEmpty={!brief}
        emptyTitle="No morning brief for today yet."
        emptyHint="Click “Generate morning brief” above."
        onRetry={() => refetch()}
      >
        {brief && <TodayContent brief={brief} />}
      </DataBoundary>
    </div>
  );
}

function TodayContent({ brief }: { brief: DailyOperatingBrief }) {
  return (
    <div className="space-y-6">
      <Link
        to="/today/plan"
        className="block rounded-lg border border-(--color-accent)/30 bg-(--color-accent)/5 p-4 text-(--color-accent) hover:bg-(--color-accent)/10"
      >
        Open today's Daily Plan →
      </Link>

      <Section title="Fixed commitments" count={brief.meetings.length}>
        {brief.meetings.length === 0 ? (
          <p className="text-sm text-(--color-text-faint)">No meetings today.</p>
        ) : (
          <ul className="space-y-1.5">
            {brief.meetings.map(m => (
              <li key={m.eventId} className="flex items-center justify-between rounded-md border border-(--color-border) px-3 py-2 text-sm">
                <span>
                  <span className="font-mono text-(--color-text-faint)">{formatTime(m.start)}</span>{' '}
                  <span className="text-(--color-text)">{m.title}</span>
                  {m.status === 'TENTATIVE' && <span className="ml-2 text-xs text-(--color-attention)">tentative</span>}
                </span>
                <EvidenceButton title={m.title} entries={[
                  { label: 'Event id', value: m.eventId },
                  { label: 'Attendees', value: String(m.attendees.length) },
                  { label: 'Evidence', value: m.evidenceReference },
                ]} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      {brief.deadlines.length > 0 && (
        <Section title="Deadlines" count={brief.deadlines.length}>
          <ul className="space-y-1.5">
            {brief.deadlines.map((d, i) => (
              <li key={i} className="rounded-md border border-(--color-approval)/30 bg-(--color-approval)/5 px-3 py-2 text-sm text-(--color-text)">
                {d.summary} — due {d.dueAt}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Priority tasks" count={brief.priorityTasks.length}>
        <ul className="space-y-1.5">
          {brief.priorityTasks.map(t => (
            <li key={t.id}>
              <Link to={`/tasks/${t.id}`} className="flex items-center justify-between rounded-md border border-(--color-border) px-3 py-2 text-sm hover:border-(--color-accent)">
                <span className="truncate text-(--color-text)">{t.id}</span>
                <StatusBadge status={t.status} />
              </Link>
            </li>
          ))}
          {brief.priorityTasks.length === 0 && <p className="text-sm text-(--color-text-faint)">No tasks awaiting attention.</p>}
        </ul>
      </Section>

      <Section title="Pending approvals" count={brief.pendingApprovals.length}>
        {brief.pendingApprovals.length === 0 ? (
          <p className="text-sm text-(--color-text-faint)">Nothing waiting on you.</p>
        ) : (
          <Link to="/approvals" className="block rounded-md border border-(--color-approval)/30 bg-(--color-approval)/5 px-3 py-2 text-sm text-(--color-approval) hover:bg-(--color-approval)/10">
            {brief.pendingApprovals.length} item(s) waiting — open Approval Center →
          </Link>
        )}
      </Section>

      {brief.focusWindows.length > 0 && (
        <Section title="Focus windows" count={brief.focusWindows.length}>
          <ul className="space-y-1.5">
            {brief.focusWindows.map((w, i) => (
              <li key={i} className="rounded-md border border-(--color-border) px-3 py-2 text-sm text-(--color-text-dim)">
                {formatTime(w.start)}–{formatTime(w.end)} ({w.durationMinutes}m) — {w.reason}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Project health" count={brief.projectHealth.length}>
        <ul className="space-y-1.5">
          {brief.projectHealth.map(p => (
            <li key={p.projectId}>
              <Link to={`/projects/${p.projectId}`} className="flex items-center justify-between rounded-md border border-(--color-border) px-3 py-2 text-sm hover:border-(--color-accent)">
                <span className="text-(--color-text)">{p.projectId}</span>
                <StatusBadge status={p.status} />
              </Link>
            </li>
          ))}
          {brief.projectHealth.length === 0 && <p className="text-sm text-(--color-text-faint)">No active-goal-linked project to report on.</p>}
        </ul>
      </Section>

      <Section title="Service health" count={brief.serviceHealth.length}>
        <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {brief.serviceHealth.map(s => (
            <li key={s.service} className="flex items-center justify-between rounded-md border border-(--color-border) px-2 py-1.5 text-xs">
              <span className="truncate text-(--color-text-dim)">{s.service}</span>
              <StatusBadge status={s.status} />
            </li>
          ))}
        </ul>
      </Section>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="rounded-lg border border-(--color-border) p-4">
          <CategoryList kind="fact" items={brief.facts} />
        </div>
        <div className="space-y-4 rounded-lg border border-(--color-border) p-4">
          <CategoryList kind="suggestion" items={brief.suggestions} />
          <CategoryList kind="unknown" items={brief.unknowns} />
          {brief.blockers.length > 0 && <CategoryList kind="unknown" title="BLOCKERS" items={brief.blockers} />}
        </div>
      </div>

      <p className="text-xs text-(--color-text-faint)">
        Generated {formatDateTime(brief.generatedAt)}. This brief never triggers an external action — see Approvals for anything that needs your decision.
      </p>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-(--color-text)">
        {title} <span className="text-(--color-text-faint)">({count})</span>
      </h2>
      {children}
    </section>
  );
}
