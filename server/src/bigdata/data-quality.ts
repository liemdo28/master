/**
 * Data Quality Service — Phase 5
 * Runs automated checks and records results in data_quality_checks.
 */

import { pgQuery } from './db-client';
import { auditLog } from './audit-service';
import fs from 'fs';
import path from 'path';

export interface QualityCheckResult {
  check_name: string;
  status: 'pass' | 'warn' | 'fail' | 'error';
  severity: 'info' | 'warn' | 'critical';
  result: Record<string, unknown>;
}

async function recordCheck(source_id: number | null, result: QualityCheckResult): Promise<void> {
  await pgQuery(
    `INSERT INTO data_quality_checks (source_id, check_name, status, severity, result_json) VALUES ($1,$2,$3,$4,$5)`,
    [source_id, result.check_name, result.status, result.severity, JSON.stringify(result.result)]
  );
}

async function checkDuplicateChecksums(): Promise<QualityCheckResult> {
  const rows = await pgQuery<{ checksum: string; cnt: string }>(
    `SELECT checksum, COUNT(*) as cnt FROM raw_objects WHERE checksum IS NOT NULL GROUP BY checksum HAVING COUNT(*) > 1`
  );
  return {
    check_name: 'duplicate_checksum',
    status: rows.length > 0 ? 'warn' : 'pass',
    severity: 'warn',
    result: { duplicate_count: rows.length, checksums: rows.slice(0, 10).map(r => r.checksum) },
  };
}

async function checkMissingStoreId(): Promise<QualityCheckResult> {
  const rows = await pgQuery<{ cnt: string }>(
    `SELECT COUNT(*) as cnt FROM normalized_events WHERE store_id IS NULL OR store_id = ''`
  );
  const count = parseInt(rows[0]?.cnt || '0');
  return {
    check_name: 'missing_store_id',
    status: count > 10 ? 'fail' : count > 0 ? 'warn' : 'pass',
    severity: count > 10 ? 'critical' : 'warn',
    result: { events_missing_store_id: count },
  };
}

async function checkInvalidEventTime(): Promise<QualityCheckResult> {
  const rows = await pgQuery<{ cnt: string }>(
    `SELECT COUNT(*) as cnt FROM normalized_events WHERE event_time > NOW() + INTERVAL '1 day' OR event_time < '2020-01-01'`
  );
  const count = parseInt(rows[0]?.cnt || '0');
  return {
    check_name: 'invalid_event_time',
    status: count > 0 ? 'warn' : 'pass',
    severity: 'warn',
    result: { invalid_time_count: count },
  };
}

async function checkStaleSources(): Promise<QualityCheckResult> {
  const rows = await pgQuery<{ name: string; last_job: string }>(
    `SELECT s.name, MAX(j.finished_at) as last_job
     FROM data_sources s
     LEFT JOIN ingestion_jobs j ON j.source_id = s.id AND j.status = 'completed'
     WHERE s.status = 'active'
     GROUP BY s.name
     HAVING MAX(j.finished_at) < NOW() - INTERVAL '7 days' OR MAX(j.finished_at) IS NULL`
  );
  return {
    check_name: 'stale_source',
    status: rows.length > 0 ? 'warn' : 'pass',
    severity: 'warn',
    result: { stale_sources: rows.map(r => ({ name: r.name, last_job: r.last_job || 'never' })) },
  };
}

async function checkFailedIngestions(): Promise<QualityCheckResult> {
  const rows = await pgQuery<{ cnt: string }>(
    `SELECT COUNT(*) as cnt FROM ingestion_jobs WHERE status = 'failed' AND created_at > NOW() - INTERVAL '24 hours'`
  );
  const count = parseInt(rows[0]?.cnt || '0');
  return {
    check_name: 'failed_ingestion_24h',
    status: count > 5 ? 'fail' : count > 0 ? 'warn' : 'pass',
    severity: count > 5 ? 'critical' : 'warn',
    result: { failed_jobs_24h: count },
  };
}

