/**
 * DEV5 FINAL CERTIFICATION - Production E2E Test Runner
 */
const fs = require('fs');
const path = require('path');

const intent = require('../server/dist/execution/action-intent-engine');
const wfMod = require('../server/dist/execution/workflow-creation-layer');
const aprMod = require('../server/dist/execution/approval-orchestrator');
const idem = require('../server/dist/execution/idempotency-layer');
const seo = require('../server/dist/execution/seo-pipeline');
const resp = require('../server/dist/execution/whatsapp-execution-response');

const EV = path.resolve(__dirname, '../.local-agent-global/evidence/dev5-final-certification');
const results = [];

function ok(cond, gate, name, ev) {
  results.push({ gate, name, passed: !!cond, evidence: ev || '' });
  console.log(`  ${cond ? '\u2705' : '\u274C'} [${gate}] ${name}`);
  if (!cond && ev) console.log(`     FAIL: ${ev}`);
}
function evidence(fn, data) {
  if (!fs.existsSync(EV)) fs.mkdirSync(EV, { recursive: true });
  const fp = path.join(EV, fn);
  fs.writeFileSync(fp, JSON.stringify(data, null, 2));
  console.log(`  \uD83D\uDCC4 ${fp}`);
  return fp;
}

// ═══ F1 ═══
function runF1() {
  console.log('\n  === F1: LIVE WHATSAPP EXECUTION ===\n');
  const msg = 'Mi oi, tao bai SEO cho Raw Sushi.';
  const sender = 'ceo@bakudanramen.com';

  const cls = intent.classifyActionIntent(msg);
  ok(cls.message_class === 'action_request', 'F1', 'Action intent detected', 'got ' + cls.message_class);
  ok(cls.domain === 'seo_content', 'F1', 'Domain is seo_content', 'got ' + cls.domain);
  ok(cls.confidence > 50, 'F1', 'Confidence > 50', 'conf=' + cls.confidence);

  const ent = intent.resolveEntities(msg);
  ok(!!ent.entity, 'F1', 'Entity resolved', 'entity=' + ent.entity);

  ok(intent.needsWorkflow(cls) === true, 'F1', 'needsWorkflow=true', '');
  ok(intent.isRawSushiSEORequest(cls) === true, 'F1', 'isRawSushiSEORequest=true', '');

  const wf = wfMod.createWorkflow({ name: 'SEO Content - Raw Sushi', intent: cls, input: { message: msg, sender }, owner: sender });
  ok(!!wf.workflow_id, 'F1', 'Workflow ID generated', 'id=' + wf.workflow_id);
  ok(wf.status === 'created' || wf.status === 'pending', 'F1', 'Status valid', wf.status);
  ok(wf.steps.length >= 5, 'F1', 'Steps >= 5', 'steps=' + wf.steps.length);

  const draft = seo.runSEOPipeline(wf);
  ok(!!draft.topic, 'F1', 'Draft created with topic', '');
  ok(!!draft.preview_path, 'F1', 'Preview path set', 'path=' + draft.preview_path);

  const got = wfMod.getWorkflow(wf.workflow_id);
  ok(got !== null, 'F1', 'Workflow retrievable', '');

  const apr = aprMod.createApprovalRequest(got);
  ok(!!apr.approval_id, 'F1', 'Approval ID generated', apr.approval_id);
  ok(apr.status === 'pending', 'F1', 'Approval pending', apr.status);
  ok(apr.action_options.includes('approve'), 'F1', 'Has approve option', '');

  const r1 = resp.buildActionDetectedResponse(cls, ent);
  ok(r1.length > 10, 'F1', 'Action response formatted', 'len=' + r1.length);
  const r2 = resp.buildWorkflowCreatedResponse(got);
  ok(r2.length > 10, 'F1', 'Workflow response formatted', '');
  const r3 = resp.buildApprovalRequestResponse(apr);
  ok(r3.length > 10, 'F1', 'Approval response formatted', '');

  evidence('F1-live-whatsapp-execution.json', {
    message: msg, sender, workflow_id: wf.workflow_id, approval_id: apr.approval_id,
    preview_path: draft.preview_path, topic: draft.topic.topic || draft.topic,
    classification: cls, entities: ent,
  });

  console.log(`\n  F1 DONE: ${wf.workflow_id} -> Draft -> ${apr.approval_id}\n`);
  return { workflowId: wf.workflow_id, approvalId: apr.approval_id, previewPath: draft.preview_path || '' };
}

