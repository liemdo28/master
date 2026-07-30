// core/QAAccounting.js - QA run cost and regression accounting
import { appendAuditEvent } from './AuditLedger.js';
import { randomUUID } from 'crypto';

export function startQARun(db, projectName, sessionId = null) {
  const run_id    = `qa-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const startedAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO qa_runs (run_id, session_id, project_name, started_at)
    VALUES (@run_id, @session_id, @project_name, @started_at)
  `).run({ run_id, session_id: sessionId, project_name: projectName, started_at: startedAt });
  appendAuditEvent(db, 'QA_RUN_STARTED', { run_id, project_name: projectName });
  return run_id;
}

export function completeQARun(db, run_id, results) {
  const {
    total_tests = 0, failed_tests = 0, flaky_tests = 0, qa_reruns = 0,
    regression_score = 0.0, fix_time_minutes = 0.0, repeated_issue_key = null,
    build_success = false, test_success = false, qa_score = null, qa_grade = null,
    total_cost_cents = 0,
  } = results;

  const completed_at = new Date().toISOString();
  db.prepare(`
    UPDATE qa_runs SET
      completed_at = @completed_at, total_tests = @total_tests,
      failed_tests = @failed_tests, flaky_tests = @flaky_tests,
      qa_reruns = @qa_reruns, regression_score = @regression_score,
      fix_time_minutes = @fix_time_minutes, repeated_issue_key = @repeated_issue_key,
      build_success = @build_success, test_success = @test_success,
      qa_score = @qa_score, qa_grade = @qa_grade, total_cost_cents = @total_cost_cents
    WHERE run_id = @run_id
  `).run({
    run_id, completed_at, total_tests, failed_tests, flaky_tests, qa_reruns,
    regression_score, fix_time_minutes, repeated_issue_key,
    build_success: build_success ? 1 : 0, test_success: test_success ? 1 : 0,
    qa_score, qa_grade, total_cost_cents,
  });

  appendAuditEvent(db, 'QA_RUN_COMPLETED', { run_id, qa_grade, qa_score, failed_tests });
  return getQARun(db, run_id);
}

export function getQARun(db, run_id) {
  return db.prepare('SELECT * FROM qa_runs WHERE run_id = ?').get(run_id);
}

export function listQARuns(db, { limit = 50, offset = 0 } = {}) {
  return db.prepare(
    'SELECT * FROM qa_runs ORDER BY started_at DESC LIMIT ? OFFSET ?'
  ).all(limit, offset);
}

export function getQAStats(db) {
  return db.prepare(`
    SELECT
      COUNT(*)                                  as total_runs,
      AVG(total_tests)                          as avg_tests,
      AVG(failed_tests)                         as avg_failed,
      AVG(qa_score)                             as avg_score,
      SUM(total_cost_cents)                     as total_cost_cents,
      SUM(CASE WHEN qa_grade='PASS' THEN 1 ELSE 0 END) as pass_count,
      SUM(CASE WHEN qa_grade='FAIL' THEN 1 ELSE 0 END) as fail_count,
      AVG(regression_score)                     as avg_regression_score,
      MAX(completed_at)                         as last_run_at
    FROM qa_runs WHERE completed_at IS NOT NULL
  `).get();
}

export function detectFlakyTests(db, projectName, windowRuns = 10) {
  // A test is considered flaky if it appears in repeated_issue_key across multiple runs
  const rows = db.prepare(`
    SELECT repeated_issue_key, COUNT(*) as occurrences
    FROM qa_runs
    WHERE project_name = ? AND repeated_issue_key IS NOT NULL
    GROUP BY repeated_issue_key
    HAVING occurrences > 1
    ORDER BY occurrences DESC
    LIMIT 20
  `).all(projectName);
  return rows;
}
