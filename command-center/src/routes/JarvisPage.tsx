import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api-client';
import type { JarvisResponse, ProjectRecord } from '@/lib/types';
import { StatusBadge } from '@/components/StatusBadge';
import { ErrorState } from '@/components/States';

/**
 * Phase 7C — canonical Jarvis conversation page. Talks only to the
 * canonical gateway (POST /jarvis/request); every answer here is READ, PLAN,
 * or SIMULATE — never execute. There is deliberately no Send/Execute Now/
 * Approve All/Force/Bypass/Run Shell/Deploy button anywhere on this page
 * (directive §29). Any approval must go through the canonical Approvals/
 * Actions pages via a link, never inline here.
 */

interface Exchange {
  requestText: string;
  response: JarvisResponse;
}

function TruthList({ title, items }: { title: string; items: { statement: string }[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-2">
      <div className="text-xs font-medium text-(--color-text-faint)">{title}</div>
      <ul className="mt-1 list-inside list-disc text-sm text-(--color-text-dim)">
        {items.map((f, i) => <li key={i}>{f.statement}</li>)}
      </ul>
    </div>
  );
}

function StringList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-2">
      <div className="text-xs font-medium text-(--color-text-faint)">{title}</div>
      <ul className="mt-1 list-inside list-disc text-sm text-(--color-text-dim)">
        {items.map((s, i) => <li key={i}>{s}</li>)}
      </ul>
    </div>
  );
}

function ExchangeCard({ exchange }: { exchange: Exchange }) {
  const r = exchange.response;
  return (
    <li className="rounded-md border border-(--color-border) p-4">
      <p className="text-sm font-medium text-(--color-text)">{exchange.requestText}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <StatusBadge status={r.status} />
        <span className="text-xs text-(--color-text-faint)">{r.intent.replace(/_/g, ' ').toLowerCase()}</span>
        {r.projectId && <span className="text-xs text-(--color-text-faint)">project: {r.projectId}</span>}
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-(--color-text-dim)">{r.answer}</p>

      <TruthList title="Facts" items={r.facts} />
      <TruthList title="Inferences" items={r.inferences} />
      <StringList title="Unknown" items={r.unknowns} />
      <StringList title="Conflicts" items={r.conflicts} />

      {r.citations.length > 0 && (
        <div className="mt-2">
          <div className="text-xs font-medium text-(--color-text-faint)">Citations</div>
          <ul className="mt-1 space-y-0.5 text-xs text-(--color-text-faint)">
            {r.citations.map((c, i) => (
              <li key={i}>{c.title || c.sourceUri}{c.lineStart ? ` (line ${c.lineStart}${c.lineEnd && c.lineEnd !== c.lineStart ? `-${c.lineEnd}` : ''})` : ''}</li>
            ))}
          </ul>
        </div>
      )}

      {r.simulation && (
        <div className="mt-2 rounded border border-(--color-suggestion)/30 bg-(--color-suggestion)/5 p-2 text-xs text-(--color-text-dim)">
          Simulation {r.simulation.simulationId}: {r.simulation.overallOutcome}. This never executed anything —{' '}
          <Link to="/simulation" className="underline">open Simulation</Link> for a fully structured what-if.
        </div>
      )}

      {r.proposal && (
        <div className="mt-2 rounded border border-(--color-accent)/30 bg-(--color-accent)/5 p-2 text-xs text-(--color-text-dim)">
          Proposal-ready: {r.proposal.actionType} ({r.proposal.riskClass}). To review, approve, or reject,{' '}
          <Link to="/actions" className="underline">open Actions</Link> — nothing here can approve or execute it.
        </div>
      )}

      {r.healthImpact && r.healthImpact.degradedDependencies.length > 0 && (
        <div className="mt-2 text-xs text-(--color-attention)">
          Degraded: {r.healthImpact.degradedDependencies.join(', ')}.{' '}
          <Link to="/health" className="underline">open Health</Link>
        </div>
      )}

      <StringList title="Suggested next steps" items={r.suggestedNextSteps} />

      {r.status === 'WAITING_APPROVAL' && (
        <p className="mt-2 text-xs text-(--color-approval)">
          Waiting on approval — go to <Link to="/approvals" className="underline">Approvals</Link> to decide. This page cannot approve anything.
        </p>
      )}
    </li>
  );
}

export function JarvisPage() {
  const [text, setText] = useState('');
  const [projectId, setProjectId] = useState('');
  const [exchanges, setExchanges] = useState<Exchange[]>([]);

  const projects = useQuery({ queryKey: ['projects'], queryFn: () => api.get<{ total: number; projects: ProjectRecord[] }>('/projects') });

  const ask = useMutation({
    mutationFn: (input: { text: string; projectId: string | null }) => api.post<JarvisResponse>('/jarvis/request', input),
    onSuccess: (response, variables) => {
      setExchanges(prev => [{ requestText: variables.text, response }, ...prev].slice(0, 50));
      setText('');
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    ask.mutate({ text: text.trim(), projectId: projectId || null });
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 text-xl font-semibold text-(--color-text)">Jarvis</h1>
      <p className="mb-6 text-xs text-(--color-text-faint)">
        Read, plan, or simulate — never executes. Every answer routes through the canonical Personal OS, Knowledge,
        Orchestration, Simulation, and Controlled Actions systems; nothing here bypasses approval or governance.
      </p>

      <form onSubmit={submit} className="mb-6 space-y-2">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Ask about health, tasks, projects, goals, knowledge, planning, or a proposal…"
          rows={2}
          className="w-full rounded-md border border-(--color-border) bg-(--color-surface) p-2 text-sm text-(--color-text) placeholder:text-(--color-text-faint)"
        />
        <div className="flex items-center gap-2">
          <select
            value={projectId}
            onChange={e => setProjectId(e.target.value)}
            className="rounded-md border border-(--color-border) bg-(--color-surface) px-2 py-1 text-xs text-(--color-text-dim)"
          >
            <option value="">No specific project</option>
            {(projects.data?.projects ?? []).map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}
          </select>
          <button
            type="submit"
            disabled={ask.isPending || !text.trim()}
            className="rounded-md bg-(--color-accent) px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {ask.isPending ? 'Asking…' : 'Ask'}
          </button>
        </div>
      </form>

      {ask.isError && <ErrorState error={ask.error} />}

      {exchanges.length === 0 && !ask.isPending && (
        <p className="text-sm text-(--color-text-faint)">No questions asked yet this session.</p>
      )}

      <ul className="space-y-3">
        {exchanges.map((exchange, i) => <ExchangeCard key={i} exchange={exchange} />)}
      </ul>
    </div>
  );
}
