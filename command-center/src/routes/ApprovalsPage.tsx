import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api-client';
import type { PendingApprovalItem } from '@/lib/types';
import { DataBoundary } from '@/components/States';
import { EvidenceButton } from '@/components/EvidenceDrawer';
import { formatRelative } from '@/lib/format';

function useApprovals() {
  return useQuery({
    queryKey: ['operating', 'approvals'],
    queryFn: () => api.get<{ approvals: PendingApprovalItem[] }>('/operating/approvals'),
  });
}

const RISK_COLOR: Record<string, string> = {
  low: 'text-(--color-fact)',
  medium: 'text-(--color-attention)',
  high: 'text-(--color-blocked)',
};

export function ApprovalsPage() {
  const { data, isLoading, error, refetch } = useApprovals();
  const queryClient = useQueryClient();

  const confirmKnowledge = useMutation({
    mutationFn: (id: string) => api.post(`/knowledge/${id}/confirm`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['operating', 'approvals'] }),
  });

  const items = data?.approvals ?? [];

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-1 text-xl font-semibold text-(--color-text)">Approval Center</h1>
      <p className="mb-6 text-sm text-(--color-text-dim)">Everything currently waiting on a decision — from Task Runtime and knowledge confirmations.</p>

      <DataBoundary
        isLoading={isLoading}
        error={error}
        isEmpty={items.length === 0}
        emptyTitle="Nothing pending."
        onRetry={() => refetch()}
      >
        <ul className="space-y-2">
          {items.map(item => (
            <li key={item.id} className="rounded-lg border border-(--color-border) p-4">
              <div className="mb-2 flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-(--color-text)">{item.title}</p>
                  <p className="text-sm text-(--color-text-dim)">{item.reason}</p>
                </div>
                <span className={`shrink-0 text-xs font-medium uppercase ${RISK_COLOR[item.riskLevel] ?? ''}`}>{item.riskLevel} risk</span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-(--color-text-faint)">
                <span>{item.sourceType.replace(/_/g, ' ')}</span>
                {item.projectId && <Link to={`/projects/${item.projectId}`} className="hover:text-(--color-accent)">{item.projectId}</Link>}
                <span>requested {formatRelative(item.requestedAt)}</span>
                <EvidenceButton title={item.title} entries={item.evidenceReferences.map((e, i) => ({ label: `Evidence ${i + 1}`, value: e }))} />
              </div>

              <div className="mt-3">
                {item.sourceType === 'TASK_RUNTIME' && (
                  <div className="rounded-md border border-(--color-not-configured)/30 bg-(--color-not-configured)/5 p-3 text-xs text-(--color-text-dim)">
                    <p>
                      Read-only in this phase — Task Runtime has no safe, idempotent "approve" API yet, so Command Center will not offer an approve
                      control here (approving would need a Controlled Actions phase to define exactly what "approve" transitions and guards). {' '}
                      <Link to={`/tasks/${item.sourceId}`} className="text-(--color-accent) hover:underline">Inspect the task →</Link>
                    </p>
                  </div>
                )}
                {item.sourceType === 'KNOWLEDGE_CONFIRMATION' && (
                  <button
                    onClick={() => confirmKnowledge.mutate(item.sourceId)}
                    disabled={confirmKnowledge.isPending}
                    className="rounded-md bg-(--color-accent) px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                  >
                    Confirm knowledge record
                  </button>
                )}
                {item.sourceType === 'CONFLICT_RESOLUTION' && (
                  <Link to="/knowledge" className="text-sm text-(--color-accent) hover:underline">Resolve in Knowledge →</Link>
                )}
                {item.sourceType === 'GOAL_PLANNER' && item.goalId && (
                  <Link to={`/goals/${item.goalId}`} className="text-sm text-(--color-accent) hover:underline">Open goal →</Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      </DataBoundary>
    </div>
  );
}
