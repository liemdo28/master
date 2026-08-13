import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type {
  DelegationOverrideScenario, FakeProviderScenario, SimulationInput, SimulationRun, SimulationStepInput,
} from '@/lib/types';
import { ErrorState } from '@/components/States';

/**
 * Phase 6F §29/§30 — Command Center simulation surface. This page can only ever
 * call POST /simulation/run, GET /simulation/:id, POST /simulation/compare — every
 * one of those mutates simulation-local, ephemeral, in-process state only (§31).
 * There is deliberately no Execute/Approve/Send/Create/Deploy button anywhere on
 * this page, and no button here may ever call a live-authority endpoint.
 */

const ACTION_TYPES = ['GMAIL_CREATE_DRAFT', 'CALENDAR_EVENT_PROPOSAL', 'CALENDAR_CREATE_EVENT', 'GMAIL_SEND_DRAFT'] as const;
const PROVIDER_SCENARIOS: FakeProviderScenario[] = ['SUCCESS', 'VALIDATION_ERROR', 'TIMEOUT', 'RATE_LIMIT', 'UNAVAILABLE', 'AMBIGUOUS_RESULT', 'PARTIAL_FAILURE'];
const DELEGATION_SCENARIOS: DelegationOverrideScenario[] = ['NONE', 'VALID', 'EXPIRED', 'REVOKED', 'QUOTA_EXHAUSTED', 'WRONG_PROJECT', 'WRONG_ACTION', 'WRONG_TARGET', 'RISK_ABOVE_CEILING', 'POLICY_CHANGED'];

interface DraftStep {
  key: string;
  actionType: (typeof ACTION_TYPES)[number];
  description: string;
  providerScenario: FakeProviderScenario;
  delegationScenario: DelegationOverrideScenario;
  killSwitch: boolean;
  budgetExhausted: boolean;
  forbiddenCandidate: boolean;
  legacyQuarantinedSurfaceId: string;
}

function newDraftStep(index: number): DraftStep {
  return {
    key: `step-${index + 1}`, actionType: 'CALENDAR_EVENT_PROPOSAL', description: `Step ${index + 1}`,
    providerScenario: 'SUCCESS', delegationScenario: 'NONE', killSwitch: false, budgetExhausted: false,
    forbiddenCandidate: false, legacyQuarantinedSurfaceId: '',
  };
}

function payloadFor(actionType: DraftStep['actionType']): Record<string, unknown> {
  if (actionType === 'GMAIL_CREATE_DRAFT' || actionType === 'GMAIL_SEND_DRAFT') {
    return { to: ['user@mi.local'], subject: 'Simulated subject', body: 'Simulated body', reason: 'Simulation from Command Center' };
  }
  return { title: 'Simulated event', start: '2026-08-13T10:00:00Z', end: '2026-08-13T10:30:00Z', timezone: 'UTC', attendees: [] };
}

function buildInput(projectId: string, steps: DraftStep[]): SimulationInput {
  const inputSteps: SimulationStepInput[] = steps.map((s, i) => ({
    key: s.key, type: 'CONTROLLED_ACTION', description: s.description,
    dependsOnKeys: i > 0 ? [steps[i - 1].key] : [],
    actionType: s.actionType, actionPayload: payloadFor(s.actionType),
    providerScenario: s.forbiddenCandidate || s.legacyQuarantinedSurfaceId ? undefined : s.providerScenario,
    delegationOverride: s.delegationScenario === 'NONE' ? undefined : { scenario: s.delegationScenario },
    killSwitchOverrides: s.killSwitch ? [{ scope: 'GLOBAL' as const, reason: 'Command Center what-if' }] : undefined,
    budgetOverrides: s.budgetExhausted ? [{ actionType: s.actionType, projectId: null, maxExecutions: 1, usedExecutions: 1, maxExternalTargets: 10, usedExternalTargets: 0 }] : undefined,
    forbiddenCandidate: s.forbiddenCandidate || undefined,
    legacyQuarantinedSurfaceId: s.legacyQuarantinedSurfaceId || undefined,
  }));
  return { kind: steps.length > 1 ? 'PROPOSED_PLAN' : 'SINGLE_PROPOSAL', projectId: projectId || null, steps: inputSteps };
}

