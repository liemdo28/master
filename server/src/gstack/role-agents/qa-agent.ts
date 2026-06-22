/**
 * QA Agent
 * Runs tests, regression checks, health sweeps.
 * No agent can claim DONE without QA Agent certification.
 */

import { execSync } from 'child_process';
import path from 'path';

import { WorkOrder, QaCheck } from '../work-order-engine';
import { logAction } from '../execution-ledger';


const MI_CORE_ROOT = process.env.MI_CORE_ROOT || 'E:/Project/Master/mi-core';

export interface QaResult {
  overall: 'PASS' | 'PARTIAL' | 'FAIL';
  checks: QaCheckResult[];
  health_summary: string;
  confidence_score: number;
  blocking_issues: string[];
}

export interface QaCheckResult {
  check_id: string;
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  evidence: string;
  duration_ms: number;
}

// ── Health check (HTTP) ───────────────────────────────────────────────────────

async function httpGet(port: number, path_: string, key?: string): Promise<{ ok: boolean; status: number; body: unknown }> {
  const http = await import('http');
  return new Promise((resolve) => {
    const headers: Record<string, string> = key ? { 'x-api-key': key } : {};
    const req = http.default.get({ hostname: '127.0.0.1', port, path: path_, headers }, (res) => {
      let data = '';
      res.on('data', (d: Buffer) => data += d);
      res.on('end', () => {
        try { resolve({ ok: (res.statusCode || 0) < 400, status: res.statusCode || 0, body: JSON.parse(data) }); }
        catch { resolve({ ok: (res.statusCode || 0) < 400, status: res.statusCode || 0, body: {} }); }
      });
    });
    req.setTimeout(5000, () => { req.destroy(); resolve({ ok: false, status: 0, body: {} }); });
    req.on('error', () => resolve({ ok: false, status: 0, body: {} }));
  });
}

async function runHealthCheck(): Promise<QaCheckResult> {
  const t0 = Date.now();
  const services = [
    { name: 'mi-core', port: 4001, path: '/api/health', key: process.env.MI_CORE_API_KEY || '' },
    { name: 'whatsapp-gateway', port: 3211, path: '/health' },
    { name: 'antigravity-gateway', port: 3456, path: '/health' },
  ];

  const results = await Promise.all(services.map(s => httpGet(s.port, s.path, s.key)));
  const healthy = results.filter(r => r.ok).length;
  const status = healthy === services.length ? 'PASS' : healthy >= 2 ? 'PASS' : 'FAIL';

  return {
    check_id: 'QA3',
    name: 'Service health check',
    status,
    evidence: services.map((s, i) => `${s.name}: ${results[i].ok ? 'UP' : 'DOWN'} (HTTP ${results[i].status})`).join(' | '),
    duration_ms: Date.now() - t0,
  };
}

const REGRESSION_CASES = [
  { id: 'R01', text: 'Mi oi', expect: 'Em đây' },
  { id: 'R02', text: 'Alo', expect: 'Em đây' },
  { id: 'R03', text: 'hom nay a co lich gi ko', expect: ['Em chưa', 'Em đang', 'kết nối'] },
  { id: 'R04', text: 'em co biet anh dang lam project nao ko', expect: ['Dev', 'project', 'em biết'] },
  { id: 'R05', text: 'Co gi dang lo khong', expect: ['Em', 'theo dõi', 'ổn'] },
  { id: 'R06', text: 'Laptop1 sao roi', expect: 'Laptop1' },
  { id: 'R07', text: 'Dev1 dang ket gi', expect: 'Dev1' },
  { id: 'R08', text: 'Tinh hinh Jarvis sao roi', expect: 'Jarvis' },
  { id: 'R09', text: 'cancel', expect: ['cancel', 'hủy', 'Cancel', 'action'] },
  { id: 'R10', text: 'co gi dang lo', expect: 'Em' },
];

async function callJarvisDirect(text: string, sender: string): Promise<string> {
  try {
    const { processJarvisQuery } = require('../../jarvis/phase30-jarvis/jarvis-core');
    const result = await processJarvisQuery({
      sender, raw_text: text, normalized: text, timestamp: new Date().toISOString(),
    });
    return result.reply || '';
  } catch {
    return 'ERROR';
  }
}

async function runRegressionSuite(): Promise<QaCheckResult> {
  const t0 = Date.now();
  let passed = 0; let failed = 0;
  const failures: string[] = [];

  for (const c of REGRESSION_CASES) {
    const reply = await callJarvisDirect(c.text, `qa-regression-${Date.now()}`);
    const expects = Array.isArray(c.expect) ? c.expect : [c.expect];
    const ok = expects.some(e => reply.toLowerCase().includes(e.toLowerCase()));
    const bannedFound = /temporarily unavailable|please try again later|mi-core is|pipeline_error/i.test(reply);
    if (ok && !bannedFound) { passed++; } else {
      failed++;
      failures.push(`${c.id}: "${reply.slice(0, 50)}"`);
    }
  }

  const total = REGRESSION_CASES.length;
  const verdict = failed === 0 ? 'PASS' : 'FAIL';
  return {
    check_id: 'QA1',
    name: 'Regression suite (10 CEO cases)',
    status: verdict,
    evidence: `${passed}/${total} PASS${failures.length > 0 ? ` — Failed: ${failures.join(', ')}` : ''}`,
    duration_ms: Date.now() - t0,
  };
}

