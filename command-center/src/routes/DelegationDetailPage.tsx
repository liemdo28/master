import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { queryClient } from '@/lib/queryClient';
import type { DelegatedAuthority, DelegationEvidenceEvent, DelegationDecisionRecord } from '@/lib/types';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';

export function DelegationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [approver, setApprover] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [revokeReason, setRevokeReason] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['delegation', id],
    queryFn: () => api.get<{ delegation: DelegatedAuthority; evidence: { events: DelegationEvidenceEvent[]; decisions: DelegationDecisionRecord[] } }>(`/delegations/${id}`),
    enabled: !!id,
    refetchInterval: 15_000,
  });

  const approve = useMutation({
    mutationFn: () => api.post(`/delegations/${id}/approve`, { approver, strongConfirmation: confirmText }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['delegation', id] }),
  });
  const revoke = useMutation({
    mutationFn: () => api.post(`/delegations/${id}/revoke`, { actor: approver || 'command-center-user', reason: revokeReason || 'revoked from Command Center' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['delegation', id] }),
  });
  const submit = useMutation({
    mutationFn: () => api.post(`/delegations/${id}/submit`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['delegation', id] }),
  });

  if (isLoading) return <LoadingState label="Loading delegation" />;
  if (error) return <ErrorState error={error} />;
  if (!data) return <EmptyState title="Delegation not found" />;
  const { delegation: d, evidence } = data;

  const canSubmit = d.status === 'DRAFT';
  const canApprove = d.status === 'WAITING_APPROVAL';
  const canRevoke = d.status === 'ACTIVE' || d.status === 'PAUSED' || d.status === 'PAUSED_POLICY_CHANGED';

  return (
    <section className="mx-auto max-w-4xl space-y-5 p-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-(--color-text)">{d.title} <span className="text-sm text-(--color-text-faint)">v{d.delegationVersion}</span></h1>
          <div className="mt-1"><StatusBadge status={d.status} /></div>
        </div>
        {canRevoke && (
          <button
            onClick={() => { if (confirm(`Revoke delegation "${d.title}" immediately? No new delegated execution will be authorized after this.`)) revoke.mutate(); }}
            className="rounded-md bg-(--color-down) px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            REVOKE DELEGATION
          </button>
        )}
      </header>

      <div className="rounded-md border border-(--color-approval) bg-(--color-approval)/5 p-4 text-sm text-(--color-text)">
        This is a <strong>delegation</strong>, not plan approval and not a single action approval. Approving it grants Mi
        temporary authority to perform the actions below <strong>without asking for separate approval each time</strong>,
        strictly within the limits shown. Individual Controlled Actions this delegation authorizes still appear on the{' '}
        <Link to="/actions" className="underline">Actions</Link> page for audit, but will show as executed by
        <code className="mx-1 rounded bg-black/20 px-1">delegation:{d.id.slice(0, 18)}…</code> rather than a fresh human click.
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-md border border-(--color-border) p-4 text-sm sm:grid-cols-3">
        <Field label="Project" value={d.projectId} />
        <Field label="Action types" value={d.allowedActionTypes.join(', ')} />
        <Field label="Risk ceiling" value={d.riskCeiling} />
        <Field label="Approval ceiling" value={d.approvalLevelCeiling} />
        <Field label="Window" value={`${new Date(d.startsAt).toLocaleString()} → ${new Date(d.expiresAt).toLocaleString()}`} />
        <Field label="Timezone" value={d.timezone} />
        <Field label="Executions" value={`${d.usedExecutions} / ${d.maxExecutions}`} />
        <Field label="Targets" value={d.maxTargets != null ? `${d.usedTargets} / ${d.maxTargets}` : 'no per-target cap'} />
        <Field label="Target scope" value={JSON.stringify(d.targetRestriction)} mono />
        <Field label="Policy version" value={d.policyVersion ?? '—'} />
        <Field label="Policy hash" value={d.policyHash ? d.policyHash.slice(0, 16) + '…' : '—'} mono />
        {d.pausedReason && <Field label="Paused reason" value={d.pausedReason} />}
      </div>

      {canSubmit && (
        <div className="rounded-md border border-(--color-border) p-4">
          <button onClick={() => submit.mutate()} className="rounded-md border border-(--color-border) px-4 py-2 text-sm hover:bg-(--color-surface)">
            Submit for approval (DRAFT → WAITING_APPROVAL)
          </button>
        </div>
      )}

      {canApprove && (
        <div className="space-y-3 rounded-md border border-(--color-attention) bg-(--color-attention)/5 p-4">
          <p className="text-sm font-semibold text-(--color-text)">
            You are granting Mi temporary authority to perform these actions without asking for separate approval each time, within the limits shown.
          </p>
          <p className="text-xs text-(--color-text-faint)">Mi cannot approve its own delegation — a human approver identity is required.</p>
          <label className="block text-xs text-(--color-text-faint)">
            Approver (your name)
            <input value={approver} onChange={e => setApprover(e.target.value)} className="mt-1 w-full rounded border border-(--color-border) bg-transparent px-2 py-1 text-sm" placeholder="liem" />
          </label>
          <label className="block text-xs text-(--color-text-faint)">
            Type the exact phrase to confirm — no one-click approval exists
            <input
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              className="mt-1 w-full rounded border border-(--color-border) bg-transparent px-2 py-1 text-sm font-mono"
              placeholder={`AUTHORIZE:${d.id}`}
            />
          </label>
          <button
            disabled={!approver || !confirmText.includes(`AUTHORIZE:${d.id}`) || approve.isPending}
            onClick={() => approve.mutate()}
            className="rounded-md bg-(--color-approval) px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            Strongly approve and activate
          </button>
          {approve.isError && <p className="text-xs text-(--color-down)">{String(approve.error)}</p>}
        </div>
      )}

      {canRevoke && (
        <div className="rounded-md border border-(--color-border) p-4">
          <label className="block text-xs text-(--color-text-faint)">
            Revoke reason (optional)
            <input value={revokeReason} onChange={e => setRevokeReason(e.target.value)} className="mt-1 w-full rounded border border-(--color-border) bg-transparent px-2 py-1 text-sm" />
          </label>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold uppercase text-(--color-text-faint)">Evidence</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {evidence.events.map(e => (
            <li key={e.id} className="border-t border-(--color-border) py-2">
              <span className="font-mono text-xs text-(--color-text-faint)">{new Date(e.createdAt).toLocaleString()}</span>{' '}
              <span className="font-medium">{e.eventType}</span> — {e.summary}
            </li>
          ))}
        </ul>
      </div>

      {evidence.decisions.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold uppercase text-(--color-text-faint)">Executions evaluated</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {evidence.decisions.map(dec => (
              <li key={dec.id} className="border-t border-(--color-border) py-2">
                <span className="font-mono text-xs text-(--color-text-faint)">{new Date(dec.evaluatedAt).toLocaleString()}</span>{' '}
                {dec.actionType} — <span className={dec.eligible ? 'text-(--color-healthy)' : 'text-(--color-down)'}>{dec.eligible ? 'authorized' : 'denied'}</span>
                {!dec.eligible && dec.reasons.length > 0 && <span className="text-(--color-text-faint)"> ({dec.reasons.join('; ')})</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase text-(--color-text-faint)">{label}</div>
      <div className={mono ? 'font-mono text-xs text-(--color-text)' : 'text-(--color-text)'}>{value}</div>
    </div>
  );
}
