import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api-client';
import type { ProjectRecord } from '@/lib/types';
import { DataBoundary } from '@/components/States';
import { StatusBadge } from '@/components/StatusBadge';

export function ProjectsPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get<{ total: number; projects: ProjectRecord[] }>('/projects'),
  });

  const projects = data?.projects ?? [];

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-4 text-xl font-semibold text-(--color-text)">Projects</h1>
      <DataBoundary isLoading={isLoading} error={error} isEmpty={projects.length === 0} emptyTitle="No projects registered." onRetry={() => refetch()}>
        <ul className="space-y-2">
          {projects.map(p => (
            <li key={p.id}>
              <Link to={`/projects/${p.id}`} className="flex items-center justify-between rounded-lg border border-(--color-border) p-3 hover:border-(--color-accent)">
                <div>
                  <p className="font-medium text-(--color-text)">{p.displayName}</p>
                  <p className="text-xs text-(--color-text-faint)">{p.id} · {p.owner ?? 'no owner set'}</p>
                </div>
                <StatusBadge status={p.mapStatus} />
              </Link>
            </li>
          ))}
        </ul>
      </DataBoundary>
    </div>
  );
}
