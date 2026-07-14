/**
 * SEO business fact hard-block coverage.
 *
 * Proves restaurant-sensitive claims are blocked unless backed by VERIFIED
 * facts in the matching brand/location scope.
 *
 * Usage:
 *   npx tsx src/seo/__tests__/business-fact-hard-blocks.mjs
 */

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { section, check, finalize } from './_harness.mjs';

process.env.NODE_ENV = 'test';
process.env.MI_DATA_DIR = mkdtempSync(join(tmpdir(), 'seo-fact-hard-blocks-'));

const { getSeoDb, nowIso, seoId } = await import('../seo-db.ts');
const { createFact, setFactStatus } = await import('../facts/fact-registry.ts');
const { checkClaims, checkClaimsHardEnforcement, listClaimCategories } = await import('../facts/claim-guard.ts');

function makeContentId(brandId = 'bakudan') {
  const id = seoId('content');
  getSeoDb().prepare(`
    INSERT INTO seo_content_items (
      id, created_at, updated_at, brand_id, location_id, title, slug, primary_keyword_id,
      search_intent, article_type, status, quality_score, ai_provider, scheduled_publish_at,
      published_at, approval_id, current_version_id, deleted_at
    ) VALUES (?, ?, ?, ?, 'stone_oak', 'Fact Test', NULL, NULL, 'informational', 'blog', 'FACT_QA', NULL, NULL, NULL, NULL, NULL, NULL, NULL)
  `).run(id, nowIso(), nowIso(), brandId);
  return id;
}

section('Claim category coverage');
{
  const required = [
    'menu_item',
    'pricing_promo',
    'hours_current',
    'address',
    'phone',
    'ingredients',
    'preparation',
    'awards',
    'freshness_practice',
    'location_claim',
    'reservation',
    'delivery',
    'takeout',
  ];
  const categories = listClaimCategories();
  for (const category of required) {
    check(`category enforced: ${category}`, categories.includes(category));
  }
}

section('Unsupported claims block');
{
  const text = [
    'Our menu features several ramen options.',
    'Happy hour starts at $9.99.',
    'We are open late and our hours today are convenient.',
    'We are located at 123 Main Street and call us at (210) 555-1212.',
    'The broth is made with 100% chicken and prepared fresh daily.',
    'Bakudan is an award-winning restaurant with fresh daily prep.',
    'We are conveniently located in the heart of Stone Oak.',
    'Reservations are accepted, delivery available, and takeout available.',
  ].join(' ');
  const result = checkClaimsHardEnforcement('bakudan', makeContentId(), text, 'stone_oak');
  const blockedCategories = new Set(result.blocked.map(r => r.claim_category));
  for (const category of ['menu_item', 'pricing_promo', 'hours_current', 'address', 'phone', 'ingredients', 'preparation', 'awards', 'freshness_practice', 'location_claim', 'reservation', 'delivery', 'takeout']) {
    check(`unsupported ${category} claim is BLOCKED_UNVERIFIED`, blockedCategories.has(category));
  }
  check('hard enforcement fails when any sensitive claim lacks a verified fact', result.pass === false);
}

section('Direct remaining hard-block cases');
{
  const conflictFact = createFact({
    brand_id: 'bakudan',
    category: 'awards',
    field_name: 'award',
    value: 'conflicting award record',
    source: 'test',
  });
  setFactStatus(conflictFact.id, 'CONFLICT');
  const conflictResult = checkClaimsHardEnforcement('bakudan', makeContentId(), 'Bakudan is an award-winning restaurant.', 'stone_oak');
  check('BF-CONFLICTING-FACT: CONFLICT fact does not support award claim',
    conflictResult.blocked.some(r => r.claim_category === 'awards'));

  const expiredPromotionFact = createFact({
    brand_id: 'bakudan',
    category: 'pricing_promo',
    field_name: 'happy_hour',
    value: 'happy hour',
    source: 'test',
    expiration_date: new Date(Date.now() - 60 * 1000).toISOString(),
  });
  setFactStatus(expiredPromotionFact.id, 'VERIFIED', { verifiedBy: 'test' });
  const expiredPromotionResult = checkClaimsHardEnforcement('bakudan', makeContentId(), 'Happy hour starts at $9.99.', 'stone_oak');
  check('BF-EXPIRED-PROMOTION: expired promotion fact blocks promo/price claim',
    expiredPromotionResult.blocked.some(r => r.claim_category === 'pricing_promo'));

  const invalidPriceResult = checkClaimsHardEnforcement('bakudan', makeContentId(), 'Happy hour starts at $9.99.', 'stone_oak');
  check('BF-INVALID-PRICE: specific price claim without current verified price fact blocks',
    invalidPriceResult.blocked.some(r => r.claim_category === 'pricing_promo'));

  const invalidHoursResult = checkClaimsHardEnforcement('bakudan', makeContentId(), 'We are open late and hours today are extended.', 'stone_oak');
  check('BF-INVALID-HOURS: current-hours claim without current verified hours fact blocks',
    invalidHoursResult.blocked.some(r => r.claim_category === 'hours_current'));

  const menuItemResult = checkClaimsHardEnforcement('bakudan', makeContentId(), 'Our menu features a signature dish.', 'stone_oak');
  check('BF-UNVERIFIED-MENU-ITEM: unverified menu item claim blocks',
    menuItemResult.blocked.some(r => r.claim_category === 'menu_item'));

  const noMappingContentId = makeContentId();
  const noMappingResult = checkClaimsHardEnforcement('bakudan', noMappingContentId, 'Our menu features a signature dish.', 'stone_oak');
  const noMappingRows = getSeoDb().prepare('SELECT * FROM seo_article_facts WHERE content_id = ?').all(noMappingContentId);
  check('BF-CLAIM-WITHOUT-FACT-MAPPING: blocked claim persists no fact mapping',
    noMappingResult.pass === false && noMappingRows.length === 0);
}

