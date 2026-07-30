/**
 * Unit tests for reference-brain-path.ts — canonical US Compliance path resolver
 */

import path from 'path';
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

  test('getMiCoreRoot returns a valid path containing mi-core', () => {
    const root = getMiCoreRoot();
    expect(root).toBeTruthy();
    expect(root.toLowerCase()).toContain('mi-core');
  });

  test('getWorkspaceRoot returns parent of mi-core', () => {
    const ws = getWorkspaceRoot();
    const miCore = getMiCoreRoot();
    expect(ws).toBeTruthy();
    // workspace root should be parent
    expect(miCore.startsWith(ws) || path.resolve(ws) === path.resolve(miCore, '..')).toBeTruthy();
  });

  test('getReferenceBrainRoot resolves to existing directory', () => {
    const rb = getReferenceBrainRoot();
    expect(rb).not.toBeNull();
    expect(rb!.toLowerCase()).toContain('reference-brain');
  });

  test('getUSComplianceDBPath resolves to mi-core path', () => {
    const p = getUSComplianceDBPath();
    expect(p).not.toBeNull();
    expect(p!.toLowerCase()).toContain('mi-core');
    expect(p!.toLowerCase()).toContain('us-business-compliance');
    // Must NOT resolve to wrong parent workspace path
    expect(p!.replace(/\\/g, '/')).not.toMatch(/\/Master\/.local-agent-global\//);
  });

  test('getUSComplianceManifestPath returns existing manifest', () => {
    const m = getUSComplianceManifestPath();
    expect(m).not.toBeNull();
    expect(m!).toContain('MI_INTEGRATION_MANIFEST.json');
  });

  test('getUSComplianceCatalogPath returns existing catalog', () => {
    const c = getUSComplianceCatalogPath();
    expect(c).not.toBeNull();
    expect(c!).toContain('source_catalog.json');
  });

  test('checkUSComplianceDBHealth returns real data', () => {
    const health = checkUSComplianceDBHealth();

    // Must exist
    expect(health.exists).toBe(true);
    expect(health.resolved_path).toBeTruthy();
    expect(health.resolved_path.toLowerCase()).toContain('mi-core');

    // checked_paths always populated
    expect(health.checked_paths.length).toBeGreaterThan(0);

    // Real counts — not zero, not fake
    expect(health.raw_size_mb).toBeGreaterThan(500);
    expect(health.document_count).toBeGreaterThan(700);
    expect(health.chunk_count).toBeGreaterThan(500000);
    expect(health.source_count).toBeGreaterThan(700);

    // Jurisdictions
    expect(health.jurisdictions).toContain('federal');
    expect(health.jurisdictions).toContain('texas');
    expect(health.jurisdictions).toContain('california');
    expect(health.jurisdictions).toContain('san-antonio');
    expect(health.jurisdictions).toContain('stockton');

    // Domains
    expect(health.domains.length).toBeGreaterThan(0);

    // Catalog + Manifest
    expect(health.catalog_exists).toBe(true);
    expect(health.manifest_exists).toBe(true);

    // Searchable
    expect(health.searchable).toBe(true);

    // No errors
    expect(health.errors).toEqual([]);

    // last_indexed is a date string
    expect(health.last_indexed).toBeTruthy();
  });

  test('checked_paths always includes mi-core candidate', () => {
    const health = checkUSComplianceDBHealth();
    const miCorePath = health.checked_paths.find(p =>
      p.toLowerCase().includes('mi-core')
    );
    expect(miCorePath).toBeTruthy();
  });
});
