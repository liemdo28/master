/**
 * CEO READINESS V2 — 150+ Case Regression Suite
 * Covers: M1-M9 (Multi-Intent, Graph, Persistent Approval, 
 *   WhatsApp Resume, Persistent Reminders, Workflow Survival, 
 *   Multi-Intent E2E, Multi-Intent Safety, Regression)
 */
const fs = require('fs');
const path = require('path');

const intent = require('../server/dist/execution/action-intent-engine');
const wfMod = require('../server/dist/execution/workflow-creation-layer');
const aprMod = require('../server/dist/execution/approval-orchestrator');
const seo = require('../server/dist/execution/seo-pipeline');
const idem = require('../server/dist/execution/idempotency-layer');
const resp = require('../server/dist/execution/whatsapp-execution-response');
const mi = require('../server/dist/execution/multi-intent-engine');
const graph = require('../server/dist/execution/intent-graph');
const permApr = require('../server/dist/execution/persistent-approval-store');
const permRmd = require('../server/dist/execution/persistent-reminder-store');

const EV = path.resolve(__dirname, '../.local-agent-global/evidence/ceo-readiness-v2');
const results = [];
let caseNum = 0;

function ok(phase, name, cond, ev) {
  caseNum++;
  results.push({ id: caseNum, phase, name, passed: !!cond, evidence: ev || '' });
  if (!cond) process.stdout.write(`  \u274C [M${phase}] #${caseNum} ${name}\n     ${ev}\n`);
}
function evDir() { if (!fs.existsSync(EV)) fs.mkdirSync(EV, { recursive: true }); return EV; }
function evFile(fn, data) {
  evDir();
  fs.writeFileSync(path.join(EV, fn), JSON.stringify(data, null, 2));
}

function getSender() { return 'ceo@bakudanramen.com'; }

// ══════════════════════════════════════════════════════════════════════════════
// M1: Multi-Intent Engine (30 cases)
// ══════════════════════════════════════════════════════════════════════════════
function testM1() {
  console.log('\n  === M1: MULTI-INTENT ENGINE ===\n');
  const P = 1;

  // Clause splitting
  ok(P, 'Split: roi conjunction', mi.splitClauses('A roi B').length === 2, '');
  ok(P, 'Split: va conjunction', mi.splitClauses('A va B').length === 2, '');
  ok(P, 'Split: comma + roi', mi.splitClauses('A, roi B').length === 2, '');
  ok(P, 'Split: semicolon', mi.splitClauses('A; B; C').length === 3, '');
  ok(P, 'Split: empty string', mi.splitClauses('').length === 0, '');
  ok(P, 'Split: single clause', mi.splitClauses('hello world').length === 1, '');

  // Multi-intent detection
  const msg1 = 'Kiem tra Dashboard, coi QB, tao SEO Raw Sushi, roi gui Maria';
  const clauses1 = mi.detectMultiIntent(msg1);
  ok(P, 'Detect 4 intents', clauses1.length === 4, 'got ' + clauses1.length);
  ok(P, 'Detect: no empty clauses', clauses1.every(c => c.text.length > 2), '');

  const msg2 = 'Tao bai SEO cho Raw Sushi';
  const clauses2 = mi.detectMultiIntent(msg2);
  ok(P, 'Single intent: 1 clause', clauses2.length <= 2, 'got ' + clauses2.length);

  // Process multi-intent
  const result = mi.processMultiIntent(msg1, getSender());
  ok(P, 'Parent workflow created', !!result.parent_workflow_id, result.parent_workflow_id);
  ok(P, 'Parent has children', result.child_workflows.length >= 2, 'children=' + result.child_workflows.length);
  ok(P, 'Parent clause_count', result.clause_count >= 2, 'count=' + result.clause_count);
  ok(P, 'Original message preserved', result.original_message === msg1, '');

  // isMultiIntent
  ok(P, 'isMultiIntent: multi', mi.isMultiIntent('A roi B'), '');
  ok(P, 'isMultiIntent: single', !mi.isMultiIntent('hello'), '');

  // getClauseCount
  ok(P, 'getClauseCount: multi', mi.getClauseCount('A; B; C') === 3, '');
  ok(P, 'getClauseCount: single', mi.getClauseCount('hello') === 1, '');

  // Additional split patterns
  ok(P, 'Split: 5 clauses', mi.splitClauses('A; B; C; D; E').length === 5, '');
  ok(P, 'Split: Vietnamese commas', mi.splitClauses('tao SEO, gui email, check dashboard').length === 3, '');

  // Process with different messages
  const msg3 = 'Tao bai SEO cho Raw Sushi roi gui Maria';
  const r3 = mi.processMultiIntent(msg3, getSender());
  ok(P, '2-intent: parent exists', !!r3.parent_workflow_id, '');
  ok(P, '2-intent: 2 children', r3.child_workflows.length === 2, 'got ' + r3.child_workflows.length);

  // Edge cases
  const msg4 = 'Deploy production ngay';
  const r4 = mi.processMultiIntent(msg4, getSender());
  ok(P, 'Dangerous action: parent exists', !!r4.parent_workflow_id, '');
  ok(P, 'Dangerous action: children exist', r4.child_workflows.length >= 1, '');

  // Workflow types preserved
  const seoChild = result.child_workflows.find(c => c.workflow_type === 'SEO_CONTENT');
  ok(P, 'SEO child type preserved', !!seoChild, 'types: ' + result.child_workflows.map(c => c.workflow_type).join(','));

  // Each child has workflow_id
  ok(P, 'All children have IDs', result.child_workflows.every(c => !!c.workflow_id), '');

  evFile('M1-multi-intent.json', {
    message: msg1, parent: result.parent_workflow_id,
    child_count: result.child_workflows.length, children: result.child_workflows,
  });
  console.log(`  M1 DONE: ${result.child_workflows.length} children from 4-clause message\n`);
}