section('Brand/location scope');
{
  const wrongBrandFact = createFact({
    brand_id: 'raw_sushi',
    location_id: 'stone_oak',
    category: 'phone',
    field_name: 'phone',
    value: '(210) 555-1212',
    source: 'test',
  });
  setFactStatus(wrongBrandFact.id, 'VERIFIED', { verifiedBy: 'test' });

  const wrongLocationFact = createFact({
    brand_id: 'bakudan',
    location_id: 'other_location',
    category: 'phone',
    field_name: 'phone',
    value: '(210) 555-1212',
    source: 'test',
  });
  setFactStatus(wrongLocationFact.id, 'LOCATION_SPECIFIC', { verifiedBy: 'test' });

  const results = checkClaims('bakudan', 'Call us at (210) 555-1212.', 'stone_oak');
  check('wrong-brand verified fact does not support claim', results.some(r => r.claim_category === 'phone' && r.status === 'BLOCKED_UNVERIFIED'));
  check('wrong-location location-specific fact does not support claim', !results.some(r => r.supporting_fact_id === wrongLocationFact.id));
}

section('Verified facts support and persist');
{
  const fact = createFact({
    brand_id: 'bakudan',
    location_id: 'stone_oak',
    category: 'phone',
    field_name: 'phone',
    value: '(210) 555-1212',
    source: 'test',
  });
  setFactStatus(fact.id, 'LOCATION_SPECIFIC', { verifiedBy: 'test' });

  const contentId = makeContentId();
  const result = checkClaimsHardEnforcement('bakudan', contentId, 'Call us at (210) 555-1212.', 'stone_oak');
  const rows = getSeoDb().prepare('SELECT * FROM seo_article_facts WHERE content_id = ?').all(contentId);
  check('matching location-specific fact supports claim', result.pass === true && result.supported.some(r => r.supporting_fact_id === fact.id));
  check('supported claim maps to seo_article_facts', rows.length === 1 && rows[0].fact_id === fact.id);

  const rerun = checkClaimsHardEnforcement('bakudan', contentId, 'Call us at (210) 555-1212.', 'stone_oak');
  const rerunRows = getSeoDb().prepare('SELECT * FROM seo_article_facts WHERE content_id = ?').all(contentId);
  check('fact mapping persistence is idempotent', rerun.pass === true && rerunRows.length === 1);
}

section('Expired and do-not-use facts block');
{
  const expiredFact = createFact({
    brand_id: 'bakudan',
    category: 'awards',
    field_name: 'award',
    value: 'Old award',
    source: 'test',
    expiration_date: new Date(Date.now() - 60 * 1000).toISOString(),
  });
  setFactStatus(expiredFact.id, 'VERIFIED', { verifiedBy: 'test' });

  const doNotUseFact = createFact({
    brand_id: 'bakudan',
    category: 'delivery',
    field_name: 'delivery',
    value: 'delivery available',
    source: 'test',
  });
  setFactStatus(doNotUseFact.id, 'DO_NOT_USE');

  const result = checkClaimsHardEnforcement('bakudan', makeContentId(), 'This is an award-winning restaurant and delivery available.', 'stone_oak');
  const blockedCategories = new Set(result.blocked.map(r => r.claim_category));
  check('expired VERIFIED fact is not accepted', blockedCategories.has('awards'));
  check('DO_NOT_USE fact is not accepted', blockedCategories.has('delivery'));
}

section('Fact changed after generation');
{
  const brandId = 'bakudan_fact_changed_after_generation';
  const fact = createFact({
    brand_id: brandId,
    location_id: 'stone_oak',
    category: 'phone',
    field_name: 'phone',
    value: '(210) 555-3434',
    source: 'test',
  });
  setFactStatus(fact.id, 'LOCATION_SPECIFIC', { verifiedBy: 'test' });
  const contentId = makeContentId(brandId);
  const firstPass = checkClaimsHardEnforcement(brandId, contentId, 'Call us at (210) 555-3434.', 'stone_oak');
  setFactStatus(fact.id, 'CONFLICT');
  const secondPass = checkClaimsHardEnforcement(brandId, contentId, 'Call us at (210) 555-3434.', 'stone_oak');
  check('BF-FACT-CHANGED-AFTER-GENERATION: previously supported claim blocks after fact becomes CONFLICT',
    firstPass.pass === true && secondPass.pass === false && secondPass.blocked.some(r => r.claim_category === 'phone'));
}

try {
  rmSync(process.env.MI_DATA_DIR, { recursive: true, force: true });
} catch {}

const result = finalize('business-fact-hard-blocks.mjs');
assert.equal(result.fail, 0);
