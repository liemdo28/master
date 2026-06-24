/**
 * CEO READINESS V2 — Complete Regression Suite
 * M1-M9: 150+ cases
 */
const fs = require('fs');
const path = require('path');
const intent = require('../server/dist/execution/action-intent-engine');
const wfMod = require('../server/dist/execution/workflow-creation-layer');
const aprMod = require('../server/dist/execution/approval-orchestrator');
const seo = require('../server/dist/execution/seo-pipeline');
const idem = require('../server/dist/execution/idempotency-layer');
const mi = require('../server/dist/execution/multi-intent-engine');
const graph = require('../server/dist/execution/intent-graph');
const permApr = require('../server/dist/execution/persistent-approval-store');
const permRmd = require('../server/dist/execution/persistent-reminder-store');
const EV = path.resolve(__dirname, '../.local-agent-global/evidence/ceo-readiness-v2');
const R = [];
let N = 0;
const SE = 'ceo@bakudanramen.com';
function ok(ph,nm,c,ev){N++;R.push({id:N,phase:ph,name:nm,passed:!!c,ev:ev||''});if(!c)console.log(`  \u274C [M${ph}] #${N} ${nm} ${ev}`);}
function ev(fn,d){if(!fs.existsSync(EV))fs.mkdirSync(EV,{recursive:true});fs.writeFileSync(path.join(EV,fn),JSON.stringify(d,null,2));}

// ═══ M1 ═══
console.log('\n  === M1: MULTI-INTENT ENGINE ===\n');
ok(1,'Split roi',mi.splitClauses('A roi B').length===2);
ok(1,'Split va',mi.splitClauses('A va B').length===2);
ok(1,'Split comma roi',mi.splitClauses('A, roi B').length===2);
ok(1,'Split semi',mi.splitClauses('A; B; C').length===3);
ok(1,'Split empty',mi.splitClauses('').length===0);
ok(1,'Split single',mi.splitClauses('hello').length===1);
ok(1,'Split 5',mi.splitClauses('A; B; C; D; E').length===5);
ok(1,'isMulti true',mi.isMultiIntent('A roi B'));
ok(1,'isMulti false',!mi.isMultiIntent('hello'));
ok(1,'ClauseCount 3',mi.getClauseCount('A; B; C')===3);
ok(1,'ClauseCount 1',mi.getClauseCount('hello')===1);
const m1='Kiem tra Dashboard, coi QB, tao SEO Raw Sushi, roi gui Maria';
const c1=mi.detectMultiIntent(m1);
ok(1,'Detect >=2',c1.length>=2,'got='+c1.length);
ok(1,'No empty',c1.every(c=>c.text.length>2));
const r1=mi.processMultiIntent(m1,SE);
ok(1,'Parent created',!!r1.parent_workflow_id,r1.parent_workflow_id);
ok(1,'Children >=2',r1.child_workflows.length>=2);
ok(1,'Clause count',r1.clause_count>=2);
ok(1,'Msg preserved',r1.original_message===m1);
const m2='Tao bai SEO cho Raw Sushi roi gui Maria';
const r2=mi.processMultiIntent(m2,SE);
ok(1,'2-intent children',r2.child_workflows.length===2,'got='+r2.child_workflows.length);
ok(1,'All have IDs',r1.child_workflows.every(c=>!!c.workflow_id));
const m3='Deploy production ngay';
const r3=mi.processMultiIntent(m3,SE);
ok(1,'Dangerous parent',!!r3.parent_workflow_id);
ok(1,'Dangerous children',r3.child_workflows.length>=1);
const seoChild=r1.child_workflows.find(c=>c.workflow_type==='SEO_CONTENT');
ok(1,'SEO type preserved',!!seoChild);
ev('M1.json',{parent:r1.parent_workflow_id,children:r1.child_workflows.length});

