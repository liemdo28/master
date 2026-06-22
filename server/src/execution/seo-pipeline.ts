/**
 * DEV5 — Phase E5: Raw Sushi SEO Publish Pipeline
 * 
 * Exact flow CEO expected:
 *   1. Resolve entity: Raw Sushi / rawsushibar.com
 *   2. Pick SEO topic automatically
 *   3. Generate SEO article draft
 *   4. Generate meta title / meta description / slug
 *   5. Generate internal links if available
 *   6. Create preview file
 *   7. Ask CEO approval
 *   8. On approval: commit to local source or CMS draft, sync to GitHub
 *   9. Report result to CEO
 * 
 * No production publish without approval.
 */

import fs from 'fs';
import path from 'path';
import type { ExecutionWorkflow } from './workflow-creation-layer';
import { advanceWorkflowStep, updateWorkflowStatus } from './workflow-creation-layer';

// ── Types ──────────────────────────────────────────────────────────────────

export interface SEOTopic {
  topic: string;
  keywords: string[];
  search_volume_estimate: string;
  competition: 'low' | 'medium' | 'high';
}

export interface SEOMetadata {
  meta_title: string;
  meta_description: string;
  slug: string;
  focus_keyword: string;
  secondary_keywords: string[];
}

export interface SEOArticle {
  title: string;
  content: string;
  excerpt: string;
  metadata: SEOMetadata;
  internal_links: string[];
  word_count: number;
}

export interface SEODraft {
  workflow_id: string;
  entity: string;
  website: string;
  topic: SEOTopic;
  article: SEOArticle;
  preview_path: string;
  image_assets?: SEOImageAssets;
  created_at: string;
}

export interface SEOImageAssets {
  featured_image: string;
  og_image: string;
  social_preview: string;
}

// ── Storage ────────────────────────────────────────────────────────────────

const MI_CORE_ROOT = process.env.MI_CORE_ROOT || 'E:/Project/Master/mi-core';
const DRAFT_DIR = path.join(MI_CORE_ROOT, '.local-agent-global', 'seo-drafts');
const IMAGE_DIR = path.join(MI_CORE_ROOT, '.local-agent-global', 'seo-images');

function ensureDir() {
  fs.mkdirSync(DRAFT_DIR, { recursive: true });
  fs.mkdirSync(IMAGE_DIR, { recursive: true });
}

// ── SEO Topic Auto-Selection ───────────────────────────────────────────────

const RAW_SUSHI_TOPICS: SEOTopic[] = [
  {
    topic: 'Best Omakase Experience in San Antonio 2026',
    keywords: ['omakase san antonio', 'best sushi san antonio', 'raw sushi bar omakase', 'japanese dining san antonio'],
    search_volume_estimate: '1.2K monthly',
    competition: 'medium',
  },
  {
    topic: 'Why Fresh Sashimi Matters: A Guide to Quality Japanese Fish',
    keywords: ['fresh sashimi', 'sashimi quality', 'raw fish freshness', 'sushi grade fish', 'japanese sashimi guide'],
    search_volume_estimate: '2.4K monthly',
    competition: 'low',
  },
  {
    topic: 'Top 10 Sushi Rolls You Must Try at Raw Sushi Bar',
    keywords: ['best sushi rolls', 'must try sushi', 'raw sushi bar menu', 'specialty rolls san antonio'],
    search_volume_estimate: '890 monthly',
    competition: 'low',
  },
  {
    topic: 'Date Night Guide: Romantic Japanese Dining in San Antonio',
    keywords: ['romantic dinner san antonio', 'date night sushi', 'japanese restaurant date', 'fine dining san antonio'],
    search_volume_estimate: '1.8K monthly',
    competition: 'medium',
  },
  {
    topic: 'The Art of Japanese Knife Skills: How Our Sushi Chefs Train',
    keywords: ['sushi chef training', 'japanese knife skills', 'sushi craftsmanship', 'how sushi is made'],
    search_volume_estimate: '720 monthly',
    competition: 'low',
  },
];

function pickTopic(entity: string): SEOTopic {
  if (entity === 'Raw Sushi') {
    // Pick lowest competition topic with good volume
    const sorted = [...RAW_SUSHI_TOPICS].sort((a, b) => {
      const scoreA = a.competition === 'low' ? 3 : a.competition === 'medium' ? 2 : 1;
      const scoreB = b.competition === 'low' ? 3 : b.competition === 'medium' ? 2 : 1;
      return scoreB - scoreA;
    });
    return sorted[0];
  }
  return {
    topic: `SEO Content for ${entity}`,
    keywords: [`${entity.toLowerCase()} menu`, `${entity.toLowerCase()} reviews`, `${entity} near me`],
    search_volume_estimate: '500 monthly',
    competition: 'low',
  };
}

// ── Article Generation ─────────────────────────────────────────────────────

