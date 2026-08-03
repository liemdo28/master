/**
 * Phase 4 local LLM coding engine.
 *
 * Implements the Phase 3 `CodingEngineAdapter` contract by driving a local
 * Ollama model through inspect -> expand -> plan -> patch -> repair. It contains
 * no task-specific logic: every behaviour is derived from the context pack, the
 * ranked candidates, and the model's own output.
 *
 * Deliberate non-capabilities: it cannot push, merge, deploy, choose its own
 * cwd, reach a non-loopback endpoint, or touch a path the context pack did not
 * approve. Those are enforced in `tools.ts`, `patch.ts`, and `ollama-client.ts`.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { CodingEngineAdapter } from '../engines/adapter';
import type { CandidateSelection, CodingModelRoles, EngineApplyResult, EnginePlan } from '../types';
import type { ContextPack, ProjectRecord } from '../../project-registry/types';
import { generate, ModelTimeoutError, ModelUnavailableError } from './ollama-client';
import {
  buildExpansionPolicy,
  buildPromptContext,
  createContextState,
  evaluateExpansion,
  expandablePaths,
  loadCandidateFiles,
  recordDeniedExpansion,
  refreshContextFiles,
  sessionFilePath,
  type ContextBridgeState,
  type ExpansionPolicy,
} from './context-bridge';
import {
  buildExpansionPrompt,
  buildPatchPrompt,
  buildPlanPrompt,
  buildRepairPrompt,
  EXPANSION_SYSTEM,
  PATCH_SYSTEM,
  PLAN_SYSTEM,
  REPAIR_SYSTEM,
  type PromptContext,
} from './prompts';
import { applyPatch } from './patch';
import {
  CodingEngineError,
  EXPANSION_SCHEMA,
  PATCH_SCHEMA,
  PLAN_SCHEMA,
  type ContextExpansionOutcome,
  type EngineTelemetry,
  type ModelPatch,
  type ModelPlan,
} from './types';

export const LLM_ENGINE_ID = 'local-llm-engine';

export interface LlmEngineOptions {
  /** Supplied by the workflow so the engine can bridge the real context pack. */
  project?: ProjectRecord;
  contextPack?: ContextPack;
  sourceSha?: string;
  validationCommands?: string[];
  contextBudgetBytes?: number;
  planTimeoutMs?: number;
  patchTimeoutMs?: number;
  numCtx?: number;
}

interface EngineSession {
  worktreePath: string;
  state: ContextBridgeState;
  policy: ExpansionPolicy;
  candidates: CandidateSelection;
  promptContext: PromptContext;
  telemetry: EngineTelemetry[];
  modelRoles?: CodingModelRoles;
}

interface PersistedSession {
  worktreePath: string;
  filePaths: string[];
  expansions: ContextExpansionOutcome[];
  telemetry: EngineTelemetry[];
  plan?: ModelPlan;
  updatedAt: string;
}

export class LlmCodingEngine implements CodingEngineAdapter {
  readonly id = LLM_ENGINE_ID;

  private sessions = new Map<string, EngineSession>();
  private controllers = new Map<string, AbortController>();
  private cancelled = new Set<string>();
  private lastFailure: { category: string; message: string } | null = null;

  constructor(private options: LlmEngineOptions = {}) {}

  get failure(): { category: string; message: string } | null {
    return this.lastFailure;
  }

  /** Reads the ranked candidates and lets the model justify any expansion. */
  async inspect(input: {
    worktreePath: string;
    candidates: CandidateSelection;
    userRequest: string;
    modelRoles?: CodingModelRoles;
    signal?: AbortSignal;
  }): Promise<{ filesRead: string[]; expansions?: ContextExpansionOutcome[] }> {
    const session = this.openSession(input.worktreePath, input.candidates, input.userRequest, input.modelRoles);
    loadCandidateFiles(session.state, input.candidates.candidates);

    const model = this.pickModel(input.modelRoles, 'fast');
    if (model) {
      try {
        await this.runExpansionPass(session, input.userRequest, model, input.signal);
      } catch (err) {
        // A failed expansion pass is not fatal: the engine proceeds with candidates only.
        this.noteFailure(err);
      }
    }

    session.promptContext = this.renderPromptContext(session, input.userRequest);
    this.persist(session);
    return { filesRead: [...session.state.files.keys()], expansions: session.state.expansions };
  }

