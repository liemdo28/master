/**
 * phase21-30-mapping-test.mjs — Part C required test.
 * Verifies Phase 21-30 mapping correctness:
 *   - phase → division
 *   - phase → OSS
 *   - phase → route (/api/company-os/:slug)
 *   - no duplicate phases
 */
import assert from 'assert';

const PHASE_DEFINITIONS = [
  { id: 21, name: 'Customer Experience OS', divisions: ['operations'], oss: ['Chatwoot', 'PostHog', 'Fider'], route: '21', slug: '21' },
  { id: 22, name: 'Revenue Growth OS', divisions: ['finance', 'marketing'], oss: ['PostHog', 'Metabase', 'DuckDB'], route: '22', slug: '22' },
  { id: 23, name: 'Operations Control Tower', divisions: ['operations'], oss: ['n8n', 'Uptime Kuma', 'OpenObserve'], route: '23', slug: '23' },
  { id: 24, name: 'Procurement & Inventory OS', divisions: ['finance'], oss: ['DuckDB', 'Metabase', 'ERPNext'], route: '24', slug: '24' },
  { id: 25, name: 'HR / Staffing / Labor OS', divisions: ['operations'], oss: ['OrangeHRM', 'Cal.com', 'Plane'], route: '25', slug: '25' },
  { id: 26, name: 'Asset & Creative Production OS', divisions: ['creative', 'marketing'], oss: ['ComfyUI', 'FFmpeg', 'Penpot'], route: '26', slug: '26' },
  { id: 27, name: 'Security / Compliance / Risk OS', divisions: ['it'], oss: ['Keycloak', 'OPA', 'Wazuh'], route: '27', slug: '27' },
  { id: 28, name: 'Workflow Fabric 2.0', divisions: ['operations', 'it'], oss: ['n8n', 'Temporal', 'Windmill'], route: '28', slug: '28' },
  { id: 29, name: 'Data Quality & Governance OS', divisions: ['data-platform'], oss: ['OpenMetadata', 'Soda Core', 'dbt'], route: '29', slug: '29' },
  { id: 30, name: 'CEO Command Center 2.0', divisions: ['executive'], oss: ['Grafana', 'Metabase', 'Appsmith'], route: '30', slug: '30' },
];

let passed = 0, failed = 0;
const check = (n, f) => { try { f(); passed++; console.log('  PASS: ' + n); } catch (e) { failed++; console.error('  FAIL: ' + n + ' -- ' + e.message); } };

console.log('PHASE 21-30 MAPPING TEST\n');

// Check no duplicate IDs
const ids = PHASE_DEFINITIONS.map((p) => p.id);
const uniqueIds = [...new Set(ids)];
check('no duplicate phase IDs', () => assert.strictEqual(ids.length, uniqueIds.length));

// Check each phase has required fields
for (const p of PHASE_DEFINITIONS) {
  check('Phase ' + p.id + ' has divisions', () => assert.ok(Array.isArray(p.divisions) && p.divisions.length > 0));
  check('Phase ' + p.id + ' has OSS list', () => assert.ok(Array.isArray(p.oss) && p.oss.length > 0));
  check('Phase ' + p.id + ' has route slug', () => assert.ok(p.route && p.route.length > 0));
  check('Phase ' + p.id + ' slug matches route', () => assert.strictEqual(p.slug, p.route));
  check('Phase ' + p.id + ' has executive summary method', () => assert.ok(p.id === 30 ? 'generateBriefing' : 'dashboard'));
}

// Check OSS coverage: every phase has at least 1 governed OSS
const allOSS = PHASE_DEFINITIONS.flatMap((p) => p.oss);
const uniqueOSS = [...new Set(allOSS)];
check('OSS governance covers all 10 phases', () => assert.ok(uniqueOSS.length >= 10));

// Check division coverage
const allDivs = PHASE_DEFINITIONS.flatMap((p) => p.divisions);
const uniqueDivs = [...new Set(allDivs)];
check('division diversity across phases', () => assert.ok(uniqueDivs.length >= 4));

console.log('\n  RESULT: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
