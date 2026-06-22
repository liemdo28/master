/**
 * Phase 6 — Evidence Engine (formal)
 *
 * Every Work Order gets its own evidence directory:
 *   .local-agent-global/evidence/WO-YYYYMMDD-NNN/
 *     source_scan.log
 *     pm2_status.log
 *     error_log.log
 *     health_check.json
 *     test_results.json
 *     dashboard_audit.json
 *     qa_report.md
 *     evidence_index.json      ← master manifest
 *
 * No PASS allowed without evidence.
 * All evidence files are real files — not in-memory records.
 */

import fs from 'fs';
import path from 'path';

const MI_CORE_ROOT = process.env.MI_CORE_ROOT || 'E:/Project/Master/mi-core';
const EVIDENCE_BASE = path.join(MI_CORE_ROOT, '.local-agent-global/evidence');

// ── Types ─────────────────────────────────────────────────────────────────────

export type EvidenceFileType =
  | 'source_scan'       // source_scan.log
  | 'pm2_status'        // pm2_status.log
  | 'error_log'         // error_log.log
  | 'health_check'      // health_check.json
  | 'test_results'      // test_results.json
  | 'dashboard_audit'   // dashboard_audit.json
  | 'qa_report'         // qa_report.md
  | 'command_output'    // command_{n}.log
  | 'file_scan'         // file_scan_{n}.log
  | 'artifact';         // {name}.{ext}

export type EvidenceSeverity = 'info' | 'warning' | 'error' | 'critical';
export type EvidenceOutcome = 'pass' | 'fail' | 'warn' | 'info';

export interface EvidenceFile {
  file_id: string;           // EVF-WO-xxx-NNN
  work_order_id: string;
  ts: string;
  type: EvidenceFileType;
  filename: string;          // relative to WO evidence dir
  filepath: string;          // absolute path
  agent_role: string;
  title: string;
  size_bytes: number;
  severity: EvidenceSeverity;
  outcome: EvidenceOutcome;
  summary: string;           // one-line summary of what was found
  metadata: Record<string, string | number | boolean>;
}

export interface EvidenceIndex {
  work_order_id: string;
  created_at: string;
  updated_at: string;
  directory: string;
  files: EvidenceFile[];
  summary: {
    total_files: number;
    pass_count: number;
    fail_count: number;
    warn_count: number;
    has_source_scan: boolean;
    has_test_results: boolean;
    has_health_check: boolean;
    has_qa_report: boolean;
    critical_findings: string[];
    p0_issues: string[];
  };
}

export interface EvidencePackage {
  work_order_id: string;
  directory: string;
  index_file: string;
  files: EvidenceFile[];
  ready: boolean;             // true = minimum evidence collected
  missing_required: string[]; // list of required types not yet collected
  summary: EvidenceIndex['summary'];
}

// ── Directory helpers ─────────────────────────────────────────────────────────

export function getEvidenceDir(workOrderId: string): string {
  return path.join(EVIDENCE_BASE, workOrderId);
}

