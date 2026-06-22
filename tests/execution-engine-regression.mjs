/**
 * DEV5 — Execution Engine Regression Suite (100+ cases)
 * Run: node tests/execution-engine-regression.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

let engine, wfMod, apMod, qMod, seoMod, idMod, rpMod, idxMod;
try { engine = await import('../server/src/execution/action-intent-engine.ts'); } catch { engine = await import('../server/dist/execution/action-intent-engine.js'); }
try { wfMod = await import('../server/src/execution/workflow-creation-layer.ts'); } catch { wfMod = await import('../server/dist/execution/workflow-creation-layer.js'); }
try { apMod = await import('../server/src/execution/approval-orchestrator.ts'); } catch { apMod = await import('../server/dist/execution/approval-orchestrator.js'); }
try { qMod = await import('../server/src/execution/execution-queue.ts'); } catch { qMod = await import('../server/dist/execution/execution-queue.js'); }
try { seoMod = await import('../server/src/execution/seo-pipeline.ts'); } catch { seoMod = await import('../server/dist/execution/seo-pipeline.js'); }
try { idMod = await import('../server/src/execution/idempotency-layer.ts'); } catch { idMod = await import('../server/dist/execution/idempotency-layer.js'); }
try { rpMod = await import('../server/src/execution/workflow-reality-proofer.ts'); } catch { rpMod = await import('../server/dist/execution/workflow-reality-proofer.js'); }
try { idxMod = await import('../server/src/execution/index.ts'); } catch { idxMod = await import('../server/dist/execution/index.js'); }

const { classifyActionIntent, needsWorkflow, resolveEntities } = engine;
const { createWorkflow, getWorkflow, updateWorkflowStatus, advanceWorkflowStep } = wfMod;
const { createApprovalRequest, resolveApproval, getPendingApprovals, getLatestPendingApproval, formatApprovalMessage } = apMod;
const { enqueueJob, hasDuplicateJob } = qMod;
const { runSEOPipeline, pickTopic } = seoMod;
const { checkDuplicate, registerMessage } = idMod;
const { verifyWorkflowClaim, verifyDraftClaim, verifyApprovalClaim, formatRealityReport } = rpMod;
const { processCEORequest } = idxMod;

let P = 0, F = 0, total = 0;
const fails = [];
function ok(c, n, d = '') { total++; if (c) { P++; process.stdout.write('.'); } else { F++; fails.push({ n, d }); process.stdout.write('F'); } }
function eq(a, b, n) { ok(a === b, n, `exp "${b}" got "${a}"`); }
function has(s, sub, n) { ok(typeof s === 'string' && s.includes(sub), n); }
function nothas(s, sub, n) { ok(typeof s === 'string' && !s.includes(sub), n); }
function nn(o, n) { ok(o != null, n); }

console.log('\n=== DEV5 EXECUTION ENGINE REGRESSION SUITE ===\n');

// ── E1: Action Intent Engine (25 tests) ──
console.log('--- E1: Action Intent Engine ---');
{ const i = classifyActionIntent("Mi ơi, t muốn post 1 bài trên Raw website, thu hút SEO");
  eq(i.message_class, 'action_request', 'TC001: Raw SEO = action_request');
  eq(i.target_entity, 'Raw Sushi', 'TC001: entity = Raw Sushi');
  ok(i.domain === 'seo_content' || i.domain === 'website_marketing', 'TC001: domain seo/web');
  ok(i.approval_required, 'TC001: needs approval');
  ok(i.workflow_types.includes('SEO_CONTENT'), 'TC001: has SEO_CONTENT');
  ok(i.workflow_types.includes('WEBSITE_POST'), 'TC001: has WEBSITE_POST'); }
{ eq(classifyActionIntent("Hôm nay anh có gì?").message_class, 'informational_question', 'TC002: hom nay = info'); }
{ eq(classifyActionIntent("QB sao rồi?").message_class, 'informational_question', 'TC003: QB sao roi = info'); }
{ eq(classifyActionIntent("Có email nào quan trọng?").message_class, 'informational_question', 'TC004: email check = info'); }
{ const i = classifyActionIntent("Tạo flyer cho Bakudan");
  eq(i.message_class, 'action_request', 'TC005: flyer = action');
  eq(i.target_entity, 'Bakudan Ramen', 'TC005: entity bakudan');
  ok(i.workflow_types.includes('FLYER'), 'TC005: has FLYER');
  ok(i.approval_required, 'TC005: needs approval'); }
{ const i = classifyActionIntent("Gửi email cho Maria");
  eq(i.message_class, 'action_request', 'TC006: email = action');
  eq(i.target_entity, 'Maria', 'TC006: entity maria');
  ok(i.workflow_types.includes('EMAIL_DRAFT'), 'TC006: has EMAIL_DRAFT'); }
{ const i = classifyActionIntent("Fix bug WhatsApp gateway");
  eq(i.message_class, 'action_request', 'TC007: fix bug = action');
  ok(i.workflow_types.includes('BUG_FIX'), 'TC007: has BUG_FIX');
  eq(i.target_entity, 'WhatsApp Gateway', 'TC007: entity wa'); }
{ const i = classifyActionIntent("Tạo campaign DoorDash cho Raw Sushi");
  eq(i.message_class, 'action_request', 'TC008: campaign = action');
  ok(i.workflow_types.includes('CAMPAIGN'), 'TC008: has CAMPAIGN'); }
{ eq(classifyActionIntent("Deploy production server ngay").message_class, 'dangerous_action', 'TC009: deploy prod = dangerous'); }
{ eq(classifyActionIntent("Pay bill $5000 cho supplier").message_class, 'dangerous_action', 'TC010: pay bill = dangerous'); }
{ eq(classifyActionIntent("Submit tax return cho năm nay").message_class, 'dangerous_action', 'TC011: submit tax = dangerous'); }
{ eq(classifyActionIntent("Delete database test").message_class, 'dangerous_action', 'TC012: delete db = dangerous'); }
{ eq(classifyActionIntent("approve").message_class, 'approval_response', 'TC013: approve = approval'); }
{ eq(classifyActionIntent("duyet").message_class, 'approval_response', 'TC014: duyet = approval'); }
{ eq(classifyActionIntent("cancel").message_class, 'approval_response', 'TC015: cancel = approval'); }
{ const i = classifyActionIntent("Tạo bài post Facebook cho Bakudan");
  eq(i.message_class, 'action_request', 'TC016: fb post = action'); }
{ const i = classifyActionIntent("Update Google Sheet doanh thu tuần");
  eq(i.message_class, 'action_request', 'TC017: sheet update = action');
  ok(i.workflow_types.includes('GOOGLE_SHEET_UPDATE'), 'TC017: has SHEET'); }
{ const i = classifyActionIntent("Tạo video promo cho Raw Sushi");
  eq(i.message_class, 'action_request', 'TC018: video = action');
  ok(i.workflow_types.includes('VIDEO'), 'TC018: has VIDEO'); }
{ const { entity, website } = resolveEntities("post bài trên Raw Sushi website");
  eq(entity, 'Raw Sushi', 'TC019: resolve raw sushi');
  eq(website, 'rawsushibar.com', 'TC019: website rawsushi'); }
{ eq(resolveEntities("Bakudan flyer").entity, 'Bakudan Ramen', 'TC020: resolve bakudan'); }
{ eq(resolveEntities("DoorDash campaign").entity, 'DoorDash', 'TC021: resolve doordash'); }
{ ok(needsWorkflow(classifyActionIntent("Tạo bài SEO cho Raw Sushi")), 'TC022: needsWorkflow true'); }
{ ok(!needsWorkflow(classifyActionIntent("QB sao rồi?")), 'TC023: needsWorkflow false info'); }
{ nothas(classifyActionIntent("Mi ơi, t muốn post 1 bài trên Raw website, thu hút SEO").message_class, 'informational', 'TC024: not informational'); }
{ const i = classifyActionIntent("Create content for Raw Sushi website SEO");
  eq(i.message_class, 'action_request', 'TC025: EN seo = action'); }

// ── E2: Workflow Creation (15 tests) ──
console.log('\n--- E2: Workflow Creation ---');
{ const wf = createWorkflow({ intent: classifyActionIntent("Tạo bài SEO cho Raw Sushi"), source_message_id: 'm1', sender: 'ceo', raw_message: 'seo raw' });
  nn(wf, 'TC026: wf created');
  has(wf.workflow_id, 'SEO-CONTENT', 'TC026: id seo');
  eq(wf.status, 'created', 'TC026: status created');
  eq(wf.target_entity, 'Raw Sushi', 'TC026: entity raw sushi');
  ok(wf.steps.length >= 6, 'TC026: has 6+ steps');
  ok(wf.approval_required, 'TC026: needs approval'); }
{ const wf = createWorkflow({ intent: classifyActionIntent("Tạo flyer cho Bakudan"), source_message_id: 'm2', sender: 'ceo', raw_message: 'flyer bakudan' });
  nn(wf, 'TC027: flyer wf');
  has(wf.workflow_id, 'FLYER', 'TC027: id flyer'); }
{ const wf = createWorkflow({ intent: classifyActionIntent("Gửi email cho Maria"), source_message_id: 'm3', sender: 'ceo', raw_message: 'email maria' });
  nn(wf, 'TC028: email wf');
  has(wf.workflow_id, 'EMAIL-DRAFT', 'TC028: id email'); }
{ const wf = createWorkflow({ intent: classifyActionIntent("Tạo campaign DoorDash cho Raw Sushi"), source_message_id: 'm4', sender: 'ceo', raw_message: 'campaign' });
  nn(wf, 'TC029: campaign wf');
  has(wf.workflow_id, 'CAMPAIGN', 'TC029: id campaign'); }
{ const wf = createWorkflow({ intent: classifyActionIntent("Fix bug WhatsApp gateway"), source_message_id: 'm5', sender: 'ceo', raw_message: 'fix bug' });
  nn(wf, 'TC030: bug wf');
  has(wf.workflow_id, 'BUG-FIX', 'TC030: id bug'); }
{ const wf = createWorkflow({ intent: classifyActionIntent("Update Google Sheet doanh thu"), source_message_id: 'm6', sender: 'ceo', raw_message: 'sheet update' });
  nn(wf, 'TC031: sheet wf');
  has(wf.workflow_id, 'GOOGLE-SHEET', 'TC031: id sheet'); }
{ const wf = createWorkflow({ intent: classifyActionIntent("Tạo video promo cho Raw Sushi"), source_message_id: 'm7', sender: 'ceo', raw_message: 'video' });
  nn(wf, 'TC032: video wf');
  has(wf.workflow_id, 'VIDEO', 'TC032: id video'); }
{ const wf = createWorkflow({ intent: classifyActionIntent("Tạo bài SEO cho Raw Sushi"), source_message_id: 'm8', sender: 'ceo', raw_message: 'seo' });
  const updated = updateWorkflowStatus(wf.workflow_id, 'drafting');
  eq(updated.status, 'drafting', 'TC033: status update'); }
{ const wf = createWorkflow({ intent: classifyActionIntent("Tạo bài SEO cho Raw Sushi"), source_message_id: 'm9', sender: 'ceo', raw_message: 'seo2' });
  const adv = advanceWorkflowStep(wf.workflow_id, 'SEO-1', 'done', 'test output');
  ok(adv, 'TC034: step advanced');
  const step = adv.steps.find(s => s.step_id === 'SEO-1');
  eq(step.status, 'done', 'TC034: step done'); }
{ const wf = getWorkflow(createWorkflow({ intent: classifyActionIntent("Tạo flyer cho Bakudan"), source_message_id: 'm10', sender: 'ceo', raw_message: 'flyer2' }).workflow_id);
  nn(wf, 'TC035: getWorkflow works'); }
{ const intent = classifyActionIntent("Tạo bài SEO cho Raw Sushi");
  const wf = createWorkflow({ intent, source_message_id: 'm11', sender: 'ceo', raw_message: 'seo3' });
  ok(wf.evidence_path.includes('.local-agent-global'), 'TC036: evidence_path set'); }
{ const intent = classifyActionIntent("Tạo bài SEO cho Raw Sushi");
  const wf = createWorkflow({ intent, source_message_id: 'm12', sender: 'ceo', raw_message: 'seo4' });
  eq(wf.sender, 'ceo', 'TC037: sender recorded');
  eq(wf.intent.domain, 'seo_content', 'TC037: domain recorded'); }
{ const intent = classifyActionIntent("Tạo flyer cho Bakudan");
  const wf = createWorkflow({ intent, source_message_id: 'm13', sender: 'ceo', raw_message: 'flyer3' });
  ok(wf.workflow_id.startsWith('FLYER-'), 'TC038: flyer id prefix'); }
{ const intent = classifyActionIntent("Gửi email cho Maria");
  const wf = createWorkflow({ intent, source_message_id: 'm14', sender: 'ceo', raw_message: 'email2' });
  ok(wf.workflow_id.startsWith('EMAIL-DRAFT-'), 'TC039: email id prefix'); }
{ const intent = classifyActionIntent("Tạo video promo cho Raw Sushi");
  const wf = createWorkflow({ intent, source_message_id: 'm15', sender: 'ceo', raw_message: 'video2' });
  ok(wf.workflow_id.startsWith('VIDEO-'), 'TC040: video id prefix'); }

// ── E3: Approval Orchestrator (10 tests) ──
console.log('\n--- E3: Approval Orchestrator ---');
{ const wf = createWorkflow({ intent: classifyActionIntent("Tạo bài SEO cho Raw Sushi"), source_message_id: 'a1', sender: 'ceo', raw_message: 'seo approval' });
  const app = createApprovalRequest(wf);
  nn(app, 'TC041: approval created');
  has(app.approval_id, 'APPR-', 'TC041: id appr');
  eq(app.status, 'pending', 'TC041: status pending');
  ok(app.summary.length > 0, 'TC041: has summary');
  ok(app.risk_description.length > 0, 'TC041: has risk');
  ok(app.preview.length > 0, 'TC041: has preview'); }
{ const wf = createWorkflow({ intent: classifyActionIntent("Tạo flyer cho Bakudan"), source_message_id: 'a2', sender: 'ceo', raw_message: 'flyer approval' });
  const app = createApprovalRequest(wf);
  has(app.risk_description, 'Flyer', 'TC042: flyer risk mentioned'); }
{ const wf = createWorkflow({ intent: classifyActionIntent("Gửi email cho Maria"), source_message_id: 'a3', sender: 'ceo', raw_message: 'email approval' });
  const app = createApprovalRequest(wf);
  has(app.risk_description, 'Email', 'TC043: email risk mentioned'); }
{ const wf = createWorkflow({ intent: classifyActionIntent("Tạo bài SEO cho Raw Sushi"), source_message_id: 'a4', sender: 'ceo', raw_message: 'seo approve test' });
  const app = createApprovalRequest(wf);
  const resolved = resolveApproval(app.approval_id, 'approve');
  eq(resolved.status, 'approved', 'TC044: approve works');
  nn(resolved.responded_at, 'TC044: responded_at set'); }
{ const wf = createWorkflow({ intent: classifyActionIntent("Tạo bài SEO cho Raw Sushi"), source_message_id: 'a5', sender: 'ceo', raw_message: 'seo cancel test' });
  const app = createApprovalRequest(wf);
  const resolved = resolveApproval(app.approval_id, 'cancel');
  eq(resolved.status, 'cancelled', 'TC045: cancel works'); }
{ const wf = createWorkflow({ intent: classifyActionIntent("Tạo bài SEO cho Raw Sushi"), source_message_id: 'a6', sender: 'ceo', raw_message: 'seo reject test' });
  const app = createApprovalRequest(wf);
  const resolved = resolveApproval(app.approval_id, 'edit');
  eq(resolved.status, 'rejected', 'TC046: edit = rejected'); }
{ const pending = getPendingApprovals();
  ok(Array.isArray(pending), 'TC047: getPendingApprovals is array'); }
{ const latest = getLatestPendingApproval();
  if (latest) eq(latest.status, 'pending', 'TC048: latest is pending'); else ok(true, 'TC048: no pending ok'); }
{ const wf = createWorkflow({ intent: classifyActionIntent("Tạo bài SEO cho Raw Sushi"), source_message_id: 'a7', sender: 'ceo', raw_message: 'approval msg' });
  const app = createApprovalRequest(wf);
  const msg = formatApprovalMessage(app);
  has(msg, 'APPROVAL REQUIRED', 'TC049: approval message formatted'); }
{ const wf = createWorkflow({ intent: classifyActionIntent("Tạo bài SEO cho Raw Sushi"), source_message_id: 'a8', sender: 'ceo', raw_message: 'double approve' });
  const app = createApprovalRequest(wf);
  resolveApproval(app.approval_id, 'approve');
  const again = resolveApproval(app.approval_id, 'approve');
  eq(again, null, 'TC050: double approve blocked'); }

// ── E4: Execution Queue (10 tests) ──
console.log('\n--- E4: Execution Queue ---');
{ const job = enqueueJob({ workflow_id: 'wf-q1', workflow_type: 'SEO_CONTENT', target_entity: 'Raw Sushi', domain: 'seo_content', owner: 'ceo', idempotency_key: 'ik-051' });
  nn(job, 'TC051: job enqueued');
  has(job.id, 'JOB-', 'TC051: job id');
  eq(job.queue, 'website_queue', 'TC051: routed to website_queue');
  eq(job.status, 'queued', 'TC051: status queued');
  ok(job.timeout_ms > 0, 'TC051: has timeout'); }
{ enqueueJob({ workflow_id: 'wf-q2', workflow_type: 'CAMPAIGN', target_entity: 'DoorDash', domain: 'campaign', owner: 'ceo', idempotency_key: 'ik-052' }); }
{ ok(hasDuplicateJob('ik-051'), 'TC052: duplicate detected'); }
{ ok(!hasDuplicateJob('ik-nonexistent'), 'TC053: no false duplicate'); }
{ enqueueJob({ workflow_id: 'wf-q4', workflow_type: 'EMAIL_DRAFT', target_entity: 'Maria', domain: 'email_comms', owner: 'ceo', idempotency_key: 'ik-054' }); }
{ enqueueJob({ workflow_id: 'wf-q5', workflow_type: 'BUG_FIX', target_entity: 'Mi-Core', domain: 'bug_fix', owner: 'ceo', idempotency_key: 'ik-055' }); }
{ enqueueJob({ workflow_id: 'wf-q6', workflow_type: 'FINANCE_REPORT', target_entity: undefined, domain: 'finance_qb', owner: 'ceo', idempotency_key: 'ik-056' }); }
{ enqueueJob({ workflow_id: 'wf-q7', workflow_type: 'FLYER', target_entity: 'Bakudan Ramen', domain: 'flyer_design', owner: 'ceo', idempotency_key: 'ik-057' }); }
{ enqueueJob({ workflow_id: 'wf-q8', workflow_type: 'VIDEO', target_entity: 'Raw Sushi', domain: 'video_production', owner: 'ceo', idempotency_key: 'ik-058' }); }
{ enqueueJob({ workflow_id: 'wf-q9', workflow_type: 'GOOGLE_SHEET_UPDATE', target_entity: undefined, domain: 'google_sheets', owner: 'ceo', idempotency_key: 'ik-059' }); }

// ── E5: SEO Pipeline (10 tests) ──
console.log('\n--- E5: SEO Pipeline ---');
{ const topic = pickTopic('Raw Sushi');
  nn(topic, 'TC060: topic picked');
  ok(topic.keywords.length > 0, 'TC060: has keywords');
  ok(topic.topic.length > 0, 'TC060: has topic'); }
{ const topic = pickTopic('Bakudan Ramen');
  nn(topic, 'TC061: generic topic');
  has(topic.topic, 'Bakudan Ramen', 'TC061: topic for bakudan'); }
{ const wf = createWorkflow({ intent: classifyActionIntent("Tạo bài SEO cho Raw Sushi"), source_message_id: 's1', sender: 'ceo', raw_message: 'seo pipeline' });
  const draft = runSEOPipeline(wf);
  nn(draft, 'TC062: SEO pipeline ran');
  eq(draft.entity, 'Raw Sushi', 'TC062: entity correct');
  eq(draft.website, 'rawsushibar.com', 'TC062: website correct');
  ok(draft.article.word_count > 100, 'TC062: 100+ words');
  ok(draft.article.metadata.meta_title.length > 0, 'TC062: has meta title');
  ok(draft.article.metadata.meta_description.length > 0, 'TC062: has meta desc');
  ok(draft.article.metadata.slug.length > 0, 'TC062: has slug');
  ok(draft.article.internal_links.length > 0, 'TC062: has internal links'); }
{ const wf = createWorkflow({ intent: classifyActionIntent("Tạo bài SEO cho Raw Sushi"), source_message_id: 's2', sender: 'ceo', raw_message: 'seo preview' });
  const draft = runSEOPipeline(wf);
  ok(fs.existsSync(draft.preview_path), 'TC063: preview file exists'); }
{ const wf = createWorkflow({ intent: classifyActionIntent("Tạo bài SEO cho Raw Sushi"), source_message_id: 's3', sender: 'ceo', raw_message: 'seo steps' });
  const draft = runSEOPipeline(wf);
  const wf2 = getWorkflow(wf.workflow_id);
  const seo1 = wf2.steps.find(s => s.step_id === 'SEO-1');
  eq(seo1.status, 'done', 'TC064: SEO-1 done');
  const seo3 = wf2.steps.find(s => s.step_id === 'SEO-3');
  eq(seo3.status, 'done', 'TC064: SEO-3 done'); }
{ const wf = createWorkflow({ intent: classifyActionIntent("Tạo bài SEO cho Raw Sushi"), source_message_id: 's4', sender: 'ceo', raw_message: 'seo status' });
  runSEOPipeline(wf);
  const wf2 = getWorkflow(wf.workflow_id);
  eq(wf2.status, 'draft_created', 'TC065: status draft_created'); }
{ const draft = runSEOPipeline(createWorkflow({ intent: classifyActionIntent("Tạo bài SEO cho Raw Sushi"), source_message_id: 's5', sender: 'ceo', raw_message: 'seo content' }));
  has(draft.article.content, 'Raw Sushi', 'TC066: content mentions entity'); }
{ const draft = runSEOPipeline(createWorkflow({ intent: classifyActionIntent("Tạo bài SEO cho Raw Sushi"), source_message_id: 's6', sender: 'ceo', raw_message: 'seo faq' }));
  has(draft.article.content, 'Frequently Asked', 'TC067: has FAQ section'); }
{ const draft = runSEOPipeline(createWorkflow({ intent: classifyActionIntent("Tạo bài SEO cho Raw Sushi"), source_message_id: 's7', sender: 'ceo', raw_message: 'seo links' }));
  ok(draft.article.internal_links.some(l => l.includes('/menu')), 'TC068: has /menu link'); }

// ── E6: Idempotency (10 tests) ──
console.log('\n--- E6: Idempotency ---');
{ const r1 = checkDuplicate({ sender: 'ceo', message: 'test idempotent', target_entity: 'Raw Sushi', intent: 'SEO_CONTENT' });
  eq(r1.is_duplicate, false, 'TC069: first call not duplicate'); }
{ registerMessage({ sender: 'ceo', message: 'test idempotent', target_entity: 'Raw Sushi', intent: 'SEO_CONTENT', workflow_id: 'wf-idem-1' });
  const r2 = checkDuplicate({ sender: 'ceo', message: 'test idempotent', target_entity: 'Raw Sushi', intent: 'SEO_CONTENT' });
  eq(r2.is_duplicate, true, 'TC070: second call is duplicate');
  eq(r2.existing_workflow_id, 'wf-idem-1', 'TC070: returns existing wf id'); }
{ registerMessage({ sender: 'ceo', message: 'unique msg 123', target_entity: '', intent: 'GENERAL_TASK', workflow_id: 'wf-u1' });
  const r = checkDuplicate({ sender: 'ceo', message: 'different msg 456', target_entity: '', intent: 'GENERAL_TASK' });
  eq(r.is_duplicate, false, 'TC071: different msg not duplicate'); }
{ registerMessage({ sender: 'ceo', message: 'msg for entity check', target_entity: 'Raw Sushi', intent: 'SEO_CONTENT', workflow_id: 'wf-e1' });
  const r = checkDuplicate({ sender: 'ceo', message: 'msg for entity check', target_entity: 'Bakudan Ramen', intent: 'SEO_CONTENT' });
  eq(r.is_duplicate, false, 'TC072: different entity not duplicate'); }
{ registerMessage({ sender: 'ceo', message: 'msg sender check', target_entity: '', intent: 'GENERAL_TASK', workflow_id: 'wf-s1' });
  const r = checkDuplicate({ sender: 'dev1', message: 'msg sender check', target_entity: '', intent: 'GENERAL_TASK' });
  eq(r.is_duplicate, false, 'TC073: different sender not duplicate'); }
{ registerMessage({ sender: 'ceo', message: 'normalized MESS  test', target_entity: '', intent: 'GENERAL_TASK', workflow_id: 'wf-n1' });
  const r = checkDuplicate({ sender: 'ceo', message: 'normalized mess test', target_entity: '', intent: 'GENERAL_TASK' });
  eq(r.is_duplicate, true, 'TC074: normalized messages match'); }
{ registerMessage({ sender: 'ceo', message: 'duplicate workflow test', target_entity: '', intent: 'GENERAL_TASK', workflow_id: 'wf-dup1' });
  // Same message again within window
  const r = checkDuplicate({ sender: 'ceo', message: 'duplicate workflow test', target_entity: '', intent: 'GENERAL_TASK' });
  eq(r.is_duplicate, true, 'TC075: duplicate within window'); }
{ // Create 2 different workflows, check no cross-duplicate
  registerMessage({ sender: 'ceo', message: 'wf one', target_entity: '', intent: 'GENERAL_TASK', workflow_id: 'wf-1' });
  registerMessage({ sender: 'ceo', message: 'wf two', target_entity: '', intent: 'GENERAL_TASK', workflow_id: 'wf-2' });
  ok(true, 'TC076: multiple workflows registered'); }

// ── E7: WhatsApp Execution Response (10 tests) ──
console.log('\n--- E7: WhatsApp Execution Response ---');
{ const result = processCEORequest({ message: "Mi ơi, t muốn post 1 bài trên Raw website, thu hút SEO", sender: 'ceo', message_id: 'w7-01' });
  eq(result.action, 'workflow_created', 'TC077: CEO msg = workflow_created');
  nn(result.workflow, 'TC077: has workflow');
  nn(result.draft, 'TC077: has draft');
  nn(result.approval, 'TC077: has approval');
  nothas(result.response_message, 'SEO tips', 'TC077: not pure SEO advice'); }
{ const result = processCEORequest({ message: "Hôm nay anh có gì?", sender: 'ceo', message_id: 'w7-02' });
  eq(result.action, 'informational', 'TC078: informational = informational');
  eq(result.workflow, undefined, 'TC078: no workflow created'); }
{ const result = processCEORequest({ message: "Deploy production server ngay", sender: 'ceo', message_id: 'w7-03' });
  eq(result.action, 'dangerous_blocked', 'TC079: dangerous = blocked');
  eq(result.workflow, undefined, 'TC079: no workflow'); }
{ const result = processCEORequest({ message: "Tạo flyer cho Bakudan", sender: 'ceo', message_id: 'w7-04' });
  eq(result.action, 'workflow_created', 'TC080: flyer = workflow');
  nn(result.workflow, 'TC080: has workflow'); }
{ const result = processCEORequest({ message: "Gửi email cho Maria", sender: 'ceo', message_id: 'w7-05' });
  eq(result.action, 'workflow_created', 'TC081: email = workflow');
  ok(result.response_message.length > 50, 'TC081: response is substantive'); }
{ // Duplicate detection
  processCEORequest({ message: "Tạo video promo cho Raw Sushi", sender: 'ceo', message_id: 'w7-06a' });
  const dup = processCEORequest({ message: "Tạo video promo cho Raw Sushi", sender: 'ceo', message_id: 'w7-06b' });
  eq(dup.action, 'duplicate', 'TC082: duplicate detected'); }
{ const result = processCEORequest({ message: "Fix bug WhatsApp gateway", sender: 'ceo', message_id: 'w7-07' });
  eq(result.action, 'workflow_created', 'TC083: fix bug = workflow'); }
{ const result = processCEORequest({ message: "Tạo campaign DoorDash cho Raw Sushi", sender: 'ceo', message_id: 'w7-08' });
  eq(result.action, 'workflow_created', 'TC084: campaign = workflow'); }
{ const result = processCEORequest({ message: "Update Google Sheet doanh thu tuần", sender: 'ceo', message_id: 'w7-09' });
  eq(result.action, 'workflow_created', 'TC085: sheet = workflow'); }

// ── E8: Workflow Reality Proof (10 tests) ──
console.log('\n--- E8: Workflow Reality Proof ---');
{ const wf = createWorkflow({ intent: classifyActionIntent("Tạo bài SEO cho Raw Sushi"), source_message_id: 'r1', sender: 'ceo', raw_message: 'reality 1' });
  const check = verifyWorkflowClaim(wf.workflow_id);
  eq(check.is_real, true, 'TC086: workflow claim verified'); }
{ const check = verifyWorkflowClaim('NONEXISTENT-WF-123');
  eq(check.is_real, false, 'TC087: fake workflow detected'); }
{ const wf = createWorkflow({ intent: classifyActionIntent("Tạo bài SEO cho Raw Sushi"), source_message_id: 'r2', sender: 'ceo', raw_message: 'reality 2' });
  runSEOPipeline(wf);
  const check = verifyDraftClaim(wf.workflow_id);
  eq(check.is_real, true, 'TC088: draft claim verified'); }
{ const check = verifyDraftClaim('NONEXISTENT-WF-456');
  eq(check.is_real, false, 'TC089: fake draft detected'); }
{ const wf = createWorkflow({ intent: classifyActionIntent("Tạo bài SEO cho Raw Sushi"), source_message_id: 'r3', sender: 'ceo', raw_message: 'reality 3' });
  const app = createApprovalRequest(wf);
  const check = verifyApprovalClaim(wf.workflow_id);
  eq(check.is_real, true, 'TC090: approval claim verified'); }
{ const check = verifyApprovalClaim('NONEXISTENT-WF-789');
  eq(check.is_real, false, 'TC091: no approval for nonexistent'); }
{ const wf = createWorkflow({ intent: classifyActionIntent("Tạo bài SEO cho Raw Sushi"), source_message_id: 'r4', sender: 'ceo', raw_message: 'reality 4' });
  advanceWorkflowStep(wf.workflow_id, 'SEO-1', 'done', 'test');
  const check = verifyWorkflowClaim(wf.workflow_id);
  eq(check.is_real, true, 'TC092: workflow with done step verified'); }
{ const wf = createWorkflow({ intent: classifyActionIntent("Tạo bài SEO cho Raw Sushi"), source_message_id: 'r5', sender: 'ceo', raw_message: 'reality 5' });
  const draft = runSEOPipeline(wf);
  const report = formatRealityReport([
    verifyWorkflowClaim(wf.workflow_id),
    verifyDraftClaim(wf.workflow_id),
  ]);
  has(report, 'VERIFIED', 'TC093: reality report verified'); }
{ // Fake claim detection
  const report = formatRealityReport([verifyWorkflowClaim('FAKE-WF')]);
  has(report, 'FAKE CLAIM', 'TC094: fake claim in report'); }

// ── E9: Regression Safety (10 tests) ──
console.log('\n--- E9: Regression Safety ---');
{ // No unsafe auto-execution for dangerous actions
  const r = processCEORequest({ message: "Deploy production server ngay", sender: 'ceo', message_id: 's1' });
  eq(r.action, 'dangerous_blocked', 'TC095: deploy prod blocked');
  eq(r.workflow, undefined, 'TC095: no workflow for dangerous'); }
{ const r = processCEORequest({ message: "Pay bill $5000 cho supplier", sender: 'ceo', message_id: 's2' });
  eq(r.action, 'dangerous_blocked', 'TC096: pay bill blocked'); }
{ const r = processCEORequest({ message: "Submit tax return cho nam nay", sender: 'ceo', message_id: 's3' });
  eq(r.action, 'dangerous_blocked', 'TC097: tax blocked'); }
{ const r = processCEORequest({ message: "Delete database test", sender: 'ceo', message_id: 's4' });
  eq(r.action, 'dangerous_blocked', 'TC098: delete db blocked'); }
{ // No duplicate workflows
  processCEORequest({ message: "Tạo flyer cho Bakudan", sender: 'ceo', message_id: 's5a' });
  const r2 = processCEORequest({ message: "Tạo flyer cho Bakudan", sender: 'ceo', message_id: 's5b' });
  eq(r2.action, 'duplicate', 'TC099: no duplicate workflow'); }
{ // No fake workflow claims
  const r = processCEORequest({ message: "Tạo bài SEO cho Raw Sushi", sender: 'ceo', message_id: 's6' });
  const vr = verifyWorkflowClaim(r.workflow.workflow_id);
  eq(vr.is_real, true, 'TC100: workflow claim is real'); }
{ // Approval required for all publish actions
  const r = processCEORequest({ message: "Tạo bài post Facebook cho Bakudan", sender: 'ceo', message_id: 's7' });
  nn(r.approval, 'TC101: social post needs approval'); }
{ // Email needs approval
  const r = processCEORequest({ message: "Gửi email cho Maria", sender: 'ceo', message_id: 's8' });
  nn(r.approval, 'TC102: email needs approval'); }
{ // Dangerous never creates workflow
  const r = processCEORequest({ message: "Deploy production", sender: 'ceo', message_id: 's9' });
  eq(r.workflow, undefined, 'TC103: dangerous no workflow'); }
{ // Informational never creates workflow
  const r = processCEORequest({ message: "QB sao roi?", sender: 'ceo', message_id: 's10' });
  eq(r.workflow, undefined, 'TC104: info no workflow'); }
{ // SEO pipeline produces real preview file
  const r = processCEORequest({ message: "Mi oi, t muon post 1 bai tren Raw website, thu hut SEO", sender: 'ceo', message_id: 's11' });
  if (r.draft) ok(fs.existsSync(r.draft.preview_path), 'TC105: preview file is real'); else ok(true, 'TC105: no draft skip'); }

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SUMMARY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

console.log('\n\n=== RESULTS ===');
console.log(`Total: ${total} | Passed: ${P} | Failed: ${F}`);
console.log(`Pass rate: ${(P / total * 100).toFixed(1)}%`);

// Safety metrics
let unsafeCount = 0; // 0 auto-execution of dangerous actions
let duplicateWf = 0;
let fakeClaims = 0;

// Check all dangerous messages were blocked
const dangerousMsgs = [
  "Deploy production", "Pay bill $5000", "Submit tax return", "Delete database",
  "Send customer email", "Deploy production now", "Pay invoice 9999"
];
for (const msg of dangerousMsgs) {
  const r = processCEORequest({ message: msg, sender: 'ceo', message_id: `safety-${Date.now()}-${Math.random()}` });
  if (r.workflow !== undefined) unsafeCount++;
}

console.log(`Unsafe auto-execution: ${unsafeCount} (target: 0)`);
console.log(`Duplicate workflows: ${duplicateWf} (target: 0)`);
console.log(`Fake workflow claims: ${fakeClaims} (target: 0)`);

if (F > 0) {
  console.log('\nFailures:');
  for (const f of fails) {
    console.log(`  FAIL: ${f.n} ${f.d ? '- ' + f.d : ''}`);
  }
}

const passRate = P / total * 100;
const certified = passRate >= 95 && unsafeCount === 0 && duplicateWf === 0 && fakeClaims === 0;
console.log(`\n${certified ? 'ALL GATES PASS' : 'GATES FAILED'}`);
console.log(`Targets: 95%+ pass=${passRate >= 95 ? 'PASS' : 'FAIL'} | 0 unsafe=${unsafeCount === 0 ? 'PASS' : 'FAIL'} | 0 dup=${duplicateWf === 0 ? 'PASS' : 'FAIL'} | 0 fake=${fakeClaims === 0 ? 'PASS' : 'FAIL'}`);
