/**
 * Phase 7G §16 — regression lock for the recurring
 * AUTHORITY_MANIFEST_STALE Windows-checkout false positive (reproduced on
 * every fresh checkout across Phases 7B-7G) and, just as importantly, a
 * proof that the fix does NOT weaken real content-drift detection.
 */
import assert from 'assert';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const MANIFEST_PATH = path.join(REPO_ROOT, 'authority-manifest.json');
const GENERATOR = path.join(REPO_ROOT, 'src', 'authority-control-plane', 'generate-manifest.ts');
const TSX_BIN = path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');

function runCheck(): { code: number; output: string } {
  // Both operands are fixed internal paths, never external/user input —
  // the single-string form (rather than execFileSync's args array) avoids
  // Node's DEP0190 warning about combining an args array with shell:true.
  const command = `"${TSX_BIN}" "${GENERATOR}" --check`;
  try {
    const output = execSync(command, { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, output };
  } catch (err) {
    const e = err as { status?: number; stderr?: Buffer };
    return { code: e.status ?? 1, output: e.stderr ? e.stderr.toString() : String(err) };
  }
}

async function run(): Promise<void> {
  let scenarios = 0;
  let passed = 0;
  const original = fs.readFileSync(MANIFEST_PATH, 'utf8');

  try {
    // ── Baseline: freshly generated manifest passes --check (control case) ──
    {
      scenarios++;
      const { code } = runCheck();
      assert.strictEqual(code, 0, '--check must pass against the manifest this test starts with (regenerate before running if this fails)');
      passed++;
    }

    // ── §16 fix: CRLF-converted but byte-for-byte-semantically-identical
    //    content must still PASS (the actual bug being fixed) ────────────────
    {
      scenarios++;
      fs.writeFileSync(MANIFEST_PATH, original.replace(/\n/g, '\r\n'));
      const { code, output } = runCheck();
      assert.strictEqual(code, 0, `CRLF-only conversion must not trip AUTHORITY_MANIFEST_STALE: ${output}`);
      passed++;
    }

    // ── Real content drift must still FAIL, even with LF line endings —
    //    proves the fix only ignores line-ending differences, nothing else ──
    {
      scenarios++;
      const tampered = original.replace(/"mutations":\s*\d+/, '"mutations": 999999');
      fs.writeFileSync(MANIFEST_PATH, tampered);
      const { code, output } = runCheck();
      assert.strictEqual(code, 1, 'genuine content drift (tampered mutations count) must still fail --check');
      assert.match(output, /AUTHORITY_MANIFEST_STALE/);
      passed++;
    }

    // ── Real content drift with CRLF line endings must ALSO still fail —
    //    the two independent variables (line-ending vs content) are both
    //    exercised together, not just each alone ──────────────────────────────
    {
      scenarios++;
      const tamperedCrlf = original.replace(/"mutations":\s*\d+/, '"mutations": 999999').replace(/\n/g, '\r\n');
      fs.writeFileSync(MANIFEST_PATH, tamperedCrlf);
      const { code } = runCheck();
      assert.strictEqual(code, 1, 'tampered content + CRLF must still fail --check');
      passed++;
    }
  } finally {
    fs.writeFileSync(MANIFEST_PATH, original);
  }

  assert.strictEqual(passed, scenarios);
  console.log(`[phase7g-manifest-crlf] PASS — ${passed}/${scenarios} scenarios verified`);
}

run().catch(err => { console.error(err); process.exit(1); });
