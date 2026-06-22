// kb/pipeline/MDNFetcher.js — BUILD-TIME TOOL — fetches MDN Web Docs content
// License: CC BY-SA 2.5 (Mozilla contributors)
// Policy: https://developer.mozilla.org/en-US/docs/MDN/Writing_guidelines/Attrib_copyright_license
//
// Fetches from MDN GitHub content repo (more reliable than the api/v1/doc endpoint
// which changed format with the Yari platform migration):
//   https://raw.githubusercontent.com/mdn/content/main/files/en-us/<slug>/index.md

const UA          = 'local-offline-kb/1.0 (https://github.com/liemdo28/agent-coding; contact: kb-build)';
const MDN_BASE    = 'https://developer.mozilla.org';
const GITHUB_RAW  = 'https://raw.githubusercontent.com/mdn/content/main/files/en-us';
const DELAY_MS    = 300;
const MAX_RETRIES = 3;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchText(url) {
  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (res.status === 429) { await sleep(Math.pow(2, attempt + 1) * 1000); continue; }
      if (res.status === 404) return null;
      if (res.status >= 500) {
        lastErr = new Error(`HTTP ${res.status}`);
        await sleep(Math.pow(2, attempt) * 500);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      return res.text();
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRIES) await sleep(Math.pow(2, attempt) * 500);
    }
  }
  throw lastErr;
}

/**
 * Fetch a single MDN page by its path slug.
 * @param {string} slug e.g. "Web/JavaScript/Reference/Global_Objects/Promise"
 * @returns {{ title, extract, url, wordCount } | null}
 */
export async function fetchMDNPage(slug) {
  // GitHub path: lowercase, underscores preserved, slashes preserved
  const ghPath = slug.toLowerCase();
  const rawUrl = `${GITHUB_RAW}/${ghPath}/index.md`;

  const md = await fetchText(rawUrl);
  if (!md) return null;

  // Parse YAML frontmatter
  const fmMatch = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!fmMatch) return null;

  const frontmatter = fmMatch[1];
  const body        = fmMatch[2].trim();

  // Extract title from frontmatter
  const titleMatch = frontmatter.match(/^title:\s*["']?(.+?)["']?\s*$/m);
  const title = titleMatch
    ? titleMatch[1].trim()
    : slug.split('/').pop().replace(/_/g, ' ');

  if (!body || body.length < 100) return null;

  // Strip JSX/HTML macro calls {{...}} common in MDN markdown
  const cleaned = body
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  const text = `# ${title}\n\n${cleaned}\n\n---\n*Source: [MDN Web Docs — ${title}](${MDN_BASE}/en-US/docs/${slug}) — CC BY-SA 2.5 — Mozilla contributors*`;
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  if (wordCount < 30) return null;

  return {
    title,
    extract: text,
    url:      `${MDN_BASE}/en-US/docs/${slug}`,
    categories: [],
    wordCount,
    license: 'CC BY-SA 2.5',
    source:  'MDN Web Docs',
  };
}

/**
 * Fetch multiple MDN pages with rate limiting.
 * @param {string[]} slugs
 * @param {{ onProgress? }} opts
 * @returns {{ slug, article, error }[]}
 */
export async function fetchMDNPages(slugs, { onProgress } = {}) {
  const results = [];

  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i];
    try {
      const article = await fetchMDNPage(slug);
      results.push({ slug, article, error: null });
      if (onProgress) onProgress({ done: i + 1, total: slugs.length, slug, ok: !!article });
    } catch (err) {
      results.push({ slug, article: null, error: err.message });
      if (onProgress) onProgress({ done: i + 1, total: slugs.length, slug, ok: false, err: err.message });
    }
    await sleep(DELAY_MS);
  }

  return results;
}