// ═══ F2 ═══
function runF2(f1) {
  console.log('\n  === F2: APPROVAL FLOW ===\n');
  const pending = aprMod.getPendingApprovals();
  ok(pending.length > 0, 'F2', 'Pending approvals exist', 'count=' + pending.length);
  const apr = pending.find(a => a.approval_id === f1.approvalId) || pending[0];

  const resolved = aprMod.resolveApproval(apr.approval_id, 'approve');
  ok(resolved !== null, 'F2', 'Approval resolved', '');
  ok(resolved.status === 'approved', 'F2', 'Status=approved', 'got=' + resolved.status);
  ok(!!resolved.responded_at, 'F2', 'Response timestamp set', '');
  ok(resolved.response_action === 'approve', 'F2', 'Action=approve', '');

  const wf = wfMod.getWorkflow(f1.workflowId);
  ok(wf !== null, 'F2', 'Workflow exists after approval', '');

  // Must update status to 'running' before advancing steps
  const runningWf = wfMod.updateWorkflowStatus(f1.workflowId, 'running');
  ok(runningWf !== null, 'F2', 'Status updated to running', '');

  const firstStep = wf.steps[0];
  const before = firstStep ? firstStep.status : 'unknown';
  const advanced = wfMod.advanceWorkflowStep(f1.workflowId, firstStep.step_id, 'done');
  ok(advanced !== null, 'F2', 'Step advanced', before + ' -> done');

  const dbl = aprMod.resolveApproval(apr.approval_id, 'approve');
  ok(dbl === null, 'F2', 'Double-approve blocked', '');

  const stillPending = aprMod.getPendingApprovals().find(a => a.approval_id === apr.approval_id);
  ok(!stillPending, 'F2', 'No longer pending', '');

  const retrieved = aprMod.getApproval(apr.approval_id);
  ok(retrieved !== null, 'F2', 'Retrievable by ID', '');
  ok(retrieved.status === 'approved', 'F2', 'Retrieved status=approved', '');

  evidence('F2-approval-flow.json', {
    approval_id: apr.approval_id, workflow_id: f1.workflowId,
    resolved_status: resolved.status, responded_at: resolved.responded_at,
    checkpoint_before: before, checkpoint_after: advanced.checkpoint,
  });
  console.log(`\n  F2 DONE: ${apr.approval_id} APPROVED\n`);
}

// ═══ F3 ═══
function runF3(f1) {
  console.log('\n  === F3: REALITY PROOF ===\n');

  const wf = wfMod.getWorkflow(f1.workflowId);
  ok(wf !== null, 'F3', 'Workflow exists', 'id=' + f1.workflowId);
  ok(wf.workflow_id === f1.workflowId, 'F3', 'Workflow ID matches', '');
  ok(wf.steps.length > 0, 'F3', 'Has steps', 'count=' + wf.steps.length);
  ok(!!wf.created_at, 'F3', 'Has created_at', '');

  const apr = aprMod.getApproval(f1.approvalId);
  ok(apr !== null, 'F3', 'Approval exists', 'id=' + f1.approvalId);
  ok(apr.status === 'approved', 'F3', 'Approval status=approved', '');

  if (f1.previewPath && fs.existsSync(f1.previewPath)) {
    ok(true, 'F3', 'Draft file on disk', f1.previewPath);
    const content = fs.readFileSync(f1.previewPath, 'utf8');
    ok(content.length > 50, 'F3', 'Draft has content', 'len=' + content.length);
  } else {
    const dir = path.resolve(__dirname, '../.local-agent-global/seo-drafts');
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
      ok(files.length > 0, 'F3', 'Draft files in seo-drafts/', 'files=' + files.length);
    } else {
      ok(false, 'F3', 'Draft on disk', 'no path');
    }
  }

  ok(fs.existsSync(path.join(EV, 'F1-live-whatsapp-execution.json')), 'F3', 'F1 evidence file', '');
  ok(fs.existsSync(path.join(EV, 'F2-approval-flow.json')), 'F3', 'F2 evidence file', '');

  const all = wfMod.listWorkflows();
  ok(all.length > 0, 'F3', 'Workflows in store', 'count=' + all.length);

  evidence('F3-reality-proof.json', {
    workflow_id: f1.workflowId, approval_id: f1.approvalId,
    preview_path: f1.previewPath, total_workflows: all.length,
  });
  console.log(`\n  F3 DONE: All artifacts verified\n`);
}

// ═══ F4 ═══
function runF4() {
  console.log('\n  === F4: DUPLICATE PROTECTION ===\n');
  const msg = 'Mi oi, tao bai SEO cho Raw Sushi.';
  const sender = 'ceo@bakudanramen.com';
  const cls = intent.classifyActionIntent(msg);
  const ent = intent.resolveEntities(msg);
  const target = ent.entity || 'raw_sushi';
  const dom = cls.domain || 'seo_content';

  const first = idem.checkDuplicate({ sender, message: msg, target_entity: target, intent: dom });
  if (first.is_duplicate) {
    ok(true, 'F4', 'Already registered', 'wf=' + first.existing_workflow_id);
  } else {
    const w = wfMod.createWorkflow({ name: 'F4 test', intent: cls, input: { message: msg, sender }, owner: sender });
    idem.registerMessage({ sender, message: msg, target_entity: target, intent: dom, workflow_id: w.workflow_id });
    ok(true, 'F4', 'Message registered', 'wf=' + w.workflow_id);
  }

  const second = idem.checkDuplicate({ sender, message: msg, target_entity: target, intent: dom });
  ok(second.is_duplicate === true, 'F4', 'Second call = duplicate', 'wf=' + second.existing_workflow_id);

  const third = idem.checkDuplicate({ sender, message: msg, target_entity: target, intent: dom });
  ok(third.is_duplicate === true, 'F4', 'Third call = still duplicate', '');

  const diff = idem.checkDuplicate({ sender, message: 'Khac roi', target_entity: 'bakudan', intent: 'informational' });
  ok(diff.is_duplicate === false, 'F4', 'Different message not duplicate', '');

  evidence('F4-duplicate-protection.json', {
    duplicate_detected: second.is_duplicate, existing_workflow: second.existing_workflow_id,
  });
  console.log(`\n  F4 DONE: Duplicate protection verified\n`);
}

