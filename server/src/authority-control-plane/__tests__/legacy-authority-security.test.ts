import assert from 'assert';
import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { generateAuthorityManifest } from '../scanner';
import { legacyMutationSurfaces, validateLegacyAuthorityRuntime, LegacyAuthorityAdapter } from '../legacy-adapter';

const DIRECT_EXECUTOR_MODULES = [
  '../actions/google-executor',
  '../actions/gmail-action-adapter',
  '../approval/gate',
  'child_process',
];

const LEGACY_ROUTE_FILES = [
  'src/routes/approval.ts',
  'src/routes/browser-agent.ts',
  'src/routes/voice.ts',
  'src/company-os/company-os-router.ts',
  'src/n8n/n8n-router.ts',
  'src/autonomous/autonomous-router.ts',
  'src/routes/operations.ts',
  'src/routes/workflow-metrics.ts',
  'src/routes/engineering.ts',
  'src/routes/ai-platform.ts',
];

function importsOf(file: string): string[] {
  const source = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const imports: string[] = [];
  sf.forEachChild(node => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text);
    if (ts.isCallExpression(node) && node.expression.getText(sf) === 'require' && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
      imports.push(node.arguments[0].text);
    }
  });
  return imports;
}

function run(): void {
  process.env.MI_AUTHORITY_EVIDENCE_DISABLED = '1';
  const manifest = generateAuthorityManifest(process.cwd());
  const repoRootManifest = generateAuthorityManifest(path.resolve(process.cwd(), '..'));
  assert.strictEqual(repoRootManifest.counts.total, manifest.counts.total, 'repo-root manifest generation matches server-root total');
  assert.strictEqual(repoRootManifest.counts.legacyMutations, manifest.counts.legacyMutations, 'repo-root manifest generation matches server-root legacy count');
  validateLegacyAuthorityRuntime(manifest);
  const adapter = new LegacyAuthorityAdapter(process.cwd());
  const legacy = legacyMutationSurfaces(manifest);
  assert.strictEqual(manifest.counts.unresolvedLegacyMutations, 0);
  assert.strictEqual(legacy.filter(s => !s.phase6bDisposition).length, 0);
  assert.strictEqual(legacy.filter(s => s.effectClass === 'PROCESS_CONTROL' && s.adapterTarget).length, 0, 'process control cannot be adapted');
  assert.strictEqual(legacy.filter(s => s.runtimeMount.includes('/money') && s.adapterTarget).length, 0, 'money surfaces cannot be adapted');

  for (const required of [
    'http:POST:/api/browser/write',
    'http:POST:/api/voice/output/send',
    'http:POST:/api/n8n/trigger/:id',
    'http:POST:/api/company-os/money/:workflow_id',
    'http:POST:/api/coo-v4/execute',
    'http:POST:/api/nodes/:id/exec',
  ]) {
    const surface = manifest.surfaces.find(s => s.id === required);
    assert.ok(surface, `${required} exists`);
    assert.strictEqual(surface!.phase6bDisposition, 'QUARANTINE_ONLY', `${required} is quarantined`);
    assert.ok(surface!.quarantineHandler, `${required} has quarantine handler`);
  }

  const gmailSend = adapter.adapt({
    surfaceId: 'http:POST:/api/approval/request',
    body: { category: 'gmail_send', payload: { to: ['a@example.com'], subject: 'x', body: 'x' } },
  });
  assert.strictEqual(gmailSend.code, 'FORBIDDEN');
  assert.strictEqual(gmailSend.canonicalProposalId, null);

  const featureFlagBypass = process.env.ALLOW_LEGACY_UNSAFE;
  process.env.ALLOW_LEGACY_UNSAFE = 'true';
  try {
    const blocked = adapter.quarantine('http:POST:/api/n8n/trigger/:id', 'generic workflow trigger blocked');
    assert.strictEqual(blocked.code, 'QUARANTINED');
  } finally {
    if (featureFlagBypass === undefined) delete process.env.ALLOW_LEGACY_UNSAFE;
    else process.env.ALLOW_LEGACY_UNSAFE = featureFlagBypass;
  }

  for (const rel of LEGACY_ROUTE_FILES) {
    const abs = path.join(process.cwd(), rel);
    if (!fs.existsSync(abs)) continue;
    const imports = importsOf(abs);
    if (rel.endsWith('approval.ts')) {
      assert.ok(!imports.some(item => item.includes('google-executor') || item.includes('gmail-action-adapter')), `${rel} must not import direct provider executor`);
      continue;
    }
    assert.ok(!imports.includes('../actions/google-executor'), `${rel} must not import google executor`);
    assert.ok(!imports.includes('../actions/gmail-action-adapter'), `${rel} must not import gmail send adapter`);
  }

  const controlled = fs.readFileSync('src/personal-os/actions/service.ts', 'utf8');
  assert.ok(controlled.includes("sendUpdates: 'none'"), 'calendar create keeps sendUpdates none');
  assert.ok(controlled.includes('GMAIL_SEND_DRAFT is documented but not implemented'), 'Gmail SEND remains hard-blocked');

  const actionTypes = fs.readFileSync('src/personal-os/actions/types.ts', 'utf8');
  for (const forbidden of ['GMAIL_REPLY', 'GMAIL_FORWARD', 'FINANCIAL_TRANSFER', 'PURCHASE']) {
    assert.ok(!actionTypes.includes(forbidden), `forbidden action type absent: ${forbidden}`);
  }

  console.log('[legacy-authority-security] PASS', {
    legacyMutations: manifest.counts.legacyMutations,
    adapted: manifest.counts.adaptedLegacy,
    quarantined: manifest.counts.quarantinedLegacy,
    unresolved: manifest.counts.unresolvedLegacyMutations,
  });
}

run();
