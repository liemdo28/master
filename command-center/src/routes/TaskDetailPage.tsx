import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { TaskRecord, TaskEvent } from '@/lib/types';
import { DataBoundary } from '@/components/States';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDateTime } from '@/lib/format';

const CANCELLABLE = new Set(['CREATED', 'CONTEXT_BUILDING', 'PLANNING', 'WAITING_APPROVAL', 'READY', 'RUNNING']);

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const task = useQuery({
    queryKey: ['task-runtime', 'tasks', id],
    queryFn: () => api.get<TaskRecord>(`/task-runtime/tasks/${id}`),
    enabled: !!id,
  });
  const events = useQuery({
    queryKey: ['task-runtime', 'tasks', id, 'events'],
    queryFn: () => api.get<TaskEvent[]>(`/task-runtime/tasks/${id}/events`),
    enabled: !!id,
  });

  const cancel = useMutation({
    mutationFn: () => api.post(`/task-runtime/tasks/${id}/cancel`, { reason: 'Cancelled from Command Center' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['task-runtime', 'tasks', id] }); queryClient.invalidateQueries({ queryKey: ['task-runtime', 'tasks', id, 'events'] }); },
  });

  const t = task.data;

  return (
    <div className="mx-auto max-w-3xl p-6">
      <Link to="/tasks" className="text-sm text-(--color-text-dim) hover:text-(--color-accent)">← Tasks</Link>

      <DataBoundary isLoading={task.isLoading} error={task.error} onRetry={() => task.refetch()}>
        {t && (
          <div className="mt-2 space-y-6">
            <header className="flex items-start justify-between">
              <div>
                <h1 className="text-lg font-semibold text-(--color-text)">{t.userRequest}</h1>
                <p className="mt-1 font-mono text-xs text-(--color-text-faint)">{t.id}</p>
              </div>
              <StatusBadge status={t.status} />
            </header>

            {CANCELLABLE.has(t.status) && (
              <button
                onClick={() => cancel.mutate()}
                disabled={cancel.isPending}
                className="rounded-md border border-(--color-blocked)/40 px-3 py-1.5 text-sm text-(--color-blocked) hover:bg-(--color-blocked)/10 disabled:opacity-50"
              >
                {cancel.isPending ? 'Cancelling…' : 'Cancel task'}
              </button>
            )}
            <p className="text-xs text-(--color-text-faint)">
              No command-execution control is shown here by design — Command Center never starts or resumes work, only inspects and cancels it.
            </p>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Project" value={t.projectId ? <Link to={`/projects/${t.projectId}`} className="text-(--color-accent) hover:underline">{t.projectId}</Link> : '—'} />
              <Field label="Approval state" value={t.approvalState} />
              <Field label="Created" value={formatDateTime(t.createdAt)} />
              <Field label="Last update" value={formatDateTime(t.updatedAt)} />
              <Field label="Completed" value={t.completedAt ? formatDateTime(t.completedAt) : '—'} />
              <Field label="Parent task" value={t.parentTaskId ?? '—'} />
            </dl>

            {t.resultSummary && (
              <section>
                <h2 className="mb-1 text-sm font-semibold text-(--color-text)">Result / error summary</h2>
                <p className="rounded-md border border-(--color-border) bg-(--color-surface) p-3 text-sm text-(--color-text-dim)">{t.resultSummary}</p>
              </section>
            )}

            <section>
              <h2 className="mb-2 text-sm font-semibold text-(--color-text)">State timeline</h2>
              <DataBoundary isLoading={events.isLoading} error={events.error} isEmpty={(events.data?.length ?? 0) === 0} emptyTitle="No events recorded.">
                <ol className="space-y-2 border-l border-(--color-border) pl-4">
                  {(events.data ?? []).map((e, i) => (
                    <li key={i} className="relative text-sm">
                      <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-(--color-accent)" aria-hidden="true" />
                      <p className="text-(--color-text)">{e.type}</p>
                      <p className="text-xs text-(--color-text-faint)">{formatDateTime(e.createdAt)}</p>
                    </li>
                  ))}
                </ol>
              </DataBoundary>
            </section>
          </div>
        )}
      </DataBoundary>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-(--color-text-faint)">{label}</dt>
      <dd className="text-(--color-text)">{value}</dd>
    </div>
  );
}
