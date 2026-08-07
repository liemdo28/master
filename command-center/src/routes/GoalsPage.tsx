import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api-client';
import type { Goal, GoalStatus } from '@/lib/types';
import { DataBoundary } from '@/components/States';
import { StatusBadge } from '@/components/StatusBadge';

const STATUSES: GoalStatus[] = ['ACTIVE', 'PAUSED', 'BLOCKED', 'DRAFT', 'COMPLETED', 'CANCELLED'];

export function GoalsPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['goals'],
    queryFn: () => api.get<{ goals: Goal[] }>('/goals'),
  });
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<GoalStatus | 'ALL'>('ACTIVE');
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');

  const createGoal = useMutation({
    mutationFn: () => api.post('/goals', { title, description: title, category: 'general' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['goals'] }); setTitle(''); setCreating(false); },
  });

  const goals = (data?.goals ?? []).filter(g => filter === 'ALL' || g.status === filter);

  return (
    <div className="mx-auto max-w-4xl p-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-(--color-text)">Goals</h1>
        <button onClick={() => setCreating(v => !v)} className="rounded-md border border-(--color-border) px-3 py-1.5 text-sm hover:border-(--color-accent)">
          {creating ? 'Cancel' : 'New goal'}
        </button>
      </header>

      {creating && (
        <form
          onSubmit={e => { e.preventDefault(); if (title.trim()) createGoal.mutate(); }}
          className="mb-4 flex gap-2"
        >
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Goal title"
            className="flex-1 rounded-md border border-(--color-border) bg-(--color-surface) px-3 py-1.5 text-sm outline-none focus-visible:border-(--color-accent)"
          />
          <button type="submit" disabled={!title.trim() || createGoal.isPending} className="rounded-md bg-(--color-accent) px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
            Create
          </button>
        </form>
      )}

      <div className="mb-4 flex flex-wrap gap-1.5">
        {(['ALL', ...STATUSES] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full px-2.5 py-1 text-xs ${filter === s ? 'bg-(--color-accent)/20 text-(--color-accent)' : 'text-(--color-text-dim) hover:bg-white/5'}`}
          >
            {s}
          </button>
        ))}
      </div>

      <DataBoundary isLoading={isLoading} error={error} isEmpty={goals.length === 0} emptyTitle="No goals in this filter." onRetry={() => refetch()}>
        <ul className="space-y-2">
          {goals.map(g => (
            <li key={g.id}>
              <Link to={`/goals/${g.id}`} className="flex items-center justify-between rounded-lg border border-(--color-border) p-3 hover:border-(--color-accent)">
                <div>
                  <p className="font-medium text-(--color-text)">{g.title}</p>
                  <p className="text-xs text-(--color-text-faint)">{g.projectIds.join(', ') || 'no linked project'} · priority {g.priority}</p>
                </div>
                <StatusBadge status={g.status} />
              </Link>
            </li>
          ))}
        </ul>
      </DataBoundary>
    </div>
  );
}
