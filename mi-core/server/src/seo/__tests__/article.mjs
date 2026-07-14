/**
 * SEO Control Center — Article test suite.
 *
 * Exercises real code paths in:
 *   - facts/fact-registry.ts + facts/claim-guard.ts
 *   - keywords/cannibalization-detector.ts + keywords/keyword-store.ts
 *   - ai-providers/ai-router.ts (submitAiJob idempotency)
 *
 * Runs against an ISOLATED temp SQLite DB (MI_DATA_DIR override) so it never
 * touches the real .local-agent-global/seo/seo-control-center.db. The real
 * schema is still used — getSeoDb() runs the actual migration-runner against
 * the temp file, so this is the real migrated schema, not a hand-rolled one.
 *
 * article-pipeline.ts (the APPROVED_KEYWORD -> ... -> PRODUCTION_READY state
 * machine with a 3-failed-QA-repair BLOCKED terminal state) did NOT exist in
 * mi-core/server/src/seo/pipeline/ at the time this file was written — only
 * its supporting pieces (pipeline-store.ts, ai-call.ts, content-brief.ts) did.
 * Per the task's fallback instruction, the "QA repair loop" requirement below
 * is therefore exercised against claim-guard.ts + cannibalization-detector.ts
 * directly (two independent unverifiable-claim / cannibalization scenarios),
 * not against a real 3-attempt BLOCKED state machine. See the GAP note in the
 * final section.
 *
 * Run with (from mi-core/server):
 *   npx tsx src/seo/__tests__/article.mjs
 */

import { mkdtempSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { section, check, gap, note, finalize } from './_harness.mjs';

const tmpDir = mkdtempSync(join(tmpdir(), 'seo-article-test-'));
process.env.MI_DATA_DIR = tmpDir;

const cacheBust = `?article-test=${Date.now()}`;
const { createFact, setFactStatus } = await import(`../facts/fact-registry.ts${cacheBust}`);
const { checkClaims } = await import(`../facts/claim-guard.ts${cacheBust}`);
const { detectCannibalization } = await import(`../keywords/cannibalization-detector.ts${cacheBust}`);
const { insertKeyword, setKeywordStatus, assignKeywordTargetUrl } = await import(`../keywords/keyword-store.ts${cacheBust}`);
const { submitAiJob } = await import(`../ai-providers/ai-router.ts${cacheBust}`);
const { getSeoDb } = await import(`../seo-db.ts${cacheBust}`);

let exitCode = 0;

try {
  // ── Fact validation ──────────────────────────────────────────────────
  section('Fact validation (fact-registry.ts + claim-guard.ts)');

  const brandVerified = 'test-brand-article-verified';
  const fact = createFact({
    brand_id: brandVerified,
    category: 'awards',
    field_name: 'yelp_award_2026',
    value: 'Voted Best Ramen — San Antonio Current Readers Poll 2026',
    source: 'san_antonio_current_readers_poll',
    source_ref: 'https://example.com/readers-poll-2026',
  });
  check('new fact starts UNVERIFIED', fact.status === 'UNVERIFIED', `got ${fact.status}`);

  const verified = setFactStatus(fact.id, 'VERIFIED', { verifiedBy: 'test-harness' });
  check('setFactStatus promotes to VERIFIED', verified.status === 'VERIFIED', `got ${verified.status}`);
  check('VERIFIED fact records verification_date', !!verified.verification_date);

  const supportedText = 'Our ramen was voted best in San Antonio by loyal readers this year.';
  const supportedResults = checkClaims(brandVerified, supportedText);
  const awardsHit = supportedResults.find(r => r.claim_category === 'awards');
  check('claim with matching VERIFIED fact is SUPPORTED_VERIFIED', !!awardsHit && awardsHit.status === 'SUPPORTED_VERIFIED',
    JSON.stringify(awardsHit));
  check('supported claim references the backing fact id', awardsHit?.supporting_fact_id === fact.id,
    `expected ${fact.id}, got ${awardsHit?.supporting_fact_id}`);

  const brandUnverified = 'test-brand-article-unverified';
  const unsupportedText = 'We were voted best ramen in Texas by everyone who tried it.';
  const unsupportedResults = checkClaims(brandUnverified, unsupportedText);
  const blockedHit = unsupportedResults.find(r => r.claim_category === 'awards');
  check('claim with NO backing fact is BLOCKED_UNVERIFIED', !!blockedHit && blockedHit.status === 'BLOCKED_UNVERIFIED',
    JSON.stringify(blockedHit));
  check('BLOCKED_UNVERIFIED reason names the missing fact category', (blockedHit?.reason || '').includes('awards'));

  // ── Cannibalization ──────────────────────────────────────────────────
  section('Cannibalization (cannibalization-detector.ts + keyword-store.ts)');

  const cannBrand = 'test-brand-cannibalization';
  const existingKw = insertKeyword({
    brand_id: cannBrand,
    keyword: 'best ramen san antonio',
    location_id: 'san-antonio-hq',
  });
  let kw = setKeywordStatus(existingKw.id, 'REVIEWED');
  kw = setKeywordStatus(kw.id, 'APPROVED');
  kw = setKeywordStatus(kw.id, 'ASSIGNED');
  kw = setKeywordStatus(kw.id, 'ACTIVE');
  kw = assignKeywordTargetUrl(kw.id, 'https://example.com/best-ramen-san-antonio');
  check('setup: existing keyword is ACTIVE with a target_url', kw.status === 'ACTIVE' && !!kw.target_url,
    `status=${kw.status} target_url=${kw.target_url}`);

  const cannResult = detectCannibalization({
    brand_id: cannBrand,
    keyword: 'best ramen san antonio',
    location_id: 'san-antonio-hq',
  });
  check(
    'identical keyword with existing target_url returns UPDATE_EXISTING or REJECT (not CREATE_NEW)',
    cannResult.decision === 'UPDATE_EXISTING' || cannResult.decision === 'REJECT',
    `got ${cannResult.decision}: ${cannResult.reason}`,
  );
  check('cannibalization result names the conflicting keyword id', cannResult.conflicting_keyword_id === kw.id,
    `expected ${kw.id}, got ${cannResult.conflicting_keyword_id}`);
  check('cannibalization scan records evidence', !!cannResult.evidence_id);

  // Control case: an unrelated brand/keyword with nothing in the pipeline
  // really does get CREATE_NEW — proves the detector isn't just always
  // returning a non-CREATE_NEW verdict.
  const freshResult = detectCannibalization({
    brand_id: 'test-brand-cannibalization-fresh',
    keyword: 'a completely novel unclaimed keyword phrase',
  });
  check('unrelated brand/keyword with no prior rows returns CREATE_NEW (control case)',
    freshResult.decision === 'CREATE_NEW', `got ${freshResult.decision}`);

  // Second independent scenario for the same keyword/no-target-page case —
  // doubles as the QA-repair-loop fallback's second confirmation (see GAP note).
  const dupeBrand = 'test-brand-cannibalization-dupe-inpipeline';
  const inPipelineKw = insertKeyword({ brand_id: dupeBrand, keyword: 'sushi delivery stockton' });
  const dupeResult = detectCannibalization({ brand_id: dupeBrand, keyword: 'sushi delivery stockton' });
  check('identical keyword already in pipeline with NO target page yet returns REJECT',
    dupeResult.decision === 'REJECT', `got ${dupeResult.decision}: ${dupeResult.reason}`);
  check('REJECT result references the in-pipeline keyword id', dupeResult.conflicting_keyword_id === inPipelineKw.id);

  // ── Malformed AI output ──────────────────────────────────────────────
  section('Malformed AI output — JSON-schema validation on ChatGPT responses');
  gap(
    'no JSON-schema validation/parsing layer exists yet for AI responses',
    'searched ai-router.ts, ai-provider.ts, chatgpt-browser-provider.ts, manual-paste-provider.ts, ' +
    'local-model-provider.ts: seo_ai_responses.parsed_json and .validated columns exist in the migration ' +
    'schema (0001_initial_schema.ts) but nothing in the current source ever sets parsed_json or flips ' +
    'validated away from its default (NULL / 0). submitManualResponse() and LocalModelProvider both insert ' +
    'raw_response with parsed_json=NULL, validated=0 unconditionally — there is no JSON.parse + schema check, ' +
    'and therefore no retry/rejection path to test. Writing a test that pretends this validation exists would ' +
    'be asserting behavior the code does not have. Flagging as a real gap for the article-pipeline engineer.',
  );

  // ── Duplicate generation ─────────────────────────────────────────────
  section('Duplicate generation — submitAiJob idempotency (ai-router.ts)');

  const db = getSeoDb();
  const idemKey = `article-test-idem-${Date.now()}`;
  const req = {
    task_id: 'task-dup-test',
    brand_id: 'test-brand-dup',
    template: 'article-generation',
    prompt: 'Write a 500-word article about ramen broth.',
    idempotency_key: idemKey,
  };

  const result1 = await submitAiJob(req, 'manual_paste');
  check('first submitAiJob call returns waiting_for_manual_paste', result1.status === 'waiting_for_manual_paste',
    JSON.stringify(result1));

  const countAfterFirst = db.prepare('SELECT COUNT(*) AS n FROM seo_ai_jobs WHERE idempotency_key = ?').get(idemKey).n;
  check('exactly one seo_ai_jobs row after first submission', countAfterFirst === 1, `count=${countAfterFirst}`);

  const result2 = await submitAiJob(req, 'manual_paste');
  check('second submitAiJob call with same idempotency_key succeeds (no throw)', result2.status === 'waiting_for_manual_paste',
    JSON.stringify(result2));

  const countAfterSecond = db.prepare('SELECT COUNT(*) AS n FROM seo_ai_jobs WHERE idempotency_key = ?').get(idemKey).n;
  check('still exactly one seo_ai_jobs row after duplicate submission (no second row created)',
    countAfterSecond === 1, `count=${countAfterSecond}`);

  // Complete the job via the manual-paste callback, then submit a third time
  // with the same key: ai-router's cache short-circuit should return the
  // cached response without touching seo_ai_jobs at all.
  const { submitManualResponse } = await import(`../ai-providers/manual-paste-provider.ts${cacheBust}`);
  const jobRow = db.prepare('SELECT id FROM seo_ai_jobs WHERE idempotency_key = ?').get(idemKey);
  const pasteResult = submitManualResponse(jobRow.id, '{"title": "Ramen Broth 101"}');
  check('manual paste completion succeeds', pasteResult.ok === true, JSON.stringify(pasteResult));

  const responseCountBefore = db.prepare('SELECT COUNT(*) AS n FROM seo_ai_responses WHERE job_id = ?').get(jobRow.id).n;
  const result3 = await submitAiJob(req, 'manual_paste');
  check('third submitAiJob call (job now completed) returns cached completed result',
    result3.status === 'completed' && !!result3.raw_response, JSON.stringify(result3));
  const responseCountAfter = db.prepare('SELECT COUNT(*) AS n FROM seo_ai_responses WHERE job_id = ?').get(jobRow.id).n;
  check('cached short-circuit does not insert a new seo_ai_responses row',
    responseCountAfter === responseCountBefore, `before=${responseCountBefore} after=${responseCountAfter}`);

  const jobCountFinal = db.prepare('SELECT COUNT(*) AS n FROM seo_ai_jobs WHERE idempotency_key = ?').get(idemKey).n;
  check('still exactly one seo_ai_jobs row after 3 submissions total', jobCountFinal === 1, `count=${jobCountFinal}`);

  // ── QA repair loop (article-pipeline.ts fallback) ───────────────────
  section('QA repair loop — article-pipeline.ts state machine');
  gap(
    'article-pipeline.ts does not exist yet at mi-core/server/src/seo/pipeline/',
    'checked mi-core/server/src/seo/pipeline/ twice (once at task start, once immediately before writing this ' +
    'file) — only pipeline-store.ts, ai-call.ts and content-brief.ts existed (supporting pieces; ' +
    'ai-call.ts even has a __setAiSubmitOverrideForTests() seam clearly built for the pipeline\'s own future ' +
    'test suite, referencing a not-yet-existing __pipeline_tests__/resume-after-restart.mjs). The 3-failed-QA ' +
    '-> BLOCKED terminal-state machine described in the task therefore cannot be exercised directly. Per the ' +
    'task\'s fallback instruction, two independent claim-guard.ts / cannibalization-detector.ts scenarios were ' +
    'used instead as the closest real substitute (see "BLOCKED_UNVERIFIED" and "REJECT" checks above) — these ' +
    'are the two synchronous hard-gate checks the real pipeline is expected to call before/during QA. Once ' +
    'article-pipeline.ts lands, a real 3-attempt-then-BLOCKED test should be added here.',
  );
} finally {
  try { (await import(`../seo-db.ts${cacheBust}`)).getSeoDb().close(); } catch { /* already closed / never opened */ }
  await new Promise(r => setTimeout(r, 200)); // let Windows release the WAL/SHM file handles
  try {
    rmSync(tmpDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  } catch (e) {
    note(`temp dir cleanup failed (non-fatal, OS temp dir, harmless leftover): ${e.message}`);
  }
}

const result = finalize('article.mjs');
process.exit(result.fail > 0 ? 1 : 0);