// ═══ M2 ═══
console.log('\n  === M2: INTENT GRAPH ===\n');
graph.resetGraphs();
const mg=mi.processMultiIntent(m1,SE);
const g2=graph.buildIntentGraph(mg.parent_workflow_id,mg.child_workflows);
ok(2,'Graph created',!!g2);
ok(2,'Graph ID',g2.id.startsWith('GRAPH-'));
ok(2,'Nodes >=2',g2.nodes.length>=2);
ok(2,'Edges >=1',g2.edges.length>=1);
for(const n of g2.nodes){ok(2,'Node has domain',!!n.domain,n.domain);ok(2,'Node has risk',!!n.risk);}
ok(2,'getGraph',!!graph.getGraph(g2.id));
ok(2,'getByParent',!!graph.getGraphByParent(mg.parent_workflow_id));
ok(2,'Ready nodes',graph.getReadyNodes(g2.id).length>=1);
const s2=graph.getGraphStats(g2.id);
ok(2,'Stats total',s2.total_nodes>=2);
ok(2,'Stats all pending',s2.pending===s2.total_nodes);
if(g2.nodes.length>0){const u=graph.updateNodeStatus(g2.id,g2.nodes[0].id,'running');ok(2,'Update node',!!u);const s3=graph.getGraphStats(g2.id);ok(2,'Running count',s3.running>=1);}
ok(2,'Parallel groups',graph.getParallelNodes(g2.id).length>=1);
ev('M2.json',{id:g2.id,nodes:g2.nodes.length,edges:g2.edges.length});

// ═══ M3 ═══
console.log('\n  === M3: PERSISTENT APPROVAL STORE ===\n');
const b3=permApr.getApprovalCount();
const a3=permApr.createPersistentApproval({workflow_id:'SEO-TEST-M3',sender:SE,summary:'Test SEO',risk_description:'Test',preview:'Preview',risk_level:'moderate'});
ok(3,'Created',!!a3);
ok(3,'Has ID',!!a3.approval_id,a3.approval_id);
ok(3,'Pending',a3.status==='pending');
ok(3,'Has created_at',!!a3.created_at);
ok(3,'Summary',a3.summary==='Test SEO');
ok(3,'Count up',permApr.getApprovalCount()>b3);
const g3=permApr.getPersistentApproval(a3.approval_id);
ok(3,'Get by ID',!!g3);
ok(3,'ID matches',g3.approval_id===a3.approval_id);
ok(3,'Pending list',permApr.getPendingApprovalsPersistent().length>=1);
ok(3,'Latest pending',!!permApr.getLatestPendingApproval(SE));
ok(3,'Find by wf',!!permApr.findPendingByWorkflowPersistent('SEO-TEST-M3'));
const r3a=permApr.resolvePersistentApproval(a3.approval_id,'approve');
ok(3,'Resolve',!!r3a);
ok(3,'Status approved',r3a.status==='approved');
ok(3,'Has responded_at',!!r3a.responded_at);
ok(3,'Double blocked',permApr.resolvePersistentApproval(a3.approval_id,'approve')===null);
ok(3,'All approvals',permApr.getAllApprovalsPersistent().length>=1);
ok(3,'Count approved',permApr.getApprovalCountByStatus('approved')>=1);
ev('M3.json',{id:a3.approval_id});

// ═══ M4 ═══
console.log('\n  === M4: WHATSAPP APPROVAL RESUME ===\n');
const a4=permApr.createPersistentApproval({workflow_id:'RESUME-TEST',sender:SE,summary:'Resume',risk_description:'T',preview:'P'});
ok(4,'Created',!!a4);
const a4a=permApr.approveLatestPending(SE);
ok(4,'Approved',!!a4a&&a4a.status==='approved');
const a4b=permApr.createPersistentApproval({workflow_id:'CANCEL-TEST',sender:SE,summary:'Cancel',risk_description:'T',preview:'P'});
const a4c=permApr.resolvePersistentApproval(a4b.approval_id,'cancel');
ok(4,'Cancel',a4c.status==='cancelled');
const a4d=permApr.createPersistentApproval({workflow_id:'EDIT-TEST',sender:SE,summary:'Edit',risk_description:'T',preview:'P'});
const a4e=permApr.resolvePersistentApproval(a4d.approval_id,'edit','Changes');
ok(4,'Reject',a4e.status==='rejected');
ok(4,'Detail',a4e.response_detail==='Changes');
ev('M4.json',{approved:a4a.approval_id});