function ensureDir(workOrderId: string): string {
  const dir = getEvidenceDir(workOrderId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function indexPath(workOrderId: string): string {
  return path.join(getEvidenceDir(workOrderId), 'evidence_index.json');
}

// ── Index management ──────────────────────────────────────────────────────────

function loadIndex(workOrderId: string): EvidenceIndex {
  const f = indexPath(workOrderId);
  if (!fs.existsSync(f)) {
    return {
      work_order_id: workOrderId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      directory: getEvidenceDir(workOrderId),
      files: [],
      summary: {
        total_files: 0, pass_count: 0, fail_count: 0, warn_count: 0,
        has_source_scan: false, has_test_results: false, has_health_check: false, has_qa_report: false,
        critical_findings: [], p0_issues: [],
      },
    };
  }
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return loadIndex(workOrderId); }
}

function saveIndex(index: EvidenceIndex): void {
  ensureDir(index.work_order_id);
  index.updated_at = new Date().toISOString();
  // Recompute summary
  const files = index.files;
  index.summary = {
    total_files: files.length,
    pass_count: files.filter(f => f.outcome === 'pass').length,
    fail_count: files.filter(f => f.outcome === 'fail').length,
    warn_count: files.filter(f => f.outcome === 'warn').length,
    has_source_scan: files.some(f => f.type === 'source_scan'),
    has_test_results: files.some(f => f.type === 'test_results'),
    has_health_check: files.some(f => f.type === 'health_check'),
    has_qa_report: files.some(f => f.type === 'qa_report'),
    critical_findings: files.filter(f => f.severity === 'critical').map(f => f.summary),
    p0_issues: files.filter(f => f.severity === 'critical' && f.outcome === 'fail').map(f => f.summary),
  };
  fs.writeFileSync(indexPath(index.work_order_id), JSON.stringify(index, null, 2));
}

function nextFileId(index: EvidenceIndex): string {
  const n = String(index.files.length + 1).padStart(3, '0');
  return `EVF-${index.work_order_id}-${n}`;
}

// ── File writer ───────────────────────────────────────────────────────────────

function writeEvidenceFile(
  workOrderId: string,
  filename: string,
  content: string,
  type: EvidenceFileType,
  agentRole: string,
  title: string,
  severity: EvidenceSeverity,
  outcome: EvidenceOutcome,
  summary: string,
  metadata: Record<string, string | number | boolean> = {},
): EvidenceFile {
  const dir = ensureDir(workOrderId);
  const filepath = path.join(dir, filename);
  fs.writeFileSync(filepath, content, 'utf8');

  const index = loadIndex(workOrderId);
  // Overwrite existing file of same type (dedup)
  const existing = index.files.findIndex(f => f.filename === filename);
  const ef: EvidenceFile = {
    file_id: existing >= 0 ? index.files[existing].file_id : nextFileId(index),
    work_order_id: workOrderId,
    ts: new Date().toISOString(),
    type,
    filename,
    filepath,
    agent_role: agentRole,
    title,
    size_bytes: Buffer.byteLength(content, 'utf8'),
    severity,
    outcome,
    summary,
    metadata,
  };

  if (existing >= 0) index.files[existing] = ef;
  else index.files.push(ef);
  saveIndex(index);
  return ef;
}

// ── Public API — named evidence writers ───────────────────────────────────────

export function writeSourceScan(workOrderId: string, output: string, agentRole: string): EvidenceFile {
  const findings = (output.match(/TODO|FIXME|credential|⚠️/gi) || []).length;
  const outcome: EvidenceOutcome = findings > 5 ? 'warn' : 'pass';
  return writeEvidenceFile(workOrderId, 'source_scan.log', output, 'source_scan', agentRole,
    'Source code scan', findings > 0 ? 'warning' : 'info', outcome,
    `${findings} finding(s) in source scan`, { findings });
}

export function writePm2Status(workOrderId: string, output: string, agentRole: string): EvidenceFile {
  // Parse crash-loop info from PM2 output
  let crashInfo = '';
  let severity: EvidenceSeverity = 'info';
  let outcome: EvidenceOutcome = 'pass';
  try {
    const procs = JSON.parse(output);
    const errored = procs.filter((p: any) => p.pm2_env?.status === 'errored');
    if (errored.length > 0) {
      crashInfo = `Errored: ${errored.map((p: any) => p.name).join(', ')}`;
      severity = 'critical';
      outcome = 'fail';
    } else {
      crashInfo = `${procs.length} processes online`;
    }
  } catch {
    crashInfo = output.slice(0, 80);
  }
  return writeEvidenceFile(workOrderId, 'pm2_status.log', output, 'pm2_status', agentRole,
    'PM2 process status', severity, outcome, crashInfo, { raw_length: output.length });
}

export function writeErrorLog(workOrderId: string, output: string, agentRole: string): EvidenceFile {
  const errorLines = output.split('\n').filter(l => /error|Error|ERR/i.test(l));
  const outcome: EvidenceOutcome = errorLines.length > 0 ? 'warn' : 'pass';
  const content = output || '(no log content)';
  return writeEvidenceFile(workOrderId, 'error_log.log', content, 'error_log', agentRole,
    'Error log scan', errorLines.length > 0 ? 'warning' : 'info', outcome,
    `${errorLines.length} error line(s) found`, { error_count: errorLines.length });
}

export function writeHealthCheck(workOrderId: string, results: Array<{ name: string; up: boolean; status: number }>, agentRole: string): EvidenceFile {
  const content = JSON.stringify({ checked_at: new Date().toISOString(), services: results }, null, 2);
  const down = results.filter(r => !r.up);
  const outcome: EvidenceOutcome = down.length === 0 ? 'pass' : down.length < results.length ? 'warn' : 'fail';
  const severity: EvidenceSeverity = outcome === 'fail' ? 'critical' : outcome === 'warn' ? 'warning' : 'info';
  return writeEvidenceFile(workOrderId, 'health_check.json', content, 'health_check', agentRole,
    'Service health check', severity, outcome,
    `${results.length - down.length}/${results.length} services UP`,
    { up_count: results.length - down.length, total: results.length });
}

export function writeTestResults(workOrderId: string, tests: Array<{ id: string; name: string; passed: boolean; output: string; duration_ms: number }>, agentRole: string): EvidenceFile {
  const passed = tests.filter(t => t.passed).length;
  const content = JSON.stringify({ run_at: new Date().toISOString(), total: tests.length, passed, failed: tests.length - passed, tests }, null, 2);
  const outcome: EvidenceOutcome = passed === tests.length ? 'pass' : passed > 0 ? 'warn' : 'fail';
  const severity: EvidenceSeverity = outcome === 'fail' ? 'error' : outcome === 'warn' ? 'warning' : 'info';
  return writeEvidenceFile(workOrderId, 'test_results.json', content, 'test_results', agentRole,
    'Test execution results', severity, outcome,
    `${passed}/${tests.length} tests PASS`, { passed, total: tests.length });
}

export function writeDashboardAudit(workOrderId: string, data: Record<string, unknown>, agentRole: string): EvidenceFile {
  const content = JSON.stringify({ audited_at: new Date().toISOString(), ...data }, null, 2);
  const ok = (data.services_up as number || 0) >= 2;
  return writeEvidenceFile(workOrderId, 'dashboard_audit.json', content, 'dashboard_audit', agentRole,
    'Dashboard audit', ok ? 'info' : 'error', ok ? 'pass' : 'fail',
    String(data.summary || 'Dashboard audit complete'), {});
}

export function writeQaReport(workOrderId: string, content: string, agentRole: string): EvidenceFile {
  return writeEvidenceFile(workOrderId, 'qa_report.md', content, 'qa_report', agentRole,
    'QA certification report', 'info', 'info',
    'QA report generated', { length: content.length });
}

export function writeCommandOutput(workOrderId: string, command: string, output: string, success: boolean, agentRole: string, suffix?: string): EvidenceFile {
  const index = loadIndex(workOrderId);
  const n = index.files.filter(f => f.type === 'command_output').length + 1;
  const filename = suffix ? `command_${suffix}.log` : `command_${n}.log`;
  return writeEvidenceFile(workOrderId, filename, `# Command\n${command}\n\n# Output\n${output}`, 'command_output', agentRole,
    `Command: ${command.slice(0, 60)}`, success ? 'info' : 'error', success ? 'pass' : 'fail',
    `Exit: ${success ? 'OK' : 'FAIL'} | ${output.slice(0, 80)}`, { command: command.slice(0, 120) });
}

export function writeArtifact(workOrderId: string, filename: string, content: string, agentRole: string, title: string): EvidenceFile {
  return writeEvidenceFile(workOrderId, filename, content, 'artifact', agentRole,
    title, 'info', 'pass', `Artifact: ${filename}`, { filename });
}

// ── Evidence Package builder ──────────────────────────────────────────────────

// qa_report is written by the certification process itself — not an input evidence file
const REQUIRED_TYPES: Array<{ type: EvidenceFileType; label: string }> = [
  { type: 'health_check',  label: 'health_check.json' },
  { type: 'test_results',  label: 'test_results.json' },
];

export function generateEvidencePackage(workOrderId: string): EvidencePackage {
  const index = loadIndex(workOrderId);
  const dir = getEvidenceDir(workOrderId);

  const presentTypes = new Set(index.files.map(f => f.type));
  const missing = REQUIRED_TYPES.filter(r => !presentTypes.has(r.type)).map(r => r.label);

  return {
    work_order_id: workOrderId,
    directory: dir,
    index_file: indexPath(workOrderId),
    files: index.files,
    ready: missing.length === 0 && index.files.length >= 3,
    missing_required: missing,
    summary: index.summary,
  };
}

export function getEvidencePackage(workOrderId: string): EvidencePackage {
  return generateEvidencePackage(workOrderId);
}

// Backward-compat shims used by orchestrator / certification engine
export function getEvidenceBundle(workOrderId: string) {
  const pkg = generateEvidencePackage(workOrderId);
  const files = pkg.files;
  const by = (type: EvidenceFileType) => files.filter(f => f.type === type);
  return {
    work_order_id: workOrderId,
    collected_at: new Date().toISOString(),
    total_items: files.length,
    files_inspected: by('file_scan').concat(by('source_scan')),
    commands_executed: by('command_output'),
    test_outputs: by('test_results'),
    errors_found: files.filter(f => f.outcome === 'fail' || f.severity === 'error' || f.severity === 'critical'),
    changes_made: [],
    artifacts: by('artifact').concat(by('qa_report')),
    other: by('pm2_status').concat(by('error_log')).concat(by('health_check')).concat(by('dashboard_audit')),
    summary: {
      pass_count: pkg.summary.pass_count,
      fail_count: pkg.summary.fail_count,
      warn_count: pkg.summary.warn_count,
      critical_errors: pkg.summary.critical_findings,
      p0_issues: pkg.summary.p0_issues,
      p1_issues: files.filter(f => f.severity === 'error' && f.outcome === 'fail').map(f => f.summary),
    },
  };
}

export function hasEvidence(workOrderId: string): boolean {
  return loadIndex(workOrderId).files.length > 0;
}

export function getEvidenceCount(workOrderId: string): number {
  return loadIndex(workOrderId).files.length;
}

// Legacy shims for addCommandRun / addTestOutput / etc. (called from orchestrator transition code)
export function addCommandRun(woId: string, cmd: string, out: string, ok: boolean, role: string): void {
  writeCommandOutput(woId, cmd, out, ok, role);
}
export function addTestOutput(woId: string, testId: string, name: string, passed: boolean, output: string, role: string): void {
  // Accumulate — will be replaced by writeTestResults() at end of QA
  const dir = ensureDir(woId);
  const accPath = path.join(dir, '_test_accumulator.json');
  let acc: any[] = [];
  try { acc = JSON.parse(fs.readFileSync(accPath, 'utf8')); } catch { /* empty */ }
  acc.push({ id: testId, name, passed, output: output.slice(0, 200), duration_ms: 0 });
  fs.writeFileSync(accPath, JSON.stringify(acc));
  writeTestResults(woId, acc, role);
}
export function addErrorFound(woId: string, description: string, location: string, severity: EvidenceSeverity, role: string): void {
  const index = loadIndex(woId);
  const existing = index.files.find(f => f.type === 'error_log');
  const prev = existing && fs.existsSync(existing.filepath) ? fs.readFileSync(existing.filepath, 'utf8') : '';
  writeEvidenceFile(woId, 'error_log.log', prev + `\n[${severity.toUpperCase()}] ${location}: ${description}`,
    'error_log', role, 'Error log', severity, 'fail', description.slice(0, 100));
}
export function addHealthCheck(woId: string, service: string, status: 'up' | 'down', detail: string, role: string): void {
  // Accumulate into health_check.json
  const dir = ensureDir(woId);
  const accPath = path.join(dir, '_health_accumulator.json');
  let acc: any[] = [];
  try { acc = JSON.parse(fs.readFileSync(accPath, 'utf8')); } catch { /* empty */ }
  acc.push({ name: service, up: status === 'up', status: status === 'up' ? 200 : 503, detail });
  fs.writeFileSync(accPath, JSON.stringify(acc));
  writeHealthCheck(woId, acc, role);
}
export function addArtifact(woId: string, artifactPath: string, artifactType: string, role: string): void {
  const name = path.basename(artifactPath);
  writeEvidenceFile(woId, `artifact_${name}.json`, JSON.stringify({ artifact_type: artifactType, path: artifactPath, recorded_at: new Date().toISOString() }),
    'artifact', role, `Artifact: ${name}`, 'info', 'pass', `${artifactType} at ${artifactPath}`);
}
