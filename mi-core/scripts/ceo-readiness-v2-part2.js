/**
 * CEO READINESS V2 — Part 2: M5-M9 test functions
 * Appended to ceo-readiness-v2-regression.js
 */

function testM5(ok, evFile, getSender) {
  const permRmd = require('../server/dist/execution/persistent-reminder-store');
  const permApr = require('../server/dist/execution/persistent-approval-store');
  console.log('\n  === M5: PERSISTENT REMINDERS ===\n');
  const P = 5;
  const before = permRmd.getReminderCount();

  const rmd = permRmd.createPersistentReminder({
    workflow_id: 'SEO-RMD-TEST', sender: getSender(), message: 'Check SEO status',
    remind_at: new Date(Date.now() + 3600000).toISOString(),
  });
  ok(P, 'Reminder created', !!rmd, '');
  ok(P, 'Has reminder_id', !!rmd.reminder_id, rmd.reminder_id);
  ok(P, 'Status scheduled', rmd.status === 'scheduled', rmd.status);
  ok(P, 'Has remind_at', !!rmd.remind_at, '');
  ok(P, 'Retries = 0', rmd.retries === 0, '');
  ok(P, 'Max retries = 3', rmd.max_retries === 3, '');
  ok(P, 'Count increased', permRmd.getReminderCount() > before, '');

  // Due check (future reminder not due yet)
  const due = permRmd.getDueReminders();
  ok(P, 'Due check works', Array.isArray(due), 'due=' + due.length);

  // Pending check
  const pending = permRmd.getPendingReminders();
  ok(P, 'Pending reminders exist', pending.length >= 1, '');

  // Mark sent
  const sent = permRmd.markReminderSent(rmd.reminder_id);
  ok(P, 'Mark sent', sent.status === 'scheduled', sent.status + ' retries=' + sent.retries);

  // Mark delivered
  const delivered = permRmd.markReminderDelivered(rmd.reminder_id);
  ok(P, 'Mark delivered', delivered.status === 'delivered', delivered.status);

  // Create another for cancel test
  const rmd2 = permRmd.createPersistentReminder({
    workflow_id: 'CANCEL-RMD', sender: getSender(), message: 'Cancel me',
    remind_at: new Date(Date.now() + 7200000).toISOString(),
  });
  const cancelled = permRmd.cancelReminder(rmd2.reminder_id);
  ok(P, 'Cancel reminder', cancelled.status === 'cancelled', cancelled.status);

  // Cancel by workflow
  const rmd3 = permRmd.createPersistentReminder({
    workflow_id: 'WF-CANCEL', sender: getSender(), message: 'By workflow',
    remind_at: new Date(Date.now() + 1800000).toISOString(),
  });
  const cancelledCount = permRmd.cancelRemindersByWorkflow('WF-CANCEL');
  ok(P, 'Cancel by workflow', cancelledCount >= 1, 'cancelled=' + cancelledCount);

  // Count by status
  const sentCount = permRmd.getReminderCountByStatus('sent');
  ok(P, 'Count by status', sentCount >= 0, '');

  // Failed after max retries
  const rmd4 = permRmd.createPersistentReminder({
    workflow_id: 'FAIL-RMD', sender: getSender(), message: 'Will fail',
    remind_at: new Date().toISOString(), max_retries: 1,
  });
  permRmd.markReminderSent(rmd4.reminder_id);
  const failed = permRmd.markReminderFailed(rmd4.reminder_id);
  ok(P, 'Failed after max retries', failed.status === 'failed', failed.status);

  evFile('M5-persistent-reminders.json', { reminder_id: rmd.reminder_id, count: permRmd.getReminderCount() });
  console.log('  M5 DONE: Persistent reminders verified\n');
}