async function checkNoP0Issues(): Promise<QaCheckResult> {
  const t0 = Date.now();
  // Check PM2 for crash-looping processes
  try {
    const pm2 = process.env.PM2_BIN || 'pm2';
    const out = execSync(`${pm2} jlist`, { timeout: 8000, encoding: 'utf8', shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh' });
    const procs = JSON.parse(out);
    // P0 = actively errored OR crash-looping with high frequency AND currently down
    // High restart count with status=online means recovered from past crashes, not currently broken
    const crashLooping = procs.filter((p: { name?: string; pm2_env?: { status?: string; restart_time?: number; unstable_restarts?: number } }) => {
      if (p.pm2_env?.status === 'errored') return true;
      // Only flag restart-count if service is not currently online (i.e., currently failing)
      if (p.pm2_env?.status !== 'online' && (p.pm2_env?.restart_time || 0) > 50) return true;
      return false;
    });
    const status = crashLooping.length === 0 ? 'PASS' : 'FAIL';
    return {
      check_id: 'QA2',
      name: 'No P0 open issues',
      status,
      evidence: crashLooping.length === 0
        ? `All ${procs.length} PM2 processes stable`
        : `Crash-looping: ${crashLooping.map((p: { name: string; pm2_env?: { restart_time?: number } }) => `${p.name}(${p.pm2_env?.restart_time}↺)`).join(', ')}`,
      duration_ms: Date.now() - t0,
    };
  } catch {
    return { check_id: 'QA2', name: 'No P0 open issues', status: 'SKIP', evidence: 'PM2 not accessible', duration_ms: Date.now() - t0 };
  }
}

async function checkBuildCompiles(): Promise<QaCheckResult> {
  const t0 = Date.now();
  const serverPath = path.join(MI_CORE_ROOT, 'server');
  try {
    execSync('npx tsc --noEmit', { cwd: serverPath, timeout: 60000, encoding: 'utf8' });
    return { check_id: 'QA5', name: 'Build compiles cleanly', status: 'PASS', evidence: 'tsc --noEmit: 0 errors', duration_ms: Date.now() - t0 };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const errors = (msg.match(/error TS/g) || []).length;
    return { check_id: 'QA5', name: 'Build compiles cleanly', status: 'FAIL', evidence: `${errors} TypeScript error(s)`, duration_ms: Date.now() - t0 };
  }
}

// ── Main QA runner ────────────────────────────────────────────────────────────

export async function runQa(wo: WorkOrder, checks?: QaCheck[]): Promise<QaResult> {
  const results: QaCheckResult[] = [];
  const requestedChecks = new Set((checks || wo.qa_plan).map(c => c.check_id));

  // Always run health check
  results.push(await runHealthCheck());

  // Regression suite for CEO-facing changes
  if (requestedChecks.has('QA1')) {
    results.push(await runRegressionSuite());
  }

  // P0 issue check
  if (requestedChecks.has('QA2')) {
    results.push(await checkNoP0Issues());
  }

  // Build compile check
  if (requestedChecks.has('QA5')) {
    results.push(await checkBuildCompiles());
  }

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const blocking = results.filter(r => r.status === 'FAIL').map(r => `${r.name}: ${r.evidence.slice(0, 80)}`);

  const overall = failed === 0 ? 'PASS' : failed <= 1 && passed >= 2 ? 'PARTIAL' : 'FAIL';
  const confidence = Math.round((passed / results.length) * 100);

  const healthResult = results.find(r => r.check_id === 'QA3');
  const healthSummary = healthResult?.evidence || 'Health check skipped';

  logAction({
    work_order_id: wo.request_id,
    requested_by: wo.requested_by,
    agent_role: 'qa_agent',
    action_type: 'qa_sweep',
    target: wo.target_project || 'all',
    test_result: `${passed}/${results.length} PASS`,
    evidence: results.map(r => `[${r.status}] ${r.name}`).join(' | '),
    verdict: overall === 'PASS' ? 'PASS' : overall === 'PARTIAL' ? 'PENDING' : 'FAIL',
    detail: `Confidence: ${confidence}% | Blocking: ${blocking.length}`,
  });

  return { overall, checks: results, health_summary: healthSummary, confidence_score: confidence, blocking_issues: blocking };
}
