import { Router } from 'express';
import path from 'path';
import { generateAuthorityManifest, assertAuthorityManifest } from './scanner';
import { LegacyAuthorityAdapter, legacyMutationSurfaces } from './legacy-adapter';
import { resolveAuthorityRepoRoot } from './source-provenance';

export const authorityRouter = Router();

function serverRoot(): string {
  return resolveAuthorityRepoRoot(path.resolve(__dirname, '../..'));
}

authorityRouter.get('/authority/manifest', (_req, res) => {
  const manifest = generateAuthorityManifest(serverRoot());
  res.json({ ...manifest, generatedAt: new Date().toISOString() });
});

authorityRouter.get('/authority/status', (_req, res) => {
  const manifest = generateAuthorityManifest(serverRoot());
  try {
    assertAuthorityManifest(manifest);
    res.json({ ok: true, counts: manifest.counts, generatedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err), counts: manifest.counts });
  }
});

authorityRouter.get('/authority/legacy-migration', (_req, res) => {
  const adapter = new LegacyAuthorityAdapter(serverRoot());
  const legacy = legacyMutationSurfaces(adapter.manifest);
  res.json({
    ...adapter.migrationSummary(),
    surfaces: legacy.map(surface => ({
      id: surface.id,
      runtimeMount: surface.runtimeMount,
      sourcePath: surface.sourcePath,
      method: surface.method,
      effectClass: surface.effectClass,
      canonicalOwner: surface.canonicalOwner,
      disposition: surface.phase6bDisposition,
      adapterTarget: surface.adapterTarget,
      quarantineHandler: surface.quarantineHandler,
      canonicalReplacement: surface.canonicalReplacement,
      reason: surface.legacyReason,
      migrationTarget: surface.migrationTarget,
    })),
  });
});
