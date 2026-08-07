import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { api } from '@/lib/api-client';
import type { TaskRecord, TaskStatus } from '@/lib/types';
import { DataBoundary } from '@/components/States';
import { StatusBadge } from '@/components/StatusBadge';
import { formatRelative } from '@/lib/format';

const ALL: TaskStatus | 'ALL' = 'ALL';

export function TasksPage() {
  const [status, setStatus] = useState<TaskStatus | 'ALL'>(ALL);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['task-runtime', 'tasks', status],
    queryFn: () => api.get<TaskRecord[]>(`/task-runtime/tasks${status === ALL ? '' : `?status=${status}`}`),
  });

  const tasks = useMemo(() => [...(data ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [data]);
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 10,
  });

  const statuses: Array<TaskStatus | 'ALL'> = ['ALL', 'WAITING_APPROVAL', 'READY', 'RUNNING', 'BLOCKED', 'FAILED', 'COMPLETED', 'CANCELLED'];

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col p-6">
      <h1 className="mb-4 text-xl font-semibold text-(--color-text)">Tasks</h1>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {statuses.map(s => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-full px-2.5 py-1 text-xs ${status === s ? 'bg-(--color-accent)/20 text-(--color-accent)' : 'text-(--color-text-dim) hover:bg-white/5'}`}
          >
            {s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      <DataBoundary isLoading={isLoading} error={error} isEmpty={tasks.length === 0} emptyTitle="No tasks match this filter." onRetry={() => refetch()}>
        <div ref={parentRef} className="flex-1 overflow-y-auto" style={{ contain: 'strict' }}>
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map(row => {
              const t = tasks[row.index];
              return (
                <div key={t.id} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: row.size, transform: `translateY(${row.start}px)` }}>
                  <Link to={`/tasks/${t.id}`} className="mb-1.5 flex items-center justify-between rounded-md border border-(--color-border) px-3 py-2 text-sm hover:border-(--color-accent)">
                    <div className="min-w-0">
                      <p className="truncate text-(--color-text)">{t.userRequest}</p>
                      <p className="text-xs text-(--color-text-faint)">{t.projectId ?? 'no project'} · updated {formatRelative(t.updatedAt)}</p>
                    </div>
                    <StatusBadge status={t.status} />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </DataBoundary>
    </div>
  );
}