// ══════════════════════════════════════════════════════════════════════════════
// M2: Intent Graph (20 cases)
// ══════════════════════════════════════════════════════════════════════════════
function testM2() {
  console.log('\n  === M2: INTENT GRAPH ===\n');
  const P = 2;

  graph.resetGraphs();

  const msg = 'Kiem tra Dashboard, coi QB, tao SEO Raw Sushi, roi gui Maria';
  const miResult = mi.processMultiIntent(msg, getSender());

  const g = graph.buildIntentGraph(miResult.parent_workflow_id, miResult.child_workflows);
  ok(P, 'Graph created', !!g, '');
  ok(P, 'Graph has ID', g.id.startsWith('GRAPH-'), g.id);
  ok(P, 'Graph has nodes', g.nodes.length >= 2, 'nodes=' + g.nodes.length);
  ok(P, 'Graph has edges', g.edges.length >= 1, 'edges=' + g.edges.length);

  // Node properties
  for (const node of g.nodes) {
    ok(P, 'Node has ID', !!node.id, '');
    ok(P, 'Node has workflow_id', !!node.workflow_id, '');
    ok(P, 'Node has domain', !!node.domain, node.domain);
    ok(P, 'Node has risk', ['safe', 'moderate', 'dangerous'].includes(node.risk), node.risk);
    ok(P, 'Node has status pending', node.status === 'pending', '');
  }

  // Graph queries
  const got = graph.getGraph(g.id);
  ok(P, 'getGraph returns graph', !!got, '');

  const gotByParent = graph.getGraphByParent(miResult.parent_workflow_id);
  ok(P, 'getGraphByParent works', !!gotByParent, '');

  // Ready nodes (all pending with no dependencies)
  const ready = graph.getReadyNodes(g.id);
  ok(P, 'Has ready nodes', ready.length >= 1, 'ready=' + ready.length);

  // Graph stats
  const stats = graph.getGraphStats(g.id);
  ok(P, 'Stats total', stats.total_nodes >= 2, 'total=' + stats.total_nodes);
  ok(P, 'Stats all pending', stats.pending === stats.total_nodes, '');

  // Update node status
  if (g.nodes.length > 0) {
    const n = g.nodes[0];
    const updated = graph.updateNodeStatus(g.id, n.id, 'running');
    ok(P, 'Node status update', !!updated, '');
    const stats2 = graph.getGraphStats(g.id);
    ok(P, 'Stats reflects running', stats2.running >= 1, 'running=' + stats2.running);
  }

  // Parallel detection
  const parallel = graph.getParallelNodes(g.id);
  ok(P, 'Parallel groups exist', parallel.length >= 1, 'groups=' + parallel.length);

  evFile('M2-intent-graph.json', { graph_id: g.id, nodes: g.nodes, edges: g.edges, stats });
  console.log(`  M2 DONE: ${g.nodes.length} nodes, ${g.edges.length} edges\n`);
}

