/**
 * SEO Control Center — disabled-write flag certification.
 *
 * These checks prove a normal restart cannot accidentally enable live SEO
 * writes. Missing env vars, empty strings, "0", "false", and "off" all
 * evaluate to disabled; only explicit true-like values enable a flag.
 */

import { mkdtempSync, rmSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { section, check, finalize } from './_harness.mjs';

const tmpDataDir = mkdtempSync(join(tmpdir(), 'seo-disabled-write-data-'));
const tmpBakudanRoot = mkdtempSync(join(tmpdir(), 'seo-disabled-write-bakudan-'));
const tmpRawSushiRoot = mkdtempSync(join(tmpdir(), 'seo-disabled-write-rawsushi-'));
process.env.MI_DATA_DIR = tmpDataDir;
process.env.BAKUDAN_ROOT = tmpBakudanRoot;
process.env.RAWSUSHI_ROOT = tmpRawSushiRoot;

try {
  mkdirSync(join(tmpBakudanRoot, 'blog-drafts'), { recursive: true });
  mkdirSync(join(tmpRawSushiRoot, 'public', 'content', 'posts'), { recursive: true });

  const bust = `?disabled=${Date.now()}`;
  const guards = await import(`../seo-write-guards.ts${bust}`);
  const { bakudanPublisher } = await import(`../publishing/bakudan-publisher.ts${bust}`);
  const { rawSushiPublisher } = await import(`../publishing/raw-sushi-publisher.ts${bust}`);
  const { submitBacklinkForReview } = await import(`../backlinks/backlink-store.ts${bust}`);

  section('Flag parser defaults');
  for (const value of [undefined, null, '', '0', 'false', 'FALSE', 'off', ' OFF ']) {
    check(`false value ${String(value)} stays disabled`, guards.envFlagEnabled(value) === false);
  }
  for (const value of ['1', 'true', 'TRUE', 'on', 'yes', 'enabled']) {
    check(`true value ${value} enables`, guards.envFlagEnabled(value) === true);
  }

  section('All SEO write flags default disabled');
  const flags = guards.getSeoWriteFlags({});
  check('SEO_AUTOMATION_ENABLED default false', flags.SEO_AUTOMATION_ENABLED.enabled === false);
  check('SEO_PRODUCTION_PUBLISH_ENABLED default false', flags.SEO_PRODUCTION_PUBLISH_ENABLED.enabled === false);
  check('SEO_GBP_WRITE_ENABLED default false', flags.SEO_GBP_WRITE_ENABLED.enabled === false);
  check('SEO_WEBSITE_WRITE_ENABLED default false', flags.SEO_WEBSITE_WRITE_ENABLED.enabled === false);
  check('SEO_BACKLINK_WRITE_ENABLED default false', flags.SEO_BACKLINK_WRITE_ENABLED.enabled === false);

  section('Website publish hard-refuses with defaults');
  delete process.env.SEO_PRODUCTION_PUBLISH_ENABLED;
  delete process.env.SEO_WEBSITE_WRITE_ENABLED;
  const bakudanResult = await bakudanPublisher.publishApproved('missing-snapshot-bakudan');
  const rawResult = await rawSushiPublisher.publishApproved('missing-snapshot-raw');
  check('Bakudan publishApproved returns success:false', bakudanResult.success === false);
  check('Bakudan refusal names production flag', /SEO_PRODUCTION_PUBLISH_ENABLED/.test(bakudanResult.error || ''));
  check('Raw Sushi publishApproved returns success:false', rawResult.success === false);
  check('Raw Sushi refusal names production flag', /SEO_PRODUCTION_PUBLISH_ENABLED/.test(rawResult.error || ''));

  section('Backlink evaluation stays review-only');
  const review = submitBacklinkForReview({
    brand_id: 'bakudan',
    source_domain: 'example.com',
    source_url: 'https://example.com/test',
    destination_url: 'https://bakudanramen.com/',
    anchor_text: 'Bakudan Ramen',
    domain_authority: 20,
    page_authority: 10,
    spam_score: 5,
    topical_relevance: 50,
    local_relevance: 50,
    link_type: 'editorial',
    sponsorship: 'none',
  });
  check('backlink evaluation creates PENDING review only', review.backlink.status === 'PENDING');
  check('backlink evaluation does not auto-approve', review.backlink.status !== 'APPROVED');
  check('backlink evaluation records a policy outcome', typeof review.action_outcome === 'string' && review.action_outcome.length > 0);

  finalize('disabled-write-flags.mjs');
} finally {
  for (const dir of [tmpDataDir, tmpBakudanRoot, tmpRawSushiRoot]) {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* OS temp cleanup is non-fatal. */ }
  }
}
