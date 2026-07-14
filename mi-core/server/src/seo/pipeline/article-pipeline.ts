/**
 * SEO Control Center — article generation pipeline state machine.
 *
 * Implements the exact status sequence from the pipeline spec:
 *   APPROVED_KEYWORD -> CANNIBALIZATION_CHECK -> VERIFIED_FACT_COLLECTION ->
 *   CONTENT_BRIEF -> OUTLINE -> CHATGPT_GENERATION -> OUTPUT_SCHEMA_VALIDATION ->
 *   AI_QA -> SEO_QA -> FACT_QA -> BRAND_QA -> LINK_QA -> PREVIEW_BUILD ->
 *   APPROVAL_REQUEST -> APPROVED -> SCHEDULED -> PREVIEW_PUBLISHED ->
 *   PREVIEW_VERIFIED -> PRODUCTION_READY
 * plus a distinct terminal BLOCKED state reached only via the QA repair-loop
 * cap (see below).
 *
 * `seo_content_items.status` is the single source of truth for "what status
 * is this content item at" — `advancePipeline(contentId)` always starts by
 * re-reading it from SQLite, never from any in-memory variable, which is
 * what makes it safe to call repeatedly / after a process restart (see
 * __pipeline_tests__/resume-after-restart.mjs).
 *
 * Three different "doesn't advance" behaviors are modeled, and it matters
 * which one a step hits:
 *   1. External wait (waiting_for_login / waiting_for_manual_paste at
 *      CHATGPT_GENERATION) — status stays put, does NOT count against the
 *      repair-loop cap. A later call (after the CEO logs in) just resumes.
 *   2. Hard, non-repairable blocker (CANNIBALIZATION_CHECK returning
 *      anything other than CREATE_NEW/UPDATE_EXISTING; APPROVAL_REQUEST
 *      pending/rejected; SCHEDULED not yet due) — status stays put
 *      indefinitely. These aren't content-quality problems a rewrite can
 *      fix, so they're never routed into the repair loop.
 *   3. Repairable QA/generation failure (CHATGPT_GENERATION malformed
 *      output, OUTPUT_SCHEMA_VALIDATION, AI_QA, SEO_QA, FACT_QA, BRAND_QA,
 *      LINK_QA) — routes back to CHATGPT_GENERATION for a rewrite pass, up
 *      to MAX_REPAIR_LOOPS (3) times. Exceeding that moves the item to the
 *      terminal BLOCKED status and escalates to the CEO via WhatsApp.
 */

import { getSeoDb, nowIso, seoId } from '../seo-db';
import { recordEvidence } from '../seo-evidence';
import { getKeywordById } from '../keywords/keyword-store';
import { normalizeKeyword, STOPWORDS } from '../keywords/keyword-normalizer';
import { detectCannibalization } from '../keywords/cannibalization-detector';
import { listFacts } from '../facts/fact-registry';
import { checkClaimsHardEnforcement, listForbiddenClaimInstructions } from '../facts/claim-guard';
import { generateContentBrief, type ContentBrief } from './content-brief';
import { callAiJob } from './ai-call';
import type { AIProviderResult } from '../ai-providers/ai-provider';
import { renderPromptTemplate } from '../ai-providers/prompt-loader';
import { getBrandById } from '../brand-config';
import { submitSeoAction } from '../seo-approval-bridge';
import { certify } from '../../gstack/qa-certification-engine';
import { queueToCeo } from '../../services/whatsapp-sender';
import { bakudanPublisher } from '../publishing/bakudan-publisher';
import { rawSushiPublisher } from '../publishing/raw-sushi-publisher';
import type { WebsitePublisher } from '../publishing/website-publisher';
import { getById as getApprovalAction } from '../../approval/gate';
import {
  ensurePipelineState,
  getPipelineState,
  updatePipelineState,
  incrementRepairLoop,
  resetRepairLoop,
  recordStepStart,
  recordStepEnd,
  getStepHistory,
} from './pipeline-store';

// ── Types ─────────────────────────────────────────────────────────────────

export const PIPELINE_STATUSES = [
  'APPROVED_KEYWORD', 'CANNIBALIZATION_CHECK', 'VERIFIED_FACT_COLLECTION', 'CONTENT_BRIEF',
  'OUTLINE', 'CHATGPT_GENERATION', 'OUTPUT_SCHEMA_VALIDATION', 'AI_QA', 'SEO_QA', 'FACT_QA',
  'BRAND_QA', 'LINK_QA', 'PREVIEW_BUILD', 'APPROVAL_REQUEST', 'APPROVED', 'SCHEDULED',
  'PREVIEW_PUBLISHED', 'PREVIEW_VERIFIED', 'PRODUCTION_READY',
] as const;

export type PipelineFlowStatus = typeof PIPELINE_STATUSES[number];
export type PipelineStatus = PipelineFlowStatus | 'BLOCKED';

export interface StepResult {
  ok: boolean;
  next_status: string;
  error?: string;
  blocked_reason?: string;
}

const MAX_REPAIR_LOOPS = 3;

// Steps whose failure is "fixable by rewriting the article" — these
// participate in the QA repair loop (route back to CHATGPT_GENERATION, cap
// at MAX_REPAIR_LOOPS, then BLOCKED). Everything else that returns ok:false
// simply stays parked at its current status.
const REPAIRABLE_STEPS = new Set<string>([
  'CHATGPT_GENERATION', 'OUTPUT_SCHEMA_VALIDATION', 'AI_QA', 'SEO_QA', 'FACT_QA', 'BRAND_QA', 'LINK_QA',
]);

// blocked_reason values that mean "external wait, not a failure" — never
// count against the repair loop, regardless of which step produced them.
const WAIT_BLOCKED_REASONS = new Set(['waiting_for_login', 'waiting_for_manual_paste']);

interface ContentItemRow {
  id: string;
  created_at: string;
  updated_at: string;
  brand_id: string;
  location_id: string | null;
  title: string | null;
  slug: string | null;
  primary_keyword_id: string | null;
  search_intent: string | null;
  article_type: string | null;
  status: string;
  quality_score: number | null;
  ai_provider: string | null;
  scheduled_publish_at: string | null;
  published_at: string | null;
  approval_id: string | null;
  current_version_id: string | null;
  deleted_at: string | null;
}

