/**
 * Disposable fixture repositories for the Phase 4 task suite and model benchmark.
 *
 * These are deliberately varied in filename, structure, naming convention and
 * requested behaviour so that no single prompt shape or path pattern can carry
 * an engine through all of them. The engine never sees this file; it only ever
 * sees a materialised worktree and a context pack derived from it.
 *
 * Each fixture ships with a seeded defect or gap and a `verify` command that is
 * independent of the engine's own reasoning.
 */

export interface FixtureFile {
  path: string;
  content: string;
}

export interface Fixture {
  id: string;
  category: 'bug-fix' | 'multi-file-feature' | 'type-repair' | 'refactor' | 'unfamiliar-repo';
  title: string;
  /** The request handed to the engine. Never names the defect directly. */
  userRequest: string;
  files: FixtureFile[];
  /** Commands run inside the fixture to decide pass/fail, in order. */
  validationCommands: string[];
  /** Paths offered as context-pack candidates. */
  includedPaths: string[];
  excludedPaths: string[];
  moduleSummaries: string[];
  summary: string;
}

const NODE_TEST_PKG = (name: string, extra: Record<string, string> = {}) =>
  JSON.stringify(
    {
      name,
      version: '1.0.0',
      private: true,
      type: 'commonjs',
      // test:coding mirrors test so the real workflow's validation plan,
      // which always runs that script, resolves against these fixtures too.
      scripts: { test: 'node --test', 'test:coding': 'node --test', ...extra },
    },
    null,
    2
  ) + '\n';

// ── Task A — targeted bug fix ────────────────────────────────────────────────
// Seeded defect: inclusive/exclusive boundary error in a date-range check.
const FIXTURE_A: Fixture = {
  id: 'task-a-bug-fix',
  category: 'bug-fix',
  title: 'Targeted bug fix from a failing unit test',
  userRequest:
    'The booking availability check rejects a slot that ends exactly when the next one begins. Fix the overlap logic so back-to-back slots are allowed. Do not change the tests.',
  summary: 'Booking availability library with slot overlap detection.',
  moduleSummaries: ['lib/availability.js — slot overlap and conflict detection', 'test/availability.test.js — unit tests'],
  includedPaths: ['lib/availability.js', 'test/availability.test.js'],
  excludedPaths: ['node_modules', '.git'],
  validationCommands: ['npm test'],
  files: [
    { path: 'package.json', content: NODE_TEST_PKG('booking-availability') },
    {
      path: 'lib/availability.js',
      content: `'use strict';

/**
 * A slot is { startMinute, endMinute } where end is exclusive.
 */
function overlaps(a, b) {
  return a.startMinute <= b.endMinute && b.startMinute <= a.endMinute;
}

function hasConflict(slots, candidate) {
  return slots.some((slot) => overlaps(slot, candidate));
}

function firstFreeSlot(slots, durationMinutes, dayEndMinute) {
  const sorted = [...slots].sort((x, y) => x.startMinute - y.startMinute);
  let cursor = 0;
  for (const slot of sorted) {
    if (slot.startMinute - cursor >= durationMinutes) {
      return { startMinute: cursor, endMinute: cursor + durationMinutes };
    }
    cursor = Math.max(cursor, slot.endMinute);
  }
  if (dayEndMinute - cursor >= durationMinutes) {
    return { startMinute: cursor, endMinute: cursor + durationMinutes };
  }
  return null;
}

module.exports = { overlaps, hasConflict, firstFreeSlot };
`,
    },
    {
      path: 'test/availability.test.js',
      content: `'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { overlaps, hasConflict, firstFreeSlot } = require('../lib/availability');

test('slots that genuinely overlap are detected', () => {
  assert.equal(overlaps({ startMinute: 0, endMinute: 60 }, { startMinute: 30, endMinute: 90 }), true);
});

test('back-to-back slots do not overlap', () => {
  assert.equal(overlaps({ startMinute: 0, endMinute: 60 }, { startMinute: 60, endMinute: 120 }), false);
});

test('a booking starting exactly at an existing end is allowed', () => {
  const existing = [{ startMinute: 540, endMinute: 600 }];
  assert.equal(hasConflict(existing, { startMinute: 600, endMinute: 660 }), false);
});

test('a genuinely conflicting booking is rejected', () => {
  const existing = [{ startMinute: 540, endMinute: 600 }];
  assert.equal(hasConflict(existing, { startMinute: 570, endMinute: 630 }), true);
});

test('firstFreeSlot finds the gap between bookings', () => {
  const slots = [
    { startMinute: 0, endMinute: 60 },
    { startMinute: 120, endMinute: 180 },
  ];
  assert.deepEqual(firstFreeSlot(slots, 60, 480), { startMinute: 60, endMinute: 120 });
});
`,
    },
  ],
};

