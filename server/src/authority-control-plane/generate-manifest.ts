import fs from 'fs';
import path from 'path';
import { assertAuthorityManifest, generateAuthorityManifest } from './scanner';

const repoRoot = process.cwd();
const outPath = path.join(repoRoot, 'authority-manifest.json');
const check = process.argv.includes('--check');
const manifest = generateAuthorityManifest(repoRoot);
assertAuthorityManifest(manifest);
const body = `${JSON.stringify(manifest, null, 2)}\n`;

if (check) {
  const current = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : '';
  if (current !== body) {
    throw new Error('AUTHORITY_MANIFEST_STALE: run npm --prefix server run authority:manifest');
  }
  console.log('[authority-manifest] PASS');
} else {
  fs.writeFileSync(outPath, body);
  console.log(`[authority-manifest] wrote ${outPath}`);
}
