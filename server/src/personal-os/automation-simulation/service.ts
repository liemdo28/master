/**
 * Phase 6F — AutomationSimulationService. The one canonical simulator (§3): it never
 * calls `ControlledActionService.propose/approve/execute`, never imports a real
 * provider writer, and never mutates the production database. Policy and risk
 * evaluation reuse the real `ActionPolicyEngine`/`RiskEvaluator` unmodified, run
 * against a per-run ephemeral store (fs.mkdtempSync, deleted when the run finishes) —
 * the same isolation pattern this codebase's own test suite already uses everywhere.
 * See docs/architecture/PHASE6F_COMPONENT_AUDIT.md for the reuse-vs-fork reasoning.
 */
import { randomUUID, createHash } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ControlledActionService } from '../actions/service';
import { payloadHash as canonicalPayloadHash, riskForAction, textPreview } from '../actions/policy';
import type { ActionProposal, ActionRiskClass, ActionType } from '../actions/types';
import { evaluateDelegationEligibility, type EligibilityContext, type EligibilityResult } from '../delegation/eligibility';
import type { DelegatedAuthority } from '../delegation/types';
import { validateDag, dependencyBlockState, type DagNode } from '../orchestration/dag';
import { generateAuthorityManifest } from '../../authority-control-plane/scanner';
import { resolveAuthorityRepoRoot } from '../../authority-control-plane/source-provenance';
import { mintSimulationCapabilityToken, reversibilityFor, runFakeProvider } from './fake-providers';
import {
  SIMULATION_ENGINE_VERSION,
  type BudgetOverride, type KillSwitchOverride, type SimulationInput, type SimulationOutcome,
  type SimulationRun, type SimulationStepInput, type SimulationStepResult,
} from './types';

const EXECUTE_SURFACE_ID = 'http:POST:/api/actions/:id/execute';
const QUARANTINED_SURFACE_PREFIX_ALLOWLIST = new Set(['LEGACY_QUARANTINED']);

function now(): string { return new Date().toISOString(); }

function stableStringify(value: unknown): string {
  return JSON.stringify(value, sortReplacer);
}
function sortReplacer(_key: string, value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.keys(value as object).sort().reduce((out, k) => { (out as any)[k] = (value as any)[k]; return out; }, {});
  }
  return value;
}

export class AutomationSimulationService {
  /** Builds a fresh ephemeral governance store for exactly one simulation run — no
   *  `:memory:` (this codebase's own tests never use it; a temp file matches the
   *  established convention exactly), deleted unconditionally when the run ends. */
  private openEphemeralGovernance(): { service: ControlledActionService; root: string } {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-6f-sim-'));
    // ControlledActionService's constructor bootstraps the full Phase 5F+5G schema and
    // seeds the default policy set/budgets (server/src/personal-os/actions/store.ts,
    // governance/schema.ts) — the same default policy version production has run
    // unchanged since Phase 5G (policyVersion "phase5g-default-v1", confirmed in every
    // acceptance report this program has produced). We only ever read `.policyEngine`
    // from it — `.propose()/.approve()/.execute()/.reject()/.cancel()` are never called.
    const service = new ControlledActionService(root);
    return { service, root };
  }

