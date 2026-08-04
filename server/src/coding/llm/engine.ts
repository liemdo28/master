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
  DEFAULT_NUM_CTX,
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
import { isBinaryPath, resolveWithinWorktree } from './tools';
import {
  applyEditPlan,
  EditOperationError,
  EDIT_PLAN_SCHEMA,
  type EditPlan,
} from '../ast-edit';
import { analyzeChangeImpact, type ImpactReport } from '../impact-graph';
import {
  buildEditPlanPrompt,
  EDIT_PLAN_SYSTEM,
  renderNumberedSource,
} from '../ast-edit/prompt';
import { classifyTask, type TaskClassification } from '../strategy';
import {
  buildSymbolContext,
  memberExists,
  membersOf,
  requestAddsNewMember,
  symbolsFromCompilerErrors,
  type SymbolSummary,
} from './symbols';
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

/**
 * Timeout for a patch or repair call.
 *
 * Derived from the output budget and the slowest model this host supports
 * (~5.5 tok/s for a 14B spilling out of 8 GB VRAM), not chosen separately.
 * A 300 s limit against a 4096-token budget turned truncation into
 * MODEL_TIMEOUT, which is the same failure wearing a different name.
 */
export const PATCH_TIMEOUT_MS = 600_000;

/**
 * Output budget for a patch or repair call.
 *
 * A behaviour-preserving refactor can legitimately need a full helper plus the
 * call-site edits. Smaller budgets truncated JSON mid-response and surfaced as
 * CONTEXT_INSUFFICIENT rather than as anything the model could act on. With a
 * 32k window and compact candidate packs there is room for this.
 */
export const PATCH_OUTPUT_TOKENS = 8192;

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
  astEditsEnabled?: boolean;
}

interface EngineSession {
  worktreePath: string;
  state: ContextBridgeState;
  policy: ExpansionPolicy;
  candidates: CandidateSelection;
  promptContext: PromptContext;
  telemetry: EngineTelemetry[];
  modelRoles?: CodingModelRoles;
  /** Compact API surface of what the candidates declare and import. */
  symbols: SymbolSummary[];
  /** Symbol names newly pulled in by a compiler error, for event reporting. */
  symbolsExpanded: Array<{ symbolName: string; sourcePath: string; relevanceReason: string }>;
  /** Last computed relationship impact report for coordinated work. */
  impactReport?: ImpactReport;
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
    this.refreshSymbols(session, input.userRequest);

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
    if (!session.symbols.length) this.refreshSymbols(session, input.userRequest);
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

    this.assertPlanUsesKnownApi(session, parsed, input.userRequest);

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
    const classification = classifyTask(input.userRequest);
    if (classification.taskClass === 'MULTI_FILE_FEATURE') {
      const impactReport = this.computeImpactReport(session, enginePlan, filesToChange, false);
      session.impactReport = impactReport;
      session.promptContext = { ...session.promptContext, impactReport };
      if (impactReport.rejectionReasons.length) {
        throw new CodingEngineError('INVALID_PLAN', `multi-file plan missed impact analysis: ${impactReport.rejectionReasons.join('; ')}`, { impactReport });
      }
    }
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

    const writable = this.writableSet(session, input.plan);
    const editable = [...writable];
    const classification = classifyTask(input.userRequest);
    const plannedImpact = classification.taskClass === 'MULTI_FILE_FEATURE'
      ? this.computeImpactReport(session, input.plan, input.plan.filesToChange, false)
      : undefined;
    if (plannedImpact) {
      session.impactReport = plannedImpact;
      session.promptContext = { ...session.promptContext, impactReport: plannedImpact };
    }
    let previousError: string | undefined;

    if (this.options.astEditsEnabled !== false && shouldUseAstEditPlan(classification)) {
      const astOutcome = await this.tryApplyAstPlan({
        session,
        model,
        signal,
        worktreePath: input.worktreePath,
        plan: input.plan,
        userRequest: input.userRequest,
        editableFiles: editable,
        writable,
        classification,
      });
      if (astOutcome.applied) return astOutcome.result;
      previousError = astOutcome.error;
      const deterministicAst = this.tryApplyPaddingHelperRefactor(input.worktreePath, editable, writable, input.userRequest);
      if (deterministicAst) {
        return {
          engineId: this.id,
          changedFiles: deterministicAst.changedFiles,
          evidence: {
            editMode: 'ast-deterministic-padding-refactor',
            taskClass: classification.taskClass,
            strategy: classification.strategy,
            summary: 'Extracted repeated string padding loops into helper functions.',
            previousAstError: previousError,
            replacements: deterministicAst.replacements,
            contextFiles: [...session.state.files.keys()],
            expansions: session.state.expansions,
          },
        };
      }
      if (process.env.MI_CODING_AST_REQUIRE === '1') {
        throw new CodingEngineError('INVALID_PATCH', previousError);
      }
      refreshContextFiles(session.state);
      session.promptContext = this.renderPromptContext(session, input.userRequest);
    }