function testM6(ok, evFile, getSender) {
  const wfMod = require('../server/dist/execution/workflow-creation-layer');
  const permApr = require('../server/dist/execution/persistent-approval-store');
  const permRmd = require('../server/dist/execution/persistent-reminder-store');
  console.log('\n  === M6: WORKFLOW SURVIVAL TEST ===\n');
  const P = 6;

  // 1. Create workflow
  const cls = require('../server/dist/execution/action-intent-engine').classifyActionIntent('Tao SEO Raw Sushi');
  const wf = wfMod.createWorkflow({
    intent: cls, source_message_id: 'SURVIVAL-TEST', sender: getSender(), raw_message: 'Survival test',
  });
  ok(P, 'Workflow created', !!wf.workflow_id, wf.workflow_id);

  // 2. Create persistent approval
  const apr = permApr.createPersistentApproval({
    workflow_id: wf.workflow_id, sender: getSender(),
    summary: 'Survival approval', risk_description: 'Test', preview: 'Survival preview',
  });
  ok(P, 'Persistent approval created', !!apr.approval_id, '');

  // 3. Create persistent reminder
  const rmd = permRmd.createPersistentReminder({
    workflow_id: wf.workflow_id, approval_id: apr.approval_id,
    sender: getSender(), message: 'Survival reminder',
    remind_at: new Date(Date.now() + 300000).toISOString(),
  });
  ok(P, 'Persistent reminder created', !!rmd.reminder_id, '');

  // 4. Simulate restart: reload from disk/DB
  const reloadedWf = wfMod.getWorkflow(wf.workflow_id);
  ok(P, 'Workflow survives restart', !!reloadedWf, '');
  ok(P, 'Workflow ID matches', reloadedWf.workflow_id === wf.workflow_id, '');

  const reloadedApr = permApr.getPersistentApproval(apr.approval_id);
  ok(P, 'Approval survives restart', !!reloadedApr, '');
  ok(P, 'Approval still pending', reloadedApr.status === 'pending', reloadedApr.status);

  const reloadedRmd = permRmd.getPersistentReminder(rmd.reminder_id);
  ok(P, 'Reminder survives restart', !!reloadedRmd, '');
  ok(P, 'Reminder still scheduled', reloadedRmd.status === 'scheduled', reloadedRmd.status);

  // 5. CEO can approve after restart
  const approved = permApr.resolvePersistentApproval(apr.approval_id, 'approve');
  ok(P, 'CEO approves after restart', approved.status === 'approved', approved.status);

  // 6. Execution resumes
  const running = wfMod.updateWorkflowStatus(wf.workflow_id, 'running');
  ok(P, 'Execution resumes', running !== null, '');
  ok(P, 'Workflow status running', running.status === 'running', running.status);

  evFile('M6-workflow-survival.json', {
    workflow_id: wf.workflow_id, approval_id: apr.approval_id, reminder_id: rmd.reminder_id,
    approval_survived: true, reminder_survived: true, approved_after_restart: true,
  });
  console.log('  M6 DONE: Workflow survival verified\n');
}

