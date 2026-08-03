/**
 * Prompt construction for the Phase 4 engine.
 *
 * These are deliberately terse and example-led. 7-14B local models follow a
 * short prompt with one worked example far more reliably than a long list of
 * prose rules, and every extra token of instruction competes with source code
 * for a context budget that is already tight at 32k.
 *
 * Nothing here is task-specific: the prompts describe the *format* of a reply,
 * never the content of any particular fixture or repository.
 */

import type { CandidateFile } from '../types';
import type { ContextExpansionOutcome, ModelPlan } from './types';

export interface RepoSnapshotFile {
  path: string;
  content: string;
  truncated: boolean;
}

export interface PromptContext {
  userRequest: string;
  projectSummary: string;
  mapVersion: string;
  sourceSha: string;
  constraints: string[];
  validationCommands: string[];
  candidates: CandidateFile[];
  files: RepoSnapshotFile[];
  expansions?: ContextExpansionOutcome[];
}

const SHARED_RULES = [
  'The files you are shown are candidates for reading, not targets to be edited. Edit only what the task requires.',
  'Work only on the files provided. Never invent a path that is not listed.',
  'Do not add dependencies, run migrations, or introduce new commands.',
  'Do not weaken, skip, or delete tests to make validation pass.',
  // Without this, a model handed a failing test frequently "helps" by pasting a
  // copy of that test back into the spec file. Validation then passes and the
  // reviewer correctly rejects the diff as adding nothing.
  'Do not add, duplicate, or rewrite tests unless the task explicitly asks for new test coverage.',
  'If a test already exists and is failing, change the source code so it passes. Leave the test file alone.',
  'Do not embed secrets, API keys, or credentials.',
].join('\n');

export function renderFileBlock(files: RepoSnapshotFile[]): string {
  if (!files.length) return '(no files supplied)';
  return files
    .map(file => {
      const marker = file.truncated ? ' (truncated)' : '';
      return `--- FILE: ${file.path}${marker} ---\n${file.content}\n--- END ${file.path} ---`;
    })
    .join('\n\n');
}

function renderCandidateList(candidates: CandidateFile[]): string {
  if (!candidates.length) return '(none)';
  return candidates
    .map((c, i) => `${i + 1}. ${c.path} (confidence ${c.confidence.toFixed(2)}) — ${c.reason}`)
    .join('\n');
}

function renderHeader(ctx: PromptContext): string {
  const lines = [
    `TASK: ${ctx.userRequest}`,
    '',
    `PROJECT: ${ctx.projectSummary}`,
    `MAP VERSION: ${ctx.mapVersion}`,
    `SOURCE SHA: ${ctx.sourceSha}`,
  ];
  if (ctx.constraints.length) lines.push('', 'CONSTRAINTS:', ...ctx.constraints.map(c => `- ${c}`));
  if (ctx.validationCommands.length) {
    lines.push('', `VALIDATION THAT MUST PASS: ${ctx.validationCommands.join(', ')}`);
  }
  if (ctx.expansions?.length) {
    lines.push('', 'CONTEXT EXPANSIONS:');
    for (const expansion of ctx.expansions) {
      lines.push(`- ${expansion.path}: ${expansion.granted ? 'granted' : `denied (${expansion.denialReason})`}`);
    }
  }
  return lines.join('\n');
}

export const PLAN_SYSTEM = `You are a precise software engineer working inside an isolated git worktree.
You produce implementation plans as strict JSON. You never guess file paths.
${SHARED_RULES}`;

export function buildPlanPrompt(ctx: PromptContext): string {
  return `${renderHeader(ctx)}

RANKED CANDIDATE FILES:
${renderCandidateList(ctx.candidates)}

FILE CONTENTS:
${renderFileBlock(ctx.files)}

Produce a JSON implementation plan with this shape:
{
  "summary": "one sentence describing the change",
  "filesToRead": ["path/actually/needed.ts"],
  "filesToChange": ["path/you/will/edit.ts"],
  "steps": ["ordered, concrete steps"],
  "confidence": 0.0
}

Rules for filesToChange:
- every entry MUST be copied exactly from the candidate list above
- list only files you will actually edit
- if the task cannot be done with these files, return an empty filesToChange and say why in summary

Reply with JSON only.`;
}

export const EXPANSION_SYSTEM = `You decide whether the supplied files are sufficient to implement a task.
You are conservative: you only ask for a file when its absence blocks the work.
${SHARED_RULES}`;

export function buildExpansionPrompt(ctx: PromptContext, availablePaths: string[]): string {
  return `${renderHeader(ctx)}

FILES YOU ALREADY HAVE:
${ctx.files.map(f => `- ${f.path}`).join('\n') || '(none)'}

OTHER PATHS THAT EXIST IN THIS PROJECT:
${availablePaths.slice(0, 200).map(p => `- ${p}`).join('\n') || '(none)'}

Decide whether you need more files. Reply with JSON only:
{
  "needMoreContext": false,
  "requests": [{ "path": "exact/path/from/the/list.ts", "reason": "why this file is required" }]
}

Ask for at most 5 files, and only from the list above.`;
}

