// tests/stress/qa-rerun-storm.test.js
// Stress-tests the QA accounting layer under rapid run + rerun conditions.
// Validates flaky test detection, regression scoring, and audit chain integrity.
import { describe, test, expect, beforeEach } from '@jest/globals';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { startQARun, completeQARun, getQAStats, detectFlakyTests } from '../../core/QAAccounting.js';
import { verifyChain } from '../../core/AuditLedger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schema    = readFileSync(join(__dirname, '../../database/schema.sql'), 'utf8');

function freshDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.exec(schema);
  return db;
}

describe('QA rerun storm — accounting correctness', () => {
  let db;
  beforeEach(() => { db = freshDb(); });

  test('500 rapid QA runs — stats consistent with actual rows', () => {
    const N = 500;
    const project = 'storm-project';
    let passCount = 0;

    for (let i = 0; i < N; i++) {
      const pass = i % 5 !== 0;
      if (pass) passCount++;
      const run_id = startQARun(db, project);
      completeQARun(db, run_id, {
        total_tests:      100,
        failed_tests:     pass ? 0 : 5,
        flaky_tests:      i % 10 === 0 ? 1 : 0,
        qa_reruns:        i % 20 === 0 ? 2 : 0,
        regression_score: pass ? 0.1 : 0.7,
        fix_time_minutes: Math.random() * 10,
        build_success:    true,
        test_success:     pass,
        qa_score:         pass ? 90 : 40,
        qa_grade:         pass ? 'PASS' : 'FAIL',
        total_cost_cents: 100,
        repeated_issue_key: i % 10 === 0 ? 'flaky-auth-middleware' : null,
      });
    }

    const stats = getQAStats(db);
    expect(stats.total_runs).toBe(N);
    expect(stats.pass_count).toBe(passCount);
    expect(stats.fail_count).toBe(N - passCount);

    // Audit chain must be valid
    const audit = verifyChain(db);
    expect(audit.valid).toBe(true);
    // 2 audit events per run (started + completed)
    expect(audit.rowsChecked).toBe(N * 2);
  });

  test('flaky test detection identifies recurring issue keys', () => {
    const project = 'flaky-project';
    for (let i = 0; i < 30; i++) {
      const run_id = startQARun(db, project);
      completeQARun(db, run_id, {
        total_tests: 50, failed_tests: 1, build_success: true, test_success: false,
        qa_grade: 'FAIL', qa_score: 60, total_cost_cents: 50,
        repeated_issue_key: i % 3 === 0 ? 'timeout-in-auth-test' : i % 3 === 1 ? 'db-connection-leak' : null,
      });
    }

    const flaky = detectFlakyTests(db, project);
    // Both recurring keys should appear
    expect(flaky.some((f) => f.repeated_issue_key === 'timeout-in-auth-test')).toBe(true);
    expect(flaky.some((f) => f.repeated_issue_key === 'db-connection-leak')).toBe(true);
    // All occurrences > 1 (that's the threshold)
    expect(flaky.every((f) => f.occurrences > 1)).toBe(true);
  });

  test('qa_reruns field accumulates correctly across rapid runs', () => {
    const project = 'rerun-project';
    let totalReruns = 0;
    for (let i = 0; i < 100; i++) {
      const reruns = i % 3;
      totalReruns += reruns;
      const run_id = startQARun(db, project);
      completeQARun(db, run_id, {
        total_tests: 10, failed_tests: 0, build_success: true,
        test_success: true, qa_grade: 'PASS', qa_score: 95,
        total_cost_cents: 10, qa_reruns: reruns,
      });
    }
    // Sum of qa_reruns matches what we inserted
    const row = db.prepare(
      'SELECT SUM(qa_reruns) as total FROM qa_runs WHERE project_name = ?'
    ).get(project);
    expect(row.total).toBe(totalReruns);
  });

  test('mixed projects — stats isolated per project', () => {
    const projects = ['alpha', 'beta', 'gamma'];
    const runsPerProject = 50;

    for (const project of projects) {
      for (let i = 0; i < runsPerProject; i++) {
        const run_id = startQARun(db, project);
        completeQARun(db, run_id, {
          total_tests: 20, failed_tests: 0, build_success: true,
          test_success: true, qa_grade: 'PASS', qa_score: 100, total_cost_cents: 20,
        });
      }
    }

    for (const project of projects) {
      const count = db.prepare(
        'SELECT COUNT(*) as c FROM qa_runs WHERE project_name = ?'
      ).get(project).c;
      expect(count).toBe(runsPerProject);
    }

    expect(verifyChain(db).valid).toBe(true);
  });

  test('high regression_score propagates correctly', () => {
    const project = 'regress-project';
    for (let i = 0; i < 20; i++) {
      const run_id = startQARun(db, project);
      completeQARun(db, run_id, {
        total_tests: 100, failed_tests: 50,
        regression_score: 0.95,   // near-maximum regression
        build_success: false, test_success: false,
        qa_grade: 'FAIL', qa_score: 10, total_cost_cents: 500,
      });
    }
    const stats = db.prepare(
      'SELECT AVG(regression_score) as avg FROM qa_runs WHERE project_name = ?'
    ).get(project);
    expect(stats.avg).toBeCloseTo(0.95, 2);
    expect(verifyChain(db).valid).toBe(true);
  });
});
