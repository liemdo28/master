/**
 * SEO Control Center — Internal Link Engine: broken-link checker (spec §15).
 *
 * IMPLEMENTED FOR REAL: this makes actual outbound HTTP HEAD/GET requests to
 * the brand's live site (e.g. bakudanramen.com, rawsushibar.com) — read-only
 * GET/HEAD requests to public production pages are exactly what an SEO
 * crawler is supposed to do, and are safe. No write/mutating requests are
 * ever made to a third-party site.
 *
 * Policy: `detect_broken_link` is SAFE_AUTO in config/seo-policy.yaml, but
 * every run still goes through submitSeoAction() first (so it's logged in
 * seo_actions / evidenced like every other SEO action) and records a second,
 * results-bearing evidence entry once the scan completes.
 */

import { getSeoDb, nowIso } from '../seo-db';
import { submitSeoAction } from '../seo-approval-bridge';
import { recordEvidence } from '../seo-evidence';

export interface LinkCheckResult {
  id: string;
  source_url: string;
  target_url: string;
  previous_status: string;
  new_status: 'active' | 'broken';
  http_status: number | null;
  error: string | null;
  checked_at: string;
}

export interface BrokenLinkCheckReport {
  brand_id: string;
  checked_count: number;
  broken_count: number;
  results: LinkCheckResult[];
  action_outcome: string;
  evidence_id: string;
}

const CHECK_TIMEOUT_MS = 8000;
const USER_AGENT = 'MiCoreSEOBot/1.0 (internal link health checker; +mi-core seo control center)';

interface UrlCheckOutcome {
  status: 'active' | 'broken';
  httpStatus: number | null;
  error: string | null;
}

async function checkUrl(url: string): Promise<UrlCheckOutcome> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  try {
    let res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT },
    });
    // Some servers reject HEAD (405/501) even though the resource is fine — retry with GET.
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT },
      });
    }
    clearTimeout(timeout);
    if (res.status >= 200 && res.status < 400) {
      return { status: 'active', httpStatus: res.status, error: null };
    }
    return { status: 'broken', httpStatus: res.status, error: `HTTP ${res.status}` };
  } catch (e: unknown) {
    clearTimeout(timeout);
    const err = e as { name?: string; message?: string };
    const message = err?.name === 'AbortError' ? `timeout after ${CHECK_TIMEOUT_MS}ms` : (err?.message || 'fetch_error');
    return { status: 'broken', httpStatus: null, error: message };
  }
}

/**
 * Checks every non-removed internal link for a brand against its real target
 * URL, updates seo_internal_links.status/last_verified_at accordingly, and
 * returns a full report. Distinct target URLs are checked once and the
 * result is fanned back out to every link row pointing at that URL.
 */
export async function runBrokenLinkCheck(brandId: string): Promise<BrokenLinkCheckReport> {
  const db = getSeoDb();

  const idempotencyKey = `detect_broken_link:${brandId}:${new Date().toISOString().slice(0, 13)}`; // hourly bucket
  const actionOutcome = submitSeoAction({
    category: 'detect_broken_link',
    brand_id: brandId,
    description: `Broken internal link scan for brand ${brandId}`,
    target: `brand:${brandId}`,
    idempotency_key: idempotencyKey,
  });

  const links = db.prepare(`SELECT * FROM seo_internal_links WHERE brand_id = ? AND status != 'removed'`)
    .all(brandId) as { id: string; source_url: string; target_url: string; status: string }[];

  const targets = Array.from(new Set(links.map(l => l.target_url)));
  const targetStatus = new Map<string, UrlCheckOutcome>();
  for (const target of targets) {
    targetStatus.set(target, await checkUrl(target));
  }

  const now = nowIso();
  const results: LinkCheckResult[] = [];
  for (const link of links) {
    const check = targetStatus.get(link.target_url) as UrlCheckOutcome;
    db.prepare('UPDATE seo_internal_links SET status = ?, last_verified_at = ? WHERE id = ?')
      .run(check.status, now, link.id);
    results.push({
      id: link.id,
      source_url: link.source_url,
      target_url: link.target_url,
      previous_status: link.status,
      new_status: check.status,
      http_status: check.httpStatus,
      error: check.error,
      checked_at: now,
    });
  }

  const brokenCount = results.filter(r => r.new_status === 'broken').length;

  const evidence = recordEvidence({
    brand_id: brandId,
    category: 'detect_broken_link',
    summary: `Checked ${results.length} internal links for ${brandId} (${targets.length} distinct targets), ${brokenCount} broken`,
    payload: { results, distinct_targets_checked: targets.length },
  });

  return {
    brand_id: brandId,
    checked_count: results.length,
    broken_count: brokenCount,
    results,
    action_outcome: actionOutcome.outcome,
    evidence_id: evidence.id,
  };
}
