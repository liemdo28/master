import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, ApiError } from '@/lib/api-client';
import type { JarvisResponse, JarvisSession, ProjectRecord } from '@/lib/types';
import { responseTruthStatus } from '@/lib/jarvis-workspace';
import { StatusBadge } from '@/components/StatusBadge';
import { TruthStatusBadge } from '@/components/TruthStatusBadge';
import { CategoryList } from '@/components/CategoryList';
import { ErrorState, EmptyState, LoadingState } from '@/components/States';
import { ContextIndicator } from '@/components/jarvis/ContextIndicator';
import { EvidenceInspector } from '@/components/jarvis/EvidenceInspector';
import { PlanInspector } from '@/components/jarvis/PlanInspector';
import { SimulationInspector } from '@/components/jarvis/SimulationInspector';

/**
 * Phase 7E — canonical Jarvis Operator Workspace. Talks only to the
 * canonical gateway (POST /jarvis/request, GET /jarvis/request/:id,
 * GET /jarvis/session/current); every answer here is READ, PLAN, or
 * SIMULATE — never execute. There is deliberately no Send/Execute Now/
 * Approve All/Force/Bypass/Run Shell/Deploy button anywhere on this page.
 * Any approval must go through the canonical Approvals/Actions pages via a
 * link, never inline here. Every inspector panel reuses an existing
 * canonical read API (Evidence/Orchestration/Simulation) — see
 * docs/architecture/PHASE7E_COMPONENT_AUDIT.md.
 */

type InspectorTab = 'context' | 'evidence' | 'plan' | 'simulation';

/** GET /jarvis/session/current 404s honestly when no session exists yet —
 *  that is not an error state, it's the normal "no session" empty state. */