// ── Task B — multi-file feature ──────────────────────────────────────────────
// Requires coordinated edits across a route, a service, and a test.
const FIXTURE_B: Fixture = {
  id: 'task-b-multi-file-feature',
  category: 'multi-file-feature',
  title: 'Multi-file feature across route, service and test',
  userRequest:
    'Add support for filtering the inventory list by minimum quantity. The HTTP layer should accept a minQuantity query parameter, the service should apply it, and the pending test for it must pass.',
  summary: 'Small inventory API with an HTTP routing layer and a service layer.',
  moduleSummaries: [
    'src/routes/inventory-routes.js — request handling and query parsing',
    'src/services/inventory-service.js — inventory filtering logic',
    'spec/inventory.spec.js — behavioural tests',
  ],
  includedPaths: ['src/routes/inventory-routes.js', 'src/services/inventory-service.js', 'spec/inventory.spec.js'],
  excludedPaths: ['node_modules', '.git'],
  validationCommands: ['npm test'],
  files: [
    { path: 'package.json', content: NODE_TEST_PKG('inventory-api', { test: 'node --test "spec/*.js"', 'test:coding': 'node --test "spec/*.js"' }) },
    {
      path: 'src/services/inventory-service.js',
      content: `'use strict';

const ITEMS = [
  { sku: 'A-100', name: 'Widget', quantity: 12, category: 'parts' },
  { sku: 'A-200', name: 'Gadget', quantity: 0, category: 'parts' },
  { sku: 'B-100', name: 'Crate', quantity: 45, category: 'packaging' },
  { sku: 'B-200', name: 'Label roll', quantity: 3, category: 'packaging' },
];

function listItems(filters = {}) {
  let results = [...ITEMS];
  if (filters.category) {
    results = results.filter((item) => item.category === filters.category);
  }
  if (filters.inStockOnly) {
    results = results.filter((item) => item.quantity > 0);
  }
  return results;
}

module.exports = { listItems, ITEMS };
`,
    },
    {
      path: 'src/routes/inventory-routes.js',
      content: `'use strict';
const { listItems } = require('../services/inventory-service');

/**
 * Minimal router shim: takes a parsed query object, returns { status, body }.
 */
function handleListInventory(query = {}) {
  const filters = {};
  if (query.category) filters.category = String(query.category);
  if (query.inStockOnly === 'true') filters.inStockOnly = true;

  return { status: 200, body: { items: listItems(filters) } };
}

module.exports = { handleListInventory };
`,
    },
    {
      path: 'spec/inventory.spec.js',
      content: `'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { handleListInventory } = require('../src/routes/inventory-routes');
const { listItems } = require('../src/services/inventory-service');

test('lists everything when no filter is given', () => {
  assert.equal(handleListInventory({}).body.items.length, 4);
});

test('filters by category', () => {
  const res = handleListInventory({ category: 'packaging' });
  assert.deepEqual(res.body.items.map((i) => i.sku), ['B-100', 'B-200']);
});

test('filters out zero-quantity items when asked', () => {
  const res = handleListInventory({ inStockOnly: 'true' });
  assert.equal(res.body.items.some((i) => i.quantity === 0), false);
});

test('service filters by minimum quantity', () => {
  const results = listItems({ minQuantity: 10 });
  assert.deepEqual(results.map((i) => i.sku), ['A-100', 'B-100']);
});

test('route accepts a minQuantity query parameter', () => {
  const res = handleListInventory({ minQuantity: '5' });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.items.map((i) => i.sku), ['A-100', 'B-100']);
});

test('minQuantity combines with category', () => {
  const res = handleListInventory({ category: 'packaging', minQuantity: '10' });
  assert.deepEqual(res.body.items.map((i) => i.sku), ['B-100']);
});
`,
    },
  ],
};

