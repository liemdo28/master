/**
 * Regression test for the Phase 5G security blocker closure (see
 * docs/security/PHASE5G_CREDENTIAL_REMEDIATION.md): 7 real-format credentials were
 * found tracked in the current tree at specific known-risk locations. This is a fast,
 * structural (pattern/tracked-status) check over exactly those locations, not a
 * general-purpose secret scanner — it exists to stop this specific class of
 * regression, not to replace the broader diagnostic scan.
 */
import assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';

const REPO_ROOT = path.join(__dirname, '..', '..', '..');

function isTracked(relPath: string): boolean {
  try {
    const out = execFileSync('git', ['ls-files', '--error-unmatch', relPath], {
      cwd: REPO_ROOT,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.toString().trim().length > 0;
  } catch {
    return false;
  }
}

function run(): void {
  // #1/#2 — must not be tracked (real provider keys live here; gitignored, .example only)
  assert.ok(
    !isTracked('Agent/agent-coding-api-keys/keys.json'),
    'Agent/agent-coding-api-keys/keys.json must not be tracked in git (see PHASE5G_CREDENTIAL_REMEDIATION.md)',
  );
  assert.ok(
    isTracked('Agent/agent-coding-api-keys/keys.example.json'),
    'Agent/agent-coding-api-keys/keys.example.json (placeholder template) should remain tracked',
  );

  // #5 — must not be tracked (real Google OAuth credential; gitignored, .example only)
  assert.ok(
    !isTracked('Raw/payroll/token.json'),
    'Raw/payroll/token.json must not be tracked in git (see PHASE5G_CREDENTIAL_REMEDIATION.md)',
  );
  assert.ok(
    isTracked('Raw/payroll/token.example.json'),
    'Raw/payroll/token.example.json (placeholder template) should remain tracked',
  );

  // #3/#4 — the stray file must not exist at all (it had no functional purpose)
  assert.ok(
    !fs.existsSync(path.join(REPO_ROOT, 'Other/VC/Format CV - NS South (web)/New Text Document.txt')),
    'the stray leaked-key text file must remain deleted',
  );

  // #6/#7 — must read from env, never a hardcoded literal
  for (const rel of ['keep-qb-heartbeat.js', 'send-qb-heartbeat.js']) {
    const filePath = path.join(REPO_ROOT, rel);
    assert.ok(fs.existsSync(filePath), `expected ${rel} to still exist`);
    const source = fs.readFileSync(filePath, 'utf8');
    assert.ok(
      /MI_CORE_API_KEY\s*=\s*process\.env\.MI_CORE_API_KEY/.test(source),
      `${rel} must read MI_CORE_API_KEY from process.env, not a hardcoded literal`,
    );
    assert.ok(
      !/MI_CORE_API_KEY\s*=\s*['"][A-Za-z0-9]{20,}['"]/.test(source),
      `${rel} must not contain a hardcoded MI_CORE_API_KEY literal`,
    );
  }

  console.log('[tracked-credential-scan] PASS');
}

run();
