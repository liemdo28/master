import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { ProjectRecord, ProjectHealth, TaskRecord } from '@/lib/types';
import { DataBoundary } from '@/components/States';
import { StatusBadge } from '@/components/StatusBadge';

const TABS = ['Overview', 'Tasks', 'Health', 'Evidence'] as const;

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<typeof TABS[number]>('Overview');

  const project = useQuery({
    queryKey: ['projects', id],
    queryFn: () => api.get<ProjectRecord>(`/projects/${id}`),
    enabled: !!id,
  });
  const health = useQuery({
    queryKey: ['operating', 'project-health', id],
    queryFn: () => api.get<{ projectHealth: ProjectHealth[] }>(`/operating/project-health?projectId=${id}`),
    enabled: !!id,
  });
  const tasks = useQuery({
    queryKey: ['task-runtime', 'tasks', 'project', id],
    queryFn: () => api.get<TaskRecord[]>('/task-runtime/tasks'),
    enabled: !!id && tab === 'Tasks',
  });

  const h = health.data?.projectHealth[0];
  const projectTasks = (tasks.data ?? []).filter(t => t.projectId === id);

  return (
    <div className="mx-auto max-w-4xl p-6">
      <Link to="/projects" className="text-sm text-(--color-text-dim) hover:text-(--color-accent)">← Projects</Link>

      <DataBoundary isLoading={project.isLoading} error={project.error} onRetry={() => project.refetch()}>
        {project.data && (
          <div className="mt-2">
            <div className="mb-4 flex items-center gap-3">
              <h1 className="text-xl font-semibold text-(--color-text)">{project.data.displayName}</h1>
              <StatusBadge status={project.data.mapStatus} />
              {h && <StatusBadge status={h.status} />}
            </div>

            <div className="mb-4 flex gap-1 border-b border-(--color-border)">
              {TABS.map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`border-b-2 px-3 py-2 text-sm ${tab === t ? 'border-(--color-accent) text-(--color-accent)' : 'border-transparent text-(--color-text-dim) hover:text-(--color-text)'}`}
                >
                  {t}
                </button>
              ))}
            </div>

            {tab === 'Overview' && (
              <div className="space-y-3 text-sm">
                <Row label="Project id" value={project.data.id} />
                <Row label="Default branch" value={project.data.defaultBranch ?? '—'} />
                <Row label="Owner" value={project.data.owner ?? '—'} />
                <Row label="Business purpose" value={project.data.businessPurpose ?? '—'} />
                {h && (
                  <>
                    <Row label="Failed tasks" value={String(h.failedTaskCount)} />
                    <Row label="Blocked tasks" value={String(h.blockedTaskCount)} />
                    <Row label="Pending approvals" value={String(h.pendingApprovalCount)} />
                    <Row label="Stale knowledge" value={String(h.staleKnowledgeCount)} />
                    <Row label="Open conflicts" value={String(h.openConflictCount)} />
                    {h.reasons.length > 0 && (
                      <div>
                        <p className="text-xs font-medium uppercase text-(--color-text-faint)">Why this status</p>
                        <ul className="mt-1 space-y-1 text-(--color-text-dim)">{h.reasons.map((r, i) => <li key={i}>– {r}</li>)}</ul>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {tab === 'Tasks' && (
              <DataBoundary isLoading={tasks.isLoading} error={tasks.error} isEmpty={projectTasks.length === 0} emptyTitle="No tasks for this project.">
                <ul className="space-y-1.5">
                  {projectTasks.map(t => (
                    <li key={t.id}>
                      <Link to={`/tasks/${t.id}`} className="flex items-center justify-between rounded-md border border-(--color-border) px-3 py-2 text-sm hover:border-(--color-accent)">
                        <span className="truncate text-(--color-text)">{t.userRequest}</span>
                        <StatusBadge status={t.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </DataBoundary>
            )}

            {tab === 'Health' && (
              <DataBoundary isLoading={health.isLoading} error={health.error} isEmpty={!h} emptyTitle="No health data for this project.">
                {h && (
                  <pre className="overflow-x-auto rounded-md border border-(--color-border) bg-(--color-surface) p-3 text-xs text-(--color-text-dim)">
                    {JSON.stringify(h, null, 2)}
                  </pre>
                )}
              </DataBoundary>
            )}

            {tab === 'Evidence' && h && (
              <ul className="space-y-1 text-sm text-(--color-text-dim)">
                {h.evidenceReferences.map((e, i) => <li key={i} className="font-mono text-xs">{e}</li>)}
              </ul>
            )}
          </div>
        )}
      </DataBoundary>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-(--color-border)/50 py-1.5">
      <span className="text-(--color-text-faint)">{label}</span>
      <span className="text-(--color-text)">{value}</span>
    </div>
  );
}