  async plan(input: {
    worktreePath: string;
    candidates: CandidateSelection;
    userRequest: string;
    modelRoles: CodingModelRoles;
    signal?: AbortSignal;
  }): Promise<EnginePlan> {
    const session = this.openSession(input.worktreePath, input.candidates, input.userRequest, input.modelRoles);
    if (!session.state.files.size) loadCandidateFiles(session.state, input.candidates.candidates);
    session.promptContext = this.renderPromptContext(session, input.userRequest);

    const model = this.requireModel(input.modelRoles, 'primary');
    const signal = this.trackSignal(input.worktreePath, input.signal);

    const result = await this.callModel({
      session,
      model,
      system: PLAN_SYSTEM,
      prompt: buildPlanPrompt(session.promptContext),
      schema: PLAN_SCHEMA,
      timeoutMs: this.options.planTimeoutMs ?? 240_000,
      numPredict: 900,
      signal,
      label: 'plan',
    });

    const parsed = parseJsonObject<ModelPlan>(result.response, 'plan');
    const allowed = new Set(input.candidates.candidates.map(c => c.path));

    const filesToChange = uniqueStrings(parsed.filesToChange).map(normalizePath).filter(p => allowed.has(p));
    const hallucinated = uniqueStrings(parsed.filesToChange).map(normalizePath).filter(p => !allowed.has(p));

    if (!filesToChange.length) {
      throw new CodingEngineError(
        hallucinated.length ? 'INVALID_PLAN' : 'CONTEXT_INSUFFICIENT',
        hallucinated.length
          ? `model planned only files outside the candidate set: ${hallucinated.join(', ')}`
          : `model reported it cannot complete the task with the supplied context: ${parsed.summary ?? ''}`.trim(),
        { hallucinated, summary: parsed.summary }
      );
    }

    const enginePlan: EnginePlan = {
      engineId: this.id,
      summary: String(parsed.summary ?? '').slice(0, 500) || 'local model plan',
      filesToRead: uniqueStrings(parsed.filesToRead).map(normalizePath).filter(p => allowed.has(p)),
      filesToChange,
      confidence: clampConfidence(parsed.confidence),
    };

    this.persist(session, { ...parsed, filesToChange });
    (enginePlan as EnginePlan & { hallucinatedPaths?: string[]; steps?: string[] }).hallucinatedPaths = hallucinated;
    (enginePlan as EnginePlan & { steps?: string[] }).steps = uniqueStrings(parsed.steps);
    return enginePlan;
  }

  async apply(input: {
    worktreePath: string;
    plan: EnginePlan;
    userRequest: string;
    modelRoles?: CodingModelRoles;
    signal?: AbortSignal;
  }): Promise<EngineApplyResult> {
    const session = this.mustGetSession(input.worktreePath, input.userRequest, input.plan);
    const model = this.requireModel(input.modelRoles ?? session.modelRoles, 'primary');
    const signal = this.trackSignal(input.worktreePath, input.signal);
    if (this.cancelled.has(input.worktreePath)) throw new Error('coding task cancelled');

    refreshContextFiles(session.state);
    session.promptContext = this.renderPromptContext(session, input.userRequest);

    const modelPlan: ModelPlan = {
      summary: input.plan.summary,
      filesToRead: input.plan.filesToRead,
      filesToChange: input.plan.filesToChange,
      steps: (input.plan as EnginePlan & { steps?: string[] }).steps ?? [input.plan.summary],
      confidence: input.plan.confidence,
    };

    const result = await this.callModel({
      session,
      model,
      system: PATCH_SYSTEM,
      prompt: buildPatchPrompt(session.promptContext, modelPlan),
      schema: PATCH_SCHEMA,
      timeoutMs: this.options.patchTimeoutMs ?? 300_000,
      numPredict: 2400,
      signal,
      label: 'patch',
    });

    const patch = parseJsonObject<ModelPatch>(result.response, 'patch');
    const writable = new Set(input.plan.filesToChange.map(normalizePath));
    const outcome = applyPatch({ worktreePath: input.worktreePath, writablePaths: writable, patch });

    this.persist(session);
    return {
      engineId: this.id,
      changedFiles: outcome.changedFiles,
      evidence: {
        model,
        summary: patch.summary,
        edits: outcome.applied,
        telemetry: session.telemetry.at(-1),
        contextFiles: [...session.state.files.keys()],
        expansions: session.state.expansions,
      },
    };
  }

