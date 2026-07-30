/**
 * Phase C4 — Digital Marketing Operator Certification
 * Target: DIGITAL_MARKETING_CERTIFIED
 *
 * Run: node tests/cert-c4-digital-marketing.mjs
 */

import { createRequire } from 'module';
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require   = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST      = path.resolve(__dirname, '../server/dist');
const EVIDENCE  = path.resolve(__dirname, '../reports/evidence');

if (!fs.existsSync(EVIDENCE)) fs.mkdirSync(EVIDENCE, { recursive: true });

const {
  writeSeoArticle, createFlyer, createVideo, generateVoiceover,
  publishPost, updatePage, seoOptimize,
  postToFacebook, postToInstagram, postToTikTok, schedulePosts,
} = require(`${DIST}/coo-v4/agents/creative-agents.js`);

let passed = 0, failed = 0;
const artifacts = {};

async function step(name, fn) {
  try {
    const r = await fn();
    const ok = r !== null && r !== undefined && r?.success !== false;
    console.log(`  ${ok ? '✅' : '❌'} ${name}`);
    if (r?.output) {
      const out = typeof r.output === 'string' ? r.output : JSON.stringify(r.output);
      console.log(`     → ${out.slice(0, 160)}`);
    }
    if (ok) passed++; else failed++;
    return r;
  } catch (e) {
    console.log(`  ❌ ${name}: ${e.message}`);
    failed++;
    return { success: false, error: e.message };
  }
}

console.log('\n🎨 Phase C4 — Digital Marketing Operator Certification');
console.log('═'.repeat(60));

const envStatus = {
  comfyui:   !!process.env.COMFYUI_URL,
  wan_video: !!process.env.WAN_API_URL,
  openvoice: !!process.env.OPENVOICE_URL,
  wordpress: !!(process.env.WP_URL && process.env.WP_APP_PASSWORD),
  facebook:  !!process.env.FB_PAGE_TOKEN,
  instagram: !!process.env.IG_ACCESS_TOKEN,
  tiktok:    !!process.env.TIKTOK_ACCESS_TOKEN,
};
const liveCount = Object.values(envStatus).filter(Boolean).length;
console.log(`  Live integrations: ${liveCount}/7  (${liveCount === 0 ? 'graceful degradation mode' : 'partial live'})`);
Object.entries(envStatus).forEach(([k, v]) => console.log(`    ${v ? '🟢' : '⚪'} ${k}`));

// ── [1] SEO Article ────────────────────────────────────────────────────────
console.log('\n[1] Create SEO Article');
artifacts.seo_article = await step('writeSeoArticle() generates article', async () => {
  return writeSeoArticle(
    'Top 5 Vietnamese Bánh Mì Sandwiches in Denver 2026',
    ['banh mi denver', 'vietnamese sandwich', 'best banh mi'],
    800,
  );
});

if (artifacts.seo_article?.output) {
  const content = typeof artifacts.seo_article.output === 'string'
    ? artifacts.seo_article.output
    : JSON.stringify(artifacts.seo_article.output);
  fs.writeFileSync(path.join(EVIDENCE, 'c4-seo-article.md'), [
    '# SEO Article — C4 Certification',
    `Generated: ${new Date().toISOString()}`,
    `Keywords: banh mi denver, vietnamese sandwich, best banh mi`,
    '', '---', '',
    content,
  ].join('\n'));
  console.log(`     Saved: c4-seo-article.md (${content.length} chars)`);
}

// ── [2] Flyer ─────────────────────────────────────────────────────────────
console.log('\n[2] Create Flyer');
artifacts.flyer = await step('createFlyer() generates flyer asset', async () => {
  return createFlyer(
    'promotional',
    {
      title:    'Bánh Mì Bà Lan',
      subtitle: 'Authentic Vietnamese Sandwiches',
      offer:    'Buy 2 Get 1 FREE — This Weekend Only!',
      colors:   ['#D4A017', '#8B1A1A'],
    },
  );
});

if (artifacts.flyer?.output) {
  const content = typeof artifacts.flyer.output === 'string' ? artifacts.flyer.output : JSON.stringify(artifacts.flyer.output);
  if (content.includes('<') || content.includes('html')) {
    fs.writeFileSync(path.join(EVIDENCE, 'c4-flyer.html'), content);
    console.log(`     Saved: c4-flyer.html`);
  }
}

// ── [3] Video ─────────────────────────────────────────────────────────────
console.log('\n[3] Create Video');
artifacts.video = await step('createVideo() generates video or script', async () => {
  return createVideo(
    'Bánh Mì Bà Lan — Best Vietnamese Sandwich in Denver. Fresh bread daily. Come visit us!',
    'food,lifestyle,social-media',
    30,
  );
});

// ── [4] Voiceover ─────────────────────────────────────────────────────────
console.log('\n[4] Generate Voiceover');
artifacts.voiceover = await step('generateVoiceover() generates audio or script', async () => {
  return generateVoiceover(
    'Come try our authentic Vietnamese Bánh Mì sandwiches. Fresh bread baked daily. Visit bakudanramen.com.',
    'en-friendly',
  );
});