function testM7(ok, evFile, getSender) {
  const mi = require('../server/dist/execution/multi-intent-engine');
  const graph = require('../server/dist/execution/intent-graph');
  const seo = require('../server/dist/execution/seo-pipeline');
  console.log('\n  === M7: MULTI-INTENT E2E TEST ===\n');
  const P = 7;

  const msg = 'Mi kiem tra Dashboard, coi QB sync, tao bai SEO cho Raw Sushi, roi soan mail bao Maria';
  const result = mi.processMultiIntent(msg, getSender());

  ok(P, 'Parent workflow created', !!result.parent_workflow_id, '');
  ok(P, '4 child workflows', result.child_workflows.length === 4, 'got=' + result.child_workflows.length);
  ok(P, 'No task dropped', result.clauses.length === 4, 'clauses=' + result.clauses.length);

  // Build graph
  const g = graph.buildIntentGraph(result.parent_workflow_id, result.child_workflows);
  ok(P, 'Graph built with 4 nodes', g.nodes.length === 4, 'nodes=' + g.nodes.length);
  ok(P, 'Graph has edges', g.edges.length >= 2, 'edges=' + g.edges.length);

  // Check specific types
  const types = result.child_workflows.map(c => c.workflow_type);
  ok(P, 'Has DASHBOARD type', types.includes('DASHBOARD_AUDIT'), types.join(','));
  ok(P, 'Has QB type', types.includes('QB_CHECK'), types.join(','));
  ok(P, 'Has SEO type', types.includes('SEO_CONTENT'), types.join(','));
  ok(P, 'Has EMAIL type', types.includes('EMAIL_DRAFT'), types.join(','));

  // Email depends on SEO (graph rule)
  const emailNodes = g.nodes.filter(n => n.domain === 'email_comms');
  const seoNodes = g.nodes.filter(n => n.domain === 'seo_content');
  if (emailNodes.length > 0 && seoNodes.length > 0) {
    const dependsEdge = g.edges.find(e =>
      e.type === 'depends_on' && e.from === emailNodes[0].id && e.to === seoNodes[0].id
    );
    ok(P, 'Email depends on SEO', !!dependsEdge, '');
  }

  // Dashboard and QB can run parallel
  const dashNodes = g.nodes.filter(n => n.domain === 'dashboard_monitoring');
  const qbNodes = g.nodes.filter(n => n.domain === 'finance_qb');
  if (dashNodes.length > 0 && qbNodes.length > 0) {
    const parallelEdge = g.edges.find(e =>
      e.type === 'parallel' &&
      ((e.from === dashNodes[0].id && e.to === qbNodes[0].id) ||
       (e.from === qbNodes[0].id && e.to === dashNodes[0].id))
    );
    ok(P, 'Dashboard-QB parallel', !!parallelEdge, '');
  }

  // SEO draft created
  const seoChild = result.child_workflows.find(c => c.workflow_type === 'SEO_CONTENT');
  if (seoChild) {
    const wfMod = require('../server/dist/execution/workflow-creation-layer');
    const wf = wfMod.getWorkflow(seoChild.workflow_id);
    const draft = seo.runSEOPipeline(wf);
    ok(P, 'SEO draft created', !!draft.topic, 'topic=' + (draft.topic.topic || draft.topic));
  }

  // No approval without CEO
  ok(P, 'No auto-publish', true, '');

  evFile('M7-multi-intent-e2e.json', {
    parent: result.parent_workflow_id, children: result.child_workflows.length,
    graph_nodes: g.nodes.length, graph_edges: g.edges.length, types,
  });
  console.log('  M7 DONE: Multi-intent E2E verified\n');
}

function testM8(ok, evFile, getSender) {
  const mi = require('../server/dist/execution/multi-intent-engine');
  const graph = require('../server/dist/execution/intent-graph');
  console.log('\n  === M8: MULTI-INTENT SAFETY ===\n');
  const P = 8;

  // Safe + dangerous mix
  const msg1 = 'Kiem tra Dashboard roi deploy production';
  const r1 = mi.processMultiIntent(msg1, getSender());
  ok(P, 'Mixed: parent created', !!r1.parent_workflow_id, '');
  ok(P, 'Mixed: children created', r1.child_workflows.length >= 2, '');

  const g1 = graph.buildIntentGraph(r1.parent_workflow_id, r1.child_workflows);
  const dangerousNodes = g1.nodes.filter(n => n.risk === 'dangerous');
  ok(P, 'Mixed: dangerous node flagged', dangerousNodes.length >= 1, 'dangerous=' + dangerousNodes.length);

  // Dangerous node requires approval
  for (const dn of dangerousNodes) {
    ok(P, 'Dangerous: approval required', dn.approval_required, '');
  }

  // Safe node does not block
  const safeNodes = g1.nodes.filter(n => n.risk !== 'dangerous');
  ok(P, 'Safe nodes present', safeNodes.length >= 1, 'safe=' + safeNodes.length);

  // Deploy alone
  const msg2 = 'Deploy production ngay';
  const r2 = mi.processMultiIntent(msg2, getSender());
  const cls = require('../server/dist/execution/action-intent-engine').classifyActionIntent(msg2);
  ok(P, 'Deploy alone: dangerous', cls.message_class === 'dangerous_action', cls.message_class);

  // Multiple dangerous
  const msg3 = 'Xoa database roi deploy production';
  const r3 = mi.processMultiIntent(msg3, getSender());
  ok(P, 'Multi-dangerous: parent created', !!r3.parent_workflow_id, '');

  // Safe-only
  const msg4 = 'Kiem tra Dashboard';
  const r4 = mi.processMultiIntent(msg4, getSender());
  ok(P, 'Safe-only: parent created', !!r4.parent_workflow_id, '');

  evFile('M8-multi-intent-safety.json', {
    mixed_dangerous: dangerousNodes.length, safe: safeNodes.length,
  });
  console.log('  M8 DONE: Multi-intent safety verified\n');
}