  async run(input: SimulationInput): Promise<SimulationRun> {
    const inputHash = createHash('sha256').update(stableStringify(input)).digest('hex');
    const simulationId = `sim-${randomUUID()}`;
    const createdAt = now();
    const { service, root } = this.openEphemeralGovernance();
    const token = mintSimulationCapabilityToken();
    try {
      const policySet = service.policyEngine.store.activePolicySet();
      const steps: SimulationStepResult[] = [];
      const dagNodes: DagNode[] = input.steps.map(s => ({ key: s.key, dependsOnKeys: s.dependsOnKeys ?? [] }));
      const dag = validateDag(dagNodes);

      if (!dag.valid) {
        const invalidReason = dag.unknownDependencyKeys.length
          ? `unknown dependency key(s): ${dag.unknownDependencyKeys.join(', ')}`
          : `dependency cycle detected among: ${dag.cycleKeys.join(', ')}`;
        for (const s of input.steps) {
          steps.push(this.invalidStep(s, invalidReason));
        }
        return this.finish(simulationId, inputHash, createdAt, input, steps, policySet);
      }

      const statusByKey = new Map<string, ActionPlanLikeStatus>();
      for (const key of dag.order) {
        const stepInput = input.steps.find(s => s.key === key)!;
        const depStatuses = (stepInput.dependsOnKeys ?? []).map(k => statusByKey.get(k) ?? 'PENDING');
        const block = dependencyBlockState(depStatuses);
        let result: SimulationStepResult;
        if (block === 'BLOCKED_FAILED' || block === 'BLOCKED_CANCELLED') {
          result = this.blockedByDependencyStep(stepInput, block);
        } else if (block === 'WAITING') {
          result = this.waitingStep(stepInput);
        } else {
          result = await this.simulateStep(stepInput, service, token, input.projectId);
        }
        steps.push(result);
        statusByKey.set(key, outcomeToStepStatus(result.result));
      }

      return this.finish(simulationId, inputHash, createdAt, input, steps, policySet);
    } finally {
      service.close();
      fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  }

  private finish(
    simulationId: string, inputHash: string, createdAt: string, input: SimulationInput,
    steps: SimulationStepResult[], policySet: { version: string; contentHash: string } | null,
  ): SimulationRun {
    const approvalCount = steps.filter(s => s.approvalRequirement && s.approvalRequirement !== 'NONE').length;
    const sideEffectCount = steps.filter(s => s.result === 'WOULD_EXECUTE' && s.type === 'CONTROLLED_ACTION').length;
    const blockedCount = steps.filter(s => s.result === 'WOULD_BLOCK').length;
    const uncertainCount = steps.filter(s => s.result === 'UNCERTAIN').length;
    const evidenceRefs = [...new Set(steps.flatMap(s => s.evidenceRefs))];
    const overallOutcome = overallOutcomeOf(steps);
    return {
      simulationId, inputHash, engineVersion: SIMULATION_ENGINE_VERSION, createdAt,
      simulatedAt: now(), projectId: input.projectId,
      policyVersion: policySet?.version ?? null, policyHash: policySet?.contentHash ?? null,
      overallOutcome, steps, approvalCount, sideEffectCount, blockedCount, uncertainCount,
      evidenceRefs,
      assumptions: ['Policy set is the currently seeded default (phase5g-default-v1) unless a policy what-if override was supplied.'],
      facts: [],
      unknowns: steps.filter(s => s.result === 'UNCERTAIN').map(s => `step ${s.stepId}: ${s.reason}`),
      warnings: [],
    };
  }

  private invalidStep(input: SimulationStepInput, reason: string): SimulationStepResult {
    return {
      stepId: input.key, type: input.type, dependencies: input.dependsOnKeys ?? [],
      authoritySurface: null, canonicalOwner: null, actionType: input.actionType ?? null,
      targetSummary: input.description, riskClass: null, policyDecision: null, approvalRequirement: null,
      delegationDecision: null, budgetDecision: null, killSwitchDecision: null, expectedProviderEffect: null,
      result: 'INVALID', reason, evidenceRefs: [], reversibility: 'UNKNOWN',
    };
  }

  private waitingStep(input: SimulationStepInput): SimulationStepResult {
    return {
      stepId: input.key, type: input.type, dependencies: input.dependsOnKeys ?? [],
      authoritySurface: null, canonicalOwner: null, actionType: input.actionType ?? null,
      targetSummary: input.description, riskClass: null, policyDecision: null, approvalRequirement: null,
      delegationDecision: null, budgetDecision: null, killSwitchDecision: null, expectedProviderEffect: null,
      result: 'SIMULATED', reason: 'Dependencies have not completed in this simulation — step WOULD remain PENDING/WAITING.', evidenceRefs: [], reversibility: 'UNKNOWN',
    };
  }

  private blockedByDependencyStep(input: SimulationStepInput, block: 'BLOCKED_FAILED' | 'BLOCKED_CANCELLED'): SimulationStepResult {
    return {
      stepId: input.key, type: input.type, dependencies: input.dependsOnKeys ?? [],
      authoritySurface: null, canonicalOwner: null, actionType: input.actionType ?? null,
      targetSummary: input.description, riskClass: null, policyDecision: null, approvalRequirement: null,
      delegationDecision: null, budgetDecision: null, killSwitchDecision: null, expectedProviderEffect: null,
      result: 'WOULD_BLOCK',
      reason: block === 'BLOCKED_FAILED' ? 'A dependency WOULD fail, permanently blocking this step.' : 'A dependency WOULD be cancelled, permanently blocking this step.',
      evidenceRefs: [], reversibility: 'UNKNOWN',
    };
  }

  private async simulateStep(
    input: SimulationStepInput, service: ControlledActionService, token: ReturnType<typeof mintSimulationCapabilityToken>, defaultProjectId: string | null,
  ): Promise<SimulationStepResult> {
    if (input.type !== 'CONTROLLED_ACTION') {
      return {
        stepId: input.key, type: input.type, dependencies: input.dependsOnKeys ?? [],
        authoritySurface: null, canonicalOwner: null, actionType: null, targetSummary: input.description,
        riskClass: null, policyDecision: null, approvalRequirement: null, delegationDecision: null,
        budgetDecision: null, killSwitchDecision: null, expectedProviderEffect: null,
        result: 'WOULD_EXECUTE', reason: `${input.type} step has no external side effect.`, evidenceRefs: [], reversibility: 'REVERSIBLE',
      };
    }

    // §23 — forbidden capability what-if: never becomes a canonical proposal, never
    // reaches policy/risk/provider evaluation at all.
    if (input.forbiddenCandidate) {
      return {
        stepId: input.key, type: input.type, dependencies: input.dependsOnKeys ?? [],
        authoritySurface: null, canonicalOwner: null, actionType: input.actionType ?? null,
        targetSummary: input.description, riskClass: null, policyDecision: null, approvalRequirement: null,
        delegationDecision: null, budgetDecision: null, killSwitchDecision: null, expectedProviderEffect: null,
        result: 'WOULD_BLOCK', reason: 'FORBIDDEN_CAPABILITY: this candidate is not an eligible Controlled Action type.', evidenceRefs: [], reversibility: 'UNKNOWN',
      };
    }

    // §24 — legacy quarantine what-if.
    if (input.legacyQuarantinedSurfaceId) {
      return {
        stepId: input.key, type: input.type, dependencies: input.dependsOnKeys ?? [],
        authoritySurface: input.legacyQuarantinedSurfaceId, canonicalOwner: null, actionType: input.actionType ?? null,
        targetSummary: input.description, riskClass: null, policyDecision: null, approvalRequirement: null,
        delegationDecision: null, budgetDecision: null, killSwitchDecision: null, expectedProviderEffect: null,
        result: 'WOULD_BLOCK', reason: 'LEGACY_QUARANTINED: this surface is quarantined by the Phase 6B authority boundary.', evidenceRefs: [], reversibility: 'UNKNOWN',
      };
    }

    if (!input.actionType) {
      return this.invalidStep(input, 'CONTROLLED_ACTION step requires actionType.');
    }

    // §25 — authority lookup against the real, current manifest (read-only); a step
    // whose actionType has no known execute surface fails safely rather than
    // inventing one.
    const repoRoot = resolveAuthorityRepoRoot(path.resolve(__dirname, '../../..'));
    const manifest = generateAuthorityManifest(repoRoot);
    const executeSurface = manifest.surfaces.find(s => s.id === EXECUTE_SURFACE_ID);
    if (!executeSurface) {
      return this.invalidStep(input, 'UNKNOWN_MUTATION: no canonical authority surface found for Controlled Action execution — refusing to simulate an unregistered surface.');
    }

    let proposal: ActionProposal;
    try {
      proposal = this.buildFakeProposal(input, defaultProjectId);
    } catch (err) {
      return this.invalidStep(input, `Invalid simulated payload: ${err instanceof Error ? err.message : String(err)}`);
    }

    this.applyKillSwitchOverrides(service, input.killSwitchOverrides);
    this.applyBudgetOverrides(service, input.budgetOverrides);

    const risk = service.policyEngine.riskEvaluator.assess(proposal);
    const decision = service.policyEngine.evaluate({ proposal, stage: 'simulation', actor: 'automation-simulation' });

    let delegationDecision: EligibilityResult | null = null;
    if (input.delegationOverride) {
      delegationDecision = this.evaluateDelegationWhatIf(input.delegationOverride, proposal, decision.decision);
    }

    const evidenceRefs = [`GOVERNANCE:${decision.id}`];
    let expectedProviderEffect = null;
    let result: SimulationOutcome;
    let reason: string;

    const delegationAutoProceed = !!(delegationDecision && delegationDecision.eligible);

    if (decision.decision === 'BLOCK_KILL_SWITCH') {
      result = 'WOULD_BLOCK'; reason = 'Kill switch WOULD block this action.';
    } else if (decision.decision === 'BLOCK_BUDGET') {
      result = 'WOULD_BLOCK'; reason = decision.budgetState.reason ?? 'Budget WOULD block this action.';
    } else if (decision.decision === 'BLOCK_CONTEXT') {
      result = 'WOULD_BLOCK'; reason = decision.contextualConstraints.staleReasons.join('; ') || 'Context WOULD block this action.';
    } else if (decision.decision === 'DENY') {
      result = 'WOULD_BLOCK'; reason = 'Policy WOULD deny this action.';
    } else if (delegationDecision && !delegationDecision.eligible) {
      result = 'WOULD_BLOCK'; reason = `Delegation WOULD deny this action: ${delegationDecision.reasons.join('; ')}`;
    } else {
      // Not blocked/denied — safe to compute the fake provider's hypothetical outcome
      // (§16: report it alongside the approval requirement, never gated behind
      // "approved" since nothing here ever grants a real approval). Never a real
      // dispatch regardless of which branch below is taken.
      const scenario = input.providerScenario ?? 'SUCCESS';
      const fake = runFakeProvider(token, input.actionType, proposal.payloadHash, scenario);
      expectedProviderEffect = fake;
      evidenceRefs.push(`SIMULATION:${proposal.id}`);

      const needsApproval = (decision.decision === 'REQUIRE_APPROVAL' || decision.decision === 'REQUIRE_STRONG_APPROVAL') && !delegationAutoProceed;
      if (needsApproval) {
        result = 'WOULD_REQUIRE_APPROVAL';
        reason = `Policy WOULD require ${decision.requiredApprovalLevel} approval before this action could proceed. If approved, the provider WOULD then respond: ${fake.responseSummary.status}`;
      } else if (fake.reconciliationRequired) {
        result = 'UNCERTAIN'; reason = String(fake.responseSummary.status);
      } else if (fake.simulatedObjectId) {
        result = 'WOULD_EXECUTE'; reason = String(fake.responseSummary.status);
      } else {
        result = 'WOULD_FAIL'; reason = String(fake.responseSummary.status);
      }
    }

    // §20 concurrency what-if: a second identical candidate competing for the same
    // budget/idempotency slot WOULD be blocked once the first consumes it, even
    // though neither one actually did (no real reservation is ever made).
    if ((input.concurrentCandidateCount ?? 1) > 1 && result === 'WOULD_EXECUTE' && decision.budgetState.remainingExecutions !== null && decision.budgetState.remainingExecutions < (input.concurrentCandidateCount ?? 1)) {
      result = 'UNCERTAIN';
      reason = `${reason} — with ${input.concurrentCandidateCount} concurrent candidates and only ${decision.budgetState.remainingExecutions} remaining budget slot(s), the canonical budget/idempotency evaluator would resolve this deterministically per-request, not simulated per-pair here.`;
    }

    return {
      stepId: input.key, type: input.type, dependencies: input.dependsOnKeys ?? [],
      authoritySurface: executeSurface.id, canonicalOwner: executeSurface.canonicalOwner,
      actionType: input.actionType, targetSummary: proposal.title,
      riskClass: risk.riskClass, policyDecision: decision.decision, approvalRequirement: decision.requiredApprovalLevel,
      delegationDecision, budgetDecision: decision.budgetState, killSwitchDecision: decision.killSwitchState,
      expectedProviderEffect, result, reason, evidenceRefs, reversibility: reversibilityFor(input.actionType),
    };
  }

  private buildFakeProposal(input: SimulationStepInput, defaultProjectId: string | null): ActionProposal {
    if (!input.actionType) throw new Error('actionType is required');
    const payload = input.actionPayload ?? {};
    const riskClass: ActionRiskClass = riskForAction(input.actionType);
    const hash = canonicalPayloadHash(payload);
    const createdAt = now();
    return {
      id: `sim-proposal-${randomUUID()}`,
      actionType: input.actionType,
      riskClass,
      title: `[SIMULATED] ${input.description}`,
      description: input.description,
      reason: 'Phase 6F simulation candidate.',
      sourceGoalId: null, sourceTaskId: null, sourceBriefId: null, sourcePlanId: null,
      projectId: input.projectId ?? defaultProjectId,
      targetSystem: input.actionType.startsWith('GMAIL') ? 'gmail' : input.actionType.startsWith('CALENDAR') ? 'google-calendar' : 'personal-os',
      requestedOperation: input.actionType,
      normalizedPayload: payload,
      payloadHash: hash,
      preview: textPreview('GENERIC', { Action: input.actionType, Simulated: true }),
      sideEffects: ['[SIMULATED — never a real side effect]'],
      rollbackPlan: 'N/A — simulation only.',
      requiredApprovals: 1,
      status: 'WAITING_APPROVAL',
      evidenceReferences: [],
      idempotencyKey: canonicalPayloadHash({ sim: true, actionType: input.actionType, payload }),
      safeFailure: true,
      createdAt,
      expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
      approvedAt: null, executedAt: null, rejectedAt: null, failureCode: null,
    };
  }

  /** Seeds the ephemeral store's kill switches from the caller's what-if overrides —
   *  never touches the real store, which this service never even connects to. */
  private applyKillSwitchOverrides(service: ControlledActionService, overrides?: KillSwitchOverride[]): void {
    for (const o of overrides ?? []) {
      service.policyEngine.killSwitch.enable({
        scope: o.scope, projectId: o.projectId ?? null, actionType: o.actionType ?? null,
        reason: o.reason, activatedBy: 'automation-simulation-what-if',
      });
    }
  }

  private applyBudgetOverrides(service: ControlledActionService, overrides?: BudgetOverride[]): void {
    for (const o of overrides ?? []) {
      const db = service.policyEngine.store.db;
      const existing = service.policyEngine.store.findBudget(o.actionType, o.projectId);
      const resetsAt = new Date(Date.now() + 3_600_000).toISOString();
      const currentUsage = { proposals: 0, approvals: 0, executions: o.usedExecutions, externalTargets: o.usedExternalTargets };
      if (existing) {
        db.prepare(`UPDATE action_budgets SET maxExecutions = ?, maxExternalTargets = ?, currentUsageJson = ?, resetsAt = ? WHERE id = ?`)
          .run(o.maxExecutions, o.maxExternalTargets, JSON.stringify(currentUsage), resetsAt, existing.id);
      } else {
        db.prepare(`
          INSERT INTO action_budgets (id, scope, projectId, actionType, period, maxProposals, maxApprovals, maxExecutions, maxExternalTargets, currentUsageJson, resetsAt, enabled)
          VALUES (@id, @scope, @projectId, @actionType, @period, @maxProposals, @maxApprovals, @maxExecutions, @maxExternalTargets, @currentUsageJson, @resetsAt, 1)
        `).run({
          id: `sim-budget-${randomUUID()}`, scope: o.projectId ? 'PROJECT' : 'GLOBAL', projectId: o.projectId, actionType: o.actionType,
          period: 'HOUR', maxProposals: 1000, maxApprovals: 1000, maxExecutions: o.maxExecutions, maxExternalTargets: o.maxExternalTargets,
          currentUsageJson: JSON.stringify(currentUsage), resetsAt,
        });
      }
    }
  }

  private evaluateDelegationWhatIf(override: import('./types').DelegationOverride, proposal: ActionProposal, policyResult: import('../actions/governance/types').PolicyDecisionResult): EligibilityResult | null {
    if (override.scenario === 'NONE') return null;
    const nowDate = new Date();
    const baseDelegation: DelegatedAuthority = {
      id: override.delegationId ?? 'sim-delegation',
      delegationVersion: 1, previousVersionId: null,
      title: 'Simulated delegation', description: 'Phase 6F what-if delegation', owner: 'automation-simulation',
      projectId: proposal.projectId ?? 'sim-project', status: 'ACTIVE',
      allowedActionTypes: [proposal.actionType], deniedActionTypes: [],
      targetRestriction: { allowedDomains: ['mi.local'] },
      riskCeiling: 'R3', approvalLevelCeiling: 'STRONG',
      startsAt: new Date(nowDate.getTime() - 3_600_000).toISOString(), expiresAt: new Date(nowDate.getTime() + 3_600_000).toISOString(), timezone: 'UTC',
      maxExecutions: 10, usedExecutions: 0, maxTargets: null, usedTargets: 0, actionBudgets: [],
      sourceGoalId: null, sourcePlanId: null, policyVersion: null, policyHash: null,
      delegationPayloadHash: canonicalPayloadHash({ sim: true }),
      createdAt: now(), approvedAt: now(), activatedAt: now(), revokedAt: null, exhaustedAt: null, expiredAt: null, pausedReason: null,
      evidenceReferences: [],
    };
    const delegation: DelegatedAuthority = applyDelegationScenario(baseDelegation, override.scenario, proposal, nowDate);
    const ctx: EligibilityContext = {
      now: nowDate, killSwitchBlocked: false, killSwitchReason: null,
      policyDecisionResult: policyResult, policyVersion: null, policyHash: null,
      budgetBlocked: false, budgetReason: null, providerHealthy: true,
      anomalyDetected: false, anomalyReason: null, orchestrationDependenciesValid: true,
      alreadyExecuted: false, targetsRequested: 1, recipientDomains: ['mi.local'], recipientCount: 1,
      attendeeCount: null, durationMinutes: null, hasRecurrence: false, hasBcc: false,
    };
    return evaluateDelegationEligibility(delegation, proposal, ctx);
  }
}

function applyDelegationScenario(base: DelegatedAuthority, scenario: import('./types').DelegationOverride['scenario'], proposal: ActionProposal, nowDate: Date): DelegatedAuthority {
  switch (scenario) {
    case 'EXPIRED': return { ...base, expiresAt: new Date(nowDate.getTime() - 3_600_000).toISOString() };
    case 'REVOKED': return { ...base, status: 'REVOKED' };
    case 'QUOTA_EXHAUSTED': return { ...base, usedExecutions: base.maxExecutions };
    case 'WRONG_PROJECT': return { ...base, projectId: `${proposal.projectId ?? 'sim'}-other` };
    case 'WRONG_ACTION': return { ...base, allowedActionTypes: [] };
    case 'WRONG_TARGET': return { ...base, targetRestriction: { allowedDomains: ['not-matching.example'] } };
    case 'RISK_ABOVE_CEILING': return { ...base, riskCeiling: 'R0' };
    case 'POLICY_CHANGED': return { ...base, status: 'PAUSED_POLICY_CHANGED' };
    case 'VALID':
    default: return base;
  }
}

type ActionPlanLikeStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
function outcomeToStepStatus(outcome: SimulationOutcome): ActionPlanLikeStatus {
  if (outcome === 'WOULD_EXECUTE') return 'COMPLETED';
  if (outcome === 'WOULD_BLOCK' || outcome === 'WOULD_FAIL' || outcome === 'INVALID') return 'FAILED';
  return 'PENDING';
}

function overallOutcomeOf(steps: SimulationStepResult[]): SimulationOutcome {
  if (!steps.length) return 'SIMULATED';
  if (steps.some(s => s.result === 'INVALID')) return 'INVALID';
  if (steps.some(s => s.result === 'WOULD_BLOCK')) return 'WOULD_BLOCK';
  if (steps.some(s => s.result === 'UNCERTAIN')) return 'UNCERTAIN';
  if (steps.some(s => s.result === 'WOULD_FAIL')) return 'WOULD_FAIL';
  if (steps.some(s => s.result === 'WOULD_REQUIRE_APPROVAL')) return 'WOULD_REQUIRE_APPROVAL';
  if (steps.every(s => s.result === 'WOULD_EXECUTE')) return 'WOULD_EXECUTE';
  return 'SIMULATED';
}
