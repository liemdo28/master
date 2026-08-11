import { Router } from 'express';
import path from 'path';
import { generateAuthorityManifest, assertAuthorityManifest } from './scanner';

export const authorityRouter = Router();

function serverRoot(): string {
  return path.resolve(__dirname, '../..');
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
