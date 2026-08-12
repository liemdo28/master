/**
 * Deploy-time source snapshot builder. Run from the exact reviewed worktree that is
 * about to be deployed (its `server/` directory is what gets snapshotted) — never
 * from the production checkout, which may carry unrelated uncommitted work.
 *
 * Usage: tsx src/authority-control-plane/build-snapshot-cli.ts --sha=<deployedSha> [--dest-base=<dir>]
 * `--sha` falls back to `MI_DEPLOYED_SOURCE_SHA`; `--dest-base` falls back to
 * `MI_SNAPSHOT_BASE_DIR`, defaulting to `D:\mi-core-deployed-source`.
 *
 * Idempotent: if a snapshot for this exact SHA already exists and verifies cleanly,
 * this is a no-op success (safe to re-run on redeploy-without-code-change). If one
 * exists and fails verification, this fails loudly rather than silently overwriting —
 * an invalid existing snapshot needs a human to look at it, not an automatic fix.
 */
import path from 'path';
import { buildSourceSnapshot, verifySnapshot } from './source-provenance';

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.find(a => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

function main(): void {
  const sha = arg('sha') ?? process.env.MI_DEPLOYED_SOURCE_SHA;
  if (!sha) {
    throw new Error('MI_DEPLOYED_SOURCE_SHA is required: pass --sha=<sha> or set the env var');
  }
  const destBase = arg('dest-base') ?? process.env.MI_SNAPSHOT_BASE_DIR ?? 'D:\\mi-core-deployed-source';
  const destRoot = path.join(destBase, sha);
  const sourceServerRoot = path.resolve(__dirname, '../..');

  try {
    const existing = verifySnapshot(destRoot, sha);
    console.log(`[authority:build-snapshot] snapshot for ${sha} already exists and verifies cleanly, skipping build`, existing);
    return;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.startsWith('AUTHORITY_SNAPSHOT_MISSING')) {
      throw new Error(`[authority:build-snapshot] refusing to build over an existing snapshot at ${destRoot} that fails verification: ${message}`);
    }
  }

  const manifest = buildSourceSnapshot(sourceServerRoot, destRoot, sha);
  console.log('[authority:build-snapshot] built', manifest);
}

main();