interface ArticleVersionRow {
  id: string;
  created_at: string;
  content_id: string;
  version_number: number;
  body: string | null;
  meta_title: string | null;
  meta_description: string | null;
  headings: string | null;
  faq: string | null;
  internal_links: string | null;
  external_links: string | null;
  cta: string | null;
  schema_json: string | null;
  hero_image_url: string | null;
  author: string | null;
  created_by_provider: string | null;
}

// ── Small DB helpers ─────────────────────────────────────────────────────

function getContentItem(contentId: string): ContentItemRow | undefined {
  return getSeoDb().prepare('SELECT * FROM seo_content_items WHERE id = ? AND deleted_at IS NULL').get(contentId) as ContentItemRow | undefined;
}

function setContentStatus(contentId: string, status: string): void {
  getSeoDb().prepare('UPDATE seo_content_items SET status = ?, updated_at = ? WHERE id = ?').run(status, nowIso(), contentId);
}

function getLatestVersion(contentId: string): ArticleVersionRow | undefined {
  return getSeoDb().prepare(
    'SELECT * FROM seo_article_versions WHERE content_id = ? ORDER BY version_number DESC LIMIT 1',
  ).get(contentId) as ArticleVersionRow | undefined;
}

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function containsCoreTokens(title: string, keyword: string): boolean {
  const norm = normalizeKeyword(title);
  const tokens = normalizeKeyword(keyword).split(/\s+/).filter(t => t && !STOPWORDS.has(t));
  if (tokens.length === 0) return true;
  return tokens.some(t => norm.includes(t));
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Minimal, honest Markdown -> HTML conversion: headings (#/##/###) and plain
 * paragraphs only. Not a full CommonMark renderer — this is a documented
 * simplification, sufficient for the well-formedness check the publishers'
 * createPreview() runs (balanced tags, non-empty content).
 */
function markdownToHtmlStub(md: string): string {
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const level = h[1].length + 1; // h1 reserved for the article title in <head>/<title>; body headings start at h2
      out.push(`<h${level}>${escapeHtml(h[2])}</h${level}>`);
      continue;
    }
    if (line.trim() === '') continue;
    out.push(`<p>${escapeHtml(line)}</p>`);
  }
  return out.join('\n');
}

function resolvePublisher(brandId: string): WebsitePublisher | null {
  if (brandId === 'bakudan') return bakudanPublisher;
  if (brandId === 'raw_sushi') return rawSushiPublisher;
  return null;
}

interface ParsedArticle {
  title: string;
  meta_title: string;
  meta_description: string;
  body_markdown: string;
  headings: Array<{ level: string; text: string }>;
  faq?: Array<{ question: string; answer: string }>;
  internal_links: Array<{ target_url: string; anchor_text: string }>;
  cta?: { type: string; text: string };
}

