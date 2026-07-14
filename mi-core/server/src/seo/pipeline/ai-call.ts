/**
 * Article pipeline — AI dispatch seam.
 *
 * Every pipeline step that needs AI output calls `callAiJob()` here instead
 * of importing `submitAiJob` from ai-router.ts directly. In production this
 * is a pure passthrough. In tests, `__setAiSubmitOverrideForTests()` swaps in
 * a fake so the pipeline test suite never depends on a live ChatGPT browser
 * session existing — per the task's hard constraint, the pipeline must never
 * actually call a live ChatGPT session successfully unless one is genuinely
 * logged in.
 */

import { submitAiJob, type AiProviderChoice } from '../ai-providers/ai-router';
import type { AIProviderRequest, AIProviderResult } from '../ai-providers/ai-provider';

export type AiSubmitFn = (req: AIProviderRequest, providerName?: AiProviderChoice) => Promise<AIProviderResult>;

let override: AiSubmitFn | null = null;

/** Test-only override. Pass `null` to restore the real submitAiJob. */
export function __setAiSubmitOverrideForTests(fn: AiSubmitFn | null): void {
  override = fn;
}

export function callAiJob(req: AIProviderRequest, providerName?: AiProviderChoice): Promise<AIProviderResult> {
  const fn = override ?? submitAiJob;
  return fn(req, providerName);
}
