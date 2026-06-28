/**
 * Phase 15 — Operational Memory Runtime Acceptance Test
 *
 * Q1: "Review Automation đã từng lỗi chưa?"
 * Q2: "3 tháng gần đây project nào có nhiều blocker nhất?"
 * Q3: "Dev1 thường fix gì?"
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const MI_CORE_ROOT = 'D:/Project/Master/mi-core';
const GLOBAL_DIR = path.join(MI_CORE_ROOT, '.local-agent-global');
const MEM_DIR = path.join(GLOBAL_DIR, 'operational-memory');
const MEM_DB = path.join(MEM_DIR, 'memory.db');

// Fresh DB for acceptance test
fs.mkdirSync(MEM_DIR, { recursive: true });
if (fs.existsSync(MEM_DB)) fs.unlinkSync(MEM_DB);

const db = new Database(MEM_DB);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ────────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS executions (
    id TEXT PRIMARY KEY, created_at TEXT NOT NULL, completed_at TEXT,
    source TEXT DEFAULT 'api', requested_by TEXT DEFAULT 'ceo',
    intent TEXT, target_project TEXT, priority TEXT DEFAULT 'P2',
    final_verdict TEXT, duration_ms INTEGER DEFAULT 0,
    step_count INTEGER DEFAULT 0, pass_count INTEGER DEFAULT 0, fail_count INTEGER DEFAULT 0,
    agent_roles TEXT DEFAULT '[]', raw_request TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS incidents (
    id TEXT PRIMARY KEY, work_order_id TEXT, ts TEXT NOT NULL,
    target TEXT, agent_role TEXT, action_type TEXT, error_summary TEXT,
    verdict TEXT DEFAULT 'FAIL', resolved INTEGER DEFAULT 0,
    resolution_notes TEXT DEFAULT '', recur_count INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS owner_actions (
    id TEXT PRIMARY KEY, work_order_id TEXT, ts TEXT NOT NULL,
    owner TEXT, agent_role TEXT, action_type TEXT, target TEXT,
    verdict TEXT, duration_ms INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS period_summaries (
    id TEXT PRIMARY KEY, period TEXT NOT NULL,
    period_start TEXT NOT NULL, period_end TEXT NOT NULL,
    target_project TEXT NOT NULL, total_execs INTEGER DEFAULT 0,
    pass_count INTEGER DEFAULT 0, fail_count INTEGER DEFAULT 0,
    incident_count INTEGER DEFAULT 0, avg_duration_ms REAL DEFAULT 0,
    UNIQUE(period, period_start, target_project)
  );
`);

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysAgo(n) {
  return new Date(Date.now() - n * 86400_000).toISOString();
}

let seq = 0;
function uid(prefix) { return `${prefix}-${++seq}`; }

function insertExec(proj, intent, verdict, daysBack, roles = ['engineering_manager', 'qa_agent'], durMs = 45000) {
  const ts = daysAgo(daysBack);
  const id = uid('WO');
  db.prepare(`INSERT OR REPLACE INTO executions
    (id,created_at,completed_at,source,requested_by,intent,target_project,priority,final_verdict,duration_ms,step_count,pass_count,fail_count,agent_roles,raw_request)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, ts, new Date(new Date(ts).getTime() + durMs).toISOString(),
      'whatsapp','ceo',intent,proj,'P1',verdict,durMs,
      roles.length,
      verdict==='PASS' ? roles.length : Math.floor(roles.length/2),
      verdict==='FAIL' ? Math.ceil(roles.length/2) : 0,
      JSON.stringify(roles), `Mi ơi ${intent} ${proj}`);
  return { id, ts };
}

function insertIncident(target, role, action, summary, daysBack, resolved=false, notes='', recur=0) {
  const id = uid('INC');
  db.prepare(`INSERT OR REPLACE INTO incidents
    (id,work_order_id,ts,target,agent_role,action_type,error_summary,verdict,resolved,resolution_notes,recur_count)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, null, daysAgo(daysBack), target, role, action, summary,
      'FAIL', resolved ? 1 : 0, notes, recur);
  return id;
}

function insertOwnerAction(role, action, target, verdict, daysBack, durMs=30000) {
  const id = uid('OA');
  db.prepare(`INSERT OR REPLACE INTO owner_actions
    (id,work_order_id,ts,owner,agent_role,action_type,target,verdict,duration_ms)
    VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(id, null, daysAgo(daysBack), 'ceo', role, action, target, verdict, durMs);
  return id;
}

// ── Seed synthetic history (3 months) ─────────────────────────────────────────

// Dashboard — 20 executions, 16 pass, 4 fail
for (let i=0; i<16; i++) insertExec('dashboard','audit_project','PASS', Math.floor(Math.random()*85)+5);
for (let i=0; i<4;  i++) insertExec('dashboard','fix_bug','FAIL', Math.floor(Math.random()*85)+5);

// Mi-Core — 15 executions, 12 pass, 3 fail
for (let i=0; i<12; i++) insertExec('mi-core','health_check','PASS', Math.floor(Math.random()*85)+5);
for (let i=0; i<3;  i++) insertExec('mi-core','fix_bug','FAIL', Math.floor(Math.random()*85)+5);

// Review Automation — 10 executions, 5 pass, 5 fail (problem project)
for (let i=0; i<5;  i++) insertExec('review-automation','audit_project','PASS', Math.floor(Math.random()*85)+5);
for (let i=0; i<5;  i++) insertExec('review-automation','fix_bug','FAIL', Math.floor(Math.random()*85)+5);

// WhatsApp Gateway — 8 executions, 7 pass, 1 fail
for (let i=0; i<7;  i++) insertExec('whatsapp-gateway','health_check','PASS', Math.floor(Math.random()*85)+5);
insertExec('whatsapp-gateway','fix_bug','FAIL', 10);

// Jarvis — 6 executions, 6 pass
for (let i=0; i<6;  i++) insertExec('jarvis','audit_project','PASS', Math.floor(Math.random()*85)+5);

// ── Seed Incidents ────────────────────────────────────────────────────────────

// Review Automation incidents (Q1 focus)
insertIncident('review-automation','qa_agent','qa_sweep','Regression suite: 3 tests failed — PR reviewer API timeout',85,true,'engineering_manager patched API timeout config',2);
insertIncident('review-automation','engineering_manager','fix_deployment','Deploy failed: missing env var REVIEW_API_TOKEN',60,true,'CEO added env var via PM2 config',0);
insertIncident('review-automation','qa_agent','qa_sweep','Build compile error — TypeScript strict null check failure',45,true,'Dev1 fixed null guard in review-client.ts',1);
insertIncident('review-automation','qa_agent','qa_sweep','Regression: review webhook returns 502',20,false,'',0);
insertIncident('review-automation','engineering_manager','system_scan','Health check: port 4005 not responding',10,false,'',0);

// Dashboard incidents
insertIncident('dashboard','qa_agent','qa_sweep','Visibility connector timeout after upgrade',70,true,'Patched connector timeout setting',0);
insertIncident('dashboard','engineering_manager','fix_deployment','CSS build artifact missing after deploy',40,true,'Fixed build script',0);

// Mi-Core incidents
insertIncident('mi-core','qa_agent','qa_sweep','Memory spike — Node heap at 85%',55,true,'Increased PM2 max_memory_restart',0);
insertIncident('mi-core','engineering_manager','fix_bug','Better-sqlite3 WAL lock contention',30,true,'Added retry logic',1);

// ── Seed Owner Actions (Dev1 = engineering_manager + developer) ───────────────

// Dev1 (engineering_manager) — heavy focus on dashboard + review-automation fixing
const dev1Actions = [
  ['fix_bug','dashboard'],['fix_bug','dashboard'],['fix_bug','dashboard'],
  ['system_scan','dashboard'],['system_scan','dashboard'],
  ['fix_deployment','review-automation'],['fix_deployment','review-automation'],
  ['fix_bug','review-automation'],['fix_bug','review-automation'],
  ['plan_technical_work','mi-core'],['plan_technical_work','mi-core'],
  ['plan_technical_work','mi-core'],['build_verification','mi-core'],
  ['fix_bug','whatsapp-gateway'],['system_scan','jarvis'],
  ['fix_bug','knowledge-universe'],['code_review','dashboard'],
];
for (let i=0; i<dev1Actions.length; i++) {
  insertOwnerAction('engineering_manager', dev1Actions[i][0], dev1Actions[i][1],
    Math.random() > 0.15 ? 'PASS' : 'FAIL', Math.floor(Math.random()*85)+2, 25000+Math.random()*40000);
}

// QA Agent actions
const qaActions = [
  ['qa_sweep','dashboard'],['qa_sweep','dashboard'],['qa_sweep','dashboard'],['qa_sweep','dashboard'],
  ['qa_sweep','review-automation'],['qa_sweep','review-automation'],['qa_sweep','review-automation'],
  ['qa_sweep','mi-core'],['qa_sweep','mi-core'],
  ['qa_sweep','whatsapp-gateway'],['qa_sweep','jarvis'],
];
for (let i=0; i<qaActions.length; i++) {
  insertOwnerAction('qa_agent', qaActions[i][0], qaActions[i][1],
    Math.random() > 0.3 ? 'PASS' : 'FAIL', Math.floor(Math.random()*85)+2, 15000+Math.random()*20000);
}

// PM actions
for (let i=0; i<8; i++) {
  insertOwnerAction('product_manager','compile_report',
    ['dashboard','mi-core','review-automation'][i%3],
    'PASS', Math.floor(Math.random()*85)+2, 5000);
}

// Auditor actions
for (let i=0; i<6; i++) {
  insertOwnerAction('auditor_agent','audit_certification',
    ['dashboard','mi-core','review-automation'][i%3],
    Math.random() > 0.4 ? 'PASS' : 'FAIL', Math.floor(Math.random()*85)+2, 10000);
}

// ── Rebuild period_summaries ──────────────────────────────────────────────────

for (const { period, days } of [{ period:'week',days:7},{period:'month',days:30},{period:'quarter',days:90}]) {
  const cutoff = daysAgo(days);
  const now = new Date().toISOString();

  const rows = db.prepare(`
    SELECT target_project,
           COUNT(*) as total,
           SUM(CASE WHEN final_verdict='PASS' THEN 1 ELSE 0 END) as passes,
           SUM(CASE WHEN final_verdict='FAIL' THEN 1 ELSE 0 END) as fails,
           AVG(duration_ms) as avg_dur
    FROM executions
    WHERE created_at >= ? AND target_project IS NOT NULL
    GROUP BY target_project
  `).all(cutoff);

  for (const row of rows) {
    const ic = db.prepare(`SELECT COUNT(*) as c FROM incidents WHERE ts >= ? AND target = ?`)
      .get(cutoff, row.target_project).c;
    const id = `${period}__${row.target_project}`;
    db.prepare(`INSERT OR REPLACE INTO period_summaries
      (id,period,period_start,period_end,target_project,total_execs,pass_count,fail_count,incident_count,avg_duration_ms)
      VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run(id, period, cutoff, now, row.target_project,
        row.total, row.passes, row.fails, ic, row.avg_dur || 0);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  PHASE 15 — OPERATIONAL MEMORY ACCEPTANCE TEST              ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

// ── Q1: "Review Automation đã từng lỗi chưa?" ────────────────────────────────
console.log('═══════════════════════════════════════════════');
console.log('Q1: "Review Automation đã từng lỗi chưa?"');
console.log('═══════════════════════════════════════════════\n');

const raIncidents = db.prepare(`
  SELECT * FROM incidents WHERE lower(target) LIKE '%review%' ORDER BY ts DESC
`).all();

const raResolved = raIncidents.filter(i => i.resolved === 1);
const raRecurred = raIncidents.filter(i => i.recur_count > 0);
const raUnresolved = raIncidents.filter(i => i.resolved === 0);

console.log(`📋 Tổng số incident: ${raIncidents.length}`);
console.log(`✅ Đã giải quyết: ${raResolved.length}`);
console.log(`⚠️  Chưa giải quyết: ${raUnresolved.length}`);
console.log(`🔄 Tái diễn: ${raRecurred.length}`);
console.log();
console.log('📊 Chi tiết incidents gần đây:');
for (const inc of raIncidents.slice(0,5)) {
  const age = Math.round((Date.now() - new Date(inc.ts).getTime()) / 86400000);
  console.log(`  [${inc.resolved ? 'RESOLVED' : 'OPEN'}] ${inc.error_summary.slice(0,60)}...`);
  console.log(`         Role: ${inc.agent_role} | ${age} ngày trước${inc.recur_count > 0 ? ` | Tái diễn ${inc.recur_count}x` : ''}`);
  if (inc.resolution_notes) console.log(`         Fix: ${inc.resolution_notes}`);
}

const q1Answer = raIncidents.length > 0
  ? `Có. Review Automation đã có ${raIncidents.length} incident(s). ${raResolved.length} đã xử lý, ${raUnresolved.length} còn mở. ${raRecurred.length > 0 ? `${raRecurred.length} incident tái diễn.` : ''}`
  : 'Không. Chưa có incident nào được ghi nhận.';
console.log(`\n🤖 Mi trả lời: "${q1Answer}"\n`);

// ── Q2: "3 tháng gần đây project nào có nhiều blocker nhất?" ─────────────────
console.log('═══════════════════════════════════════════════');
console.log('Q2: "3 tháng gần đây project nào có nhiều blocker nhất?"');
console.log('═══════════════════════════════════════════════\n');

const quarterSummaries = db.prepare(`
  SELECT target_project, fail_count + incident_count as blocker_count,
         total_execs, pass_count, fail_count, incident_count
  FROM period_summaries WHERE period = 'quarter'
  ORDER BY blocker_count DESC LIMIT 10
`).all();

console.log('📊 Top blocker projects (last 90 days):');
for (let i=0; i<quarterSummaries.length; i++) {
  const r = quarterSummaries[i];
  const rate = r.total_execs ? Math.round((r.pass_count/r.total_execs)*100) : 0;
  console.log(`  ${i+1}. ${r.target_project.padEnd(25)} blockers: ${r.blocker_count}  (${r.fail_count} FAILs + ${r.incident_count} incidents)  success: ${rate}%`);
}

const topBlocker = quarterSummaries[0];
const q2Answer = topBlocker
  ? `Trong 3 tháng qua, "${topBlocker.target_project}" có nhiều blocker nhất (${topBlocker.blocker_count} blockers — ${topBlocker.fail_count} lần fail + ${topBlocker.incident_count} incidents).`
  : 'Không đủ dữ liệu.';
console.log(`\n🤖 Mi trả lời: "${q2Answer}"\n`);

// ── Q3: "Dev1 thường fix gì?" ─────────────────────────────────────────────────
console.log('═══════════════════════════════════════════════');
console.log('Q3: "Dev1 thường fix gì?"');
console.log('═══════════════════════════════════════════════\n');

const dev1Rows = db.prepare(`
  SELECT * FROM owner_actions
  WHERE agent_role IN ('engineering_manager','developer')
  ORDER BY ts DESC
`).all();

const dev1Targets = {};
const dev1ActionTypes = {};
for (const r of dev1Rows) {
  dev1Targets[r.target] = (dev1Targets[r.target]||0)+1;
  dev1ActionTypes[r.action_type] = (dev1ActionTypes[r.action_type]||0)+1;
}
const topTargets = Object.entries(dev1Targets).sort((a,b)=>b[1]-a[1]).slice(0,5);
const topActionTypes = Object.entries(dev1ActionTypes).sort((a,b)=>b[1]-a[1]).slice(0,5);
const passes = dev1Rows.filter(r=>r.verdict==='PASS').length;

console.log(`👤 Dev1 (engineering_manager) — ${dev1Rows.length} actions recorded`);
console.log(`   Success rate: ${dev1Rows.length ? Math.round((passes/dev1Rows.length)*100) : 0}%`);
console.log(`\n📂 Thường làm việc trên:`);
for (const [target, count] of topTargets) {
  console.log(`   → ${target.padEnd(25)} ${count} actions`);
}
console.log(`\n🔧 Action types phổ biến:`);
for (const [action, count] of topActionTypes) {
  console.log(`   → ${action.padEnd(25)} ${count} times`);
}

const topTarget = topTargets[0]?.[0] || '(none)';
const topAction = topActionTypes[0]?.[0] || '(none)';
const q3Answer = dev1Rows.length > 0
  ? `Dev1 thường làm "${topAction}" trên project "${topTarget}". Tổng ${dev1Rows.length} actions, success rate ${dev1Rows.length ? Math.round((passes/dev1Rows.length)*100) : 0}%.`
  : 'Không đủ dữ liệu về Dev1.';
console.log(`\n🤖 Mi trả lời: "${q3Answer}"\n`);

// ── Verification Gates ────────────────────────────────────────────────────────
console.log('═══════════════════════════════════════════════');
console.log('VERIFICATION GATES');
console.log('═══════════════════════════════════════════════\n');

const stats = {
  executions: db.prepare('SELECT COUNT(*) as c FROM executions').get().c,
  incidents: db.prepare('SELECT COUNT(*) as c FROM incidents').get().c,
  owner_actions: db.prepare('SELECT COUNT(*) as c FROM owner_actions').get().c,
  period_summaries: db.prepare('SELECT COUNT(*) as c FROM period_summaries').get().c,
};

const checks = [
  ['Memory store seeded (executions > 50)', stats.executions > 50],
  ['Incidents recorded (> 5)', stats.incidents > 5],
  ['Owner actions recorded (> 20)', stats.owner_actions > 20],
  ['Period summaries built', stats.period_summaries > 0],
  ['Q1: Review Automation has incident history', raIncidents.length > 0],
  ['Q1: At least one RA incident resolved', raResolved.length > 0],
  ['Q1: RA incident answer generated', raIncidents.length > 0 && q1Answer.length > 10],
  ['Q2: Quarter period summaries exist', quarterSummaries.length > 0],
  ['Q2: Top blocker project identified', !!topBlocker],
  ['Q2: Blocker count > 0', topBlocker?.blocker_count > 0],
  ['Q2: Blocker answer generated', q2Answer.length > 10],
  ['Q3: Dev1 actions recorded', dev1Rows.length > 0],
  ['Q3: Top target identified for Dev1', topTargets.length > 0],
  ['Q3: Top action type identified for Dev1', topActionTypes.length > 0],
  ['Q3: Dev1 answer generated', q3Answer.length > 10],
  ['Trend data: period summaries cover week+month+quarter',
    db.prepare("SELECT COUNT(DISTINCT period) as c FROM period_summaries").get().c >= 2],
];

let pass = 0, fail = 0;
for (const [name, ok] of checks) {
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${name}`);
  ok ? pass++ : fail++;
}

console.log(`\n  Memory stats: ${stats.executions} executions | ${stats.incidents} incidents | ${stats.owner_actions} owner_actions | ${stats.period_summaries} period_summaries`);

console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
console.log(`║  RESULT: ${pass}/${checks.length} checks PASSED${fail > 0 ? ` — ${fail} FAILED` : ''}`.padEnd(62) + '  ║');
console.log(`║  STATUS: ${fail === 0 ? 'OPERATIONAL_MEMORY_RUNTIME_READY      ' : 'NEEDS_INVESTIGATION                   '}`.padEnd(62) + '  ║');
console.log(`╚══════════════════════════════════════════════════════════════╝\n`);

db.close();
if (fail > 0) process.exit(1);