function generateArticle(topic: SEOTopic, entity: string, website: string): SEOArticle {
  const title = topic.topic;
  const focusKeyword = topic.keywords[0];
  const secondaryKeywords = topic.keywords.slice(1);

  const content = `# ${title}

## Introduction

When it comes to authentic Japanese cuisine in San Antonio, few experiences compare to what ${entity} offers. Located at ${website}, ${entity} has been serving the community with the freshest ingredients and traditional techniques passed down through generations.

## What Makes ${entity} Special

### Fresh, Sushi-Grade Fish

At ${entity}, quality starts with sourcing. Every piece of fish is selected for freshness, texture, and flavor. Our commitment to sourcing the best ${focusKeyword} means you get an dining experience that stands above the rest.

### Traditional Techniques

Our sushi chefs train for years to master the art of preparation. From precise knife skills to the perfect rice-to-fish ratio, every detail matters.

### The Omakase Experience

For the adventurous diner, our omakase experience lets the chef guide you through a curated journey of flavors. This is ${focusKeyword} at its finest.

## Menu Highlights

Our menu features a wide selection of:

- **Fresh Sashimi** — Paper-thin slices of the highest quality fish
- **Specialty Rolls** — Creative combinations that surprise and delight
- **Traditional Nigiri** — Classic preparation that lets the fish shine
- **Chef's Omakase** — A multi-course journey through our finest offerings

## Visit Us

${entity} is located in San Antonio, Texas. Whether you're looking for a casual lunch or an unforgettable dinner experience, we welcome you.

**Website:** ${website}
**Location:** San Antonio, TX

## Frequently Asked Questions

### What is the best sushi restaurant in San Antonio?
${entity} consistently ranks among the top Japanese restaurants in San Antonio, known for our fresh ingredients and authentic preparation.

### Do you offer takeout?
Yes, ${entity} offers both dine-in and takeout options. Visit ${website} to place your order.

### What is omakase?
Omakase is a Japanese dining tradition where the chef selects a multi-course meal for you. At ${entity}, our omakase features the freshest seasonal fish available.

---

*Last updated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}*`;

  const metaTitle = `${title} | ${entity} San Antonio`;
  const metaDescription = `Discover why ${entity} is San Antonio's destination for authentic ${focusKeyword}. Fresh fish, traditional techniques, and an unforgettable dining experience at ${website}.`;
  const slug = title.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);

  return {
    title,
    content,
    excerpt: metaDescription.slice(0, 160),
    metadata: {
      meta_title: metaTitle,
      meta_description: metaDescription,
      slug,
      focus_keyword: focusKeyword,
      secondary_keywords: secondaryKeywords,
    },
    internal_links: [
      `${website}/menu`,
      `${website}/omakase`,
      `${website}/reservations`,
      `${website}/about`,
    ],
    word_count: content.split(/\s+/).length,
  };
}

// ── Preview file generation ────────────────────────────────────────────────

function createPreviewFile(draft: SEODraft): string {
  ensureDir();
  const fileName = `seo-preview-${draft.workflow_id}.md`;
  const filePath = path.join(DRAFT_DIR, fileName);

  const previewContent = `# SEO PREVIEW — ${draft.entity}
## Workflow: ${draft.workflow_id}
## Generated: ${draft.created_at}

---

### Topic
${draft.topic.topic}

### SEO Keywords
${draft.topic.keywords.join(', ')}

### Search Volume Estimate
${draft.topic.search_volume_estimate}

### Competition Level
${draft.topic.competition}

---

### Meta Title
${draft.article.metadata.meta_title}

### Meta Description
${draft.article.metadata.meta_description}

### Slug
/${draft.article.metadata.slug}

### Focus Keyword
${draft.article.metadata.focus_keyword}

---

### Internal Links
${draft.article.internal_links.map(l => `- ${l}`).join('\n')}

---

### Article Content (${draft.article.word_count} words)

${draft.article.content}

---

### APPROVAL REQUESTED
Reply APPROVE to publish | EDIT to modify | CANCEL to discard
`;

  fs.writeFileSync(filePath, previewContent);
  return filePath;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapImageText(value: string, maxChars: number, maxLines: number): string[] {
  const words = String(value || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
      if (lines.length >= maxLines) break;
    } else {
      current = next;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/\.*$/, '')}...`;
  }
  return lines.length ? lines : ['Content preview'];
}

function createSvgImage(params: {
  fileName: string;
  width: number;
  height: number;
  title: string;
  subtitle: string;
  label: string;
  entity: string;
}): string {
  ensureDir();
  const filePath = path.join(IMAGE_DIR, params.fileName);
  const label = escapeXml(params.label);
  const entity = escapeXml(params.entity);
  const titleLines = wrapImageText(params.title, params.width >= 1200 ? 24 : 18, 3).map(escapeXml);
  const subtitleLines = wrapImageText(params.subtitle, params.width >= 1200 ? 48 : 34, 2).map(escapeXml);
  const titleSize = params.width >= 1200 ? 70 : 64;
  const titleY = params.height >= 1000 ? 330 : 245;
  const titleText = titleLines
    .map((line, idx) => `<text x="86" y="${titleY + idx * (titleSize + 12)}" font-family="Arial, Helvetica, sans-serif" font-size="${titleSize}" font-weight="800" fill="#ffffff">${line}</text>`)
    .join('\n  ');
  const subtitleStart = titleY + titleLines.length * (titleSize + 12) + 30;
  const subtitleText = subtitleLines
    .map((line, idx) => `<text x="90" y="${subtitleStart + idx * 42}" font-family="Arial, Helvetica, sans-serif" font-size="34" fill="#dbeafe">${line}</text>`)
    .join('\n  ');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${params.width}" height="${params.height}" viewBox="0 0 ${params.width} ${params.height}">
  <rect width="100%" height="100%" fill="#101827"/>
  <rect x="32" y="32" width="${params.width - 64}" height="${params.height - 64}" rx="22" fill="#f8fafc"/>
  <rect x="58" y="58" width="${params.width - 116}" height="${params.height - 116}" rx="18" fill="#111827"/>
  <rect x="86" y="86" width="340" height="58" rx="29" fill="#fee2e2"/>
  <text x="112" y="125" font-family="Arial, Helvetica, sans-serif" font-size="29" font-weight="800" fill="#991b1b">${label}</text>
  <circle cx="${params.width - 128}" cy="116" r="44" fill="#ef4444"/>
  <circle cx="${params.width - 178}" cy="146" r="30" fill="#fb923c"/>
  ${titleText}
  ${subtitleText}
  <text x="90" y="${params.height - 96}" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="800" fill="#fecaca">${entity}</text>
</svg>`;
  fs.writeFileSync(filePath, svg, 'utf8');
  return filePath;
}