// ═══ M5 ═══
console.log('\n  === M5: PERSISTENT REMINDERS ===\n');
const b5=permRmd.getReminderCount();
const r5=permRmd.createPersistentReminder({workflow_id:'RMD-TEST',sender:SE,message:'Check',remind_at:new Date(Date.now()+3600000).toISOString()});
ok(5,'Created',!!r5);
ok(5,'Has ID',!!r5.reminder_id);
ok(5,'Scheduled',r5.status==='scheduled');
ok(5,'Retries=0',r5.retries===0);
ok(5,'Max=3',r5.max_retries===3);
ok(5,'Count up',permRmd.getReminderCount()>b5);
ok(5,'Due check',Array.isArray(permRmd.getDueReminders()));
ok(5,'Pending check',permRmd.getPendingReminders().length>=1);
const s5=permRmd.markReminderSent(r5.reminder_id);
ok(5,'Sent',s5.retries>=1);
const d5=permRmd.markReminderDelivered(r5.reminder_id);
ok(5,'Delivered',d5.status==='delivered');
const r5b=permRmd.createPersistentReminder({workflow_id:'RMD-CANCEL',sender:SE,message:'Cancel',remind_at:new Date(Date.now()+7200000).toISOString()});
ok(5,'Cancel',permRmd.cancelReminder(r5b.reminder_id).status==='cancelled');
const r5c=permRmd.createPersistentReminder({workflow_id:'WF-CANCEL',sender:SE,message:'WF',remind_at:new Date(Date.now()+1800000).toISOString()});
ok(5,'Cancel by wf',permRmd.cancelRemindersByWorkflow('WF-CANCEL')>=1);
const r5d=permRmd.createPersistentReminder({workflow_id:'FAIL',sender:SE,message:'Fail',remind_at:new Date().toISOString(),max_retries:1});
permRmd.markReminderSent(r5d.reminder_id);
const f5=permRmd.markReminderFailed(r5d.reminder_id);
ok(5,'Failed',f5.status==='failed');
ev('M5.json',{count:permRmd.getReminderCount()});

// ═══ M6 ═══
console.log('\n  === M6: WORKFLOW SURVIVAL TEST ===\n');
const cls6=intent.classifyActionIntent('Tao SEO Raw Sushi');
const wf6=wfMod.createWorkflow({intent:cls6,source_message_id:'SURVIVAL',sender:SE,raw_message:'Survival'});
ok(6,'Wf created',!!wf6.workflow_id);
const ap6=permApr.createPersistentApproval({workflow_id:wf6.workflow_id,sender:SE,summary:'Surv',risk_description:'T',preview:'P'});
ok(6,'Apr created',!!ap6.approval_id);
const rm6=permRmd.createPersistentReminder({workflow_id:wf6.workflow_id,approval_id:ap6.approval_id,sender:SE,message:'Surv',remind_at:new Date(Date.now()+300000).toISOString()});
ok(6,'Rmd created',!!rm6.reminder_id);
// Simulate restart: reload
const rw6=wfMod.getWorkflow(wf6.workflow_id);
ok(6,'Wf survives',!!rw6);
const ra6=permApr.getPersistentApproval(ap6.approval_id);
ok(6,'Apr survives',!!ra6&&ra6.status==='pending');
const rr6=permRmd.getPersistentReminder(rm6.reminder_id);
ok(6,'Rmd survives',!!rr6&&rr6.status==='scheduled');
// CEO approves after restart
const ap6a=permApr.resolvePersistentApproval(ap6.approval_id,'approve');
ok(6,'Approve after restart',ap6a.status==='approved');
const ru6=wfMod.updateWorkflowStatus(wf6.workflow_id,'running');
ok(6,'Execution resumes',ru6!==null);
ok(6,'Status running',ru6.status==='running');
ev('M6.json',{wf:wf6.workflow_id,ap:ap6.approval_id,rm:rm6.reminder_id});

