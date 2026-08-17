import fs from 'fs';
import path from 'path';
import { assertAuthorityManifest, generateAuthorityManifest } from './scanner';
import { resolveAuthorityRepoRoot } from './source-provenance';

const cwd = process.cwd();
const outPath = path.join(cwd, 'authority-manifest.json');
const check = process.argv.includes('--check');
const manifest = generateAuthorityManifest(resolveAuthorityRepoRoot(cwd));
assertAuthorityManifest(manifest);
const body = `${JSON.stringify(manifest, null, 2)}\n`;

if (check) {
  const current = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : '';
  // Phase 7G §16 — canonicalize line endings before comparing, not before
  // generating. `body` is always LF (this generator never writes \r\n); a
  // fresh Windows checkout with core.autocrlf=true converts the committed
  // LF file to CRLF on disk, which trips a byte-strict comparison on line
  // endings alone even when every semantic byte of content is identical
  // (reproduced on 6 consecutive phases' fresh checkouts — 7B through 7G).
  // Normalizing `current`'s \r\n to \n before comparing does not weaken
  // real content-drift detection: it only collapses the CRLF/LF
  // distinction, which carries no semantic meaning for this JSON file —
  // any actual content difference (wrong mutation count, a newly
  // reachable route, etc.) still differs after normalization and still
  // fails this check. Regression-locked in
  // authority-control-plane/__tests__/phase7g-manifest-crlf.test.ts.
  const normalizedCurrent = current.replace(/\r\n/g, '\n');
  if (normalizedCurrent !== body) {
    throw new Error('AUTHORITY_MANIFEST_STALE: run npm --prefix server run authority:manifest');
  }
  console.log('[authority-manifest] PASS');
} else {
  fs.writeFileSync(outPath, body);
  console.log(`[authority-manifest] wrote ${outPath}`);
}
