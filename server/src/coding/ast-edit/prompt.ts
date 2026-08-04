/**
 * EditPlan prompt.
 *
 * Source is rendered *with* line numbers here, which is the opposite of the
 * free-form patch prompt and deliberately so. The Phase 4.6 attempt failed
 * because it numbered the source and then asked the model to transcribe an
 * anchor "without the line-number prefix" — a transformation local models get
 * wrong. Here the model only ever *cites* a line number; it never copies the
 * numbered text back. Citing is what numbering is good for.
 */

import { OPERATION_CATALOGUE } from './index';

export const EDIT_PLAN_SYSTEM = `You are a precise software engineer. You do not write patches.
You choose structured edit operations, and the tooling performs them for you.
You never reproduce unchanged code. You never rewrite a whole function.
You explain why each operation is the right one.`;

export interface EditPlanPromptInput {
  userRequest: string;
  /** Files the plan may touch. */
  editableFiles: string[];
  /** Source rendered with 1-based line numbers. */
  numberedSource: string;
  constraints?: string;
  previousError?: string;
}

export function renderNumberedSource(files: Array<{ path: string; content: string }>): string {
  return files
    .map(file => {
      const body = file.content
        .split('\n')
        .map((line, index) => `${String(index + 1).padStart(4)} | ${line}`)
        .join('\n');
      return `--- FILE: ${file.path} ---\n${body}\n--- END ${file.path} ---`;
    })
    .join('\n\n');
}

export function buildEditPlanPrompt(input: EditPlanPromptInput): string {
  return `TASK: ${input.userRequest}

${OPERATION_CATALOGUE}

FILES YOU MAY EDIT:
${input.editableFiles.map(file => `- ${file}`).join('\n')}

SOURCE (line numbers are for reference only — never copy them):
${input.numberedSource}
${input.constraints ?? ''}${input.previousError ? `\nYOUR PREVIOUS PLAN WAS REJECTED: ${input.previousError}\n` : ''}
Return an EditPlan as JSON only:
{
  "operations": [
    {
      "operationType": "extract_function",
      "targetFile": "exact/path/from/the/list.ts",
      "targetSymbol": "nameOfTheFunctionYouAreExtractingFROM",
      "parameters": { "newFunctionName": "descriptiveName", "startLine": 12, "endLine": 18 },
      "reason": "why this extraction is correct and safe"
    }
  ],
  "affectedSymbols": ["names you touch"],
  "expectedValidation": ["what should pass afterwards"],
  "risks": ["what could go wrong"]
}

Rules:
- startLine and endLine must cover COMPLETE statements, and must not cover the
  whole function body
- never include the "NNN | " prefix in any parameter value
- prefer 1-3 operations; each should stand on its own
- do not change tests
- if no operation fits, return an empty operations array and say why in risks`;
}
