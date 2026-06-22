#!/usr/bin/env node
/**
 * v4-burn-in-monitor.mjs — CEO_READY_V4 Burn-In Monitor
 *
 * Runs 5 metric areas x 20 points each = 100 max score.
 * Produces V4_BURNIN_REPORT_YYYY-MM-DD.md
 *
 * Metrics (corrected per DEV4 Day 1 validation):
 *   M1: Restart Stability     — PM2 restarts, crash loops, error log health
 *   M2: Memory Persistence    — SQLite stores, workflows, approval DB
 *   M3: Workflow Reality       — Execution ledger, workflow files, success rate
 *   M4: Connector Truth       — Connector registry vs live probes, freshness
 *   M5: Safety & Security     — Secret scan, safety gates, approval gates
 *
 * Usage: node v4-burn-in-monitor.mjs
 * Output: V4_BURNIN_REPORT_YYYY-MM-DD.md
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import http from 'http';

// ── Config ──────────────────────────────────────────────────────────────────

const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/mi-core/.local-agent-global';
const PROJECT_DIR = process.env.PROJECT_DIR || 'E:/Project/Master/mi-core';
const LOG_DIR = process.env.PM2_LOG_DIR || 'C:/Users/liemdo/.pm2/logs';
const TODAY = new Date().toISOString().split('T')[0];
const NOW_ISO = new Date().toISOString();
const REPORT_FILE = path.join(PROJECT_DIR, `V4_BURNIN_REPORT_${TODAY}.md`);

const PM2_PROCESSES = ['mi-core', 'mi-node-agent', 'mi-ai-service', 'accounting-engine', 'whatsapp-ai-gateway'];
const HEALTH_ENDPOINTS = [
  { name: 'mi-core', url: 'http://127.0.0.1:4001/api/health' },
  { name: 'accounting-engine', url: 'http://127.0.0.1:8844/health' },
  { name: 'whatsapp-gateway', url: 'http://127.0.0.1:3211/health' },
];

const SECRET_PATTERN = 'mi-core-secret-2026';
const SOURCE_DIRS = ['server', 'agent-engine', 'health', 'local-agent', 'infra', 'ai-service'];

// ── Helpers ─────────────────────────────────────────────────────────────────

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: 30000, cwd: PROJECT_DIR }).trim();
  } catch {
    return null;
  }
}

function fileExists(p) {
  try { fs.statSync(p); return true; } catch { return false; }
}

function fileSize(p) {
  try { return fs.statSync(p).size; } catch { return 0; }
}

function dirCount(p) {
  try { return fs.readdirSync(p).length; } catch { return 0; }
}

function probe(url, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data.substring(0, 500) });
        }
      });
    });
    req.on('error', (e) => resolve({ status: 0, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'TIMEOUT' }); });
  });
}

// ── M1: Restart Stability ───────────────────────────────────────────────────

function checkRestartStability(pm2Data, errorLogs) {
  const evidence = [];
  let score = 20;
  let issues = 0;

  for (const proc of pm2Data) {
    const restarts = proc.restarts || 0;
    const status = proc.status;

    if (status !== 'online') {
      score -= 5;
      issues++;
      evidence.push(`❌ ${proc.name}: status=${status} (expected online)`);
    } else if (restarts > 10) {
      score -= 2;
      issues++;
      evidence.push(`⚠️ ${proc.name}: ${restarts} cumulative restarts (high)`);
    } else {
      evidence.push(`✅ ${proc.name}: online, ${restarts} restarts`);
    }
  }

  const criticalLogs = errorLogs.filter(l => l.size > 1_000_000);
  if (criticalLogs.length > 0) {
    score -= 3;
    issues++;
    for (const log of criticalLogs) {
      const sizeMB = (log.size / 1_024 / 1024).toFixed(1);
      evidence.push(`⚠️ ${log.name}: ${sizeMB}MB error log`);
    }
  }

  const addrInUse = errorLogs.find(l => l.name.includes('mi-core') && l.hasAddrInUse);
  if (addrInUse) {
    score -= 3;
    issues++;
    evidence.push(`⚠️ EADDRINUSE errors found in mi-core error log`);
  }

  return {
    name: 'M1: Restart Stability',
    score: Math.max(0, Math.min(20, score)),
    maxScore: 20,
    issues,
    evidence,
    detail: issues === 0 ? 'All processes stable' : `${issues} issue(s) detected`,
  };
}

// ── M2: Memory Persistence ──────────────────────────────────────────────────

function checkMemoryPersistence() {
  const evidence = [];
  let score = 20;
  let issues = 0;

  const stores = [
    { name: 'conversations.db', path: path.join(GLOBAL_DIR, 'conversations.db'), required: true },
    { name: 'approvals.db', path: path.join(GLOBAL_DIR, 'approval-store', 'approvals.db'), required: true },
    { name: 'reminder-store', path: path.join(GLOBAL_DIR, 'reminder-store'), required: true },
    { name: 'workflows-dir', path: path.join(GLOBAL_DIR, 'workflows'), required: true },
    { name: 'execution-ledger', path: path.join(GLOBAL_DIR, 'execution-ledger'), required: true },
    { name: 'connector-registry', path: path.join(GLOBAL_DIR, 'visibility', 'connector-registry.json'), required: true },
    { name: 'executive-memory', path: path.join(GLOBAL_DIR, 'executive-memory-v2'), required: false },
  ];

  for (const store of stores) {
    const exists = fileExists(store.path);
    if (exists) {
      const size = fileSize(store.path);
      const items = dirCount(store.path);
      const info = items > 0 ? `${items} items` : `${size} bytes`;
      evidence.push(`✅ ${store.name}: present (${info})`);
    } else if (store.required) {
      score -= 3;
      issues++;
      evidence.push(`❌ ${store.name}: MISSING (required)`);
    } else {
      evidence.push(`⚠️ ${store.name}: absent (optional)`);
    }
  }

  return {
    name: 'M2: Memory Persistence',
    score: Math.max(0, Math.min(20, score)),
    maxScore: 20,
    issues,
    evidence,
    detail: issues === 0 ? 'All required stores present' : `${issues} critical store(s) missing`,
  };
}

// ── M3: Workflow Reality ────────────────────────────────────────────────────

function checkWorkflowReality() {
  const evidence = [];
  let score = 20;
  let issues = 0;

  const ledgerPath = path.join(GLOBAL_DIR, 'execution-ledger', 'ledger.jsonl');
  if (fileExists(ledgerPath)) {
    const content = fs.readFileSync(ledgerPath, 'utf8');
    const entries = content.trim().split('\n').filter(l => l.trim());
    const passCount = entries.filter(l => l.includes('"PASS"')).length;
    const failCount = entries.filter(l => l.includes('"FAIL"')).length;

    evidence.push(`✅ Execution ledger: ${entries.length} entries (${passCount} pass, ${failCount} fail)`);

    if (entries.length < 10) {
      score -= 3;
      issues++;
      evidence.push(`⚠️ Ledger has <10 entries — insufficient workflow evidence`);
    }
    if (failCount > passCount && entries.length > 0) {
      score -= 3;
      issues++;
      evidence.push(`⚠️ More FAIL (${failCount}) than PASS (${passCount}) entries`);
    }

    try {
      const lastEntry = JSON.parse(entries[entries.length - 1]);
      const lastTs = new Date(lastEntry.ts);
      const hoursAgo = (Date.now() - lastTs.getTime()) / (1000 * 60 * 60);
      if (hoursAgo > 48) {
        score -= 2;
        evidence.push(`⚠️ Last ledger entry was ${Math.round(hoursAgo)}h ago`);
      } else {
        evidence.push(`✅ Last ledger entry: ${Math.round(hoursAgo)}h ago`);
      }
    } catch {}
  } else {
    score -= 8;
    issues++;
    evidence.push(`❌ Execution ledger: NOT FOUND`);
  }

  const workflowsDir = path.join(GLOBAL_DIR, 'workflows');
  if (fileExists(workflowsDir)) {
    const count = dirCount(workflowsDir);
    evidence.push(`✅ Workflow files: ${count} items`);
    if (count === 0) {
      score -= 3;
      issues++;
      evidence.push(`⚠️ Workflow directory exists but is empty`);
    }
  } else {
    score -= 5;
    issues++;
    evidence.push(`❌ Workflow directory: MISSING`);
  }

  const workOrdersDir = path.join(GLOBAL_DIR, 'work-orders');
  if (fileExists(workOrdersDir)) {
    const count = dirCount(workOrdersDir);
    evidence.push(`✅ Work orders: ${count} item(s)`);
  } else {
    score -= 2;
    issues++;
    evidence.push(`⚠️ Work orders directory: missing`);
  }

  return {
    name: 'M3: Workflow Reality',
    score: Math.max(0, Math.min(20, score)),
    maxScore: 20,
    issues,
    evidence,
    detail: issues === 0 ? 'Workflows healthy' : `${issues} issue(s) in workflow layer`,
  };
}

// ── M4: Connector Truth ─────────────────────────────────────────────────────

function checkConnectorTruth(registryData, healthProbes) {
  const evidence = [];
  let score = 20;
  let issues = 0;

  if (registryData) {
    const connectors = Array.isArray(registryData) ? registryData : Object.values(registryData);
    evidence.push(`✅ Connector registry: ${connectors.length} connectors loaded`);

    const now = Date.now();
    const staleThreshold = 24 * 60 * 60 * 1000;
    let staleCount = 0;
    for (const c of connectors) {
      if (c.last_sync) {
        const age = now - new Date(c.last_sync).getTime();
        if (age > staleThreshold) {
          staleCount++;
        }
      }
    }
    if (staleCount > 0) {
      score -= Math.min(5, staleCount);
      issues += staleCount;
      evidence.push(`⚠️ ${staleCount} connector(s) stale (>24h since last sync)`);
    } else {
      evidence.push(`✅ All connectors within freshness window`);
    }
  } else {
    score -= 5;
    issues++;
    evidence.push(`❌ Connector registry: NOT READABLE`);
  }

  for (const ep of healthProbes) {
    if (ep.result) {
      if (ep.result.status === 200) {
        evidence.push(`✅ ${ep.name}: HTTP 200`);
      } else if (ep.result.status === 401) {
        evidence.push(`✅ ${ep.name}: HTTP 401 (auth required — expected)`);
      } else if (ep.result.status === 0) {
        score -= 3;
        issues++;
        evidence.push(`❌ ${ep.name}: UNREACHABLE (${ep.result.error})`);
      } else {
        score -= 2;
        issues++;
        evidence.push(`⚠️ ${ep.name}: HTTP ${ep.result.status}`);
      }
    }
  }

  return {
    name: 'M4: Connector Truth',
    score: Math.max(0, Math.min(20, score)),
    maxScore: 20,
    issues,
    evidence,
    detail: issues === 0 ? 'All connectors honest and fresh' : `${issues} connector issue(s)`,
  };
}

// ── M5: Safety & Security ───────────────────────────────────────────────────

function checkSafetySecurity() {
  const evidence = [];
  let score = 20;
  let issues = 0;

  // Secret scan
  let secretFound = false;
  for (const dir of SOURCE_DIRS) {
    const result = run(`findstr /s /i /m "${SECRET_PATTERN}" ${dir}\\*.ts ${dir}\\*.js ${dir}\\*.mjs ${dir}\\*.json ${dir}\\*.env 2>nul`);
    if (result && result.trim()) {
      secretFound = true;
      score -= 8;
      issues++;
      evidence.push(`❌ SECRET LEAK: Found "${SECRET_PATTERN}" in ${result.trim()}`);
    }
  }
  if (!secretFound) {
    evidence.push(`✅ Secret scan: 0 matches across ${SOURCE_DIRS.length} source dirs`);
  }

  // Safety engine check
  const safetyEnginePath = path.join(PROJECT_DIR, 'server', 'src', 'autonomous', 'autonomous-execution-engine.ts');
  if (fileExists(safetyEnginePath)) {
    const content = fs.readFileSync(safetyEnginePath, 'utf8');
    const hasBlockedPatterns = content.includes('BLOCKED_PATTERNS');
    const hasCanRunNow = content.includes('can_run_now');

    if (hasBlockedPatterns && hasCanRunNow) {
      evidence.push(`✅ Safety engine: BLOCKED_PATTERNS + can_run_now present`);
    } else {
      score -= 4;
      issues++;
      evidence.push(`❌ Safety engine: missing BLOCKED_PATTERNS or can_run_now`);
    }
  } else {
    score -= 5;
    issues++;
    evidence.push(`❌ Safety engine: NOT FOUND`);
  }

  // Approval store check
  if (fileExists(path.join(GLOBAL_DIR, 'approval-store', 'approvals.db'))) {
    evidence.push(`✅ Approval store: SQLite DB present`);
  } else {
    score -= 3;
    issues++;
    evidence.push(`❌ Approval store: MISSING — approval gate may not persist`);
  }

  // Action audit log
  const auditDir = path.join(GLOBAL_DIR, 'action-audit');
  if (fileExists(auditDir)) {
    const count = dirCount(auditDir);
    evidence.push(`✅ Action audit directory: present (${count} files)`);
  } else {
    score -= 2;
    issues++;
    evidence.push(`⚠️ Action audit directory: missing`);
  }

  return {
    name: 'M5: Safety & Security',
    score: Math.max(0, Math.min(20, score)),
    maxScore: 20,
    issues,
    evidence,
    detail: issues === 0 ? 'Security and safety gates healthy' : `${issues} security issue(s)`,
  };
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== V4 Burn-In Monitor ===`);
  console.log(`Date: ${TODAY} ${NOW_ISO}`);
  console.log(`Report: ${REPORT_FILE}\n`);

  // ── Collect PM2 data ──
  console.log('Collecting PM2 data...');
  let pm2Data = [];
  try {
    const raw = execSync('pm2 jlist', { encoding: 'utf8', timeout: 10000 });
    const allProcs = JSON.parse(raw);
    pm2Data = allProcs
      .filter(p => PM2_PROCESSES.includes(p.name))
      .map(p => ({
        name: p.name,
        pid: p.pid,
        status: p.pm2_env.status,
        restarts: p.pm2_env.restart_time,
        uptime: p.pm2_env.pm_uptime,
        memory: p.monit?.memory,
        cpu: p.monit?.cpu,
      }));
  } catch (e) {
    console.error('PM2 error:', e.message);
  }

  // ── Collect error logs ──
  console.log('Analyzing error logs...');
  const errorLogs = [];
  try {
    const logFiles = fs.readdirSync(LOG_DIR).filter(f => f.includes('error') || f.includes('err'));
    for (const f of logFiles) {
      const fp = path.join(LOG_DIR, f);
      const stat = fs.statSync(fp);
      let hasAddrInUse = false;
      if (stat.size > 0 && stat.size < 50_000_000) {
        const content = fs.readFileSync(fp, 'utf8');
        hasAddrInUse = content.includes('EADDRINUSE');
      } else if (stat.size >= 50_000_000) {
        const fd = fs.openSync(fp, 'r');
        const buf = Buffer.alloc(100_000);
        const bytesRead = fs.readSync(fd, buf, 0, 100_000, Math.max(0, stat.size - 100_000));
        fs.closeSync(fd);
        hasAddrInUse = buf.toString('utf8', 0, bytesRead).includes('EADDRINUSE');
      }
      errorLogs.push({ name: f, size: stat.size, hasAddrInUse });
    }
  } catch {}

  // ── Health probes ──
  console.log('Probing health endpoints...');
  const healthProbes = [];
  for (const ep of HEALTH_ENDPOINTS) {
    const result = await probe(ep.url);
    healthProbes.push({ ...ep, result });
  }

  // ── Connector registry ──
  console.log('Reading connector registry...');
  let registryData = null;
  try {
    const raw = fs.readFileSync(path.join(GLOBAL_DIR, 'visibility', 'connector-registry.json'), 'utf8');
    registryData = JSON.parse(raw);
  } catch {}

  // ── Run all checks ──
  console.log('Running metric checks...\n');
  const m1 = checkRestartStability(pm2Data, errorLogs);
  const m2 = checkMemoryPersistence();
  const m3 = checkWorkflowReality();
  const m4 = checkConnectorTruth(registryData, healthProbes);
  const m5 = checkSafetySecurity();

  const metrics = [m1, m2, m3, m4, m5];
  const totalScore = metrics.reduce((sum, m) => sum + m.score, 0);
  const totalIssues = metrics.reduce((sum, m) => sum + m.issues, 0);

  // ── Determine grade ──
  let grade;
  if (totalScore >= 95) grade = 'A';
  else if (totalScore >= 90) grade = 'A-';
  else if (totalScore >= 85) grade = 'B+';
  else if (totalScore >= 80) grade = 'B';
  else if (totalScore >= 75) grade = 'B-';
  else if (totalScore >= 70) grade = 'C+';
  else if (totalScore >= 65) grade = 'C';
  else if (totalScore >= 60) grade = 'C-';
  else if (totalScore >= 55) grade = 'D+';
  else grade = 'D';

  // ── P0/P1 classification ──
  const p0s = [];
  const p1s = [];
  for (const m of metrics) {
    for (const e of m.evidence) {
      if (e.includes('❌') && (e.includes('SECRET') || e.includes('approval gate') || e.includes('Safety engine'))) {
        p0s.push({ metric: m.name, issue: e });
      } else if (e.includes('❌') || e.includes('⚠️')) {
        p1s.push({ metric: m.name, issue: e });
      }
    }
  }

  // ── Generate report ──
  const reportLines = [];
  reportLines.push(`# V4_BURNIN_REPORT_${TODAY}`);
  reportLines.push('');
  reportLines.push(`**Date:** ${NOW_ISO}`);
  reportLines.push(`**Monitor:** v4-burn-in-monitor.mjs`);
  reportLines.push(`**Target:** CEO_READY_V4_STABLE (95+/100)`);
  reportLines.push('');
  reportLines.push('---');
  reportLines.push('');
  reportLines.push('## Executive Summary');
  reportLines.push('');
  reportLines.push(`| Metric | Score | Max | Issues |`);
  reportLines.push(`|--------|-------|-----|--------|`);
  for (const m of metrics) {
    const icon = m.issues === 0 ? '✅' : m.score >= 15 ? '⚠️' : '❌';
    reportLines.push(`| ${icon} ${m.name} | **${m.score}** | ${m.maxScore} | ${m.issues} |`);
  }
  reportLines.push(`| **TOTAL** | **${totalScore}** | **100** | **${totalIssues}** |`);
  reportLines.push('');
  reportLines.push(`**Grade: ${grade}**`);
  reportLines.push('');
  if (totalScore >= 95) {
    reportLines.push('🟢 **SCORE MEETS CEO_READY_V4_STABLE TARGET (95+)**');
  } else {
    reportLines.push(`🔴 **SCORE BELOW TARGET — ${95 - totalScore} points needed for CEO_READY_V4_STABLE**`);
  }
  reportLines.push('');

  // ── P0/P1 Incidents ──
  if (p0s.length > 0 || p1s.length > 0) {
    reportLines.push('---');
    reportLines.push('');
    reportLines.push('## Incident Summary');
    reportLines.push('');
    if (p0s.length > 0) {
      reportLines.push(`### P0 CRITICAL (${p0s.length})`);
      reportLines.push('');
      for (const p of p0s) {
        reportLines.push(`- **${p.metric}:** ${p.issue}`);
      }
      reportLines.push('');
    }
    if (p1s.length > 0) {
      reportLines.push(`### P1 ISSUES (${p1s.length})`);
      reportLines.push('');
      for (const p of p1s) {
        reportLines.push(`- **${p.metric}:** ${p.issue}`);
      }
      reportLines.push('');
    }
  }

  // ── Detailed metrics ──
  reportLines.push('---');
  reportLines.push('');
  for (const m of metrics) {
    reportLines.push(`## ${m.name} — ${m.score}/${m.maxScore}`);
    reportLines.push('');
    reportLines.push(`${m.detail}`);
    reportLines.push('');
    for (const e of m.evidence) {
      reportLines.push(`- ${e}`);
    }
    reportLines.push('');
  }

  // ── PM2 snapshot ──
  reportLines.push('---');
  reportLines.push('');
  reportLines.push('## PM2 Process Snapshot');
  reportLines.push('');
  reportLines.push(`| Process | PID | Status | Restarts | Memory (MB) | CPU |`);
  reportLines.push(`|---------|-----|--------|----------|-------------|-----|`);
  for (const p of pm2Data) {
    const memMB = p.memory ? (p.memory / 1_048_576).toFixed(0) : '?';
    reportLines.push(`| ${p.name} | ${p.pid} | ${p.status} | ${p.restarts} | ${memMB} | ${p.cpu}% |`);
  }
  reportLines.push('');

  // ── Health probes ──
  reportLines.push('## Health Endpoint Probes');
  reportLines.push('');
  reportLines.push(`| Endpoint | HTTP Status | Result |`);
  reportLines.push(`|----------|-------------|--------|`);
  for (const ep of healthProbes) {
    const status = ep.result?.status || 0;
    const detail = ep.result?.error || (ep.result?.body?.ok ? 'ok' : `HTTP ${status}`);
    reportLines.push(`| ${ep.name} | ${status || 'N/A'} | ${detail} |`);
  }
  reportLines.push('');

  // ── Action items ──
  reportLines.push('---');
  reportLines.push('');
  reportLines.push('## Action Items');
  reportLines.push('');
  reportLines.push('| # | Priority | Metric | Issue | Status |');
  reportLines.push('|---|----------|--------|-------|--------|');
  let itemNum = 1;
  for (const p of p0s) {
    reportLines.push(`| ${itemNum} | P0 | ${p.metric} | ${p.issue.replace(/[❌⚠️✅]/g, '').trim()} | OPEN |`);
    itemNum++;
  }
  for (const p of p1s) {
    reportLines.push(`| ${itemNum} | P1 | ${p.metric} | ${p.issue.replace(/[❌⚠️✅]/g, '').trim()} | OPEN |`);
    itemNum++;
  }
  reportLines.push('');

  reportLines.push('---');
  reportLines.push('');
  reportLines.push(`*Generated by v4-burn-in-monitor.mjs at ${NOW_ISO}*`);

  // ── Write report ──
  const reportContent = reportLines.join('\n');
  fs.writeFileSync(REPORT_FILE, reportContent, 'utf8');

  // ── Console output ──
  console.log('═══════════════════════════════════════════');
  console.log(`  V4 BURN-IN SCORE: ${totalScore}/100  [${grade}]`);
  console.log('═══════════════════════════════════════════');
  for (const m of metrics) {
    const bar = '█'.repeat(m.score) + '░'.repeat(m.maxScore - m.score);
    console.log(`  ${m.name.padEnd(30)} ${bar} ${m.score}/${m.maxScore}`);
  }
  console.log('───────────────────────────────────────────');
  console.log(`  P0 incidents: ${p0s.length}  |  P1 issues: ${p1s.length}`);
  console.log(`  Report: ${REPORT_FILE}`);
  if (totalScore >= 95) {
    console.log('  🟢 TARGET MET: CEO_READY_V4_STABLE');
  } else {
    console.log(`  🔴 ${95 - totalScore} points below CEO_READY_V4_STABLE target`);
  }
  console.log('');

  process.exit(0);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