// ── Task C — type error repair ───────────────────────────────────────────────
// Seeded type errors that must be fixed properly, not cast away.
const FIXTURE_C: Fixture = {
  id: 'task-c-type-repair',
  category: 'type-repair',
  title: 'TypeScript compile error repair without broad casts',
  userRequest:
    'The pricing module no longer compiles. Diagnose the TypeScript errors and fix them properly. Do not use `any`, `as any`, or `@ts-ignore`.',
  summary: 'TypeScript pricing module with discount rules.',
  moduleSummaries: ['src/pricing.ts — order pricing and discount application', 'src/types.ts — shared domain types'],
  includedPaths: ['src/pricing.ts', 'src/types.ts'],
  excludedPaths: ['node_modules', '.git', 'dist'],
  validationCommands: ['npm run build'],
  files: [
    {
      path: 'package.json',
      content:
        JSON.stringify(
          {
            name: 'pricing-module',
            version: '1.0.0',
            private: true,
            scripts: { build: 'tsc --noEmit -p tsconfig.json', 'test:coding': 'tsc --noEmit -p tsconfig.json' },
          },
          null,
          2
        ) + '\n',
    },
    {
      path: 'tsconfig.json',
      content:
        JSON.stringify(
          {
            compilerOptions: {
              target: 'ES2020',
              module: 'commonjs',
              strict: true,
              noEmit: true,
              skipLibCheck: true,
              forceConsistentCasingInFileNames: true,
            },
            include: ['src'],
          },
          null,
          2
        ) + '\n',
    },
    {
      path: 'src/types.ts',
      content: `export interface LineItem {
  sku: string;
  unitPriceCents: number;
  quantity: number;
}

export interface Discount {
  code: string;
  /** Percentage off, expressed 0-100. */
  percentOff: number;
  minSubtotalCents?: number;
}

export interface PricedOrder {
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  appliedCodes: string[];
}
`,
    },
    {
      path: 'src/pricing.ts',
      content: `import { Discount, LineItem, PricedOrder } from './types';

export function subtotal(items: LineItem[]): number {
  return items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
}

export function eligibleDiscounts(discounts: Discount[], subtotalCents: number): Discount[] {
  return discounts.filter((discount) => {
    // minSubtotalCents is optional, so it may be undefined here.
    return subtotalCents >= discount.minSubtotalCents;
  });
}

export function priceOrder(items: LineItem[], discounts: Discount[]): PricedOrder {
  const sub = subtotal(items);
  const eligible = eligibleDiscounts(discounts, sub);

  let discountCents = 0;
  for (const discount of eligible) {
    discountCents += Math.round((sub * discount.percentOff) / 100);
  }

  const applied: string[] = eligible.map((discount) => discount.code);

  return {
    subtotalCents: sub,
    discountCents,
    totalCents: sub - discountCents,
    appliedCodes: applied,
    currency: 'USD',
  };
}

export function describeOrder(order: PricedOrder): string {
  return order.appliedCodes.join(', ').toUpperCase() + ' -> ' + order.totalCents.toFixed(2);
}
`,
    },
  ],
};

// ── Task D — behaviour-preserving refactor ───────────────────────────────────
// Tests are green before and must stay green after.
const FIXTURE_D: Fixture = {
  id: 'task-d-refactor',
  category: 'refactor',
  title: 'Behaviour-preserving refactor with tests green throughout',
  userRequest:
    'The report formatter has grown one long function with duplicated column-padding logic. Refactor it into smaller, clearly named helpers without changing any observable behaviour.',
  summary: 'Text report formatting utility.',
  moduleSummaries: ['src/report-formatter.js — fixed-width text report rendering', 'test/report-formatter.test.js — golden output tests'],
  includedPaths: ['src/report-formatter.js', 'test/report-formatter.test.js'],
  excludedPaths: ['node_modules', '.git'],
  validationCommands: ['npm test'],
  files: [
    { path: 'package.json', content: NODE_TEST_PKG('report-formatter') },
    {
      path: 'src/report-formatter.js',
      content: `'use strict';

function formatReport(title, rows) {
  let out = '';
  out += title.toUpperCase() + '\\n';
  out += '='.repeat(title.length) + '\\n';

  let widest = 0;
  for (const row of rows) {
    if (row.label.length > widest) widest = row.label.length;
  }

  let total = 0;
  for (const row of rows) {
    let label = row.label;
    while (label.length < widest) label = label + ' ';
    let amount = row.amount.toFixed(2);
    while (amount.length < 10) amount = ' ' + amount;
    out += label + ' | ' + amount + '\\n';
    total += row.amount;
  }

  let totalLabel = 'TOTAL';
  while (totalLabel.length < widest) totalLabel = totalLabel + ' ';
  let totalAmount = total.toFixed(2);
  while (totalAmount.length < 10) totalAmount = ' ' + totalAmount;
  out += '-'.repeat(widest + 13) + '\\n';
  out += totalLabel + ' | ' + totalAmount + '\\n';

  return out;
}

module.exports = { formatReport };
`,
    },
    {
      path: 'test/report-formatter.test.js',
      content: `'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { formatReport } = require('../src/report-formatter');

test('renders a titled fixed-width report', () => {
  const output = formatReport('Q3 costs', [
    { label: 'Hosting', amount: 1200.5 },
    { label: 'Contractors', amount: 8400 },
    { label: 'Software', amount: 315.25 },
  ]);

  const expected = [
    'Q3 COSTS',
    '========',
    'Hosting     |    1200.50',
    'Contractors |    8400.00',
    'Software    |     315.25',
    '------------------------',
    'TOTAL       |    9915.75',
    '',
  ].join('\\n');

  assert.equal(output, expected);
});

test('handles a single row', () => {
  const output = formatReport('one', [{ label: 'Only', amount: 5 }]);
  assert.ok(output.startsWith('ONE\\n===\\n'));
  assert.ok(output.includes('Only |       5.00'));
  assert.ok(output.includes('TOTAL |       5.00'));
});
`,
    },
  ],
};

