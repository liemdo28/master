import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { buildSmartBrief, formatPlan, listCatalog, materialize, resolvePlan } from './mi-harness.mjs';

test('lists profiles and modules', () => {
  const catalog = listCatalog();
  assert.ok(catalog.profiles.core);
  assert.ok(catalog.profiles.coding);
  assert.ok(catalog.profiles.ops);
  assert.ok(catalog.profiles.whatsapp);
  assert.ok(catalog.profiles.visibility);
  assert.ok(catalog.profiles['daily-work']);
  assert.ok(catalog.profiles.compliance);
  assert.ok(catalog.profiles['remote-control']);
  assert.ok(catalog.modules['safe-coding']);
});

test('resolves core profile into unique skills, rules, and commands', () => {
  const plan = resolvePlan('core');
  assert.equal(plan.profile.id, 'core');
  assert.ok(plan.skills.includes('mi-safe-patch-workflow'));
  assert.ok(plan.rules.includes('mi-approval-gate'));
  assert.ok(plan.commands.includes('mi-verify'));
  assert.equal(plan.skills.length, new Set(plan.skills).size);
});

test('formats a readable plan', () => {
  const text = formatPlan(resolvePlan('ops'));
  assert.match(text, /Profile: ops/);
  assert.match(text, /mi-connector-ops/);
});

test('resolves domain profiles', () => {
  assert.ok(resolvePlan('whatsapp').skills.includes('mi-whatsapp-ops'));
  assert.ok(resolvePlan('visibility').skills.includes('mi-visibility-ops'));
  assert.ok(resolvePlan('daily-work').skills.includes('mi-daily-work-ops'));
  assert.ok(resolvePlan('compliance').skills.includes('mi-compliance-ops'));
  assert.ok(resolvePlan('remote-control').skills.includes('mi-remote-control-ops'));
});

test('builds a smart brief', () => {
  const brief = buildSmartBrief('visibility');
  assert.equal(brief.profile, 'visibility');
  assert.ok(brief.text.includes('Mi Smart Brief: visibility'));
  assert.ok(brief.surfaces.includes('server/src/visibility'));
});

test('materialize refuses paths outside mi-core', () => {
  const outside = mkdtempSync(join(tmpdir(), 'mi-harness-outside-'));
  try {
    assert.throws(() => materialize(resolvePlan('core'), outside), /outside mi-core/);
  } finally {
    rmSync(outside, { recursive: true, force: true });
  }
});
