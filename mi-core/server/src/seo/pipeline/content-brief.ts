/**
 * Article pipeline — content brief generation (CONTENT_BRIEF step).
 *
 * Design decision (documented per task instructions): this step calls the AI
 * router with the `local_model` provider, NOT `chatgpt_browser`. A content
 * brief is a lower-risk, structural, non-publish-facing artifact (an outline
 * for a writer/AI to fill in, not the final article text a searcher will
 * read), so it doesn't need the CEO's own logged-in ChatGPT session — the
 * free local Ollama model (via ai-providers/local-model-provider.ts, which
 * ai-router.ts already dispatches to) is fast, has zero per-call cost, and
 * keeps the CEO's browser session free for the higher-value
 * CHATGPT_GENERATION step. If local-model output fails to parse, the caller
 * (article-pipeline.ts's runStep_CONTENT_BRIEF) surfaces that as a normal
 * step failure — it does not silently fall back to chatgpt_browser, so the
 * provider choice stays predictable and auditable.
 */

import { getKeywordById, type KeywordRecord } from '../keywords/keyword-store';
import { getBrandById, getLocationById } from '../brand-config';
import { listFacts } from '../facts/fact-registry';
import { listForbiddenClaimInstructions } from '../facts/claim-guard';
import { renderPromptTemplate } from '../ai-providers/prompt-loader';
import { getSeoDb, seoId } from '../seo-db';
import { callAiJob } from './ai-call';
import { updatePipelineState } from './pipeline-store';

export interface ContentBriefOutlineItem {
  heading_level: string;
  heading: string;
  covers: string;
  facts_used: string[];
}

export interface ContentBrief {
  task_id: string;
  brand_id: string;
  location_id?: string | null;
  target_keyword: string;
  title_options: string[];
  outline: ContentBriefOutlineItem[];
  internal_links: Array<{ target_url: string; anchor_text: string; from_section: string }>;
  faq: Array<{ question: string; answer_guidance: string }>;
  cta: { type: string; placement: string };
  meta_title: string;
  meta_description: string;
  differentiation_notes: string;
}

export interface ContentBriefResult {
  ok: boolean;
  brief?: ContentBrief;
  error?: string;
  raw_response?: string;
}

interface SitePageRow {
  url: string;
  page_type: string;
  title: string | null;
}

function findRelatedPages(brandId: string, limit = 5): SitePageRow[] {
  return getSeoDb().prepare(
    `SELECT url, page_type, title FROM seo_site_pages
     WHERE brand_id = ? AND deleted_at IS NULL
     ORDER BY CASE page_type WHEN 'money' THEN 0 WHEN 'menu' THEN 1 WHEN 'location' THEN 2 ELSE 3 END
     LIMIT ?`,
  ).all(brandId, limit) as SitePageRow[];
}

function factsToBulletList(facts: ReturnType<typeof listFacts>): string {
  if (facts.length === 0) return '(no VERIFIED facts on file for this brand/location yet)';
  return facts.map(f => `- [${f.category}] ${f.field_name}: ${f.value} (source: ${f.source})`).join('\n');
}

function forbiddenClaimsBlock(): string {
  return listForbiddenClaimInstructions().map(l => `- ${l}`).join('\n');
}

function tryParseJson(raw: string | undefined): unknown | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    // Some providers wrap JSON in a ```json fenced block despite instructions — try to salvage it.
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function isValidBrief(obj: unknown): obj is ContentBrief {
  if (!obj || typeof obj !== 'object') return false;
  const b = obj as Record<string, unknown>;
  return Array.isArray(b.title_options) && Array.isArray(b.outline) && typeof b.meta_title === 'string' && typeof b.meta_description === 'string';
}

/**
 * Pulls the approved keyword, VERIFIED facts, and related site pages for the
 * brand/location, renders `content-brief.md`, submits it to the local model
 * provider, parses the structured JSON result, and persists it into
 * seo_pipeline_state.content_brief_json (+ outline_json) for the given
 * content item.
 */
export async function generateContentBrief(keywordId: string, contentId: string): Promise<ContentBriefResult> {
  const keyword: KeywordRecord | undefined = getKeywordById(keywordId);
  if (!keyword) {
    return { ok: false, error: `keyword_not_found: ${keywordId}` };
  }
  const brand = getBrandById(keyword.brand_id);
  if (!brand) {
    return { ok: false, error: `brand_not_found: ${keyword.brand_id}` };
  }
  const location = keyword.location_id ? getLocationById(keyword.brand_id, keyword.location_id) : undefined;

  const relatedPages = findRelatedPages(keyword.brand_id);
  const verifiedFacts = listFacts(keyword.brand_id, {
    status: 'VERIFIED',
    ...(keyword.location_id ? { locationId: keyword.location_id } : {}),
  });

  const taskId = seoId('task');
  const prompt = renderPromptTemplate('content-brief', {
    brand_id: keyword.brand_id,
    task_id: taskId,
    location_id: keyword.location_id || '',
    target_keyword: keyword.keyword,
    intent: keyword.search_intent || 'informational',
    audience: brand.industry || brand.cuisine || 'local customers',
    target_page: keyword.target_url || '(none yet — new page)',
    related_pages: relatedPages.length
      ? relatedPages.map(p => `${p.url} (${p.page_type}${p.title ? `: ${p.title}` : ''})`).join('\n')
      : '(no related pages on file yet)',
    existing_competing_content: '(none supplied)',
    approved_facts: factsToBulletList(verifiedFacts),
    forbidden_claims: forbiddenClaimsBlock(),
  });

  const idempotencyKey = `${contentId}:CONTENT_BRIEF`;
  const result = await callAiJob(
    {
      task_id: taskId,
      brand_id: keyword.brand_id,
      location_id: keyword.location_id || undefined,
      article_id: contentId,
      template: 'content-brief',
      prompt,
      idempotency_key: idempotencyKey,
    },
    'local_model',
  );

  if (result.status !== 'completed') {
    return { ok: false, error: `content_brief_ai_job_${result.status}${result.error ? `: ${result.error}` : ''}`, raw_response: result.raw_response };
  }

  const parsed = tryParseJson(result.raw_response);
  if (!isValidBrief(parsed)) {
    return { ok: false, error: 'content_brief_malformed_response — could not parse required JSON fields (title_options, outline, meta_title, meta_description)', raw_response: result.raw_response };
  }

  const brief = parsed as ContentBrief;

  updatePipelineState(contentId, {
    content_brief_json: JSON.stringify(brief),
    outline_json: JSON.stringify(brief.outline),
  });

  return { ok: true, brief, raw_response: result.raw_response };
}