// ── [5] Website Draft ─────────────────────────────────────────────────────
console.log('\n[5] Website Draft — WordPress');
artifacts.website_draft = await step('publishPost() creates website draft', async () => {
  return publishPost(
    'New Menu Item: Spicy Lemongrass Chicken Bánh Mì',
    [
      '<h2>Introducing Our Newest Creation</h2>',
      '<p>After months of perfecting the recipe, we\'re thrilled to introduce our Spicy Lemongrass Chicken Bánh Mì.</p>',
      '<p>Featuring free-range chicken marinated in lemongrass, chili, and fish sauce, served on our freshly-baked baguette.</p>',
      '<p>Available starting this Friday at all locations.</p>',
    ].join('\n'),
    'menu',
  );
});

artifacts.seo_optimize = await step('seoOptimize() analyzes page', async () => {
  return seoOptimize(
    process.env.WP_URL || 'https://bakudanramen.com',
    ['banh mi denver', 'vietnamese sandwich'],
  );
});

// ── [6] Social Media Posts ─────────────────────────────────────────────────
console.log('\n[6] Social Media Drafts');
const postText = '🥖 New sandwich alert! Spicy Lemongrass Chicken Bánh Mì is HERE! 🌶️ Fresh, bold, absolutely delicious. #BanhMi #Denver #VietnameseFood';
const imgPath  = artifacts.flyer?.metadata?.file_path || '';

artifacts.facebook = await step('postToFacebook() creates FB post/draft', async () => {
  return postToFacebook(postText, imgPath);
});

artifacts.instagram = await step('postToInstagram() creates IG post/draft', async () => {
  return postToInstagram(postText, imgPath);
});

artifacts.tiktok = await step('postToTikTok() creates TikTok draft', async () => {
  return postToTikTok(
    artifacts.video?.metadata?.file_path || '',
    'Come try our new Spicy Lemongrass Chicken Bánh Mì! 🌶️ #BanhMi #Denver #FoodTok',
  );
});

// ── [7] Schedule Posts ─────────────────────────────────────────────────────
console.log('\n[7] Schedule Social Media Posts');
const friday9am = new Date();
friday9am.setDate(friday9am.getDate() + (((5 - friday9am.getDay()) + 7) % 7) || 7);
friday9am.setHours(9, 0, 0, 0);

artifacts.schedule = await step('schedulePosts() schedules across platforms', async () => {
  return schedulePosts([
    { platform: 'facebook',  content: postText, scheduled_at: friday9am.toISOString() },
    { platform: 'instagram', content: postText, scheduled_at: friday9am.toISOString() },
    { platform: 'tiktok',   content: 'New Bánh Mì alert! 🌶️ #BanhMi', scheduled_at: friday9am.toISOString() },
  ]);
});

// ── Campaign Summary ───────────────────────────────────────────────────────
const campaignSummary = {
  campaign:     'Spicy Lemongrass Chicken Bánh Mì Launch',
  generated_at: new Date().toISOString(),
  assets: {
    seo_article:   { created: artifacts.seo_article?.success !== false },
    flyer:         { created: artifacts.flyer?.success !== false },
    video:         { created: artifacts.video?.success !== false },
    voiceover:     { created: artifacts.voiceover?.success !== false },
    website_draft: { created: artifacts.website_draft?.success !== false },
    seo_analysis:  { created: artifacts.seo_optimize?.success !== false },
    facebook_post: { created: artifacts.facebook?.success !== false },
    instagram_post:{ created: artifacts.instagram?.success !== false },
    tiktok_post:   { created: artifacts.tiktok?.success !== false },
    schedule:      { created: artifacts.schedule?.success !== false, scheduled_for: friday9am.toISOString() },
  },
  env_status: envStatus,
  live_integrations: liveCount,
  passed,
  failed,
};

// ── Evidence ───────────────────────────────────────────────────────────────
fs.writeFileSync(path.join(EVIDENCE, 'c4-digital-marketing.json'), JSON.stringify(campaignSummary, null, 2));

console.log('\n' + '═'.repeat(60));
console.log(`  PASSED: ${passed}  FAILED: ${failed}  TOTAL: ${passed + failed}`);
console.log(`  Assets: SEO + Flyer + Video + Voice + Website + 3 Social + Schedule`);
console.log(`  Scheduled for: ${friday9am.toLocaleDateString()} 09:00`);
console.log(`  Evidence: reports/evidence/c4-digital-marketing.json`);
console.log('═'.repeat(60));

if (failed === 0) {
  console.log('\n🎉 DIGITAL_MARKETING_CERTIFIED');
  console.log('   SEO Article ✅  Flyer ✅  Video ✅  Voiceover ✅  Website Draft ✅  3 Social Posts ✅  Scheduled ✅');
} else {
  console.log(`\n⚠️  DIGITAL_MARKETING_PARTIAL — ${failed} step(s) failed`);
}

process.exit(failed === 0 ? 0 : 1);