async function checkEmptyObjects(): Promise<QualityCheckResult> {
  const rows = await pgQuery<{ cnt: string }>(
    `SELECT COUNT(*) as cnt FROM raw_objects WHERE file_size IS NOT NULL AND file_size < 10`
  );
  const count = parseInt(rows[0]?.cnt || '0');
  return {
    check_name: 'empty_file',
    status: count > 0 ? 'warn' : 'pass',
    severity: 'warn',
    result: { empty_object_count: count },
  };
}

async function checkSuspiciousAmounts(): Promise<QualityCheckResult> {
  const rows = await pgQuery<{ id: number; amount: string; title: string }>(
    `SELECT id, amount, title FROM normalized_events
     WHERE amount IS NOT NULL AND (amount > 50000 OR amount < -5000)
     ORDER BY amount DESC LIMIT 20`
  );
  return {
    check_name: 'suspicious_amount',
    status: rows.length > 0 ? 'warn' : 'pass',
    severity: 'warn',
    result: { suspicious_transactions: rows.length, examples: rows.slice(0, 5) },
  };
}

async function checkQBDailyLogs(): Promise<QualityCheckResult> {
  // Check if QB events are present for the last 7 days
  const rows = await pgQuery<{ event_day: string }>(
    `SELECT DATE(event_time) as event_day
     FROM normalized_events e
     JOIN data_sources s ON s.id = e.source_id
     WHERE s.type = 'quickbooks'
       AND event_time > NOW() - INTERVAL '7 days'
     GROUP BY DATE(event_time)
     ORDER BY event_day`
  );
  const presentDays = new Set(rows.map(r => {
    const value = r.event_day as unknown;
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value).slice(0, 10);
  }));
  const missing: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    if (!presentDays.has(ds)) missing.push(ds);
  }
  return {
    check_name: 'missing_qb_daily_log',
    status: missing.length > 3 ? 'fail' : missing.length > 0 ? 'warn' : 'pass',
    severity: missing.length > 3 ? 'critical' : 'warn',
    result: { missing_days: missing, present_days: rows.length },
  };
}

export async function runAllChecks(): Promise<{ results: QualityCheckResult[]; summary: Record<string, number> }> {
  const checks = [
    checkDuplicateChecksums,
    checkMissingStoreId,
    checkInvalidEventTime,
    checkStaleSources,
    checkFailedIngestions,
    checkEmptyObjects,
    checkSuspiciousAmounts,
    checkQBDailyLogs,
  ];

  const results: QualityCheckResult[] = [];
  for (const fn of checks) {
    try {
      const r = await fn();
      results.push(r);
      await recordCheck(null, r);
    } catch (e) {
      results.push({ check_name: fn.name, status: 'error', severity: 'critical', result: { error: String(e) } });
    }
  }

  const summary = { pass: 0, warn: 0, fail: 0, error: 0 };
  for (const r of results) summary[r.status]++;

  await auditLog({ actor: 'system', action: 'quality_check_run', after_json: { summary } });
  return { results, summary };
}

export async function generateQualityReport(outputPath: string): Promise<string> {
  const { results, summary } = await runAllChecks();
  const lines: string[] = [
    '# Mi Big Data Quality Report',
    `**Date:** ${new Date().toISOString()}`,
    '',
    '## Summary',
    `| Status | Count |`,
    `|---|---|`,
    `| ✅ Pass | ${summary.pass} |`,
    `| ⚠️ Warn | ${summary.warn} |`,
    `| ❌ Fail | ${summary.fail} |`,
    `| 💥 Error | ${summary.error} |`,
    '',
    '## Check Results',
    '',
  ];

  for (const r of results) {
    const icon = r.status === 'pass' ? '✅' : r.status === 'warn' ? '⚠️' : r.status === 'fail' ? '❌' : '💥';
    lines.push(`### ${icon} ${r.check_name} (${r.severity})`);
    lines.push(`**Status:** ${r.status}`);
    lines.push('```json');
    lines.push(JSON.stringify(r.result, null, 2));
    lines.push('```');
    lines.push('');
  }

  const content = lines.join('\n');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, content, 'utf-8');
  return content;
}