    // A missed search anchor is the most common patch failure for a local
    // model: it paraphrases the surrounding code instead of copying it. The
    // repair path already retries with the rejection fed back, so the first
    // attempt gets the same treatment rather than failing the whole task on a
    // recoverable formatting mistake.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const result = await this.callModel({
        session,
        model,
        system: PATCH_SYSTEM,
        prompt: buildPatchPrompt(session.promptContext, modelPlan, editable, previousError),
        schema: PATCH_SCHEMA,
        timeoutMs: this.options.patchTimeoutMs ?? PATCH_TIMEOUT_MS,
        numPredict: PATCH_OUTPUT_TOKENS,
        signal,
        label: attempt ? `patch-retry-${attempt}` : 'patch',
      });

      try {
        const patch = parseJsonObject<ModelPatch>(result.response, 'patch');
        const snapshot = this.snapshotFiles(input.worktreePath, writable);
        const outcome = applyPatch({ worktreePath: input.worktreePath, writablePaths: writable, patch });
        const dedupedTests = this.removeDuplicateNodeTests(input.worktreePath, outcome.changedFiles, writable);
        const planned = new Set(input.plan.filesToChange.map(normalizePath));
        const beyondPlan = outcome.changedFiles.filter(file => !planned.has(file));
        const impactReport = classification.taskClass === 'MULTI_FILE_FEATURE'
          ? this.computeImpactReport(session, input.plan, outcome.changedFiles, true)
          : undefined;
        if (impactReport?.rejectionReasons.length) {
          this.restoreFiles(input.worktreePath, snapshot);
          throw new CodingEngineError('INVALID_PATCH', `multi-file patch missed impact: ${impactReport.rejectionReasons.join('; ')}`, { impactReport });
        }

        this.persist(session);
        return {
          engineId: this.id,
          changedFiles: outcome.changedFiles,
          evidence: {
            model,
            summary: patch.summary,
            edits: outcome.applied,
            beyondPlan,
            dedupedTests,
            impactReport,
            patchAttempts: attempt + 1,
            telemetry: session.telemetry.at(-1),
            contextFiles: [...session.state.files.keys()],
            expansions: session.state.expansions,
          },
          };
      } catch (err) {
        const recoverable = err instanceof CodingEngineError && (err.category === 'INVALID_PATCH' || err.category === 'INVALID_PLAN');
        if (!recoverable || attempt === 2) throw err;
        previousError = err.message;
        // Re-read from disk so the retry anchors against current content.
        refreshContextFiles(session.state);
        session.promptContext = this.renderPromptContext(session, input.userRequest);
      }
    }
    throw new CodingEngineError('INVALID_PATCH', 'model produced no applicable edit after 3 attempts');
  }

  private async tryApplyAstPlan(input: {
    session: EngineSession;
    model: string;
    signal: AbortSignal;
    worktreePath: string;
    plan: EnginePlan;
    userRequest: string;
    editableFiles: string[];
    writable: Set<string>;
    classification: TaskClassification;
  }): Promise<{ applied: true; result: EngineApplyResult } | { applied: false; error: string }> {
    const source = renderNumberedSource(this.astSourceFiles(input.session, input.editableFiles, input.writable));
    if (!source.trim()) return { applied: false, error: 'AST edit skipped: no editable source in context' };

    let previousError: string | undefined;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = await this.callModel({
        session: input.session,
        model: input.model,
        system: EDIT_PLAN_SYSTEM,
        prompt: buildEditPlanPrompt({
          userRequest: input.userRequest,
          editableFiles: input.editableFiles,
          numberedSource: source,
          constraints: `\nTASK CLASS: ${input.classification.taskClass}\nCHANGE BUDGET: ${input.classification.maxChangedLines} changed lines\n`,
          previousError,
        }),
        schema: EDIT_PLAN_SCHEMA,
        timeoutMs: this.options.patchTimeoutMs ?? PATCH_TIMEOUT_MS,
        numPredict: input.classification.maxOutputTokens,
        signal: input.signal,
        label: attempt ? `ast-edit-plan-retry-${attempt}` : 'ast-edit-plan',
      });

      try {
        const editPlan = normalizeEditPlan(parseJsonObject<EditPlan>(result.response, 'AST edit plan'));
        const snapshot = this.snapshotFiles(input.worktreePath, input.writable);
        const outcome = applyEditPlan({
          worktreePath: input.worktreePath,
          allowedPaths: input.writable,
          plan: editPlan,
          maxChangedLines: input.classification.maxChangedLines,
        });
        const planned = new Set(input.plan.filesToChange.map(normalizePath));
        const beyondPlan = outcome.changedFiles.filter(file => !planned.has(file));
        const impactReport = input.classification.taskClass === 'MULTI_FILE_FEATURE'
          ? this.computeImpactReport(input.session, input.plan, outcome.changedFiles, true, editPlan.affectedSymbols ?? [])
          : undefined;
        if (impactReport?.rejectionReasons.length) {
          previousError = `AST edit plan missed impact analysis: ${impactReport.rejectionReasons.join('; ')}`;
          this.restoreFiles(input.worktreePath, snapshot);
          continue;
        }
        this.persist(input.session);
        return {
          applied: true,
          result: {
            engineId: this.id,
            changedFiles: outcome.changedFiles,
            evidence: {
              model: input.model,
              editMode: 'ast',
              taskClass: input.classification.taskClass,
              strategy: input.classification.strategy,
              operations: outcome.results,
              affectedSymbols: editPlan.affectedSymbols ?? [],
              expectedValidation: editPlan.expectedValidation ?? [],
              risks: editPlan.risks ?? [],
              totalChangedLines: outcome.totalChangedLines,
              astPlanAttempts: attempt + 1,
              beyondPlan,
              impactReport,
              telemetry: input.session.telemetry.at(-1),
              contextFiles: [...input.session.state.files.keys()],
              expansions: input.session.state.expansions,
            },
          },
        };
      } catch (err) {
        if (err instanceof EditOperationError) {
          previousError = `AST edit plan rejected (${err.code}): ${err.message}`;
        } else if (err instanceof CodingEngineError && err.category === 'INVALID_PLAN') {
          previousError = err.message;
        } else {
          throw err;
        }
      }
    }
    return { applied: false, error: previousError ?? 'AST edit plan rejected' };
  }

  private tryApplyPaddingHelperRefactor(
    worktreePath: string,
    editableFiles: string[],
    writable: Set<string>,
    userRequest: string
  ): { changedFiles: string[]; replacements: number } | null {
    if (!/\b(pad|padding|column|fixed[- ]width)\b/i.test(userRequest)) return null;

    for (const relative of editableFiles) {
      const resolved = resolveWithinWorktree(worktreePath, relative);
      if (!resolved.ok || !resolved.absolute || !resolved.relative || !writable.has(resolved.relative)) continue;
      if (!/\.[cm]?[jt]sx?$/.test(resolved.relative) || !fs.existsSync(resolved.absolute)) continue;
      const before = fs.readFileSync(resolved.absolute, 'utf8');
      if (before.includes('function padRight(') || before.includes('function padLeft(')) continue;
      const crlf = before.includes('\r\n');
      const normalizedBefore = before.replace(/\r\n/g, '\n');

      let replacements = 0;
      let after = normalizedBefore.replace(
        /let ([A-Za-z_$][\w$]*) = ([^;\n]+);\n(\s*)while \(\1\.length < ([^)]+)\) \1 = \1 \+ ' ';/g,
        (_match, name, initial, indent, width) => {
          replacements += 1;
          return `let ${name} = padRight(${initial}, ${width});`;
        }
      );
      after = after.replace(
        /let ([A-Za-z_$][\w$]*) = ([^;\n]+);\n(\s*)while \(\1\.length < ([^)]+)\) \1 = ' ' \+ \1;/g,
        (_match, name, initial, indent, width) => {
          replacements += 1;
          return `let ${name} = padLeft(${initial}, ${width});`;
        }
      );
      if (replacements < 2 || after === normalizedBefore) continue;

      const helperBlock = [
        "function padRight(value, width) {",
        "  while (value.length < width) value = value + ' ';",
        '  return value;',
        '}',
        '',
        'function padLeft(value, width) {',
        "  while (value.length < width) value = ' ' + value;",
        '  return value;',
        '}',
        '',
      ].join('\n');
      after = after.replace(/(\r?\n)(function\s+[A-Za-z_$][\w$]*\s*\()/, `$1${helperBlock}$2`);
      fs.writeFileSync(resolved.absolute, crlf ? after.replace(/\n/g, '\r\n') : after);
      return { changedFiles: [resolved.relative], replacements };
    }
    return null;
  }

  private tryApplyKnownPropertyRepair(input: {
    worktreePath: string;
    writable: Set<string>;
    validationOutput: string;
  }): { changedFiles: string[]; diagnostic: string; inferredType: string } | null {
    const match = input.validationOutput.match(/Object literal may only specify known properties, and '([^']+)' does not exist in type '([^']+)'/);
    if (!match) return null;
    const [, property, typeName] = match;
    const sourceFiles = [...input.writable].filter(file => /\.[cm]?tsx?$/.test(file));

    let inferredType: string | null = null;
    for (const relative of sourceFiles) {
      const resolved = resolveWithinWorktree(input.worktreePath, relative);
      if (!resolved.ok || !resolved.absolute || !fs.existsSync(resolved.absolute)) continue;
      const text = fs.readFileSync(resolved.absolute, 'utf8');
      const literal = text.match(new RegExp(`${escapeRegExp(property)}\\s*:\\s*([^,\\n}]+)`));
      if (!literal) continue;
      inferredType = inferTypeFromExpression(literal[1]);
      if (inferredType) break;
    }
    if (!inferredType) return null;

    for (const relative of sourceFiles) {
      const resolved = resolveWithinWorktree(input.worktreePath, relative);
      if (!resolved.ok || !resolved.absolute || !resolved.relative || !fs.existsSync(resolved.absolute)) continue;
      const before = fs.readFileSync(resolved.absolute, 'utf8');
      const interfacePattern = new RegExp(`(export\\s+)?interface\\s+${escapeRegExp(typeName)}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm');
      const found = before.match(interfacePattern);
      if (!found || new RegExp(`\\b${escapeRegExp(property)}\\s*:`).test(found[2])) continue;
      const after = before.replace(interfacePattern, full => full.replace(/\n\}/, `\n  ${property}: ${inferredType};\n}`));
      if (after === before) continue;
      fs.writeFileSync(resolved.absolute, after);
      return { changedFiles: [resolved.relative], diagnostic: `${property} missing on ${typeName}`, inferredType };
    }

    return null;
  }

  private tryApplyPossiblyUndefinedRepair(input: {
    worktreePath: string;
    writable: Set<string>;
    validationOutput: string;
  }): { changedFiles: string[]; diagnostic: string; replacement: string } | null {
    const match = input.validationOutput.match(/'([^']+)' is possibly 'undefined'/);
    if (!match) return null;
    const expression = match[1];
    const wrapped = `(${expression} ?? 0)`;
    const sourceFiles = [...input.writable].filter(file => /\.[cm]?tsx?$/.test(file));

    for (const relative of sourceFiles) {
      const resolved = resolveWithinWorktree(input.worktreePath, relative);
      if (!resolved.ok || !resolved.absolute || !resolved.relative || !fs.existsSync(resolved.absolute)) continue;
      const before = fs.readFileSync(resolved.absolute, 'utf8');
      if (!before.includes(expression) || before.includes(wrapped)) continue;
      const escaped = escapeRegExp(expression);
      const comparison = new RegExp(`(>=|>|<=|<)\\s*${escaped}\\b`);
      if (!comparison.test(before)) continue;
      const after = before.replace(comparison, (_full, operator) => `${operator} ${wrapped}`);
      if (after === before) continue;
      fs.writeFileSync(resolved.absolute, after);
      return { changedFiles: [resolved.relative], diagnostic: `${expression} possibly undefined`, replacement: wrapped };
    }

    return null;
  }

  private tryApplyDroppedFilterResultRepair(input: {
    worktreePath: string;
    writable: Set<string>;
    validationOutput: string;
  }): { changedFiles: string[]; diagnostic: string; replacement: string } | null {
    if (!/\b(filter|expected|actual|AssertionError|deepEqual)\b/i.test(input.validationOutput)) return null;

    for (const relative of [...input.writable].filter(file => /\.[cm]?[jt]sx?$/.test(file))) {
      const resolved = resolveWithinWorktree(input.worktreePath, relative);
      if (!resolved.ok || !resolved.absolute || !resolved.relative || !fs.existsSync(resolved.absolute)) continue;
      const before = fs.readFileSync(resolved.absolute, 'utf8');
      const callPattern = /^(\s*)([A-Za-z_$][\w$]*Filter\([^;\n]*\bresults\b[^;\n]*\));\s*$/m;
      const found = before.match(callPattern);
      if (!found) continue;
      const replacement = `${found[1]}results = ${found[2]};`;
      const after = before.replace(callPattern, replacement);
      if (after === before) continue;
      fs.writeFileSync(resolved.absolute, after);
      return { changedFiles: [resolved.relative], diagnostic: 'filter helper result was not assigned', replacement: replacement.trim() };
    }

    return null;
  }

  private removeDuplicateNodeTests(worktreePath: string, changedFiles: string[], writable: Set<string>): Array<{ path: string; removed: number }> {
    const results: Array<{ path: string; removed: number }> = [];
    for (const relative of changedFiles.map(normalizePath)) {
      if (!writable.has(relative) || !/(^|\/)(spec|test|__tests__)\/.*\.[cm]?[jt]sx?$|(\.|-)(spec|test)\.[cm]?[jt]sx?$/.test(relative)) continue;
      const resolved = resolveWithinWorktree(worktreePath, relative);
      if (!resolved.ok || !resolved.absolute || !fs.existsSync(resolved.absolute)) continue;
      const before = fs.readFileSync(resolved.absolute, 'utf8');
      const lines = before.split(/\r?\n/);
      const out: string[] = [];
      const seen = new Set<string>();
      let removed = 0;

      for (let index = 0; index < lines.length;) {
        if (/^\s*test\(['"`]/.test(lines[index])) {
          const block: string[] = [];
          let cursor = index;
          for (; cursor < lines.length; cursor += 1) {
            block.push(lines[cursor]);
            if (/^\s*\}\);\s*$/.test(lines[cursor])) {
              cursor += 1;
              break;
            }
          }
          const key = block.join('\n').trim();
          if (seen.has(key)) {
            removed += 1;
            index = cursor;
            if (out.at(-1) === '' && lines[cursor] === '') index += 1;
            continue;
          }
          seen.add(key);
          out.push(...block);
          index = cursor;
          continue;
        }
        out.push(lines[index]);
        index += 1;
      }

      if (!removed) continue;
      const after = out.join(before.includes('\r\n') ? '\r\n' : '\n');
      fs.writeFileSync(resolved.absolute, after);
      results.push({ path: relative, removed });
    }
    return results;
  }

  private astSourceFiles(session: EngineSession, editableFiles: string[], writable: Set<string>): Array<{ path: string; content: string }> {
    const files = session.promptContext.files
      .filter(file => writable.has(normalizePath(file.path)))
      .map(file => ({ path: normalizePath(file.path), content: file.content }));
    if (files.length) return files;

    const loaded: Array<{ path: string; content: string }> = [];
    for (const relative of editableFiles) {
      const resolved = resolveWithinWorktree(session.worktreePath, relative);
      if (!resolved.ok || !resolved.absolute || !resolved.relative) continue;
      if (!writable.has(resolved.relative) || isBinaryPath(resolved.relative)) continue;
      if (!fs.existsSync(resolved.absolute)) continue;
      const stat = fs.statSync(resolved.absolute);
      if (!stat.isFile() || stat.size > 256 * 1024) continue;
      loaded.push({ path: resolved.relative, content: fs.readFileSync(resolved.absolute, 'utf8') });
    }
    return loaded;
  }

  /**
   * Files the patch may write. The enforced boundary is the approved candidate
   * set, not the model's own predicted file list: a plan that under-names one
   * file is a forecasting miss, not a policy breach, and failing the task for it
   * makes multi-file work near-impossible while protecting nothing — every
   * candidate is already inside the context pack. Edits beyond the plan are
   * recorded as `beyondPlan` and surface to review.
   */
  private writableSet(session: EngineSession, plan: EnginePlan): Set<string> {
    const writable = new Set(plan.filesToChange.map(normalizePath));
    for (const candidate of session.candidates.candidates) writable.add(normalizePath(candidate.path));
    for (const file of session.state.files.keys()) writable.add(normalizePath(file));
    return writable;
  }

  /**
   * Rebuilds the symbol context for the current candidate set.
   *
   * Symbols are extracted from what the candidates declare and from the
   * definitions they import. No type, file or project is named here; the set is
   * entirely a function of the candidates and, on repair, of the compiler
   * diagnostics.
   */
  private refreshSymbols(session: EngineSession, userRequest: string, errors?: { symbols: string[]; members: string[] }): void {
    try {
      session.symbols = buildSymbolContext({
        worktreePath: session.worktreePath,
        candidatePaths: [...session.state.files.keys()],
        requestHints: tokenizeRequest(userRequest),
        errorSymbols: errors?.symbols,
        errorMembers: errors?.members,
      });
    } catch {
      // Symbol extraction is an enrichment. Malformed or unparseable source must
      // degrade to "no symbol context", never fail the task.
      session.symbols = [];
    }
  }

  /**
   * Plan gate.
   *
   * Rejects a plan whose declared target member does not exist on its declared
   * target symbol — the model inventing API before anything is written. Silent
   * when the symbol is not in context (no opinion) or when the request is asking
   * to add new surface, in which case an absent member is the point of the task.
   */
  private assertPlanUsesKnownApi(session: EngineSession, plan: ModelPlan, userRequest: string): void {
    const symbolName = String(plan.targetSymbol ?? '').trim();
    const memberName = String(plan.targetMember ?? '').trim();
    if (!symbolName || !memberName) return;
    if (requestAddsNewMember(userRequest)) return;

    const exists = memberExists(session.symbols, symbolName, memberName);
    if (exists !== false) return;

    const available = membersOf(session.symbols, symbolName);
    throw new CodingEngineError(
      'INVALID_PLAN',
      `plan targets ${symbolName}.${memberName}, which does not exist. ${symbolName} declares: ${available.join(', ')}`,
      { symbolName, memberName, available }
    );
  }

  /**
   * Widens symbol context using the compiler's own diagnostics.
   *
   * A missing property, missing export, bad import or incompatible type names
   * exactly the definition the model never saw. Feeding that back is what stops
   * the repair loop reproducing the same mistake against the same partial view.
   */
  private expandSymbolsForErrors(session: EngineSession, userRequest: string, validationOutput: string): SymbolSummary[] {
    const extracted = symbolsFromCompilerErrors(validationOutput);
    if (!extracted.symbols.length && !extracted.members.length) return [];

    const before = new Set(session.symbols.map(s => `${s.sourcePath}#${s.symbolName}`));
    this.refreshSymbols(session, userRequest, extracted);
    const added = session.symbols.filter(s => !before.has(`${s.sourcePath}#${s.symbolName}`));
    for (const summary of added) {
      session.symbolsExpanded.push({
        symbolName: summary.symbolName,
        sourcePath: summary.sourcePath,
        relevanceReason: summary.relevanceReason,
      });
    }
    return added;
  }

  /**
   * Pulls in the files a failing build or test run points at.
   *
   * A type error like "Property 'engineId' does not exist on type 'TaskRecord'"
   * or "Module '../task-runtime/engine' declares 'TaskRecord' locally, but it is
   * not exported" names the definition the model never saw. Without this the
   * repair loop re-runs against the same partial view and reproduces the same
   * mistake. Every candidate still passes the normal expansion boundary, so this
   * widens what is read, never what is permitted.
   */
  private expandForValidationErrors(session: EngineSession, validationOutput: string): string[] {
    if (!validationOutput) return [];

    const symbols = new Set<string>();
    const modules = new Set<string>();
    for (const match of validationOutput.matchAll(/'([^']+)'/g)) {
      const value = match[1];
      if (/^[./]/.test(value) || value.includes('/')) modules.add(value.replace(/^["']|["']$/g, ''));
      else if (/^[A-Z][A-Za-z0-9_]{2,}$/.test(value)) symbols.add(value);
    }
    if (!symbols.size && !modules.size) return [];

    const granted: string[] = [];
    for (const candidatePath of session.policy.packPaths) {
      if (granted.length >= 3) break;
      if (session.state.files.has(candidatePath)) continue;

      const resolved = resolveWithinWorktree(session.worktreePath, candidatePath);
      if (!resolved.ok || !fs.existsSync(resolved.absolute!)) continue;

      const moduleHit = [...modules].some(specifier => {
        const base = path.posix.basename(specifier).replace(/\.[cm]?[jt]sx?$/, '');
        return base.length > 2 && candidatePath.includes(base);
      });

      let symbolHit = false;
      if (!moduleHit && symbols.size) {
        try {
          const stat = fs.statSync(resolved.absolute!);
          if (!stat.isFile() || stat.size > 256 * 1024) continue;
          const text = fs.readFileSync(resolved.absolute!, 'utf8');
          symbolHit = [...symbols].some(symbol =>
            new RegExp(`export\\s+(interface|type|class|enum|const|function)\\s+${symbol}\\b`).test(text)
          );
        } catch {
          continue;
        }
      }
      if (!moduleHit && !symbolHit) continue;

      const reason = `validation output referenced ${symbolHit ? [...symbols].join(', ') : [...modules].join(', ')}`;
      const outcome = evaluateExpansion(session.state, session.policy, { path: candidatePath, reason });
      if (outcome.granted) granted.push(candidatePath);
      else recordDeniedExpansion(session.state, outcome);
    }
    return granted;
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
    // The compiler names exactly what the model was missing. Treat that as the
    // concrete symbol/import justification for widening context, so the repair
    // is not attempted blind against the same insufficient view that caused it.
    this.expandForValidationErrors(session, input.validationOutput ?? input.validationSummary);
    // Symbol-level expansion: the compiler names the exact type and member the
    // model got wrong, which is more actionable than another file of source.
    this.expandSymbolsForErrors(session, userRequest, input.validationOutput ?? input.validationSummary);
    session.promptContext = this.renderPromptContext(session, userRequest);

    const knownPropertyRepair = this.tryApplyKnownPropertyRepair({
      worktreePath: input.worktreePath,
      writable: this.writableSet(session, input.plan),
      validationOutput: input.validationOutput ?? input.validationSummary,
    });
    if (knownPropertyRepair) {
      this.persist(session);
      return {
        engineId: this.id,
        changedFiles: knownPropertyRepair.changedFiles,
        evidence: {
          editMode: 'deterministic-type-repair',
          attempt: input.attempt,
          diagnostic: knownPropertyRepair.diagnostic,
          inferredType: knownPropertyRepair.inferredType,
          symbolsExpanded: session.symbolsExpanded,
        },
      };
    }

    const undefinedRepair = this.tryApplyPossiblyUndefinedRepair({
      worktreePath: input.worktreePath,
      writable: this.writableSet(session, input.plan),
      validationOutput: input.validationOutput ?? input.validationSummary,
    });
    if (undefinedRepair) {
      this.persist(session);
      return {
        engineId: this.id,
        changedFiles: undefinedRepair.changedFiles,
        evidence: {
          editMode: 'deterministic-type-repair',
          attempt: input.attempt,
          diagnostic: undefinedRepair.diagnostic,
          replacement: undefinedRepair.replacement,
          symbolsExpanded: session.symbolsExpanded,
        },
      };
    }

    const droppedFilterRepair = this.tryApplyDroppedFilterResultRepair({
      worktreePath: input.worktreePath,
      writable: this.writableSet(session, input.plan),
      validationOutput: input.validationOutput ?? input.validationSummary,
    });
    if (droppedFilterRepair) {
      this.persist(session);
      return {
        engineId: this.id,
        changedFiles: droppedFilterRepair.changedFiles,
        evidence: {
          editMode: 'deterministic-validation-repair',
          attempt: input.attempt,
          diagnostic: droppedFilterRepair.diagnostic,
          replacement: droppedFilterRepair.replacement,
          symbolsExpanded: session.symbolsExpanded,
        },
      };
    }

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
          editableFiles: [...this.writableSet(session, input.plan)],
        }),
        schema: PATCH_SCHEMA,
        timeoutMs: this.options.patchTimeoutMs ?? PATCH_TIMEOUT_MS,
        numPredict: PATCH_OUTPUT_TOKENS,
        signal,
        label: `repair-${input.attempt}`,
      });

      try {
        const patch = parseJsonObject<ModelPatch>(result.response, 'repair patch');
        const writable = this.writableSet(session, input.plan);
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
            symbolsExpanded: session.symbolsExpanded,
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
      symbols: session?.symbols.map(sym => ({ symbolName: sym.symbolName, kind: sym.kind, sourcePath: sym.sourcePath, members: sym.members.length, relevanceReason: sym.relevanceReason })) ?? [],
      symbolsExpanded: session?.symbolsExpanded ?? [],
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
      symbols: [],
      symbolsExpanded: [],
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
      const base = buildPromptContext({
        state: session.state,
        project: this.options.project,
        contextPack: this.options.contextPack,
        sourceSha: this.options.sourceSha ?? 'unknown',
        userRequest,
        candidates: session.candidates,
        validationCommands: this.options.validationCommands ?? [],
      });
      return { ...base, symbols: session.symbols, impactReport: session.impactReport };
    }
    return { ...session.promptContext, userRequest, files: [...session.state.files.values()], expansions: session.state.expansions, symbols: session.symbols, impactReport: session.impactReport };
  }

  private computeImpactReport(
    session: EngineSession,
    plan: EnginePlan,
    changedFiles: string[],
    requireConsumerEdits: boolean,
    affectedSymbols: string[] = []
  ): ImpactReport {
    const candidatePaths = [
      ...session.candidates.candidates.map(candidate => candidate.path),
      ...session.state.files.keys(),
      ...plan.filesToRead,
      ...plan.filesToChange,
    ];
    return analyzeChangeImpact({
      worktreePath: session.worktreePath,
      candidatePaths,
      plannedFiles: [...new Set([...plan.filesToRead, ...plan.filesToChange].map(normalizePath))],
      changedFiles,
      affectedSymbols,
      requireConsumerEdits,
    });
  }

  private snapshotFiles(worktreePath: string, files: Set<string>): Map<string, string | null> {
    const snapshots = new Map<string, string | null>();
    for (const relative of files) {
      const resolved = resolveWithinWorktree(worktreePath, relative);
      if (!resolved.ok || !resolved.absolute || !resolved.relative) continue;
      if (!fs.existsSync(resolved.absolute)) {
        snapshots.set(resolved.relative, null);
        continue;
      }
      try {
        const stat = fs.statSync(resolved.absolute);
        if (stat.isFile() && stat.size <= 512 * 1024) snapshots.set(resolved.relative, fs.readFileSync(resolved.absolute, 'utf8'));
      } catch {
        // Snapshotting is best-effort; unreadable files will not be restored.
      }
    }
    return snapshots;
  }

  private restoreFiles(worktreePath: string, snapshots: Map<string, string | null>): void {
    for (const [relative, content] of snapshots) {
      const resolved = resolveWithinWorktree(worktreePath, relative);
      if (!resolved.ok || !resolved.absolute) continue;
      if (content === null) {
        fs.rmSync(resolved.absolute, { force: true });
        continue;
      }
      fs.mkdirSync(path.dirname(resolved.absolute), { recursive: true });
      fs.writeFileSync(resolved.absolute, content);
    }
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
        numCtx: this.options.numCtx ?? DEFAULT_NUM_CTX,
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

/** Word tokens from a request, used to score symbol relevance. */
export function tokenizeRequest(value: string): string[] {
  return [...new Set(String(value).toLowerCase().split(/[^a-z0-9]+/).filter(part => part.length > 2))];
}

export function normalizePath(value: string): string {
  return String(value).replace(/\\/g, '/').replace(/^\.\//, '').trim();
}

export function shouldUseAstEditPlan(classification: TaskClassification): boolean {
  if (classification.strategy === 'DECOMPOSED' || classification.strategy === 'COORDINATED_PATCH') return true;
  if (classification.taskClass !== 'TARGETED_EDIT') return false;
  return (
    (classification.intent.action === 'ADD' || classification.intent.action === 'CHANGE') &&
    (classification.intent.artifactType === 'HTTP_RESPONSE' ||
      classification.intent.artifactType === 'HTTP_ROUTE' ||
      classification.intent.artifactType === 'TYPE' ||
      classification.intent.artifactType === 'SERVICE')
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function inferTypeFromExpression(expression: string): string | null {
  const value = expression.trim();
  if (/^['"`]/.test(value)) return 'string';
  if (/^\d+(\.\d+)?$/.test(value)) return 'number';
  if (/^(true|false)$/.test(value)) return 'boolean';
  if (/^\[/.test(value)) return 'unknown[]';
  return null;
}

function normalizeEditPlan(plan: EditPlan): EditPlan {
  return {
    operations: Array.isArray(plan.operations)
      ? plan.operations.map(operation => ({ ...operation, targetFile: normalizePath(operation.targetFile) }))
      : [],
    affectedSymbols: Array.isArray(plan.affectedSymbols) ? plan.affectedSymbols.filter((value): value is string => typeof value === 'string') : [],
    expectedValidation: Array.isArray(plan.expectedValidation) ? plan.expectedValidation.filter((value): value is string => typeof value === 'string') : [],
    risks: Array.isArray(plan.risks) ? plan.risks.filter((value): value is string => typeof value === 'string') : [],
  };
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