// ── Task E — unfamiliar repository ───────────────────────────────────────────
// Different language conventions, directory layout and naming from A-D.
const FIXTURE_E: Fixture = {
  id: 'task-e-unfamiliar-repo',
  category: 'unfamiliar-repo',
  title: 'Unfamiliar repository with its own conventions',
  userRequest:
    'Records with a blank identifier are silently kept during normalisation and later corrupt the merge step. Make normalisation drop them, and make the existing pending assertion pass.',
  summary: 'ETL pipeline stage library using snake_case files and a plugin registry.',
  moduleSummaries: [
    'pipeline/stage_normalise.js — record normalisation stage',
    'pipeline/stage_merge.js — record merge stage',
    'pipeline/registry.js — stage registration',
    't/pipeline_test.js — pipeline assertions',
  ],
  includedPaths: ['pipeline/stage_normalise.js', 'pipeline/stage_merge.js', 'pipeline/registry.js', 't/pipeline_test.js'],
  excludedPaths: ['node_modules', '.git', 'vendor'],
  validationCommands: ['npm test'],
  files: [
    { path: 'package.json', content: NODE_TEST_PKG('etl-pipeline', { test: 'node --test "t/*.js"', 'test:coding': 'node --test "t/*.js"' }) },
    {
      path: 'pipeline/registry.js',
      content: `'use strict';

const STAGES = new Map();

function register_stage(name, fn) {
  STAGES.set(name, fn);
  return fn;
}

function run_pipeline(names, records) {
  let acc = records;
  for (const name of names) {
    const stage = STAGES.get(name);
    if (!stage) throw new Error('unknown stage: ' + name);
    acc = stage(acc);
  }
  return acc;
}

module.exports = { register_stage, run_pipeline, STAGES };
`,
    },
    {
      path: 'pipeline/stage_normalise.js',
      content: `'use strict';
const { register_stage } = require('./registry');

function normalise(records) {
  return records.map(function (rec) {
    return {
      ident: String(rec.ident == null ? '' : rec.ident).trim(),
      label: String(rec.label == null ? '' : rec.label).trim(),
      weight: Number(rec.weight) || 0,
    };
  });
}

register_stage('normalise', normalise);

module.exports = { normalise };
`,
    },
    {
      path: 'pipeline/stage_merge.js',
      content: `'use strict';
const { register_stage } = require('./registry');

function merge(records) {
  const byIdent = new Map();
  for (const rec of records) {
    const existing = byIdent.get(rec.ident);
    if (existing) {
      existing.weight += rec.weight;
    } else {
      byIdent.set(rec.ident, Object.assign({}, rec));
    }
  }
  return Array.from(byIdent.values());
}

register_stage('merge', merge);

module.exports = { merge };
`,
    },
    {
      path: 't/pipeline_test.js',
      content: `'use strict';
const test = require('node:test');
const assert = require('node:assert');

require('../pipeline/stage_normalise');
require('../pipeline/stage_merge');
const { run_pipeline } = require('../pipeline/registry');
const { normalise } = require('../pipeline/stage_normalise');

test('normalise trims and coerces fields', () => {
  const out = normalise([{ ident: ' a1 ', label: ' Box ', weight: '3' }]);
  assert.deepEqual(out, [{ ident: 'a1', label: 'Box', weight: 3 }]);
});

test('merge accumulates weight per ident', () => {
  const out = run_pipeline(['normalise', 'merge'], [
    { ident: 'a1', label: 'Box', weight: 2 },
    { ident: 'a1', label: 'Box', weight: 5 },
  ]);
  assert.deepEqual(out, [{ ident: 'a1', label: 'Box', weight: 7 }]);
});

test('records without an identifier are dropped during normalisation', () => {
  const out = normalise([
    { ident: 'a1', label: 'Box', weight: 1 },
    { ident: '   ', label: 'Ghost', weight: 9 },
    { ident: null, label: 'Phantom', weight: 4 },
  ]);
  assert.deepEqual(out, [{ ident: 'a1', label: 'Box', weight: 1 }]);
});

test('blank identifiers never reach the merge stage', () => {
  const out = run_pipeline(['normalise', 'merge'], [
    { ident: 'a1', label: 'Box', weight: 1 },
    { ident: '', label: 'Ghost', weight: 9 },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].ident, 'a1');
});
`,
    },
  ],
};

export const FIXTURES: Fixture[] = [FIXTURE_A, FIXTURE_B, FIXTURE_C, FIXTURE_D, FIXTURE_E];

export function getFixture(id: string): Fixture {
  const fixture = FIXTURES.find(f => f.id === id);
  if (!fixture) throw new Error(`unknown fixture: ${id}`);
  return fixture;
}
