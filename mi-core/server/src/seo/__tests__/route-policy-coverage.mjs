import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { section, check, finalize } from './_harness.mjs';
import { ROUTE_POLICIES } from '../seo-security.ts';

const routeFiles = [
  'seo.ts',
  'seo-calendar.ts',
  'seo-evidence-route.ts',
  'seo-links.ts',
  'seo-local.ts',
  'seo-reports.ts',
  'seo-research.ts',
];

function normalizeExpressPath(p) {
  return p.replace(/:([A-Za-z0-9_]+)/g, ':$1');
}

function mutationRoutes() {
  const out = [];
  for (const file of routeFiles) {
    const text = readFileSync(join(process.cwd(), 'src', 'routes', file), 'utf8');
    const re = /\.((?:post|put|patch|delete))\(\s*['"`]([^'"`]+)['"`]/g;
    let match;
    while ((match = re.exec(text)) !== null) {
      out.push({ method: match[1].toUpperCase(), routeKey: normalizeExpressPath(match[2]), file });
    }
  }
  return out;
}

section('Route policy coverage');
{
  const policies = new Set(ROUTE_POLICIES.flatMap(policy => policy.methods.map(method => `${method} ${policy.routeKey}`)));
  const routes = mutationRoutes();
  const missing = routes.filter(route => !policies.has(`${route.method} ${route.routeKey}`));
  const highRiskMissingApproval = ROUTE_POLICIES.filter(policy => policy.highRisk && (!policy.approvalCategory || !policy.approvalAction));
  check('every SEO mutation route has an explicit route policy', missing.length === 0, JSON.stringify(missing));
  check('every high-risk policy has approval category/action', highRiskMissingApproval.length === 0, JSON.stringify(highRiskMissingApproval));
}

const result = finalize('route-policy-coverage.mjs');
assert.equal(result.fail, 0);
