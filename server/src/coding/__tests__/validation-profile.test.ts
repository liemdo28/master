import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';

import type { ProjectRecord, ValidationProfile } from '../../project-registry/types';
import {
  buildValidationPlan,
  captureValidationArtifactBaseline,
  classifyValidationArtifacts,
  runValidationPlan,
} from '../validation-runner';

let checks = 0;
function check(label: string, condition: boolean, detail = ''): void {
  if (!condition) throw new Error(`FAILED: ${label} ${detail}`);
  checks += 1;
  console.log(`[validation-profile] ok  ${label}`);
}

function write(root: string, relative: string, content: string): void {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function git(root: string, args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function initRepo(root: string): void {
  git(root, ['init', '--initial-branch=main']);
  git(root, ['config', 'user.name', 'Validation Profile Test']);
  git(root, ['config', 'user.email', 'validation@example.invalid']);
  git(root, ['add', '--', '.']);
  git(root, ['commit', '-m', 'seed']);
}

function project(root: string, profile: ValidationProfile): ProjectRecord {
  return {
    id: 'validation-fixture',
    displayName: 'Validation Fixture',
    canonicalRoot: root,
    gitRoot: root,
    repositoryUrl: null,
    defaultBranch: 'main',
    owner: null,
    businessPurpose: null,
    runtimeHints: [],
    packageManagers: [],
    frameworks: [],
    testCommands: profile.testCommands,
    buildCommands: profile.buildCommands,
    validationProfile: profile,
    deploymentNotes: null,
    runtimeProcesses: [],
    importantPaths: {},
    status: 'ACTIVE',
    mapStatus: 'FRESH',
    mapVersion: 'map-test',
    mapGeneratedAt: null,
    mapSourceSha: null,
    lastVerifiedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function run(): Promise<void> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-validation-profile-'));
  write(root, 'package.json', JSON.stringify({
    scripts: {
      build: 'node -e "require(\'fs\').mkdirSync(\'dist\', {recursive:true});require(\'fs\').writeFileSync(\'dist/out.txt\', \'ok\')"',
      test: 'node -e "process.exit(0)"',
      'test:ci': 'node -e "process.exit(0)"',
      lint: 'node -e "process.exit(0)"',
      fail: 'node -e "process.exit(7)"',
    },
  }, null, 2));
  write(root, 'src/app.js', 'export const ok = true;\n');
  initRepo(root);

  const tsProfile: ValidationProfile = {
    language: 'typescript',
    framework: 'node',
    installCommands: [],
    buildCommands: ['npm run build'],
    testCommands: ['npm test'],
    lintCommands: ['npm run lint'],
    artifactPaths: [],
    generatedOutputPaths: ['dist'],
    cleanupPolicy: 'none',
    successCriteria: ['commands exit 0'],
  };
  const tsPlan = buildValidationPlan(project(root, tsProfile), root);
  check('TypeScript profile orders build, lint, test and diff', tsPlan.map(item => item.name).join('|') === 'npm run build|npm run lint|npm test|git diff --check');
  const tsResults = await runValidationPlan(tsPlan);
  check('TypeScript validation commands pass', tsResults.every(result => result.configured && result.exitCode === 0));

  const flutterProfile: ValidationProfile = {
    language: 'dart',
    framework: 'flutter',
    installCommands: ['flutter pub get'],
    buildCommands: [],
    testCommands: ['flutter test test/api_paths_test.dart'],
    lintCommands: ['flutter analyze'],
    artifactPaths: [],
    generatedOutputPaths: ['.dart_tool', 'build'],
    cleanupPolicy: 'none',
    successCriteria: ['flutter commands exit 0'],
  };
  write(root, 'apps/mobile/pubspec.yaml', 'name: fixture\n');
  const flutterPlan = buildValidationPlan(project(root, flutterProfile), root);
  check('Flutter profile uses Flutter cwd', flutterPlan.every(item => item.cwd.endsWith(path.join('apps', 'mobile')) || item.name === 'git diff --check'));
  check('Flutter profile emits flutter commands', flutterPlan.map(item => item.name).join('|') === 'flutter pub get|flutter analyze|flutter test test/api_paths_test.dart|git diff --check');
  check('Flutter focused test path is passed as an argv argument', flutterPlan.some(item => item.args.includes('test/api_paths_test.dart')));

  const missingPlan = buildValidationPlan(project(root, tsProfile), root, ['npm run external:integration', 'rm -rf .']);
  check('missing npm script is marked unconfigured', missingPlan.some(item => item.name === 'npm run external:integration' && !item.configured));
  check('shell syntax command is marked unconfigured', missingPlan.some(item => item.name === 'rm -rf .' && !item.configured));

  const failing = await runValidationPlan(buildValidationPlan(project(root, { ...tsProfile, testCommands: ['npm run fail'] }), root));
  check('failed validation preserves non-zero exit', failing.some(result => result.name === 'npm run fail' && result.exitCode === 7));

  fs.rmSync(path.join(root, 'dist'), { recursive: true, force: true });
  const beforeGenerated = captureValidationArtifactBaseline(root);
  write(root, 'dist/generated.txt', 'generated\n');
  const generatedReport = classifyValidationArtifacts({ project: project(root, tsProfile), worktreePath: root, before: beforeGenerated });
  check(
    'artifact allowlist accepts generated output',
    generatedReport.baseCheckoutUnchanged && generatedReport.expectedGeneratedArtifacts.some(item => item.includes('dist')),
    JSON.stringify(generatedReport)
  );

  const beforeUnexpected = captureValidationArtifactBaseline(root);
  fs.appendFileSync(path.join(root, 'src', 'app.js'), 'export const changed = true;\n');
  const unexpectedReport = classifyValidationArtifacts({ project: project(root, tsProfile), worktreePath: root, before: beforeUnexpected });
  check('dirty workspace protection flags source changes', !unexpectedReport.baseCheckoutUnchanged && unexpectedReport.unexpectedChanges.some(item => item.includes('src/app.js')));

  console.log(`\n[validation-profile] PASS — ${checks} assertions`);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
