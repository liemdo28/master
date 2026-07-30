// kb/pipeline/WikipediaFetcher.js — fetch articles via Wikipedia Action API (no scraping)
// Uses extracts API: plain text, no HTML parsing needed.
// Rate limit: max 1 req/200ms, respects User-Agent policy.
// User-Agent format follows https://meta.wikimedia.org/wiki/User-Agent_policy

// Wikipedia User-Agent policy requires: <client-name>/<version> (<contact>)
const UA  = 'local-offline-kb/1.0 (https://github.com/liemdo28/agent-coding; contact: kb-build)';
const API = 'https://en.wikipedia.org/w/api.php';
const DELAY_MS    = 220;   // ~4.5 req/s — well under Wikipedia's 200 req/s limit
const MAX_RETRIES = 3;     // retry on transient errors (429, 5xx, network)

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function fetchJSON(url) {
  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (res.status === 429) {
        // Rate-limited — back off exponentially
        const wait = Math.pow(2, attempt + 1) * 1000;
        await sleep(wait);
        continue;
      }
      if (res.status >= 500) {
        lastErr = new Error(`HTTP ${res.status}`);
        await sleep(Math.pow(2, attempt) * 500);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      return res.json();
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRIES) await sleep(Math.pow(2, attempt) * 500);
    }
  }
  throw lastErr;
}

/**
 * Fetch a single Wikipedia article's plain-text extract.
 * Returns { title, extract, url, categories } or null on 404.
 */
export async function fetchArticle(title) {
  const params = new URLSearchParams({
    action:      'query',
    prop:        'extracts|info|categories',
    explaintext: '1',
    inprop:      'url',
    format:      'json',
    titles:      title,
    redirects:   '1',
    exlimit:     '1',
    cllimit:     '20',
  });

  const data  = await fetchJSON(`${API}?${params}`);
  const pages = data?.query?.pages ?? {};
  const page  = Object.values(pages)[0];

  if (!page || page.missing !== undefined || !page.extract) return null;

  return {
    title:      page.title,
    extract:    page.extract,
    url:        page.fullurl ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g,'_'))}`,
    categories: (page.categories ?? []).map((c) => c.title.replace('Category:', '')),
    wordCount:  page.extract.split(/\s+/).length,
  };
}

/**
 * Fetch multiple articles with rate limiting.
 * @param {string[]} titles
 * @param {{ onProgress?, batchSize? }} opts
 * @returns {{ article, error }[]}
 */
export async function fetchArticles(titles, { onProgress, batchSize = 1 } = {}) {
  const results = [];

  for (let i = 0; i < titles.length; i += batchSize) {
    const batch = titles.slice(i, i + batchSize);

    for (const title of batch) {
      try {
        const article = await fetchArticle(title);
        results.push({ title, article, error: null });
        if (onProgress) onProgress({ done: results.length, total: titles.length, title, ok: !!article });
      } catch (err) {
        results.push({ title, article: null, error: err.message });
        if (onProgress) onProgress({ done: results.length, total: titles.length, title, ok: false, err: err.message });
      }
      await sleep(DELAY_MS);
    }
  }

  return results;
}

/**
 * Convert Wikipedia plain-text extract to structured markdown.
 * Wikipedia extracts use == Section == headings and plain paragraphs.
 */
export function extractToMarkdown(title, extract, url, license = 'CC BY-SA 4.0') {
  const lines = extract.split('\n');
  const md    = [`# ${title}\n`];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { md.push(''); continue; }

    // Convert == Heading == → ## Heading
    const h2 = trimmed.match(/^==\s*(.+?)\s*==$/);
    if (h2) { md.push(`## ${h2[1]}\n`); continue; }

    const h3 = trimmed.match(/^===\s*(.+?)\s*===$/);
    if (h3) { md.push(`### ${h3[1]}\n`); continue; }

    const h4 = trimmed.match(/^====\s*(.+?)\s*====$/);
    if (h4) { md.push(`#### ${h4[1]}\n`); continue; }

    md.push(trimmed);
  }

  md.push('');
  md.push('---');
  md.push(`*Source: [Wikipedia — ${title}](${url}) — ${license} — Wikipedia contributors*`);

  return md.join('\n');
}
