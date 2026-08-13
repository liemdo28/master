/**
 * Regression test for the D:->F: drive-migration hotfix
 * (codex/hotfix-production-f-drive-runtime): every PM2 app definition in the
 * repository root's ecosystem.config.js must resolve to a real, existing path
 * relative to __dirname — never a hardcoded D:\ or E:\ absolute path — so this
 * file is runnable unchanged from any checkout location.
 *
 * This test assumes builds have already run (matches the existing convention:
 * authority:manifest:check and similar gates assume a built tree, not a raw
 * checkout). Run `npm run build` at the repo root and `npm run build` inside
 * services/qb-ops-agent before this test in CI/production-recovery gates.
 */
import assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const ECOSYSTEM_PATH = path.join(REPO_ROOT, 'ecosystem.config.js');

interface App {
  name: string;
  script: string;
  cwd: string;
  args?: string;
  env?: Record<string, string>;
  env_production?: Record<string, string>;
}

function run(): void {
  assert.ok(fs.existsSync(ECOSYSTEM_PATH), `ecosystem.config.js must exist at repo root: ${ECOSYSTEM_PATH}`);

  // Read as text first for the raw stale-path scan — before requiring it, so a
  // hardcoded D:/E: path is caught as literal source text, not just a resolved
  // value that could coincidentally look fine on this particular machine.
  const raw = fs.readFileSync(ECOSYSTEM_PATH, 'utf-8');
  const staleDriveRefs = raw.match(/[DE]:[\\/]/g) ?? [];
  assert.deepStrictEqual(staleDriveRefs, [], `ecosystem.config.js must contain 0 stale D:\\ or E:\\ absolute paths, found: ${JSON.stringify(staleDriveRefs)}`);

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const cfg = require(ECOSYSTEM_PATH) as { apps: App[] };
  assert.ok(Array.isArray(cfg.apps) && cfg.apps.length > 0, 'ecosystem.config.js must export a non-empty apps array');

  // No duplicate names.
  const names = cfg.apps.map(a => a.name);
  assert.deepStrictEqual(names, [...new Set(names)], `app names must be unique, got: ${JSON.stringify(names)}`);

  for (const app of cfg.apps) {
    // cwd must exist.
    assert.ok(fs.existsSync(app.cwd), `${app.name}: cwd does not exist: ${app.cwd}`);

    // Script/entrypoint must exist after the proper build — except for a bare
    // interpreter name resolved via PATH (e.g. mi-ai-service's script: 'python'),
    // which is not a filesystem path at all.
    const isInterpreterOnly = !app.script.includes('/') && !app.script.includes('\\') && !app.script.endsWith('.js') && !app.script.endsWith('.mjs') && !app.script.endsWith('.ts');
    if (!isInterpreterOnly) {
      const resolved = path.isAbsolute(app.script) ? app.script : path.join(app.cwd, app.script);
      assert.ok(fs.existsSync(resolved), `${app.name}: script/entrypoint does not exist (build it first): ${resolved}`);
    }

    // No stale D:/E: path in any resolved cwd/env value.
    assert.ok(!/^[DE]:[\\/]/i.test(app.cwd), `${app.name}: cwd must not be a hardcoded D:\\/E:\\ path: ${app.cwd}`);
    for (const envSet of [app.env, app.env_production]) {
      if (!envSet) continue;
      for (const [key, value] of Object.entries(envSet)) {
        if (typeof value === 'string') {
          assert.ok(!/^[DE]:[\\/]/i.test(value), `${app.name}: env.${key} must not be a hardcoded D:\\/E:\\ path: ${value}`);
        }
      }
    }
  }

  // mi-core must remain port 4001.
  const miCore = cfg.apps.find(a => a.name === 'mi-core')!;
  assert.ok(miCore, 'mi-core app definition must exist');
  assert.strictEqual(miCore.env?.MI_PORT, '4001', 'mi-core MI_PORT must remain 4001');
  assert.strictEqual(miCore.env_production?.MI_PORT, '4001', 'mi-core env_production MI_PORT must remain 4001');

  // mi-ai-service must remain port 4002 (embedded in its uvicorn args, not a
  // separate env var).
  const miAiService = cfg.apps.find(a => a.name === 'mi-ai-service')!;
  assert.ok(miAiService, 'mi-ai-service app definition must exist');
  assert.ok(miAiService.args?.includes('--port 4002'), `mi-ai-service must remain port 4002, got args: ${miAiService.args}`);

  // qb-ops-agent must exist (was entirely missing from ecosystem.config.js before
  // this hotfix) and point at its verified, build-proven entrypoint.
  const qbOpsAgent = cfg.apps.find(a => a.name === 'qb-ops-agent')!;
  assert.ok(qbOpsAgent, 'qb-ops-agent app definition must exist');
  assert.strictEqual(qbOpsAgent.script, 'dist/index.js', 'qb-ops-agent script must be dist/index.js (the verified tsc build output — see services/qb-ops-agent/tsconfig.json outDir/rootDir)');

  // Expected production env exists where required — mi-core and mi-ai-service are
  // the two services this recovery brings up first, so their env_production must
  // be present and non-empty.
  for (const requiredName of ['mi-core', 'mi-ai-service']) {
    const app = cfg.apps.find(a => a.name === requiredName)!;
    assert.ok(app.env_production && Object.keys(app.env_production).length > 0, `${requiredName}: env_production must be defined and non-empty`);
  }

  console.log(`[pm2-ecosystem-paths] PASS — ${cfg.apps.length} apps, 0 stale D:\\/E:\\ paths, 0 duplicate names, mi-core=4001, mi-ai-service=4002`);
}

run();