async function fetchSessionOrNull(): Promise<JarvisSession | null> {
  try {
    return await api.get<JarvisSession>('/jarvis/session/current');
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

function ConversationHistory({
  session,
  selectedRequestId,
  onSelect,
}: {
  session: JarvisSession | null | undefined;
  selectedRequestId: string | null;
  onSelect: (requestId: string) => void;
}) {
  const turns = session?.turns ?? [];
  return (
    <aside aria-label="Conversation history" className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-(--color-text-faint)">History</h2>
      {turns.length === 0 && (
        <p className="text-xs text-(--color-text-faint)">No turns in this session yet.</p>
      )}
      <ul className="space-y-1">
        {turns.slice().reverse().map(turn => (
          <li key={turn.turnId}>
            <button
              type="button"
              onClick={() => onSelect(turn.requestId)}
              aria-current={selectedRequestId === turn.requestId ? 'true' : undefined}
              className={`w-full rounded-md border p-2 text-left text-xs ${
                selectedRequestId === turn.requestId
                  ? 'border-(--color-accent) bg-(--color-accent)/5'
                  : 'border-(--color-border) hover:border-(--color-accent)/40'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="truncate text-(--color-text-dim)">{turn.text}</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <StatusBadge status={turn.status} />
                <span className="text-(--color-text-faint)">{turn.intent.replace(/_/g, ' ').toLowerCase()}</span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function ResponseDetail({ requestText, response }: { requestText: string; response: JarvisResponse }) {
  const r = response;
  const truth = responseTruthStatus(r);
  return (
    <div className="space-y-3 rounded-md border border-(--color-border) p-4">
      <p className="text-sm font-medium text-(--color-text)">{requestText}</p>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={r.status} />
        {truth && <TruthStatusBadge status={truth} />}
        <span className="text-xs text-(--color-text-faint)">{r.intent.replace(/_/g, ' ').toLowerCase()}</span>
        {r.projectId && <span className="text-xs text-(--color-text-faint)">project: {r.projectId}</span>}
      </div>
      <p className="whitespace-pre-wrap text-sm text-(--color-text-dim)">{r.answer}</p>

      <CategoryList kind="fact" title="Observed (facts)" items={r.facts.map(f => f.statement)} />
      <CategoryList kind="suggestion" title="Inferred" items={r.inferences.map(f => f.statement)} />
      <CategoryList kind="unknown" title="Unknown" items={r.unknowns} />
      {r.conflicts.length > 0 && <CategoryList kind="unknown" title="Conflicts" items={r.conflicts} />}

      {r.citations.length > 0 && (
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-(--color-text-faint)">Citations</h3>
          <ul className="space-y-0.5 text-xs text-(--color-text-faint)">
            {r.citations.map((c, i) => (
              <li key={i}>{c.title || c.sourceUri}{c.lineStart ? ` (line ${c.lineStart}${c.lineEnd && c.lineEnd !== c.lineStart ? `-${c.lineEnd}` : ''})` : ''}</li>
            ))}
          </ul>
        </div>
      )}

      {r.degradedCapabilities.length > 0 && (
        <p className="text-xs text-(--color-attention)">Degraded: {r.degradedCapabilities.join(', ')}</p>
      )}

      <CategoryList kind="suggestion" title="Suggested next steps" items={r.suggestedNextSteps} />

      {r.status === 'WAITING_APPROVAL' && (
        <p className="text-xs text-(--color-approval)">
          Waiting on approval — go to <Link to="/actions" className="underline">Actions</Link> to decide. This page cannot approve anything.
        </p>
      )}
    </div>
  );
}

function InspectorPanel({
  selected,
  tab,
  onTab,
  requestedProjectId,
  session,
  projects,
}: {
  selected: JarvisResponse | null;
  tab: InspectorTab;
  onTab: (t: InspectorTab) => void;
  requestedProjectId: string | null;
  session: JarvisSession | null | undefined;
  projects: ProjectRecord[];
}) {
  const availableTabs: InspectorTab[] = ['context', 'evidence'];
  const planId = selected?.evidenceRefs.find(r => r.startsWith('plan:'))?.slice('plan:'.length) ?? null;
  if (selected?.proposal || planId) availableTabs.push('plan');
  if (selected?.simulation) availableTabs.push('simulation');

  return (
    <aside aria-label="Inspector" className="space-y-3">
      <div role="tablist" aria-label="Inspector tabs" className="flex gap-1 border-b border-(--color-border)">
        {availableTabs.map(t => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => onTab(t)}
            className={`px-2 py-1.5 text-xs font-medium capitalize ${
              tab === t ? 'border-b-2 border-(--color-accent) text-(--color-accent)' : 'text-(--color-text-faint)'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'context' && (
        <ContextIndicator latest={selected} requestedProjectId={requestedProjectId} session={session ?? null} projects={projects} />
      )}

      {tab === 'evidence' && !selected && <EmptyState title="No exchange selected" hint="Ask Jarvis something, or pick a past turn from History." />}
      {tab === 'evidence' && selected && <EvidenceInspector evidenceRefs={selected.evidenceRefs} />}

      {tab === 'plan' && selected?.proposal && (
        <p className="text-xs text-(--color-text-faint)">
          A proposal-ready action exists — open <Link to="/actions" className="text-(--color-accent) underline">Actions</Link> to inspect it in full; nothing here can approve or execute it.
        </p>
      )}
      {tab === 'plan' && !selected?.proposal && planId && <PlanInspector planId={planId} />}

      {tab === 'simulation' && selected?.simulation && <SimulationInspector simulationId={selected.simulation.simulationId} />}
    </aside>
  );
}

export function JarvisPage() {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [projectId, setProjectId] = useState('');
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [selectedRequestText, setSelectedRequestText] = useState<string>('');
  const [tab, setTab] = useState<InspectorTab>('context');
  /** Client-side cache so a just-asked response never needs a refetch —
   *  GET /jarvis/request/:id is used only for turns selected from history. */
  const [responseCache, setResponseCache] = useState<Map<string, JarvisResponse>>(new Map());

  const projects = useQuery({ queryKey: ['projects'], queryFn: () => api.get<{ total: number; projects: ProjectRecord[] }>('/projects') });
  const session = useQuery({ queryKey: ['jarvis-session'], queryFn: fetchSessionOrNull });

  const selectedDetail = useQuery({
    queryKey: ['jarvis-request', selectedRequestId],
    queryFn: () => api.get<JarvisResponse>(`/jarvis/request/${selectedRequestId}`),
    enabled: Boolean(selectedRequestId) && !responseCache.has(selectedRequestId ?? ''),
  });

  const ask = useMutation({
    mutationFn: (input: { text: string; projectId: string | null }) => api.post<JarvisResponse>('/jarvis/request', input),
    onSuccess: (response, variables) => {
      setResponseCache(prev => new Map(prev).set(response.requestId, response));
      setSelectedRequestId(response.requestId);
      setSelectedRequestText(variables.text);
      setText('');
      queryClient.invalidateQueries({ queryKey: ['jarvis-session'] });
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    ask.mutate({ text: text.trim(), projectId: projectId || null });
  }

  function selectTurn(requestId: string) {
    setSelectedRequestId(requestId);
    const turn = session.data?.turns.find(t => t.requestId === requestId);
    setSelectedRequestText(turn?.text ?? '');
    setTab('context');
  }

  const selected = selectedRequestId
    ? responseCache.get(selectedRequestId) ?? (selectedDetail.data ?? null)
    : null;
  const requestedProjectId = projectId || null;

  return (
    <div className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-[220px_1fr_280px]">
      <div className="lg:col-span-3">
        <h1 className="mb-1 text-xl font-semibold text-(--color-text)">Jarvis</h1>
        <p className="mb-4 text-xs text-(--color-text-faint)">
          Read, plan, or simulate — never executes. Every answer routes through the canonical Personal OS, Knowledge,
          Orchestration, Simulation, and Controlled Actions systems; nothing here bypasses approval or governance.
        </p>
      </div>

      <ConversationHistory session={session.data} selectedRequestId={selectedRequestId} onSelect={selectTurn} />

      {/* Layout.tsx already wraps every route in its own <main> — nesting a
          second <main> here would be invalid HTML and confuse screen
          readers. A labelled <section> is the correct landmark for a
          sub-region within the page's single main content area. */}
      <section aria-label="Current interaction" className="space-y-4">
        <form onSubmit={submit} className="space-y-2">
          <label htmlFor="jarvis-text" className="sr-only">Ask Jarvis</label>
          <textarea
            id="jarvis-text"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => {
              // Enter submits (matches every other CC form), but never as a
              // destructive/irreversible action — submitting only ever asks
              // a read/plan/simulate question, never executes anything.
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(e); }
            }}
            placeholder="Ask about health, tasks, projects, goals, knowledge, planning, or a proposal…"
            rows={2}
            className="w-full rounded-md border border-(--color-border) bg-(--color-surface) p-2 text-sm text-(--color-text) placeholder:text-(--color-text-faint)"
          />
          <div className="flex items-center gap-2">
            <label htmlFor="jarvis-project" className="sr-only">Project</label>
            <select
              id="jarvis-project"
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

        {!selected && selectedRequestId && selectedDetail.isLoading && <LoadingState label="Loading past turn…" />}
        {!selected && selectedRequestId && selectedDetail.isError && (
          <EmptyState
            title="This turn's full detail has expired"
            hint="The request/response cache is bounded to 30 minutes — the session's own turn summary above is all that remains."
          />
        )}
        {!selected && !selectedRequestId && (
          <EmptyState title="No questions asked yet" hint="Ask Jarvis something above, or pick a past turn from History." />
        )}
        {selected && <ResponseDetail requestText={selectedRequestText} response={selected} />}
      </section>

      <InspectorPanel
        selected={selected}
        tab={tab}
        onTab={setTab}
        requestedProjectId={requestedProjectId}
        session={session.data}
        projects={projects.data?.projects ?? []}
      />
    </div>
  );
}
