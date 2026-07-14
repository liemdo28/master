/**
 * SEO article pipeline E2E preview certification.
 *
 * This test runs the real article pipeline state machine from APPROVED_KEYWORD
 * through PRODUCTION_READY using:
 *   - temp MI_DATA_DIR
 *   - temp BAKUDAN_ROOT
 *   - the real Bakudan publisher createDraft/createPreview/createSnapshot
 *   - fake AI responses through pipeline/ai-call.ts test seam
 *   - real approval gate rows, approved inside the isolated ops DB
 *
 * It never starts PM2, never deploys, and never writes to a live website root.
 *
 * Usage:
 *   npx tsx src/seo/__tests__/article-pipeline-e2e-preview.mjs
 */

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { section, check, note, finalize } from './_harness.mjs';

process.env.NODE_ENV = 'test';
process.env.MI_DATA_DIR = mkdtempSync(join(tmpdir(), 'seo-pipeline-e2e-data-'));
process.env.BAKUDAN_ROOT = mkdtempSync(join(tmpdir(), 'seo-pipeline-e2e-bakudan-'));
process.env.MI_CORE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

mkdirSync(process.env.BAKUDAN_ROOT, { recursive: true });
writeFileSync(join(process.env.BAKUDAN_ROOT, 'index.html'), '<!doctype html><title>Temp Bakudan</title>', 'utf8');
writeFileSync(join(process.env.BAKUDAN_ROOT, 'menu.html'), '<!doctype html><title>Menu</title>', 'utf8');

const { getSeoDb, nowIso, seoId } = await import('../seo-db.ts');
const { insertKeyword, setKeywordStatus } = await import('../keywords/keyword-store.ts');
const { createFact, setFactStatus } = await import('../facts/fact-registry.ts');
const { __setAiSubmitOverrideForTests } = await import('../pipeline/ai-call.ts');
const { startPipeline, advancePipeline, getPipelineSnapshot } = await import('../pipeline/article-pipeline.ts');
const gate = await import('../../approval/gate.ts');

function longArticleBody() {
  const paragraph = [
    'Bakudan Ramen welcomes guests who want a focused ramen meal, a clear menu path, and a comfortable local dining stop.',
    'This preview article explains how visitors can compare bowls, plan a visit, and use the menu page before choosing what to order.',
    'The page keeps factual claims modest and avoids unsupported statements about rankings, awards, exact prices, hours, sourcing, delivery, or restaurant policies.',
    'Readers get practical guidance about looking at broth styles, toppings, side dishes, spice levels, and the type of meal they want before arriving.',
    'The goal is a helpful local SEO article that supports discovery while staying inside the verified business fact boundary.',
  ].join(' ');
  return [
    '# Bakudan Ramen Visit Guide',
    '## Plan Your Ramen Visit',
    paragraph,
    '## Compare Menu Options',
    paragraph,
    '## Choose the Right Bowl',
    paragraph,
    '## Make the Most of the Menu Page',
    paragraph,
    '## Next Step',
    paragraph,
  ].join('\n\n');
}

const briefJson = {
  task_id: 'task-test',
  brand_id: 'bakudan',
  location_id: 'stone_oak',
  target_keyword: 'bakudan ramen visit guide',
  title_options: ['Bakudan Ramen Visit Guide'],
  outline: [
    { heading_level: 'h2', heading: 'Plan Your Ramen Visit', covers: 'visit planning', facts_used: [] },
    { heading_level: 'h2', heading: 'Compare Menu Options', covers: 'menu comparison', facts_used: [] },
  ],
  internal_links: [{ target_url: '/menu.html', anchor_text: 'Bakudan menu', from_section: 'Compare Menu Options' }],
  faq: [
    { question: 'How should I plan a ramen visit?', answer_guidance: 'Review the menu before choosing.' },
    { question: 'What page should guests check first?', answer_guidance: 'Use the menu page.' },
  ],
  cta: { type: 'view_menu', placement: 'end' },
  meta_title: 'Bakudan Ramen Visit Guide',
  meta_description: 'Plan a Bakudan Ramen visit with menu guidance and practical local SEO copy.',
  differentiation_notes: 'Practical visit planning only.',
};

const articleJson = {
  title: 'Bakudan Ramen Visit Guide',
  meta_title: 'Bakudan Ramen Visit Guide',
  meta_description: 'Plan a Bakudan Ramen visit with menu guidance and practical local SEO copy.',
  body_markdown: longArticleBody(),
  headings: [
    { level: 'h2', text: 'Plan Your Ramen Visit' },
    { level: 'h2', text: 'Compare Menu Options' },
    { level: 'h2', text: 'Choose the Right Bowl' },
    { level: 'h2', text: 'Make the Most of the Menu Page' },
  ],
  faq: [
    { question: 'How should I plan a ramen visit?', answer: 'Start by reviewing the menu page and choosing the meal style you want.' },
    { question: 'Does this article publish automatically?', answer: 'No. It only reaches preview-ready state in this isolated test.' },
  ],
  internal_links: [{ target_url: '/menu.html', anchor_text: 'Bakudan menu' }],
  cta: { type: 'view_menu', text: 'View the menu' },
};

