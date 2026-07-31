/**
 * Unit tests for reference-brain-path.ts — canonical US Compliance path resolver
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import {
  getMiCoreRoot,
  getWorkspaceRoot,
  getReferenceBrainRoot,
  getUSComplianceDBPath,
  getUSComplianceManifestPath,
  getUSComplianceCatalogPath,
  checkUSComplianceDBHealth,
} from '../reference-brain-path';

describe('Reference Brain Path Resolver', () => {

  test('getMiCoreRoot returns the repository root', () => {
    const root = getMiCoreRoot();
    assert.ok(root);
    assert.ok(fs.existsSync(path.join(root, 'server', 'package.json')));
  });

  test('getWorkspaceRoot returns parent of mi-core', () => {
    const ws = getWorkspaceRoot();
    const miCore = getMiCoreRoot();
    assert.ok(ws);
    // workspace root should be parent
    assert.ok(miCore.startsWith(ws) || path.resolve(ws) === path.resolve(miCore, '..'));
  });

  test('getReferenceBrainRoot resolves to existing directory', t => {
    const rb = getReferenceBrainRoot();
    if (!rb) {
      t.skip('reference-brain data directory is not present in this environment');
      return;
    }
    assert.notEqual(rb, null);
    assert.ok(rb!.toLowerCase().includes('reference-brain'));
  });

  test('getUSComplianceDBPath resolves to mi-core path', t => {
    const p = getUSComplianceDBPath();
    if (!p) {
      t.skip('US Compliance DB is not present in this environment');
      return;
    }
    assert.notEqual(p, null);
    assert.ok(p!.toLowerCase().includes('mi-core'));
    assert.ok(p!.toLowerCase().includes('us-business-compliance'));
    // Must NOT resolve to wrong parent workspace path
    assert.doesNotMatch(p!.replace(/\\/g, '/'), /\/Master\/.local-agent-global\//);
  });

  test('getUSComplianceManifestPath returns existing manifest', t => {
    const m = getUSComplianceManifestPath();
    if (!getUSComplianceDBPath()) {
      t.skip('US Compliance DB is not present in this environment');
      return;
    }
    assert.notEqual(m, null);
    assert.ok(m!.includes('MI_INTEGRATION_MANIFEST.json'));
  });

  test('getUSComplianceCatalogPath returns existing catalog', t => {
    const c = getUSComplianceCatalogPath();
    if (!getUSComplianceDBPath()) {
      t.skip('US Compliance DB is not present in this environment');
      return;
    }
    assert.notEqual(c, null);
    assert.ok(c!.includes('source_catalog.json'));
  });

  test('checkUSComplianceDBHealth returns real data', t => {
    const health = checkUSComplianceDBHealth();
    if (!health.exists) {
      t.skip('US Compliance DB is not present in this environment');
      return;
    }

    // Must exist
    assert.equal(health.exists, true);
    assert.ok(health.resolved_path);
    assert.ok(health.resolved_path.toLowerCase().includes('mi-core'));

    // checked_paths always populated
    assert.ok(health.checked_paths.length > 0);

    // Real counts — not zero, not fake
    assert.ok(health.raw_size_mb > 500);
    assert.ok(health.document_count > 700);
    assert.ok(health.chunk_count > 500000);
    assert.ok(health.source_count > 700);

    // Jurisdictions
    assert.ok(health.jurisdictions.includes('federal'));
    assert.ok(health.jurisdictions.includes('texas'));
    assert.ok(health.jurisdictions.includes('california'));
    assert.ok(health.jurisdictions.includes('san-antonio'));
    assert.ok(health.jurisdictions.includes('stockton'));

    // Domains
    assert.ok(health.domains.length > 0);

    // Catalog + Manifest
    assert.equal(health.catalog_exists, true);
    assert.equal(health.manifest_exists, true);

    // Searchable
    assert.equal(health.searchable, true);

    // No errors
    assert.deepEqual(health.errors, []);

    // last_indexed is a date string
    assert.ok(health.last_indexed);
  });

  test('checked_paths always includes repository-root candidate', () => {
    const health = checkUSComplianceDBHealth();
    const repoRootCandidate = path.join(getMiCoreRoot(), '.local-agent-global', 'reference-brain', 'us-business-compliance').replace(/\\/g, '/');
    assert.ok(health.checked_paths.includes(repoRootCandidate));
  });
});
