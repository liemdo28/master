import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { CalendarEventContext } from '@/lib/types';
import { DataBoundary, NotConfiguredState } from '@/components/States';
import { StatusBadge } from '@/components/StatusBadge';
import { EvidenceButton } from '@/components/EvidenceDrawer';
import { formatDate, formatTime } from '@/lib/format';

type View = 'Today' | 'Week';

export function CalendarPage() {
  const [view, setView] = useState<View>('Today');
  const status = useQuery({ queryKey: ['intelligence', 'status'], queryFn: () => api.get<{ status: string }>('/intelligence/status') });
  const today = useQuery({
    queryKey: ['intelligence', 'calendar', 'today'],
    queryFn: () => api.get<{ date: string; events: CalendarEventContext[] }>('/intelligence/calendar/today'),
    enabled: view === 'Today' && status.data?.status === 'READY',
  });
  const week = useQuery({
    queryKey: ['intelligence', 'calendar', 'week'],
    queryFn: () => api.get<{ weekStart: string; events: CalendarEventContext[] }>('/intelligence/calendar/week'),
    enabled: view === 'Week' && status.data?.status === 'READY',
  });

  if (status.data && status.data.status !== 'READY') {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="mb-4 text-xl font-semibold text-(--color-text)">Calendar</h1>
        <NotConfiguredState hint={`Google connector status: ${status.data.status}. Read-only — Command Center never writes to Calendar.`} />
      </div>
    );
  }

  const q = view === 'Today' ? today : week;
  const events = (q.data?.events ?? []).slice().sort((a, b) => a.start.localeCompare(b.start));

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-(--color-text)">Calendar</h1>
        <div className="flex gap-1">
          {(['Today', 'Week'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} className={`rounded-md px-3 py-1 text-sm ${view === v ? 'bg-(--color-accent)/20 text-(--color-accent)' : 'text-(--color-text-dim) hover:bg-white/5'}`}>{v}</button>
          ))}
        </div>
      </div>
      <p className="mb-4 text-xs text-(--color-text-faint)">Read-only — no create, update, delete, or RSVP action exists in this view.</p>

      <DataBoundary isLoading={q.isLoading || status.isLoading} error={q.error} isEmpty={events.length === 0} emptyTitle="No events." onRetry={() => q.refetch()}>
        <ul className="space-y-1.5">
          {events.map(e => (
            <li key={e.eventId} className={`rounded-md border px-3 py-2 text-sm ${e.status === 'CANCELLED' ? 'border-(--color-border) opacity-50' : 'border-(--color-border)'}`}>
              <div className="flex items-center justify-between">
                <span>
                  <span className="font-mono text-(--color-text-faint)">{e.allDay ? formatDate(e.start) : formatTime(e.start)}</span>{' '}
                  <span className="text-(--color-text)">{e.title}</span>
                </span>
                <div className="flex items-center gap-2">
                  {e.status !== 'CONFIRMED' && <StatusBadge status={e.status} />}
                  <EvidenceButton title={e.title} entries={[
                    { label: 'Event id', value: e.eventId },
                    { label: 'Attendees', value: String(e.attendees.length) },
                    { label: 'Evidence', value: e.evidenceReference },
                  ]} />
                </div>
              </div>
              {e.location && <p className="mt-1 text-xs text-(--color-text-faint)">{e.location}</p>}
            </li>
          ))}
        </ul>
      </DataBoundary>
    </div>
  );
}
