import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { queryClient } from '@/lib/queryClient';
import type { ActionDetail, ActionProposal, ActionProposalStatus } from '@/lib/types';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { StatusBadge } from '@/components/StatusBadge';

const tabs: Array<{ label: string; statuses: ActionProposalStatus[] }> = [
  { label: 'Pending Actions', statuses: ['WAITING_APPROVAL', 'APPROVED', 'EXECUTING'] },
  { label: 'Completed Actions', statuses: ['COMPLETED', 'REJECTED', 'CANCELLED'] },
  { label: 'Failed Actions', statuses: ['FAILED', 'EXPIRED', 'RECOVERY_REQUIRED'] },
];

export function ActionsPage() {
  const [tab, setTab] = useState(tabs[0]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ['actions'],
    queryFn: () => api.get<{ actions: ActionProposal[] }>('/actions'),
    refetchInterval: 30_000,
  });

  const actions = useMemo(() => (data?.actions ?? []).filter(action => tab.statuses.includes(action.status)), [data, tab]);
  const selected = selectedId ?? actions[0]?.id ?? null;

  if (isLoading) return <LoadingState label="Loading actions" />;
  if (error) return <ErrorState error={error} />;

  return (
    <section className="mx-auto flex max-w-7xl gap-4 p-5">
      <div className="w-80 shrink-0">
        <header className="mb-4">
          <h1 className="text-2xl font-semibold text-(--color-text)">Actions</h1>
          <p className="mt-1 text-sm text-(--color-text-faint)">Every external side effect requires an exact, expiring approval.</p>
        </header>
        <div className="mb-3 flex rounded-md border border-(--color-border) p-1">
          {tabs.map(item => (
            <button
              key={item.label}
              onClick={() => { setTab(item); setSelectedId(null); }}
              className={`flex-1 rounded px-2 py-1 text-xs ${item.label === tab.label ? 'bg-(--color-accent) text-white' : 'text-(--color-text-dim) hover:bg-white/5'}`}
            >
              {item.label.replace(' Actions', '')}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {actions.map(action => (
            <button
              key={action.id}
              onClick={() => setSelectedId(action.id)}
              className={`w-full rounded-md border p-3 text-left ${selected === action.id ? 'border-(--color-accent) bg-(--color-accent)/10' : 'border-(--color-border) bg-(--color-surface)'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium text-(--color-text)">{action.title}</span>
                <StatusBadge status={action.status} />
              </div>
              <div className="mt-2 text-xs text-(--color-text-faint)">{action.actionType} · {action.riskClass}</div>
            </button>
          ))}
          {!actions.length && <EmptyState title="No actions here" hint="New proposals appear here before anything can write outside the system." />}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        {selected ? <ActionDetailPanel id={selected} /> : <EmptyState title="Select an action" hint="Preview, evidence, approval, execution, and rollback details will show here." />}
      </div>
    </section>
  );
}

function ActionDetailPanel({ id }: { id: string }) {
  const [strongText, setStrongText] = useState('');
  const { data, isLoading, error } = useQuery({
    queryKey: ['action', id],
    queryFn: () => api.get<ActionDetail>(`/actions/${id}`),
  });
  const mutation = useMutation({
    mutationFn: (op: 'approve' | 'reject' | 'cancel' | 'execute') => {
      if (op === 'approve') return api.post(`/actions/${id}/approve`, {
        approver: 'command-center',
        source: 'command-center',
        riskAcknowledgement: 'Confirmed from Command Center risk preview.',
        strongConfirmation: strongText,
      });
      return api.post(`/actions/${id}/${op}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actions'] });
      queryClient.invalidateQueries({ queryKey: ['action', id] });
    },
  });

  if (isLoading) return <LoadingState label="Loading action detail" />;
  if (error) return <ErrorState error={error} />;
  if (!data) return null;

  const { proposal, approval, executions, evidence, compensations } = data;
  const decision = data.governance.latestDecision;
  const hashShort = proposal.payloadHash.slice(0, 12);
  const canApprove = proposal.status === 'WAITING_APPROVAL';
  const canExecute = proposal.status === 'APPROVED';
  const canCancel = proposal.status === 'WAITING_APPROVAL' || proposal.status === 'APPROVED';
  const isR3 = proposal.riskClass === 'R3';

  return (
    <article className="space-y-4">
      <div className="border-b border-(--color-border) pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-(--color-text)">{proposal.title}</h2>
            <p className="mt-1 text-sm text-(--color-text-dim)">{proposal.description}</p>
          </div>
          <StatusBadge status={proposal.status} />
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-3">
        <Info label="Risk" value={`${proposal.riskClass}${isR3 ? ' · external write' : ''}`} />
        <Info label="Target" value={`${proposal.targetSystem} · ${proposal.requestedOperation}`} />
        <Info label="Payload hash" value={hashShort} />
        <Info label="Expires" value={new Date(proposal.expiresAt).toLocaleString()} />
        <Info label="Project" value={proposal.projectId ?? 'none'} />
        <Info label="Rollback" value={proposal.rollbackPlan} />
        <Info label="Policy decision" value={decision ? `${decision.decision} · ${decision.requiredApprovalLevel}` : 'not evaluated'} />
        <Info label="Policy version" value={decision?.policyVersion ?? 'none'} />
        <Info label="Budget remaining" value={decision?.budgetState.remainingExecutions?.toString() ?? 'unknown'} />
      </section>

      {decision && (
        <section className="rounded-md border border-(--color-border) bg-(--color-surface) p-4">
          <h3 className="mb-2 text-sm font-semibold text-(--color-text)">Governance</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <Timeline title="Reasons" items={decision.reasons} />
            <Timeline title="Policies" items={[...decision.matchedPolicies.map(x => `matched: ${x}`), ...decision.deniedPolicies.map(x => `denied: ${x}`)]} />
          </div>
          {decision.contextualConstraints.staleReasons.length ? (
            <p className="mt-3 text-sm text-red-100">{decision.contextualConstraints.staleReasons.join(' ')}</p>
          ) : null}
        </section>
      )}

      <section className="rounded-md border border-(--color-border) bg-(--color-surface) p-4">
        <h3 className="mb-2 text-sm font-semibold text-(--color-text)">Preview</h3>
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded bg-black/20 p-3 text-sm text-(--color-text-dim)">{proposal.preview.text}</pre>
        <div className="mt-3 text-sm text-(--color-text-faint)">
          Side effects: {proposal.sideEffects.join(' ')}
        </div>
      </section>

      {isR3 && proposal.status === 'WAITING_APPROVAL' && (
        <div className="space-y-2 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100">
          <p>This approval authorizes one external side effect against the exact target and payload hash shown above.</p>
          <input
            value={strongText}
            onChange={event => setStrongText(event.target.value)}
            placeholder={`CONFIRM:${proposal.id} ${decision?.decisionHash.slice(0, 12) ?? 'decision-hash'}`}
            className="w-full rounded border border-red-400/40 bg-black/20 px-2 py-2 font-mono text-xs text-white outline-none"
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {canApprove && <button onClick={() => mutation.mutate('approve')} className="rounded-md bg-(--color-accent) px-3 py-2 text-sm font-medium text-white">APPROVE</button>}
        {canApprove && <button onClick={() => mutation.mutate('reject')} className="rounded-md border border-(--color-border) px-3 py-2 text-sm text-(--color-text)">REJECT</button>}
        {canCancel && <button onClick={() => mutation.mutate('cancel')} className="rounded-md border border-(--color-border) px-3 py-2 text-sm text-(--color-text)">CANCEL</button>}
        {canExecute && <button onClick={() => mutation.mutate('execute')} className="rounded-md border border-(--color-accent) px-3 py-2 text-sm font-medium text-(--color-accent)">EXECUTE APPROVED ACTION</button>}
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <Timeline title="Approval" items={approval ? [`${approval.decision} by ${approval.approver}`, `Target: ${approval.targetSummary}`, `Hash: ${approval.payloadHash.slice(0, 12)}`] : ['No approval recorded']} />
        <Timeline title="Execution" items={executions.length ? executions.map(execution => `${execution.status} · ${execution.providerMode} · ${execution.externalObjectId ?? execution.failureCode ?? 'no object'}`) : ['No execution recorded']} />
        <Timeline title="Evidence" items={evidence.map(item => `${item.eventType}: ${item.summary}`)} />
        <Timeline title="Compensation" items={compensations.map(item => `${item.status}: ${item.description}`)} />
      </section>
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-(--color-border) bg-(--color-surface) p-3">
      <div className="text-xs uppercase text-(--color-text-faint)">{label}</div>
      <div className="mt-1 break-words text-sm text-(--color-text)">{value}</div>
    </div>
  );
}

function Timeline({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-md border border-(--color-border) bg-(--color-surface) p-4">
      <h3 className="mb-2 text-sm font-semibold text-(--color-text)">{title}</h3>
      <ul className="space-y-2 text-sm text-(--color-text-dim)">
        {(items.length ? items : ['None']).map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}
      </ul>
    </section>
  );
}