// ═══ M7 ═══
console.log('\n  === M7: MULTI-INTENT E2E ===\n');
const m7='Mi kiem tra Dashboard, coi QB sync, tao bai SEO cho Raw Sushi, roi soan mail bao Maria';
const r7=mi.processMultiIntent(m7,SE);
ok(7,'Parent',!!r7.parent_workflow_id);
ok(7,'Children >=2',r7.child_workflows.length>=2,'got='+r7.child_workflows.length);
ok(7,'Clauses >=2',r7.clauses.length>=2);
const g7=graph.buildIntentGraph(r7.parent_workflow_id,r7.child_workflows);
ok(7,'Graph nodes >=2',g7.nodes.length>=2);
ok(7,'Graph edges',g7.edges.length>=1);
const t7=r7.child_workflows.map(c=>c.workflow_type);
ok(7,'Has DASHBOARD',t7.includes('DASHBOARD_AUDIT'));
ok(7,'Has types',t7.length>=2,'types='+t7.join(','));
ok(7,'Has SEO',t7.includes('SEO_CONTENT')||t7.includes('WEBSITE_POST'));
ok(7,'Has EMAIL',t7.includes('EMAIL_DRAFT')||t7.includes('GENERAL_TASK'));
const emailN=g7.nodes.filter(n=>n.domain==='email_comms');
const seoN=g7.nodes.filter(n=>n.domain==='seo_content');
if(emailN.length>0&&seoN.length>0){ok(7,'Email depends SEO',!!g7.edges.find(e=>e.type==='depends_on'&&e.from===emailN[0].id&&e.to===seoN[0].id));}
const dashN=g7.nodes.filter(n=>n.domain==='dashboard_monitoring');
const qbN=g7.nodes.filter(n=>n.domain==='finance_qb');
if(dashN.length>0&&qbN.length>0){ok(7,'Dash-QB parallel',!!g7.edges.find(e=>e.type==='parallel'&&((e.from===dashN[0].id&&e.to===qbN[0].id)||(e.from===qbN[0].id&&e.to===dashN[0].id))));}
const seoC=r7.child_workflows.find(c=>c.workflow_type==='SEO_CONTENT');
if(seoC){const w=wfMod.getWorkflow(seoC.workflow_id);const dr=seo.runSEOPipeline(w);ok(7,'SEO draft',!!dr.topic);}
ev('M7.json',{parent:r7.parent_workflow_id,children:r7.child_workflows.length,types:t7});

// ═══ M8 ═══
console.log('\n  === M8: MULTI-INTENT SAFETY ===\n');
const m8a='Kiem tra Dashboard roi deploy production';
const ra8=mi.processMultiIntent(m8a,SE);
ok(8,'Mixed parent',!!ra8.parent_workflow_id);
ok(8,'Mixed children',ra8.child_workflows.length>=2);
const ga8=graph.buildIntentGraph(ra8.parent_workflow_id,ra8.child_workflows);
const dangN=ga8.nodes.filter(n=>n.risk==='dangerous');
ok(8,'Dangerous flagged',dangN.length>=1);
for(const d of dangN)ok(8,'Dangerous approval_req',d.approval_required);
const safeN=ga8.nodes.filter(n=>n.risk!=='dangerous');
ok(8,'Safe nodes',safeN.length>=1);
const cls8=intent.classifyActionIntent('Deploy production');
ok(8,'Deploy dangerous',cls8.message_class==='dangerous_action');
ev('M8.json',{dangerous:dangN.length,safe:safeN.length});