__setAiSubmitOverrideForTests(async req => {
  if (req.template === 'content-brief') {
    return { status: 'completed', raw_response: JSON.stringify(briefJson), provider: 'test_fake' };
  }
  if (req.template === 'article-generation' || req.template === 'article-rewrite') {
    return { status: 'completed', raw_response: JSON.stringify(articleJson), provider: 'test_fake' };
  }
  return { status: 'failed', error: `unexpected template ${req.template}`, provider: 'test_fake' };
});

function approvePendingPipelineAction(contentId) {
  const state = getPipelineSnapshot(contentId)?.pipeline_state;
  const row = getSeoDb().prepare('SELECT approval_id FROM seo_actions WHERE id = ?').get(state?.approval_action_id);
  assert.ok(row?.approval_id, 'pipeline approval id should exist');
  const approval = gate.approve(row.approval_id, 'pipeline-e2e-ceo');
  assert.ok(approval?.status === 'approved', 'approval should be approved');
}

section('Fixture setup');
{
  getSeoDb().prepare(`
    INSERT INTO seo_site_pages (id, created_at, updated_at, brand_id, location_id, url, page_type, title, meta_title, meta_description, canonical, is_orphan, last_crawled_at, deleted_at)
    VALUES (?, ?, ?, 'bakudan', 'stone_oak', '/menu.html', 'menu', 'Bakudan menu', NULL, NULL, NULL, 0, NULL, NULL)
  `).run(seoId('page'), nowIso(), nowIso());

  const fact = createFact({
    brand_id: 'bakudan',
    location_id: 'stone_oak',
    category: 'menu_item',
    field_name: 'menu_page',
    value: '/menu.html',
    source: 'isolated_test_fixture',
  });
  setFactStatus(fact.id, 'VERIFIED', { verifiedBy: 'pipeline-e2e' });

  const keyword = insertKeyword({
    brand_id: 'bakudan',
    location_id: 'stone_oak',
    keyword: 'bakudan ramen visit guide',
    search_intent: 'informational',
    source: 'isolated_pipeline_e2e',
  });
  setKeywordStatus(keyword.id, 'APPROVED', { markReviewed: true });
  globalThis.__keywordId = keyword.id;
  check('temp data and site roots exist', existsSync(process.env.MI_DATA_DIR) && existsSync(process.env.BAKUDAN_ROOT));
  check('approved keyword fixture created', !!keyword.id);
}

section('Pipeline advance to approval wait');
const { content_id: contentId } = startPipeline(globalThis.__keywordId);
const seen = [];
for (let i = 0; i < 20; i++) {
  const before = getPipelineSnapshot(contentId).content_item.status;
  const result = await advancePipeline(contentId);
  const after = getPipelineSnapshot(contentId).content_item.status;
  seen.push({ before, after, result });
  const state = getPipelineSnapshot(contentId).pipeline_state;
  if (after === 'APPROVAL_REQUEST' && state?.approval_action_id) break;
}
{
  const snap = getPipelineSnapshot(contentId);
  check('pipeline reached APPROVAL_REQUEST', snap.content_item.status === 'APPROVAL_REQUEST', snap.content_item.status);
  check('preview was built before approval request', !!snap.pipeline_state.preview_path && existsSync(snap.pipeline_state.preview_path));
  check('approval action was enqueued', !!snap.pipeline_state.approval_action_id);
  note(`preview_path=${snap.pipeline_state.preview_path}`);
}

section('Approve and finish preview workflow');
approvePendingPipelineAction(contentId);
for (let i = 0; i < 10; i++) {
  const before = getPipelineSnapshot(contentId).content_item.status;
  const result = await advancePipeline(contentId);
  const after = getPipelineSnapshot(contentId).content_item.status;
  seen.push({ before, after, result });
  if (after === 'PRODUCTION_READY') break;
}
{
  const snap = getPipelineSnapshot(contentId);
  const previewHtml = readFileSync(snap.pipeline_state.preview_path, 'utf8');
  check('pipeline reached PRODUCTION_READY ceiling', snap.content_item.status === 'PRODUCTION_READY', snap.content_item.status);
  check('draft path stayed inside temp Bakudan root', snap.pipeline_state.draft_path.startsWith(process.env.BAKUDAN_ROOT));
  check('preview contains article title', previewHtml.includes('Bakudan Ramen Visit Guide'));
  check('snapshot id recorded', !!snap.pipeline_state.snapshot_id);
  check('no live publish function was called', !snap.content_item.published_at);
}

section('Evidence summary');
{
  const snap = getPipelineSnapshot(contentId);
  const failed = seen.filter(s => s.result?.ok === false && !String(s.result?.blocked_reason || '').includes('awaiting_human_approval'));
  check('no repair loop failures occurred', failed.length === 0, JSON.stringify(failed));
  check('step history recorded', snap.step_history.length >= 15, String(snap.step_history.length));
}

__setAiSubmitOverrideForTests(null);
try {
  rmSync(process.env.BAKUDAN_ROOT, { recursive: true, force: true });
  rmSync(process.env.MI_DATA_DIR, { recursive: true, force: true });
} catch {}

const result = finalize('article-pipeline-e2e-preview.mjs');
assert.equal(result.fail, 0);