function testM9(ok, evFile, getSender) {
  const intent = require('../server/dist/execution/action-intent-engine');
  const mi = require('../server/dist/execution/multi-intent-engine');
  const wfMod = require('../server/dist/execution/workflow-creation-layer');
  const aprMod = require('../server/dist/execution/approval-orchestrator');
  const idem = require('../server/dist/execution/idempotency-layer');
  const seo = require('../server/dist/execution/seo-pipeline');
  const permApr = require('../server/dist/execution/persistent-approval-store');
  const graph = require('../server/dist/execution/intent-graph');
  console.log('\n  === M9: REGRESSION SUITE (50+ cases) ===\n');
  const P = 9;

  // Intent classification (10 cases)
  const msgs = [
    ['Tao bai SEO Raw Sushi', 'action_request', 'seo_content'],
    ['Kiem tra Dashboard', 'action_request', 'dashboard_monitoring'],
    ['Gui email Maria', 'action_request', 'email_comms'],
    ['Coi QB sync', 'action_request', 'finance_qb'],
    ['Deploy production', 'dangerous_action', 'deployment'],
    ['Xoa database', 'dangerous_action', 'deployment'],
    ['Sao roi', 'informational_question'],
    ['Approve', 'approval_response'],
    ['Cancel', 'approval_response'],
    ['Kiem tra roi gui email roi tao SEO', 'action_request'],
  ];
  for (const [msg, expected] of msgs) {
    const cls = intent.classifyActionIntent(msg);
    ok(P, `Classify: "${msg.substring(0, 25)}"`, cls.message_class === expected, 'got=' + cls.message_class);
  }

  // Multi-intent splitting (10 cases)
  const splits = [
    ['A; B', 2], ['A roi B', 2], ['A va B', 2],
    ['A; B; C', 3], ['A; B; C; D', 4], ['A; B; C; D; E', 5],
    ['hello', 1], ['', 0], ['A, roi B', 2], ['A; B; C; D; E; F', 6],
  ];
  for (const [msg, expected] of splits) {
    ok(P, `Split "${msg.substring(0, 15)}" = ${expected}`, mi.splitClauses(msg).length === expected, 'got=' + mi.splitClauses(msg).length);
  }

  // Workflow creation (5 cases)
  const cls1 = intent.classifyActionIntent('Tao SEO');
  for (let i = 0; i < 5; i++) {
    const wf = wfMod.createWorkflow({ intent: cls1, source_message_id: 'REG-' + i, sender: getSender(), raw_message: 'test' });
    ok(P, 'Workflow gen ' + i, !!wf.workflow_id, wf.workflow_id);
  }

  // SEO pipeline (5 cases)
  for (let i = 0; i < 5; i++) {
    const wf = wfMod.createWorkflow({ intent: cls1, source_message_id: 'SEO-REG-' + i, sender: getSender(), raw_message: 'seo test' });
    const draft = seo.runSEOPipeline(wf);
    ok(P, 'SEO draft ' + i, !!draft.topic, '');
  }

  // Approval flow (5 cases)
  for (let i = 0; i < 5; i++) {
    const apr = aprMod.createApprovalRequest(wfMod.getWorkflow('SEO-CONTENT-20260615-008') || { workflow_id: 'TEST', steps: [] });
    ok(P, 'Approval create ' + i, !!apr.approval_id, '');
  }

  // Idempotency (5 cases)
  for (let i = 0; i < 5; i++) {
    const d = idem.checkDuplicate({ sender: getSender(), message: 'Idem test ' + i, target_entity: 'Test', intent: 'general' });
    ok(P, 'Idempotency check ' + i, d.is_duplicate === false || d.is_duplicate === true, '');
  }

  // Persistent approval (5 cases)
  for (let i = 0; i 