export const PATCH_SYSTEM = `You are a precise software engineer producing minimal, correct code edits as strict JSON.
You use exact anchored search/replace edits. The search text must be copied character-for-character from the file.
${SHARED_RULES}`;

export function buildPatchPrompt(
  ctx: PromptContext,
  plan: ModelPlan,
  editableFiles: string[] = plan.filesToChange,
  previousError?: string
): string {
  return `${renderHeader(ctx)}
${previousError ? `\nYOUR PREVIOUS EDIT WAS REJECTED: ${previousError}\nThe "search" text must be copied character-for-character from the file below. Do not retype it from memory.\n` : ''}

APPROVED PLAN:
${plan.summary}
${plan.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

FILES YOU PLANNED TO CHANGE: ${plan.filesToChange.join(', ') || '(none)'}

FILES YOU ARE ALLOWED TO EDIT (any write outside this list is rejected):
${editableFiles.map(file => `- ${file}`).join('\n') || '(none)'}

FILE CONTENTS:
${renderFileBlock(ctx.files)}

Produce the edits as JSON:
{
  "summary": "what you changed",
  "edits": [
    { "path": "src/example.ts", "op": "replace", "search": "exact existing text", "replace": "new text" },
    { "path": "src/new-file.ts", "op": "create", "content": "full file body" }
  ]
}

Critical rules for "search":
- copy it EXACTLY from the file above, including indentation
- it must appear EXACTLY ONCE in that file; include surrounding lines if needed to make it unique
- do not use "..." or placeholders
- keep each search block small (3-15 lines)

Reply with JSON only.`;
}

export const REPAIR_SYSTEM = `You are debugging a failed validation run inside an isolated worktree.
You make the smallest correct change that fixes the reported failure.
${SHARED_RULES}`;

export function buildRepairPrompt(input: {
  ctx: PromptContext;
  attempt: number;
  failureSummary: string;
  validationOutput: string;
  previousError?: string;
  editableFiles?: string[];
}): string {
  const { ctx, attempt, failureSummary, validationOutput, previousError, editableFiles } = input;
  return `${renderHeader(ctx)}

REPAIR ATTEMPT ${attempt}.
${editableFiles?.length ? `\nFILES YOU ARE ALLOWED TO EDIT (any write outside this list is rejected):\n${editableFiles.map(f => `- ${f}`).join('\n')}\n` : ''}
WHAT FAILED: ${failureSummary}

VALIDATION OUTPUT:
${validationOutput.slice(0, 6000)}
${previousError ? `\nYOUR PREVIOUS EDIT WAS REJECTED: ${previousError}\nDo not repeat it.\n` : ''}
CURRENT FILE CONTENTS (already includes your earlier changes):
${renderFileBlock(ctx.files)}

Diagnose the failure and return corrective edits in the same JSON format:
{
  "summary": "what you fixed and why",
  "edits": [{ "path": "...", "op": "replace", "search": "exact existing text", "replace": "new text" }]
}

Fix the real cause. Do not delete or weaken tests. Reply with JSON only.`;
}

export const REVIEW_SYSTEM = `You are an independent code reviewer. You did not write this change.
You are skeptical and specific. You approve only changes that are correct, in scope, and safe.
You never approve a change that disables tests or embeds a secret.`;

export function buildReviewPrompt(input: {
  userRequest: string;
  diff: string;
  changedFiles: string[];
  allowedFiles: string[];
  validationSummary: string;
}): string {
  return `A coding agent produced the following change. Review it independently.

ORIGINAL TASK: ${input.userRequest}

FILES THE AGENT WAS ALLOWED TO TOUCH:
${input.allowedFiles.map(f => `- ${f}`).join('\n') || '(none)'}

FILES ACTUALLY CHANGED:
${input.changedFiles.map(f => `- ${f}`).join('\n') || '(none)'}

VALIDATION RESULT: ${input.validationSummary}

DIFF:
${input.diff.slice(0, 20000)}

Check specifically for:
1. Does the change actually accomplish the task?
2. Does it edit anything outside the allowed files?
3. Are tests disabled, deleted, skipped, or trivially weakened?
4. Any hardcoded secret, credential, or token?
5. Unrelated or gratuitous edits?
6. Missing error handling on a new code path?
7. Suspicious code: shell execution, network calls, filesystem access outside the project?

Reply with JSON only:
{ "status": "PASS", "findings": ["specific issue, or empty if none"], "reasoning": "one or two sentences" }

Use FAIL if any check above is violated.`;
}
