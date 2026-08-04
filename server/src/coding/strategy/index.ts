/**
 * Per-class execution strategy: prompts, patch bounds and failure memory.
 *
 * The unifying idea is that the *unit of generation* should match the task. A
 * type error is a two-line correction anchored to a compiler diagnostic; a
 * behaviour-preserving refactor is a sequence of small transformations. Asking
 * for both as one unconstrained patch is what produced patches that did not fix
 * the diagnostic, and rewrites that overran the output budget.
 */

import type { AppliedEdit, ModelPatch } from '../llm/types';
import type { DiagnosticRepairContext } from './diagnostics';
import { renderDiagnosticContext } from './diagnostics';
import type { TaskClassification } from './task-class';

export * from './task-class';
export * from './diagnostics';

// ── Patch bounds ────────────────────────────────────────────────────────────

export interface PatchBoundsResult {
  ok: boolean;
  violations: string[];
  changedLines: number;
  filesTouched: number;
}

/**
 * Enforces the per-class edit budget. A whole-file replacement is refused
 * outright: when the model reaches for one it has stopped making a change and
 * started rewriting, which is where truncation and behaviour drift come from.
 */
export function checkPatchBounds(patch: ModelPatch, classification: TaskClassification): PatchBoundsResult {
  const violations: string[] = [];
  let changedLines = 0;
  const files = new Set<string>();

  for (const edit of patch.edits ?? []) {
    files.add(edit.path);
    if (edit.op === 'create' && (edit.content ?? edit.replace ?? '').split('\n').length > classification.maxChangedLines) {
      violations.push(`whole-file write to ${edit.path} exceeds the ${classification.maxChangedLines}-line budget for ${classification.taskClass}`);
    }
    const before = (edit.search ?? '').split('\n').length;
    const after = (edit.replace ?? edit.content ?? '').split('\n').length;
    changedLines += Math.max(before, after);
  }

  if (changedLines > classification.maxChangedLines) {
    violations.push(`patch changes ~${changedLines} lines, over the ${classification.maxChangedLines}-line budget for ${classification.taskClass}`);
  }
  if (files.size > classification.maxFunctionsPerPatch + 2) {
    violations.push(`patch touches ${files.size} files, more than this task class expects`);
  }

  return { ok: violations.length === 0, violations, changedLines, filesTouched: files.size };
}

/** New text a patch introduces, for suppression and secret checks. */
export function addedTextOf(patch: ModelPatch): string {
  return (patch.edits ?? []).map(edit => edit.replace ?? edit.content ?? '').join('\n');
}

// ── Failure memory ──────────────────────────────────────────────────────────

export type FailurePattern =
  | 'OUTPUT_TRUNCATED'
  | 'PATCH_TOO_BROAD'
  | 'DIAGNOSTIC_UNCHANGED'
  | 'DUPLICATE_TEST_ADDED'
  | 'INVENTED_MEMBER'
  | 'WHOLE_FUNCTION_REWRITE'
  | 'ANCHOR_NOT_FOUND'
  | 'SUPPRESSED_DIAGNOSTIC';

export interface FailureNote {
  pattern: FailurePattern;
  taskClass: string;
  detail: string;
}

/**
 * Per-task failure memory.
 *
 * Scoped to a single task deliberately: a fixture-specific failure must not
 * bias an unrelated project, and nothing here stores model reasoning — only the
 * shape of what went wrong, as a constraint for the next attempt.
 */
export class FailureMemory {
  private notes: FailureNote[] = [];

  record(pattern: FailurePattern, taskClass: string, detail: string): void {
    if (this.notes.some(note => note.pattern === pattern && note.detail === detail)) return;
    this.notes.push({ pattern, taskClass, detail: detail.slice(0, 200) });
  }

  get all(): FailureNote[] {
    return [...this.notes];
  }

  has(pattern: FailurePattern): boolean {
    return this.notes.some(note => note.pattern === pattern);
  }

  /** Constraints to add to the next prompt, derived from what already failed. */
  renderConstraints(): string {
    if (!this.notes.length) return '';
    const lines = new Set<string>();
    for (const note of this.notes) {
      switch (note.pattern) {
        case 'OUTPUT_TRUNCATED':
        case 'WHOLE_FUNCTION_REWRITE':
          lines.add('Your last attempt was too long to finish. Make ONE small edit, not a rewrite.');
          break;
        case 'PATCH_TOO_BROAD':
          lines.add('Your last attempt changed too much. Change only the lines that must change.');
          break;
        case 'DIAGNOSTIC_UNCHANGED':
          lines.add('Your last attempt did not change the reported error. Address the exact diagnostic line.');
          break;
        case 'DUPLICATE_TEST_ADDED':
          lines.add('Your last attempt duplicated an existing test. Do not add tests.');
          break;
        case 'INVENTED_MEMBER':
          lines.add('Your last attempt used a member that does not exist. Use only members listed in the type definitions.');
          break;
        case 'ANCHOR_NOT_FOUND':
          lines.add('Your last search text did not match. Copy it character-for-character from the file.');
          break;
        case 'SUPPRESSED_DIAGNOSTIC':
          lines.add('Do not use any, as any, or ts-ignore. Fix the underlying type.');
          break;
      }
    }
    return `\nCONSTRAINTS FROM YOUR PREVIOUS ATTEMPTS:\n${[...lines].map(line => `- ${line}`).join('\n')}\n`;
  }
}

