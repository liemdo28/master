/**
 * Raw Website Connector — Mi-Core → rawsushibar.com
 *
 * Calls the Cloudflare Pages Functions API to create, approve, and publish
 * SEO articles to rawsushibar.com.
 *
 * Required env vars (in server/.env):
 *   RAWWEBSITE_ADMIN_SECRET  — Bearer token for admin API auth
 *   RAWWEBSITE_API_BASE      — Base URL (default: https://www.rawsushibar.com)
 */

import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

const API_BASE = process.env.RAWWEBSITE_API_BASE || 'https://www.rawsushibar.com';
const ADMIN_SECRET = process.env.RAWWEBSITE_ADMIN_SECRET || '';

export interface ArticlePayload {
  title: string;
  slug: string;
  body: string;
  excerpt?: string;
  meta_description?: string;
  primary_keyword?: string;
  secondary_keywords?: string[];
  cta?: string;
  cta_url?: string;
  post_type?: string;
  target_audience?: string;
  location?: 'raw_stockton' | 'raw_modesto';
}

export interface PublishResult {
  ok: boolean;
  post_id?: string;
  url?: string;
  git_commit?: string;
  error?: string;
  steps: string[];
}

function apiRequest(method: string, path: string, body?: object): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;
    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ADMIN_SECRET}`,
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    };
    const req = lib.request(options, (res) => {
      let raw = '';
      res.on('data', (c: string) => { raw += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode || 0, data: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode || 0, data: raw }); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function slug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[àáâãäå]/g, 'a').replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i').replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u').replace(/[ý]/g, 'y')
    .replace(/đ/g, 'd').replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-').replace(/-+/g, '-')
    .slice(0, 80).replace(/^-|-$/g, '');
}

/**
 * Full publish pipeline: create → approve → publish → verify URL.
 */
export async function publishArticle(article: ArticlePayload): Promise<PublishResult> {
  if (!ADMIN_SECRET) {
    return { ok: false, error: 'RAWWEBSITE_ADMIN_SECRET not configured in server/.env', steps: [] };
  }

  const steps: string[] = [];
  const postSlug = article.slug || slug(article.title);
  const payload = { ...article, slug: postSlug, status: 'draft' };

  // Step 1: Create draft post
  steps.push('create_draft');
  const createRes = await apiRequest('POST', '/api/agent/jobs', {
    command: 'content.post.create',
    payload,
    created_by: 'mi-core',
  });

  if (createRes.status !== 200 || !createRes.data?.data?.job?.result?.post?.id) {
    return {
      ok: false,
      error: `create failed (${createRes.status}): ${JSON.stringify(createRes.data).slice(0, 200)}`,
      steps,
    };
  }

  const postId: string = createRes.data.data.job.result.post.id;
  steps.push(`created: ${postId}`);

  // Step 2: Approve post
  steps.push('approve');
  const approveRes = await apiRequest('POST', '/api/agent/jobs', {
    command: 'content.post.approve',
    payload: { id: postId },
    created_by: 'mi-core',
  });
  if (approveRes.status !== 200) {
    return {
      ok: false, post_id: postId,
      error: `approve failed (${approveRes.status})`,
      steps,
    };
  }
  steps.push('approved');

  // Step 3: Publish (triggers Git commit → Cloudflare Pages build)
  steps.push('publish');
  const publishRes = await apiRequest('POST', `/api/content/publish?id=${postId}`, undefined);
  if (publishRes.status !== 200) {
    return {
      ok: false, post_id: postId,
      error: `publish failed (${publishRes.status}): ${JSON.stringify(publishRes.data).slice(0, 200)}`,
      steps,
    };
  }

  const gitCommit: string | undefined = publishRes.data?.data?.git?.commit;
  const publishedSlug: string = publishRes.data?.data?.post?.slug || postSlug;
  steps.push(`published: git=${gitCommit || 'n/a'}`);

  // Step 4: Derive public URL
  const articleUrl = `${API_BASE}/blog-posts.html?slug=${publishedSlug}`;
  steps.push(`url: ${articleUrl}`);

  // Step 5: Verify URL is reachable (best effort, CF Pages build may take ~60s)
  const urlCheck = await verifyUrl(articleUrl);
  steps.push(`url_check: ${urlCheck}`);

  return {
    ok: true,
    post_id: postId,
    url: articleUrl,
    git_commit: gitCommit,
    steps,
  };
}

/**
 * Retrieve article URL for an already-published post slug.
 */
export function getArticleUrl(postSlug: string): string {
  return `${API_BASE}/blog-posts.html?slug=${postSlug}`;
}

/**
 * HTTP probe to verify a URL returns 200.
 */
export async function verifyUrl(url: string): Promise<string> {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const isHttps = parsed.protocol === 'https:';
      const lib = isHttps ? https : http;
      const req = lib.request({
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'HEAD',
        headers: { 'User-Agent': 'Mi-Core-Reality-Gate/1.0' },
      }, (res) => {
        resolve(`HTTP ${res.statusCode}`);
      });
      req.setTimeout(8000, () => { req.destroy(); resolve('timeout'); });
      req.on('error', (e) => resolve(`error: ${e.message}`));
      req.end();
    } catch (e: any) {
      resolve(`exception: ${e.message}`);
    }
  });
}