  /** Bounded repair pass. The workflow supplies the real validation output. */
  async continue(input: {
    worktreePath: string;
    plan: EnginePlan;
    attempt: number;
    validationSummary: string;
    validationOutput?: string;
    userRequest?: string;
    modelRoles?: CodingModelRoles;
    signal?: AbortSignal;
  }): Promise<EngineApplyResult> {
    const userRequest = input.userRequest ?? this.sessions.get(input.worktreePath)?.promptContext.userRequest ?? '';
    const session = this.mustGetSession(input.worktreePath, userRequest, input.plan);
    const model = this.requireModel(input.modelRoles ?? session.modelRoles, 'primary');
    const signal = this.trackSignal(input.worktreePath, input.signal);
    if (this.cancelled.has(input.worktreePath)) throw new Error('coding task cancelled');

    refreshContextFiles(session.state);
    session.promptContext = this.renderPromptContext(session, userRequest);

    let previousError: string | undefined;
    for (let inner = 0; inner < 2; inner += 1) {
      const result = await this.callModel({
        session,
        model,
        system: REPAIR_SYSTEM,
        prompt: buildRepairPrompt({
          ctx: session.promptContext,
          attempt: input.attempt,
          failureSummary: input.validationSummary,
          validationOutput: input.validationOutput ?? input.validationSummary,
          previousError,
        }),
        schema: PATCH_SCHEMA,
        timeoutMs: this.options.patchTimeoutMs ?? 300_000,
        numPredict: 2400,
        signal,
        label: `repair-${input.attempt}`,
      });

      try {
        const patch = parseJsonObject<ModelPatch>(result.response, 'repair patch');
        const writable = new Set(input.plan.filesToChange.map(normalizePath));
        const outcome = applyPatch({ worktreePath: input.worktreePath, writablePaths: writable, patch });
        this.persist(session);
        return {
          engineId: this.id,
          changedFiles: outcome.changedFiles,
          evidence: {
            model,
            attempt: input.attempt,
            summary: patch.summary,
            edits: outcome.applied,
            telemetry: session.telemetry.at(-1),
          },
        };
      } catch (err) {
        if (!(err instanceof CodingEngineError) || err.category !== 'INVALID_PATCH') throw err;
        previousError = err.message;
        refreshContextFiles(session.state);
        session.promptContext = this.renderPromptContext(session, userRequest);
      }
    }
    throw new CodingEngineError('INVALID_PATCH', `repair attempt ${input.attempt} produced no applicable edit: ${previousError}`);
  }

  async cancel(taskId: string): Promise<void> {
    this.cancelled.add(taskId);
    for (const [key, controller] of this.controllers) {
      if (key === taskId || path.basename(key) === taskId) controller.abort();
    }
  }

  async status(taskId: string): Promise<{ running: boolean }> {
    if (this.cancelled.has(taskId)) return { running: false };
    for (const key of this.controllers.keys()) {
      if (key === taskId || path.basename(key) === taskId) return { running: true };
    }
    return { running: false };
  }

  async collectEvidence(worktreePath: string): Promise<Record<string, unknown>> {
    const session = this.sessions.get(worktreePath);
    return {
      engineId: this.id,
      worktreePath,
      contextFiles: session ? [...session.state.files.keys()] : [],
      contextBytes: session?.state.usedBytes ?? 0,
      expansions: session?.state.expansions ?? [],
      telemetry: session?.telemetry ?? [],
      lastFailure: this.lastFailure,
    };
  }

  // ── internals ────────────────────────────────────────────────────────────

