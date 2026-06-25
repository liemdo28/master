/**
 * Phase 34F — Test Orchestrator
 * Runs unit, API, and E2E (Playwright) tests for an engineering task.
 */

import * as path from 'path';
import * as fs from 'fs';
import { addEvidence } from './evidence-engine';
import { updateStatus } from './engineering-queue';

export type TestType = 'unit' | 'api' | 'e2e' | 'smoke';

export interface TestCase {
  name:    string;
  type:    TestType;
  url?:    string;      // for api/e2e
  method?: string;
  body?:   object;
  expect?: object | number | string;
}

export interface TestResult {
  name:    string;
  type:    TestType;
  passed:  boolean;
  latency_ms: number;
  output:  string;
  error?:  string;
}

export interface TestSuiteResult {
  task_id:  string;
  total:    number;
  passed:   number;
  failed:   number;
  score:    number;
  results:  TestResult[];
  summary:  string;
}

// ── API test runner ───────────────────────────────────────────────────────────

async function runApiTest(tc: TestCase): Promise<TestResult> {
  const start = Date.now();
  const http = require('http') as typeof import('http');
  const https = require('https') as typeof import('https');

  return new Promise((resolve) => {
    const url = new URL(tc.url!);
    const isHttps = url.protocol === 'https:';
    const body    = tc.body ? JSON.stringify(tc.body) : undefined;

    const options = {
      hostname: url.hostname,
      port:     url.port || (isHttps ? 443 : 80),
      path:     url.pathname + url.search,
      method:   tc.method || 'GET',
      headers:  {
        'Content-Type': 'application/json',
        ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
      },
    };

    const lib = isHttps ? https : http;
    const req = lib.request(options as any, (res: any) => {
      let d = '';
      res.on('data', (c: any) => d += c);
      res.on('end', () => {
        const latency_ms = Date.now() - start;
        const status = res.statusCode as number;

        // Evaluate expectation
        let passed = true;
        let output = `HTTP ${status}: ${d.slice(0, 200)}`;

        if (typeof tc.expect === 'number') {
          passed = status === tc.expect;
        } else if (typeof tc.expect === 'object' && tc.expect !== null) {
          try {
            const json = JSON.parse(d);
            passed = Object.entries(tc.expect).every(([k, v]) => json[k] === v);
          } catch {
            passed = false; output = `Parse error: ${d.slice(0, 100)}`;
          }
        } else {
          passed = status >= 200 && status < 300;
        }

        resolve({ name: tc.name, type: tc.type, passed, latency_ms, output });
      });
    });

    req.on('error', (e: Error) => resolve({
      name: tc.name, type: 'api', passed: false,
      latency_ms: Date.now() - start, output: '', error: e.message,
    }));

    if (body) req.write(body);
    req.end();
  });
}

// ── E2E test runner (Playwright) ──────────────────────────────────────────────

async function runE2eTest(tc: TestCase): Promise<TestResult> {
  const start = Date.now();
  let chromium: any;
  try {
    chromium = require('playwright').chromium;
  } catch {
    return {
      name: tc.name, type: 'e2e', passed: false, latency_ms: 0,
      output: '', error: 'Playwright not installed. Run: npm install playwright',
    };
  }

  const browser = await chromium.launch({ headless: true });
  const page    = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e: any) => errors.push(e.message));

  try {
    await page.goto(tc.url!, { timeout: 20000, waitUntil: 'networkidle' });
    const title = await page.title();
    await browser.close();
    const passed = errors.length === 0;
    return {
      name: tc.name, type: 'e2e', passed,
      latency_ms: Date.now() - start,
      output: `Title: "${title}"` + (errors.length ? ` | Errors: ${errors.join('; ')}` : ''),
    };
  } catch (e: any) {
    await browser.close();
    return { name: tc.name, type: 'e2e', passed: false, latency_ms: Date.now() - start, output: '', error: e.message };
  }
}

// ── Unit test runner ──────────────────────────────────────────────────────────

function runUnitTest(tc: TestCase): TestResult {
  const start = Date.now();
  // Unit tests are defined inline via tc.body as { fn: string, args: any[], expected: any }
  try {
    const { fn, args, expected } = (tc.body || {}) as any;
    if (!fn) return { name: tc.name, type: 'unit', passed: false, latency_ms: 0, output: 'No fn provided', error: 'missing fn' };
    const result = eval(fn)(...(args || []));
    const passed = JSON.stringify(result) === JSON.stringify(expected);
    return {
      name: tc.name, type: 'unit', passed,
      latency_ms: Date.now() - start,
      output: `result=${JSON.stringify(result)} expected=${JSON.stringify(expected)}`,
    };
  } catch (e: any) {
    return { name: tc.name, type: 'unit', passed: false, latency_ms: Date.now() - start, output: '', error: e.message };
  }
}

// ── Main test runner ──────────────────────────────────────────────────────────

export async function runTests(taskId: string, cases: TestCase[]): Promise<TestSuiteResult> {
  updateStatus(taskId, 'TESTING');

  const results: TestResult[] = await Promise.all(cases.map(async (tc) => {
    switch (tc.type) {
      case 'api':   return runApiTest(tc);
      case 'e2e':   return runE2eTest(tc);
      case 'smoke': return runApiTest({ ...tc, expect: tc.expect ?? 200 });
      case 'unit':  return runUnitTest(tc);
    }
  }));

  const passed = results.filter(r => r.passed).length;
  const score  = cases.length > 0 ? Math.round((passed / cases.length) * 100) : 0;

  const summary = `${passed}/${cases.length} passed (${score}%). ` +
    results.filter(r => !r.passed).map(r => `FAIL: ${r.name}`).join(', ');

  addEvidence({
    task_id: taskId,
    type:    'test_result',
    source:  'Test Orchestrator',
    content: summary + '\n\n' + results.map(r =>
      `[${r.passed ? 'PASS' : 'FAIL'}] ${r.name} (${r.latency_ms}ms): ${r.output || r.error || ''}`
    ).join('\n'),
  });

  return { task_id: taskId, total: cases.length, passed, failed: cases.length - passed, score, results, summary };
}

// ── Default smoke suite for mi-core ──────────────────────────────────────────

export function getMiCoreSmokeTests(baseUrl = 'http://localhost:4001'): TestCase[] {
  return [
    { name: 'Health check',          type: 'api', url: `${baseUrl}/api/health`,              expect: 200 },
    { name: 'Engineering classify',  type: 'api', url: `${baseUrl}/api/engineering/classify`,
      method: 'POST', body: { objective: 'fix bug' }, expect: 200 },
    { name: 'AI providers list',     type: 'api', url: `${baseUrl}/api/ai/providers`,        expect: 200 },
    { name: 'Engineering stats',     type: 'api', url: `${baseUrl}/api/engineering/stats`,   expect: 200 },
  ];
}