function createImageAssets(draft: SEODraft): SEOImageAssets {
  const safeId = draft.workflow_id.replace(/[^a-zA-Z0-9_-]/g, '');
  const entity = draft.entity || 'Raw Sushi';
  const title = draft.topic.topic.length > 48 ? `${draft.topic.topic.slice(0, 45)}...` : draft.topic.topic;
  const subtitle = draft.article.metadata.meta_description.length > 72
    ? `${draft.article.metadata.meta_description.slice(0, 69)}...`
    : draft.article.metadata.meta_description;
  return {
    featured_image: createSvgImage({
      fileName: `featured-${safeId}.svg`,
      width: 1200,
      height: 675,
      title,
      subtitle,
      label: 'Featured image',
      entity,
    }),
    og_image: createSvgImage({
      fileName: `og-${safeId}.svg`,
      width: 1200,
      height: 630,
      title,
      subtitle,
      label: 'Open Graph image',
      entity,
    }),
    social_preview: createSvgImage({
      fileName: `social-${safeId}.svg`,
      width: 1080,
      height: 1080,
      title,
      subtitle,
      label: 'Social preview',
      entity,
    }),
  };
}

// ── Public Pipeline API ────────────────────────────────────────────────────

export function runSEOPipeline(wf: ExecutionWorkflow): SEODraft | null {
  const entity = wf.target_entity || 'Raw Sushi';
  const website = entity === 'Raw Sushi' ? 'rawsushibar.com' : `${entity.toLowerCase().replace(/\s+/g, '')}.com`;

  // Step 1: Resolve entity
  advanceWorkflowStep(wf.workflow_id, 'SEO-1', 'done', `Entity: ${entity}, Website: ${website}`);
  updateWorkflowStatus(wf.workflow_id, 'drafting');

  // Step 2: Pick topic
  const topic = pickTopic(entity);
  advanceWorkflowStep(wf.workflow_id, 'SEO-2', 'done', `Topic: ${topic.topic}`);

  // Step 3: Generate article
  const article = generateArticle(topic, entity, website);
  advanceWorkflowStep(wf.workflow_id, 'SEO-3', 'done', `${article.word_count} words generated`);

  // Step 4: Generate metadata
  advanceWorkflowStep(wf.workflow_id, 'SEO-4', 'done', `Meta: ${article.metadata.meta_title}`);

  // Step 5: Internal links
  advanceWorkflowStep(wf.workflow_id, 'SEO-5', 'done', `${article.internal_links.length} internal links`);

  // Step 6: Create preview file
  const now = new Date().toISOString();
  const draft: SEODraft = {
    workflow_id: wf.workflow_id,
    entity,
    website,
    topic,
    article,
    preview_path: '',
    image_assets: undefined,
    created_at: now,
  };
  const previewPath = createPreviewFile(draft);
  draft.preview_path = previewPath;
  advanceWorkflowStep(wf.workflow_id, 'SEO-6', 'done', previewPath);

  const imageAssets = createImageAssets(draft);
  draft.image_assets = imageAssets;
  advanceWorkflowStep(wf.workflow_id, 'SEO-6', 'done', `Preview: ${previewPath}; Images: ${Object.values(imageAssets).join(', ')}`);

  updateWorkflowStatus(wf.workflow_id, 'draft_created');
  return draft;
}

export { pickTopic, RAW_SUSHI_TOPICS };