  private openSession(
    worktreePath: string,
    candidates: CandidateSelection,
    userRequest: string,
    modelRoles?: CodingModelRoles
  ): EngineSession {
    const existing = this.sessions.get(worktreePath);
    if (existing) {
      if (modelRoles) existing.modelRoles = modelRoles;
      return existing;
    }
    const contextPack = this.options.contextPack;
    const state = createContextState(worktreePath, this.options.contextBudgetBytes);
    const policy = contextPack
      ? buildExpansionPolicy(worktreePath, contextPack)
      : { packPaths: new Set(candidates.candidates.map(c => c.path)), excluded: candidates.excluded };

    const session: EngineSession = {
      worktreePath,
      state,
      policy,
      candidates,
      telemetry: [],
      modelRoles,
      promptContext: {
        userRequest,
        projectSummary: this.options.project?.displayName ?? 'unknown project',
        mapVersion: this.options.contextPack?.mapVersion ?? 'unknown',
        sourceSha: this.options.sourceSha ?? 'unknown',
        constraints: [],
        validationCommands: this.options.validationCommands ?? [],
        candidates: candidates.candidates,
        files: [],
      },
    };
    this.restore(session);
    this.sessions.set(worktreePath, session);
    return session;
  }

  private mustGetSession(worktreePath: string, userRequest: string, plan: EnginePlan): EngineSession {
    const existing = this.sessions.get(worktreePath);
    if (existing) return existing;
    // Reconstruct after a process restart: rebuild context from the plan itself.
    const candidates: CandidateSelection = {
      candidates: plan.filesToChange.map(p => ({ path: p, reason: 'reconstructed from plan', relatedTests: [], confidence: 0.6 })),
      excluded: [],
      hardLimit: plan.filesToChange.length,
      maxBytesPerFile: 256 * 1024,
      source: 'context-pack',
    };
    const session = this.openSession(worktreePath, candidates, userRequest);
    loadCandidateFiles(session.state, candidates.candidates);
    session.promptContext = this.renderPromptContext(session, userRequest);
    return session;
  }

  private renderPromptContext(session: EngineSession, userRequest: string): PromptContext {
    if (this.options.project && this.options.contextPack) {
      return buildPromptContext({
        state: session.state,
        project: this.options.project,
        contextPack: this.options.contextPack,
        sourceSha: this.options.sourceSha ?? 'unknown',
        userRequest,
        candidates: session.candidates,
        validationCommands: this.options.validationCommands ?? [],
      });
    }
    return { ...session.promptContext, userRequest, files: [...session.state.files.values()], expansions: session.state.expansions };
  }

  private async runExpansionPass(
    session: EngineSession,
    userRequest: string,
    model: string,
    signal?: AbortSignal
  ): Promise<void> {
    const available = expandablePaths(session.policy, session.state);
    if (!available.length) return;

    const ctx = this.renderPromptContext(session, userRequest);
    const result = await this.callModel({
      session,
      model,
      system: EXPANSION_SYSTEM,
      prompt: buildExpansionPrompt(ctx, available),
      schema: EXPANSION_SCHEMA,
      timeoutMs: 120_000,
      numPredict: 400,
      signal,
      label: 'expansion',
    });

    const parsed = parseJsonObject<{ needMoreContext?: boolean; requests?: Array<{ path?: string; reason?: string }> }>(
      result.response,
      'expansion'
    );
    if (!parsed.needMoreContext || !Array.isArray(parsed.requests)) return;

    for (const request of parsed.requests.slice(0, 5)) {
      if (!request?.path) continue;
      const outcome = evaluateExpansion(session.state, session.policy, {
        path: normalizePath(String(request.path)),
        reason: String(request.reason ?? ''),
      });
      if (!outcome.granted) recordDeniedExpansion(session.state, outcome);
    }
  }

  private async callModel(input: {
    session: EngineSession;
    model: string;
    system: string;
    prompt: string;
    schema: unknown;
    timeoutMs: number;
    numPredict: number;
    signal?: AbortSignal;
    label: string;
  }): Promise<{ response: string }> {
    try {
      const result = await generate({
        model: input.model,
        system: input.system,
        prompt: input.prompt,
        format: input.schema as Record<string, unknown>,
        temperature: 0,
        numPredict: input.numPredict,
        numCtx: this.options.numCtx ?? 16384,
        timeoutMs: input.timeoutMs,
        signal: input.signal,
        think: false,
      });
      input.session.telemetry.push({
        model: result.model,
        promptTokens: result.promptTokens,
        evalTokens: result.evalTokens,
        latencyMs: result.totalMs,
        tokensPerSecond: result.tokensPerSecond,
        truncated: result.truncated,
      });
      if (result.truncated) {
        throw new CodingEngineError('CONTEXT_INSUFFICIENT', `${input.label} output truncated by token limit`);
      }
      return { response: result.response };
    } catch (err) {
      this.noteFailure(err);
      if (err instanceof ModelTimeoutError) throw new CodingEngineError('MODEL_TIMEOUT', err.message);
      if (err instanceof ModelUnavailableError) throw new CodingEngineError('MODEL_UNAVAILABLE', err.message);
      throw err;
    }
  }