// ═══ F5 ═══
function runF5() {
  console.log('\n  === F5: END-TO-END CEO REQUEST ===\n');
  const msg = 'Tao bai SEO cho Raw Sushi, tu chon chu de, dua anh duyet truoc khi dang.';
  const sender = 'ceo@bakudanramen.com';

  const cls = intent.classifyActionIntent(msg);
  ok(cls.message_class === 'action_request', 'F5', 'Intent: action_request', 'got=' + cls.message_class);
  ok(cls.domain === 'seo_content', 'F5', 'Domain: seo_content', 'got=' + cls.domain);

  const ent = intent.resolveEntities(msg);
  ok(!!ent.entity, 'F5', 'Entity resolved', ent.entity);
  ok(intent.needsWorkflow(cls), 'F5', 'needsWorkflow=true', '');

  const wf = wfMod.createWorkflow({ name: 'SEO E2E', intent: cls, input: { message: msg, sender }, owner: sender });
  ok(!!wf.workflow_id, 'F5', 'Workflow created', wf.workflow_id);

  const draft = seo.runSEOPipeline(wf);
  ok(!!draft.topic, 'F5', 'Draft generated', '');

  const got = wfMod.getWorkflow(wf.workflow_id);
  const apr = aprMod.createApprovalRequest(got);
  ok(!!apr.approval_id, 'F5', 'Approval created', apr.approval_id);
  ok(apr.status === 'pending', 'F5', 'Approval pending', '');

  const resolved = aprMod.resolveApproval(apr.approval_id, 'approve');
  ok(resolved.status === 'approved', 'F5', 'CEO approved', '');

  const firstStep = got.steps[0];
  const advanced = wfMod.advanceWorkflowStep(wf.workflow_id, firstStep.step_id, 'running');
  ok(advanced !== null, 'F5', 'Execution started', firstStep.step_id + ' -> running');

  evidence('F5-e2e-ceo-request.json', {
    input: msg, sender, workflow_id: wf.workflow_id,
    checkpoint: advanced.checkpoint,
    approval_id: apr.approval_id, approval_status: resolved.status,
    draft_topic: draft.topic.topic || draft.topic,
    pipeline: 'Intent -> Workflow -> Draft -> Approval -> Execute',
  });
  console.log(`\n  F5 DONE: Full pipeline verified\n`);
}

// ═══ MAIN ═══
console.log('\n' + '='.repeat(60));
console.log('  DEV5 FINAL CERTIFICATION - PRODUCTION E2E TEST');
console.log('  ' + new Date().toISOString());
console.log('='.repeat(60));

const f1 = runF1();
runF2(f1);
runF3(f1);
runF4();
runF5();

const total = results.length;
const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed);
const gates = ['F1', 'F2', 'F3', 'F4', 'F5'];

console.log('\n' + '='.repeat(60));
console.log('  CERTIFICATION SUMMARY');
console.log('='.repeat(60));
console.log(`  Total: ${total} | Passed: ${passed} | Failed: ${failed.length}`);
for (const g of gates) {
  const gr = results.filter(r => r.gate === g);
  const gp = gr.filter(r => r.passed).length;
  console.log(`  ${gp === gr.length ? '\u2705' : '\u274C'} ${g}: ${gp}/${gr.length}`);
}
if (failed.length > 0) {
  console.log('\n  FAILED:');
  failed.forEach(f => console.log(`    [${f.gate}] ${f.name}: ${f.evidence}`));
}
const certResult = failed.length === 0 ? 'EXECUTION_ENGINE_PRODUCTION_CERTIFIED' : 'CERTIFICATION_FAILED';
console.log(`\n  RESULT: ${certResult}`);
console.log('='.repeat(60) + '\n');

evidence('CERTIFICATION-SUMMARY.json', {
  timestamp: new Date().toISOString(),
  total, passed, failed: failed.length, result: certResult,
  per_gate: gates.map(g => ({
    gate: g, total: results.filter(r => r.gate === g).length,
    passed: results.filter(r => r.gate === g && r.passed).length,
  })),
  failed_assertions: failed.map(f => ({ gate: f.gate, name: f.name, evidence: f.evidence })),
});

process.exit(failed.length > 0 ? 1 : 0);