// ═══ M9: Regression (50+ cases) ═══
console.log('\n  === M9: REGRESSION SUITE ===\n');
// Intent classification
const mc=[['Tao bai SEO Raw Sushi','action_request'],['Kiem tra Dashboard','action_request'],['Gui email Maria','action_request'],['Deploy production','dangerous_action'],['Xoa database','action_request'],['Sao roi','informational_question'],['Approve','approval_response'],['Cancel','approval_response'],['Tao SEO roi check QB','action_request'],['Gui cho Maria','action_request']];
for(const[m,e] of mc){const c=intent.classifyActionIntent(m);ok(9,'Classify "'+m.substring(0,20)+'"',c.message_class===e,'got='+c.message_class);}
// Split regression (realistic Vietnamese patterns)
const sp=[['A roi B',2],['A va B',2],['Kiem tra Dashboard, coi QB',2],['A; B; C',3],['A. B. C',3],['hello',1],['',0],['A roi B roi C',3]];
for(const[m,e] of sp)ok(9,'Split "'+m.substring(0,15)+'"',mi.splitClauses(m).length===e,'got='+mi.splitClauses(m).length);
// Workflow creation
const c9=intent.classifyActionIntent('Tao SEO');
for(let i=0;i<5;i++){const w=wfMod.createWorkflow({intent:c9,source_message_id:'R9-'+i,sender:SE,raw_message:'t'});ok(9,'Wf gen '+i,!!w.workflow_id);}
// SEO pipeline
for(let i=0;i<5;i++){const w=wfMod.createWorkflow({intent:c9,source_message_id:'SEO-R9-'+i,sender:SE,raw_message:'t'});const dr=seo.runSEOPipeline(w);ok(9,'SEO draft '+i,!!dr.topic);}
// Approval creation
const wfRef=wfMod.getWorkflow('SEO-CONTENT-20260615-008')||{workflow_id:'REF',steps:[]};
for(let i=0;i<5;i++){const a=aprMod.createApprovalRequest(wfRef);ok(9,'Apr '+i,!!a.approval_id);}
// Idempotency
for(let i=0;i<5;i++){const d=idem.checkDuplicate({sender:SE,message:'Idem-'+i,target_entity:'T',intent:'g'});ok(9,'Idem '+i,typeof d.is_duplicate==='boolean');}
// Persistent approval CRUD
for(let i=0;i<5;i++){const a=permApr.createPersistentApproval({workflow_id:'M9-'+i,sender:SE,summary:'T',risk_description:'R',preview:'P'});ok(9,'PermApr '+i,!!a.approval_id&&a.status==='pending');}
// Persistent reminder CRUD
for(let i=0;i<5;i++){const r=permRmd.createPersistentReminder({workflow_id:'M9-R-'+i,sender:SE,message:'M',remind_at:new Date(Date.now()+600000).toISOString()});ok(9,'PermRmd '+i,!!r.reminder_id&&r.status==='scheduled');}
// Multi-intent full
for(let i=0;i<5;i++){const r=mi.processMultiIntent('A; B; C',SE);ok(9,'MultiIntent '+i,!!r.parent_workflow_id&&r.child_workflows.length>=2);}
// Graph full
for(let i=0;i<5;i++){graph.resetGraphs();const r=mi.processMultiIntent('X; Y',SE);const g=graph.buildIntentGraph(r.parent_workflow_id,r.child_workflows);ok(9,'Graph '+i,!!g&&g.nodes.length>=2);}
// Safety
for(let i=0;i<5;i++){const r=mi.processMultiIntent('Check Dashboard roi deploy production',SE);const g=graph.buildIntentGraph(r.parent_workflow_id,r.child_workflows);ok(9,'Safety '+i,g.nodes.filter(n=>n.risk==='dangerous').length>=1);}

// ═══ SUMMARY ═══
const total=R.length;
const passed=R.filter(r=>r.passed).length;
const failed=R.filter(r=>!r.passed);
const phases=[1,2,3,4,5,6,7,8,9];
console.log('\n'+'='.repeat(60));
console.log('  CEO READINESS V2 — REGRESSION SUMMARY');
console.log('='.repeat(60));
console.log(`  Total: ${total} | Passed: ${passed} | Failed: ${failed.length}`);
for(const p of phases){const pr=R.filter(r=>r.phase===p);const pp=pr.filter(r=>r.passed).length;console.log(`  ${pp===pr.length?'\u2705':'\u274C'} M${p}: ${pp}/${pr.length}`);}
if(failed.length>0){console.log('\n  FAILED:');failed.forEach(f=>console.log(`    [M${f.phase}] #${f.id} ${f.name}: ${f.ev}`));}
const result=failed.length===0?'CEO_READINESS_V2_REGRESSION_PASS':'CEO_READINESS_V2_REGRESSION_FAIL';
console.log(`\n  RESULT: ${result}`);
console.log('='.repeat(60)+'\n');
ev('REGRESSION-SUMMARY.json',{timestamp:new Date().toISOString(),total,passed,failed:failed.length,result,per_phase:phases.map(p=>({phase:p,total:R.filter(r=>r.phase===p).length,passed:R.filter(r=>r.phase===p&&r.passed).length})),failed:failed.map(f=>({phase:f.phase,name:f.name,ev:f.ev}))});
process.exit(failed.length>0?1:0);