export function SimulationPage() {
  const [projectId, setProjectId] = useState('proj-command-center');
  const [steps, setSteps] = useState<DraftStep[]>([newDraftStep(0)]);
  const [history, setHistory] = useState<SimulationRun[]>([]);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [compareResult, setCompareResult] = useState<{ runs: Array<{ simulationId: string; overallOutcome: string; inputHash: string; sideEffectCount: number; blockedCount: number }>; identicalInput: boolean; identicalOutcome: boolean } | null>(null);

  const runSimulation = useMutation({
    mutationFn: (input: SimulationInput) => api.post<SimulationRun>('/simulation/run', input),
    onSuccess: run => setHistory(prev => [run, ...prev].slice(0, 20)),
  });

  const compareRuns = useMutation({
    mutationFn: (ids: string[]) => api.post<typeof compareResult>('/simulation/compare', { ids }),
    onSuccess: result => setCompareResult(result),
  });

  const latest = runSimulation.data;

  function updateStep(index: number, patch: Partial<DraftStep>) {
    setSteps(prev => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function toggleCompareSelection(id: string) {
    setSelectedForCompare(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id].slice(-10)));
  }

  return (
    <section className="mx-auto max-w-7xl space-y-5 p-5">
      <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm font-semibold text-amber-100">
        SIMULATION — NO LIVE SIDE EFFECTS. Every result on this page answers "what WOULD happen" under the current governance rules. Nothing here sends a Gmail draft, creates a Calendar event, consumes a real budget or delegation quota, or mutates the execution ledger.
      </div>

      <header>
        <h1 className="text-2xl font-semibold text-(--color-text)">Automation Simulation</h1>
        <p className="mt-1 text-sm text-(--color-text-faint)">Rehearse a Controlled Action or short plan against the real policy/risk/kill-switch/budget/delegation rules — with zero real external side effect.</p>
      </header>

      <section className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-md border border-(--color-border) bg-(--color-surface) p-4">
          <h2 className="mb-3 text-sm font-semibold text-(--color-text)">Scenario</h2>

          <label className="mb-3 block text-xs text-(--color-text-faint)">
            Project ID
            <input value={projectId} onChange={e => setProjectId(e.target.value)} className="mt-1 w-full rounded border border-(--color-border) bg-transparent px-2 py-1 text-sm text-(--color-text)" />
          </label>

          <div className="space-y-4">
            {steps.map((step, i) => (
              <div key={step.key} className="rounded border border-(--color-border) p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-(--color-text-dim)">{step.key}{i > 0 ? ` (depends on ${steps[i - 1].key})` : ''}</span>
                  {steps.length > 1 && (
                    <button onClick={() => setSteps(prev => prev.filter((_, idx) => idx !== i))} className="text-xs text-(--color-blocked)">Remove</button>
                  )}
                </div>

                <label className="mb-2 block text-xs text-(--color-text-faint)">
                  Description
                  <input value={step.description} onChange={e => updateStep(i, { description: e.target.value })} className="mt-1 w-full rounded border border-(--color-border) bg-transparent px-2 py-1 text-sm text-(--color-text)" />
                </label>

                <label className="mb-2 block text-xs text-(--color-text-faint)">
                  Action Type
                  <select value={step.actionType} onChange={e => updateStep(i, { actionType: e.target.value as DraftStep['actionType'] })} className="mt-1 w-full rounded border border-(--color-border) bg-transparent px-2 py-1 text-sm text-(--color-text)">
                    {ACTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-xs text-(--color-text-faint)">
                    Provider Scenario
                    <select value={step.providerScenario} onChange={e => updateStep(i, { providerScenario: e.target.value as FakeProviderScenario })} className="mt-1 w-full rounded border border-(--color-border) bg-transparent px-2 py-1 text-sm text-(--color-text)">
                      {PROVIDER_SCENARIOS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                  <label className="block text-xs text-(--color-text-faint)">
                    Delegation What-If
                    <select value={step.delegationScenario} onChange={e => updateStep(i, { delegationScenario: e.target.value as DelegationOverrideScenario })} className="mt-1 w-full rounded border border-(--color-border) bg-transparent px-2 py-1 text-sm text-(--color-text)">
                      {DELEGATION_SCENARIOS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                </div>

                <div className="mt-2 flex flex-wrap gap-3 text-xs text-(--color-text-dim)">
                  <label className="flex items-center gap-1"><input type="checkbox" checked={step.killSwitch} onChange={e => updateStep(i, { killSwitch: e.target.checked })} />Kill switch (GLOBAL)</label>
                  <label className="flex items-center gap-1"><input type="checkbox" checked={step.budgetExhausted} onChange={e => updateStep(i, { budgetExhausted: e.target.checked })} />Budget exhausted</label>
                  <label className="flex items-center gap-1"><input type="checkbox" checked={step.forbiddenCandidate} onChange={e => updateStep(i, { forbiddenCandidate: e.target.checked })} />Forbidden candidate</label>
                </div>

                <label className="mt-2 block text-xs text-(--color-text-faint)">
                  Legacy quarantined surface id (optional)
                  <input value={step.legacyQuarantinedSurfaceId} onChange={e => updateStep(i, { legacyQuarantinedSurfaceId: e.target.value })} placeholder="e.g. http:POST:/api/browser/write" className="mt-1 w-full rounded border border-(--color-border) bg-transparent px-2 py-1 text-sm text-(--color-text)" />
                </label>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <button
              onClick={() => setSteps(prev => (prev.length >= 20 ? prev : [...prev, newDraftStep(prev.length)]))}
              className="rounded border border-(--color-border) px-3 py-1.5 text-sm text-(--color-text-dim)"
            >
              + Add dependent step
            </button>
            <button
              onClick={() => runSimulation.mutate(buildInput(projectId, steps))}
              disabled={runSimulation.isPending}
              className="rounded-md bg-(--color-accent) px-4 py-2 text-sm font-medium text-(--color-bg) disabled:opacity-50"
            >
              {runSimulation.isPending ? 'Simulating…' : 'Run Simulation'}
            </button>
          </div>
        </section>

        <section className="rounded-md border border-(--color-border) bg-(--color-surface) p-4">
          <h2 className="mb-3 text-sm font-semibold text-(--color-text)">Result</h2>
          {runSimulation.isError && <ErrorState error={runSimulation.error} />}
          {!latest && !runSimulation.isError && <p className="text-sm text-(--color-text-faint)">Run a scenario to see what WOULD happen.</p>}
          {latest && <SimulationResult run={latest} />}
        </section>
      </section>

      <section className="rounded-md border border-(--color-border) bg-(--color-surface) p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-(--color-text)">Recent Runs (this session)</h2>
          <button
            onClick={() => selectedForCompare.length >= 2 && compareRuns.mutate(selectedForCompare)}
            disabled={selectedForCompare.length < 2}
            className="rounded border border-(--color-border) px-3 py-1 text-xs text-(--color-text-dim) disabled:opacity-40"
          >
            Compare selected ({selectedForCompare.length})
          </button>
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-(--color-text-faint)">No simulations run yet.</p>
        ) : (
          <ul className="space-y-1 text-sm text-(--color-text-dim)">
            {history.map(run => (
              <li key={run.simulationId} className="flex items-center gap-2">
                <input type="checkbox" checked={selectedForCompare.includes(run.simulationId)} onChange={() => toggleCompareSelection(run.simulationId)} />
                <span className="font-mono text-xs">{run.simulationId}</span>
                <OutcomeBadge outcome={run.overallOutcome} />
                <span className="text-xs">{new Date(run.simulatedAt).toLocaleTimeString()}</span>
              </li>
            ))}
          </ul>
        )}
        {compareResult && (
          <div className="mt-3 rounded border border-(--color-border) p-3 text-xs text-(--color-text-dim)">
            <p>Identical input: {compareResult.identicalInput ? 'yes' : 'no'} · Identical outcome: {compareResult.identicalOutcome ? 'yes' : 'no'}</p>
            <ul className="mt-1 space-y-0.5">
              {compareResult.runs.map(r => <li key={r.simulationId} className="font-mono">{r.simulationId} — {r.overallOutcome} (sideEffects={r.sideEffectCount}, blocked={r.blockedCount})</li>)}
            </ul>
          </div>
        )}
      </section>
    </section>
  );
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const color = outcome === 'WOULD_EXECUTE' ? 'text-green-400'
    : outcome === 'WOULD_BLOCK' || outcome === 'INVALID' ? 'text-(--color-blocked)'
    : outcome === 'WOULD_REQUIRE_APPROVAL' ? 'text-(--color-approval)'
    : 'text-(--color-text-dim)';
  return <span className={`rounded border border-current px-1.5 py-0.5 text-[10px] font-semibold ${color}`}>{outcome}</span>;
}

function SimulationResult({ run }: { run: SimulationRun }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <OutcomeBadge outcome={run.overallOutcome} />
        <span className="text-xs text-(--color-text-faint)">policy {run.policyVersion ?? 'unknown'} · engine {run.engineVersion}</span>
      </div>
      <div className="grid grid-cols-4 gap-2 text-center text-xs">
        <Metric label="Approvals" value={run.approvalCount} />
        <Metric label="Side Effects" value={run.sideEffectCount} />
        <Metric label="Blocked" value={run.blockedCount} />
        <Metric label="Uncertain" value={run.uncertainCount} />
      </div>
      <ul className="space-y-2">
        {run.steps.map(step => (
          <li key={step.stepId} className="rounded border border-(--color-border) p-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-(--color-text)">{step.stepId}</span>
              <OutcomeBadge outcome={step.result} />
            </div>
            <p className="mt-1 text-xs text-(--color-text-dim)">{step.reason}</p>
            {step.actionType && (
              <p className="mt-1 text-[11px] text-(--color-text-faint)">
                {step.actionType} · risk {step.riskClass ?? '—'} · policy {step.policyDecision ?? '—'} · approval {step.approvalRequirement ?? '—'} · reversibility {step.reversibility}
              </p>
            )}
            {step.authoritySurface && <p className="text-[11px] text-(--color-text-faint)">authority: {step.authoritySurface} ({step.canonicalOwner ?? 'unknown owner'})</p>}
            {step.expectedProviderEffect && (
              <p className="text-[11px] text-(--color-text-faint)">
                expected provider effect (hypothetical): {String(step.expectedProviderEffect.responseSummary.status)}
                {step.expectedProviderEffect.simulatedObjectId ? ` — ${step.expectedProviderEffect.simulatedObjectId}` : ''}
              </p>
            )}
          </li>
        ))}
      </ul>
      {run.unknowns.length > 0 && (
        <div className="rounded border border-(--color-not-configured)/40 p-2 text-xs text-(--color-text-dim)">
          <p className="font-semibold text-(--color-text)">Unknowns</p>
          <ul className="mt-1 list-disc pl-4">{run.unknowns.map((u, i) => <li key={i}>{u}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-(--color-border) p-2">
      <div className="text-[10px] uppercase text-(--color-text-faint)">{label}</div>
      <div className="text-sm font-semibold text-(--color-text)">{value}</div>
    </div>
  );
}
