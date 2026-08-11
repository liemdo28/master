import * as assert from 'assert';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

function run(label: string, args: string[]) {
  execFileSync(process.execPath, ['--import', 'tsx', ...args], { stdio: 'inherit', cwd: path.resolve(__dirname, '../..') });
  return label;
}

function main() {
  const repo = path.resolve(__dirname, '../../..');
  const packageJson = JSON.parse(fs.readFileSync(path.join(repo, 'server/package.json'), 'utf8'));
  for (const script of ['test:operator-control-center', 'test:operator-control-center-security', 'operator-control:evaluation', 'phase6c:acceptance']) {
    assert.ok(packageJson.scripts[script], `${script} script is registered`);
  }
  run('core', ['src/operator-control/__tests__/operator-control.test.ts']);
  run('security', ['src/operator-control/__tests__/operator-control-security.test.ts']);
  run('evaluation', ['src/operator-control/operator-control-evaluation.ts']);
  console.log('[phase6c-acceptance] PASS');
}

main();
