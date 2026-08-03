/**
 * Independent review stage.
 *
 * Two layers, both of which must pass:
 *  1. deterministic checks that never depend on a model's judgement
 *     (conflict markers, secrets, out-of-scope edits, weakened tests)
 *  2. a second model invocation with a *fresh* context — it receives the diff
 *     and the original task, never the generation transcript, so it cannot
 *     inherit the author's reasoning or rationalise its own mistake.
 *
 * The review role is resolved separately from the generation role. When only one
 * model is installed the two collapse onto the same weights, which is recorded
 * honestly in the result rather than presented as independent review.
 */

import * as fs from 'fs';
import * as path from 'path';
import { git } from '../git';
import type { CodingModelRoles, ReviewResult, ValidationResult } from '../types';
import { generate } from './ollama-client';
import { buildReviewPrompt, REVIEW_SYSTEM } from './prompts';
import { parseJsonObject } from './engine';
import { REVIEW_SCHEMA } from './types';

const SECRET_PATTERN = /(api[_-]?key|token|secret|password|passwd|bearer)\s*[:=]\s*['"]?[A-Za-z0-9_\-.]{16,}/i;
const PRIVATE_KEY_PATTERN = /-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/;
const SUSPICIOUS_PATTERN =
  /\b(child_process|execSync|exec\(|spawnSync|eval\(|new Function\(|require\(['"]net['"]\)|fetch\(['"]https?:\/\/(?!127\.0\.0\.1|localhost))/;
const TEST_WEAKENING_PATTERN = /(\.skip\(|\.only\(|\bxit\(|\bxdescribe\(|assert\.ok\(true\)|expect\(true\)\.toBe\(true\))/;

export interface IndependentReviewResult extends ReviewResult {
  deterministicFindings: string[];
  modelFindings: string[];
  modelStatus: 'PASS' | 'FAIL' | 'UNAVAILABLE';
  reviewModel: string | null;
  /** False when the review model is the same weights as the generation model. */
  independentModel: boolean;
  reasoning: string | null;
}

export interface ReviewInput {
  worktreePath: string;
  userRequest: string;
  validation: ValidationResult[];
  allowedFiles: string[];
  modelRoles: CodingModelRoles;
  signal?: AbortSignal;
}

function isTestPath(relative: string): boolean {
  return /(^|\/)(tests?|spec|__tests__|t)\//.test(relative) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(relative);
}

/** Checks that hold regardless of what any model thinks. */
export async function deterministicReview(input: {
  worktreePath: string;
  validation: ValidationResult[];
  allowedFiles: string[];
}): Promise<{ findings: string[]; changedFiles: string[]; diff: string }> {
  const findings: string[] = [];

  for (const result of input.validation) {
    if (result.configured && result.exitCode !== 0) findings.push(`validation failed: ${result.name}`);
    if (result.timedOut) findings.push(`validation timed out: ${result.name}`);
  }

  const changedFiles = (await git(input.worktreePath, ['diff', '--name-only', 'HEAD']))
    .split(/\r?\n/)
    .filter(Boolean)
    .map(f => f.replace(/\\/g, '/'));

  if (!changedFiles.length) findings.push('no source changes detected');

  const allowed = new Set(input.allowedFiles.map(f => f.replace(/\\/g, '/')));
  for (const file of changedFiles) {
    if (allowed.size && !allowed.has(file)) findings.push(`edit outside the approved plan: ${file}`);
  }

  for (const file of changedFiles) {
    const absolute = path.join(input.worktreePath, file);
    if (!fs.existsSync(absolute) || fs.statSync(absolute).isDirectory()) continue;
    const text = fs.readFileSync(absolute, 'utf8');

    if (text.includes('<<<<<<<') || text.includes('>>>>>>>')) findings.push(`conflict marker found in ${file}`);
    if (SECRET_PATTERN.test(text)) findings.push(`possible secret literal found in ${file}`);
    if (PRIVATE_KEY_PATTERN.test(text)) findings.push(`private key material found in ${file}`);
    if (SUSPICIOUS_PATTERN.test(text)) findings.push(`suspicious runtime capability introduced in ${file}`);
  }

  // Tests must not have been softened to make validation green.
  for (const file of changedFiles.filter(isTestPath)) {
    const before = await git(input.worktreePath, ['show', `HEAD:${file}`]).catch(() => '');
    const absolute = path.join(input.worktreePath, file);
    const after = fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : '';
    if (before && after.length < before.length * 0.85) findings.push(`test file materially shrank: ${file}`);
    if (TEST_WEAKENING_PATTERN.test(after) && !TEST_WEAKENING_PATTERN.test(before)) {
      findings.push(`test weakened with skip/no-op assertion: ${file}`);
    }
  }

  const diff = await git(input.worktreePath, ['diff', 'HEAD'], 60_000).catch(() => '');
  return { findings, changedFiles, diff };
}

export async function reviewIndependently(input: ReviewInput): Promise<IndependentReviewResult> {
  const deterministic = await deterministicReview({
    worktreePath: input.worktreePath,
    validation: input.validation,
    allowedFiles: input.allowedFiles,
  });

  const reviewModel = input.modelRoles.coding_review ?? input.modelRoles.coding_primary;
  const independentModel = Boolean(
    reviewModel && input.modelRoles.coding_primary && reviewModel !== input.modelRoles.coding_primary
  );

  let modelStatus: 'PASS' | 'FAIL' | 'UNAVAILABLE' = 'UNAVAILABLE';
  let modelFindings: string[] = [];
  let reasoning: string | null = null;

  if (reviewModel && deterministic.diff.trim()) {
    try {
      const result = await generate({
        model: reviewModel,
        system: REVIEW_SYSTEM,
        prompt: buildReviewPrompt({
          userRequest: input.userRequest,
          diff: deterministic.diff,
          changedFiles: deterministic.changedFiles,
          allowedFiles: input.allowedFiles,
          validationSummary: summarizeValidation(input.validation),
        }),
        format: REVIEW_SCHEMA as unknown as Record<string, unknown>,
        temperature: 0,
        numPredict: 800,
        timeoutMs: 240_000,
        signal: input.signal,
        think: false,
      });
      const parsed = parseJsonObject<{ status?: string; findings?: unknown; reasoning?: string }>(
        result.response,
        'review'
      );
      modelStatus = parsed.status === 'FAIL' ? 'FAIL' : 'PASS';
      modelFindings = Array.isArray(parsed.findings)
        ? parsed.findings.filter((f): f is string => typeof f === 'string' && f.trim() !== '')
        : [];
      reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning : null;
    } catch (err) {
      modelStatus = 'UNAVAILABLE';
      modelFindings = [`review model unavailable: ${err instanceof Error ? err.message : String(err)}`];
    }
  }

  // Deterministic findings are blocking. A model FAIL is blocking too, but a
  // model that could not be reached does not silently approve the change.
  const blocking = [
    ...deterministic.findings,
    ...(modelStatus === 'FAIL' ? modelFindings.map(f => `review model: ${f}`) : []),
    ...(modelStatus === 'UNAVAILABLE' ? ['independent model review could not be completed'] : []),
  ];

  return {
    status: blocking.length ? 'FAIL' : 'PASS',
    findings: blocking,
    deterministicFindings: deterministic.findings,
    modelFindings,
    modelStatus,
    reviewModel: reviewModel ?? null,
    independentModel,
    reasoning,
  };
}

function summarizeValidation(validation: ValidationResult[]): string {
  if (!validation.length) return 'no validation configured';
  return validation
    .map(v => `${v.name}=${!v.configured ? 'not-configured' : v.exitCode === 0 ? 'pass' : 'fail'}`)
    .join(', ');
}