function tryParseJsonLoose(raw?: string): unknown | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (m) {
      try {
        return JSON.parse(m[1]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function isValidArticle(obj: unknown): obj is ParsedArticle {
  if (!obj || typeof obj !== 'object') return false;
  const a = obj as Record<string, unknown>;
  return (
    typeof a.title === 'string' && a.title.trim().length > 0 &&
    typeof a.body_markdown === 'string' && a.body_markdown.trim().length > 0 &&
    typeof a.meta_title === 'string' &&
    typeof a.meta_description === 'string' &&
    Array.isArray(a.headings) &&
    Array.isArray(a.internal_links)
  );
}

// ── Pipeline entry point ─────────────────────────────────────────────────

/** Creates a new seo_content_items row at APPROVED_KEYWORD for the given approved keyword. */
export function startPipeline(keywordId: string): { content_id: string } {
  const keyword = getKeywordById(keywordId);
  if (!keyword) throw new Error(`keyword_not_found: ${keywordId}`);

  const db = getSeoDb();
  const id = seoId('content');
  const now = nowIso();
  db.prepare(`
    INSERT INTO seo_content_items (
      id, created_at, updated_at, brand_id, location_id, title, slug, primary_keyword_id,
      search_intent, article_type, status, quality_score, ai_provider, scheduled_publish_at,
      published_at, approval_id, current_version_id, deleted_at
    ) VALUES (
      @id, @created_at, @updated_at, @brand_id, @location_id, NULL, NULL, @primary_keyword_id,
      @search_intent, 'blog', 'APPROVED_KEYWORD', NULL, NULL, NULL, NULL, NULL, NULL, NULL
    )
  `).run({
    id,
    created_at: now,
    updated_at: now,
    brand_id: keyword.brand_id,
    location_id: keyword.location_id,
    primary_keyword_id: keyword.id,
    search_intent: keyword.search_intent,
  });

  ensurePipelineState(id, keywordId);
  recordEvidence({
    brand_id: keyword.brand_id,
    category: 'seo_pipeline_started',
    summary: `Article pipeline started for keyword "${keyword.keyword}" (content ${id})`,
    payload: { content_id: id, keyword_id: keywordId },
  });

  return { content_id: id };
}

// ── Step implementations ─────────────────────────────────────────────────

async function runStep_APPROVED_KEYWORD(item: ContentItemRow): Promise<StepResult> {
  if (!item.primary_keyword_id) return { ok: false, next_status: 'APPROVED_KEYWORD', error: 'no primary_keyword_id set on content item' };
  const keyword = getKeywordById(item.primary_keyword_id);
  if (!keyword) return { ok: false, next_status: 'APPROVED_KEYWORD', error: `keyword_not_found: ${item.primary_keyword_id}` };
  return { ok: true, next_status: 'CANNIBALIZATION_CHECK' };
}

async function runStep_CANNIBALIZATION_CHECK(item: ContentItemRow): Promise<StepResult> {
  const keyword = item.primary_keyword_id ? getKeywordById(item.primary_keyword_id) : undefined;
  if (!keyword) return { ok: false, next_status: 'CANNIBALIZATION_CHECK', error: 'keyword_not_found' };

  const result = detectCannibalization({
    brand_id: item.brand_id,
    keyword: keyword.keyword,
    intent: keyword.search_intent ?? undefined,
    location_id: keyword.location_id,
    exclude_keyword_id: keyword.id,
  });

  if (result.decision === 'CREATE_NEW' || result.decision === 'UPDATE_EXISTING') {
    return { ok: true, next_status: 'VERIFIED_FACT_COLLECTION' };
  }

  // Hard blocker — never advances to CHATGPT_GENERATION until a human
  // resolves the conflict (merges keywords, changes intent/location, etc).
  return {
    ok: false,
    next_status: 'CANNIBALIZATION_CHECK',
    blocked_reason: `cannibalization_${result.decision}: ${result.reason}`,
  };
}

async function runStep_VERIFIED_FACT_COLLECTION(item: ContentItemRow): Promise<StepResult> {
  const facts = listFacts(item.brand_id, {
    status: 'VERIFIED',
    ...(item.location_id ? { locationId: item.location_id } : {}),
  });

  recordEvidence({
    brand_id: item.brand_id,
    category: 'seo_pipeline_fact_collection',
    summary: `${facts.length} VERIFIED fact(s) collected for content ${item.id}`,
    payload: { content_id: item.id, fact_count: facts.length, fact_ids: facts.map(f => f.id) },
  });

  return { ok: true, next_status: 'CONTENT_BRIEF' };
}

async function runStep_CONTENT_BRIEF(item: ContentItemRow): Promise<StepResult> {
  if (!item.primary_keyword_id) return { ok: false, next_status: 'CONTENT_BRIEF', error: 'no primary_keyword_id set on content item' };

  const result = await generateContentBrief(item.primary_keyword_id, item.id);
  if (!result.ok || !result.brief) {
    return { ok: false, next_status: 'CONTENT_BRIEF', error: result.error || 'content_brief_generation_failed' };
  }

  if (!item.title && result.brief.title_options[0]) {
    getSeoDb().prepare('UPDATE seo_content_items SET title = ?, updated_at = ? WHERE id = ?')
      .run(result.brief.title_options[0], nowIso(), item.id);
  }

  return { ok: true, next_status: 'OUTLINE' };
}

/**
 * OUTLINE is derived directly from CONTENT_BRIEF's already-generated
 * `outline` field rather than a second AI call — content-brief.md's schema
 * already produces a full H2/H3 outline with per-section notes, so a
 * separate outline-generation prompt would just be re-asking the same
 * question. This is a documented simplification: this step validates the
 * outline that CONTENT_BRIEF produced is present and non-empty rather than
 * generating a new one.
 */
async function runStep_OUTLINE(item: ContentItemRow): Promise<StepResult> {
  const state = getPipelineState(item.id);
  const outline = safeJsonParse<unknown[]>(state?.outline_json, []);
  if (!Array.isArray(outline) || outline.length === 0) {
    return { ok: false, next_status: 'OUTLINE', error: 'no outline present — CONTENT_BRIEF step did not produce one' };
  }
  return { ok: true, next_status: 'CHATGPT_GENERATION' };
}

async function runStep_CHATGPT_GENERATION(item: ContentItemRow): Promise<StepResult> {
  const keyword = item.primary_keyword_id ? getKeywordById(item.primary_keyword_id) : undefined;
  if (!keyword) return { ok: false, next_status: 'CHATGPT_GENERATION', error: 'keyword_not_found' };
  const brand = getBrandById(item.brand_id);
  if (!brand) return { ok: false, next_status: 'CHATGPT_GENERATION', error: `brand_not_found: ${item.brand_id}` };

  const state = getPipelineState(item.id);
  const verifiedFacts = listFacts(item.brand_id, {
    status: 'VERIFIED',
    ...(item.location_id ? { locationId: item.location_id } : {}),
  });
  const relatedPages = getSeoDb().prepare(
    `SELECT url, page_type, title FROM seo_site_pages WHERE brand_id = ? AND deleted_at IS NULL LIMIT 5`,
  ).all(item.brand_id) as Array<{ url: string; page_type: string; title: string | null }>;

  const isRewrite = (state?.repair_loop_count ?? 0) > 0;
  const previousVersion = isRewrite ? getLatestVersion(item.id) : undefined;
  const qaFailureReasons = safeJsonParse<string[]>(state?.last_qa_failure_reasons, []);

  const templateName = isRewrite ? 'article-rewrite' : 'article-generation';
  const existingContent = isRewrite
    ? `${previousVersion?.body || '(no previous body found)'}\n\n--- QA FAILURE REASONS TO FIX IN THIS REWRITE ---\n${qaFailureReasons.map(r => `- ${r}`).join('\n') || '(none recorded)'}`
    : '(none — this is a new article)';

  const approvedFactsBlock = verifiedFacts.length
    ? verifiedFacts.map(f => `- [${f.category}] ${f.field_name}: ${f.value}`).join('\n')
    : '(no VERIFIED facts on file for this brand/location)';
  const forbiddenClaimsBlock = listForbiddenClaimInstructions().map(l => `- ${l}`).join('\n');
  const relatedPagesBlock = relatedPages.length
    ? relatedPages.map(p => `${p.url} (${p.page_type}${p.title ? `: ${p.title}` : ''})`).join('\n')
    : '(no related pages on file yet)';

  const taskId = seoId('task');

  function buildPrompt(): string {
    return renderPromptTemplate(templateName, {
      brand_id: item.brand_id,
      task_id: taskId,
      article_id: item.id,
      location_id: item.location_id || '',
      target_keyword: keyword!.keyword,
      intent: keyword!.search_intent || 'informational',
      audience: brand!.industry || brand!.cuisine || 'local customers',
      target_page: keyword!.target_url || '(none yet — new page)',
      related_pages: relatedPagesBlock,
      existing_competing_content: existingContent,
      approved_facts: approvedFactsBlock,
      forbidden_claims: forbiddenClaimsBlock,
    });
  }

  async function submitGeneration(prompt: string, attemptSuffix: string): Promise<{ parsed: ParsedArticle | null; raw?: string; providerResult: AIProviderResult }> {
    const idempotencyKey = `${item.id}:CHATGPT_GENERATION:${state?.repair_loop_count ?? 0}${attemptSuffix}`;
    const providerResult = await callAiJob({
      task_id: taskId,
      brand_id: item.brand_id,
      location_id: item.location_id || undefined,
      article_id: item.id,
      template: templateName,
      prompt,
      idempotency_key: idempotencyKey,
    }, 'chatgpt_browser');

    if (providerResult.status !== 'completed') return { parsed: null, providerResult };
    const parsed = tryParseJsonLoose(providerResult.raw_response);
    return { parsed: isValidArticle(parsed) ? parsed : null, raw: providerResult.raw_response, providerResult };
  }

  let attempt = await submitGeneration(buildPrompt(), '');

  if (attempt.providerResult.status === 'waiting_for_login' || attempt.providerResult.status === 'waiting_for_manual_paste') {
    return { ok: false, next_status: 'CHATGPT_GENERATION', blocked_reason: attempt.providerResult.status };
  }

  if (attempt.providerResult.status !== 'completed' || !attempt.parsed) {
    // Malformed / unparseable AI response — retry ONCE with a clarifying
    // re-prompt before failing the step (spec: "the AI router's
    // raw_response should be JSON per the prompt template's schema section
    // — if JSON.parse fails or required fields are missing, retry once with
    // a clarifying re-prompt before failing the step").
    updatePipelineState(item.id, { generation_attempt: (state?.generation_attempt ?? 0) + 1 });

    const clarifyingPrompt =
      (attempt.raw
        ? `Your previous response could not be parsed as valid JSON matching the required schema. Here is what you returned:\n\n${attempt.raw}\n\n`
        : `Your previous response failed (${attempt.providerResult.error || attempt.providerResult.status}). `) +
      `Re-read the task and return ONLY a single valid JSON object matching the schema below — no prose, no markdown code fences, no explanation.\n\n` +
      buildPrompt();

    attempt = await submitGeneration(clarifyingPrompt, ':retry');

    if (attempt.providerResult.status === 'waiting_for_login' || attempt.providerResult.status === 'waiting_for_manual_paste') {
      return { ok: false, next_status: 'CHATGPT_GENERATION', blocked_reason: attempt.providerResult.status };
    }
    if (attempt.providerResult.status !== 'completed' || !attempt.parsed) {
      // Both attempts failed — this is a repairable failure (counts toward the repair loop).
      return {
        ok: false,
        next_status: 'CHATGPT_GENERATION',
        error: `malformed_ai_response_after_retry${attempt.providerResult.error ? `: ${attempt.providerResult.error}` : ''}`,
      };
    }
  }

  const article = attempt.parsed;
  const db = getSeoDb();
  const prevMax = db.prepare('SELECT MAX(version_number) as m FROM seo_article_versions WHERE content_id = ?').get(item.id) as { m: number | null };
  const versionNumber = (prevMax.m ?? 0) + 1;
  const versionId = seoId('artver');

  db.prepare(`
    INSERT INTO seo_article_versions (
      id, created_at, content_id, version_number, body, meta_title, meta_description,
      headings, faq, internal_links, external_links, cta, schema_json, hero_image_url, author, created_by_provider
    ) VALUES (
      @id, @created_at, @content_id, @version_number, @body, @meta_title, @meta_description,
      @headings, @faq, @internal_links, NULL, @cta, NULL, NULL, NULL, @provider
    )
  `).run({
    id: versionId,
    created_at: nowIso(),
    content_id: item.id,
    version_number: versionNumber,
    body: article.body_markdown,
    meta_title: article.meta_title,
    meta_description: article.meta_description,
    headings: JSON.stringify(article.headings || []),
    faq: JSON.stringify(article.faq || []),
    internal_links: JSON.stringify(article.internal_links || []),
    cta: JSON.stringify(article.cta || {}),
    provider: 'chatgpt_browser',
  });

  db.prepare('UPDATE seo_content_items SET current_version_id = ?, title = ?, updated_at = ? WHERE id = ?')
    .run(versionId, article.title, nowIso(), item.id);

  return { ok: true, next_status: 'OUTPUT_SCHEMA_VALIDATION' };
}

async function runStep_OUTPUT_SCHEMA_VALIDATION(item: ContentItemRow): Promise<StepResult> {
  const version = getLatestVersion(item.id);
  if (!version) return { ok: false, next_status: 'OUTPUT_SCHEMA_VALIDATION', error: 'no article version found to validate' };

  const problems: string[] = [];
  if (!version.body || version.body.trim().length < 200) problems.push('body_markdown too short (<200 chars)');
  if (!version.meta_title || version.meta_title.length === 0 || version.meta_title.length > 70) problems.push('meta_title missing or too long (>70 chars)');
  if (!version.meta_description || version.meta_description.length === 0 || version.meta_description.length > 170) problems.push('meta_description missing or too long (>170 chars)');

  const headings = safeJsonParse<unknown[]>(version.headings, []);
  const internalLinks = safeJsonParse<unknown[]>(version.internal_links, []);
  if (!Array.isArray(headings) || headings.length === 0) problems.push('no headings present');
  if (!Array.isArray(internalLinks)) problems.push('internal_links is not an array');

  if (problems.length > 0) {
    return { ok: false, next_status: 'OUTPUT_SCHEMA_VALIDATION', blocked_reason: `schema_validation_failed: ${problems.join('; ')}` };
  }
  return { ok: true, next_status: 'AI_QA' };
}

interface QaCheck { name: string; pass: boolean; detail: string; }

function runGenericQaGate(item: ContentItemRow, stepName: string, checks: QaCheck[], nextOnPass: string): StepResult {
  const passCount = checks.filter(c => c.pass).length;
  const cert = certify(
    { request_id: `${item.id}:${stepName}`, intent: { intent: stepName.toLowerCase(), risk_level: 2 } },
    { qa_pass_count: passCount, qa_total_count: checks.length, base_confidence: 70 },
  );
  const failed = checks.filter(c => !c.pass);

  recordEvidence({
    brand_id: item.brand_id,
    category: `seo_pipeline_${stepName.toLowerCase()}`,
    summary: `${stepName} verdict ${cert.verdict} for content ${item.id} (${passCount}/${checks.length} checks passed)`,
    payload: { content_id: item.id, checks, cert },
  });

  if (cert.verdict === 'REJECTED') {
    return {
      ok: false,
      next_status: stepName,
      blocked_reason: `${stepName}_REJECTED: ${failed.map(f => f.detail).join('; ') || cert.summary}`,
    };
  }
  return { ok: true, next_status: nextOnPass };
}

async function runStep_AI_QA(item: ContentItemRow): Promise<StepResult> {
  const version = getLatestVersion(item.id);
  if (!version) return { ok: false, next_status: 'AI_QA', error: 'no article version found' };

  const wordCount = (version.body || '').split(/\s+/).filter(Boolean).length;
  const faq = safeJsonParse<unknown[]>(version.faq, []);
  const internalLinks = safeJsonParse<unknown[]>(version.internal_links, []);
  const cta = safeJsonParse<{ type?: string }>(version.cta, {});

  const checks: QaCheck[] = [
    { name: 'min_word_count', pass: wordCount >= 500, detail: `word count ${wordCount} (need >=500)` },
    { name: 'has_faq', pass: Array.isArray(faq) && faq.length >= 2, detail: `FAQ has ${faq.length} entries (need >=2)` },
    { name: 'has_internal_links', pass: Array.isArray(internalLinks) && internalLinks.length >= 1, detail: `${internalLinks.length} internal link(s) (need >=1)` },
    { name: 'has_cta', pass: !!cta.type && cta.type.length > 0, detail: cta.type ? `CTA type: ${cta.type}` : 'no CTA type set' },
    { name: 'has_meta_title', pass: !!version.meta_title && version.meta_title.length > 0 && version.meta_title.length <= 60, detail: `meta_title length ${version.meta_title?.length ?? 0} (<=60)` },
  ];

  return runGenericQaGate(item, 'AI_QA', checks, 'SEO_QA');
}

async function runStep_SEO_QA(item: ContentItemRow): Promise<StepResult> {
  const version = getLatestVersion(item.id);
  if (!version) return { ok: false, next_status: 'SEO_QA', error: 'no article version found' };
  const keyword = item.primary_keyword_id ? getKeywordById(item.primary_keyword_id) : undefined;

  const headings = safeJsonParse<Array<{ level?: string }>>(version.headings, []);
  const titleHasKeyword = keyword ? containsCoreTokens(item.title || '', keyword.keyword) : true;

  const checks: QaCheck[] = [
    { name: 'meta_title_length', pass: !!version.meta_title && version.meta_title.length > 0 && version.meta_title.length <= 60, detail: `meta_title length ${version.meta_title?.length ?? 0} (<=60)` },
    { name: 'meta_description_length', pass: !!version.meta_description && version.meta_description.length > 0 && version.meta_description.length <= 155, detail: `meta_description length ${version.meta_description?.length ?? 0} (<=155)` },
    { name: 'has_h2_structure', pass: headings.some(h => h.level === 'h2'), detail: `${headings.length} heading(s) present` },
    { name: 'title_targets_keyword', pass: titleHasKeyword, detail: keyword ? `title vs keyword "${keyword.keyword}"` : 'no keyword to check' },
  ];

  return runGenericQaGate(item, 'SEO_QA', checks, 'FACT_QA');
}

/**
 * Hard enforcement — NOT a soft warning. Any claim in the article body that
 * matches a claim-guard pattern but has no VERIFIED supporting fact blocks
 * this step outright, regardless of how many other checks pass. Uses
 * checkClaimsHardEnforcement() (facts/claim-guard.ts) which also persists
 * every supported claim's claim->fact mapping into seo_article_facts.
 */
async function runStep_FACT_QA(item: ContentItemRow): Promise<StepResult> {
  const version = getLatestVersion(item.id);
  if (!version || !version.body) return { ok: false, next_status: 'FACT_QA', error: 'no article body to fact-check' };

  const enforcement = checkClaimsHardEnforcement(item.brand_id, item.id, version.body, item.location_id || undefined);

  recordEvidence({
    brand_id: item.brand_id,
    category: 'seo_pipeline_fact_qa',
    summary: `FACT_QA ${enforcement.pass ? 'PASS' : 'FAIL'} for content ${item.id}: ${enforcement.blocked.length} unverified claim(s), ${enforcement.supported.length} supported claim(s)`,
    payload: {
      content_id: item.id,
      blocked: enforcement.blocked,
      supported_count: enforcement.supported.length,
      persisted_fact_links: enforcement.persisted_fact_links,
    },
  });

  if (!enforcement.pass) {
    return {
      ok: false,
      next_status: 'FACT_QA',
      blocked_reason: `FACT_QA_BLOCKED_UNVERIFIED: ${enforcement.blocked.map(b => `"${b.claim_text}" (${b.claim_category})`).join('; ')}`,
    };
  }
  return { ok: true, next_status: 'BRAND_QA' };
}

/**
 * Simplified brand-voice QA — this codebase has no dedicated "brand voice"
 * engine (brand-config.ts only carries structured NAP/connector data), so
 * this step checks the signals that ARE available: the brand is actually
 * mentioned, a title exists, and a CTA is present. Documented simplification.
 */
async function runStep_BRAND_QA(item: ContentItemRow): Promise<StepResult> {
  const version = getLatestVersion(item.id);
  if (!version) return { ok: false, next_status: 'BRAND_QA', error: 'no article version found' };
  const brand = getBrandById(item.brand_id);

  const bodyLower = (version.body || '').toLowerCase();
  const brandNameMentioned = !!brand?.name && bodyLower.includes(brand.name.toLowerCase());
  const cta = safeJsonParse<{ type?: string }>(version.cta, {});

  const checks: QaCheck[] = [
    { name: 'brand_name_mentioned', pass: brandNameMentioned, detail: brand?.name ? `"${brand.name}" ${brandNameMentioned ? 'found' : 'not found'} in body` : 'no brand name on file' },
    { name: 'title_present', pass: !!item.title && item.title.trim().length > 0, detail: item.title ? 'title set' : 'no title set' },
    { name: 'cta_present', pass: !!cta.type, detail: cta.type ? `CTA type ${cta.type}` : 'no CTA present' },
  ];

  return runGenericQaGate(item, 'BRAND_QA', checks, 'LINK_QA');
}

async function runStep_LINK_QA(item: ContentItemRow): Promise<StepResult> {
  const version = getLatestVersion(item.id);
  if (!version) return { ok: false, next_status: 'LINK_QA', error: 'no article version found' };

  const internalLinks = safeJsonParse<Array<{ target_url?: string; anchor_text?: string }>>(version.internal_links, []);
  const validShape = internalLinks.every(l => !!l && typeof l.target_url === 'string' && l.target_url.length > 0 && typeof l.anchor_text === 'string' && l.anchor_text.trim().length > 0);

  const sitePages = getSeoDb().prepare('SELECT url FROM seo_site_pages WHERE brand_id = ? AND deleted_at IS NULL').all(item.brand_id) as Array<{ url: string }>;
  const knownUrls = new Set(sitePages.map(p => p.url));
  // Not every internal link target has to already exist as a crawled page —
  // new articles often link to each other before both are crawled — but if
  // the brand has ANY known pages at all, at least one link should resolve
  // to one, otherwise this article is effectively orphaned.
  const anyKnownTarget = knownUrls.size === 0 || internalLinks.some(l => !!l.target_url && knownUrls.has(l.target_url));

  const checks: QaCheck[] = [
    { name: 'has_internal_links', pass: internalLinks.length >= 1, detail: `${internalLinks.length} internal link(s)` },
    { name: 'links_well_formed', pass: validShape, detail: validShape ? 'all links have target_url + anchor_text' : 'one or more links missing target_url/anchor_text' },
    { name: 'not_orphaned', pass: anyKnownTarget, detail: anyKnownTarget ? 'at least one link targets a known site page' : 'no link targets a known site page' },
  ];

  return runGenericQaGate(item, 'LINK_QA', checks, 'PREVIEW_BUILD');
}

async function runStep_PREVIEW_BUILD(item: ContentItemRow): Promise<StepResult> {
  const version = getLatestVersion(item.id);
  if (!version || !version.body) return { ok: false, next_status: 'PREVIEW_BUILD', error: 'no article body to build a preview from' };

  const publisher = resolvePublisher(item.brand_id);
  if (!publisher) return { ok: false, next_status: 'PREVIEW_BUILD', error: `no publisher configured for brand "${item.brand_id}"` };

  const state = getPipelineState(item.id);
  const slug = (item.title || item.id).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || item.id;
  const targetPath = `blog/${slug}.html`;
  const html = `<!doctype html><html><head><title>${escapeHtml(version.meta_title || item.title || '')}</title><meta name="description" content="${escapeHtml(version.meta_description || '')}"></head><body>${markdownToHtmlStub(version.body)}</body></html>`;

  try {
    // Idempotency / resumability: if a draft was already written on a prior
    // (possibly interrupted) run, reuse it instead of calling createDraft()
    // again — the publishers throw if a draft already exists at that path.
    let draftPath = state?.draft_path || undefined;
    if (!draftPath) {
      const created = await publisher.createDraft(item.id, html, targetPath);
      draftPath = created.draftPath;
    }
    const preview = await publisher.createPreview(draftPath);

    updatePipelineState(item.id, {
      draft_path: draftPath,
      target_path: targetPath,
      preview_path: preview.previewPath,
      preview_build_success: preview.success ? 1 : 0,
    });

    recordEvidence({
      brand_id: item.brand_id,
      category: 'seo_pipeline_preview_build',
      summary: `PREVIEW_BUILD ${preview.success ? 'PASS' : 'FAIL'} for content ${item.id}`,
      payload: { content_id: item.id, draftPath, previewPath: preview.previewPath, buildLog: preview.buildLog, success: preview.success },
    });

    if (!preview.success) {
      return { ok: false, next_status: 'PREVIEW_BUILD', blocked_reason: `preview_build_failed: ${preview.buildLog}` };
    }
    return { ok: true, next_status: 'APPROVAL_REQUEST' };
  } catch (e) {
    return { ok: false, next_status: 'PREVIEW_BUILD', error: e instanceof Error ? e.message : String(e) };
  }
}

async function runStep_APPROVAL_REQUEST(item: ContentItemRow): Promise<StepResult> {
  const state = getPipelineState(item.id);
  let actionId = state?.approval_action_id || null;

  if (!actionId) {
    const idempotencyKey = `${item.id}:APPROVAL_REQUEST`;
    const outcome = submitSeoAction({
      category: 'article_publish',
      brand_id: item.brand_id,
      description: `Publish article "${item.title || item.id}" for ${item.brand_id}`,
      target: state?.target_path || item.id,
      after_state: JSON.stringify({ content_id: item.id, target_path: state?.target_path }),
      rollback_plan: 'Reject the pending approval — no live publish has occurred yet; PRODUCTION_READY is a status label, not a deploy.',
      idempotency_key: idempotencyKey,
      payload: { content_id: item.id },
    });

    if (outcome.outcome === 'blocked') {
      return { ok: false, next_status: 'APPROVAL_REQUEST', blocked_reason: `article_publish_blocked: ${outcome.reason}` };
    }

    const row = getSeoDb().prepare('SELECT id FROM seo_actions WHERE idempotency_key = ?').get(idempotencyKey) as { id: string } | undefined;
    actionId = row?.id ?? (outcome.outcome === 'duplicate' ? outcome.existing_action_id : null);
    if (!actionId) return { ok: false, next_status: 'APPROVAL_REQUEST', error: 'failed to resolve seo_actions id after submitSeoAction' };
    updatePipelineState(item.id, { approval_action_id: actionId });

    if (outcome.outcome === 'auto_executed' || outcome.outcome === 'auto_executed_with_notification') {
      // article_publish is REQUIRES_APPROVAL in config/seo-policy.yaml as of
      // this writing, so this branch shouldn't trigger in practice — handled
      // honestly in case policy tiers ever change.
      return { ok: true, next_status: 'APPROVED' };
    }
  }

  const actionRow = getSeoDb().prepare('SELECT approval_id FROM seo_actions WHERE id = ?').get(actionId) as { approval_id: string | null } | undefined;
  if (!actionRow?.approval_id) {
    return { ok: false, next_status: 'APPROVAL_REQUEST', blocked_reason: 'awaiting_approval_gate_enqueue' };
  }

  const approval = getApprovalAction(actionRow.approval_id);
  if (!approval) return { ok: false, next_status: 'APPROVAL_REQUEST', error: `approval_action_not_found: ${actionRow.approval_id}` };

  if (approval.status === 'approved' || approval.status === 'executed') {
    return { ok: true, next_status: 'APPROVED' };
  }
  if (approval.status === 'rejected') {
    return { ok: false, next_status: 'APPROVAL_REQUEST', blocked_reason: 'approval_rejected — CEO rejected the publish request; pipeline will not auto-retry' };
  }
  return { ok: false, next_status: 'APPROVAL_REQUEST', blocked_reason: 'awaiting_human_approval' };
}

async function runStep_APPROVED(item: ContentItemRow): Promise<StepResult> {
  if (!item.scheduled_publish_at) {
    getSeoDb().prepare('UPDATE seo_content_items SET scheduled_publish_at = ?, updated_at = ? WHERE id = ?').run(nowIso(), nowIso(), item.id);
  }
  return { ok: true, next_status: 'SCHEDULED' };
}

async function runStep_SCHEDULED(item: ContentItemRow): Promise<StepResult> {
  const scheduledAtMs = item.scheduled_publish_at ? new Date(item.scheduled_publish_at).getTime() : Date.now();
  if (Date.now() < scheduledAtMs) {
    return { ok: false, next_status: 'SCHEDULED', blocked_reason: `scheduled_for_future: ${item.scheduled_publish_at}` };
  }
  return { ok: true, next_status: 'PREVIEW_PUBLISHED' };
}

async function runStep_PREVIEW_PUBLISHED(item: ContentItemRow): Promise<StepResult> {
  const state = getPipelineState(item.id);
  if (!state?.preview_build_success) {
    return { ok: false, next_status: 'PREVIEW_PUBLISHED', error: 'no successful PREVIEW_BUILD result on file' };
  }
  recordEvidence({
    brand_id: item.brand_id,
    category: 'seo_pipeline_preview_published',
    summary: `Preview marked published for content ${item.id} (preview environment only — never production)`,
    payload: { content_id: item.id, preview_path: state.preview_path },
  });
  return { ok: true, next_status: 'PREVIEW_VERIFIED' };
}

async function runStep_PREVIEW_VERIFIED(item: ContentItemRow): Promise<StepResult> {
  const publisher = resolvePublisher(item.brand_id);
  const state = getPipelineState(item.id);
  if (!publisher || !state?.target_path) {
    return { ok: false, next_status: 'PREVIEW_VERIFIED', error: 'missing publisher or target_path for snapshot' };
  }
  try {
    const { snapshotId } = await publisher.createSnapshot(state.target_path);
    updatePipelineState(item.id, { snapshot_id: snapshotId });
    return { ok: true, next_status: 'PRODUCTION_READY' };
  } catch (e) {
    return { ok: false, next_status: 'PREVIEW_VERIFIED', error: e instanceof Error ? e.message : String(e) };
  }
}

async function runStep_PRODUCTION_READY(_item: ContentItemRow): Promise<StepResult> {
  // Ceiling status — advancePipeline() short-circuits before this ever runs
  // in practice (see below), but kept for completeness / type safety.
  return { ok: true, next_status: 'PRODUCTION_READY' };
}

const STEP_FUNCTIONS: Record<string, (item: ContentItemRow) => Promise<StepResult>> = {
  APPROVED_KEYWORD: runStep_APPROVED_KEYWORD,
  CANNIBALIZATION_CHECK: runStep_CANNIBALIZATION_CHECK,
  VERIFIED_FACT_COLLECTION: runStep_VERIFIED_FACT_COLLECTION,
  CONTENT_BRIEF: runStep_CONTENT_BRIEF,
  OUTLINE: runStep_OUTLINE,
  CHATGPT_GENERATION: runStep_CHATGPT_GENERATION,
  OUTPUT_SCHEMA_VALIDATION: runStep_OUTPUT_SCHEMA_VALIDATION,
  AI_QA: runStep_AI_QA,
  SEO_QA: runStep_SEO_QA,
  FACT_QA: runStep_FACT_QA,
  BRAND_QA: runStep_BRAND_QA,
  LINK_QA: runStep_LINK_QA,
  PREVIEW_BUILD: runStep_PREVIEW_BUILD,
  APPROVAL_REQUEST: runStep_APPROVAL_REQUEST,
  APPROVED: runStep_APPROVED,
  SCHEDULED: runStep_SCHEDULED,
  PREVIEW_PUBLISHED: runStep_PREVIEW_PUBLISHED,
  PREVIEW_VERIFIED: runStep_PREVIEW_VERIFIED,
  PRODUCTION_READY: runStep_PRODUCTION_READY,
};

// ── advancePipeline() ────────────────────────────────────────────────────

/**
 * Runs the step matching the content item's CURRENT status (always re-read
 * from seo_content_items — never cached), and either advances the status,
 * leaves it parked (external wait / hard blocker), or routes it back to
 * CHATGPT_GENERATION as a repair attempt (capped, then BLOCKED + WhatsApp
 * escalation). Safe to call repeatedly / after a process restart.
 */
export async function advancePipeline(contentId: string): Promise<StepResult> {
  const item = getContentItem(contentId);
  if (!item) return { ok: false, next_status: 'UNKNOWN', error: `content_item_not_found: ${contentId}` };

  const currentStatus = item.status;

  if (currentStatus === 'BLOCKED') {
    return {
      ok: false,
      next_status: 'BLOCKED',
      blocked_reason: 'pipeline is BLOCKED — exceeded max repair attempts or was otherwise halted; requires manual intervention',
    };
  }
  if (currentStatus === 'PRODUCTION_READY') {
    return { ok: true, next_status: 'PRODUCTION_READY' }; // ceiling reached — idempotent no-op
  }

  const stepFn = STEP_FUNCTIONS[currentStatus];
  if (!stepFn) {
    return { ok: false, next_status: currentStatus, error: `unknown_pipeline_status: ${currentStatus}` };
  }

  ensurePipelineState(contentId, item.primary_keyword_id || undefined);
  const { id: stepRowId } = recordStepStart(contentId, currentStatus);

  let result: StepResult;
  try {
    result = await stepFn(item);
  } catch (e) {
    result = { ok: false, next_status: currentStatus, error: e instanceof Error ? e.message : String(e) };
  }

  const evidence = recordEvidence({
    brand_id: item.brand_id,
    category: 'seo_pipeline_step',
    summary: `${currentStatus} -> ${result.ok ? result.next_status : `(no advance)${result.blocked_reason ? `: ${result.blocked_reason}` : result.error ? `: ${result.error}` : ''}`} for content ${contentId}`,
    payload: { content_id: contentId, from_status: currentStatus, result },
  });

  if (result.ok) {
    setContentStatus(contentId, result.next_status);
    recordStepEnd(stepRowId, 'ok', { evidence_id: evidence.id });

    if (currentStatus === 'CHATGPT_GENERATION') {
      updatePipelineState(contentId, { generation_attempt: 0 });
    }
    if (currentStatus === 'PREVIEW_BUILD') {
      // A full trip through generation -> schema -> all 5 QA gates ->
      // successful preview build means the article is good — reset the
      // counter so a future edit cycle starts fresh.
      resetRepairLoop(contentId);
    }
    return result;
  }

  // External wait state — never advances, never counts against the repair loop.
  if (result.blocked_reason && WAIT_BLOCKED_REASONS.has(result.blocked_reason)) {
    recordStepEnd(stepRowId, 'waiting', { blocked_reason: result.blocked_reason, evidence_id: evidence.id });
    return result;
  }

  // Non-repairable hard blocker (cannibalization, pending/rejected approval,
  // not-yet-due schedule) — park indefinitely, no BLOCKED escalation.
  if (!REPAIRABLE_STEPS.has(currentStatus)) {
    recordStepEnd(stepRowId, 'blocked', { blocked_reason: result.blocked_reason, error: result.error, evidence_id: evidence.id });
    return result;
  }

  // Repairable failure — record the reason (fed into the next rewrite
  // prompt), route back to CHATGPT_GENERATION, and count it against the cap.
  const failureReason = result.blocked_reason || result.error || `${currentStatus}_failed`;
  const stateBefore = getPipelineState(contentId);
  const existingReasons = safeJsonParse<string[]>(stateBefore?.last_qa_failure_reasons, []);
  updatePipelineState(contentId, {
    last_qa_failure_reasons: JSON.stringify([...existingReasons, `${currentStatus}: ${failureReason}`].slice(-10)),
  });

  const newCount = incrementRepairLoop(contentId);

  if (newCount > MAX_REPAIR_LOOPS) {
    setContentStatus(contentId, 'BLOCKED');
    recordStepEnd(stepRowId, 'blocked', {
      blocked_reason: `max_repair_loops_exceeded (${MAX_REPAIR_LOOPS} attempts used)`,
      error: failureReason,
      evidence_id: evidence.id,
    });

    queueToCeo(
      `[SEO] Article pipeline BLOCKED for content ${contentId} (brand ${item.brand_id}) after ${MAX_REPAIR_LOOPS} failed repair attempts at ${currentStatus}. ` +
      `Last failure: ${failureReason}. Manual review required.`,
    );

    recordEvidence({
      brand_id: item.brand_id,
      category: 'seo_pipeline_blocked',
      summary: `Content ${contentId} BLOCKED after ${MAX_REPAIR_LOOPS} repair attempts (failed at ${currentStatus})`,
      payload: { content_id: contentId, failed_step: currentStatus, failure_reason: failureReason, repair_loop_count: newCount },
    });

    return { ok: false, next_status: 'BLOCKED', blocked_reason: `max_repair_loops_exceeded: ${failureReason}` };
  }

  setContentStatus(contentId, 'CHATGPT_GENERATION');
  recordStepEnd(stepRowId, 'failed', {
    blocked_reason: `repair_loop_${newCount}_of_${MAX_REPAIR_LOOPS}: ${failureReason}`,
    error: failureReason,
    evidence_id: evidence.id,
  });

  return {
    ok: false,
    next_status: 'CHATGPT_GENERATION',
    blocked_reason: `repair_loop_${newCount}_of_${MAX_REPAIR_LOOPS}: ${failureReason}`,
  };
}

// ── Read helpers for routes ──────────────────────────────────────────────

export function getPipelineContentItem(contentId: string) {
  return getContentItem(contentId);
}

export function listPipelineItems(opts: { brand_id?: string; status?: string } = {}): ContentItemRow[] {
  const db = getSeoDb();
  const clauses = ['deleted_at IS NULL'];
  const params: unknown[] = [];
  if (opts.brand_id) { clauses.push('brand_id = ?'); params.push(opts.brand_id); }
  if (opts.status) { clauses.push('status = ?'); params.push(opts.status); }
  return db.prepare(`SELECT * FROM seo_content_items WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC`).all(...params) as ContentItemRow[];
}

export function getPipelineSnapshot(contentId: string): {
  content_item: ContentItemRow;
  pipeline_state: ReturnType<typeof getPipelineState>;
  step_history: ReturnType<typeof getStepHistory>;
} | null {
  const item = getContentItem(contentId);
  if (!item) return null;
  return {
    content_item: item,
    pipeline_state: getPipelineState(contentId),
    step_history: getStepHistory(contentId),
  };
}

export { ContentBrief };