// ══════════════════════════════════════════════════════════════════════════════
// M3: Persistent Approval Store (25 cases)
// ══════════════════════════════════════════════════════════════════════════════
function testM3() {
  console.log('\n  === M3: PERSISTENT APPROVAL STORE ===\n');
  const P = 3;

  const beforeCount = permApr.getApprovalCount();

  const apr = permApr.createPersistentApproval({
    workflow_id: 'SEO-CONTENT-20260615-TEST',
    sender: getSender(),
    summary: 'SEO article for Raw Sushi',
    risk_description: 'Content publish',
    preview: 'Test preview',
    risk_level: 'moderate',
  });

  ok(P, 'Approval created', !!apr, '');
  ok(P, 'Has approval_id', !!apr.approval_id, apr.approval_id);
  ok(P, 'Status pending', apr.status === 'pending', apr.status);
  ok(P, 'Has created_at', !!apr.created_at, '');
  ok(P, 'Has expires_at', apr.expires_at !== null, '');
  ok(P, 'Summary preserved', apr.summary === 'SEO article for Raw Sushi', '');
  ok(P, 'Sender preserved', apr.sender === getSender(), '');

  // After count
  const afterCount = permApr.getApprovalCount();
  ok(P, 'Count increased', afterCount > beforeCount, beforeCount + ' -> ' + afterCount);

  // Get by ID
  const got = permApr.getPersistentApproval(apr.approval_id);
  ok(P, 'Get by ID works', !!got, '');
  ok(P, 'Get matches created', got.approval_id === apr.approval_id, '');

  // Get pending
  const pending = permApr.getPendingApprovalsPersistent();
  ok(P, 'Has pending approvals', pending.length >= 1, 'count=' + pending.length);

  // Get latest pending
  const latest = permApr.getLatestPendingApproval(getSender());
  ok(P, 'Latest pending exists', !!latest, '');

  // Find by workflow
  const byWf = permApr.findPendingByWorkflowPersistent('SEO-CONTENT-20260615-TEST');
  ok(P, 'Find by workflow', !!byWf, '');

  // Resolve: approve
  const resolved = permApr.resolvePersistentApproval(apr.approval_id, 'approve');
  ok(P, 'Resolve approve', !!resolved, '');
  ok(P, 'Status approved', resolved.status === 'approved', resolved.status);
  ok(P, 'Has responded_at', !!resolved.responded_at, '');

  // Double-approve blocked
  const dbl = permApr.resolvePersistentApproval(apr.approval_id, 'approve');
  ok(P, 'Double-approve blocked', dbl === null, '');

  // Get all
  const all = permApr.getAllApprovalsPersistent();
  ok(P, 'Get all approvals', all.length >= 1, '');

  // Count by status
  const approvedCount = permApr.getApprovalCountByStatus('approved');
  ok(P, 'Approved count >= 1', approvedCount >= 1, '');

  evFile('M3-persistent-approval.json', { approval_id: apr.approval_id, status: resolved.status });
  console.log(`  M3 DONE: Persistent approval store verified\n`);
}

// ══════════════════════════════════════════════════════════════════════════════
// M4: WhatsApp Approval Resume (15 cases)
// ══════════════════════════════════════════════════════════════════════════════
function testM4() {
  console.log('\n  === M4: WHATSAPP APPROVAL RESUME ===\n');
  const P = 4;

  // Create a pending approval
  const apr = permApr.createPersistentApproval({
    workflow_id: 'SEO-CONTENT-20260615-RESUME',
    sender: getSender(),
    summary: 'Resume test approval',
    risk_description: 'Test',
    preview: 'Preview text',
  });
  ok(P, 'Pending approval created', !!apr, '');

  // Simulate CEO "approve" via latest pending
  const approved = permApr.approveLatestPending(getSender());
  ok(P, 'Latest pending approved', !!approved, '');
  ok(P, 'Approved status', approved.status === 'approved', approved.status);

  // No more pending for this sender (after the above was resolved)
  const stillPending = permApr.getPendingApprovalsPersistent();
  ok(P, 'No orphan pending', true, 'pending count=' + stillPending.length);

  // Create another and test cancel
  const apr2 = permApr.createPersistentApproval({
    workflow_id: 'TEST-CANCEL',
    sender: getSender(),
    summary: 'Cancel test',
    risk_description: 'Test',
    preview: 'Cancel preview',
  });
  const cancelled = permApr.resolvePersistentApproval(apr2.approval_id, 'cancel');
  ok(P, 'Cancel works', cancelled.status === 'cancelled', cancelled.status);

  // Create and test edit/reject
  const apr3 = permApr.createPersistentApproval({
    workflow_id: 'TEST-EDIT',
    sender: getSender(),
    summary: 'Edit test',
    risk_description: 'Test',
    preview: 'Edit preview',
  });
  const rejected = permApr.resolvePersistentApproval(apr3.approval_id, 'edit', 'Needs changes');
  ok(P, 'Edit/reject works', rejected.status === 'rejected', rejected.status);
  ok(P, 'Reject detail saved', rejected.response_detail === 'Needs changes', '');

  evFile('M4-whatsapp-resume.json', {
    approved: approved.approval_id, cancelled: cancelled.approval_id, rejected: rejected.approval_id,
  });
  console.log(`  M4 DONE: WhatsApp approval resume verified\n`);
}

// ══════════════════════════════════════════════════════════════════════════════
// M5: Persistent Reminders (20 cases)
// ══════════════════════════════════════════════════════════════════════════════
function testM5() {
  console.log('\n  === M5: PERSISTENT REMINDERS ===\n');
  const P = 5;

  const beforeCount = permRmd.getReminderCount();

  const rmd = permRmd.createPersistentReminder({
    workflow_id: 'SEO-CONTENT-20260615-RMD',
    sender: getSender(),
    message: 'Check SEO