  private pickModel(roles: CodingModelRoles | undefined, kind: 'fast' | 'primary' | 'review'): string | null {
    if (!roles) return null;
    if (kind === 'fast') return roles.coding_fast ?? roles.coding_primary;
    if (kind === 'review') return roles.coding_review ?? roles.coding_primary;
    return roles.coding_primary;
  }

  private requireModel(roles: CodingModelRoles | undefined, kind: 'fast' | 'primary' | 'review'): string {
    const model = this.pickModel(roles, kind);
    if (!model) throw new CodingEngineError('MODEL_UNAVAILABLE', `no local model available for role ${kind}`);
    return model;
  }

  private trackSignal(worktreePath: string, signal?: AbortSignal): AbortSignal {
    const controller = new AbortController();
    this.controllers.set(worktreePath, controller);
    if (signal) {
      if (signal.aborted) controller.abort();
      else signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
    if (this.cancelled.has(worktreePath)) controller.abort();
    return controller.signal;
  }

  private noteFailure(err: unknown): void {
    if (err instanceof CodingEngineError) this.lastFailure = { category: err.category, message: err.message };
    else if (err instanceof ModelTimeoutError) this.lastFailure = { category: 'MODEL_TIMEOUT', message: err.message };
    else if (err instanceof ModelUnavailableError) this.lastFailure = { category: 'MODEL_UNAVAILABLE', message: err.message };
    else this.lastFailure = { category: 'ENGINE_CRASHED', message: err instanceof Error ? err.message : String(err) };
  }

  private persist(session: EngineSession, plan?: ModelPlan): void {
    try {
      const file = sessionFilePath(session.worktreePath);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const payload: PersistedSession = {
        worktreePath: session.worktreePath,
        filePaths: [...session.state.files.keys()],
        expansions: session.state.expansions,
        telemetry: session.telemetry,
        plan,
        updatedAt: new Date().toISOString(),
      };
      fs.writeFileSync(file, JSON.stringify(payload, null, 2));
    } catch {
      // Session persistence is an optimisation for resume; never fail the task on it.
    }
  }

  private restore(session: EngineSession): void {
    try {
      const file = sessionFilePath(session.worktreePath);
      if (!fs.existsSync(file)) return;
      const payload = JSON.parse(fs.readFileSync(file, 'utf8')) as PersistedSession;
      session.state.expansions = payload.expansions ?? [];
      session.telemetry = payload.telemetry ?? [];
    } catch {
      // A corrupt sidecar just means a cold reconstruction.
    }
  }
}

// ── helpers ────────────────────────────────────────────────────────────────

export function normalizePath(value: string): string {
  return String(value).replace(/\\/g, '/').replace(/^\.\//, '').trim();
}

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((v): v is string => typeof v === 'string' && v.trim() !== ''))];
}

function clampConfidence(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return 0.5;
  return Math.max(0, Math.min(1, num));
}

/**
 * Parses model output as JSON. Structured output usually yields clean JSON, but
 * models still occasionally wrap it in prose or a fenced block, so recover the
 * outermost object rather than failing the whole task on a stray backtick.
 */
export function parseJsonObject<T>(raw: string, label: string): T {
  const text = String(raw ?? '').trim();
  if (!text) throw new CodingEngineError('INVALID_PLAN', `model returned an empty ${label}`);

  const attempts: string[] = [text];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) attempts.push(fenced[1].trim());
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) attempts.push(text.slice(firstBrace, lastBrace + 1));

  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt);
      if (parsed && typeof parsed === 'object') return parsed as T;
    } catch {
      // try the next recovery strategy
    }
  }
  throw new CodingEngineError('INVALID_PLAN', `model ${label} was not valid JSON`, { preview: text.slice(0, 300) });
}
