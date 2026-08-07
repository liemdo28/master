import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { DataBoundary } from '@/components/States';
import { StatusBadge } from '@/components/StatusBadge';

interface EngineInfo { id: string; label: string; purpose: string; status: string; repositoryScale: boolean }
interface EnginesResponse { engines: EngineInfo[]; activeEngineId: string }
interface ModelRoles { coding_fast?: string; coding_primary?: string; coding_review?: string; locality?: string; offlineReady?: boolean; [k: string]: unknown }
interface ModelHealth { endpoint: string; installedModels: string[]; residentModels: string[]; modelRoles: ModelRoles; healthy: boolean }
interface CodingTask { id: string; status: string; projectId?: string; [k: string]: unknown }

export function CodingPage() {
  const [taskId, setTaskId] = useState('');
  const [lookupId, setLookupId] = useState<string | null>(null);

  const engines = useQuery({ queryKey: ['coding', 'engines'], queryFn: () => api.get<EnginesResponse>('/coding/engines') });
  const roles = useQuery({ queryKey: ['coding', 'model-roles'], queryFn: () => api.get<{ modelRoles: ModelRoles }>('/coding/model-roles') });
  const health = useQuery({ queryKey: ['coding', 'model-health'], queryFn: () => api.get<ModelHealth>('/coding/model-health') });
  const task = useQuery({
    queryKey: ['coding', 'tasks', lookupId],
    queryFn: () => api.get<CodingTask>(`/coding/tasks/${lookupId}`),
    enabled: !!lookupId,
  });

  const engineList = engines.data?.engines ?? [];
  const roleEntries = Object.entries(roles.data?.modelRoles ?? {}).filter(([, v]) => typeof v === 'string') as Array<[string, string]>;

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 text-xl font-semibold text-(--color-text)">Coding</h1>
      <p className="mb-4 text-xs text-(--color-text-faint)">Inspect-only — no task is ever started, pushed, merged, or deployed from this screen.</p>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-(--color-text)">Engines</h2>
        <DataBoundary isLoading={engines.isLoading} error={engines.error} isEmpty={engineList.length === 0} emptyTitle="No engines reported.">
          <ul className="space-y-1.5">
            {engineList.map(e => (
              <li key={e.id} className="rounded-md border border-(--color-border) px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-(--color-text)">
                    {e.label} {e.id === engines.data?.activeEngineId && <span className="text-xs text-(--color-accent)">(active)</span>}
                  </span>
                  <StatusBadge status={e.status === 'ACTIVE' ? 'HEALTHY' : e.status === 'WRAP_LATER' ? 'NOT_CONFIGURED' : e.status} />
                </div>
                <p className="mt-1 text-xs text-(--color-text-faint)">{e.purpose}</p>
              </li>
            ))}
          </ul>
        </DataBoundary>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-(--color-text)">Model roles</h2>
        <DataBoundary isLoading={roles.isLoading} error={roles.error} isEmpty={roleEntries.length === 0} emptyTitle="No model roles configured.">
          <ul className="space-y-1 text-sm text-(--color-text-dim)">
            {roleEntries.map(([role, model]) => <li key={role}>{role}: <span className="text-(--color-text)">{model}</span></li>)}
          </ul>
        </DataBoundary>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-(--color-text)">Local model health (Ollama)</h2>
        <DataBoundary isLoading={health.isLoading} error={health.error}>
          {health.data && (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <StatusBadge status={health.data.healthy ? 'HEALTHY' : 'DOWN'} />
                <span className="text-xs text-(--color-text-faint)">{health.data.endpoint}</span>
              </div>
              <p className="text-xs text-(--color-text-faint)">Installed models</p>
              <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {health.data.installedModels.map(m => (
                  <li key={m} className="rounded-md border border-(--color-border) px-2 py-1 text-xs text-(--color-text-dim)">{m}</li>
                ))}
              </ul>
            </div>
          )}
        </DataBoundary>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-(--color-text)">Inspect a coding task</h2>
        <div className="flex gap-2">
          <input value={taskId} onChange={e => setTaskId(e.target.value)} placeholder="coding task id" className="flex-1 rounded-md border border-(--color-border) bg-(--color-surface) px-3 py-1.5 text-sm outline-none focus-visible:border-(--color-accent)" />
          <button onClick={() => setLookupId(taskId.trim() || null)} disabled={!taskId.trim()} className="rounded-md bg-(--color-accent) px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">Inspect</button>
        </div>
        {lookupId && (
          <div className="mt-3">
            <DataBoundary isLoading={task.isLoading} error={task.error}>
              {task.data && (
                <pre className="overflow-x-auto rounded-md border border-(--color-border) bg-(--color-surface) p-3 text-xs text-(--color-text-dim)">{JSON.stringify(task.data, null, 2)}</pre>
              )}
            </DataBoundary>
          </div>
        )}
      </section>
    </div>
  );
}
