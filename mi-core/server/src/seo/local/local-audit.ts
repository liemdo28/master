/**
 * SEO Control Center — Local SEO Engine: local audit (spec §17).
 *
 * Real, read-only checks for a single brand+location:
 *  1. website_live   — actual outbound fetch (HEAD, falling back to GET) against
 *                       LocationRecord.website_url, same pattern as
 *                       ../links/broken-link-checker.ts.
 *  2. gbp_place_id    — configured and not a PLACEHOLDER_* value.
 *  3. nap_consistency — delegates to ./nap-consistency.ts (never fabricates a
 *                       comparison when no GBP snapshot exists yet).
 *
 * SAFE_AUTO (matches `run_technical_audit` in config/seo-policy.yaml) — this
 * module never writes to any external system, only to seo_audits/seo_issues.
 * Routing the run through submitSeoAction (for the evidence/action trail) is
 * left to the caller (routes/seo-local.ts), matching the pattern used by
 * ../links/broken-link-checker.ts and ../keywords/* engines.
 */

import { getSeoDb, nowIso, seoId } from '../seo-db';
import { getBrandById, getLocationById } from '../brand-config';
import { checkNapConsistency, type NapConsistencyResult } from './nap-consistency';

export interface LocalAuditCheck {
  check: string;
  status: 'pass' | 'fail' | 'warn' | 'skipped';
  detail: string;
}

export interface LocalAuditResult {
  audit_id: string;
  brand_id: string;
  location_id: string;
  started_at: string;
  completed_at: string;
  checks: LocalAuditCheck[];
  issues_created: number;
  nap: NapConsistencyResult;
}

const FETCH_TIMEOUT_MS = 8000;
const USER_AGENT = 'MiCoreSEOBot/1.0 (internal local-SEO audit; +mi-core seo control center)';

async function checkWebsiteLive(url: string | undefined): Promise<LocalAuditCheck> {
  if (!url || url === 'needs_config') {
    return { check: 'website_live', status: 'fail', detail: 'No website_url configured for this location' };
  }
  const target = url.startsWith('http') ? url : `https://${url}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    let res = await fetch(target, { method: 'HEAD', redirect: 'follow', signal: controller.signal, headers: { 'User-Agent': USER_AGENT } });
    if (res.status === 405 || res.status === 501) {
      res = await fetch(target, { method: 'GET', redirect: 'follow', signal: controller.signal, headers: { 'User-Agent': USER_AGENT } });
    }
    clearTimeout(timeout);
    if (res.status >= 200 && res.status < 400) {
      return { check: 'website_live', status: 'pass', detail: `${target} responded HTTP ${res.status}` };
    }
    return { check: 'website_live', status: 'fail', detail: `${target} responded HTTP ${res.status}` };
  } catch (e: unknown) {
    clearTimeout(timeout);
    const err = e as { name?: string; message?: string };
    const message = err?.name === 'AbortError' ? `timeout after ${FETCH_TIMEOUT_MS}ms` : (err?.message || 'fetch_error');
    return { check: 'website_live', status: 'fail', detail: `${target} unreachable: ${message}` };
  }
}

function checkGbpPlaceId(placeId: string | undefined): LocalAuditCheck {
  if (!placeId || placeId === 'needs_config') {
    return { check: 'gbp_place_id', status: 'fail', detail: 'No gbp_place_id configured for this location' };
  }
  if (placeId.startsWith('PLACEHOLDER_')) {
    return { check: 'gbp_place_id', status: 'fail', detail: `gbp_place_id is a placeholder value: ${placeId}` };
  }
  return { check: 'gbp_place_id', status: 'pass', detail: `gbp_place_id configured: ${placeId}` };
}

export async function runLocalAudit(brandId: string, locationId: string): Promise<LocalAuditResult> {
  const db = getSeoDb();
  const auditId = seoId('aud');
  const startedAt = nowIso();

  db.prepare(`
    INSERT INTO seo_audits (id, created_at, brand_id, audit_type, status, summary)
    VALUES (?, ?, ?, 'local', 'running', NULL)
  `).run(auditId, startedAt, brandId);

  const brand = getBrandById(brandId);
  const location = getLocationById(brandId, locationId);
  const checks: LocalAuditCheck[] = [];

  if (!brand || !location) {
    checks.push({
      check: 'location_exists',
      status: 'fail',
      detail: !brand ? `brand_not_found: ${brandId}` : `location_not_found: ${locationId} for brand ${brandId}`,
    });
    const completedAt = nowIso();
    const nap: NapConsistencyResult = { consistent: null, reason: 'location_not_found', brand_id: brandId, location_id: locationId, checked_at: completedAt };
    db.prepare(`UPDATE seo_audits SET status = 'completed', summary = ?, completed_at = ? WHERE id = ?`)
      .run(JSON.stringify({ checks, issues_created: 0 }), completedAt, auditId);
    return { audit_id: auditId, brand_id: brandId, location_id: locationId, started_at: startedAt, completed_at: completedAt, checks, issues_created: 0, nap };
  }

  checks.push(await checkWebsiteLive(location.website_url));
  checks.push(checkGbpPlaceId(location.gbp_place_id));

  const nap = checkNapConsistency(brandId, locationId);
  if (nap.consistent === false) {
    checks.push({ check: 'nap_consistency', status: 'fail', detail: `${nap.conflicts.length} NAP conflict(s) vs GBP snapshot ${nap.gbp_snapshot_id}` });
  } else if (nap.consistent === true) {
    checks.push({ check: 'nap_consistency', status: 'pass', detail: `NAP matches GBP snapshot ${nap.gbp_snapshot_id} on fields: ${nap.fields_compared.join(', ') || '(none comparable)'}` });
  } else {
    checks.push({ check: 'nap_consistency', status: 'skipped', detail: nap.reason });
  }

  const insertIssue = db.prepare(`
    INSERT INTO seo_issues (id, created_at, audit_id, brand_id, severity, issue_type, affected_url, description, safe_auto_fix, approval_required, status)
    VALUES (@id, @created_at, @audit_id, @brand_id, @severity, @issue_type, @affected_url, @description, 0, 1, 'open')
  `);

  let issuesCreated = 0;
  for (const c of checks) {
    if (c.status !== 'fail') continue;
    insertIssue.run({
      id: seoId('iss'),
      created_at: nowIso(),
      audit_id: auditId,
      brand_id: brandId,
      severity: c.check === 'website_live' || c.check === 'gbp_place_id' ? 'critical' : 'warning',
      issue_type: `local_${c.check}`,
      affected_url: location.website_url || null,
      description: `[${locationId}] ${c.detail}`,
    });
    issuesCreated++;
  }

  if (nap.consistent === false) {
    for (const conflict of nap.conflicts) {
      insertIssue.run({
        id: seoId('iss'),
        created_at: nowIso(),
        audit_id: auditId,
        brand_id: brandId,
        severity: 'warning',
        issue_type: 'nap_conflict',
        affected_url: location.website_url || null,
        description: `[${locationId}] NAP mismatch on "${conflict.field}": website="${String(conflict.website_value)}" vs gbp="${String(conflict.gbp_value)}"`,
      });
      issuesCreated++;
    }
  }

  const completedAt = nowIso();
  db.prepare(`UPDATE seo_audits SET status = 'completed', summary = ?, completed_at = ? WHERE id = ?`)
    .run(JSON.stringify({ checks, issues_created: issuesCreated, nap_consistent: nap.consistent }), completedAt, auditId);

  return { audit_id: auditId, brand_id: brandId, location_id: locationId, started_at: startedAt, completed_at: completedAt, checks, issues_created: issuesCreated, nap };
}
