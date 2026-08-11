const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const rootRegistry = path.resolve(__dirname, '..', 'test-results', 'e2e-fixture-roots.jsonl');

function registeredRoots() {
  if (!fs.existsSync(rootRegistry)) return [];
  return fs.readFileSync(rootRegistry, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => {
      try { return JSON.parse(line).root; } catch { return null; }
    })
    .filter(Boolean);
}

function cleanupRegisteredRoots() {
  const tempRoot = fs.realpathSync(os.tmpdir());
  for (const root of registeredRoots()) {
    try {
      const fixtureRoot = fs.existsSync(root) ? fs.realpathSync(root) : path.resolve(root);
      if (!fixtureRoot.startsWith(tempRoot) || !fixtureRoot.includes('mi-5e-e2e-')) continue;
      fs.rmSync(fixtureRoot, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
    } catch {
      // Best effort: a failed cleanup should not hide the Playwright result.
    }
  }
  try { fs.rmSync(rootRegistry, { force: true }); } catch {}
}

const playwrightCli = path.resolve(__dirname, '..', 'node_modules', '@playwright', 'test', 'cli.js');
const result = spawnSync(process.execPath, [playwrightCli, 'test'], {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'inherit',
  env: process.env,
});

cleanupRegisteredRoots();
if (result.error) console.error(result.error);
process.exit(result.status ?? 1);