/** Detects a rewrite masquerading as an edit. */
export function looksLikeWholeFunctionRewrite(applied: AppliedEdit[]): boolean {
  return applied.some(edit => edit.bytesBefore > 0 && edit.bytesAfter > edit.bytesBefore * 1.8);
}

// ── Prompts ─────────────────────────────────────────────────────────────────

export const TYPE_REPAIR_SYSTEM = `You fix TypeScript compilation errors with the smallest possible correction.
You address the exact diagnostic reported. You never silence an error.
You never use any, as any, as unknown as, or @ts-ignore.
You change only the expression or declaration the diagnostic points at.`;

export function buildTypeRepairPrompt(input: {
  userRequest: string;
  context: DiagnosticRepairContext;
  editableFiles: string[];
  constraints: string;
  previousError?: string;
}): string {
  return `TASK: ${input.userRequest}

The compiler reported the errors below. Fix each one with the smallest correct
change. Do not restructure code that compiles.

${renderDiagnosticContext(input.context)}

FILES YOU MAY EDIT:
${input.editableFiles.map(file => `- ${file}`).join('\n')}
${input.constraints}${input.previousError ? `\nYOUR PREVIOUS EDIT WAS REJECTED: ${input.previousError}\n` : ''}
Return JSON only:
{
  "summary": "which diagnostic each edit fixes",
  "edits": [
    { "path": "exact/path.ts", "op": "replace", "search": "exact existing text", "replace": "corrected text" }
  ]
}

Rules:
- one edit per diagnostic where possible
- "search" must be copied character-for-character from the CONTAINING CODE above,
  without the line-number prefix
- keep each edit under 10 lines
- fix the type, never suppress the error
- do not touch files that have no diagnostic`;
}

export const REFACTOR_PLAN_SYSTEM = `You plan behaviour-preserving refactors as a sequence of small, independently
valid steps. You never rewrite a whole function in one step. Each step must
leave the code compiling and the tests passing.`;

export function buildRefactorPlanPrompt(input: {
  userRequest: string;
  fileBlock: string;
  maxChangedLines: number;
}): string {
  return `TASK: ${input.userRequest}

CURRENT CODE:
${input.fileBlock}

Plan this refactor as a sequence of SMALL steps. Each step must:
- change at most ${input.maxChangedLines} lines
- leave the code compiling and every existing test passing
- be meaningful on its own

Return JSON only:
{
  "currentBehavior": "what the code does now, in one sentence",
  "invariants": ["observable behaviour that must not change"],
  "steps": [
    { "description": "what this step does", "rationale": "why it is safe" }
  ]
}

Order the steps so each one is safe to apply on its own. Prefer 2-4 steps.
Do not describe a step that rewrites the whole function.`;
}

export function buildRefactorStepPrompt(input: {
  userRequest: string;
  stepDescription: string;
  stepIndex: number;
  stepCount: number;
  invariants: string[];
  fileBlock: string;
  editableFiles: string[];
  constraints: string;
  maxChangedLines: number;
  previousError?: string;
}): string {
  return `TASK: ${input.userRequest}

This is refactor step ${input.stepIndex} of ${input.stepCount}.

STEP TO APPLY NOW: ${input.stepDescription}

Do only this step. Later steps will be applied separately.

INVARIANTS THAT MUST NOT CHANGE:
${input.invariants.map(invariant => `- ${invariant}`).join('\n') || '- all existing observable behaviour'}

CURRENT CODE (already includes earlier steps):
${input.fileBlock}

FILES YOU MAY EDIT:
${input.editableFiles.map(file => `- ${file}`).join('\n')}
${input.constraints}${input.previousError ? `\nYOUR PREVIOUS EDIT WAS REJECTED: ${input.previousError}\n` : ''}
Return JSON only:
{
  "summary": "what this step changed",
  "edits": [
    { "path": "exact/path.ts", "op": "replace", "search": "exact existing text", "replace": "new text" }
  ]
}

Rules:
- at most ${input.maxChangedLines} changed lines
- copy "search" character-for-character from the code above
- do not rewrite the whole function
- do not change any test`;
}

export const REFACTOR_PLAN_SCHEMA = {
  type: 'object',
  properties: {
    currentBehavior: { type: 'string' },
    invariants: { type: 'array', items: { type: 'string' } },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: { description: { type: 'string' }, rationale: { type: 'string' } },
        required: ['description'],
      },
    },
  },
  required: ['steps'],
} as const;

export interface RefactorPlan {
  currentBehavior?: string;
  invariants?: string[];
  steps: Array<{ description: string; rationale?: string }>;
}
