/**
 * Fixes the production bug where the Authority Control Plane scanner discovered
 * routes by reading TypeScript source from `process.cwd()` / a `__dirname`-derived
 * path — which, in production, is the physical checkout at the deployment root. That
 * checkout can (and did) carry unrelated, disjoint, uncommitted work on a different
 * branch, so the live authority manifest silently drifted from what `server/dist`
 * actually had deployed. See docs/releases/PHASE6D_PROVENANCE_HOTFIX.md.
 *
 * The fix: one deploy-owned, immutable, checksum-verified source snapshot per
 * deployed SHA, referenced by the existing `MI_DEPLOYED_SOURCE_ROOT` env var (no new
 * competing deployment marker). When that variable is set, the scanner MUST use a
 * valid, SHA-matching snapshot — it fails closed (throws) rather than silently
 * falling back to whatever happens to be on disk at the caller's own repoRoot. When
 * the variable is unset, callers keep their exact prior behavior (their own
 * `process.cwd()` / `__dirname`-derived fallback) — this is the explicit development
 * contract: no snapshot configured means "trust local repo source", same as before
 * this fix existed.
 */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface SnapshotManifest {
  deployedSha: string;
  sourceSnapshotRoot: string;
  generatedAt: string;
  fileCount: number;
  treeChecksum: string;
}

const SNAPSHOT_MANIFEST_FILENAME = 'snapshot-manifest.json';
const SNAPSHOT_INCLUDE = ['src', 'package.json'];

/** Deterministic: sorted relative paths, each hashed, then the whole list hashed once
 *  more. Order-independent of filesystem iteration order; a single content or file-set
 *  change anywhere changes this value. */
function computeTreeChecksum(root: string): { checksum: string; fileCount: number } {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (entry.isFile()) files.push(abs);
    }
  };
  for (const include of SNAPSHOT_INCLUDE) {
    const abs = path.join(root, include);
    if (!fs.existsSync(abs)) continue;
    if (fs.statSync(abs).isDirectory()) walk(abs);
    else files.push(abs);
  }
  const relFiles = files.map(f => path.relative(root, f).replace(/\\/g, '/')).sort();
  const hash = crypto.createHash('sha256');
  for (const rel of relFiles) {
    const contentHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex');
    hash.update(`${rel}:${contentHash}\n`);
  }
  return { checksum: hash.digest('hex'), fileCount: relFiles.length };
}

/** Builds a new immutable snapshot at `destRoot` from `sourceServerRoot` (the reviewed
 *  clean worktree's `server/` directory — never the messy production checkout).
 *  Writes into a staging directory first and renames into place only once fully
 *  written and checksummed, so a reader can never observe a partially-written
 *  snapshot. Throws if `destRoot` already exists (snapshots are one-per-SHA and never
 *  overwritten in place). */
export function buildSourceSnapshot(sourceServerRoot: string, destRoot: string, deployedSha: string): SnapshotManifest {
  if (fs.existsSync(destRoot)) {
    throw new Error(`SNAPSHOT_ALREADY_EXISTS: refusing to overwrite an existing snapshot at ${destRoot}`);
  }
  const staging = `${destRoot}.staging-${process.pid}-${Date.now()}`;
  fs.mkdirSync(staging, { recursive: true });
  try {
    for (const include of SNAPSHOT_INCLUDE) {
      const from = path.join(sourceServerRoot, include);
      if (!fs.existsSync(from)) continue;
      const to = path.join(staging, include);
      fs.cpSync(from, to, { recursive: true });
    }
    const { checksum, fileCount } = computeTreeChecksum(staging);
    const manifest: SnapshotManifest = {
      deployedSha, sourceSnapshotRoot: destRoot, generatedAt: new Date().toISOString(), fileCount, treeChecksum: checksum,
    };
    fs.writeFileSync(path.join(staging, SNAPSHOT_MANIFEST_FILENAME), JSON.stringify(manifest, null, 2));
    fs.renameSync(staging, destRoot);
    return { ...manifest, sourceSnapshotRoot: destRoot };
  } catch (err) {
    try { fs.rmSync(staging, { recursive: true, force: true }); } catch { /* best effort */ }
    throw err;
  }
}

/** Verifies a snapshot at `snapshotRoot` is present, well-formed, matches
 *  `expectedSha`, and has not been tampered with (recomputed checksum matches the
 *  manifest's recorded checksum) — every failure mode throws a specific, identifiable
 *  error rather than returning null/undefined, so a caller can never silently proceed
 *  on invalid data. */
export function verifySnapshot(snapshotRoot: string, expectedSha: string | undefined): SnapshotManifest {
  if (!fs.existsSync(snapshotRoot) || !fs.statSync(snapshotRoot).isDirectory()) {
    throw new Error(`AUTHORITY_SNAPSHOT_MISSING: no snapshot directory at ${snapshotRoot}`);
  }
  const manifestPath = path.join(snapshotRoot, SNAPSHOT_MANIFEST_FILENAME);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`AUTHORITY_SNAPSHOT_MANIFEST_MISSING: ${manifestPath} not found`);
  }
  let manifest: SnapshotManifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (err) {
    throw new Error(`AUTHORITY_SNAPSHOT_MANIFEST_MALFORMED: ${manifestPath} is not valid JSON (${(err as Error).message})`);
  }
  if (!manifest.deployedSha || !manifest.treeChecksum || typeof manifest.fileCount !== 'number') {
    throw new Error(`AUTHORITY_SNAPSHOT_MANIFEST_MALFORMED: ${manifestPath} is missing required fields`);
  }
  if (!fs.existsSync(path.join(snapshotRoot, 'src', 'index.ts'))) {
    throw new Error(`AUTHORITY_SNAPSHOT_INCOMPLETE: ${snapshotRoot} has no src/index.ts`);
  }
  if (expectedSha && manifest.deployedSha !== expectedSha) {
    throw new Error(`AUTHORITY_SNAPSHOT_SHA_MISMATCH: snapshot is for ${manifest.deployedSha}, deployed SHA is ${expectedSha}`);
  }
  const { checksum, fileCount } = computeTreeChecksum(snapshotRoot);
  if (checksum !== manifest.treeChecksum || fileCount !== manifest.fileCount) {
    throw new Error(`AUTHORITY_SNAPSHOT_TAMPERED: recomputed checksum/file count does not match ${manifestPath} (this snapshot has been modified since it was built)`);
  }
  return { ...manifest, sourceSnapshotRoot: snapshotRoot };
}

/**
 * The single resolution point every authority-scanning call site must use.
 *
 * - `MI_DEPLOYED_SOURCE_ROOT` unset → returns `fallback` unchanged (explicit
 *   development/test contract, identical to every call site's pre-fix behavior).
 * - `MI_DEPLOYED_SOURCE_ROOT` set → the snapshot there MUST verify against
 *   `MI_DEPLOYED_SOURCE_SHA`; throws (fails closed) on any invalid snapshot rather
 *   than ever falling back to `fallback`. A dirty/unrelated repo at `fallback` has
 *   zero effect once a snapshot is configured — it is never consulted.
 */
export function resolveAuthorityRepoRoot(fallback: string): string {
  const snapshotRoot = process.env.MI_DEPLOYED_SOURCE_ROOT;
  if (!snapshotRoot) return fallback;
  return verifySnapshot(snapshotRoot, process.env.MI_DEPLOYED_SOURCE_SHA).sourceSnapshotRoot;
}
